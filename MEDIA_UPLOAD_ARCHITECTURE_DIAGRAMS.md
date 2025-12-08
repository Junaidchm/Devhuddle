# Media Upload Architecture - Mermaid Diagrams

This file contains all Mermaid diagrams for the new media upload architecture. You can view these diagrams in:
- GitHub (renders Mermaid automatically)
- VS Code with Mermaid extension
- Online: https://mermaid.live
- Documentation tools that support Mermaid

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        MOBILE[Mobile App]
    end

    subgraph "API Gateway"
        GATEWAY[API Gateway<br/>Authentication<br/>Rate Limiting<br/>Routing]
    end

    subgraph "Microservices"
        MEDIA_SVC[Media Service<br/>Upload Sessions<br/>Media Management<br/>Processing Jobs]
        POST_SVC[Post Service<br/>Post Creation<br/>Media Linking]
        AUTH_SVC[Auth Service<br/>User Management<br/>Profile Images]
    end

    subgraph "Storage Layer"
        S3[(S3/R2 Storage<br/>Original Files<br/>Thumbnails<br/>Transcoded Videos)]
        CDN[CDN<br/>CloudFront/R2 CDN<br/>Edge Caching<br/>Global Distribution]
    end

    subgraph "Processing Layer"
        QUEUE[Message Queue<br/>RabbitMQ/Kafka<br/>Job Queue]
        WORKER[Worker Service<br/>Thumbnail Generation<br/>Video Transcoding<br/>Image Optimization]
    end

    subgraph "Database Layer"
        MEDIA_DB[(Media Database<br/>Media Records<br/>Metadata<br/>Status Tracking)]
        POST_DB[(Post Database<br/>Posts<br/>Media Links)]
        AUTH_DB[(Auth Database<br/>Users<br/>Profile Images)]
    end

    WEB -->|HTTPS| GATEWAY
    MOBILE -->|HTTPS| GATEWAY
    
    GATEWAY -->|/api/v1/media/*| MEDIA_SVC
    GATEWAY -->|/api/v1/posts/*| POST_SVC
    GATEWAY -->|/api/v1/auth/*| AUTH_SVC

    MEDIA_SVC -->|Generate Presigned URLs| S3
    MEDIA_SVC -->|Store Metadata| MEDIA_DB
    MEDIA_SVC -->|Queue Jobs| QUEUE
    MEDIA_SVC -->|Link Media| POST_SVC

    POST_SVC -->|Store Posts| POST_DB
    POST_SVC -->|Validate Media| MEDIA_SVC

    AUTH_SVC -->|Profile Images| S3
    AUTH_SVC -->|User Data| AUTH_DB

    WEB -->|Direct Upload<br/>Presigned URL| S3
    MOBILE -->|Direct Upload<br/>Presigned URL| S3

    S3 -->|Serve via| CDN
    CDN -->|Cached Content| WEB
    CDN -->|Cached Content| MOBILE

    QUEUE -->|Process Jobs| WORKER
    WORKER -->|Read/Write| S3
    WORKER -->|Update Status| MEDIA_DB

    style MEDIA_SVC fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style S3 fill:#FF9900,stroke:#CC7700,color:#fff
    style CDN fill:#00A8E8,stroke:#0077A3,color:#fff
    style QUEUE fill:#FF6B6B,stroke:#CC5555,color:#fff
    style WORKER fill:#51CF66,stroke:#2F9E44,color:#fff
```

---

## 2. Detailed Upload Flow Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Client as Client App
    participant Gateway as API Gateway
    participant MediaSvc as Media Service
    participant Storage as S3/R2 Storage
    participant DB as Media Database
    participant Queue as Message Queue
    participant Worker as Worker Service
    participant CDN as CDN

    Note over User,CDN: Phase 1: Upload Session Request

    User->>Client: Select File(s)
    Client->>Client: Validate File<br/>(size, type, dimensions)
    
    Client->>Gateway: POST /api/v1/media/upload-session<br/>{fileName, fileType, fileSize, mediaType}
    Gateway->>Gateway: Authenticate User<br/>Extract User ID
    Gateway->>MediaSvc: Forward Request + User ID
    
    MediaSvc->>MediaSvc: Validate Request<br/>(file type, size limits, permissions)
    MediaSvc->>MediaSvc: Generate Storage Key<br/>{mediaType}/{userId}/{timestamp}-{uuid}.{ext}
    MediaSvc->>Storage: Generate Presigned PUT URL<br/>(expires: 15 minutes)
    Storage-->>MediaSvc: Presigned URL
    MediaSvc->>DB: Create Media Record<br/>(status: PENDING, storageKey)
    DB-->>MediaSvc: Media ID
    MediaSvc-->>Gateway: {uploadUrl, mediaId, expiresAt, storageKey}
    Gateway-->>Client: {uploadUrl, mediaId, expiresAt}

    Note over User,CDN: Phase 2: Direct Upload to Storage

    Client->>Client: Prepare Upload<br/>(track progress)
    Client->>Storage: PUT {presignedUrl}<br/>Headers: Content-Type, Content-Length<br/>Body: File Binary
    Storage-->>Client: 200 OK
    
    Note over User,CDN: Phase 3: Upload Confirmation

    Client->>Gateway: POST /api/v1/media/{mediaId}/complete
    Gateway->>MediaSvc: Forward Request
    MediaSvc->>Storage: HEAD Request<br/>(verify file exists)
    Storage-->>MediaSvc: File Metadata<br/>(size, etag)
    MediaSvc->>MediaSvc: Verify File Integrity
    MediaSvc->>DB: Update Media Record<br/>(status: UPLOADED, cdnUrl, originalUrl)
    MediaSvc->>Queue: Queue Processing Job<br/>(thumbnail/transcoding)
    MediaSvc-->>Gateway: {mediaId, cdnUrl, status: UPLOADED}
    Gateway-->>Client: {mediaId, cdnUrl, status: UPLOADED}

    Note over User,CDN: Phase 4: Background Processing

    Queue->>Worker: Processing Job<br/>{mediaId, storageKey, mediaType}
    Worker->>Storage: Download Original File
    Storage-->>Worker: File Binary
    
    alt Image Processing
        Worker->>Worker: Generate Thumbnails<br/>(150x150, 300x300, 600x600, 1200x1200)
        Worker->>Worker: Optimize Image<br/>(WebP, compression)
        Worker->>Storage: Upload Thumbnails<br/>(thumbnails/{key}/{size}.webp)
        Worker->>DB: Update Media Record<br/>(thumbnailUrls, optimizedUrl)
    else Video Processing
        Worker->>Worker: Extract Thumbnail<br/>(frame at 10% duration)
        Worker->>Worker: Transcode Video<br/>(360p, 720p, 1080p)
        Worker->>Worker: Generate HLS Manifest
        Worker->>Storage: Upload Transcoded Files<br/>(transcoded/{key}/{quality}.mp4)
        Worker->>Storage: Upload HLS Manifest<br/>(transcoded/{key}/manifest.m3u8)
        Worker->>DB: Update Media Record<br/>(transcodedUrls, thumbnailUrl, hlsUrl)
    end
    
    Worker->>DB: Update Media Record<br/>(status: READY)
    Worker-->>Queue: Job Complete

    Note over User,CDN: Phase 5: CDN Serving

    Client->>CDN: GET {cdnUrl}/media/{mediaType}/{key}
    CDN->>CDN: Check Cache
    
    alt Cache Hit
        CDN-->>Client: Cached File (Fast)
    else Cache Miss
        CDN->>Storage: Fetch File
        Storage-->>CDN: File Binary
        CDN->>CDN: Cache File
        CDN-->>Client: File (Slower)
    end
```

---

## 3. Processing Pipeline Architecture

```mermaid
graph LR
    subgraph "Upload Completion"
        UPLOAD[File Uploaded<br/>Status: UPLOADED]
    end

    subgraph "Job Queue"
        IMAGE_QUEUE[Image Processing Queue<br/>Priority: High]
        VIDEO_QUEUE[Video Processing Queue<br/>Priority: Medium]
        THUMB_QUEUE[Thumbnail Queue<br/>Priority: High]
    end

    subgraph "Worker Pool"
        IMAGE_WORKER[Image Worker<br/>Sharp/ImageMagick<br/>- Thumbnails<br/>- Optimization<br/>- Format Conversion]
        VIDEO_WORKER[Video Worker<br/>FFmpeg<br/>- Transcoding<br/>- Thumbnail Extraction<br/>- HLS Generation]
    end

    subgraph "Storage"
        ORIGINAL[(Original Files)]
        THUMBS[(Thumbnails)]
        TRANSCODED[(Transcoded Videos)]
    end

    subgraph "Database"
        MEDIA_DB[(Media DB<br/>Status Updates)]
    end

    subgraph "Retry & Error Handling"
        RETRY[Retry Queue<br/>Exponential Backoff]
        DLQ[Dead Letter Queue<br/>Failed Jobs]
    end

    UPLOAD -->|Queue Job| IMAGE_QUEUE
    UPLOAD -->|Queue Job| VIDEO_QUEUE

    IMAGE_QUEUE -->|Process| IMAGE_WORKER
    VIDEO_QUEUE -->|Process| VIDEO_WORKER

    IMAGE_WORKER -->|Read| ORIGINAL
    IMAGE_WORKER -->|Write| THUMBS
    IMAGE_WORKER -->|Update| MEDIA_DB

    VIDEO_WORKER -->|Read| ORIGINAL
    VIDEO_WORKER -->|Write| TRANSCODED
    VIDEO_WORKER -->|Write| THUMBS
    VIDEO_WORKER -->|Update| MEDIA_DB

    IMAGE_WORKER -->|On Failure| RETRY
    VIDEO_WORKER -->|On Failure| RETRY
    RETRY -->|Max Retries| DLQ
    RETRY -->|Retry| IMAGE_QUEUE
    RETRY -->|Retry| VIDEO_QUEUE

    style IMAGE_WORKER fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style VIDEO_WORKER fill:#FF9900,stroke:#CC7700,color:#fff
    style RETRY fill:#FF6B6B,stroke:#CC5555,color:#fff
    style DLQ fill:#8E44AD,stroke:#6C3483,color:#fff
```

---

## 4. Component Architecture - Media Service

```mermaid
graph TB
    subgraph "Media Service - Controllers"
        UPLOAD_CTRL[Upload Controller<br/>POST /upload-session<br/>POST /:id/complete<br/>GET /:id/status]
        MEDIA_CTRL[Media Controller<br/>GET /:id<br/>DELETE /:id<br/>GET /user/:userId]
        PROCESS_CTRL[Processing Controller<br/>GET /:id/processing-status<br/>POST /:id/retry-processing]
    end

    subgraph "Media Service - Services"
        PRESIGNED_SVC[Presigned URL Service<br/>- Generate PUT URLs<br/>- Validate Requests<br/>- Set Expiration]
        STORAGE_SVC[Storage Service<br/>- S3/R2 Client<br/>- File Operations<br/>- Multipart Upload]
        MEDIA_SVC[Media Service<br/>- Business Logic<br/>- Validation<br/>- Status Management]
        PROCESSING_SVC[Processing Service<br/>- Queue Jobs<br/>- Track Status<br/>- Handle Retries]
    end

    subgraph "Media Service - Repositories"
        MEDIA_REPO[Media Repository<br/>- CRUD Operations<br/>- Query Media<br/>- Update Status]
    end

    subgraph "Media Service - Jobs"
        THUMB_JOB[Thumbnail Job<br/>- Generate Sizes<br/>- Optimize Images]
        TRANSCODE_JOB[Transcode Job<br/>- Video Processing<br/>- HLS Generation]
    end

    subgraph "External Services"
        S3[(S3/R2 Storage)]
        QUEUE[Message Queue]
        DB[(Media Database)]
    end

    UPLOAD_CTRL --> PRESIGNED_SVC
    UPLOAD_CTRL --> MEDIA_SVC
    UPLOAD_CTRL --> STORAGE_SVC

    MEDIA_CTRL --> MEDIA_SVC
    PROCESS_CTRL --> PROCESSING_SVC

    PRESIGNED_SVC --> STORAGE_SVC
    MEDIA_SVC --> MEDIA_REPO
    PROCESSING_SVC --> QUEUE

    STORAGE_SVC --> S3
    MEDIA_REPO --> DB

    QUEUE --> THUMB_JOB
    QUEUE --> TRANSCODE_JOB

    THUMB_JOB --> STORAGE_SVC
    THUMB_JOB --> MEDIA_REPO
    TRANSCODE_JOB --> STORAGE_SVC
    TRANSCODE_JOB --> MEDIA_REPO

    style UPLOAD_CTRL fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style PRESIGNED_SVC fill:#51CF66,stroke:#2F9E44,color:#fff
    style STORAGE_SVC fill:#FF9900,stroke:#CC7700,color:#fff
    style PROCESSING_SVC fill:#FF6B6B,stroke:#CC5555,color:#fff
```

---

## 5. Database Schema Relationships

```mermaid
erDiagram
    USERS ||--o{ MEDIA : uploads
    USERS ||--o{ POSTS : creates
    MEDIA ||--o| POSTS : "attached to"
    MEDIA ||--o{ MEDIA_THUMBNAILS : "has thumbnails"
    MEDIA ||--o{ VIDEO_QUALITIES : "has qualities"

    USERS {
        uuid id PK
        string email
        string username
        string profile_image_key
        timestamp created_at
    }

    MEDIA {
        uuid id PK
        uuid user_id FK
        uuid post_id FK "nullable"
        string media_type "POST_IMAGE, POST_VIDEO, PROFILE_IMAGE"
        string storage_key
        string cdn_url
        string original_url
        string file_name
        bigint file_size
        string mime_type
        int width "nullable"
        int height "nullable"
        int duration "nullable"
        string status "PENDING, UPLOADED, PROCESSING, READY, FAILED"
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }

    MEDIA_THUMBNAILS {
        uuid id PK
        uuid media_id FK
        string size "150x150, 300x300, 600x600, 1200x1200"
        string storage_key
        string cdn_url
        int width
        int height
        timestamp created_at
    }

    VIDEO_QUALITIES {
        uuid id PK
        uuid media_id FK
        string quality "360p, 720p, 1080p, 4K"
        string storage_key
        string cdn_url
        string hls_manifest_url
        int bitrate
        int width
        int height
        timestamp created_at
    }

    POSTS {
        uuid id PK
        uuid user_id FK
        string content
        string visibility
        string comment_control
        timestamp created_at
        timestamp updated_at
    }

    POST_MEDIA {
        uuid post_id FK
        uuid media_id FK
        int order_index
        timestamp created_at
    }
```

---

## 6. Complete Upload Flow with Error Handling

```mermaid
flowchart TD
    START([User Selects File]) --> VALIDATE{Validate File<br/>Client-Side}
    VALIDATE -->|Invalid| ERROR1[Show Error<br/>File too large/type]
    VALIDATE -->|Valid| REQUEST[Request Upload Session<br/>POST /api/v1/media/upload-session]

    REQUEST --> AUTH{Authenticated?}
    AUTH -->|No| ERROR2[401 Unauthorized]
    AUTH -->|Yes| VALIDATE_SERVER{Server Validation}
    
    VALIDATE_SERVER -->|Invalid| ERROR3[400 Bad Request<br/>Invalid file type/size]
    VALIDATE_SERVER -->|Valid| GENERATE[Generate Presigned URL<br/>Create Media Record<br/>Status: PENDING]

    GENERATE --> UPLOAD[Upload to S3/R2<br/>Direct PUT Request]
    
    UPLOAD --> PROGRESS{Upload Progress}
    PROGRESS -->|In Progress| PROGRESS
    PROGRESS -->|Network Error| RETRY1{Retry Count < 3?}
    RETRY1 -->|Yes| UPLOAD
    RETRY1 -->|No| ERROR4[Upload Failed<br/>Show Error to User]

    PROGRESS -->|Success| VERIFY[Verify Upload<br/>POST /api/v1/media/:id/complete]
    
    VERIFY --> CHECK{File Exists?}
    CHECK -->|No| ERROR5[Upload Verification Failed]
    CHECK -->|Yes| UPDATE[Update Media Record<br/>Status: UPLOADED<br/>Store CDN URL]

    UPDATE --> QUEUE[Queue Processing Job]
    QUEUE --> RETURN[Return Media ID + CDN URL<br/>to Client]

    RETURN --> POLL{Processing Complete?}
    POLL -->|No| WAIT[Wait 2 seconds]
    WAIT --> POLL
    POLL -->|Yes| READY[Media Ready<br/>Status: READY<br/>Thumbnails/Transcoding Complete]

    ERROR1 --> END([End])
    ERROR2 --> END
    ERROR3 --> END
    ERROR4 --> END
    ERROR5 --> END
    READY --> END

    style START fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style UPLOAD fill:#51CF66,stroke:#2F9E44,color:#fff
    style READY fill:#51CF66,stroke:#2F9E44,color:#fff
    style ERROR1 fill:#FF6B6B,stroke:#CC5555,color:#fff
    style ERROR2 fill:#FF6B6B,stroke:#CC5555,color:#fff
    style ERROR3 fill:#FF6B6B,stroke:#CC5555,color:#fff
    style ERROR4 fill:#FF6B6B,stroke:#CC5555,color:#fff
    style ERROR5 fill:#FF6B6B,stroke:#CC5555,color:#fff
```

---

## 7. Multipart Upload Flow (Large Files > 5MB)

```mermaid
sequenceDiagram
    participant Client
    participant MediaSvc as Media Service
    participant Storage as S3/R2 Storage
    participant DB as Database

    Note over Client,DB: Phase 1: Initialize Multipart Upload

    Client->>MediaSvc: POST /api/v1/media/upload-session<br/>{fileName, fileSize: 50MB, fileType}
    MediaSvc->>MediaSvc: Detect Large File<br/>(> 5MB)
    MediaSvc->>Storage: CreateMultipartUpload<br/>(storageKey, contentType)
    Storage-->>MediaSvc: {uploadId, storageKey}
    MediaSvc->>DB: Create Media Record<br/>(status: PENDING, uploadId)
    MediaSvc-->>Client: {uploadId, mediaId, partSize: 5MB, totalParts: 10}

    Note over Client,DB: Phase 2: Upload Parts in Parallel

    par Part 1
        Client->>Storage: UploadPart 1<br/>(uploadId, partNumber: 1, data: 0-5MB)
        Storage-->>Client: {etag: "part1-etag"}
    and Part 2
        Client->>Storage: UploadPart 2<br/>(uploadId, partNumber: 2, data: 5-10MB)
        Storage-->>Client: {etag: "part2-etag"}
    and Part 3-10
        Client->>Storage: UploadPart N<br/>(uploadId, partNumber: N, data: ...)
        Storage-->>Client: {etag: "partN-etag"}
    end

    Note over Client,DB: Phase 3: Complete Multipart Upload

    Client->>MediaSvc: POST /api/v1/media/{mediaId}/complete-multipart<br/>{uploadId, parts: [{partNumber, etag}]}
    MediaSvc->>Storage: CompleteMultipartUpload<br/>(uploadId, parts)
    Storage-->>MediaSvc: {location: "final-url", etag}
    MediaSvc->>DB: Update Media Record<br/>(status: UPLOADED, cdnUrl)
    MediaSvc-->>Client: {mediaId, cdnUrl, status: UPLOADED}

    Note over Client,DB: Phase 4: Handle Failures

    alt Part Upload Fails
        Client->>Storage: UploadPart (Retry)
        Storage-->>Client: {etag}
    else Complete Fails
        Client->>Storage: AbortMultipartUpload<br/>(uploadId)
        Storage-->>Client: Aborted
        Client->>MediaSvc: POST /api/v1/media/{mediaId}/cancel
        MediaSvc->>DB: Update Status: FAILED
    end
```

---

## 8. CDN and Caching Strategy

```mermaid
graph TB
    subgraph "Client Requests"
        WEB[Web Browser]
        MOBILE[Mobile App]
    end

    subgraph "CDN Layer"
        EDGE1[Edge Location 1<br/>US East]
        EDGE2[Edge Location 2<br/>EU West]
        EDGE3[Edge Location 3<br/>Asia Pacific]
    end

    subgraph "CDN Cache"
        CACHE[CDN Cache<br/>- Images: 1 year<br/>- Videos: 30 days<br/>- Thumbnails: 1 year<br/>- Manifests: 1 hour]
    end

    subgraph "Origin Storage"
        S3[(S3/R2 Bucket<br/>Original Files)]
    end

    subgraph "Cache Invalidation"
        INVALIDATE[Invalidation Service<br/>- On Delete<br/>- On Update<br/>- Manual Purge]
    end

    WEB -->|Request Image/Video| EDGE1
    MOBILE -->|Request Image/Video| EDGE2
    WEB -->|Request Image/Video| EDGE3

    EDGE1 -->|Check Cache| CACHE
    EDGE2 -->|Check Cache| CACHE
    EDGE3 -->|Check Cache| CACHE

    CACHE -->|Cache Hit| EDGE1
    CACHE -->|Cache Hit| EDGE2
    CACHE -->|Cache Hit| EDGE3

    CACHE -->|Cache Miss| S3
    S3 -->|Fetch File| CACHE
    CACHE -->|Store & Serve| EDGE1
    CACHE -->|Store & Serve| EDGE2
    CACHE -->|Store & Serve| EDGE3

    EDGE1 -->|Serve| WEB
    EDGE2 -->|Serve| MOBILE
    EDGE3 -->|Serve| WEB

    INVALIDATE -->|Purge Cache| CACHE

    style CACHE fill:#00A8E8,stroke:#0077A3,color:#fff
    style S3 fill:#FF9900,stroke:#CC7700,color:#fff
    style INVALIDATE fill:#FF6B6B,stroke:#CC5555,color:#fff
```

---

## 9. Security and Access Control Flow

```mermaid
graph TB
    subgraph "Request Flow"
        CLIENT[Client Request]
        GATEWAY[API Gateway]
        AUTH[Auth Middleware]
    end

    subgraph "Authorization Checks"
        JWT_CHECK{JWT Valid?}
        USER_CHECK{User Exists?}
        PERMISSION_CHECK{Has Permission?}
        RATE_CHECK{Rate Limit OK?}
    end

    subgraph "Presigned URL Generation"
        VALIDATE[Validate Request<br/>- File Type<br/>- File Size<br/>- User Tier]
        GENERATE[Generate Presigned URL<br/>- User-specific Key<br/>- Short Expiration<br/>- Content-Type Restriction]
    end

    subgraph "Storage Access"
        S3_ACCESS[S3/R2 Access<br/>- Presigned URL Only<br/>- No Direct Access<br/>- CORS Configured]
    end

    CLIENT --> GATEWAY
    GATEWAY --> AUTH
    AUTH --> JWT_CHECK
    
    JWT_CHECK -->|Invalid| REJECT1[401 Unauthorized]
    JWT_CHECK -->|Valid| USER_CHECK
    
    USER_CHECK -->|Not Found| REJECT2[404 User Not Found]
    USER_CHECK -->|Exists| PERMISSION_CHECK
    
    PERMISSION_CHECK -->|No Permission| REJECT3[403 Forbidden]
    PERMISSION_CHECK -->|Has Permission| RATE_CHECK
    
    RATE_CHECK -->|Exceeded| REJECT4[429 Too Many Requests]
    RATE_CHECK -->|OK| VALIDATE
    
    VALIDATE -->|Invalid| REJECT5[400 Bad Request]
    VALIDATE -->|Valid| GENERATE
    
    GENERATE --> S3_ACCESS
    S3_ACCESS -->|Presigned URL| CLIENT
    
    CLIENT -->|Direct Upload| S3_ACCESS
    S3_ACCESS -->|Verify| GENERATE

    style REJECT1 fill:#FF6B6B,stroke:#CC5555,color:#fff
    style REJECT2 fill:#FF6B6B,stroke:#CC5555,color:#fff
    style REJECT3 fill:#FF6B6B,stroke:#CC5555,color:#fff
    style REJECT4 fill:#FF6B6B,stroke:#CC5555,color:#fff
    style REJECT5 fill:#FF6B6B,stroke:#CC5555,color:#fff
    style GENERATE fill:#51CF66,stroke:#2F9E44,color:#fff
```

---

## 10. Media Lifecycle Management

```mermaid
stateDiagram-v2
    [*] --> PENDING: User Requests Upload Session
    
    PENDING --> UPLOADING: Client Starts Upload
    UPLOADING --> UPLOADED: Upload Completes
    UPLOADING --> FAILED: Upload Fails (Max Retries)
    
    UPLOADED --> PROCESSING: Queue Processing Job
    PROCESSING --> READY: Processing Complete
    PROCESSING --> FAILED: Processing Fails (Max Retries)
    
    READY --> ATTACHED: Linked to Post
    READY --> UNUSED: Not Linked (24h+)
    
    ATTACHED --> DELETED: Post Deleted
    UNUSED --> DELETED: Cleanup Job
    
    FAILED --> RETRY: Manual Retry
    RETRY --> PROCESSING
    
    DELETED --> [*]: Removed from Storage & DB
    
    note right of PENDING
        Media record created
        Presigned URL generated
    end note
    
    note right of UPLOADED
        File verified in storage
        CDN URL generated
    end note
    
    note right of READY
        Thumbnails generated
        Video transcoded (if applicable)
    end note
    
    note right of UNUSED
        Orphaned media
        Scheduled for deletion
    end note
```

---

## How to Use These Diagrams

1. **View in GitHub**: These diagrams will render automatically when you push to GitHub
2. **View in VS Code**: Install the "Markdown Preview Mermaid Support" extension
3. **View Online**: Copy any diagram code to https://mermaid.live
4. **Export as Image**: Use mermaid-cli or online tools to export as PNG/SVG
5. **Include in Documentation**: These work in most Markdown renderers that support Mermaid

## Diagram Index

1. **High-Level System Architecture** - Overall system components and connections
2. **Detailed Upload Flow Sequence** - Step-by-step upload process with all services
3. **Processing Pipeline Architecture** - Background job processing flow
4. **Component Architecture** - Media Service internal structure
5. **Database Schema Relationships** - ER diagram of media-related tables
6. **Complete Upload Flow with Error Handling** - Flowchart with all error paths
7. **Multipart Upload Flow** - Large file upload sequence
8. **CDN and Caching Strategy** - CDN architecture and cache flow
9. **Security and Access Control Flow** - Authentication and authorization flow
10. **Media Lifecycle Management** - State diagram of media status transitions

