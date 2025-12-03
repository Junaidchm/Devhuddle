# Production-Ready Post Creation & Feed Architecture
## Industrial Standard Implementation (LinkedIn/Facebook Pattern)

---

## 🔴 Current Problems Identified

### 1. **Naive Post Listing**
- ❌ Fetching ALL posts in reverse chronological order
- ❌ No personalization based on user's social graph
- ❌ No feed ranking or relevance scoring
- ❌ Same feed for every user (not personalized)

### 2. **Missing Feed Generation Pattern**
- ❌ No fan-out when creating posts
- ❌ Posts not added to followers' feeds
- ❌ UserFeed table exists but is unused
- ❌ No pre-computation of feeds

### 3. **Missing Notification System**
- ❌ No notifications when followed users create posts
- ❌ Notification service exists but not triggered on post creation
- ❌ No event publishing for new posts

### 4. **No Feed Ranking Algorithm**
- ❌ No relevance scoring
- ❌ No engagement-based ranking
- ❌ No social graph consideration
- ❌ Posts from followers not prioritized

---

## ✅ Production-Ready Solution (LinkedIn/Facebook Pattern)

### **Architecture Overview**

```
Post Creation Flow:
1. User creates post → Posts table
2. Extract metadata (hashtags, mentions, content type)
3. Fan-out to followers → UserFeed table (with relevance scores)
4. Publish events → Notification Service
5. Notify followers → Real-time notifications

Feed Retrieval Flow:
1. User requests feed → Query UserFeed table (ranked by score)
2. Apply filters (blocked users, privacy, moderation)
3. Return paginated results
4. Cache top N posts in Redis
```

---

## 📋 Implementation Requirements

### **Phase 1: Database Schema Enhancement**

#### 1.1 Enhance UserFeed Table
```prisma
model UserFeed {
  userId      String   @db.VarChar(255)
  postId      String   @db.VarChar(255)
  
  // ✅ NEW: Relevance scoring fields
  relevanceScore Float    @default(0.0) // 0.0 - 1.0
  scoreUpdatedAt DateTime @default(now())
  
  // ✅ NEW: Feed metadata
  isRead       Boolean  @default(false)
  readAt       DateTime?
  
  // ✅ NEW: Ranking metadata
  rankPosition Int?     // Position in user's feed (for efficient pagination)
  
  createdAt    DateTime @default(now())
  
  Posts        Posts    @relation(fields: [postId], references: [id], onDelete: Cascade)
  
  @@id([userId, postId])
  @@index([userId, relevanceScore, createdAt]) // Composite index for feed queries
  @@index([userId, isRead])
  @@index([scoreUpdatedAt])
  @@map("user_feeds")
}
```

#### 1.2 Add Post Creation Event Type
```prisma
enum OutboxEventType {
  // ... existing events
  POST_CREATED  // ✅ NEW: For fan-out and notifications
  POST_UPDATED
}
```

---

### **Phase 2: Feed Ranking Service**

#### 2.1 Relevance Scoring Algorithm

**Scoring Formula (LinkedIn-style):**
```
relevanceScore = (
  socialGraphScore * 0.40 +      // 40% weight
  engagementScore * 0.35 +       // 35% weight
  contentRelevanceScore * 0.20 + // 20% weight
  temporalScore * 0.05           // 5% weight
)
```

**1. Social Graph Score (40%):**
- Direct followers: 1.0
- Second-degree connections: 0.6
- Mutual connections: 0.8
- No connection: 0.1 (for public posts)

**2. Engagement Score (35%):**
```typescript
engagementScore = normalize(
  (likesCount * 1.0) +
  (commentsCount * 2.0) +      // Comments weighted higher
  (sharesCount * 3.0) +        // Shares weighted highest
  (engagementVelocity * 1.5)   // Recent activity spike
)
```

**3. Content Relevance Score (20%):**
- Matching hashtags: +0.3 per match
- Content type preference: +0.2
- Topic affinity: +0.5

**4. Temporal Score (5%):**
```typescript
temporalScore = Math.max(0, 1 - (hoursSinceCreation / 168)) // Decay over 7 days
```

---

### **Phase 3: Fan-Out Pattern Implementation**

#### 3.1 Post Creation Flow

**Service: `post.service.ts`**
```typescript
async submitPost(req: SubmitPostRequest): Promise<SubmitPostResponse> {
  // 1. Create post in transaction
  const post = await this.postRepository.submitPostRepo(req);
  
  // 2. Extract metadata
  const metadata = this.extractPostMetadata(post);
  
  // 3. Get followers (from User Service via gRPC)
  const followers = await this.userService.getFollowers(post.userId);
  
  // 4. Fan-out strategy based on follower count
  if (followers.length < 1000) {
    // Synchronous fan-out (fast path)
    await this.feedService.fanOutToFollowers(post.id, followers, metadata);
  } else {
    // Asynchronous fan-out (queue-based)
    await this.queueService.enqueueFanOut({
      postId: post.id,
      authorId: post.userId,
      followers: followers.map(f => f.id),
      metadata
    });
  }
  
  // 5. Publish event for notifications
  await this.outboxService.createOutboxEvent({
    aggregateType: OutboxAggregateType.POST,
    aggregateId: post.id,
    type: OutboxEventType.POST_CREATED,
    topic: KAFKA_TOPICS.POST_CREATED,
    payload: {
      postId: post.id,
      userId: post.userId,
      visibility: post.visibility,
      // ... other metadata
    }
  });
  
  return post;
}
```

#### 3.2 Feed Service Implementation

**Service: `feed.service.ts` (NEW)**
```typescript
class FeedService {
  async fanOutToFollowers(
    postId: string,
    followers: Follower[],
    metadata: PostMetadata
  ): Promise<void> {
    const feedEntries = await Promise.all(
      followers.map(async (follower) => {
        const relevanceScore = await this.feedRankingService.calculateScore(
          postId,
          follower.id,
          metadata
        );
        
        return {
          userId: follower.id,
          postId,
          relevanceScore,
          createdAt: new Date(),
        };
      })
    );
    
    // Batch insert into UserFeed table
    await this.feedRepository.batchInsertFeedEntries(feedEntries);
  }
  
  async getFeed(userId: string, cursor?: string, limit = 10): Promise<FeedResponse> {
    // 1. Try Redis cache first
    const cached = await this.redis.get(`feed:${userId}:${cursor || 'latest'}`);
    if (cached) return JSON.parse(cached);
    
    // 2. Query UserFeed table (ranked by relevanceScore)
    const feedEntries = await this.feedRepository.getFeedEntries(
      userId,
      cursor,
      limit
    );
    
    // 3. Get full post data
    const postIds = feedEntries.map(e => e.postId);
    const posts = await this.postRepository.getPostsByIds(postIds);
    
    // 4. Cache results
    await this.redis.setex(
      `feed:${userId}:${cursor || 'latest'}`,
      300, // 5 min TTL
      JSON.stringify({ posts, nextCursor: feedEntries[feedEntries.length - 1]?.postId })
    );
    
    return { posts, nextCursor };
  }
}
```

---

### **Phase 4: Notification System Integration**

#### 4.1 Post Creation Notification Handler

**Consumer: `notification-service/src/consumers/post.consumer.ts` (NEW)**
```typescript
export async function handlePostCreated(
  event: PostCreatedEvent,
  repo: NotificationsRepository,
  wsService: WebSocketService
): Promise<void> {
  const { postId, userId, visibility, followers } = event;
  
  // Only notify followers for PUBLIC or VISIBILITY_CONNECTIONS posts
  if (visibility === 'PUBLIC' || visibility === 'VISIBILITY_CONNECTIONS') {
    // Notify all followers
    for (const followerId of followers) {
      await repo.createPostNotification(
        userId,           // actor (post author)
        followerId,       // recipient (follower)
        postId,
        'POST_CREATED'
      );
      
      // Real-time WebSocket notification
      wsService.broadcastToUser(followerId, {
        type: 'NEW_POST',
        payload: {
          postId,
          authorId: userId,
          timestamp: new Date().toISOString(),
        }
      });
    }
  }
}
```

#### 4.2 Notification Schema Update
```prisma
enum NotificationType {
  // ... existing
  NEW_POST  // ✅ NEW: For post creation notifications
}
```

---

### **Phase 5: Feed Ranking Service**

**Service: `feed-ranking.service.ts` (NEW)**
```typescript
class FeedRankingService {
  async calculateScore(
    postId: string,
    userId: string,
    metadata: PostMetadata
  ): Promise<number> {
    // 1. Social Graph Score (40%)
    const socialScore = await this.calculateSocialGraphScore(
      metadata.authorId,
      userId
    );
    
    // 2. Engagement Score (35%)
    const engagementScore = await this.calculateEngagementScore(postId);
    
    // 3. Content Relevance (20%)
    const contentScore = await this.calculateContentRelevanceScore(
      userId,
      metadata
    );
    
    // 4. Temporal Score (5%)
    const temporalScore = this.calculateTemporalScore(metadata.createdAt);
    
    // Weighted combination
    const finalScore = 
      (socialScore * 0.40) +
      (engagementScore * 0.35) +
      (contentScore * 0.20) +
      (temporalScore * 0.05);
    
    return Math.min(1.0, Math.max(0.0, finalScore));
  }
  
  private async calculateSocialGraphScore(
    authorId: string,
    userId: string
  ): Promise<number> {
    // Check if user follows author
    const isFollowing = await this.userService.checkFollow(userId, authorId);
    if (isFollowing) return 1.0;
    
    // Check mutual connections
    const mutualConnections = await this.userService.getMutualConnections(
      userId,
      authorId
    );
    if (mutualConnections.length > 0) return 0.8;
    
    // Check second-degree (followers of followers)
    const secondDegree = await this.userService.checkSecondDegree(
      userId,
      authorId
    );
    if (secondDegree) return 0.6;
    
    return 0.1; // Public post from unknown user
  }
  
  // ... other calculation methods
}
```

---

### **Phase 6: Repository Layer Updates**

#### 6.1 Feed Repository (NEW)
```typescript
interface IFeedRepository {
  batchInsertFeedEntries(entries: FeedEntry[]): Promise<void>;
  getFeedEntries(userId: string, cursor?: string, limit?: number): Promise<FeedEntry[]>;
  removeFromFeeds(postId: string): Promise<void>;
  updateRelevanceScore(userId: string, postId: string, score: number): Promise<void>;
  markAsRead(userId: string, postId: string): Promise<void>;
}
```

#### 6.2 Post Repository Updates
```typescript
// Add method to get posts by IDs (for feed retrieval)
async getPostsByIds(postIds: string[]): Promise<Posts[]>;
```

---

### **Phase 7: Background Workers**

#### 7.1 Async Fan-Out Worker
```typescript
// post-service/src/workers/feed-fanout.worker.ts
export async function processFanOutJob(job: FanOutJob) {
  const { postId, authorId, followers, metadata } = job;
  
  // Process in batches of 100
  for (let i = 0; i < followers.length; i += 100) {
    const batch = followers.slice(i, i + 100);
    
    await Promise.all(
      batch.map(async (followerId) => {
        const score = await feedRankingService.calculateScore(
          postId,
          followerId,
          metadata
        );
        
        await feedRepository.insertFeedEntry({
          userId: followerId,
          postId,
          relevanceScore: score,
        });
      })
    );
  }
}
```

#### 7.2 Feed Score Recalculation Worker
```typescript
// Periodically recalculate scores for posts with recent engagement
export async function recalculateFeedScores() {
  // Find posts with recent engagement (last 24h)
  const activePosts = await postRepository.getPostsWithRecentEngagement(24);
  
  for (const post of activePosts) {
    // Get all users who have this post in their feed
    const feedEntries = await feedRepository.getFeedEntriesByPostId(post.id);
    
    // Recalculate scores
    for (const entry of feedEntries) {
      const newScore = await feedRankingService.calculateScore(
        post.id,
        entry.userId,
        postMetadata
      );
      
      await feedRepository.updateRelevanceScore(
        entry.userId,
        post.id,
        newScore
      );
    }
  }
}
```

---

### **Phase 8: API Updates**

#### 8.1 Update ListPosts Endpoint
**Before:**
```typescript
// ❌ OLD: Fetches all posts
async getPosts(pageParam?: string, userId?: string) {
  const posts = await this.postRepository.getPostsRepo({
    orderBy: { id: "desc" }, // Naive chronological
    // ...
  });
}
```

**After:**
```typescript
// ✅ NEW: Fetches personalized feed
async getPosts(pageParam?: string, userId?: string) {
  if (!userId) {
    throw new Error("User ID required for personalized feed");
  }
  
  // Fetch from UserFeed table (ranked by relevance)
  const feed = await this.feedService.getFeed(userId, pageParam, 10);
  return feed;
}
```

---

## 📊 Database Indexes (Performance)

```sql
-- UserFeed table indexes
CREATE INDEX idx_userfeed_user_score_created 
  ON user_feeds(user_id, relevance_score DESC, created_at DESC);

CREATE INDEX idx_userfeed_user_unread 
  ON user_feeds(user_id, is_read) 
  WHERE is_read = false;

CREATE INDEX idx_userfeed_score_updated 
  ON user_feeds(score_updated_at DESC);
```

---

## 🔄 Event Flow Diagram

```
Post Creation:
┌─────────────┐
│ User Creates│
│    Post     │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ Create Post in   │
│ Posts Table      │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐      ┌─────────────────┐
│ Get Followers    │─────▶│ User Service    │
│ from User Service│      │ (via gRPC)      │
└──────┬───────────┘      └─────────────────┘
       │
       ▼
┌──────────────────┐
│ Fan-out Logic    │
│ (Sync if <1000,  │
│  Async if >1000) │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐      ┌─────────────────┐
│ Calculate        │─────▶│ Feed Ranking    │
│ Relevance Scores │      │ Service         │
└──────┬───────────┘      └─────────────────┘
       │
       ▼
┌──────────────────┐
│ Insert into      │
│ UserFeed Table   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐      ┌─────────────────┐
│ Publish Event    │─────▶│ Kafka Topic:    │
│ POST_CREATED     │      │ post.created    │
└──────┬───────────┘      └─────────────────┘
       │
       ▼
┌──────────────────┐      ┌─────────────────┐
│ Notification     │─────▶│ Notification    │
│ Consumer         │      │ Service         │
└──────────────────┘      └─────────────────┘
       │
       ▼
┌──────────────────┐
│ Send Real-time   │
│ Notifications    │
│ to Followers     │
└──────────────────┘
```

---

## ✅ Implementation Checklist

### Database
- [ ] Update UserFeed table schema with relevanceScore, isRead, rankPosition
- [ ] Add indexes for feed queries
- [ ] Add POST_CREATED to OutboxEventType enum
- [ ] Run migration

### Services
- [ ] Create FeedService with fan-out logic
- [ ] Create FeedRankingService with scoring algorithm
- [ ] Create FeedRepository interface and implementation
- [ ] Update PostService.submitPost() to trigger fan-out
- [ ] Update PostService.getPosts() to use feed table
- [ ] Add batch insert methods for feed entries

### Background Workers
- [ ] Create feed-fanout.worker.ts for async fan-out
- [ ] Create feed-score-recalc.worker.ts for score updates
- [ ] Configure job queues (Bull/BullMQ)

### Notifications
- [ ] Create post.consumer.ts in notification service
- [ ] Add NEW_POST notification type
- [ ] Implement notification creation on post creation
- [ ] Add WebSocket broadcasting for real-time notifications

### API Updates
- [ ] Update listPosts endpoint to use feed service
- [ ] Update gRPC proto definitions
- [ ] Update API Gateway routes

### Caching
- [ ] Implement Redis caching for feed queries
- [ ] Cache invalidation on new posts
- [ ] Cache warming strategy

### Testing
- [ ] Unit tests for feed ranking algorithm
- [ ] Integration tests for fan-out flow
- [ ] Load tests for feed retrieval
- [ ] E2E tests for complete flow

---

## 🎯 Success Metrics

### Performance
- Feed retrieval: < 200ms (p95)
- Post creation with fan-out (< 1000 followers): < 500ms
- Post creation with fan-out (> 1000 followers): Async, < 2s
- Support 10,000+ posts/minute

### Quality
- Followers see posts from followed users first
- Relevance-based ranking working
- Notifications delivered within 1 second
- Zero data loss in fan-out process

---

## 📚 References

### LinkedIn Feed Architecture:
- Write fan-out pattern for < 10,000 followers
- Read fan-out for celebrities/influencers
- Relevance scoring based on engagement and social graph

### Facebook Feed Architecture:
- EdgeRank algorithm (predecessor to current ranking)
- Personalized feed based on user interactions
- Real-time updates via WebSockets

---

**Status**: Ready for Implementation  
**Priority**: P0 - Critical  
**Estimated Implementation Time**: 2-3 weeks  
**Breaking Changes**: Yes - Feed retrieval API will change

