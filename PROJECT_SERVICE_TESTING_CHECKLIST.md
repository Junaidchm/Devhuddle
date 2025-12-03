# Project Service Testing Checklist ✅

## Pre-Start Verification

### 1. ✅ API Gateway Configuration
- [x] HTTP proxy middleware created (`project.proxy.middleware.ts`)
- [x] Proxy route added to API Gateway (`/api/v1/projects`)
- [x] Conditional JWT middleware applied
- [x] `PROJECT_SERVICE_URL` added to `app.config.ts`

### 2. ✅ Project Service Configuration
- [x] HTTP server configured (port 3004)
- [x] gRPC server configured (port 50053) - for inter-service communication
- [x] Routes mounted at `/api/v1/projects/*`
- [x] All controllers implemented
- [x] Health check endpoint: `/health`

### 3. ✅ Docker Compose
- [x] project-service service defined
- [x] Ports exposed: 3004 (HTTP), 50053 (gRPC)
- [x] Dependencies: kafka, zookeeper, redis
- [x] Health check configured
- [x] Volumes mounted correctly
- [x] Command includes: generate gRPC, migrate DB, start dev

### 4. ⚠️ Environment Variables Required

#### API Gateway `.env`
```env
PROJECT_SERVICE_URL=http://project-service:3004
```

#### Project Service `.env`
```env
# Server
PORT=3004
GRPC_PORT=50053

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/projectdb

# Redis
REDIS_URL=redis://redis:6379

# Kafka
KAFKA_BROKER=localhost:9092
KAFKA_CLIENT_ID=project-service

# Auth Service (gRPC for inter-service)
AUTH_GRPC_URL=auth-service:50051

# AWS S3 (if using media uploads)
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=your-region

# Logging
LOG_LEVEL=info
```

### 5. ✅ Database Setup
- [x] Prisma schema defined (`project-service/prisma/schema.prisma`)
- [x] Migrations ready
- [x] Docker compose command includes `prisma migrate deploy`

### 6. ✅ Routes Available

#### Public Routes (No JWT Required)
- `GET /api/v1/projects` - List projects
- `GET /api/v1/projects/:projectId` - Get project details
- `GET /api/v1/projects/trending` - Get trending projects
- `GET /api/v1/projects/top` - Get top projects
- `GET /api/v1/projects/search?query=...` - Search projects
- `POST /api/v1/projects/:projectId/view` - Track view

#### Protected Routes (JWT Required)
- `POST /api/v1/projects` - Create project
- `PUT /api/v1/projects/:projectId` - Update project
- `DELETE /api/v1/projects/:projectId` - Delete project
- `POST /api/v1/projects/:projectId/publish` - Publish project
- `POST /api/v1/projects/:projectId/like` - Like project
- `DELETE /api/v1/projects/:projectId/like` - Unlike project
- `POST /api/v1/projects/:projectId/share` - Share project
- `POST /api/v1/projects/:projectId/report` - Report project

#### ⚠️ Missing Route
- `POST /api/v1/projects/media` - Media upload (not implemented yet)

### 7. ✅ Dependencies
- [x] All packages in `package.json`
- [x] TypeScript configured
- [x] Prisma client generated
- [x] gRPC code generated

## Testing Steps

### Step 1: Start Infrastructure
```bash
# Start all services
docker-compose up -d

# Check project-service logs
docker-compose logs -f project-service

# Check API Gateway logs
docker-compose logs -f api-gateway
```

### Step 2: Verify Health Checks
```bash
# Project Service
curl http://localhost:3004/health

# API Gateway
curl http://localhost:8080/health
```

### Step 3: Test Public Routes (No Auth)
```bash
# List projects
curl http://localhost:8080/api/v1/projects

# Get trending projects
curl http://localhost:8080/api/v1/projects/trending

# Search projects
curl "http://localhost:8080/api/v1/projects/search?query=react"
```

### Step 4: Test Protected Routes (With Auth)
```bash
# Get JWT token first (from auth service)
TOKEN="your-jwt-token"

# Create project
curl -X POST http://localhost:8080/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "title": "Test Project",
    "description": "Test description",
    "techStack": ["React", "Node.js"],
    "tags": ["web", "fullstack"],
    "visibility": "PUBLIC"
  }'

# Like project
curl -X POST http://localhost:8080/api/v1/projects/{projectId}/like \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)"
```

### Step 5: Verify Database
```bash
# Connect to database and check tables
docker-compose exec postgres psql -U user -d projectdb -c "\dt"
```

### Step 6: Verify Kafka Events
```bash
# Check Kafka topics
docker-compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --list | grep project
```

## Common Issues & Solutions

### Issue 1: PROJECT_SERVICE_URL not set
**Error**: `Service Unavailable - Project service is not configured`
**Solution**: Add `PROJECT_SERVICE_URL=http://project-service:3004` to API Gateway `.env`

### Issue 2: Database connection failed
**Error**: `Can't reach database server`
**Solution**: 
- Check `DATABASE_URL` in project-service `.env`
- Ensure postgres service is running
- Run migrations: `docker-compose exec project-service npx prisma migrate deploy`

### Issue 3: Redis connection failed
**Error**: `Redis Client Error`
**Solution**: 
- Check `REDIS_URL` in project-service `.env`
- Ensure redis service is running

### Issue 4: Kafka connection failed
**Error**: `Kafka connection error`
**Solution**: 
- Check `KAFKA_BROKER` in project-service `.env`
- Ensure kafka and zookeeper services are running
- Wait for kafka to be fully ready (check health)

### Issue 5: gRPC auth-service connection failed
**Error**: `Failed to connect to auth-service`
**Solution**: 
- Check `AUTH_GRPC_URL` in project-service `.env`
- Ensure auth-service is running and gRPC port 50051 is accessible

### Issue 6: Routes return 404
**Error**: `404 Not Found`
**Solution**: 
- Verify routes are mounted at `/api/v1` in project-service
- Check API Gateway proxy is forwarding correctly
- Verify route paths match exactly

## Quick Start Commands

```bash
# 1. Ensure environment variables are set
# Check api-gateway/.env has PROJECT_SERVICE_URL
# Check project-service/.env has all required vars

# 2. Start services
docker-compose up -d

# 3. Wait for services to be healthy
docker-compose ps

# 4. Check logs
docker-compose logs -f project-service

# 5. Test health endpoint
curl http://localhost:3004/health

# 6. Test through API Gateway
curl http://localhost:8080/api/v1/projects
```

## Success Indicators

✅ Project service health check returns 200
✅ API Gateway proxy forwards requests successfully
✅ Public routes work without authentication
✅ Protected routes require JWT token
✅ Database tables created successfully
✅ Kafka topics created for project events
✅ Outbox processor running (check logs)
✅ gRPC server listening on port 50053

## Next Steps After Testing

1. Test all CRUD operations
2. Test engagement features (like, share, report)
3. Test trending/top/search algorithms
4. Test pagination
5. Test error handling
6. Test idempotency
7. Verify events are published to Kafka
8. Test media upload (when implemented)

