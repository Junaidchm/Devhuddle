# WebSocket Communication & Routing Explanation

## 🏗️ Architecture Overview

Your application uses a **microservices architecture** with an **API Gateway** that acts as a reverse proxy. Here's how WebSocket communication flows:

```
Client (Next.js) 
    ↓
API Gateway (Express + http-proxy-middleware)
    ↓
Notification Service (Express + WebSocket Server)
```

---

## 📍 Step-by-Step Flow

### 1. **Client-Side Connection** (`useWebSocketNotifications.ts`)

**Location:** `client/src/customHooks/useWebSocketNotifications.ts`

```typescript
// Line 19-21: Client constructs WebSocket URL
const baseUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const wsBaseUrl = baseUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
const wsUrl = `${wsBaseUrl}/api/v1/notifications?token=${token}`;
```

**What happens:**
- Client connects to: `ws://localhost:8080/api/v1/notifications?token=xxx`
- This is the **API Gateway** URL (port 8080), NOT the notification service directly
- Token is passed as a **query parameter** (`?token=xxx`)

---

### 2. **API Gateway Routing** (`api-gateway/src/index.ts`)

**Location:** `api-gateway/src/index.ts` (Line 65)

```typescript
app.use(ROUTES.NOTIFICATIONS.BASE, conditionalJwtMiddleware, notificationServiceProxy);
```

**Route Definition:**
- `ROUTES.NOTIFICATIONS.BASE = "/api/v1/notifications"` (from `routes.ts`)
- All requests to `/api/v1/notifications/*` are handled by `notificationServiceProxy`

**What happens:**
- API Gateway receives WebSocket upgrade request at `/api/v1/notifications`
- `conditionalJwtMiddleware` runs first (validates JWT if needed)
- Then `notificationServiceProxy` handles the proxying

---

### 3. **Proxy Middleware** (`notification.proxy.middleware.ts`)

**Location:** `api-gateway/src/middleware/notification.proxy.middleware.ts`

**Key Configuration:**
```typescript
export const notificationServiceProxy = createProxyMiddleware({
  target: app_config.notificationServiceUrl,  // e.g., http://localhost:4001
  changeOrigin: true,
  ws: true,  // ⭐ CRITICAL: Enables WebSocket proxying
  pathRewrite: { "^/api/v1/notifications": "/api/v1/notifications" },
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    // Extract token from query parameter
    let token = req.headers["authorization"];
    if (!token && req.url) {
      const url = new URL(req.url, `ws://${req.headers.host}`);
      const tokenFromQuery = url.searchParams.get('token');
      if (tokenFromQuery) {
        token = `Bearer ${tokenFromQuery}`;  // Add "Bearer " prefix
      }
    }
    if (token) {
      proxyReq.setHeader("Authorization", token);  // Forward as header
    }
  },
});
```

**What happens:**
1. **WebSocket Upgrade Detection:** `ws: true` tells `http-proxy-middleware` to handle WebSocket upgrades
2. **Token Transformation:** 
   - Client sends token as query param: `?token=xxx`
   - Proxy extracts it and converts to: `Authorization: Bearer xxx` header
   - This is forwarded to the notification service
3. **Path Preservation:** Path stays as `/api/v1/notifications` (no rewrite needed)
4. **Forwarding:** WebSocket connection is proxied to `notificationServiceUrl` (e.g., `http://localhost:4001`)

---

### 4. **Notification Service WebSocket Server** (`websocket.util.ts`)

**Location:** `notification-service/src/utils/websocket.util.ts`

**Initialization:**
```typescript
// In notification-service/src/index.ts (Line 77)
const wsService = new WebSocketService(server);
```

**WebSocket Server Setup:**
```typescript
constructor(server: HttpServer) {
  this.wss = new Server({
    server  // ⭐ Attaches to the same HTTP server as Express
  });
  this.setupWebSocket();
}
```

**Connection Handler:**
```typescript
this.wss.on("connection", async (ws: AuthenticatedWebSocket, req: any) => {
  // Extract token from Authorization header (set by proxy)
  const authHeader: string | undefined = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No authorization token provided");
  }
  const token = authHeader.split(" ")[1];
  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  userId = decoded.id;
  
  // Store connection
  this.connections.get(userId)!.add(ws);
  
  // Send initial unread count
  ws.send(JSON.stringify({
    type: "unread_count",
    data: { unreadCount: ... }
  }));
});
```

**What happens:**
1. **WebSocket Server:** Uses `ws` library, attached to the same HTTP server as Express
2. **Path Matching:** The WebSocket server listens on **ALL paths** on the server (no specific path filter)
3. **Authentication:** Extracts JWT from `Authorization` header (set by proxy)
4. **Connection Storage:** Maps `userId` → `Set<WebSocket>` for broadcasting
5. **Initial Message:** Sends unread count immediately after connection

---

## 🔑 Key Points About Routing

### Why Does It Work Without a Specific Path?

The WebSocket server in the notification service uses:
```typescript
this.wss = new Server({ server });
```

This creates a WebSocket server that:
- **Listens on the same HTTP server** as Express
- **Intercepts ALL WebSocket upgrade requests** to that server
- **Doesn't filter by path** - it handles any WebSocket connection

However, the **proxy middleware** only forwards WebSocket connections that match `/api/v1/notifications`, so:
- ✅ `ws://gateway:8080/api/v1/notifications` → Proxied → Notification service handles it
- ❌ `ws://gateway:8080/api/v1/other` → Not proxied (no match)

### Path Flow Summary

```
Client Request:  ws://localhost:8080/api/v1/notifications?token=xxx
                    ↓
API Gateway:     Matches /api/v1/notifications route
                    ↓
Proxy Middleware: Extracts token, converts to header, forwards to notification service
                    ↓
Notification Service: Receives ws://localhost:4001/api/v1/notifications
                    ↓
WebSocket Server: Handles connection (no path filtering needed)
```

---

## 📨 Message Flow

### 1. **Initial Connection**
```
Client → Gateway → Notification Service
                    ↓
            WebSocket established
                    ↓
            Send: { type: "unread_count", data: { unreadCount: 5 } }
                    ↓
Client receives unread count
```

### 2. **New Notification** (from Kafka consumer)
```
Kafka Event → Follow Consumer → Notification Service
                                    ↓
                            Save to DB, update Redis
                                    ↓
                            wsService.broadcastNotification(userId, notification)
                                    ↓
                            Send: { type: "new_notification", data: {...} }
                                    ↓
Client receives notification
                                    ↓
Client invalidates React Query cache
                                    ↓
UI updates automatically
```

### 3. **Client-Side Handling** (`useWebSocketNotifications.ts`)
```typescript
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case "new_notification":
      // Invalidate queries to refetch notifications
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["unread-count", userId] });
      break;
      
    case "unread_count":
      // Directly update cache (no refetch needed)
      queryClient.setQueryData(["unread-count", userId], {
        unreadCount: message.data.unreadCount,
      });
      break;
  }
};
```

---

## 🎯 Why This Architecture?

### Benefits:
1. **Single Entry Point:** All traffic goes through API Gateway
2. **Authentication:** JWT validation happens at gateway level
3. **Service Isolation:** Notification service doesn't need to know about client URLs
4. **Scalability:** Can add load balancing, rate limiting, etc. at gateway
5. **Path Consistency:** Client always uses `/api/v1/notifications` regardless of service location

### Token Handling:
- **Client → Gateway:** Token in query parameter (WebSocket limitation)
- **Gateway → Service:** Token in `Authorization` header (standard HTTP header)
- **Service:** Validates token and extracts `userId`

---

## 🔍 Debugging Tips

### Check Connection Flow:
1. **Client logs:** `useWebSocketNotifications.ts` line 27: "WebSocket connection established"
2. **Gateway logs:** `notification.proxy.middleware.ts` line 17: Forwarding message
3. **Service logs:** `websocket.util.ts` line 45: "WebSocket connection established for user {userId}"

### Common Issues:
- **Token not forwarded:** Check `onProxyReqWs` in proxy middleware
- **Connection rejected:** Check JWT validation in `websocket.util.ts` line 34
- **Path mismatch:** Ensure client uses `/api/v1/notifications` exactly

---

## 📝 Summary

1. **Client** connects to API Gateway with token in query string
2. **API Gateway** routes `/api/v1/notifications` to notification service proxy
3. **Proxy** converts query token to `Authorization` header and forwards WebSocket
4. **Notification Service** WebSocket server handles connection (no path filtering)
5. **Messages** flow bidirectionally through the same connection
6. **Kafka consumers** trigger broadcasts when events occur

The routing works because:
- The proxy middleware filters by path (`/api/v1/notifications`)
- The WebSocket server accepts all connections on its server
- The proxy only forwards matching paths, so only notification WebSockets reach the service

