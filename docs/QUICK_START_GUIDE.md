# Quick Start Guide - New Post Features

## 🚀 Getting Started

### 1. Backend Setup

#### Generate gRPC Types
```bash
cd post-service
npm run generate:proto
# or your custom proto generation command
```

#### Run Database Migrations
```bash
cd post-service
npx prisma migrate dev --name add_post_features
```

#### Verify Services Are Running
- ✅ Post Service
- ✅ API Gateway
- ✅ Redis
- ✅ Kafka
- ✅ PostgreSQL

### 2. Frontend Setup

No additional setup needed! All components are ready to use.

---

## 📖 Usage Examples

### Report a Post

```tsx
import ReportPostModal from "@/src/components/feed/feedEditor/ReportPostModal";

<ReportPostModal
  isOpen={showReport}
  onClose={() => setShowReport(false)}
  postId="post-123"
  targetType="POST"
/>
```

### Share a Post

```tsx
import SharePostModal from "@/src/components/feed/feedEditor/SharePostModal";

<SharePostModal
  isOpen={showShare}
  onClose={() => setShowShare(false)}
  postId="post-123"
/>
```

### Edit a Post

```tsx
import EditPostModal from "@/src/components/feed/feedEditor/EditPostModal";

<EditPostModal
  isOpen={showEdit}
  onClose={() => setShowEdit(false)}
  post={postObject}
/>
```

### Copy Post Link

```tsx
import { useCopyPostLink } from "@/src/components/feed/feedEditor/Hooks/useCopyPostLink";

const copyLink = useCopyPostLink();

// In your component
await copyLink.mutateAsync({
  postId: "post-123",
  generateShort: true,
});
```

---

## 🎯 Feature Access Points

All features are accessible via the **post menu** (three dots) in `PostIntract`:

1. **Copy Link** - Available for all posts
2. **Edit Post** - Only visible for own posts
3. **Report Post** - Only visible for others' posts
4. **Share** - Available via the share button

---

## 🔧 API Endpoints

### Report Post
```
POST /api/v1/engagement/posts/:postId/report
Body: { reason: "SPAM", description?: "..." }
```

### Share Post
```
POST /api/v1/engagement/posts/:postId/share
Body: { 
  shareType: "TO_FEED",
  caption?: "...",
  visibility?: "PUBLIC"
}
```

### Get Share Link
```
GET /api/v1/engagement/posts/:postId/share-link?generateShort=true
```

### Edit Post
```
PATCH /api/v1/feed/posts/:postId
Body: {
  content?: "...",
  addAttachmentIds?: ["..."],
  removeAttachmentIds?: ["..."]
}
```

### Get Versions
```
GET /api/v1/feed/posts/:postId/versions
```

### Restore Version
```
POST /api/v1/feed/posts/:postId/versions/:versionNumber/restore
```

---

## 🧪 Testing Checklist

### Report Feature
- [ ] Report a post with different reasons
- [ ] Add optional description
- [ ] Test rate limiting (try 6 reports)
- [ ] Verify error messages

### Share Feature
- [ ] Share to feed
- [ ] Share with quote
- [ ] Share privately (if user search implemented)
- [ ] Verify share count updates

### Copy Link
- [ ] Generate short link
- [ ] Copy to clipboard
- [ ] Verify link works when clicked

### Edit Post
- [ ] Edit post content
- [ ] Remove attachments
- [ ] View version history
- [ ] Restore a version

---

## 🐛 Troubleshooting

### Issue: "Post is currently being edited"
**Solution**: Wait a few seconds and try again. The lock expires after 5 minutes.

### Issue: "Daily report limit exceeded"
**Solution**: You've reached the 5 reports/day limit. Try again tomorrow.

### Issue: "Cannot share private post publicly"
**Solution**: You're trying to share a private post publicly. Choose "Connections Only" visibility.

### Issue: gRPC errors
**Solution**: Make sure proto files are regenerated after schema changes.

---

## 📚 Documentation Files

- `PRODUCTION_POST_FEATURES_IMPLEMENTATION_PROMPT.md` - Original requirements
- `POST_FEATURES_IMPLEMENTATION_STATUS.md` - Backend status
- `FRONTEND_IMPLEMENTATION_STATUS.md` - Frontend status
- `IMPLEMENTATION_COMPLETE.md` - Complete feature breakdown
- `FINAL_IMPLEMENTATION_SUMMARY.md` - Final summary

---

## ✅ Everything is Ready!

All features are implemented and ready to use. Just run the migrations and generate proto files, then you're good to go! 🎉

