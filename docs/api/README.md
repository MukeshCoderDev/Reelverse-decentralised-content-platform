# Decentralized Adult Platform API Documentation

## Overview

The Decentralized Adult Platform API provides programmatic access to analytics, content search, entitlement verification, and webhook management. This RESTful API is designed for agencies, partners, and developers who want to integrate with the platform.

## Base URL

```
https://api.platform.com/v1
```

## Authentication

All API requests require authentication using API keys. Include your API key in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

### API Key Scopes

API keys are scoped to specific permissions:

- `read:analytics` - Access to analytics and reporting data
- `search:content` - Content search and discovery capabilities  
- `verify:entitlements` - User entitlement verification
- `receive:webhooks` - Webhook endpoint management

## Rate Limiting

Rate limits are enforced per API key:

- **Default**: 100 requests per minute
- **Authenticated**: 1000 requests per minute (with valid API key)
- **Custom**: Higher limits available based on API key configuration

Rate limit information is included in response headers:

```
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-15T10:30:00Z
```

## Request/Response Format

### Request Headers

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
X-Correlation-ID: optional-tracking-id
```

### Response Format

All API responses follow a consistent envelope format:

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "meta": {
    "correlationId": "req-123456",
    "timestamp": "2024-01-15T10:00:00Z",
    "version": "1.0"
  }
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      // Additional error details
    }
  },
  "meta": {
    "correlationId": "req-123456",
    "timestamp": "2024-01-15T10:00:00Z",
    "version": "1.0"
  }
}
```

## API Endpoints

### Analytics API

Access analytics and reporting data for your organization.

#### Get Analytics Overview
```
GET /analytics/overview?period=24h
```

Returns high-level metrics including revenue, user engagement, and content performance.

#### Get Revenue Metrics
```
GET /analytics/revenue?startDate=2024-01-01&endDate=2024-01-31
```

Returns detailed revenue analytics with breakdowns by time period, content type, and user segments.

#### Get Content Performance
```
GET /analytics/content/performance?page=1&limit=20
```

Returns performance metrics for individual content items including views, purchases, and engagement.

### Search API

Search and discover content using AI-powered semantic search.

#### Search Content
```
POST /search/content
```

Request body:
```json
{
  "q": "fitness workout",
  "type": "hybrid",
  "filters": {
    "category": "fitness",
    "minDuration": 300,
    "tags": ["workout", "training"]
  },
  "page": 1,
  "limit": 20,
  "includeMetadata": false
}
```

Search types:
- `semantic` - Vector-based semantic search
- `hybrid` - Combines semantic and keyword search
- `keyword` - Traditional keyword search

#### Get Search Suggestions
```
GET /search/suggestions?q=fitness
```

Returns autocomplete suggestions based on the query.

#### Find Similar Content
```
GET /search/content/{contentId}/similar?limit=10&threshold=0.7
```

Returns content similar to the specified content ID using vector similarity.

### Entitlements API

Verify user access rights and entitlements.

#### Verify Entitlement
```
POST /entitlements/verify
```

Request body:
```json
{
  "userId": "user-uuid",
  "contentId": "content-uuid", 
  "accessType": "view"
}
```

Access types: `view`, `download`, `stream`

#### Bulk Verify Entitlements
```
POST /entitlements/verify/bulk
```

Request body:
```json
{
  "requests": [
    {
      "userId": "user-1",
      "contentId": "content-1",
      "accessType": "view"
    },
    {
      "userId": "user-2", 
      "contentId": "content-2",
      "accessType": "stream"
    }
  ]
}
```

#### Get User Entitlements
```
GET /entitlements/user/{userId}?page=1&limit=20&status=active
```

Returns all entitlements for a specific user.

### Webhooks API

Manage webhook endpoints for real-time event notifications.

#### Create Webhook Endpoint
```
POST /webhooks/endpoints
```

Request body:
```json
{
  "url": "https://your-app.com/webhooks",
  "events": [
    "purchase.completed",
    "content.uploaded",
    "payout.processed"
  ],
  "retryPolicy": {
    "maxRetries": 3,
    "backoffMultiplier": 2,
    "maxBackoffSeconds": 300
  }
}
```

#### Available Webhook Events

- `content.uploaded` - New content uploaded
- `content.processed` - Content processing completed
- `purchase.completed` - Purchase transaction completed
- `payout.processed` - Creator payout processed
- `leak.detected` - Content leak detected
- `compliance.violation` - Compliance issue found
- `user.registered` - New user registration
- `subscription.created` - Subscription created
- `subscription.cancelled` - Subscription cancelled

#### Webhook Payload Format

```json
{
  "id": "event-uuid",
  "type": "purchase.completed",
  "data": {
    "purchaseId": "purchase-uuid",
    "userId": "user-uuid",
    "contentId": "content-uuid",
    "amount": "29.99",
    "currency": "USDC"
  },
  "timestamp": "2024-01-15T10:00:00Z",
  "version": "1.0"
}
```

#### Webhook Signature Verification

Webhooks are signed using HMAC-SHA256. Verify signatures to ensure authenticity:

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `MISSING_API_KEY` | API key not provided |
| `INVALID_API_KEY` | API key is invalid or expired |
| `INSUFFICIENT_SCOPE` | API key lacks required permissions |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| `VALIDATION_ERROR` | Request validation failed |
| `NOT_FOUND` | Resource not found |
| `INTERNAL_ERROR` | Internal server error |

## SDKs and Sample Code

### JavaScript/Node.js
```javascript
const { PlatformAPIClient } = require('./sample-clients/javascript-client');

const client = new PlatformAPIClient('your-api-key');
const overview = await client.getAnalyticsOverview('7d');
```

### Python
```python
from sample_clients.python_client import PlatformAPIClient

client = PlatformAPIClient('your-api-key')
overview = client.get_analytics_overview('7d')
```

## Interactive Documentation

Visit our interactive API documentation at:
```
https://api.platform.com/docs
```

The interactive docs allow you to:
- Test API endpoints directly
- View request/response schemas
- Generate code samples
- Explore authentication flows

## Support

For API support and questions:
- Email: api-support@platform.com
- Documentation: https://docs.platform.com/api
- Status Page: https://status.platform.com

## Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- Analytics, Search, Entitlements, and Webhooks endpoints
- Rate limiting and authentication
- Interactive documentation
- JavaScript and Python SDKs