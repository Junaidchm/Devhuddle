# Local Development Setup for Project Service

## Prerequisites

- Node.js 18.x or higher (currently using v18.20.4)
- npm 10.x or higher
- Docker and Docker Compose (for infrastructure services)

## Local Installation Steps

### 1. Install Dependencies

```bash
cd project-service
npm install
```

This will install all dependencies including:
- Prisma 6.14.0 (compatible with Node 18)
- TypeScript and build tools
- All runtime dependencies

### 2. Generate Prisma Client

```bash
# Generate Prisma client (this creates the @prisma/client types)
npx prisma generate
```

**Note**: If you get an error about Prisma 7.x, make sure:
- Your `package.json` has `"prisma": "6.14.0"` (pinned version, not `^6.14.0`)
- Delete `node_modules` and `package-lock.json` if needed:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  npx prisma generate
  ```

### 3. Generate gRPC Code

```bash
# Generate gRPC client/server code from proto files
npx ts-node src/generate.ts
```

### 4. Setup Environment Variables

Create `.env` file in `project-service/` directory:

```env
# Server
PORT=3004
GRPC_PORT=50053

# Database (use your local PostgreSQL or Docker)
DATABASE_URL=postgresql://user:password@localhost:5432/projectdb

# Redis (use local Redis or Docker)
REDIS_URL=redis://localhost:6379

# Kafka (use Docker)
KAFKA_BROKER=localhost:9092
KAFKA_CLIENT_ID=project-service

# Auth Service (gRPC for inter-service communication)
AUTH_GRPC_URL=localhost:50051

# Logging
LOG_LEVEL=info
```

### 5. Database Setup

#### Option A: Using Docker PostgreSQL
```bash
# Start PostgreSQL in Docker
docker run --name project-postgres \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=projectdb \
  -p 5432:5432 \
  -d postgres:15

# Run migrations
npx prisma migrate dev
# OR if you just want to push schema without migrations
npx prisma db push
```

#### Option B: Using Local PostgreSQL
```bash
# Create database
createdb projectdb

# Run migrations
npx prisma migrate dev
```

### 6. Start Infrastructure Services (Docker)

```bash
# From project root
docker-compose up -d redis kafka zookeeper postgres
```

### 7. Run Project Service Locally

```bash
# Development mode (with watch)
npm run dev

# OR build and run
npm run build
npm start
```

## Troubleshooting

### Issue: Prisma 7.x Installation Error

**Error**: `Unsupported engine - required: { node: '^20.19 || ^22.12 || >=24.0' }`

**Solution**:
1. Ensure `package.json` has pinned version: `"prisma": "6.14.0"` (not `^6.14.0`)
2. Delete lock file and reinstall:
   ```bash
   rm package-lock.json
   rm -rf node_modules
   npm install
   ```

### Issue: Database Connection Failed

**Error**: `Can't reach database server`

**Solution**:
1. Check `DATABASE_URL` in `.env` is correct
2. Ensure PostgreSQL is running:
   ```bash
   # Check if running
   docker ps | grep postgres
   # OR
   pg_isready
   ```
3. Test connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

### Issue: Prisma Client Not Generated

**Error**: `Cannot find module '@prisma/client'`

**Solution**:
```bash
npx prisma generate
```

### Issue: gRPC Code Not Generated

**Error**: `Cannot find module './grpc/generated/project'`

**Solution**:
```bash
npx ts-node src/generate.ts
```

### Issue: TypeScript Compilation Errors

**Error**: Various TypeScript errors

**Solution**:
1. Ensure Prisma client is generated: `npx prisma generate`
2. Ensure gRPC code is generated: `npx ts-node src/generate.ts`
3. Check that all dependencies are installed: `npm install`

## Development Workflow

1. **Start Infrastructure**:
   ```bash
   docker-compose up -d redis kafka zookeeper
   ```

2. **Start Database**:
   ```bash
   docker-compose up -d postgres
   # OR use local PostgreSQL
   ```

3. **Setup Database**:
   ```bash
   npx prisma migrate dev
   ```

4. **Generate Code**:
   ```bash
   npx prisma generate
   npx ts-node src/generate.ts
   ```

5. **Start Service**:
   ```bash
   npm run dev
   ```

6. **Test Health Endpoint**:
   ```bash
   curl http://localhost:3004/health
   ```

## Quick Start Script

Create a `setup.sh` script:

```bash
#!/bin/bash
echo "Setting up project-service for local development..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Generate gRPC code
echo "Generating gRPC code..."
npx ts-node src/generate.ts

# Setup database (if needed)
echo "Setting up database..."
npx prisma db push

echo "Setup complete! Run 'npm run dev' to start the service."
```

Make it executable:
```bash
chmod +x setup.sh
./setup.sh
```

## Testing Locally

### Test Health Endpoint
```bash
curl http://localhost:3004/health
```

### Test Through API Gateway
```bash
# Start API Gateway first (from project root)
cd ../api-gateway
npm run dev

# Test project endpoint
curl http://localhost:8080/api/v1/projects
```

## Notes

- Prisma 6.14.0 is compatible with Node.js 18.x
- The service runs on port 3004 (HTTP) and 50053 (gRPC)
- Make sure all infrastructure services (Redis, Kafka, PostgreSQL) are running
- Use `npm run dev` for development with hot reload

