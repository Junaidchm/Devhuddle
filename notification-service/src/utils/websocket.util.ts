import { Server, WebSocket } from "ws";
import { Server as HttpServer } from "http";
import logger from "./logger.util"; 
import redisClient from "../config/redis.config";
import jwt from "jsonwebtoken";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

export class WebSocketService {
  private wss: Server;
  private connections: Map<string, Set<AuthenticatedWebSocket>> = new Map();

  constructor(server: HttpServer) {
    this.wss = new Server({
      server
    });

    this.setupWebSocket();
    this.startHeartbeat();
  }

  private setupWebSocket(): void {
    this.wss.on("connection", async (ws: AuthenticatedWebSocket, req: any) => {
      let userId: string;
      try {
        const authHeader: string | undefined = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          throw new Error("No authorization token provided");
        }
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(
          token,
          process.env.ACCESS_TOKEN_SECRET as string
        ) as { id: string };
        userId = decoded.id;
      } catch (error: any) {
        logger.warn("WebSocket connection rejected: Invalid token", { error: error.message });
        ws.close(4001, "Unauthorized");
        return;
      }

      logger.info(`WebSocket connection established for user ${userId}`);

      // Add to connections map
      if (!this.connections.has(userId)) {
        this.connections.set(userId, new Set());
      }
      this.connections.get(userId)!.add(ws);

      ws.userId = userId;
      ws.isAlive = true;

      logger.info(
        `WebSocket connected for user ${userId}. Total connections: ${this.connections.size}`
      );

      // Send initial unread count
      const cacheKey = `notifications:unread:${userId}`;
      const unreadCount = await redisClient.get(cacheKey);

      console.log('this is the user unread count socket conection  ----------------^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^->' , unreadCount)
      ws.send(
        JSON.stringify({
          type: "unread_count",
          data: { unreadCount: parseInt(unreadCount || "0", 10) },
        })
      );

      // Handle ping/pong for keep-alive
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("close", () => {
        if (userId && this.connections.has(userId)) {
          this.connections.get(userId)!.delete(ws);
          if (this.connections.get(userId)!.size === 0) {
            this.connections.delete(userId);
          }
        }
        logger.info(
          `WebSocket disconnected for user ${userId}. Remaining connections: ${this.connections.size}`
        );
      });

      ws.on("error", (error) => {
        logger.error(`WebSocket error for user ${userId}`, {
          error: error.message,
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
     
      const message = JSON.stringify({
        type: "new_notification",
        data: notification,
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
