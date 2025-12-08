# Migration Guide: Production-Ready Feed Architecture

## 🚀 Prerequisites

Before running migrations, ensure:
- ✅ All code changes have been accepted
- ✅ Docker containers are running (PostgreSQL, Redis, Kafka)
- ✅ All services are stopped (to avoid migration conflicts)

---

## 📋 Step-by-Step Migration

### Step 1: Post Service Database Migration

```bash
cd post-service

# Generate Prisma client with new schema
npx prisma generate

# Create migration for UserFeed table enhancements
npx prisma migrate dev --name add_feed_relevance_scoring

# Verify migration was created successfully
ls -la prisma/migrations/
```

**Expected Changes:**
- UserFeed table gets new columns: `relevanceScore`, `scoreUpdatedAt`, `isRead`, `readAt`, `rankPosition`
- New indexes added for performance
- OutboxEventType enum gets `POST_CREATED` and `POST_UPDATED`

---

### Step 2: Notification Service Database Migration

```bash
cd notification-service

# Generate Prisma client with new schema
npx prisma generate

# Create migration for NEW_POST notification type
npx prisma migrate dev --name add_new_post_notification_type

# Verify migration was created successfully
ls -la prisma/migrations/
```

**Expected Changes:**
- NotificationType enum gets `NEW_POST` value

---

### Step 3: Regenerate gRPC Proto Files (Already Done ✅)

```bash
cd post-service

# This was already executed, but you can run it again if needed
npx ts-node src/generate.ts
```

**What This Does:**
- Generates TypeScript types for `GetFollowers` RPC from `user.proto`
- Creates client stubs for gRPC calls

---

### Step 4: Build Services

```bash
# Build post-service
cd post-service
npm run build

# Build notification-service
cd ../notification-service
npm run build
```

---

### Step 5: Start Services

```bash
# Start all services with docker-compose
cd .. # Go back to project root
docker-compose up -d

# Or start services individually
# post-service
cd post-service
npm run dev

# notification-service (in another terminal)
cd notification-service
npm run dev
```

---

### Step 6: Verify Kafka Topics

Kafka topics should be automatically created on service startup. Verify:

```bash
# List Kafka topics
docker exec -it <kafka-container-name> kafka-topics.sh --list --bootstrap-server localhost:9092

# Expected topics:
# - post.created.v1
# - post.created.v1-dlq
```

---

### Step 7: Verify Database Schema

```bash
# Connect to PostgreSQL
docker exec -it <postgres-container-name> psql -U <username> -d <database>

# Check UserFeed table structure
\d "user_feeds"

# Expected columns:
# - userId
# - postId
# - relevanceScore
# - scoreUpdatedAt
# - isRead
# - readAt
# - rankPosition
# - createdAt

# Check indexes
\di "user_feeds"

# Exit PostgreSQL
\q
```

---

### Step 8: Test Feed Functionality

#### 8.1 Create a Test Post

```bash
# Use your API client or curl
curl -X POST http://localhost:3002/api/v1/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "content": "Test post for feed",
    "userId": "user-id",
    "mediaIds": [],
    "visibility": "PUBLIC"
  }'
```

#### 8.2 Check Feed Entry Creation

```sql
-- In PostgreSQL
SELECT * FROM user_feeds ORDER BY "createdAt" DESC LIMIT 10;

-- Verify:
-- - Feed entries exist for followers
-- - relevanceScore is between 0.0 and 1.0
-- - Created timestamps are recent
```

#### 8.3 Fetch Personalized Feed

```bash
curl -X GET "http://localhost:3002/api/v1/posts?userId=user-id" \
  -H "Authorization: Bearer <token>"
```

**Expected Behavior:**
- Posts from followed users appear first
- Posts are ranked by relevance score
- Cursor-based pagination works

---

## ⚠️ Important Notes

### User Service - GetFollowers Implementation Required

The `GetFollowers` RPC method is defined in the proto file but needs to be implemented in the User Service:

```protobuf
rpc GetFollowers (GetFollowersRequest) returns (GetFollowersResponse);
```

**What Needs to Be Done:**
1. Implement `GetFollowers` handler in User Service
2. Return list of users following the specified user ID
3. Handle edge cases (no followers, invalid user ID)

**Until GetFollowers is implemented:**
- Fan-out will log a warning and skip
- Post creation will still succeed
- Events will still be published
- Notifications won't be sent (will be handled when GetFollowers is ready)

### Fallback Behavior

The system has graceful fallback:
- ✅ If feed service unavailable → Falls back to legacy query
- ✅ If GetFollowers unavailable → Logs warning, continues without fan-out
- ✅ If Redis unavailable → Skips cache, queries DB directly
- ✅ If Kafka unavailable → Logs error, doesn't block post creation

---

## 🔍 Troubleshooting

### Migration Fails

**Error:** "Migration failed: column already exists"

**Solution:**
```bash
# Check current database state
npx prisma db pull

# Reset migration if needed (CAUTION: Deletes data)
npx prisma migrate reset

# Or manually fix migration file
```

---

### Proto Generation Fails

**Error:** "protoc: command not found"

**Solution:**
```bash
# Install protoc (macOS)
brew install protobuf

# Install protoc (Ubuntu/Debian)
sudo apt-get install protobuf-compiler

# Verify installation
protoc --version
```

---

### Feed Entries Not Created

**Check:**
1. Are there followers? (GetFollowers working?)
2. Check Post Service logs for fan-out errors
3. Verify UserFeed table exists and has correct schema
4. Check database connection

**Debug:**
```bash
# Check Post Service logs
docker logs <post-service-container> | grep -i "fan-out"

# Check for errors
docker logs <post-service-container> | grep -i "error"
```

---

### Feed Not Personalized

**Check:**
1. Is `userId` passed in feed request?
2. Check if FeedService is initialized in gRPC server
3. Verify UserFeed table has entries
4. Check Redis cache (might be serving stale data)

**Debug:**
```bash
# Clear Redis cache
docker exec -it <redis-container-name> redis-cli FLUSHALL

# Check feed query logs
docker logs <post-service-container> | grep -i "feed"
```

---

## ✅ Verification Checklist

After migration, verify:

- [ ] UserFeed table has new columns
- [ ] Indexes are created on UserFeed table
- [ ] OutboxEventType enum has POST_CREATED
- [ ] NotificationType enum has NEW_POST
- [ ] Kafka topics are created
- [ ] Proto files are regenerated
- [ ] Services start without errors
- [ ] Post creation works
- [ ] Feed retrieval works (if followers exist)
- [ ] Events are published to Kafka
- [ ] No critical errors in logs

---

## 📊 Performance Monitoring

After deployment, monitor:

1. **Feed Query Performance**
   - Average query time < 200ms
   - Index usage (check EXPLAIN ANALYZE)

2. **Fan-Out Performance**
   - < 1000 followers: < 500ms
   - > 1000 followers: Async processing time

3. **Cache Hit Rate**
   - Target: > 70% cache hits for feed queries

4. **Database Load**
   - Monitor UserFeed table growth
   - Monitor index performance

---

## 🔄 Rollback Plan

If issues occur, rollback steps:

```bash
# 1. Stop services
docker-compose down

# 2. Rollback database migrations
cd post-service
npx prisma migrate resolve --rolled-back <migration-name>

cd ../notification-service
npx prisma migrate resolve --rolled-back <migration-name>

# 3. Revert code changes (git)
git revert <commit-hash>

# 4. Rebuild and restart
docker-compose up -d --build
```

---

## 📚 Next Steps After Migration

1. **Implement GetFollowers in User Service**
   - Critical for full functionality
   - Enables follower notifications

2. **Monitor and Optimize**
   - Watch query performance
   - Adjust relevance scoring weights if needed
   - Optimize cache TTL

3. **Add Background Workers** (Optional)
   - Async fan-out for large follower counts
   - Score recalculation workers

4. **Testing**
   - Load testing
   - Integration testing
   - E2E testing

---

## 🎉 Success Criteria

Migration is successful when:

✅ All migrations completed without errors  
✅ Services start successfully  
✅ Posts can be created  
✅ Feed entries are created for followers  
✅ Personalized feed returns ranked posts  
✅ No critical errors in logs  
✅ Kafka events are published  
✅ Redis caching works  

---

**Status:** Ready for Migration  
**Estimated Time:** 15-30 minutes  
**Risk Level:** Low (graceful fallbacks in place)

