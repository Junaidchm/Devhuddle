# Chat Service - Real-Time Messaging Microservice

> Production-ready WebSocket chat system with Redis Pub/Sub and Kafka integration for horizontal scalability

## 🎯 Overview

The Chat Service is a highly scalable real-time messaging microservice built with WebSocket, Redis Pub/Sub, and Apache Kafka. It supports 1-on-1 and group conversations with sub-millisecond message delivery across multiple service instances.

## ✨ Key Features

- ✅ **WebSocket Server** - Bidirectional real-time communication
- ✅ **2-Phase JWT Authentication** - Secure connection with 5-second timeout
- ✅ **Redis Pub/Sub** - Multi-instance message broadcasting (<1ms latency)
- ✅ **Kafka Integration** - Event publishing for offline notifications
- ✅ **Horizontal Scalability** - Scale to N instances seamlessly
- ✅ **Connection Management** - Max 5 connections per user, heartbeat monitoring
- ✅ **Message Persistence** - PostgreSQL storage via Prisma ORM
- ✅ **Graceful Shutdown** - Zero-downtime deployments

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│               Chat Service Instance 1                    │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │ WebSocket  │  │   Chat     │  │   Repository     │  │
│  │  Server    │─▶│  Service   │─▶│   (Prisma)       │  │
│  └────────────┘  └────────────┘  └──────────────────┘  │
│         │             │                     │            │
│         │             │                     ▼            │
│         │             │              ┌────────────┐     │
│         │             │              │ PostgreSQL │     │
│         │             │              └────────────┘     │
│         │             │                                  │
│         └─────────────┴──────┐                          │
│                               │                          │
│         ┌─────────────────────┘                          │
│         ▼                                                │
│  ┌────────────────┐      ┌─────────────────┐           │
│  │ Redis Pub/Sub  │      │  Kafka Producer │           │
│  │ (Broadcast)    │      │  (Events)       │           │
│  └────────────────┘      └─────────────────┘           │
└────────────┬──────────────────────┬──────────────────────┘
             │                      │
             │                      │
┌────────────▼──────────────────────▼──────────────────────┐
│               Chat Service Instance 2                    │
│                    (Same architecture)                   │
└──────────────────────────────────────────────────────────┘

All instances subscribe to chat:* → Messages reach all connected users
```

---

## 🚀 Technology Stack

- **Runtime:** Node.js 18+ with TypeScript
- **WebSocket:** ws library for WebSocket server
- **Database:** PostgreSQL (NeonDB) via Prisma ORM
- **Caching:** Redis (3 clients: cache, publisher, subscriber)
- **Events:** Apache Kafka for async event publishing
- **Logging:** Pino for high-performance structured logging
- **Validation:** TypeScript strict mode for type safety

---

## 📦 Database Schema

```prisma
model Conversation {
  id            String   @id @default(cuid())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  lastMessageAt DateTime @default(now())
  
  messages      Message[]
  participants  Participant[]
}

model Participant {
  id             String   @id @default(cuid())
  userId         String
  conversationId String
  joinedAt       DateTime @default(now())
  lastReadAt     DateTime @default(now())
  
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  @@unique([userId, conversationId])
  @@index([userId])
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  senderId       String
  content        String
  createdAt      DateTime @default(now())
  
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  @@index([conversationId, createdAt])
}
```

---

## 🔌 WebSocket Protocol

### Connection & Authentication

```javascript
const ws = new WebSocket('ws://localhost:4004/api/v1/chat');

// Phase 1: Connection established (unauthenticated)
ws.onopen = () => {
  console.log('Connected - must authenticate within 5 seconds');
  
  // Phase 2: Send authentication message
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your_jwt_token'
  }));
};

// Receive auth response
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'auth_success') {
    console.log('Authenticated! Ready to send messages');
  } else if (data.type === 'auth_error') {
    console.error('Authentication failed:', data.error);
    // Connection will close with code 4001 (Unauthorized)
  }
};
```

### Sending Messages

```javascript
// Send a message
ws.send(JSON.stringify({
  type: 'send_message',
  recipientIds: ['user_123', 'user_456'],  // For group chat
  content: 'Hello, team!'
}));

// Receive confirmation
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'message_sent') {
    console.log('Message delivered:', data.data);
    // data.data contains: { id, conversationId, senderId, content, createdAt }
  }
};
```

### Receiving Messages

```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'new_message':
      console.log('New message received:', data.data);
      // Update UI with new message
      break;
      
    case 'typing':
      console.log('User is typing...');
      break;
      
    case 'server_shutdown':
      console.log('Server is shutting down - reconnect in 5s');
      break;
  }
};
```

### Typing Indicator (Optional)

```javascript
// Send typing indicator
ws.send(JSON.stringify({
  type: 'typing',
  conversationId: 'conv_123'
}));
```

---

## 🔐 Security Features

### 2-Phase Authentication
1. **Connection allowed** (unauthenticated initially)
2. **5-second timeout** - must send auth message within 5 seconds
3. **JWT verification** - token validated against `ACCESS_TOKEN_SECRET`
4. **Connection limit** - Max 5 connections per user (prevents DoS)

### Connection Lifecycle
```
Connect → Wait for auth message (5s timeout)
       ↓
  Auth received → Verify JWT
       ↓
  Valid token → Add to connection map
       ↓
  Ready to receive/send messages
```

### Heartbeat Mechanism
- **Ping every 30 seconds** to detect dead connections
- **Pong response required** or connection terminated
- **Automatic cleanup** of dead connections from map

### Graceful Shutdown
- **SIGTERM/SIGINT handlers** for Docker stop
- **Send shutdown message** to connected clients
- **Close all connections gracefully**
- **5-second force-exit** timeout

---

## 📡 Redis Pub/Sub Flow

### Why Redis Pub/Sub?

**Problem:** User A on Instance 1, User B on Instance 2 - how do they communicate?

**Solution:** Redis Pub/Sub as a message broker

```
User A (Instance 1) sends message
         ↓
  Save to database
         ↓
  Publish to Redis: "chat:conversationId"
         ↓
  All instances subscribed to "chat:*" pattern
         ↓
  Instance 1 receives → broadcasts to User A
  Instance 2 receives → broadcasts to User B
         ↓
  Both users get the message!
```

### Channel Pattern
- **Channel format:** `chat:{conversationId}`
- **Subscription:** `chat:*` (pattern matching)
- **Latency:** <1 millisecond for Pub/Sub

---

## 📨 Kafka Event Publishing

Messages are published to Kafka topic `chat-events` for:
- **Offline notifications** - Notification service listens for `MessageSent` events
- **Analytics** - Track message volume, user activity
- **Audit logging** - Compliance and security

### Event Schema
```typescript
{
  eventType: "MessageSent",
  messageId: "msg_123",
  conversationId: "conv_456",
  senderId: "user_789",
  recipientIds: ["user_123", "user_456"],
  content: "Message content",
  timestamp: "2024-01-11T12:00:00Z",
  dedupeId: "uuid",
  source: "chat-service",
  version: 1
}
```

---

## ⚙️ Environment Variables

```env
# Server
PORT=4004
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:pass@host/dbname"

# Authentication
ACCESS_TOKEN_SECRET="your-secret-key"

# Redis
REDIS_URL="redis://localhost:6379"

# Kafka
KAFKA_BROKER="kafka:9092"

# Logging
LOG_LEVEL="info"
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database
```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push
```

### 3. Start Service
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 4. Test WebSocket Connection
```bash
# Using wscat
npx wscat -c ws://localhost:4004/api/v1/chat

# Send auth message
> {"type":"auth","token":"your_jwt_token"}

# Send message
> {"type":"send_message","recipientIds":["user_123"],"content":"Hello!"}
```

---

## 🐳 Docker Deployment

```bash
# Build image
docker build -t chat-service .

# Run container
docker run -p 4004:4004 \
  -e DATABASE_URL="..." \
  -e REDIS_URL="..." \
  -e KAFKA_BROKER="..." \
  chat-service

# Or use docker-compose
docker-compose up -d chat-service
```

### Scale Multiple Instances
```bash
# Run 3 instances (Redis Pub/Sub ensures they communicate)
docker-compose up -d --scale chat-service=3
```

---

## 📊 Performance

- **Message latency:** <1ms via Redis Pub/Sub
- **Concurrent connections:** 10,000+ per instance
- **Horizontal scaling:** Linear scaling with instances
- **Database queries:** Optimized with Prisma indexes
- **Memory usage:** ~100MB per instance

---

## 🧪 Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Load testing
npm run test:load
```

---

## 📈 Monitoring

### Health Check Endpoint
```bash
curl http://localhost:4004/health
```

### Metrics
- Active WebSocket connections
- Messages sent/received per second
- Redis Pub/Sub message count
- Kafka event publish rate

---

## 🔧 Troubleshooting

### WebSocket connection closes immediately
- Check JWT token validity
- Ensure 5-second auth timeout not exceeded
- Verify `ACCESS_TOKEN_SECRET` matches Auth Service

### Messages not received on other instance
- Check Redis connection (`REDIS_URL`)
- Verify both instances subscribed to `chat:*`
- Check Redis logs for Pub/Sub issues

### High memory usage
- Check for connection leaks (heartbeat not working)
- Verify dead connections are cleaned up
- Monitor connection map size

---

## 🤝 Contributing

See main project [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## 📝 License

MIT License - See [LICENSE](../LICENSE)

---

**Built with ⚡ for real-time messaging at scale**
