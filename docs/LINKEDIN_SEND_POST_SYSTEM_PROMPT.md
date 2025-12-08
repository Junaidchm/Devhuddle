# LinkedIn-Style Send Post System - Production Implementation Prompt

## 🎯 Objective
Implement a production-ready, LinkedIn-style "Send Post" feature that allows users to send posts to their connections (people they follow) with an optional personal message. This must match LinkedIn's exact behavior, UI/UX, and follow industrial-grade engineering standards.

## 📋 Requirements

### 1. Frontend Requirements (Next.js 15)

#### 1.1 Modal Component (LinkedIn-Exact Design)
- **Modal Structure:**
  - Centered modal with backdrop overlay (backdrop-blur effect)
  - Fixed width: `max-w-lg` (512px) on desktop, full-width on mobile
  - Max height: `90vh` with proper scrolling
  - Smooth animations: fade-in backdrop, scale-in modal
  - React Portal rendering (renders to `document.body`)
  - Z-index: 9999+ to ensure it's above all content
  - Body scroll lock when modal is open

- **Header:**
  - Title: "Send [Author Name]'s Post" (dynamic based on post author)
  - Close button (X icon) in top-right corner
  - Border-bottom separator

- **Search Bar:**
  - Full-width search input with search icon on the left
  - Placeholder: "Search connections..."
  - Real-time filtering (debounced for performance)
  - Clear button appears when text is entered
  - Sticky at top of scrollable area

- **Connections List:**
  - Scrollable container (max-height with overflow-y-auto)
  - Each connection item:
    - Avatar (48x48px, rounded-full) on the left
    - Name (bold, 16px) on the right of avatar
    - Headline/job title (gray, 14px) below name
    - Checkbox on the right side (not left)
    - Hover state: light gray background
    - Selected state: blue background with checkmark
    - Smooth transitions for all states
  - Empty state: "No connections found" with helpful message
  - Loading state: Skeleton loaders (3-5 items) or spinner

- **Message Input:**
  - Label: "Write a message (optional)"
  - Textarea (3-4 rows)
  - Placeholder: "Add a personal message..."
  - Character counter: "X/500" in bottom-right
  - Auto-resize or fixed height with scroll

- **Footer:**
  - Cancel button (outlined, left-aligned)
  - Send button (primary blue, right-aligned)
  - Send button shows count: "Send (3)" when recipients selected
  - Disabled state when no recipients selected
  - Loading state: "Sending..." with spinner

#### 1.2 State Management
- Use React Query (`@tanstack/react-query`) for data fetching
- Optimistic updates (optional, but recommended)
- Proper error handling with toast notifications
- Loading states for all async operations
- Debounced search (400ms delay)

#### 1.3 Performance Optimizations
- Virtual scrolling for large connection lists (if >100 connections)
- Memoized filtered connections list
- Lazy loading of connections (pagination if needed)
- Image lazy loading for avatars
- Debounced search input

#### 1.4 Accessibility
- ARIA labels for all interactive elements
- Keyboard navigation (Tab, Enter, Escape)
- Focus trap within modal
- Screen reader announcements
- Proper semantic HTML

### 2. Backend Requirements (Microservices)

#### 2.1 API Endpoints

**GET `/api/v1/engagement/connections`**
- Returns list of users the current user follows
- Response format:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "user-id",
        "name": "John Doe",
        "username": "johndoe",
        "profilePicture": "https://...",
        "jobTitle": "Software Engineer",
        "company": "Tech Corp",
        "headline": "Software Engineer at Tech Corp"
      }
    ]
  }
  ```
- Caching: 5 minutes (Redis)
- Rate limiting: 100 requests/minute
- Error handling: 401, 403, 500

**POST `/api/v1/engagement/posts/:postId/send`**
- Request body:
  ```json
  {
    "recipientIds": ["user-id-1", "user-id-2"],
    "message": "Optional personal message"
  }
  ```
- Response:
  ```json
  {
    "success": true,
    "message": "Post sent to 2 connections",
    "data": {
      "sentTo": ["user-id-1", "user-id-2"],
      "message": "Optional message"
    }
  }
  ```
- Idempotency: Required (Idempotency-Key header)
- Rate limiting: 10 requests/minute
- Validation:
  - Post must exist
  - Recipients must be valid user IDs
  - Recipients must be connections (people user follows)
  - Message max 500 characters
  - Cannot send to yourself

#### 2.2 Service Layer
- **SendService:**
  - Validates post exists
  - Validates recipients are connections (gRPC call to auth-service)
  - Creates outbox events for notifications
  - Returns success response

- **Notification Integration:**
  - Each recipient gets a separate notification
  - Notification type: `NEW_MESSAGE`
  - Entity type: `POST`
  - Includes sender info, post preview, optional message
  - Updates unread count
  - WebSocket broadcast for real-time notifications

#### 2.3 Error Handling
- Custom error classes with proper HTTP status codes
- Detailed error messages for debugging
- Logging for all operations
- Retry logic for external service calls (exponential backoff)
- Graceful degradation

#### 2.4 Database
- No new tables needed (uses existing Follow, NotificationObject tables)
- Efficient queries with proper indexes
- Connection validation via Follow table

### 3. Integration Points

#### 3.1 Auth Service
- gRPC call to validate recipients are connections
- Or HTTP call to `/api/v1/users/:username/following`
- Caching of connection list (5 minutes)

#### 3.2 Notification Service
- Kafka event: `POST_SENT`
- Event payload includes:
  - `postId`
  - `senderId`
  - `recipientId`
  - `message` (optional)
  - `postAuthorId`
  - `postContent` (preview, first 200 chars)

#### 3.3 API Gateway
- Routes `/api/v1/engagement/connections` → post-service
- Routes `/api/v1/engagement/posts/:postId/send` → post-service
- JWT authentication required
- Rate limiting middleware

### 4. Testing Requirements

#### 4.1 Unit Tests
- Connection filtering logic
- Search functionality
- State management
- Error handling

#### 4.2 Integration Tests
- API endpoint tests
- Service layer tests
- Notification creation tests

#### 4.3 E2E Tests
- Open modal
- Search connections
- Select recipients
- Add message
- Send post
- Verify notification received

### 5. Code Quality Standards

#### 5.1 TypeScript
- Strict type checking
- No `any` types
- Proper interfaces for all data structures
- Type-safe API calls

#### 5.2 Code Organization
- Clean architecture (separation of concerns)
- Reusable components
- Custom hooks for business logic
- Service layer for API calls

#### 5.3 Documentation
- JSDoc comments for all functions
- README for feature
- API documentation
- Component prop documentation

### 6. Security

- Input sanitization (XSS prevention)
- Content length validation
- Rate limiting
- Idempotency keys
- Authentication required
- Authorization checks (can only send to connections)

### 7. Performance Metrics

- Modal open time: < 100ms
- Connection list load: < 500ms
- Search response: < 200ms (debounced)
- Send operation: < 1s
- Notification delivery: < 2s

### 8. LinkedIn-Specific Behaviors

- Modal opens from center with smooth animation
- Search is instant and responsive
- Selected recipients show checkmark
- Send button updates with count
- Success toast notification
- Modal closes after successful send
- Error handling with user-friendly messages
- Loading states for all async operations

## 🚀 Implementation Checklist

- [ ] Create LinkedIn-style modal component
- [ ] Implement connection fetching hook
- [ ] Add search functionality with debouncing
- [ ] Implement recipient selection
- [ ] Add message input with character counter
- [ ] Create send post API endpoint
- [ ] Integrate with notification service
- [ ] Add error handling and loading states
- [ ] Implement accessibility features
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Performance optimization
- [ ] Documentation

## 📝 Notes

- Follow Next.js 15 App Router patterns
- Use React Server Components where possible
- Client components only when needed (interactivity)
- Proper error boundaries
- Logging for debugging
- Monitoring hooks for production

