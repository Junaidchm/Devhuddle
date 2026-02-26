import { IncomingMessage } from "http";
import { Socket } from "net";
import { chatServiceProxy } from "../middleware/chat.proxy.middleware";
import { notificationServiceProxy } from "../middleware/notification.proxy.middleware";
import { logger } from "../utils/logger";
import { verifyAccessToken } from "../utils/jwt.util";

export const handleWebSocketUpgrade = async (
  req: IncomingMessage,
  socket: Socket,
  head: Buffer
) => {
  const urlPath = req.url || "";
  // logger.info(`WebSocket upgrade request: ${urlPath}`);

  // 1. Route to correct proxy
  let proxy: any = null;
  if (urlPath.startsWith("/api/v1/chat")) {
    proxy = chatServiceProxy;
  } else if (urlPath.startsWith("/api/v1/notifications")) {
    proxy = notificationServiceProxy;
  } else {
    logger.warn(`Unknown WebSocket path: ${urlPath}`);
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  // 2. Authenticate (Unified logic from jwtMiddleware)
  try {
    const { authenticate } = await import("../middleware/jwt.middleware");
    const decoded = await authenticate(req as any);
    
    // 3. Inject Identity Headers
    req.headers["x-user-id"] = decoded.id;
    req.headers["x-user-data"] = JSON.stringify(decoded);

    // 4. Upgrade
    proxy.upgrade(req, socket, head);
    logger.info(`WebSocket authenticated and upgraded for user ${decoded.id}`);

  } catch (error: any) {
    logger.warn(`WebSocket authentication failed: ${error.message}`);
    const status = error.status || 401;
    socket.write(`HTTP/1.1 ${status} Unauthorized\r\n\r\n`);
    socket.destroy();
  }
};
