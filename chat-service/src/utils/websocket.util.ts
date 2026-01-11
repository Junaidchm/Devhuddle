import { Server, WebSocket } from "ws";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import logger from "./logger.util";
import { ChatService } from "../services/impliments/chat.service";
import { redisPublisher, redisSubscriber } from "../config/redis.config";


interface AuthenticatedWebSocket extends WebSocket {
    userId?: string;  // Optional (initially undefined)
    isAlive?: boolean; // Optional
}

// Configuration constants
const MAX_CONNECTIONS_PER_USER = 5;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const WEBSOCKET_PATH = '/api/v1/chat';
const AUTH_TIMEOUT = 5000; // 5 seconds


export class WebSocketService {
    private _wss: Server;
    private _connections: Map<string, Set<AuthenticatedWebSocket>> = new Map();
    private _pendingConnections: Map<AuthenticatedWebSocket, NodeJS.Timeout> = new Map();

    constructor(_server: HttpServer, private chatService: ChatService) {
        this._wss = new Server({
            server: _server,
            path: WEBSOCKET_PATH,
            verifyClient: (info: any) => {
                //  No token check here - we'll authenticate after connection
                return true;
            }
        });

        this._initializeWebSocket();
        this._setupRedisSubscription();
    }

    private _initializeWebSocket() {

        this._wss.on("connection", (ws: AuthenticatedWebSocket, req: any) => {
            logger.info("New WebSocket connection (awaiting authentication)");

            // Mark as unauthenticated
            ws.isAlive = false; // Don't ping until authenticated

            // Set 5-second timeout
            const authTimeout = setTimeout(() => {
                if (!ws.userId) {
                    logger.warn("Authentication timeout");
                    ws.close(4002, "Authentication timeout");
                    this._pendingConnections.delete(ws);
                }
            }, AUTH_TIMEOUT);

            this._pendingConnections.set(ws, authTimeout);

            const handleAuth = async (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString());

                    // Validate it's auth message
                    if (message.type !== "auth" || !message.token) {
                        ws.send(JSON.stringify({
                            type: "auth_error",
                            error: "First message must be authentication"
                        }));
                        ws.close(4001, "Authentication required");
                        this._pendingConnections.delete(ws);
                        clearTimeout(authTimeout);
                        return;
                    }

                    // Verify JWT
                    let userId: string;
                    try {
                        const decoded = jwt.verify(
                            message.token,
                            process.env.ACCESS_TOKEN_SECRET as string
                        ) as { id: string };

                        if (!decoded || !decoded.id) {
                            throw new Error("Invalid token");
                        }

                        userId = decoded.id;
                    } catch (error: any) {
                        ws.send(JSON.stringify({
                            type: "auth_error",
                            error: "Invalid token"
                        }));
                        ws.close(4001, "Unauthorized");
                        this._pendingConnections.delete(ws);
                        clearTimeout(authTimeout);
                        return;
                    }

                    // Check connection limit
                    const userConnections = this._connections.get(userId);
                    if (userConnections && userConnections.size >= MAX_CONNECTIONS_PER_USER) {
                        ws.send(JSON.stringify({
                            type: "auth_error",
                            error: "Too many connections"
                        }));
                        ws.close(4003, "Too many connections");
                        this._pendingConnections.delete(ws);
                        clearTimeout(authTimeout);
                        return;
                    }

                    // SUCCESS! Authenticate the user
                    ws.userId = userId;
                    ws.isAlive = true;
                    clearTimeout(authTimeout);
                    this._pendingConnections.delete(ws);
                    this._addConnection(userId, ws);

                    ws.send(JSON.stringify({ type: "auth_success" }));
                    logger.info("WebSocket authenticated", { userId });

                    // Now switch to normal message handler
                    ws.off('message', handleAuth);
                    ws.on('message', async (data) => {
                        try {
                            const message = JSON.parse(data.toString());

                            // Route based on message type
                            switch (message.type) {
                                case 'send_message':
                                    await this._handleSendMessage(ws, message);
                                    break;

                                case 'typing':
                                    await this._handleTyping(ws, message);
                                    break;

                                default:
                                    logger.warn("Unknown message type", { type: message.type });
                                    ws.send(JSON.stringify({
                                        type: "error",
                                        error: "Unknown message type"
                                    }));
                            }
                        } catch (error: any) {
                            logger.error("Message handling error", {
                                error: error.message,
                                userId: ws.userId
                            });
                            ws.send(JSON.stringify({
                                type: "error",
                                error: "Failed to process message"
                            }));
                        }
                    });

                    ws.on("pong", () => {
                        ws.isAlive = true;
                    });
                    // Handle close event
                    ws.on("close", () => {
                        this._removeConnection(ws.userId!, ws);
                        logger.info("WebSocket disconnected", {
                            userId: ws.userId
                        });
                    });
                    // Handle error event
                    ws.on("error", (error) => {
                        logger.error("WebSocket error", {
                            error: error.message,
                            userId: ws.userId
                        });
                    });

                } catch (error: any) {
                    logger.error("Auth error", { error: error.message });
                    ws.close(4000, "Invalid message");
                    this._pendingConnections.delete(ws);
                    clearTimeout(authTimeout);
                }
            };
            // Listen for first message
            ws.once('message', handleAuth);
        });

    }

    private async _handleSendMessage(
        ws: AuthenticatedWebSocket,
        message: any
    ): Promise<void> {
        // Validate message structure
        if (!message.recipientIds || !Array.isArray(message.recipientIds)) {
            ws.send(JSON.stringify({
                type: "error",
                error: "Invalid recipientIds"
            }));
            return;
        }

        if (!message.content || typeof message.content !== 'string') {
            ws.send(JSON.stringify({
                type: "error",
                error: "Invalid content"
            }));
            return;
        }

        try {
            // Call chat service to save message
            const savedMessage = await this.chatService.sendMessage(
                ws.userId!,
                message.recipientIds,
                message.content
            );

            // Send confirmation to sender
            ws.send(JSON.stringify({
                type: "message_sent",
                data: savedMessage
            }));
            logger.info("Message sent successfully", {
                messageId: savedMessage.id,
                senderId: ws.userId
            });
            // NEW: Publish to Redis for broadcasting
            try {
                const redisMessage = JSON.stringify({
                    messageId: savedMessage.id,
                    conversationId: savedMessage.conversationId,
                    senderId: savedMessage.senderId,
                    content: savedMessage.content,
                    createdAt: savedMessage.createdAt
                });

                await redisPublisher.publish(
                    `chat:${savedMessage.conversationId}`,
                    redisMessage
                );

                logger.debug("Published to Redis", {
                    channel: `chat:${savedMessage.conversationId}`,
                    messageId: savedMessage.id
                });

            } catch (redisError: any) {
                // Don't fail message sending if Redis fails
                logger.error("Failed to publish to Redis", {
                    error: redisError.message,
                    messageId: savedMessage.id
                });
            }

            // Publish to Kafka for notifications (offline users)
            try {
                const { publishChatEvent } = await import("./kafka.util");

                await publishChatEvent({
                    eventType: "MessageSent",
                    messageId: savedMessage.id,
                    conversationId: savedMessage.conversationId,
                    senderId: savedMessage.senderId,
                    recipientIds: message.recipientIds,
                    content: savedMessage.content,
                    timestamp: savedMessage.createdAt
                });

            } catch (kafkaError: any) {
                // Don't fail if Kafka fails
                logger.error("Failed to publish to Kafka", {
                    error: kafkaError.message,
                    messageId: savedMessage.id
                });
            }



        } catch (error: any) {
            logger.error("Failed to send message", {
                error: error.message,
                userId: ws.userId
            });
            ws.send(JSON.stringify({
                type: "error",
                error: "Failed to send message"
            }));
        }
    }

    private async _handleTyping(
        ws: AuthenticatedWebSocket,
        message: any
    ): Promise<void> {
        // Broadcast typing indicator to conversation participants
        // For now, just log it
        logger.debug("User typing", {
            userId: ws.userId,
            conversationId: message.conversationId
        });

        // TODO: Broadcast via Redis in Part 3
    }

    private async _setupRedisSubscription(): Promise<void> {
        try {
            // Subscribe to all chat channels using pattern matching
            await redisSubscriber.pSubscribe('chat:*', async (message, channel) => {
                try {
                    const data = JSON.parse(message);
                    logger.debug("Received Redis message", { channel, data });

                    // Extract conversationId from channel name
                    // Channel format: "chat:conversationId"
                    const conversationId = channel.split(':')[1];

                    // Broadcast to all users in this conversation
                    await this._broadcastToConversation(conversationId, data);

                } catch (error: any) {
                    logger.error("Failed to process Redis message", {
                        error: error.message,
                        channel
                    });
                }
            });

            logger.info("Redis subscription established for chat:*");

        } catch (error: any) {
            logger.error("Failed to setup Redis subscription", {
                error: error.message
            });
            throw error;
        }
    }

    private async _broadcastToConversation(
        conversationId: string,
        messageData: any
    ): Promise<void> {
        try {
            // Get conversation to find participant IDs
            const conversation = await this.chatService.findConversation(conversationId);

            if (!conversation || !conversation.participants) {
                logger.warn("Conversation not found or no participants", {
                    conversationId
                });
                return;
            }

            // Extract participant user IDs
            const participantIds = conversation.participants.map(p => p.userId);

            // Broadcast to each participant's connections
            let sentCount = 0;
            for (const userId of participantIds) {
                const userConnections = this._connections.get(userId);

                if (userConnections && userConnections.size > 0) {
                    userConnections.forEach(ws => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: "new_message",
                                data: messageData
                            }));
                            sentCount++;
                        }
                    });
                }
            }

            if (sentCount > 0) {
                logger.info("Message broadcasted", {
                    conversationId,
                    participantCount: participantIds.length,
                    connectionsSent: sentCount
                });
            }

        } catch (error: any) {
            logger.error("Failed to broadcast to conversation", {
                error: error.message,
                conversationId
            });
        }
    }

    private _startHeartbeat(): void {
        const interval = setInterval(() => {
            this._wss.clients.forEach((ws: any) => {
                const authWs = ws as AuthenticatedWebSocket;

                // Skip unauthenticated connections
                if (!authWs.userId) {
                    return;
                }

                // If no pong received since last ping, terminate
                if (authWs.isAlive === false) {
                    logger.warn("Terminating dead connection", {
                        userId: authWs.userId
                    });
                    this._removeConnection(authWs.userId, authWs);
                    return authWs.terminate();
                }

                // Mark as waiting for pong
                authWs.isAlive = false;
                authWs.ping();
            });
        }, HEARTBEAT_INTERVAL);

        // Clear interval on server close
        this._wss.on("close", () => {
            clearInterval(interval);
        });

        logger.info("Heartbeat started", {
            interval: `${HEARTBEAT_INTERVAL}ms`
        });
    }

    private _addConnection(userId: string, ws: AuthenticatedWebSocket) {
        if (!this._connections.has(userId)) {
            this._connections.set(userId, new Set());
        }
        this._connections.get(userId)!.add(ws);
    }

    private _removeConnection(userId: string, ws: AuthenticatedWebSocket) {
        if (this._connections.has(userId)) {
            this._connections.get(userId)!.delete(ws);
            if (this._connections.get(userId)!.size === 0) {
                this._connections.delete(userId);
            }
        }
    }
}