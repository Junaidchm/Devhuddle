/**
 * WebSocket-related type definitions
 * @module types/websocket
 */

import { WebSocket } from "ws";

/**
 * Authentication message sent by client to authenticate WebSocket connection
 */
export interface AuthMessage {
    type: "auth";
    token: string;
}

/**
 * Message payload for sending a chat message
 */
export interface SendMessagePayload {
    type: "send_message";
    recipientIds: string[];
    content: string;
    // Media fields
    messageType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'STICKER';
    mediaUrl?: string;
    mediaId?: string;
    mediaMimeType?: string;
    mediaSize?: number;
    mediaName?: string;
    mediaDuration?: number;
}

/**
 * Typing indicator message
 */
export interface TypingMessage {
    type: "typing";
    conversationId: string;
}

/**
 * Union type of all possible WebSocket message types
 */
export type WebSocketMessage = AuthMessage | SendMessagePayload | TypingMessage;

/**
 * Extended WebSocket interface with authentication state
 */
export interface AuthenticatedWebSocket extends WebSocket {
    /** User ID after successful authentication */
    userId?: string;
    /** Connection health status for heartbeat mechanism */
    isAlive?: boolean;
}
