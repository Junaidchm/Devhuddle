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
  logger.info(`WebSocket upgrade request: ${urlPath}`);

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

  // 2. Extract Token
  // req.url is relative, construct full URL for parsing
  let token: string | null = null;
  try {
    const urlObj = new URL(urlPath, `http://${req.headers.host || "localhost"}`);
    token = urlObj.searchParams.get("token");
  } catch (e) {
    logger.error("Failed to parse WebSocket URL", { error: e });
  }

  if (!token) {
    logger.warn("WebSocket connection rejected: Missing token");
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  // 3. Authenticate (Async)
  try {
    const decoded = await verifyAccessToken(token);
    
    if (!decoded || !decoded.id) {
      throw new Error("Invalid token or signature");
    }

    // 4. Inject Identity Headers
    // Modify the request headers before passing to proxy
    req.headers["x-user-id"] = decoded.id;
    req.headers["x-user-data"] = JSON.stringify(decoded);

    // 5. Upgrade
    proxy.upgrade(req, socket, head);

    logger.info(`WebSocket authenticated and upgraded for user ${decoded.id}`);

  } catch (error) {
    logger.warn(`WebSocket authentication failed: ${error}`);
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
};
