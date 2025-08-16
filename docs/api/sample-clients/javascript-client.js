/**
 * JavaScript/Node.js Client for Decentralized Adult Platform API
 * 
 * This sample client demonstrates how to integrate with the platform API
 * for analytics, content search, and entitlement verification.
 */

class PlatformAPIClient {
  constructor(apiKey, baseUrl = 'https://api.platform.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Make authenticated API request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-Correlation-ID': this.generateCorrelationId(),
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API Error: ${data.error?.message || 'Unknown error'}`);
    }

    return data;
  }

  /**
   * Generate correlation ID for request tracking
   */
  generateCorrelationId() {
    return 'client-' + Math.random().toString(36).substr(2, 9);
  }

  // Analytics Methods

  /**
   * Get analytics overview
   */
  async getAnalyticsOverview(period = '24h') {
    return this.request(`/analytics/overview?period=${period}`);
  }

  /**
   * Get revenue metrics
   */
  async getRevenueMetrics(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    return this.request(`/analytics/revenue?${params}`);
  }

  /**
   * Get content performance metrics
   */
  async getContentPerformance(page = 1, limit = 20) {
    return this.request(`/analytics/content/performance?page=${page}&limit=${limit}`);
  }

  // Search Methods

  /**
   * Search content using hybrid search
   */
  async searchContent(query, options = {}) {
    const searchRequest = {
      q: query,
      type: options.type || 'hybrid',
      filters: options.filters || {},
      page: options.page || 1,
      limit: options.limit || 20,
      includeMetadata: options.includeMetadata || false
    };

    return this.request('/search/content', {
      method: 'POST',
      body: JSON.stringify(searchRequest)
    });
  }

  /**
   * Get search suggestions
   */
  async getSearchSuggestions(query) {
    return this.request(`/search/suggestions?q=${encodeURIComponent(query)}`);
  }

  /**
   * Find similar content
   */
  async findSimilarContent(contentId, limit = 10) {
    return this.request(`/search/content/${contentId}/similar?limit=${limit}`);
  }

  /**
   * Get trending content
   */
  async getTrendingContent(period = '24h', limit = 20) {
    return this.request(`/search/trending?period=${period}&limit=${limit}`);
  }

  // Entitlement Methods

  /**
   * Verify user entitlement for content
   */
  async verifyEntitlement(userId, contentId, accessType = 'view') {
    return this.request('/entitlements/verify', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        contentId,
        accessType
      })
    });
  }

  /**
   * Bulk verify entitlements
   */
  async bulkVerifyEntitlements(requests) {
    return this.request('/entitlements/verify/bulk', {
      method: 'POST',
      body: JSON.stringify({ requests })
    });
  }

  /**
   * Get user entitlements
   */
  async getUserEntitlements(userId, page = 1, limit = 20, status = 'active') {
    return this.request(`/entitlements/user/${userId}?page=${page}&limit=${limit}&status=${status}`);
  }

  // Webhook Methods

  /**
   * Create webhook endpoint
   */
  async createWebhookEndpoint(url, events, retryPolicy = null) {
    const endpoint = {
      url,
      events,
      retryPolicy: retryPolicy || {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffSeconds: 300
      }
    };

    return this.request('/webhooks/endpoints', {
      method: 'POST',
      body: JSON.stringify(endpoint)
    });
  }

  /**
   * Get webhook endpoints
   */
  async getWebhookEndpoints() {
    return this.request('/webhooks/endpoints');
  }

  /**
   * Test webhook endpoint
   */
  async testWebhookEndpoint(endpointId, eventType, testData = {}) {
    return this.request(`/webhooks/endpoints/${endpointId}/test`, {
      method: 'POST',
      body: JSON.stringify({
        eventType,
        testData
      })
    });
  }
}

// Webhook signature verification utility
class WebhookVerifier {
  constructor(secret) {
    this.secret = secret;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload, signature) {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Express middleware for webhook verification
   */
  middleware() {
    return (req, res, next) => {
      const signature = req.headers['x-webhook-signature'];
      const payload = JSON.stringify(req.body);

      if (!this.verifySignature(payload, signature)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      next();
    };
  }
}

// Usage Examples
async function examples() {
  const client = new PlatformAPIClient('your-api-key-here');

  try {
    // Get analytics overview
    const overview = await client.getAnalyticsOverview('7d');
    console.log('Analytics Overview:', overview.data);

    // Search for content
    const searchResults = await client.searchContent('fitness workout', {
      type: 'hybrid',
      filters: {
        category: 'fitness',
        minDuration: 300
      },
      limit: 10
    });
    console.log('Search Results:', searchResults.data);

    // Verify entitlement
    const entitlement = await client.verifyEntitlement(
      'user-uuid',
      'content-uuid',
      'stream'
    );
    console.log('Entitlement:', entitlement.data);

    // Create webhook endpoint
    const webhook = await client.createWebhookEndpoint(
      'https://your-app.com/webhooks',
      ['purchase.completed', 'content.uploaded']
    );
    console.log('Webhook Created:', webhook.data);

  } catch (error) {
    console.error('API Error:', error.message);
  }
}

// Export for use in Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PlatformAPIClient, WebhookVerifier };
}

// Example webhook handler (Express.js)
function createWebhookHandler(secret) {
  const express = require('express');
  const verifier = new WebhookVerifier(secret);
  const app = express();

  app.use(express.json());
  app.use('/webhooks', verifier.middleware());

  app.post('/webhooks', (req, res) => {
    const { type, data } = req.body;

    switch (type) {
      case 'purchase.completed':
        console.log('Purchase completed:', data);
        // Handle purchase completion
        break;
      
      case 'content.uploaded':
        console.log('Content uploaded:', data);
        // Handle new content
        break;
      
      case 'payout.processed':
        console.log('Payout processed:', data);
        // Handle payout
        break;
      
      default:
        console.log('Unknown event type:', type);
    }

    res.json({ received: true });
  });

  return app;
}