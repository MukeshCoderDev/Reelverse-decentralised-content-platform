# Playback Token Service

The Playback Token Service provides secure, signed JWT tokens for video playback with HLS integration, session-based watermarking, and comprehensive access control.

## Features

- **JWT-based Authentication**: Secure token generation with configurable expiry
- **HLS URL Signing**: Cryptographically signed streaming URLs with expiry management
- **Session-based Watermarking**: Dynamic watermark generation tied to user sessions
- **Token Validation Middleware**: Comprehensive validation for streaming endpoints
- **Session Management**: Track and manage active playback sessions per user
- **Rate Limiting**: Prevent abuse with configurable concurrent session limits
- **Emergency Revocation**: Ability to revoke tokens for content takedowns

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   Redis Cache   │
│   Video Player  │    │   Token Service  │    │   Session Store │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. Request Token      │                       │
         ├──────────────────────►│                       │
         │                       │ 2. Store Session     │
         │                       ├──────────────────────►│
         │                       │                       │
         │ 3. Return Token+HLS   │                       │
         │◄──────────────────────┤                       │
         │                       │                       │
         │ 4. Stream HLS         │                       │
         ├──────────────────────►│ 5. Validate Token    │
         │                       ├──────────────────────►│
         │                       │                       │
         │ 6. Serve Content      │                       │
         │◄──────────────────────┤                       │
```

## API Endpoints

### Generate Playback Token

**POST** `/api/v1/content/playback-token`

Generate a signed JWT token for video playback.

**Request Body:**
```json
{
  "contentId": "content-123",
  "userAddress": "0x1234567890123456789012345678901234567890",
  "sessionId": "session-abc-123",
  "expiryMinutes": 240
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "hlsUrl": "https://stream.reelverse.com/hls/content-123/playlist.m3u8?token=...&expires=...&signature=...",
    "watermarkId": "a1b2c3d4e5f6g7h8",
    "expiresAt": "2024-01-15T10:30:00.000Z",
    "sessionId": "session-abc-123"
  }
}
```

### Validate Playback Token

**POST** `/api/v1/content/validate-token`

Validate a JWT playback token.

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "payload": {
      "contentId": "content-123",
      "userAddress": "0x1234567890123456789012345678901234567890",
      "sessionId": "session-abc-123",
      "watermarkId": "a1b2c3d4e5f6g7h8",
      "issuedAt": 1705312200000,
      "expiresAt": 1705326600000
    }
  }
}
```

### HLS Streaming Endpoint

**GET** `/api/v1/content/hls/:contentId/playlist.m3u8`

Serve HLS playlist with signature validation.

**Query Parameters:**
- `token`: JWT playback token
- `expires`: Unix timestamp when URL expires
- `signature`: HMAC signature for URL integrity

**Response:**
```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:10.0,
segment-0.ts?watermark=a1b2c3d4e5f6g7h8
#EXTINF:10.0,
segment-1.ts?watermark=a1b2c3d4e5f6g7h8
#EXT-X-ENDLIST
```

### Get Watermark Configuration

**GET** `/api/v1/content/watermark/:watermarkId`

Retrieve watermark display configuration.

**Headers:**
- `Authorization: Bearer <jwt-token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "userAddress": "0x1234567890123456789012345678901234567890",
    "sessionId": "session-123",
    "timestamp": 1705312200000,
    "displayText": "0x1234...7890 | session-1"
  }
}
```

### Revoke Playback Token

**POST** `/api/v1/content/revoke-token`

Revoke an active playback session.

**Request Body:**
```json
{
  "sessionId": "session-abc-123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "revoked": true,
    "sessionId": "session-abc-123"
  }
}
```

### Get Active Sessions

**GET** `/api/v1/content/sessions/:userAddress`

Get active playback sessions for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "userAddress": "0x1234567890123456789012345678901234567890",
    "activeSessions": 3,
    "sessionIds": ["session-1", "session-2", "session-3"]
  }
}
```

## Token Structure

### JWT Payload

```typescript
interface PlaybackTokenPayload {
  contentId: string;           // Content identifier
  userAddress: string;         // Ethereum wallet address
  sessionId: string;           // Unique session identifier
  watermarkId: string;         // Watermark configuration ID
  issuedAt: number;           // Token issue timestamp
  expiresAt: number;          // Token expiry timestamp
  hlsBaseUrl: string;         // Base URL for HLS streaming
  iss: "reelverse-api";       // Token issuer
  aud: "reelverse-player";    // Token audience
}
```

### Watermark Configuration

```typescript
interface WatermarkConfig {
  userAddress: string;         // Full Ethereum address
  sessionId: string;          // Session ID (truncated to 8 chars)
  timestamp: number;          // Creation timestamp
  displayText: string;        // Text to display on video
}
```

## Security Features

### Token Security
- **JWT Signing**: Tokens signed with HMAC-SHA256
- **Expiry Management**: Configurable token expiry (1 minute to 8 hours)
- **Session Validation**: Tokens validated against active Redis sessions
- **Audience Verification**: Tokens bound to specific audience

### HLS URL Security
- **HMAC Signatures**: URLs signed with separate HMAC key
- **Time-based Expiry**: URLs expire independently of JWT tokens
- **Parameter Integrity**: All URL parameters included in signature
- **Timing-safe Comparison**: Prevents timing attacks on signature validation

### Rate Limiting
- **Concurrent Sessions**: Configurable limit per user (default: 5)
- **Token Generation**: Rate limiting on token creation
- **Session Tracking**: Active session monitoring per user

## Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# HLS Streaming Configuration
HLS_BASE_URL=https://stream.reelverse.com
HLS_SIGNING_KEY=your-hls-signing-key-change-this-in-production
MAX_CONCURRENT_SESSIONS=5

# Redis Configuration
REDIS_URL=redis://localhost:6379
```

### Redis Keys

The service uses the following Redis key patterns:

- `session:{sessionId}` - Playback session data
- `watermark:{watermarkId}` - Watermark configuration
- `user_sessions:{userAddress}` - Set of active session IDs per user

## Error Codes

| Code | Description |
|------|-------------|
| `TOKEN_MISSING` | No token provided in request |
| `TOKEN_INVALID` | Invalid or malformed token |
| `TOKEN_VALIDATION_ERROR` | Server error during validation |
| `HLS_PARAMS_MISSING` | Missing required HLS parameters |
| `HLS_SIGNATURE_INVALID` | Invalid or expired HLS signature |
| `HLS_TOKEN_INVALID` | Invalid token in HLS URL |
| `HLS_VALIDATION_ERROR` | Server error during HLS validation |
| `ACCESS_DENIED` | Content access denied |
| `RATE_LIMIT_EXCEEDED` | Too many concurrent sessions |

## Usage Examples

### Frontend Integration

```typescript
// Generate playback token
const tokenResponse = await fetch('/api/v1/content/playback-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contentId: 'video-123',
    userAddress: walletAddress,
    sessionId: generateSessionId(),
    expiryMinutes: 240
  })
});

const { token, hlsUrl, watermarkId } = await tokenResponse.json();

// Initialize video player with HLS URL
const player = new Hls();
player.loadSource(hlsUrl);
player.attachMedia(videoElement);

// Apply watermark overlay
const watermarkConfig = await fetch(`/api/v1/content/watermark/${watermarkId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Backend Validation

```typescript
// Validate token in middleware
app.use('/streaming/*', validatePlaybackToken);

// Check active sessions
const sessions = await playbackTokenService.getUserActiveSessions(userAddress);
if (sessions.length >= MAX_SESSIONS) {
  throw new Error('Too many active sessions');
}

// Revoke session on content takedown
await playbackTokenService.revokePlaybackToken(sessionId);
```

## Testing

Run the test suite:

```bash
# Unit tests
npm test -- playbackTokenService.test.ts

# Integration tests
npm test -- playbackFlow.test.ts

# All tests
npm test
```

## Monitoring

### Key Metrics
- Token generation rate
- Token validation success/failure rate
- Active sessions per user
- HLS signature validation rate
- Session duration statistics

### Logging
- Token generation events
- Validation failures
- Session revocations
- Rate limit violations
- Security events (invalid signatures, expired tokens)

## Troubleshooting

### Common Issues

1. **Token Validation Fails**
   - Check JWT_SECRET configuration
   - Verify Redis connectivity
   - Ensure session exists in Redis

2. **HLS Signature Invalid**
   - Verify HLS_SIGNING_KEY configuration
   - Check URL parameter integrity
   - Ensure URL hasn't expired

3. **Rate Limit Exceeded**
   - Check MAX_CONCURRENT_SESSIONS setting
   - Verify session cleanup is working
   - Monitor for session leaks

4. **Watermark Not Displaying**
   - Verify watermark configuration in Redis
   - Check watermarkId in token payload
   - Ensure frontend is fetching watermark config

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

This will log detailed information about token generation, validation, and session management.