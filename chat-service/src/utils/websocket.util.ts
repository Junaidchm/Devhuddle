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
    CallMessage,
    CallStartPayload,
    CallJoinPayload,
    CallSignalPayload,
    CallLeavePayload,
    CallEndPayload,
    CallToggleMediaPayload,
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
            verifyClient: (info, cb) => {
                const req = info.req as any;
                const url = new URL(`http://localhost${req.url}`); // Dummy base for parsing
                const token = url.searchParams.get('token');
                
                logger.debug("[WebSocket] Verifying client connection", {
                    url: req.url,
                    headers: Object.keys(req.headers),
                    xUserId: req.headers['x-user-id'],
                    hasToken: !!token
                });

                // 1. GATEWAY MODE: Check for injected header
                const userIdFromHeader = req.headers['x-user-id'];
                
                if (userIdFromHeader) {
                    req.userId = userIdFromHeader;
                    logger.info(`[WebSocket] Authorized via Gateway Header: ${userIdFromHeader}`);
                    cb(true);
                    return;
                }

                // 2. DIRECT/LOCAL MODE: Verify JWT from query param
                if (token) {
                    try {
                        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
                        if (decoded && decoded.userId) {
                            req.userId = decoded.userId;
                            logger.info(`[WebSocket] Authorized via Token (Local Dev): ${decoded.userId}`);
                            cb(true);
                            return;
                        }
                    } catch (err) {
                        logger.error("[WebSocket] Token verification failed", { error: (err as Error).message });
                    }
                }

                logger.warn("[WebSocket] Connection rejected: No valid auth method found");
                cb(false, 401, 'Unauthorized');
            }
        });

        this._initializeWebSocket();
        this._setupRedisSubscription();
        this._startHeartbeat();
        this._setupGracefulShutdown();
    }

    private _initializeWebSocket() {

        this._wss.on("connection", (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
            // Get userId from request (attached in verifyClient)
            const userId = (req as any).userId;

            if (!userId) {
                logger.error("[WebSocket] Connection has no userId after verifyClient (Should not happen)");
                ws.close(4001, "Unauthorized");
                return;
            }

            logger.info(`[WebSocket] Connection established for user ${userId}`);

            // Initialize authenticated connection immediately
            ws.userId = userId;
            ws.isAlive = true;
            this._addConnection(userId, ws);

            // Send auth success immediately so client knows it's connected
            ws.send(JSON.stringify({ type: "auth_success" }));

            // Handle messages
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    logger.info("👉 [DEBUG] WebSocket Received Message", { 
                        type: message.type, 
                        userId: ws.userId,
                        payload: JSON.stringify(message) 
                    });

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

                        // ✅ FIX: Handle ping/pong to keep connection alive
                        case 'ping':
                            ws.isAlive = true;
                            ws.send(JSON.stringify({ type: 'pong' }));
                            break;
                        case 'pong':
                            ws.isAlive = true;
                            break;

                        // ✅ VIDEO CALL HANDLERS
                        case 'call:start':
                            await this._handleCallStart(ws, message as CallStartPayload);
                            break;

                        case 'call:join':
                            await this._handleCallJoin(ws, message as CallJoinPayload);
                            break;

                        case 'call:signal':
                            await this._handleCallSignal(ws, message as CallSignalPayload);
                            break;

                        case 'call:leave':
                            await this._handleCallLeave(ws, message as CallLeavePayload);
                            break;

                        case 'call:end':
                            await this._handleCallEnd(ws, message as CallEndPayload);
                            break;

                        case 'call:toggle_media':
                            await this._handleCallToggleMedia(ws, message as CallToggleMediaPayload);
                            break;

                        default:
                            logger.warn("Unknown message type", { type: message.type, userId: ws.userId });
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
        });

    }

    private async _handleSendMessage(
        ws: AuthenticatedWebSocket,
        message: SendMessagePayload
    ): Promise<void> {
        // Validate message structure
        // ✅ FIX: Allow missing recipientIds if conversationId is present
        if ((!message.recipientIds || !Array.isArray(message.recipientIds)) && !message.conversationId) {
            ws.send(JSON.stringify({
                type: "error",
                error: "Invalid recipientIds"
            }));
            return;
        }

        // ✅ FIX: Allow empty content if it's a media message
        const hasContent = message.content && typeof message.content === 'string' && message.content.trim().length > 0;
        const hasMedia = !!(message.mediaUrl || message.mediaId);

        if (!hasContent && !hasMedia) {
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
                message.content,
                message.messageType || 'TEXT',
                message.mediaUrl,
                message.mediaId,
                message.mediaMimeType,
                message.mediaSize,
                message.mediaName,
                message.mediaDuration,
                message.conversationId,
                message.dedupeId
            );

            // Send confirmation to sender
            ws.send(JSON.stringify({
                type: "message_sent",
                tempId: message.dedupeId,
                data: savedMessage
            }));
            logger.info("Message sent successfully", {
                messageId: savedMessage.id,
                senderId: ws.userId
            });
            // NEW: Publish to Redis for broadcasting
            try {
                // ✅ FIX: Wrap in standard event structure so _broadcastToConversation 
                // uses "new_message" as the event type, not the message content type (TEXT/IMAGE)
                const redisMessage = JSON.stringify({
                    type: "new_message",
                    data: {
                        id: savedMessage.id,
                        conversationId: savedMessage.conversationId,
                        senderId: savedMessage.senderId,
                        content: savedMessage.content,
                        createdAt: savedMessage.createdAt,
                        type: savedMessage.type,
                        mediaUrl: savedMessage.mediaUrl,
                        mediaId: savedMessage.mediaId,
                        mediaMimeType: savedMessage.mediaMimeType,
                        mediaSize: savedMessage.mediaSize,
                        mediaName: savedMessage.mediaName,
                        mediaDuration: savedMessage.mediaDuration,
                        dedupeId: message.dedupeId
                    }
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
                    timestamp: savedMessage.createdAt,
                    // ✅ FIX: Include dedupeId in Kafka event too
                    dedupeId: message.dedupeId
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

            // Update message status in database (returns updated message)
            const updatedMessage = await this.chatService.updateMessageStatus(
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
                        type: 'message_status_updated', // Add explicit type
                        conversationId: updatedMessage.conversationId, // Use from DB
                        messageId: message.messageId,
                        senderId: updatedMessage.senderId, // Help frontend optimize?
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
            // Subscribe to channel patterns
            // 1. Chat messages: chat:*
            // 2. Status updates: message:status
            await redisSubscriber.pSubscribe('chat:*', async (message, channel) => {
                await this._handleRedisMessage(channel, message);
            });
            
            await redisSubscriber.subscribe('message:status', async (message) => {
                await this._handleRedisMessage('message:status', message);
            });

            logger.info("Redis subscriptions established (chat:*, message:status)");

        } catch (error) {
            logger.error("Failed to setup Redis subscription", {
                error: error instanceof Error ? error.message : "Unknown error"
            });
            throw error;
        }
    }

    private async _handleRedisMessage(channel: string, message: string): Promise<void> {
        try {
            const data = JSON.parse(message);
            // logger.debug("Received Redis message", { channel, type: data.type });

            let conversationId: string | undefined;

            if (channel === 'message:status') {
                // Status update channel
                // Payload must contain conversationId
                conversationId = data.conversationId;
                
                // If the payload type is missing, ensure we set it for frontend
                if (!data.type) {
                    data.type = 'message_status_updated';
                }

            } else {
                // Chat message channel: chat:conversationId
                conversationId = channel.split(':')[1];
            }

            if (conversationId) {
                // ✅ FIX: Unwrap the 'data' from the Redis message, but preserve top-level type if present
                // The Redis message structure from ChatService is { type: ..., data: ... } or just raw data
                // We want to pass the whole object so _broadcastToConversation can decide
                const payload = data; 
                await this._broadcastToConversation(conversationId, payload);
            } else {
                logger.warn("Received Redis message without conversationId", { channel, data });
            }

        } catch (error) {
            logger.error("Failed to process Redis message", {
                error: error instanceof Error ? error.message : "Unknown error",
                channel
            });
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
                            // Send the payload as received from Redis, assuming it contains 'type' and 'data'
                            // OR construct it based on payload.type
                            
                            // If messageData has a type, use it. Otherwise default to new_message
                            const eventType = (messageData as any).type || "new_message";
                            const eventData = (messageData as any).data || messageData;

                            ws.send(JSON.stringify({
                                type: eventType,
                                data: eventData
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

    // ==================== VIDEO CALL HANDLERS ====================

    /**
     * Handle call:start - Initiator starts a call in a conversation
     */
    /**
     * Handle call:start - Initiator starts a call in a conversation
     */
    private async _handleCallStart(
        ws: AuthenticatedWebSocket,
        message: CallStartPayload
    ): Promise<void> {
        try {
            const { conversationId, isVideoCall } = message;
            const userId = ws.userId!;

            // ✅ FIX: Validate conversationId immediately
            if (!conversationId) {
                logger.error("[CALL-ERROR] Missing conversationId in call:start payload", { userId, payload: message });
                ws.send(JSON.stringify({
                    type: "error",
                    error: "Invalid request: conversationId is required"
                }));
                return;
            }

            logger.info("👉 [CALL-DEBUG] _handleCallStart triggered", { conversationId, initiator: userId, isVideoCall });

            // Add caller to Redis active call set
            await redisPublisher.sAdd(`active_call:${conversationId}`, userId);
            await redisPublisher.hSet(`call_media:${conversationId}:${userId}`, {
                isMuted: 'false',
                isVideoOff: 'false',
                isSharingScreen: 'false',
            });

            // Get conversation participants
            const conversation = await this.chatService.findConversationById(conversationId);
            
            logger.info("👉 [CALL-DEBUG] Conversation Lookup", { 
                conversationId, 
                found: !!conversation, 
                participantCount: conversation?.participants?.length
            });

            if (!conversation || !conversation.participants) {
                ws.send(JSON.stringify({
                    type: "error",
                    error: "Conversation not found"
                }));
                return;
            }

            // Get caller info from auth service (simplified - use userId for now)
            const callerName = userId; // TODO: Fetch from auth service if needed

            // Broadcast to all participants except caller
            const participantIds = conversation.participants
                .map((p: Participant) => p.userId)
                .filter(id => id !== userId);

            logger.info("👉 [CALL-DEBUG] Target Participants", { 
                targets: participantIds,
                totalConnectionsOnServer: this._connections.size
            });

            let sentCount = 0;
            for (const participantId of participantIds) {
                const userConnections = this._connections.get(participantId);
                const isOnline = userConnections && userConnections.size > 0;
                
                logger.info(`👉 [CALL-DEBUG] Validating target ${participantId}`, { isOnline, connectionCount: userConnections?.size || 0 });

                if (isOnline) {
                    userConnections!.forEach(userWs => {
                        if (userWs.readyState === WebSocket.OPEN) {
                            const payload = {
                                type: "call:incoming",
                                conversationId,
                                callerId: userId,
                                callerName,
                                isVideoCall,
                                participants: [userId]
                            };
                            userWs.send(JSON.stringify(payload));
                            sentCount++;
                            logger.info(`👉 [CALL-DEBUG] Sent call:incoming to ${participantId} (socket open)`);
                        } else {
                            logger.warn(`👉 [CALL-DEBUG] Socket for ${participantId} exists but not OPEN`);
                        }
                    });
                }
            }

            if (sentCount === 0) {
                logger.warn("👉 [CALL-DEBUG] ⚠️ No recipients received the call! Everyone else seems offline.");
            } else {
                logger.info(`👉 [CALL-DEBUG] Successfully sent invite to ${sentCount} connections.`);
            }

        } catch (error) {
            logger.error("Failed to handle call start", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId: ws.userId
            });
            ws.send(JSON.stringify({
                type: "error",
                error: "Failed to start call"
            }));
        }
    }

    /**
     * Handle call:join - User joins an existing call
     */
    private async _handleCallJoin(
        ws: AuthenticatedWebSocket,
        message: CallJoinPayload
    ): Promise<void> {
        try {
            const { conversationId } = message;
            const userId = ws.userId!;

            logger.info("User joining call", { conversationId, userId });

            // Add user to Redis active call set
            await redisPublisher.sAdd(`active_call:${conversationId}`, userId);
            await redisPublisher.hSet(`call_media:${conversationId}:${userId}`, {
                isMuted: 'false',
                isVideoOff: 'false',
                isSharingScreen: 'false',
            });

            // Get current participants
            const participants = await redisPublisher.sMembers(`active_call:${conversationId}`);

            // Notify all existing participants that new user joined
            for (const participantId of participants) {
                if (participantId === userId) continue; // Skip self

                const userConnections = this._connections.get(participantId);
                if (userConnections && userConnections.size > 0) {
                    userConnections.forEach(userWs => {
                        if (userWs.readyState === WebSocket.OPEN) {
                            userWs.send(JSON.stringify({
                                type: "call:participant_joined",
                                conversationId,
                                userId
                            }));
                        }
                    });
                }
            }

            // Send current participants list to the joining user
            ws.send(JSON.stringify({
                type: "call:participants",
                conversationId,
                participants: participants.filter(id => id !== userId)
            }));

        } catch (error) {
            logger.error("Failed to handle call join", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId: ws.userId
            });
            ws.send(JSON.stringify({
                type: "error",
                error: "Failed to join call"
            }));
        }
    }

    /**
     * Handle call:signal - Route WebRTC signals between peers
     */
    private async _handleCallSignal(
        ws: AuthenticatedWebSocket,
        message: CallSignalPayload
    ): Promise<void> {
        try {
            const { conversationId, targetUserId, signalType, signalData } = message;
            const senderId = ws.userId!;

            logger.debug("Routing call signal", {
                conversationId,
                from: senderId,
                to: targetUserId,
                signalType
            });

            // Verify both users are in the call
            const participants = await redisPublisher.sMembers(`active_call:${conversationId}`);
            if (!participants.includes(senderId) || !participants.includes(targetUserId)) {
                ws.send(JSON.stringify({
                    type: "error",
                    error: "User not in call"
                }));
                return;
            }

            // Route signal to target user
            const targetConnections = this._connections.get(targetUserId);
            if (targetConnections && targetConnections.size > 0) {
                targetConnections.forEach(targetWs => {
                    if (targetWs.readyState === WebSocket.OPEN) {
                        targetWs.send(JSON.stringify({
                            type: "call:signal",
                            conversationId,
                            fromUserId: senderId,
                            signalType,
                            signalData
                        }));
                    }
                });
            } else {
                logger.warn("Target user not connected", { targetUserId });
            }

        } catch (error) {
            logger.error("Failed to handle call signal", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId: ws.userId
            });
        }
    }

    /**
     * Handle call:leave - User leaves the call
     */
    private async _handleCallLeave(
        ws: AuthenticatedWebSocket,
        message: CallLeavePayload
    ): Promise<void> {
        try {
            const { conversationId } = message;
            const userId = ws.userId!;

            logger.info("User leaving call", { conversationId, userId });

            // Remove from Redis
            await redisPublisher.sRem(`active_call:${conversationId}`, userId);
            await redisPublisher.del(`call_media:${conversationId}:${userId}`);

            // Get remaining participants
            const remainingParticipants = await redisPublisher.sMembers(`active_call:${conversationId}`);

            // Notify remaining participants
            for (const participantId of remainingParticipants) {
                const userConnections = this._connections.get(participantId);
                if (userConnections && userConnections.size > 0) {
                    userConnections.forEach(userWs => {
                        if (userWs.readyState === WebSocket.OPEN) {
                            userWs.send(JSON.stringify({
                                type: "call:participant_left",
                                conversationId,
                                userId
                            }));
                        }
                    });
                }
            }

            // If no one left, clean up the call
            if (remainingParticipants.length === 0) {
                await redisPublisher.del(`active_call:${conversationId}`);
                logger.info("Call ended - no participants remaining", { conversationId });
            }

        } catch (error) {
            logger.error("Failed to handle call leave", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId: ws.userId
            });
        }
    }

    /**
     * Handle call:end - End call for all participants
     */
    private async _handleCallEnd(
        ws: AuthenticatedWebSocket,
        message: CallEndPayload
    ): Promise<void> {
        try {
            const { conversationId, reason } = message;
            const userId = ws.userId!;

            logger.info("Ending call", { conversationId, userId, reason });

            // Get all participants before cleanup
            const participants = await redisPublisher.sMembers(`active_call:${conversationId}`);

            // Clean up Redis
            await redisPublisher.del(`active_call:${conversationId}`);
            for (const participantId of participants) {
                await redisPublisher.del(`call_media:${conversationId}:${participantId}`);
            }

            // Notify all participants
            for (const participantId of participants) {
                const userConnections = this._connections.get(participantId);
                if (userConnections && userConnections.size > 0) {
                    userConnections.forEach(userWs => {
                        if (userWs.readyState === WebSocket.OPEN) {
                            userWs.send(JSON.stringify({
                                type: "call:ended",
                                conversationId,
                                reason: reason || "Call ended"
                            }));
                        }
                    });
                }
            }

        } catch (error) {
            logger.error("Failed to handle call end", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId: ws.userId
            });
        }
    }

    /**
     * Handle call:toggle_media - Broadcast media state changes
     */
    private async _handleCallToggleMedia(
        ws: AuthenticatedWebSocket,
        message: CallToggleMediaPayload
    ): Promise<void> {
        try {
            const { conversationId, mediaType, isEnabled } = message;
            const userId = ws.userId!;

            logger.debug("Media toggled", { conversationId, userId, mediaType, isEnabled });

            // Update Redis state
            const fieldMap: Record<string, string> = {
                'audio': 'isMuted',
                'video': 'isVideoOff',
                'screen': 'isSharingScreen'
            };
            const field = fieldMap[mediaType];
            if (field) {
                // Note: For audio/video, isEnabled=true means NOT muted/off
                // For screen, isEnabled=true means IS sharing
                const value = mediaType === 'screen' ? isEnabled.toString() : (!isEnabled).toString();
                await redisPublisher.hSet(`call_media:${conversationId}:${userId}`, field, value);
            }

            // Broadcast to all participants in call
            const participants = await redisPublisher.sMembers(`active_call:${conversationId}`);
            for (const participantId of participants) {
                if (participantId === userId) continue; // Skip self

                const userConnections = this._connections.get(participantId);
                if (userConnections && userConnections.size > 0) {
                    userConnections.forEach(userWs => {
                        if (userWs.readyState === WebSocket.OPEN) {
                            userWs.send(JSON.stringify({
                                type: "call:media_toggled",
                                conversationId,
                                userId,
                                mediaType,
                                isEnabled
                            }));
                        }
                    });
                }
            }

        } catch (error) {
            logger.error("Failed to handle media toggle", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId: ws.userId
            });
        }
    }
}