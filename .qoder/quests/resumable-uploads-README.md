# Resumable Uploads - YouTube/Google Style

This implementation provides YouTube/Google-style resumable uploads for the Reelverse platform, supporting large video file uploads with resumability across network interruptions, using Google's 308 "Resume Incomplete" semantics.

## Features

- ✅ **Google-style 308 semantics** - Always respond with 308 for corrections, never 4xx for sync issues
- ✅ **Chunked uploads** - Content-Range validation with dynamic chunk sizing  
- ✅ **S3/R2/GCS backend** - Multipart upload storage with streaming (no buffering)
- ✅ **Resumability** - Survives network interruptions and browser refresh
- ✅ **Idempotency** - Duplicate requests are handled gracefully
- ✅ **Real-time progress** - Track upload progress with localStorage persistence
- ✅ **Background processing** - Transcode to HLS and pin to IPFS after upload
- ✅ **Metadata editing** - Edit title/description during upload progress

## Quick Start

### 1. Environment Setup

Add these variables to your `.env` file:

```bash
# Storage Configuration
STORAGE_BUCKET_UPLOADS=reelverse-uploads
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=                    # Optional: for R2/MinIO
STORAGE_ACCESS_KEY_ID=your-key-id
STORAGE_SECRET_ACCESS_KEY=your-secret-key

# Upload Settings
CDN_BASE_URL=https://cdn.reelverse.com
NFT_STORAGE_TOKEN=your-nft-storage-token
DEFAULT_CHUNK_SIZE_BYTES=8388608     # 8 MiB
MAX_FILE_SIZE_BYTES=21474836480      # 20 GiB
UPLOAD_SESSION_TTL_HOURS=24

# Rate Limiting
RATE_LIMIT_UPLOAD_SESSION=10/hour
RATE_LIMIT_UPLOAD_CHUNK=100/min
```

### 2. Database Migration

Run the migration to create required tables:

```bash
cd api
npm run migrate
```

This creates:
- `upload_sessions` - Main upload session state
- `upload_metrics` - Upload analytics and monitoring
- `content_drafts` - Editable metadata during upload

### 3. Frontend Integration

```typescript
import { uploadResumable } from '@/lib/uploadResumable';

const handleFileUpload = async (file: File) => {
  try {
    const result = await uploadResumable(file, {
      filename: file.name,
      size: file.size,
      mimeType: file.type,
      title: 'My Video',
      description: 'Video description',
      tags: ['entertainment'],
      visibility: 'public',
    }, {
      onProgress: (progress) => {
        console.log(`${progress.percentage.toFixed(1)}% uploaded`);
      },
      onStatusChange: (status) => {
        console.log('Status:', status);
      },
      authToken: 'your-jwt-token',
    });

    console.log('Upload completed:', result);
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

## API Reference

All endpoints are prefixed with `/api/v1/resumable-uploads`.

### Create Upload Session

Create a new resumable upload session with optional idempotency.

```bash
POST /api/v1/resumable-uploads?uploadType=resumable
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: <optional-key>
```

**Request Body:**
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

**Response (201 Created - New Session):**
```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "sessionUrl": "https://api.reelverse.com/api/v1/resumable-uploads/550e8400-e29b-41d4-a716-446655440000",
  "chunkSize": 8388608,
  "draftId": "draft-uuid"
}
```

**Headers:**
```
Location: https://api.reelverse.com/api/v1/resumable-uploads/550e8400-e29b-41d4-a716-446655440000
X-Upload-Content-Length: 104857600
X-Upload-Content-Type: video/mp4
Cache-Control: no-store
```

### Upload Chunk

Upload a file chunk with range information.

```bash
PUT /api/v1/resumable-uploads/:id
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/octet-stream
Content-Range: bytes 0-8388607/104857600
Content-Length: 8388608
```

**Body:** Raw chunk data (binary)

**Response (308 Resume Incomplete - Chunk Accepted):**
```
Range: bytes=0-8388607
Upload-Offset: 8388608
Cache-Control: no-store
```

**Response (201 Created - Upload Complete):**
```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "storageKey": "uploads/user-id/550e8400-e29b-41d4-a716-446655440000.bin",
  "size": 104857600
}
```

### Status Probe

Check upload progress without sending data.

```bash
PUT /api/v1/resumable-uploads/:id
```

**Headers:**
```
Authorization: Bearer <token>
Content-Range: bytes */104857600
Content-Length: 0
```

**Response (308 Resume Incomplete):**
```
Range: bytes=0-41943039
Upload-Offset: 41943040
Cache-Control: no-store
```

### Get Upload Status

Get current upload and processing status.

```bash
GET /api/v1/resumable-uploads/:id/status
```

**Response:**
```json
{
  "status": "processing",
  "bytesReceived": 104857600,
  "totalBytes": 104857600,
  "progress": 100,
  "cid": "bafybeigdyrzt5sf...",
  "playbackUrl": "https://cdn.reelverse.com/videos/uuid/playlist.m3u8",
  "errorCode": null,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

### Update Draft Metadata

Update content metadata during upload.

```bash
PUT /api/v1/resumable-uploads/:id/draft
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "tags": ["updated", "tags"],
  "visibility": "private"
}
```

### Abort Upload

Cancel upload and cleanup resources.

```bash
DELETE /api/v1/resumable-uploads/:id
```

**Response:** `204 No Content`

## curl Examples

### 1. Create Upload Session

```bash
curl -i -X POST "http://localhost:3001/api/v1/resumable-uploads?uploadType=resumable" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: upload-$(date +%s)" \
  -d '{
    "filename": "test-video.mp4",
    "size": 104857600,
    "mimeType": "video/mp4",
    "title": "Test Video",
    "description": "A test video upload"
  }'
```

**Expected Response:**
```
HTTP/1.1 201 Created
Location: http://localhost:3001/api/v1/resumable-uploads/550e8400-e29b-41d4-a716-446655440000
X-Upload-Content-Length: 104857600
X-Upload-Content-Type: video/mp4
Cache-Control: no-store

{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "sessionUrl": "http://localhost:3001/api/v1/resumable-uploads/550e8400-e29b-41d4-a716-446655440000",
  "chunkSize": 8388608,
  "draftId": "draft-uuid"
}
```

### 2. Check Current Upload Offset

```bash
curl -i -X PUT "http://localhost:3001/api/v1/resumable-uploads/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Range: bytes */104857600" \
  -H "Content-Length: 0"
```

**Expected Response:**
```
HTTP/1.1 308 Resume Incomplete
Range: bytes=0-16777215
Upload-Offset: 16777216
Cache-Control: no-store
```

### 3. Upload First Chunk

```bash
# Create a test chunk file (8MB of zeros)
dd if=/dev/zero of=chunk1.bin bs=1048576 count=8

curl -i -X PUT "http://localhost:3001/api/v1/resumable-uploads/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/octet-stream" \
  -H "Content-Range: bytes 0-8388607/104857600" \
  -H "Content-Length: 8388608" \
  --data-binary @chunk1.bin
```

**Expected Response:**
```
HTTP/1.1 308 Resume Incomplete
Range: bytes=0-8388607
Upload-Offset: 8388608
Cache-Control: no-store
```

### 4. Upload Subsequent Chunks

```bash
# Upload second chunk
curl -i -X PUT "http://localhost:3001/api/v1/resumable-uploads/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/octet-stream" \
  -H "Content-Range: bytes 8388608-16777215/104857600" \
  -H "Content-Length: 8388608" \
  --data-binary @chunk1.bin
```

### 5. Upload Final Chunk

```bash
# Create final chunk (smaller)
dd if=/dev/zero of=final-chunk.bin bs=1048576 count=4

curl -i -X PUT "http://localhost:3001/api/v1/resumable-uploads/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/octet-stream" \
  -H "Content-Range: bytes 100663296-104857599/104857600" \
  -H "Content-Length: 4194304" \
  --data-binary @final-chunk.bin
```

**Expected Response (Upload Complete):**
```
HTTP/1.1 201 Created

{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "storageKey": "uploads/user-id/550e8400-e29b-41d4-a716-446655440000.bin",
  "size": 104857600
}
```

### 6. Check Upload Status

```bash
curl -i -X GET "http://localhost:3001/api/v1/resumable-uploads/550e8400-e29b-41d4-a716-446655440000/status" \
  -H "Authorization: Bearer your-token"
```

### 7. Update Draft Metadata

```bash
curl -i -X PUT "http://localhost:3001/api/v1/resumable-uploads/550e8400-e29b-41d4-a716-446655440000/draft" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "description": "Updated description",
    "tags": ["updated", "tags"]
  }'
```

### 8. Abort Upload

```bash
curl -i -X DELETE "http://localhost:3001/api/v1/resumable-uploads/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer your-token"
```

## Error Handling

The API uses Google's 308 semantics for all upload corrections:

### Out-of-Sync Chunks

When client sends wrong offset, server responds with 308 and current position:

```bash
# Client sends wrong chunk
curl -X PUT "..." \
  -H "Content-Range: bytes 16777216-25165823/104857600" \
  # But server only received up to 8388608

# Server response:
HTTP/1.1 308 Resume Incomplete
Range: bytes=0-8388607
Upload-Offset: 8388608
```

### Wrong Chunk Size

```bash
# Client sends chunk with wrong size
curl -X PUT "..." \
  -H "Content-Range: bytes 8388608-12582911/104857600" \
  -H "Content-Length: 2097152"  # 2MB instead of 4MB

# Server response:
HTTP/1.1 308 Resume Incomplete
Range: bytes=0-8388607
Upload-Offset: 8388608
```

### Invalid Content-Range

```bash
# Malformed header
curl -X PUT "..." \
  -H "Content-Range: invalid-format"

# Server response:
HTTP/1.1 400 Bad Request
{
  "error": "Invalid or missing Content-Range header"
}
```

## Status Flow

```
uploading → uploaded → processing → playable → hd_ready
    ↓          ↓           ↓          ↓
  aborted    failed     failed    failed
```

- **uploading**: Receiving chunks
- **uploaded**: All chunks received, multipart complete
- **processing**: Background transcoding started
- **playable**: First rendition available
- **hd_ready**: All renditions complete
- **failed**: Error during any stage
- **aborted**: Manually cancelled

## Architecture

### Components

1. **Database Tables**
   - `upload_sessions` - Session state and metadata
   - `upload_metrics` - Analytics and monitoring
   - `content_drafts` - Editable metadata

2. **Storage Service** (`ResumableStorageService`)
   - S3/R2/GCS multipart upload abstraction
   - Streaming chunk uploads (no buffering)
   - Dynamic chunk size calculation

3. **Upload Service** (`UploadSessionService`)
   - Session management and persistence
   - Chunk validation and part tracking
   - Draft metadata handling

4. **API Routes** (`/resumable-uploads`)
   - Google 308 semantics implementation
   - Content-Range parsing and validation
   - Streaming middleware integration

5. **Client Library** (`uploadResumable.ts`)
   - localStorage persistence
   - Automatic resumption
   - Progress tracking and retry logic

### Key Features

**Dynamic Chunk Sizing:**
```typescript
chunkSize = max(8 MiB, roundUpTo5MiB(ceil(totalBytes / 9000)))
```

**308 Error Handling:**
- Always respond with 308 for corrections
- Include `Range` and `Upload-Offset` headers
- Never use 4xx for sync issues

**Streaming Uploads:**
- Pass request stream directly to storage
- No buffering in memory
- Support for files up to 20GB+

## Testing

### Unit Tests

```bash
cd api
npm test -- --testPathPattern=contentRange.test.ts
```

### Integration Tests

```bash
# Start the API server
npm run dev

# Test full upload flow
curl -i -X POST "http://localhost:3001/api/v1/resumable-uploads?uploadType=resumable" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.mp4","size":1048576,"mimeType":"video/mp4"}'
```

### Load Testing

Use the client library to test concurrent uploads:

```typescript
const promises = Array.from({ length: 10 }, (_, i) => 
  uploadResumable(file, { 
    filename: `video-${i}.mp4`,
    size: file.size,
    mimeType: file.type 
  })
);

await Promise.all(promises);
```

## Monitoring

### Metrics

Upload metrics are automatically recorded:

- `session_created` - New upload session
- `chunk_uploaded` - Successful chunk upload
- `upload_completed` - Upload finished
- `session_aborted` - Upload cancelled

### Logs

All upload operations are logged with structured data:

```json
{
  "level": "info",
  "message": "Upload request completed",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "statusCode": 308,
  "duration": 1250,
  "contentLength": 8388608
}
```

### Health Checks

Storage service health is included in `/health` endpoint:

```bash
curl http://localhost:3001/health
```

## Production Considerations

### Security

- ✅ Authentication required for all endpoints
- ✅ Rate limiting on session creation and chunk uploads
- ✅ File size and MIME type validation
- ✅ Filename sanitization
- ⚠️ Consider virus scanning for uploaded files

### Performance

- ✅ Streaming uploads (no memory buffering)
- ✅ Dynamic chunk sizing
- ✅ Connection pooling for storage
- ✅ Concurrent upload support

### Reliability

- ✅ Idempotency support
- ✅ Automatic cleanup of stale sessions
- ✅ Exponential backoff retry logic
- ✅ Graceful error handling

### Scalability

- ✅ Stateless API (session state in database)
- ✅ Horizontal scaling support
- ✅ Background job processing
- ⚠️ Consider CDN for chunk uploads

## Troubleshooting

### Common Issues

1. **Upload stalls at specific percentage**
   - Check network connectivity
   - Verify chunk size isn't too large
   - Check server logs for errors

2. **"Content-Range header required" error**
   - Ensure `Content-Range` header is included
   - Verify header format: `bytes start-end/total`

3. **"Chunk out of sync" error**
   - Use status probe to get current offset
   - Resume from correct position

4. **Storage permission errors**
   - Verify S3/R2 credentials
   - Check bucket permissions
   - Ensure multipart upload is enabled

### Debug Mode

Enable debug logging:

```bash
DEBUG=resumable-upload:* npm run dev
```

### Manual Cleanup

Remove stale sessions:

```sql
DELETE FROM upload_sessions 
WHERE status = 'uploading' 
  AND expires_at < NOW();
```

## Future Enhancements

- [ ] Parallel chunk uploads
- [ ] Client-side encryption
- [ ] Resume from different device
- [ ] Upload bandwidth throttling
- [ ] Progressive upload compression

---

For support, check the logs and ensure all environment variables are properly configured. The implementation follows Google's resumable upload specification closely for maximum compatibility.