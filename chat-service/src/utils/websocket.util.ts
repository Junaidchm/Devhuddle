import { Server, WebSocket } from "ws";
import { Server as HttpServer } from "http";
import { IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import logger from "./logger.util";
import { ChatService } from "../services/impliments/chat.service";
import { redisPublisher, redisSubscriber } from "../config/redis.config";
import { Participant } from "@prisma/client";
import { authServiceClient } from "../clients/auth-service.client";
import { AppError } from "../utils/AppError";
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
import { MessageMapper } from "../mappers/chat.mapper";
import { ICallRepository } from "../repositories/interfaces/ICallRepository";

// Configuration constants
const MAX_CONNECTIONS_PER_USER = 5;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const WEBSOCKET_PATH = '/api/v1/chat';
const AUTH_TIMEOUT = 5000; // 5 seconds


export class WebSocketService {
    private static _instance: WebSocketService | null = null;
    private _wss: Server;
    private _connections: Map<string, Set<AuthenticatedWebSocket>> = new Map();
    private _rooms: Map<string, Set<AuthenticatedWebSocket>> = new Map();
    private _pendingConnections: Map<AuthenticatedWebSocket, NodeJS.Timeout> = new Map();

    constructor(
        _server: HttpServer, 
        private chatService: ChatService,
        private callRepository: ICallRepository
    ) {
        WebSocketService._instance = this;
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

    public static getInstance(): WebSocketService {
        if (!WebSocketService._instance) {
            throw new Error("WebSocketService not initialized");
        }
        return WebSocketService._instance;
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
                this._removeConnection(ws.userId!, ws).catch(err => {
                    logger.error("Error in _removeConnection", { error: err.message, userId: ws.userId });
                });
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
                message.dedupeId,
                message.replyToId
            );

            // Use Mapper to ensure consistent response format
            const messageDto = MessageMapper.toResponseDto(savedMessage);

            // Ensure sender has locally joined this conversation's room
            // This is critical for newly created conversations so we receive our own Redis broadcasts
            this._joinRoom(savedMessage.conversationId, ws);

            ws.send(JSON.stringify({
                type: "message_sent",
                tempId: message.dedupeId,
                data: messageDto,
                dedupeId: message.dedupeId // Top level dedupeId for easier access
            }));
            
            logger.info("Message sent successfully", {
                messageId: savedMessage.id,
                senderId: ws.userId
            });

            // NOTE: Redis broadcasting and Kafka events are handled by MessageSagaService
            // We do NOT need to duplicate them here to avoid race conditions and double-sends.



        } catch (error) {
            logger.error("Failed to send message", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId: ws.userId
            });
            ws.send(JSON.stringify({
                type: "error",
                error: error instanceof AppError ? error.message : "Failed to send message",
                dedupeId: message.dedupeId,
                conversationId: message.conversationId
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
                ws.userId!,
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

            await redisSubscriber.subscribe('presence:change', async (message) => {
                await this._handleRedisMessage('presence:change', message);
            });

            // 4. Conversation events: conversation_event
            await redisSubscriber.subscribe('conversation_event', async (message) => {
                await this._handleRedisMessage('conversation_event', message);
            });

            logger.info("Redis subscriptions established (chat:*, message:status, conversation_event)");

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

            } else if (channel === 'presence:change') {
                // Broadcast presence change to all users who might care
                // In a real app, we'd only send to contacts/active chat participants
                // For simplicity here, we broadcast to all connections
                this._broadcastPresenceUpdate(data);
                return;
            } else if (channel === 'conversation_event') {
                // Global conversation events (calls, membership updates, etc)
                conversationId = data.conversationId;
                // If it's a call event and we have specific room logic, we can apply it here
                // For now, generic broadcastToConversation will handle it as long as type/data are present
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
            // Extract event details
            const eventType = (messageData as any).type || "new_message";
            const eventData = (messageData as any).data || messageData;
            const targetUserId = (messageData as any).targetUserId;
            const targetUserIds: string[] | undefined = (messageData as any).targetUserIds; // Array support for selective broadcast
            
            const payload = JSON.stringify({
                type: eventType,
                conversationId,
                data: eventData
            });

            let sentCount = 0;

            // ✅ CRITICAL FIX: Direct specific targeting instead of relying on room membership.
            // If explicit targets are provided, deliver to their active connections bypassing `_rooms` to ensure users 
            // who haven't locally joined the room yet (e.g., dynamically added to group) still receive the message.
            if (targetUserId) {
                const userConns = this._connections.get(targetUserId);
                if (userConns) {
                    userConns.forEach(ws => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(payload);
                            sentCount++;
                        }
                    });
                }
            } else if (targetUserIds && targetUserIds.length > 0) {
                targetUserIds.forEach(userId => {
                    const userConns = this._connections.get(userId);
                    if (userConns) {
                        userConns.forEach(ws => {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(payload);
                                sentCount++;
                            }
                        });
                    }
                });
            } else {
                // Fallback to real room broadcast
                const roomClients = this._rooms.get(conversationId);
                
                if (!roomClients || roomClients.size === 0) {
                    logger.debug("[WebSocket] No local clients in room for broadcast", { conversationId });
                    return;
                }

                roomClients.forEach(ws => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(payload);
                        sentCount++;
                    }
                });
            }

            if (sentCount > 0) {
                logger.info("[WebSocket] Target/Room broadcast success", {
                    conversationId,
                    clientsReached: sentCount,
                    targeted: !!(targetUserId || (targetUserIds && targetUserIds.length > 0))
                });
            }
        } catch (error) {
            logger.error("[WebSocket] Error in _broadcastToConversation", { 
                conversationId, 
                error: (error as Error).message 
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
                    this._removeConnection(authWs.userId, authWs).catch(err => {
                        logger.error("Error in _removeConnection (Heartbeat)", { error: err.message, userId: authWs.userId });
                    });
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

    private _broadcastPresenceUpdate(data: { userId: string, isOnline: boolean, lastSeen?: string }) {
        this.broadcastToAll('presence_change', data);
    }

    /**
     * Broadcast an event to ALL connected users
     */
    public broadcastToAll(event: string, data: any): void {
        try {
            const payload = JSON.stringify({
                type: event,
                data
            });

            this._wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(payload);
                }
            });

            logger.info(`[WebSocket] Event ${event} broadcasted to all active connections`);
        } catch (error: any) {
            logger.error(`[WebSocket] Error broadcasting ${event} to all`, {
                error: error.message,
            });
        }
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

    private async _addConnection(userId: string, ws: AuthenticatedWebSocket) {
        // Ensure the set exists
        if (!this._connections.has(userId)) {
            this._connections.set(userId, new Set());
        }
        
        const userConnections = this._connections.get(userId)!;
        
        // Enforce max connections
        if (userConnections.size >= MAX_CONNECTIONS_PER_USER) {
            const oldestWs = userConnections.values().next().value;
            if (oldestWs) {
                oldestWs.close(1001, "Simultaneous connection limit exceeded");
                this._removeConnection(userId, oldestWs);
            }
        }
        
        // If this is the first connection, mark as online in Redis and broadcast
        if (userConnections.size === 0) {
            try {
                await redisPublisher.set(`user:${userId}:online`, 'true');
                await redisPublisher.publish('presence:change', JSON.stringify({ userId, isOnline: true }));
                logger.info(`[WebSocket] User ${userId} marked as ONLINE`);
            } catch (err) {
                logger.error("Failed to set online status in Redis", { userId, error: (err as Error).message });
            }
        }

        userConnections.add(ws);
        logger.info(`[WebSocket] Registry updated for user ${userId}. Connections: ${userConnections.size}`);

        // ✅ Join rooms for all user conversations
        try {
            const conversations = await this.chatService.getUserConversations(userId);
            for (const conv of conversations) {
                this._joinRoom(conv.id, ws);
            }
            logger.debug(`[WebSocket] User ${userId} joined ${conversations.length} rooms`);
        } catch (error) {
            logger.error(`[WebSocket] Error joining rooms for user ${userId}`, { error });
        }
    }

    private async _removeConnection(userId: string, ws: AuthenticatedWebSocket) {
        // Remove from user connections
        const userConnections = this._connections.get(userId);
        if (userConnections) {
            userConnections.delete(ws);
            if (userConnections.size === 0) {
                this._connections.delete(userId);
                // Last connection closed, mark offline in Redis
                try {
                    const lastSeen = new Date().toISOString();
                    await redisPublisher.set(`user:${userId}:online`, 'false');
                    await redisPublisher.set(`user:${userId}:lastSeen`, lastSeen);
                    await redisPublisher.publish('presence:change', JSON.stringify({ userId, isOnline: false, lastSeen }));
                } catch (err) {
                    logger.error("Failed to set offline status in Redis", { userId, error: (err as Error).message });
                }
            }
        }

        // Remove from all rooms
        this._rooms.forEach((clients, roomId) => {
            if (clients.has(ws)) {
                clients.delete(ws);
                if (clients.size === 0) {
                    this._rooms.delete(roomId);
                }
            }
        });

        logger.info(`[WebSocket] Connection removed for user ${userId}`);
    }

    private _joinRoom(roomId: string, ws: AuthenticatedWebSocket) {
        if (!this._rooms.has(roomId)) {
            this._rooms.set(roomId, new Set());
        }
        this._rooms.get(roomId)!.add(ws);
    }

    private _leaveRoom(roomId: string, ws: AuthenticatedWebSocket) {
        const room = this._rooms.get(roomId);
        if (room) {
            room.delete(ws);
            if (room.size === 0) {
                this._rooms.delete(roomId);
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
            const { conversationId, isVideoCall, targetUserIds } = message;
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

            logger.info("👉 [CALL-DEBUG] _handleCallStart triggered", { conversationId, initiator: userId, isVideoCall, targetUserIds });

            // Get conversation participants first
            const conversation = await this.chatService.findConversationById(conversationId);
            
            if (!conversation || !conversation.participants) {
                ws.send(JSON.stringify({
                    type: "error",
                    error: "Conversation not found"
                }));
                return;
            }

            // Determine participants to ring
            let finalTargetUserIds = targetUserIds || [];
            if (finalTargetUserIds.length === 0) {
                // Fallback to all other participants if no specific targets provided (e.g. 1-to-1)
                finalTargetUserIds = conversation.participants
                    .filter(p => p.userId !== userId && !p.deletedAt)
                    .map(p => p.userId);
            }

            // Create persistent Call entity in database
            const call = await this.callRepository.createCall(
                conversationId,
                userId,
                conversation.type === 'DIRECT' ? 'DIRECT' : 'GROUP',
                isVideoCall ? 'VIDEO' : 'AUDIO',
                finalTargetUserIds
            );

            // Add caller to Redis active call set
            await redisPublisher.sAdd(`active_call:${conversationId}`, userId);
            await redisPublisher.hSet(`call_media:${conversationId}:${userId}`, {
                isMuted: 'false',
                isVideoOff: 'false',
                isSharingScreen: 'false',
                callId: call.id, // Track DB call ID in redis for quick access
            });

            // ✅ BROADCAST TO ROOM (Via Redis for multi-pod consistency)
            // Get caller info from auth service for the notification
            let callerName = userId;
            let callerProfileImage: string | undefined;
            try {
                const profilesMap = await authServiceClient.getUserProfiles([userId]);
                const profile = profilesMap.get(userId);
                if (profile) {
                    callerName = profile.name || profile.username || userId;
                    callerProfileImage = profile.profilePhoto;
                }
            } catch (err) {
                logger.warn("[CALL-DEBUG] Failed to fetch caller profile from auth-service", { userId, error: (err as Error).message });
            }

            // Publish to Redis so all pods emit to ALL SELECTED participants (plus caller themselves if needed for sync, though 1-1 caller skips it frontend)
            // Using targetUserIds to ensure selective ringing in group calls
            const targetIdsWithCaller = [...finalTargetUserIds, userId];

            await redisPublisher.publish('conversation_event', JSON.stringify({
                conversationId,
                type: 'call:incoming',
                targetUserIds: targetIdsWithCaller, // ONLY emit to selected members + caller
                data: {
                    conversationId,
                    callId: call.id,
                    callerId: userId,
                    callerName,
                    callerProfileImage,
                    isVideoCall,
                    participants: [userId],
                    callScope: conversation.type === 'DIRECT' ? 'ONE_TO_ONE' : 'GROUP',
                    groupName: conversation.name,
                    groupAvatar: conversation.icon
                }
            }));

            logger.info("👉 [CALL-DEBUG] Call initialized and broadcasted via Redis", { conversationId, sender: userId });
        } catch (error) {
            logger.error("[CALL-ERROR] Error starting call", { error: (error as Error).message });
            ws.send(JSON.stringify({
                type: "error",
                message: "Failed to start call"
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
            const { conversationId, callId } = message;
            const userId = ws.userId!;

            logger.info("User joining call", { conversationId, userId, callId });

            // Persist join status in DB if this is a tracked call
            if (callId) {
                try {
                     await this.callRepository.updateParticipantStatus(callId, userId, 'JOINED');
                } catch(e) {
                     logger.warn("Could not update participant status in DB (might be older untracked call)", { callId });
                }
            }

            // Add user to Redis active call set
            await redisPublisher.sAdd(`active_call:${conversationId}`, userId);
            await redisPublisher.hSet(`call_media:${conversationId}:${userId}`, {
                isMuted: 'false',
                isVideoOff: 'false',
                isSharingScreen: 'false',
                callId: callId || '', // Cache callId in redis for subsequent operations lacking it
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

            // ✅ BROADCAST TO ROOM (Via Redis) - Targeted for multi-pod reliability
            await redisPublisher.publish('conversation_event', JSON.stringify({
                conversationId,
                type: 'call:participant_joined',
                targetUserIds: participants, // Ensure all participants on all pods get this
                data: {
                    conversationId,
                    userId
                }
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

            // ✅ BROADCAST SIGAL (Via Redis for multi-pod consistency)
            await redisPublisher.publish('conversation_event', JSON.stringify({
                conversationId,
                type: 'call:signal',
                targetUserId, // Targeting specific user
                data: {
                    conversationId,
                    fromUserId: senderId,
                    signalType,
                    signalData
                }
            }));

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
            const { conversationId, callId } = message;
            const userId = ws.userId!;

            logger.info("User leaving call", { conversationId, userId, callId });

            // Try to resolve callId from redis if not provided in payload
            let activeCallId = callId;
            if (!activeCallId) {
                const mediaMeta = await redisPublisher.hGetAll(`call_media:${conversationId}:${userId}`);
                activeCallId = mediaMeta?.callId;
            }

            if (activeCallId) {
                try {
                    await this.callRepository.updateParticipantStatus(activeCallId, userId, 'LEFT');
                } catch(e) {
                     logger.warn("Could not set participant to LEFT in DB", { activeCallId });
                }
            }

            // Remove from Redis
            await redisPublisher.sRem(`active_call:${conversationId}`, userId);
            await redisPublisher.del(`call_media:${conversationId}:${userId}`);

            // Get remaining participants
            const remainingParticipants = await redisPublisher.sMembers(`active_call:${conversationId}`);

            // ✅ BROADCAST TO ROOM (Via Redis)
            await redisPublisher.publish('conversation_event', JSON.stringify({
                conversationId,
                type: 'call:participant_left',
                data: {
                    conversationId,
                    userId
                }
            }));

            // ✅ FIX: In 1-to-1 calls (DIRECT), if one person leaves, the call should end for everyone
            const conversation = await this.chatService.findConversationById(conversationId);
            if (conversation?.type === 'DIRECT' && remainingParticipants.length > 0) {
                logger.info("Auto-ending 1-to-1 call because a participant left", { conversationId });
                
                await redisPublisher.publish('conversation_event', JSON.stringify({
                    conversationId,
                    type: 'call:ended',
                    data: {
                        conversationId,
                        reason: "Participant left"
                    }
                }));

                // Cleanup Redis for the whole call set since it's practically over
                await redisPublisher.del(`active_call:${conversationId}`);
            }

            // If no one left, clean up the call
            if (remainingParticipants.length === 0) {
                await redisPublisher.del(`active_call:${conversationId}`);
                logger.info("Call ended - no participants remaining", { conversationId });

                // Notify ALL conversation participants to clear ringing state
                await redisPublisher.publish('conversation_event', JSON.stringify({
                    conversationId,
                    type: 'call:ended',
                    data: {
                        conversationId,
                        reason: "Call cancelled or ended"
                    }
                }));
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
            const { conversationId, callId, reason } = message;
            const userId = ws.userId!;

            logger.info("Handling call end", { conversationId, userId, reason, callId });

            // Get all participants before cleanup
            const participants = await redisPublisher.sMembers(`active_call:${conversationId}`);

            // Try to resolve callId from redis if not provided from the frontend
            let activeCallId = callId;
            if (!activeCallId) {
                const mediaMeta = await redisPublisher.hGetAll(`call_media:${conversationId}:${userId}`);
                activeCallId = mediaMeta?.callId;
            }

            if (activeCallId) {
                try {
                     await this.callRepository.endCall(activeCallId);
                } catch(e) {
                     logger.warn("Could not end call in DB", { activeCallId });
                }
            }

            // Clean up Redis
            await redisPublisher.del(`active_call:${conversationId}`);
            for (const participantId of participants) {
                await redisPublisher.del(`call_media:${conversationId}:${participantId}`);
            }

            // ✅ BROADCAST TO ROOM (Via Redis)
            await redisPublisher.publish('conversation_event', JSON.stringify({
                conversationId,
                type: 'call:ended',
                data: {
                    conversationId,
                    reason: reason || "Call ended"
                }
            }));

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

            // ✅ BROADCAST TO ROOM (Via Redis)
            await redisPublisher.publish('conversation_event', JSON.stringify({
                conversationId,
                type: 'call:media_toggled',
                data: {
                    conversationId,
                    userId,
                    mediaType,
                    isEnabled
                }
            }));

        } catch (error) {
            logger.error("Failed to handle media toggle", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId: ws.userId
            });
        }
    }
}