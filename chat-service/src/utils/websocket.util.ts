import { Server, WebSocket } from "ws";
import { Server as HttpServer } from "http";
import { IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import logger from "./logger.util";
import { ChatService } from "../services/impliments/chat.service";
import { redisPublisher, redisSubscriber } from "../config/redis.config";
import { Participant } from "@prisma/client";
import {
    AuthenticatedWebSocket,
    SendMessagePayload,
    TypingMessage,
    JWTPayload,
} from "../types";

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
            verifyClient: () => {
                //  No token check here - we'll authenticate after connection
                return true;
            }
        });

        this._initializeWebSocket();
        this._setupRedisSubscription();
        this._startHeartbeat();
        this._setupGracefulShutdown();
    }

    private _initializeWebSocket() {

        this._wss.on("connection", (ws: AuthenticatedWebSocket, _req: IncomingMessage) => {
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
                        ) as JWTPayload;

                        if (!decoded || !decoded.id) {
                            throw new Error("Invalid token");
                        }

                        userId = decoded.id;
                    } catch (error) {
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

                                case 'message_delivered':
                                    await this._handleMessageDelivered(ws, message);
                                    break;

                                case 'message_read':
                                    await this._handleMessageRead(ws, message);
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
                        } catch (error) {
                            logger.error("Message handling error", {
                                error: error instanceof Error ? error.message : "Unknown error",
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

                } catch (error) {
                    logger.error("Auth error", { error: error instanceof Error ? error.message : "Unknown error" });
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
        message: SendMessagePayload
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

            } catch (redisError) {
                // Don't fail message sending if Redis fails
                logger.error("Failed to publish to Redis", {
                    error: redisError instanceof Error ? redisError.message : "Unknown error",
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

            } catch (kafkaError) {
                // Don't fail if Kafka fails
                logger.error("Failed to publish to Kafka", {
                    error: kafkaError instanceof Error ? kafkaError.message : "Unknown error",
                    messageId: savedMessage.id
                });
            }



        } catch (error) {
            logger.error("Failed to send message", {
                error: error instanceof Error ? error.message : "Unknown error",
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
        message: TypingMessage
    ): Promise<void> {
        // Broadcast typing indicator to conversation participants
        // For now, just log it
        logger.debug("User typing", {
            userId: ws.userId,
            conversationId: message.conversationId
        });
    }

    /**
     * Handle delivery acknowledgment from client
     * Updates message status to DELIVERED and broadcasts to sender
     */
    private async _handleMessageDelivered(
        ws: AuthenticatedWebSocket,
        message: { messageId: string }
    ): Promise<void> {
        try {
            if (!message.messageId) {
                ws.send(JSON.stringify({
                    type: "error",
                    error: "messageId is required"
                }));
                return;
            }

            // Update message status in database
            await this.chatService.updateMessageStatus(
                message.messageId,
                'DELIVERED'
            );

            logger.info('Message marked as delivered', { 
                messageId: message.messageId,
                userId: ws.userId 
            });

            // Broadcast status update via Redis so sender gets notified
            try {
                await redisPublisher.publish(
                    `message:status`,
                    JSON.stringify({
                        messageId: message.messageId,
                        status: 'DELIVERED',
                        deliveredAt: new Date().toISOString(),
                    })
                );
            } catch (redisError) {
                logger.error("Failed to publish status update to Redis", {
                    error: redisError instanceof Error ? redisError.message : "Unknown error"
                });
            }
        } catch (error) {
            logger.error("Failed to update message delivery status", {
                error: error instanceof Error ? error.message : "Unknown error",
                messageId: message.messageId
            });
        }
    }

    /**
     * Handle read acknowledgment from client
     * Marks all messages up to lastReadMessageId as READ
     */
    private async _handleMessageRead(
        ws: AuthenticatedWebSocket,
        message: { conversationId: string; lastReadMessageId: string }
    ): Promise<void> {
        try {
            if (!message.conversationId || !message.lastReadMessageId) {
                ws.send(JSON.stringify({
                    type: "error",
                    error: "conversationId and lastReadMessageId are required"
                }));
                return;
            }

            // Mark messages as read in database
            await this.chatService.markMessagesAsRead(
                message.conversationId,
                ws.userId!,
                message.lastReadMessageId
            );

            logger.info('Messages marked as read', {
                conversationId: message.conversationId,
                lastReadMessageId: message.lastReadMessageId,
                userId: ws.userId
            });

            // Broadcast read receipt via Redis
            try {
                await redisPublisher.publish(
                    `message:status`,
                    JSON.stringify({
                        conversationId: message.conversationId,
                        lastReadMessageId: message.lastReadMessageId,
                        status: 'READ',
                        readBy: ws.userId,
                        readAt: new Date().toISOString(),
                    })
                );
            } catch (redisError) {
                logger.error("Failed to publish read receipt to Redis", {
                    error: redisError instanceof Error ? redisError.message : "Unknown error"
                });
            }
        } catch (error) {
            logger.error("Failed to mark messages as read", {
                error: error instanceof Error ? error.message : "Unknown error",
                conversationId: message.conversationId
            });
        }
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

                } catch (error) {
                    logger.error("Failed to process Redis message", {
                        error: error instanceof Error ? error.message : "Unknown error",
                        channel
                    });
                }
            });

            logger.info("Redis subscription established for chat:*");

        } catch (error) {
            logger.error("Failed to setup Redis subscription", {
                error: error instanceof Error ? error.message : "Unknown error"
            });
            throw error;
        }
    }

    private async _broadcastToConversation(
        conversationId: string,
        messageData: Record<string, unknown>
    ): Promise<void> {
        try {
            // Get conversation to find participant IDs
            const conversation = await this.chatService.findConversationById(conversationId);

            if (!conversation || !conversation.participants) {
                logger.warn("Conversation not found or no participants", {
                    conversationId
                });
                return;
            }

            // Extract participant user IDs
            const participantIds = conversation.participants.map((p: Participant) => p.userId);

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

        } catch (error) {
            logger.error("Failed to broadcast to conversation", {
                error: error instanceof Error ? error.message : "Unknown error",
                conversationId
            });
        }
    }

    private _startHeartbeat(): void {
        const interval = setInterval(() => {
            this._wss.clients.forEach((ws: WebSocket) => {
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

    private _setupGracefulShutdown(): void {
        const shutdown = () => {
            logger.info("Shutting down WebSocket server gracefully");

            // Close all client connections
            this._wss.clients.forEach((ws: WebSocket) => {
                const authWs = ws as AuthenticatedWebSocket;

                // Send shutdown message
                if (authWs.readyState === WebSocket.OPEN) {
                    authWs.send(JSON.stringify({
                        type: "server_shutdown",
                        message: "Server is shutting down"
                    }));
                }

                authWs.close(1001, "Server shutting down");
            });

            // Close WebSocket server
            this._wss.close(() => {
                logger.info("WebSocket server closed");
                process.exit(0);
            });

            // Force exit after 5 seconds
            setTimeout(() => {
                logger.warn("Forcing exit after timeout");
                process.exit(1);
            }, 5000);
        };

        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);

        logger.info("Graceful shutdown handlers registered");
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