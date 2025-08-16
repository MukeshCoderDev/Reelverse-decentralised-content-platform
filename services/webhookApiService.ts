import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  isActive: boolean;
  organizationId?: string;
  createdAt: Date;
  lastDeliveryAt?: Date;
  failureCount: number;
  description?: string;
}

export type WebhookEvent = 
  | 'content.published'
  | 'content.updated'
  | 'content.deleted'
  | 'purchase.completed'
  | 'purchase.refunded'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'user.created'
  | 'user.updated'
  | 'payout.processed'
  | 'compliance.violation'
  | 'leak.detected';

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  data: any;
  timestamp: string;
  organizationId?: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  payload: WebhookPayload;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
}

export interface WebhookDeliveryAttempt {
  timestamp: Date;
  status: number;
  responseTime: number;
  error?: string;
}

export class WebhookApiService {
  private webhooks: Map<string, WebhookEndpoint> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();

  /**
   * Create a new webhook endpoint
   */
  async createWebhook(
    url: string,
    events: WebhookEvent[],
    organizationId?: string,
    description?: string
  ): Promise<WebhookEndpoint> {
    // Validate URL
    this.validateWebhookUrl(url);
    
    // Validate events
    if (!events || events.length === 0) {
      throw new Error('At least one event must be specified');
    }

    const webhook: WebhookEndpoint = {
      id: uuidv4(),
      url,
      events,
      secret: this.generateWebhookSecret(),
      isActive: true,
      organizationId,
      createdAt: new Date(),
      failureCount: 0,
      description
    };

    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  /**
   * Update webhook endpoint
   */
  async updateWebhook(
    webhookId: string,
    updates: Partial<Pick<WebhookEndpoint, 'url' | 'events' | 'isActive' | 'description'>>
  ): Promise<WebhookEndpoint> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    if (updates.url) {
      this.validateWebhookUrl(updates.url);
      webhook.url = updates.url;
    }

    if (updates.events) {
      if (updates.events.length === 0) {
        throw new Error('At least one event must be specified');
      }
      webhook.events = updates.events;
    }

    if (updates.isActive !== undefined) {
      webhook.isActive = updates.isActive;
    }

    if (updates.description !== undefined) {
      webhook.description = updates.description;
    }

    return webhook;
  }

  /**
   * Delete webhook endpoint
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    this.webhooks.delete(webhookId);
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(webhookId: string): Promise<WebhookEndpoint | null> {
    return this.webhooks.get(webhookId) || null;
  }

  /**
   * List webhooks for organization
   */
  async listWebhooks(organizationId?: string): Promise<WebhookEndpoint[]> {
    const webhooks = Array.from(this.webhooks.values());
    
    if (organizationId) {
      return webhooks.filter(w => w.organizationId === organizationId);
    }
    
    return webhooks;
  }

  /**
   * Send webhook event
   */
  async sendWebhookEvent(
    event: WebhookEvent,
    data: any,
    organizationId?: string
  ): Promise<void> {
    const payload: WebhookPayload = {
      id: uuidv4(),
      event,
      data,
      timestamp: new Date().toISOString(),
      organizationId
    };

    // Find webhooks that should receive this event
    const relevantWebhooks = Array.from(this.webhooks.values()).filter(webhook => 
      webhook.isActive && 
      webhook.events.includes(event) &&
      (!organizationId || webhook.organizationId === organizationId)
    );

    // Queue deliveries for each webhook
    for (const webhook of relevantWebhooks) {
      await this.queueWebhookDelivery(webhook, payload);
    }
  }

  /**
   * Queue webhook delivery
   */
  private async queueWebhookDelivery(
    webhook: WebhookEndpoint,
    payload: WebhookPayload
  ): Promise<void> {
    const delivery: WebhookDelivery = {
      id: uuidv4(),
      webhookId: webhook.id,
      payload,
      status: 'pending',
      attempts: 0
    };

    this.deliveries.set(delivery.id, delivery);
    
    // Attempt immediate delivery
    await this.attemptWebhookDelivery(delivery);
  }

  /**
   * Attempt webhook delivery
   */
  private async attemptWebhookDelivery(delivery: WebhookDelivery): Promise<void> {
    const webhook = this.webhooks.get(delivery.webhookId);
    if (!webhook) {
      delivery.status = 'failed';
      delivery.error = 'Webhook endpoint not found';
      return;
    }

    delivery.attempts++;
    delivery.lastAttemptAt = new Date();
    delivery.status = 'retrying';

    try {
      const signature = this.generateSignature(delivery.payload, webhook.secret);
      
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': delivery.payload.event,
          'X-Webhook-ID': delivery.payload.id,
          'User-Agent': 'Platform-Webhooks/1.0'
        },
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      delivery.responseStatus = response.status;
      delivery.responseBody = await response.text();

      if (response.ok) {
        delivery.status = 'delivered';
        webhook.lastDeliveryAt = new Date();
        webhook.failureCount = 0;
      } else {
        throw new Error(`HTTP ${response.status}: ${delivery.responseBody}`);
      }

    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error instanceof Error ? error.message : 'Unknown error';
      webhook.failureCount++;

      // Schedule retry if we haven't exceeded max attempts
      if (delivery.attempts < 5) {
        const retryDelay = Math.min(Math.pow(2, delivery.attempts) * 1000, 300000); // Exponential backoff, max 5 minutes
        delivery.nextRetryAt = new Date(Date.now() + retryDelay);
        
        // In a real implementation, this would be handled by a job queue
        setTimeout(() => {
          this.attemptWebhookDelivery(delivery);
        }, retryDelay);
      }
    }
  }

  /**
   * Get webhook deliveries
   */
  async getWebhookDeliveries(
    webhookId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    deliveries: WebhookDelivery[];
    totalCount: number;
    page: number;
    hasMore: boolean;
  }> {
    const allDeliveries = Array.from(this.deliveries.values())
      .filter(d => d.webhookId === webhookId)
      .sort((a, b) => (b.lastAttemptAt?.getTime() || 0) - (a.lastAttemptAt?.getTime() || 0));

    const startIndex = (page - 1) * limit;
    const paginatedDeliveries = allDeliveries.slice(startIndex, startIndex + limit);

    return {
      deliveries: paginatedDeliveries,
      totalCount: allDeliveries.length,
      page,
      hasMore: startIndex + limit < allDeliveries.length
    };
  }

  /**
   * Retry failed webhook delivery
   */
  async retryWebhookDelivery(deliveryId: string): Promise<void> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      throw new Error('Delivery not found');
    }

    if (delivery.status === 'delivered') {
      throw new Error('Cannot retry successful delivery');
    }

    await this.attemptWebhookDelivery(delivery);
  }

  /**
   * Generate webhook secret
   */
  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
    
    return `sha256=${signature}`;
  }

  /**
   * Validate webhook URL
   */
  private validateWebhookUrl(url: string): void {
    try {
      const parsedUrl = new URL(url);
      
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Webhook URL must use HTTP or HTTPS');
      }

      if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
        throw new Error('Localhost URLs are not allowed for webhooks');
      }

    } catch (error) {
      throw new Error('Invalid webhook URL format');
    }
  }

  /**
   * Verify webhook signature (for webhook receivers)
   */
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    const receivedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  }
}

export const webhookApiService = new WebhookApiService();