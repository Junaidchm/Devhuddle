import { Server, WebSocket } from "ws";
import { Server as HttpServer } from "http";
import logger from "./logger.util"; 
import redisClient from "../config/redis.config";
import jwt from "jsonwebtoken";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

// Configuration constants
const MAX_CONNECTIONS_PER_USER = 5;
const HEARTBEAT_INTERVAL = 30000;
const WEBSOCKET_PATH = '/api/v1/notifications';
const AUTH_TIMEOUT = 5000; // 5 seconds

export class WebSocketService {
  private wss: Server;
  private connections: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private pendingConnections: Map<AuthenticatedWebSocket, NodeJS.Timeout> = new Map(); 

    constructor(server: HttpServer) {
    this.wss = new Server({
      server,
      path: WEBSOCKET_PATH,
      verifyClient: (info, cb) => {
        // TRUST THE GATEWAY
        const req = info.req as any;
        const userId = req.headers['x-user-id'];

        if (!userId) {
          logger.warn("[WebSocket] Connection rejected: Missing x-user-id header");
          cb(false, 401, 'Unauthorized');
          return;
        }

        req.userId = userId;
        cb(true);
      }
    });

    this.setupWebSocket();
    this.startHeartbeat();
    this.setupGracefulShutdown();
  }


  private setupWebSocket(): void {
    this.wss.on("connection", async (ws: AuthenticatedWebSocket, req: any) => {
      // Get userId from request (verified by Gateway)
      const userId = req.userId;

      if (!userId) {
        logger.error("[WebSocket] Connection has no userId after verifyClient");
        ws.close(4001, "Unauthorized");
        return;
      }

      logger.info(`[WebSocket] Connection established for user ${userId}`);

      // Initialize authenticated connection immediately
      ws.userId = userId;
      ws.isAlive = true;

      // Add to connections map
      if (!this.connections.has(userId)) {
        this.connections.set(userId, new Set());
      }
      this.connections.get(userId)!.add(ws);

      // Send auth success immediately
      ws.send(JSON.stringify({
        type: "auth_success"
      }));

      // Send initial unread count
      try {
        const cacheKey = `notifications:unread:${userId}`;
        const unreadCount = await redisClient.get(cacheKey);
        const count = parseInt(unreadCount || "0", 10);

        logger.info(`Sending initial unread count to user ${userId}`, { unreadCount: count });

        ws.send(
          JSON.stringify({
            type: "unread_count",
            data: { unreadCount: count },
          })
        );
      } catch (error: any) {
        logger.error(`Failed to send initial unread count to user ${userId}`, {
          error: error.message
        });
      }

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          logger.debug(`Received message from user ${userId}`, { message });
        } catch (error: any) {
          logger.warn(`Failed to parse message from user ${userId}`, {
            error: error.message
          });
        }
      });

      // Handle ping/pong for keep-alive
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("close", () => {
        // Clear auth timeout if still pending
        const authTimeout = this.pendingConnections.get(ws);
        if (authTimeout) {
          clearTimeout(authTimeout);
          this.pendingConnections.delete(ws);
        }

        if (ws.userId && this.connections.has(ws.userId)) {
          const userConnections = this.connections.get(ws.userId);
          if (userConnections) {
            userConnections.delete(ws);
            if (userConnections.size === 0) {
              this.connections.delete(ws.userId);
            }
          }
        }
        
        logger.info(`WebSocket disconnected`, {
          userId: ws.userId || "unauthenticated",
          remainingConnections: this.connections.size,
          userConnections: ws.userId ? this.connections.get(ws.userId)?.size || 0 : 0
        });
      });

      ws.on("error", (error) => {
        logger.error(`WebSocket error`, {
          error: error.message,
          userId: ws.userId || "unauthenticated",
          stack: error.stack
        });
      });
    });
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          ws.terminate();
          return;
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds

    this.wss.on("close", () => {
      clearInterval(interval);
    });
  }
  
  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = () => {
      logger.info("Shutting down WebSocket server gracefully");
      
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        ws.close(1001, "Server shutting down");
      });

      this.wss.close(() => {
        logger.info("WebSocket server closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }


  /**
   * Convert BigInt values to strings for JSON serialization
   */
  private serializeBigInt(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === "bigint") {
      return obj.toString();
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.serializeBigInt(item));
    }

    if (typeof obj === "object") {
      const serialized: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          serialized[key] = this.serializeBigInt(obj[key]);
        }
      }
      return serialized;
    }

    return obj;
  }

  /**
   * Broadcast notification to a specific user
   */
  async broadcastNotification(
    userId: string,
    notification: any
  ): Promise<void> {
    try {

      console.log('the brodcast is working without any problem -------------> here is the notification ' , notification)
      const userConnections = this.connections.get(userId);
      if (!userConnections || userConnections.size === 0) {
        logger.info(`No active connections for user ${userId}`);
        return;
      }
     
      // ✅ FIX: Convert BigInt values to strings before JSON serialization
      const serializedNotification = this.serializeBigInt(notification);
     
      const message = JSON.stringify({
        type: "new_notification",
        data: serializedNotification,
      });

      let sentCount = 0;
      userConnections.forEach((ws) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(message);
          sentCount++;
        }
      });

      logger.info(
        `Notification broadcasted to user ${userId} on ${sentCount} connections`
      );
    } catch (error: any) {
      logger.error("Error broadcasting notification", {
        error: error.message,
        userId,
      });
    }
  }

  /**
   * Broadcast unread count update to a specific user
   */
  async broadcastUnreadCount(userId: string, count: number): Promise<void> {
    try {
      const userConnections = this.connections.get(userId);
      if (!userConnections || userConnections.size === 0) {
        return;
      }

      const message = JSON.stringify({
        type: "unread_count",
        data: { unreadCount: count },
      });

      userConnections.forEach((ws) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(message);
        }
      });

      logger.info(`Unread count updated for user ${userId}: ${count}`);
    } catch (error: any) {
      logger.error("Error broadcasting unread count", {
        error: error.message,
        userId,
      });
    }
  }

  /**
   * Get connection count for monitoring
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get user connection count
   */
  getUserConnectionCount(userId: string): number {
    return this.connections.get(userId)?.size || 0;
  }
}
