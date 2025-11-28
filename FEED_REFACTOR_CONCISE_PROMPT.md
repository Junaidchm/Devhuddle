# Feed System Refactoring - Concise Prompt

## Objective

Refactor the post feed system from a naive chronological fetch to an industry-standard, personalized feed architecture similar to LinkedIn, Facebook, and Twitter.

## Current Problems

- Posts fetched in reverse chronological order without personalization
- No consideration of user follows, interests, or engagement
- No feed pre-computation or caching
- Missing fan-out pattern for post creation
- Poor scalability and performance

## Required Implementation

### 1. Feed Generation Pattern (Fan-out)

**Write Fan-out**: When a user creates a post, pre-compute and store it in all followers' feeds
- For users with < 1000 followers: Synchronous write fan-out
- For users with > 1000 followers: Asynchronous queue-based processing

**Feed Storage**: Create a user feed table that stores:
- Post references with relevance scores
- Timestamps and metadata
- Efficient indexing for fast retrieval

### 2. Personalized Feed Ranking

Implement relevance scoring considering:

**Priority Order:**
1. **Social Graph** (40% weight):
   - Posts from directly followed users
   - Posts from second-degree connections
   - Posts from users with mutual connections

2. **Engagement Signals** (35% weight):
   - Recent likes, comments, shares
   - Engagement velocity (activity spikes)
   - Relative engagement rate

3. **Content Relevance** (20% weight):
   - Matching hashtags/interests
   - Content type preferences
   - Topic affinity from interaction history

4. **Temporal Factors** (5% weight):
   - Post recency
   - Time decay for older posts

### 3. Post Creation Flow

```
1. Create post in posts table
2. Extract metadata (hashtags, mentions, content type)
3. Fan-out to followers:
   - Get all active followers
   - Calculate initial relevance scores
   - Insert into follower feed tables
4. Publish events for notifications/analytics
```

### 4. Feed Retrieval Flow

```
1. Fetch pre-computed feed entries (ranked by score)
2. Apply real-time filters:
   - Exclude blocked users
   - Respect privacy settings
   - Apply content moderation
3. Merge recent posts from followed users (if not in pre-computed feed)
4. Return paginated results with cursor
5. Cache top N posts for subsequent requests
```

### 5. Technical Requirements

**Database:**
- User feed table with indexes on (userId, score, createdAt)
- Efficient queries for feed retrieval
- Support for batch operations

**Caching:**
- Redis cache for user feeds (top 50 posts)
- Cache invalidation on new posts
- TTL-based expiration

**Performance:**
- Feed retrieval: < 200ms (p95)
- Post creation with fan-out: < 500ms (p95)
- Support 10,000+ posts/minute

**Architecture:**
- Event-driven updates
- Async processing for heavy operations
- Retry mechanisms for failed fan-outs
- Idempotent operations

### 6. Code Structure

```
post-service/
├── src/
│   ├── services/
│   │   ├── feed.service.ts          # Feed generation & ranking
│   │   ├── feed-ranking.service.ts  # Relevance scoring
│   │   └── post.service.ts          # Updated with fan-out
│   ├── repositories/
│   │   ├── feed.repository.ts       # Feed CRUD operations
│   │   └── post.repository.ts       # Updated post operations
│   ├── workers/
│   │   └── feed-fanout.worker.ts    # Async fan-out processing
│   └── events/
│       └── feed.events.ts           # Feed update events
```

## Implementation Checklist

- [ ] Create `UserFeed` table schema (userId, postId, score, createdAt, metadata)
- [ ] Implement `FeedRepository` with feed CRUD operations
- [ ] Build `FeedService` with fan-out logic
- [ ] Create `FeedRankingService` with relevance scoring
- [ ] Update `PostService.submitPost()` to trigger fan-out
- [ ] Refactor `PostService.getPosts()` to use feed table
- [ ] Implement Redis caching layer
- [ ] Add async worker for high-follower fan-out
- [ ] Create event handlers for feed updates
- [ ] Add database indexes for performance
- [ ] Implement cursor-based pagination
- [ ] Add comprehensive error handling and logging
- [ ] Write unit and integration tests

## Success Metrics

- ✅ Feed shows posts from followed users first
- ✅ Feed retrieval < 200ms for 95% of requests
- ✅ System handles 10,000+ posts/minute
- ✅ Personalized and engaging user experience
- ✅ Clean, maintainable, well-documented code

## Industry References

- Twitter Timeline Architecture
- LinkedIn Feed Ranking System
- Facebook News Feed Algorithm
- Instagram Feed Generation

---

**Start with Phase 1 (Core Infrastructure) and iterate. Maintain backward compatibility during migration.**

