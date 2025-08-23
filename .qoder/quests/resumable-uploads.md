# Resumable Uploads Design Document

## Overview

This document outlines the implementation of YouTube/Google-style resumable uploads for the Reelverse decentralized content platform. The system will support large video file uploads with resumability across network interruptions, using Google's 308 "Resume Incomplete" semantics, chunked uploads with Content-Range headers, and cloud storage backends.

### Key Features
- Google-style resumable upload API with 308 status codes
- Chunked uploads with Content-Range validation
- S3/R2/GCS multipart storage backend
- Background transcoding to HLS with IPFS pinning
- Metadata editing during upload progress
- Walletless creator support with platform-sponsored uploads

### Requirements
- Resume uploads after network interruptions or browser refresh
- Handle files up to 2GB with configurable chunk sizes
- Provide real-time upload progress tracking
- Maintain upload session state across restarts
- Support concurrent uploads per user with quotas

## Architecture

### System Components

```mermaid
graph TB
    Client[Frontend Client] --> API[Upload API]
    API --> Session[Upload Session Store]
    API --> Storage[Cloud Storage<br/>S3/R2/GCS]
    API --> Queue[Background Queue]
    Queue --> Transcode[Transcoding Service]
    Queue --> IPFS[IPFS Pinning<br/>via nft.storage]
    
    Session --> Redis[(Redis Cache)]
    Session --> DB[(PostgreSQL)]
    
    subgraph "Upload Flow"
        Init[Initialize Upload] --> Chunk[Send Chunks]
        Chunk --> Validate[Validate Chunk]
        Validate --> Store[Store to Multipart]
        Store --> Complete[Complete Upload]
        Complete --> Background[Enqueue Background Job]
    end
```

### Data Flow

1. **Upload Initialization**: Client creates upload session with metadata
2. **Chunked Transfer**: File sent in configurable chunks with Content-Range headers
3. **Multipart Storage**: Chunks stored using cloud provider multipart upload APIs
4. **Completion**: Session marked complete, background job enqueued
5. **Processing**: Transcoding to HLS and IPFS pinning performed asynchronously

## API Endpoints Reference

### Upload Session Management

#### POST /api/uploads?uploadType=resumable
Initialize resumable upload session with idempotency support.

**Request:**
```json
{
  "filename": "video.mp4",
  "size": 104857600,
  "mimeType": "video/mp4",
  "title": "My Video",
  "description": "Video description",
  "tags": ["entertainment"],
  "visibility": "public",
  "category": "lifestyle"
}
```

**Headers:**
- `Idempotency-Key`: client-generated unique key (optional)

**Response (201 Created - New Session):**
```json
{
  "uploadId": "uuid-here",
  "sessionUrl": "https://api.reelverse.com/api/uploads/uuid-here",
  "chunkSize": 8388608,
  "draftId": "draft-uuid"
}
```

**Response (200 OK - Existing Session):**
```json
{
  "uploadId": "existing-uuid",
  "sessionUrl": "https://api.reelverse.com/api/uploads/existing-uuid",
  "chunkSize": 8388608,
  "draftId": "existing-draft-uuid"
}
```

**Headers:**
- `Location`: Upload session URL
- `X-Upload-Content-Length`: Total file size
- `X-Upload-Content-Type`: File MIME type
- `Cache-Control`: no-store

**Dynamic Chunk Size Calculation:**
```
chunkSize = max(8 MiB, roundUpTo5MiB(ceil(totalBytes / 9000)))
```

#### PUT /api/uploads/:id (Chunk Upload)
Upload file chunk with range information. Always responds with 308 for consistency.

**Headers:**
- `Content-Type`: application/octet-stream
- `Content-Range`: bytes 0-8388607/104857600
- `Content-Length`: 8388608

**Body:** Raw chunk data (streamed, not buffered)

**Response (308 Resume Incomplete - Chunk Accepted):**
```
Range: bytes=0-8388607
Upload-Offset: 8388608
Cache-Control: no-store
```

**Response (308 Resume Incomplete - Out of Sync):**
```
Range: bytes=0-16777215
Upload-Offset: 16777216
Cache-Control: no-store
```

**Response (201 Created - Upload Complete):**
```json
{
  "uploadId": "uuid-here",
  "storageKey": "uploads/user-id/uuid-here.bin",
  "size": 104857600
}
```

**Error Handling:**
- Out-of-sync chunks: Return 308 with current Range/Upload-Offset
- Duplicate chunks: Return 308 with current Range/Upload-Offset (idempotent)
- Wrong chunk size: Return 308 with current Range/Upload-Offset
- Only 416 for truly invalid ranges (negative, overflow)

#### PUT /api/uploads/:id (Status Probe)
Check upload progress without sending data.

**Headers (Option 1):**
- `Content-Range`: bytes */104857600

**Headers (Option 2):**
- `Content-Range`: bytes */

**Response (308 Resume Incomplete - Has Progress):**
```
Range: bytes=0-41943039
Upload-Offset: 41943040
Cache-Control: no-store
```

**Response (308 Resume Incomplete - No Progress):**
```
Upload-Offset: 0
Cache-Control: no-store
```

#### DELETE /api/uploads/:id
Abort upload session and cleanup multipart upload.

**Response:** 204 No Content

#### GET /api/uploads/:id/status
Get upload and processing status.

**Response:**
```json
{
  "status": "processing",
  "bytesReceived": 104857600,
  "totalBytes": 104857600,
  "cid": "bafybeigdyrzt5sf...",
  "playbackUrl": "https://cdn.reelverse.com/videos/uuid/playlist.m3u8",
  "errorCode": null
}
```

## Data Models & Storage

### UploadSession Table
```sql
CREATE TYPE upload_status AS ENUM (
  'uploading', 
  'uploaded', 
  'processing', 
  'playable', 
  'hd_ready', 
  'failed', 
  'aborted'
);

CREATE TABLE upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(42) NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  total_bytes BIGINT NOT NULL,
  chunk_size INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  storage_upload_id TEXT,
  bytes_received BIGINT NOT NULL DEFAULT 0,
  parts JSONB DEFAULT '[]'::jsonb,
  status upload_status DEFAULT 'uploading',
  idempotency_key TEXT,
  error_code TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT bytes_received_valid CHECK (bytes_received >= 0 AND bytes_received <= total_bytes),
  CONSTRAINT chunk_size_valid CHECK (chunk_size >= 1048576), -- Min 1MB
  CONSTRAINT total_bytes_valid CHECK (total_bytes > 0 AND total_bytes <= 137438953472) -- Max 128GB
);

-- Unique constraint for idempotency
CREATE UNIQUE INDEX idx_upload_sessions_user_idempotency 
  ON upload_sessions(user_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Performance indexes
CREATE INDEX idx_upload_sessions_user_status ON upload_sessions(user_id, status);
CREATE INDEX idx_upload_sessions_expires ON upload_sessions(expires_at) WHERE status = 'uploading';
CREATE INDEX idx_upload_sessions_created ON upload_sessions(created_at);
CREATE INDEX idx_upload_sessions_status_updated ON upload_sessions(status, updated_at);
```

### Session Parts Structure
```json
{
  "parts": [
    {
      "partNumber": 1,
      "etag": "d41d8cd98f00b204e9800998ecf8427e",
      "size": 8388608,
      "uploadedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Status Transitions
```mermaid
stateDiagram-v2
    [*] --> uploading
    uploading --> uploaded : All chunks received
    uploading --> aborted : Manual abort or TTL
    uploading --> failed : Upload error
    
    uploaded --> processing : Background job started
    uploaded --> failed : Processing error
    
    processing --> playable : First rendition ready
    processing --> failed : Processing error
    
    playable --> hd_ready : All renditions ready
    playable --> failed : Processing error
    
    failed --> [*]
    aborted --> [*]
    hd_ready --> [*]
```

### Upload Metrics Table
```sql
CREATE TABLE upload_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES upload_sessions(id) ON DELETE CASCADE,
  user_id VARCHAR(42) NOT NULL,
  event_type TEXT NOT NULL, -- 'session_created', 'chunk_uploaded', 'upload_completed', etc.
  chunk_number INTEGER,
  chunk_size_bytes INTEGER,
  processing_time_ms INTEGER,
  error_code TEXT,
  client_ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_upload_metrics_upload_id ON upload_metrics(upload_id);
CREATE INDEX idx_upload_metrics_event_type ON upload_metrics(event_type, created_at);
```

## Component Architecture

### Upload Service Implementation

```typescript
interface UploadSession {
  id: string;
  userId: string;
  filename: string;
  mimeType: string;
  totalBytes: number;
  chunkSize: number;
  storageKey: string;
  storageUploadId?: string;
  bytesReceived: number;
  parts: UploadPart[];
  status: UploadStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface UploadPart {
  partNumber: number;
  etag: string;
  size: number;
}

type UploadStatus = 'uploading' | 'uploaded' | 'processing' | 'playable' | 'failed' | 'aborted';
```

### Storage Backend Integration

The service abstracts storage operations to support multiple cloud providers:

- **AWS S3**: Native multipart upload support
- **Cloudflare R2**: S3-compatible API with multipart uploads
- **Google Cloud Storage**: Resumable upload API
- **MinIO**: S3-compatible self-hosted storage

### Chunk Validation Logic

```typescript
function validateAndProcessChunk(
  session: UploadSession, 
  start: number, 
  end: number, 
  total: number,
  res: Response
): { partNumber: number; expectedSize: number } | null {
  
  // Always use 308 for corrections, never 4xx for sync issues
  
  // Validate total matches session
  if (total !== session.totalBytes) {
    return send308Response(res, session.bytesReceived);
  }
  
  // Validate range bounds
  if (start < 0 || end < start) {
    return send308Response(res, session.bytesReceived);
  }
  
  // Handle out-of-sync chunks (client behind)
  if (start < session.bytesReceived) {
    if (end < session.bytesReceived - 1) {
      // Chunk is completely behind current position
      return send308Response(res, session.bytesReceived);
    }
    // Overlapping chunk - respond with current position
    return send308Response(res, session.bytesReceived);
  }
  
  // Handle gap in chunks (client ahead)
  if (start > session.bytesReceived) {
    return send308Response(res, session.bytesReceived);
  }
  
  // Validate end byte is inclusive: end = start + length - 1
  const chunkLength = end - start + 1;
  const expectedSize = Math.min(session.chunkSize, total - start);
  
  // Reject wrong chunk size (except final chunk)
  if (chunkLength !== expectedSize) {
    return send308Response(res, session.bytesReceived);
  }
  
  // Calculate part number for multipart upload
  const partNumber = Math.floor(start / session.chunkSize) + 1;
  
  // Only 416 for truly impossible ranges
  if (partNumber > 10000) { // S3 limit
    res.status(416).json({
      error: 'Range Not Satisfiable',
      message: 'Too many parts - use larger chunk size'
    });
    return null;
  }
  
  return { partNumber, expectedSize };
}

function send308Response(res: Response, bytesReceived: number): null {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
    'Upload-Offset': bytesReceived.toString()
  };
  
  // Include Range header if there's progress
  if (bytesReceived > 0) {
    headers['Range'] = `bytes=0-${bytesReceived - 1}`;
  }
  
  res.status(308).set(headers).end();
  return null;
}

// Dynamic chunk size calculation
function calculateChunkSize(totalBytes: number): number {
  const MIN_CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB
  const MAX_PARTS = 9000; // Under S3's 10k limit
  
  const calculatedSize = Math.ceil(totalBytes / MAX_PARTS);
  const roundedSize = roundUpTo5MiB(calculatedSize);
  
  return Math.max(MIN_CHUNK_SIZE, roundedSize);
}

function roundUpTo5MiB(bytes: number): number {
  const FIVE_MIB = 5 * 1024 * 1024;
  return Math.ceil(bytes / FIVE_MIB) * FIVE_MIB;
}

// Streaming chunk upload (no buffering)
async function handleChunkUpload(req: Request, res: Response, session: UploadSession) {
  const contentRange = req.headers['content-range'];
  const contentLength = parseInt(req.headers['content-length'] || '0');
  
  if (!contentRange) {
    return res.status(400).json({ error: 'Content-Range header required' });
  }
  
  const { start, end, total } = parseContentRange(contentRange);
  const validation = validateAndProcessChunk(session, start, end, total, res);
  
  if (!validation) {
    return; // Response already sent
  }
  
  const { partNumber } = validation;
  
  try {
    // Stream directly to storage without buffering
    const uploadResult = await uploadPartToStorage({
      bucket: process.env.STORAGE_BUCKET_UPLOADS!,
      key: session.storageKey,
      uploadId: session.storageUploadId!,
      partNumber,
      body: req, // Pass request stream directly
      contentLength
    });
    
    // Update session with new part
    await updateSessionWithPart(session, partNumber, uploadResult.etag, contentLength);
    
    // Check if upload is complete
    const newBytesReceived = session.bytesReceived + contentLength;
    
    if (newBytesReceived === session.totalBytes) {
      // Complete multipart upload
      await completeMultipartUpload(session);
      await updateSessionStatus(session.id, 'uploaded');
      
      // Enqueue background processing
      await enqueueTranscodeJob(session.id);
      
      return res.status(201).json({
        uploadId: session.id,
        storageKey: session.storageKey,
        size: session.totalBytes
      });
    }
    
    // Return 308 with progress
    return send308Response(res, newBytesReceived);
    
  } catch (error) {
    logger.error('Chunk upload failed', { 
      uploadId: session.id, 
      partNumber, 
      error: error.message 
    });
    
    await updateSessionStatus(session.id, 'failed', error.message);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
```

## Background Processing Pipeline

### Job Queue Integration

The system uses Bull queue for background processing:

```typescript
interface TranscodeAndPinJob {
  type: 'transcode-and-pin';
  uploadId: string;
  storageKey: string;
  metadata: ContentMetadata;
}

interface SweeperJob {
  type: 'cleanup-stale-uploads';
  olderThan: Date;
}
```

### Processing Steps

1. **Content Analysis**: Probe video codec, duration, resolution using FFprobe
2. **HLS Transcoding**: Generate adaptive bitrate streams (240p-4K)
3. **Thumbnail Generation**: Extract poster frames and preview clips
4. **IPFS Pinning**: Pin original file to IPFS via nft.storage using CAR format
5. **CDN Distribution**: Upload transcoded content to CDN
6. **Status Updates**: Update session status throughout pipeline

### Status Transitions
- `uploading` → `uploaded` (all chunks received)
- `uploaded` → `processing` (background job started)
- `processing` → `playable` (first rendition ready)
- `playable` → `hd_ready` (all renditions complete)
- Any state → `failed` (processing error)
- `uploading` → `aborted` (manual abort or TTL)

### Transcoding Configuration

```typescript
const transcodingProfiles = {
  '240p': { width: 426, height: 240, bitrate: '400k' },
  '360p': { width: 640, height: 360, bitrate: '800k' },
  '720p': { width: 1280, height: 720, bitrate: '2M' },
  '1080p': { width: 1920, height: 1080, bitrate: '5M' },
  '4K': { width: 3840, height: 2160, bitrate: '15M' }
};
```

### IPFS Integration

```typescript
import { NFTStorage } from 'nft.storage';

async function pinToIPFS(storageKey: string, uploadId: string) {
  const client = new NFTStorage({ 
    token: process.env.NFT_STORAGE_TOKEN 
  });
  
  // Download from storage
  const fileStream = await downloadFromStorage(storageKey);
  
  // Upload as CAR to IPFS
  const cid = await client.storeBlob(fileStream);
  
  // Verify upload if enabled
  if (process.env.NFT_STORAGE_VERIFY_HASH === 'true') {
    const verification = await verifyIPFSUpload(cid, storageKey);
    if (!verification.valid) {
      throw new Error('IPFS upload verification failed');
    }
  }
  
  // Store metadata
  await updateSessionIPFSData(uploadId, {
    cid,
    pinStatus: 'pinned',
    pinnedAt: new Date(),
    verificationHash: verification?.hash
  });
  
  return cid;
}
```

## Upload Session Sweeper

### Stale Session Cleanup

```typescript
class UploadSweeper {
  private intervalMs: number;
  private timer?: NodeJS.Timeout;
  
  constructor() {
    this.intervalMs = parseInt(process.env.UPLOAD_SWEEPER_INTERVAL_MINUTES || '60') * 60 * 1000;
  }
  
  start() {
    this.timer = setInterval(() => {
      this.cleanupStaleSessions().catch(error => {
        logger.error('Sweeper cleanup failed', { error: error.message });
      });
    }, this.intervalMs);
    
    logger.info('Upload sweeper started', { intervalMs: this.intervalMs });
  }
  
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
  
  async cleanupStaleSessions(): Promise<void> {
    const ttlHours = parseInt(process.env.UPLOAD_SESSION_TTL_HOURS || '24');
    const cutoffTime = new Date(Date.now() - ttlHours * 60 * 60 * 1000);
    
    const staleSessions = await db.query(`
      SELECT id, storage_upload_id, storage_key 
      FROM upload_sessions 
      WHERE status = 'uploading' 
        AND (expires_at < NOW() OR updated_at < $1)
    `, [cutoffTime]);
    
    logger.info('Found stale upload sessions', { count: staleSessions.rows.length });
    
    for (const session of staleSessions.rows) {
      try {
        // Abort multipart upload in storage
        if (session.storage_upload_id) {
          await abortMultipartUpload({
            bucket: process.env.STORAGE_BUCKET_UPLOADS!,
            key: session.storage_key,
            uploadId: session.storage_upload_id
          });
        }
        
        // Update session status
        await db.query(`
          UPDATE upload_sessions 
          SET status = 'aborted', updated_at = NOW() 
          WHERE id = $1
        `, [session.id]);
        
        logger.info('Cleaned up stale session', { uploadId: session.id });
        
      } catch (error) {
        logger.error('Failed to cleanup session', {
          uploadId: session.id,
          error: error.message
        });
      }
    }
  }
}

// Start sweeper
const sweeper = new UploadSweeper();
sweeper.start();

// Graceful shutdown
process.on('SIGTERM', () => sweeper.stop());
process.on('SIGINT', () => sweeper.stop());
```

## Frontend Integration

### Upload Utility

```typescript
class ResumableUploader {
  async uploadFile(file: File, metadata: UploadMetadata, onProgress?: ProgressCallback) {
    // 1. Initialize upload session
    const session = await this.createSession(file, metadata);
    
    // 2. Store session for resume capability
    this.persistSession(session);
    
    // 3. Upload chunks with resume logic
    return this.uploadChunks(file, session, onProgress);
  }
  
  async resumeUpload(sessionId: string, file: File, onProgress?: ProgressCallback) {
    // 1. Probe current offset
    const offset = await this.probeOffset(sessionId);
    
    // 2. Resume from last successful chunk
    return this.uploadChunks(file, session, onProgress, offset);
  }
}
```

### Progress Tracking

```typescript
interface UploadProgress {
  uploadId: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  status: UploadStatus;
  estimatedTimeRemaining?: number;
}
```

### Local Storage Persistence

```typescript
const STORAGE_KEY = 'rv.upload.sessions';

function persistSession(session: UploadSession) {
  const sessions = getStoredSessions();
  sessions[session.id] = {
    uploadId: session.id,
    chunkSize: session.chunkSize,
    totalBytes: session.totalBytes,
    lastByte: session.bytesReceived
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}
```

## Security & Validation

### Authentication & Authorization
- Require authenticated user sessions
- Validate user upload quotas and permissions
- Rate limiting on upload initiation (5 sessions/hour per user)

### Content Validation
- MIME type validation against allowed formats
- File size limits (max 2GB, configurable)
- Virus scanning integration
- Content moderation hooks

### CORS Configuration
```typescript
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Content-Range', 
    'Content-Length',
    'X-Requested-With',
    'Authorization',
    'Idempotency-Key'
  ],
  exposedHeaders: [
    'Location', 
    'Range', 
    'X-Upload-Content-Length',
    'X-Upload-Content-Type', 
    'Upload-Offset',
    'Cache-Control',
    'X-Idempotency-Key'
  ],
  credentials: true
};

// Ensure Cache-Control: no-store on all upload responses
app.use('/api/uploads', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
```

## Environment Configuration

### Required Environment Variables
```bash
# Storage Configuration
STORAGE_BUCKET_UPLOADS=reelverse-uploads
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=https://s3.amazonaws.com  # Optional for R2/MinIO
STORAGE_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
STORAGE_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# CDN and Processing
CDN_BASE_URL=https://cdn.reelverse.com
NFT_STORAGE_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Upload Configuration
DEFAULT_CHUNK_SIZE_BYTES=8388608     # 8 MiB (minimum)
MAX_FILE_SIZE_BYTES=21474836480      # 20 GiB (default), max 128 GiB
MAX_CONCURRENT_UPLOADS=3
UPLOAD_SESSION_TTL_HOURS=24
UPLOAD_SWEEPER_INTERVAL_MINUTES=60   # Cleanup stale sessions

# S3/Storage Security
STORAGE_SERVER_SIDE_ENCRYPTION=AES256
STORAGE_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012
STORAGE_LIFECYCLE_DAYS=7             # Auto-delete incomplete uploads after 7 days

# NFT Storage Configuration
NFT_STORAGE_CAR_UPLOAD=true          # Use CAR format for IPFS uploads
NFT_STORAGE_VERIFY_HASH=true         # Verify content hash after upload
```

### Storage Backend Configuration

#### AWS S3 Setup
```bash
# S3 lifecycle policy for cleanup
aws s3api put-bucket-lifecycle-configuration \
  --bucket reelverse-uploads \
  --lifecycle-configuration file://lifecycle.json
```

```json
// lifecycle.json
{
  "Rules": [{
    "ID": "CleanupIncompleteUploads",
    "Status": "Enabled",
    "AbortIncompleteMultipartUpload": {
      "DaysAfterInitiation": 7
    }
  }]
}
```

#### Cloudflare R2 Setup
```bash
# R2 bucket with lifecycle rules
wrangler r2 bucket create reelverse-uploads
wrangler r2 bucket lifecycle put reelverse-uploads --config lifecycle.json
```

## Testing Strategy

### Unit Testing
- Content-Range parsing and validation
- Chunk offset calculations
- Session state management
- Error handling scenarios

### Integration Testing
- End-to-end upload flow
- Resume after network interruption
- Storage backend integration
- Background job processing

### Load Testing
- Concurrent upload handling
- Large file upload performance
- Storage backend limits
- Memory usage optimization

## Monitoring & Observability

### Metrics Collection

```typescript
// Core upload metrics
const uploadMetrics = {
  // Success/failure rates
  'upload.session.created': { type: 'counter', labels: ['user_id', 'file_size_bucket'] },
  'upload.session.completed': { type: 'counter', labels: ['user_id', 'duration_bucket'] },
  'upload.session.failed': { type: 'counter', labels: ['user_id', 'error_code'] },
  'upload.session.aborted': { type: 'counter', labels: ['user_id', 'reason'] },
  
  // Performance metrics
  'upload.chunk.received': { type: 'counter', labels: ['part_number', 'chunk_size_bucket'] },
  'upload.chunk.retry': { type: 'counter', labels: ['retry_count', 'error_type'] },
  'upload.speed.mbps': { type: 'histogram', buckets: [1, 5, 10, 25, 50, 100] },
  'upload.processing.duration': { type: 'histogram', labels: ['stage'] },
  
  // Resume operations
  'upload.resume.attempted': { type: 'counter', labels: ['gap_size_bucket'] },
  'upload.resume.successful': { type: 'counter', labels: ['gap_size_bucket'] },
  
  // Storage backend
  'storage.multipart.created': { type: 'counter', labels: ['provider'] },
  'storage.multipart.completed': { type: 'counter', labels: ['provider', 'part_count_bucket'] },
  'storage.multipart.aborted': { type: 'counter', labels: ['provider', 'reason'] },
  
  // Background processing
  'transcode.job.started': { type: 'counter', labels: ['profile'] },
  'transcode.job.completed': { type: 'counter', labels: ['profile', 'duration_bucket'] },
  'transcode.job.failed': { type: 'counter', labels: ['profile', 'error_code'] },
  'ipfs.pin.attempted': { type: 'counter' },
  'ipfs.pin.successful': { type: 'counter' },
  'ipfs.pin.failed': { type: 'counter', labels: ['error_code'] },
  
  // System health
  'sweeper.sessions.cleaned': { type: 'counter' },
  'sweeper.cleanup.failed': { type: 'counter', labels: ['error_code'] },
  'upload.concurrent.sessions': { type: 'gauge', labels: ['user_id'] },
  'upload.storage.utilization': { type: 'gauge', labels: ['bucket'] }
};

// Metric collection helper
function recordUploadMetric(name: string, value: number = 1, labels: Record<string, string> = {}) {
  metrics.record(name, value, {
    timestamp: Date.now(),
    ...labels
  });
}
```

### Logging Strategy

```typescript
// Structured logging for upload events
logger.info('upload.session.created', {
  uploadId: session.id,
  userId: session.userId,
  filename: session.filename,
  totalBytes: session.totalBytes,
  chunkSize: session.chunkSize,
  idempotencyKey: session.idempotencyKey
});

logger.info('upload.chunk.received', {
  uploadId: session.id,
  partNumber,
  chunkSize: end - start + 1,
  bytesReceived: session.bytesReceived,
  progressPercent: (session.bytesReceived / session.totalBytes * 100).toFixed(2)
});

logger.warn('upload.chunk.out_of_sync', {
  uploadId: session.id,
  expectedStart: session.bytesReceived,
  actualStart: start,
  gap: start - session.bytesReceived
});

logger.error('upload.session.failed', {
  uploadId: session.id,
  userId: session.userId,
  errorCode: error.code,
  errorMessage: error.message,
  partNumber,
  bytesReceived: session.bytesReceived,
  stack: error.stack
});
```

### Health Checks

```typescript
// Upload service health endpoint
app.get('/api/uploads/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabaseHealth(),
      storage: await checkStorageHealth(),
      queue: await checkQueueHealth(),
      sweeper: await checkSweeperHealth()
    }
  };
  
  const isHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
  
  res.status(isHealthy ? 200 : 503).json(health);
});

async function checkStorageHealth(): Promise<HealthCheck> {
  try {
    await testStorageConnection();
    return { status: 'healthy', latency: 'ms', message: 'Storage accessible' };
  } catch (error) {
    return { status: 'unhealthy', message: error.message };
  }
}
```

### Alerting Rules

```yaml
# Prometheus alerting rules
groups:
  - name: upload.alerts
    rules:
      - alert: HighUploadFailureRate
        expr: |
          (
            rate(upload_session_failed_total[5m]) / 
            rate(upload_session_created_total[5m])
          ) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High upload failure rate detected"
          description: "Upload failure rate is {{ $value | humanizePercentage }} over the last 5 minutes"
      
      - alert: UploadProcessingBacklog
        expr: upload_queue_waiting_jobs{queue="transcode-and-pin"} > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Upload processing backlog detected"
          description: "{{ $value }} jobs waiting in transcode queue"
      
      - alert: StaleUploadSessions
        expr: |
          (
            time() - upload_session_last_cleanup_timestamp
          ) > 7200  # 2 hours
        labels:
          severity: critical
        annotations:
          summary: "Upload sweeper not running"
          description: "Stale session cleanup has not run for over 2 hours"
```

### Error Handling
- Structured error responses with correlation IDs
- Retry mechanisms for transient failures
- Graceful degradation for storage backend issues
- Client-side error recovery strategies

## Performance Considerations

### Optimization Strategies
- **Dynamic chunk sizing** based on file size to avoid S3's 10k parts limit
- **Streaming uploads** without memory buffering using request streams
- **Smart retry logic** with exponential backoff and 308 responses
- **Connection pooling** for storage operations
- **Redis caching** for session state with TTL
- **Concurrent upload limits** per user to prevent abuse

### Scalability Factors
- **Horizontal scaling** of API servers with session affinity
- **Load balancing** with sticky sessions or Redis-backed state
- **Background job queue scaling** with Bull cluster mode
- **Storage backend bandwidth** limits and region distribution
- **CDN integration** for global distribution
- **Database connection pooling** for high concurrency

### Concurrency Handling
- **Sequential chunks** (Google-style) for simplicity and reliability
- **Row-level locking** for session updates to prevent race conditions
- **Advisory locks** for multipart upload coordination
- **Rate limiting** on session creation and chunk uploads
- **Memory management** with streaming to avoid OOM issues

## Operational Best Practices

### Storage Backend Configuration

#### S3/R2 Bucket Policies
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowUploadsOnly",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT:user/reelverse-uploader"
      },
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::reelverse-uploads/*"
    }
  ]
}
```

#### Encryption Configuration
```bash
# Server-side encryption
aws s3api put-bucket-encryption \
  --bucket reelverse-uploads \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      },
      "BucketKeyEnabled": true
    }]
  }'
```

### Database Optimization

```sql
-- Partitioning for large tables
CREATE TABLE upload_sessions_2024 PARTITION OF upload_sessions
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Optimize queries with covering indexes
CREATE INDEX idx_upload_sessions_status_bytes_covering
ON upload_sessions(status, bytes_received) 
INCLUDE (total_bytes, updated_at)
WHERE status = 'uploading';

-- Regular maintenance
SCHEDULE '0 2 * * *' DO $$ -- Daily at 2 AM
BEGIN
  -- Cleanup old completed sessions
  DELETE FROM upload_sessions 
  WHERE status IN ('hd_ready', 'failed', 'aborted') 
    AND updated_at < NOW() - INTERVAL '30 days';
  
  -- Vacuum and analyze
  VACUUM ANALYZE upload_sessions;
END $$;
```

### Redis Configuration

```conf
# redis.conf optimizations for upload sessions
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1  # Save if at least 1 key changed in 900 seconds
stop-writes-on-bgsave-error yes
rdbcompression yes

# Optimize for upload session patterns
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
set-max-intset-entries 512
```

## Testing & Validation

### cURL Examples

#### 1. Create Upload Session
```bash
curl -i -X POST "http://localhost:3001/api/uploads?uploadType=resumable" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Idempotency-Key: upload-$(date +%s)" \
  -d '{
    "filename": "test-video.mp4",
    "size": 104857600,
    "mimeType": "video/mp4",
    "title": "Test Video",
    "description": "Test upload",
    "tags": ["test"],
    "visibility": "public"
  }'
```

#### 2. Probe Upload Status
```bash
# Check current offset (no data sent)
curl -i -X PUT "$LOCATION_URL" \
  -H "Content-Range: bytes */104857600" \
  -H "Authorization: Bearer $AUTH_TOKEN"
  
# Alternative format
curl -i -X PUT "$LOCATION_URL" \
  -H "Content-Range: bytes */" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

#### 3. Upload First Chunk
```bash
# Create 8MB test chunk
dd if=/dev/zero of=chunk1.bin bs=1M count=8

# Upload chunk
curl -i -X PUT "$LOCATION_URL" \
  -H "Content-Type: application/octet-stream" \
  -H "Content-Range: bytes 0-8388607/104857600" \
  -H "Content-Length: 8388608" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  --data-binary @chunk1.bin
```

#### 4. Resume After Interruption
```bash
# Probe current position
RESPONSE=$(curl -s -i -X PUT "$LOCATION_URL" \
  -H "Content-Range: bytes */104857600" \
  -H "Authorization: Bearer $AUTH_TOKEN")

# Extract Upload-Offset from response
OFFSET=$(echo "$RESPONSE" | grep -i "upload-offset:" | cut -d' ' -f2 | tr -d '\r')

# Continue from offset
dd if=chunk2.bin of=remaining.bin bs=1 skip=$OFFSET
curl -i -X PUT "$LOCATION_URL" \
  -H "Content-Type: application/octet-stream" \
  -H "Content-Range: bytes $OFFSET-16777215/104857600" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  --data-binary @remaining.bin
```

#### 5. Simulate Out-of-Sync Client
```bash
# Send chunk that's already been received (should get 308)
curl -i -X PUT "$LOCATION_URL" \
  -H "Content-Type: application/octet-stream" \
  -H "Content-Range: bytes 0-8388607/104857600" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  --data-binary @chunk1.bin

# Expected: 308 with Range: bytes=0-16777215, Upload-Offset: 16777216
```

#### 6. Check Processing Status
```bash
curl -i "$LOCATION_URL/status" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

### Load Testing

```bash
# Test concurrent uploads
for i in {1..10}; do
  (
    # Create unique file
    dd if=/dev/urandom of="test-$i.bin" bs=1M count=100
    
    # Upload with different idempotency key
    ./upload-test.sh "test-$i.bin" "upload-test-$i"
  ) &
done
wait
```

### Unit Test Examples

```typescript
describe('Content-Range Parsing', () => {
  it('should parse valid range headers', () => {
    const result = parseContentRange('bytes 0-8388607/104857600');
    expect(result).toEqual({
      start: 0,
      end: 8388607,
      total: 104857600
    });
  });
  
  it('should handle probe requests', () => {
    const result = parseContentRange('bytes */104857600');
    expect(result).toEqual({
      start: null,
      end: null,
      total: 104857600
    });
  });
});

describe('Dynamic Chunk Size', () => {
  it('should calculate appropriate chunk sizes', () => {
    expect(calculateChunkSize(100 * 1024 * 1024)).toBe(8388608); // 8MB min
    expect(calculateChunkSize(50 * 1024 * 1024 * 1024)).toBe(5767168); // ~5.5MB for 50GB
  });
});
```