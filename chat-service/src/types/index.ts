/**
 * Central export file for all type definitions
 * @module types
 */

// WebSocket types
export type {
    AuthMessage,
    SendMessagePayload,
    TypingMessage,
    WebSocketMessage,
    AuthenticatedWebSocket,
} from "./websocket.types";

// Authentication types
export type { JWTPayload, IAuthenticatedRequest } from "./auth.types";

// Call types
export * from "./call.types";
