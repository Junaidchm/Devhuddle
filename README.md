# DevHuddle - Enterprise Social Network Platform

> A production-ready, microservices-based professional networking platform built with modern technologies and scalable architecture

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Kafka](https://img.shields.io/badge/Apache_Kafka-231F20?style=for-the-badge&logo=apache-kafka&logoColor=white)](https://kafka.apache.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

## 🚀 Overview

DevHuddle is an enterprise-grade professional social networking platform similar to LinkedIn, built using microservices architecture. The platform enables professionals to connect, share content, manage projects, and communicate in real-time through an advanced messaging system.

### ✨ Key Features

- **User Authentication & Authorization** - Secure JWT-based authentication with role-based access control
- **Professional Networking** - Follow system with real-time feed updates
- **Content Management** - Create, edit, and share professional posts with rich media support
- **Real-Time Chat** - WebSocket-based messaging with Redis Pub/Sub for horizontal scaling
- **Live Notifications** - Event-driven notification system using Kafka streams
- **Project Showcase** - Manage and showcase professional projects
- **Media Upload** - AWS S3 integration for file uploads with optimized delivery
- **Responsive Design** - Mobile-first UI built with Next.js and Tailwind CSS

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│                    (Next.js + TypeScript)                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│                       API Gateway                                │
│              (Express + HTTP Proxy Middleware)                   │
│         • Request Routing  • WebSocket Proxy                     │
│         • Rate Limiting    • Authentication                      │
└─────┬──────┬──────┬──────┬──────┬──────┬──────┬────────────────┘
      │      │      │      │      │      │      │
      ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│  Auth   │ │  Post   │ │  Chat   │ │ Notify  │ │ Project │
│ Service │ │ Service │ │ Service │ │ Service │ │ Service │
└────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
     │           │           │           │           │
     └───────────┴───────────┴───────────┴───────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │ PostgreSQL │   │   Redis    │   │   Kafka    │
   │  (NeonDB)  │   │  (Pub/Sub) │   │  (Events)  │
   └────────────┘   └────────────┘   └────────────┘
```

---

## 🛠️ Technology Stack

### Backend Services
- **Runtime:** Node.js 18+ with TypeScript
- **Framework:** Express.js for REST APIs
- **Real-time:** WebSocket (ws library) for chat and notifications
- **ORM:** Prisma for type-safe database access
- **Communication:** gRPC for inter-service communication
- **Validation:** Zod for runtime type validation
- **Logging:** Pino for high-performance structured logging

### Frontend
- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React Context + Hooks
- **Authentication:** NextAuth.js

### Infrastructure
- **Database:** PostgreSQL (NeonDB cloud-hosted)
- **Cache:** Redis for session management and Pub/Sub
- **Message Queue:** Apache Kafka for event streaming
- **File Storage:** AWS S3 for media files
- **Containerization:** Docker + Docker Compose
- **API Gateway:** Custom Express-based gateway with HTTP-proxy-middleware

---

## 📦 Microservices

### 1. **API Gateway** (Port: 8080)
Entry point for all client requests. Handles routing, authentication, and WebSocket proxying.
- ✅ HTTP request proxying to appropriate services
- ✅ WebSocket connection upgrades
- ✅ Centralized authentication
- ✅ Rate limiting and request validation

### 2. **Auth Service** (Port: 3001)
Manages user authentication, authorization, and user profiles.
- ✅ JWT token generation and validation
- ✅ Password hashing with bcrypt
- ✅ Follow/unfollow system
- ✅ gRPC server for user data queries
- ✅ Email verification and password reset

### 3. **Post Service** (Port: 4002)
Handles content creation, feeds, and engagement (likes, comments, shares).
- ✅ Post creation with media support
- ✅ Personalized feed generation
- ✅ Like, comment, share functionality
- ✅ Fan-out on write pattern for feed delivery  
- ✅ gRPC integration with Auth Service

### 4. **Chat Service** (Port: 4004) 🆕
Real-time messaging system with horizontal scalability.
- ✅ WebSocket server with JWT authentication
- ✅ Redis Pub/Sub for multi-instance message broadcasting
- ✅ Kafka event publishing for offline notifications
- ✅ 1-on-1 and group conversations
- ✅ Message persistence with Prisma
- ✅ Heartbeat mechanism for connection health

### 5. **Notification Service** (Port: 4001)
Delivers real-time notifications via WebSocket and manages notification preferences.
- ✅ WebSocket server for live notifications
- ✅ Kafka consumers for follow/engagement events
- ✅ Redis caching for unread counts
- ✅ Notification history with pagination

### 6. **Project Service** (Port: 4005)
Manages professional project portfolios.
- ✅ Project CRUD operations
- ✅ Media attachments support
- ✅ User project showcases

### 7. **Media Service** (Port: 4003)
Handles file uploads to AWS S3.
- ✅ Presigned URL generation
- ✅ Image optimization
- ✅ File type validation

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- AWS account (for S3 media uploads)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Junaidchm/Devhuddle.git
   cd Devhuddle
   ```

2. **Set up environment variables**
   
   Each service has its own `.env` file. Create them from the examples:
   ```bash
   # Auth Service
   cp auth-service/.env.example auth-service/.env
   
   # Chat Service
   cp chat-service/.env.example chat-service/.env
   
   # Add similar for other services
   ```

   **Critical environment variables:**
   - `DATABASE_URL` - PostgreSQL connection string
   - `ACCESS_TOKEN_SECRET` - JWT secret (must match across services)
   - `REDIS_URL` - Redis connection string
   - `KAFKA_BROKER` - Kafka broker URL
   - `AWS_S3_*` - AWS credentials for media uploads

3. **Start infrastructure services**
   ```bash
   docker-compose up -d postgres redis kafka zookeeper
   ```

4. **Run database migrations**
   ```bash
   # Auth Service
   cd auth-service && npx prisma migrate dev
   
   # Post Service
   cd post-service && npx prisma migrate dev
   
   # Chat Service
   cd chat-service && npx prisma db push
   ```

5. **Start all services**
   ```bash
   docker-compose up -d
   ```

6. **Start the client**
   ```bash
   cd client
   npm install
   npm run dev
   ```

7. **Access the application**
   - Frontend: `http://localhost:3000`
   - API Gateway: `http://localhost:8080`

---

## 📡 API Endpoints

### Authentication
```
POST   /api/v1/auth/register    - Register new user
POST   /api/v1/auth/login       - Login user
POST   /api/v1/auth/logout      - Logout user
GET    /api/v1/auth/verify      - Verify JWT token
```

### User Management
```
GET    /api/v1/users/:id        - Get user profile
PUT    /api/v1/users/:id        - Update user profile
POST   /api/v1/users/follows    - Follow user
DELETE /api/v1/users/follows/:id - Unfollow user
```

### Posts
```
GET    /api/v1/posts/feed       - Get personalized feed
POST   /api/v1/posts            - Create post
GET    /api/v1/posts/:id        - Get post details
PUT    /api/v1/posts/:id        - Update post
DELETE /api/v1/posts/:id        - Delete post
POST   /api/v1/posts/:id/like   - Like post
POST   /api/v1/posts/:id/comment - Comment on post
```

### Chat (WebSocket)
```
WS     /api/v1/chat             - WebSocket connection
  - Auth message: { "type": "auth", "token": "jwt_token" }
  - Send message: { "type": "send_message", "recipientIds": [...], "content": "..." }
```

### Notifications (WebSocket)
```
WS     /api/v1/notifications    - WebSocket connection
  - Receives: new_notification, unread_count events
```

---

## 🔌 WebSocket Communication

### Chat Service
```javascript
const ws = new WebSocket('ws://localhost:8080/api/v1/chat');

// 1. Authenticate
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your_jwt_token'
  }));
};

// 2. Send message
ws.send(JSON.stringify({
  type: 'send_message',
  recipientIds: ['user_123'],
  content: 'Hello!'
}));

// 3. Receive messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'new_message') {
    console.log('New message:', data.data);
  }
};
```

---

## 🏛️ Architecture Highlights

### Microservices Pattern
- **Independent deployment** - Each service can be deployed separately
- **Technology flexibility** - Choose the best tool for each service
- **Fault isolation** - Service failures don't cascade
- **Scalability** - Scale services independently based on load

### Event-Driven Architecture
- **Kafka** for reliable event streaming
- **Asynchronous processing** for non-blocking operations
- **Event sourcing** for audit trails
- **Loose coupling** between services

### Real-Time Communication
- **WebSocket** for bidirectional communication
- **Redis Pub/Sub** for horizontal scaling of WebSocket servers
- **Sub-millisecond latency** for chat messages
- **Heartbeat mechanism** for connection health monitoring

### Data Management
- **Database per service** pattern
- **Prisma ORM** for type-safe queries
- **Migration management** for schema versioning
- **Connection pooling** for performance

---

## 📊 Project Structure

```
Devhuddle/
├── api-gateway/          # API Gateway service
├── auth-service/         # Authentication & user management
├── post-service/         # Posts, feed, and engagement
├── chat-service/         # Real-time messaging
├── notification-service/ # Live notifications
├── project-service/      # Project management
├── media-service/        # File upload handling
├── client/               # Next.js frontend
└── docker-compose.yml    # Container orchestration
```

---

## 🧪 Testing

```bash
# Run tests for specific service
cd auth-service
npm test

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e
```

---

## 🐳 Docker Deployment

The project uses Docker Compose for local development and can be deployed to any container orchestration platform.

```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Scale chat service (horizontal scaling demo)
docker-compose up -d --scale chat-service=3
```

---

## 📈 Performance Optimizations

- **Redis caching** for frequently accessed data
- **Connection pooling** for database connections
- **Lazy loading** in the frontend
- **Image optimization** with Next.js Image component
- **Code splitting** for reduced bundle sizes
- **Compression** middleware for API responses
- **Database indexing** on frequently queried columns

---

## 🔒 Security Features

- **JWT authentication** with access/refresh token pattern
- **Password hashing** with bcrypt (10 rounds)
- **Input validation** with Zod schemas
- **SQL injection prevention** via Prisma ORM
- **XSS protection** with Content Security Policy
- **Rate limiting** on API endpoints
- **CORS configuration** for allowed origins
- **Environment-based secrets** management

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention
Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👨‍💻 Author

**Junaid**
- GitHub: [@Junaidchm](https://github.com/Junaidchm)
- LinkedIn: [Your LinkedIn Profile]

---

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Prisma team for the excellent ORM
- The open-source community

---

**Built with ❤️ using modern technologies and best practices**
