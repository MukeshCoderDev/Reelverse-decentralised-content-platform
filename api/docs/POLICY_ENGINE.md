# Policy Engine Documentation

## Overview

The Policy Engine is a comprehensive authorization system that evaluates access policies for content based on multiple criteria including age verification, geographic restrictions, subscription status, device limits, and content availability.

## Features

### Core Functionality
- **Multi-factor Policy Evaluation**: Evaluates age, geo, subscription, device, and content policies
- **Signed Playback Tickets**: Creates cryptographically signed tickets with embedded entitlements
- **Device Management**: Tracks and enforces device limits per user
- **Watermark Profiles**: Generates user-specific watermark configurations
- **Emergency Revocation**: Supports immediate ticket revocation for users or content

### Security Features
- **Device Binding**: Tickets are bound to specific devices
- **Short TTL**: Tickets expire within 5 minutes by default (configurable)
- **Cryptographic Signatures**: All tickets are HMAC-signed for integrity
- **Audit Logging**: All policy decisions are logged for compliance

## API Endpoints

### POST /api/v1/policy/evaluate
Evaluates access policies for content without creating a ticket.

**Request:**
```json
{
  "contentId": "content-123",
  "deviceId": "device-456", 
  "sessionId": "session-789"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "restrictions": [],
    "entitlements": [
      {
        "type": "free",
        "hasAccess": true
      }
    ],
    "deviceLimits": {
      "currentDevices": 1,
      "maxDevices": 3,
      "canAddDevice": true,
      "activeDevices": []
    },
    "watermarkProfile": {
      "type": "session_based",
      "position": { "x": 85, "y": 90, "anchor": "bottom-right" },
      "opacity": 0.7,
      "userData": {
        "userId": "user123...",
        "sessionId": "sess789",
        "displayText": "user123... | sess789"
      }
    }
  }
}
```

### POST /api/v1/policy/ticket
Creates a signed playback ticket after policy evaluation.

**Request:**
```json
{
  "contentId": "content-123",
  "deviceId": "device-456",
  "sessionId": "session-789",
  "ttlMinutes": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ticket": {
      "ticketId": "ticket-abc-123",
      "contentId": "content-123",
      "expiresAt": "2024-01-01T12:05:00Z",
      "entitlements": ["free"],
      "watermarkProfile": { ... }
    }
  }
}
```

### POST /api/v1/policy/validate
Validates a playback ticket for CDN authorization.

**Request:**
```json
{
  "ticketId": "ticket-abc-123",
  "deviceId": "device-456",
  "segmentRange": "0-100"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "ticket": {
      "ticketId": "ticket-abc-123",
      "contentId": "content-123",
      "userId": "user-456",
      "expiresAt": "2024-01-01T12:05:00Z",
      "entitlements": ["free"]
    },
    "remainingTTL": 240
  }
}
```

### POST /api/v1/policy/revoke/user
Revokes all active tickets for a user (emergency access revocation).

**Request:**
```json
{
  "userId": "user-456"
}
```

### POST /api/v1/policy/revoke/content
Revokes all active tickets for content (takedown scenarios).

**Request:**
```json
{
  "contentId": "content-123"
}
```

## Policy Types

### Age Verification Policy
- Checks user age verification status
- Blocks access to age-restricted content for unverified users
- Integrates with AgeVerificationService

### Geographic Restriction Policy
- Evaluates user location against content geo-restrictions
- Uses IP geolocation for country-level blocking
- Supports country code whitelist/blacklist

### Entitlement Policy
- Validates subscription or pay-per-view access
- Supports multiple entitlement types (free, subscription, ppv)
- Checks expiration dates and usage limits

### Device Limit Policy
- Enforces concurrent device limits per user
- Tracks active devices with 30-day activity window
- Supports device registration and management

### Content Availability Policy
- Checks content active status and moderation approval
- Blocks access to inactive or blocked content
- Integrates with content management system

## Configuration

### Environment Variables
```bash
# JWT signing for tickets
JWT_SECRET=your-jwt-secret-key
TICKET_SIGNING_KEY=your-ticket-signing-key

# Redis for caching and session storage
REDIS_URL=redis://localhost:6379

# Geolocation service
GEOIP_API_KEY=your-geoip-api-key
```

### Content Policy Configuration
Content policies are stored in Redis with the following structure:

```typescript
interface ContentPolicy {
  contentId: string;
  ageRestricted: boolean;
  geoRestrictions: string[]; // ISO country codes
  entitlementRequired: boolean;
  entitlementType?: 'subscription' | 'ppv';
  price?: number;
  currency?: string;
  deviceLimit: number;
  watermarkRequired: boolean;
  watermarkType: 'static_overlay' | 'forensic_embedding' | 'session_based';
  isActive: boolean;
  moderationStatus: 'approved' | 'pending' | 'blocked';
}
```

## Integration Examples

### CDN Authorization
```typescript
// Validate ticket at CDN edge
const validation = await policyEngine.validateTicket(ticketId, {
  ipAddress: req.ip,
  userAgent: req.get('User-Agent'),
  deviceId: req.headers['x-device-id'],
  segmentRange: req.params.segmentRange,
  timestamp: new Date()
});

if (!validation.valid) {
  return res.status(401).json({ error: validation.error });
}

// Serve content segment
```

### Content Access Check
```typescript
// Check access before serving content
const policyDecision = await policyEngine.evaluateAccess({
  contentId: 'content-123',
  userId: 'user-456',
  deviceId: 'device-789',
  ipAddress: req.ip,
  geolocation: await getGeolocation(req.ip),
  userAgent: req.get('User-Agent')
});

if (!policyDecision.allowed) {
  return res.status(403).json({
    error: 'Access denied',
    restrictions: policyDecision.restrictions
  });
}
```

### Emergency Revocation
```typescript
// Revoke all user access (account suspension)
await policyEngine.revokeUserTickets(userId);

// Revoke content access (takedown)
await policyEngine.revokeContentTickets(contentId);
```

## Performance Considerations

### Caching Strategy
- Content policies cached for 5 minutes
- Device information cached for 30 days
- Geolocation results cached for 1 hour
- Tickets stored in Redis with TTL

### SLA Targets
- Policy evaluation: P95 ≤ 100ms
- Ticket creation: P95 ≤ 150ms
- Ticket validation: P95 ≤ 50ms
- Emergency revocation: P99 ≤ 5 seconds

### Scalability
- Stateless design for horizontal scaling
- Redis clustering for high availability
- Circuit breakers for external service calls
- Graceful degradation on service failures

## Security Considerations

### Ticket Security
- HMAC-SHA256 signatures prevent tampering
- Device binding prevents ticket sharing
- Short TTL limits exposure window
- Cryptographically secure random ticket IDs

### Data Protection
- No PII in watermark display text
- Audit logs exclude sensitive data
- Secure key management for signing
- Rate limiting on API endpoints

### Threat Mitigation
- Prevents credential sharing via device binding
- Mitigates replay attacks with short TTL
- Protects against geo-spoofing with multiple signals
- Audit trail for forensic investigation

## Monitoring and Alerting

### Key Metrics
- Policy evaluation latency and success rate
- Ticket creation and validation rates
- Device limit violations
- Geographic restriction hits
- Emergency revocation events

### Alerts
- High policy evaluation latency (>200ms P95)
- Ticket validation failures (>5% error rate)
- Unusual device registration patterns
- Geographic anomalies
- Service health degradation

## Testing

### Unit Tests
```bash
npm test -- --testPathPattern=policyEngine.test.ts
```

### Integration Tests
```bash
npm test -- --testPathPattern=policyIntegration.test.ts
```

### Load Testing
```bash
# Test policy evaluation under load
npm run test:load -- --endpoint=/api/v1/policy/evaluate
```

## Troubleshooting

### Common Issues

**Ticket Validation Failures**
- Check device ID consistency
- Verify ticket hasn't expired
- Confirm signature key configuration

**Policy Evaluation Errors**
- Check Redis connectivity
- Verify content policy exists
- Confirm geolocation service availability

**Device Limit Issues**
- Review device registration logic
- Check 30-day activity window
- Verify device cleanup processes

### Debug Logging
```bash
# Enable debug logging
DEBUG=policy-engine:* npm start
```

### Health Checks
```bash
# Check policy engine health
curl http://localhost:3001/api/v1/policy/health
```