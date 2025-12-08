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
      verifyClient: (info: any) => {
        //  No token check here - we'll authenticate after connection
        return true;
      }
    });

    this.setupWebSocket();
    this.startHeartbeat();
    this.setupGracefulShutdown();
  }


  private setupWebSocket(): void {
    this.wss.on("connection", async (ws: AuthenticatedWebSocket, req: any) => {
      //  Path filtering
      if (req.url && !req.url.startsWith(WEBSOCKET_PATH)) {
        logger.warn(`WebSocket connection rejected: Invalid path ${req.url}`);
        ws.close(4004, "Invalid path");
        return;
      }

      logger.info("New WebSocket connection (awaiting authentication)");

      // Mark as unauthenticated initially
      ws.isAlive = false; // Don't ping until authenticated
      
      // Set timeout for authentication - close if not authenticated in 5 seconds
      const authTimeout = setTimeout(() => {
        if (!ws.userId) {
          logger.warn("WebSocket connection closed: Authentication timeout");
          ws.close(4002, "Authentication timeout");
          this.pendingConnections.delete(ws);
        }
      }, AUTH_TIMEOUT);

      this.pendingConnections.set(ws, authTimeout);

      // Handle first message as authentication
      const handleAuth = async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          // Only accept auth messages when unauthenticated
          if (message.type !== "auth" || !message.token) {
            logger.warn("First message must be auth message");
            ws.send(JSON.stringify({
              type: "auth_error",
              error: "First message must be authentication"
            }));
            ws.close(4001, "Authentication required");
            this.pendingConnections.delete(ws);
            clearTimeout(authTimeout);
            return;
          }

          // Validate JWT token
          let userId: string;
          try {
            if (!message.token || typeof message.token !== 'string') {
              throw new Error("Invalid token format");
            }

            const decoded = jwt.verify(
              message.token,
              process.env.ACCESS_TOKEN_SECRET as string
            ) as { id: string };

            if (!decoded || !decoded.id) {
              throw new Error("Invalid token payload");
            }

            userId = decoded.id;
          } catch (error: any) {
            logger.warn("WebSocket authentication failed", { 
              error: error.message 
            });
            
            ws.send(JSON.stringify({
              type: "auth_error",
              error: "Invalid token"
            }));
            ws.close(4001, "Unauthorized");
            this.pendingConnections.delete(ws);
            clearTimeout(authTimeout);
            return;
          }

          // Check connection limit
          const userConnections = this.connections.get(userId);
          if (userConnections && userConnections.size >= MAX_CONNECTIONS_PER_USER) {
            logger.warn(`Connection limit reached for user ${userId}`, {
              currentConnections: userConnections.size,
              maxConnections: MAX_CONNECTIONS_PER_USER
            });
            
            ws.send(JSON.stringify({
              type: "auth_error",
              error: "Too many connections"
            }));
            ws.close(4003, "Too many connections");
            this.pendingConnections.delete(ws);
            clearTimeout(authTimeout);
            return;
          }

          // Authentication successful
          ws.userId = userId;
          ws.isAlive = true;
          
          // Clear auth timeout
          clearTimeout(authTimeout);
          this.pendingConnections.delete(ws);

          // Add to connections map
          if (!this.connections.has(userId)) {
            this.connections.set(userId, new Set());
          }
          this.connections.get(userId)!.add(ws);

          logger.info(`WebSocket authenticated for user ${userId}`, {
            userId,
            totalConnections: this.connections.size,
            userConnections: this.connections.get(userId)!.size
          });

          // Send auth success message
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

          // Remove auth handler and add normal message handler
          ws.off('message', handleAuth);
          
          ws.on('message', (data) => {
            try {
              const message = JSON.parse(data.toString());
              logger.debug(`Received message from user ${userId}`, { message });
              // Handle other client messages if needed
            } catch (error: any) {
              logger.warn(`Failed to parse message from user ${userId}`, {
                error: error.message
              });
            }
          });

        } catch (error: any) {
          logger.error("Failed to process auth message", {
            error: error.message,
            stack: error.stack
          });
          
          ws.send(JSON.stringify({
            type: "auth_error",
            error: "Invalid message format"
          }));
          ws.close(4000, "Invalid message");
          this.pendingConnections.delete(ws);
          clearTimeout(authTimeout);
        }
      };

      // Listen for first message as auth
      ws.once('message', handleAuth);

      // Handle ping/pong for keep-alive (only after authenticated)
      ws.on("pong", () => {
        if (ws.userId) { // Only update if authenticated
          ws.isAlive = true;
        }
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
