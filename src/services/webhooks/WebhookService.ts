import { EventEmitter } from 'events';
import crypto from 'crypto';
import axios from 'axios';
import { z } from 'zod';
import { logger } from '../logging/Logger';
import { redis } from '../redis/RedisClient';

// Webhook event types
export enum WebhookEventType {
  CONTENT_UPLOADED = 'content.uploaded',
  CONTENT_PROCESSED = 'content.processed',
  PURCHASE_COMPLETED = 'purchase.completed',
  PAYOUT_PROCESSED = 'payout.processed',
  LEAK_DETECTED = 'leak.detected',
  COMPLIANCE_VIOLATION = 'compliance.violation',
  USER_REGISTERED = 'user.registered',
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled'
}

// Webhook endpoint configuration
export interface WebhookEndpoint {
  id: string;
  organizationId: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  isActive: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffSeconds: number;
  };
  createdAt: Date;
  lastDeliveryAt?: Date;
  lastSuccessAt?: Date;
}

// Webhook event payload
export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  organizationId: string;
  data: any;
  timestamp: Date;
  version: string;
}

// Webhook delivery attempt
export interface WebhookDelivery {
  id: string;
  eventId: string;
  endpointId: string;
  url: string;
  attempt: number;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  httpStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  deliveredAt?: Date;
  nextRetryAt?: Date;
}

export class WebhookService extends EventEmitter {
  private readonly maxRetryAttempts = 5;
  private readonly initialBackoffMs = 1000;

  constructor() {
    super();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for internal events and convert to webhooks
    this.on('content:uploaded', (data) => this.emitWebhook(WebhookEventType.CONTENT_UPLOADED, data));
    this.on('content:processed', (data) => this.emitWebhook(WebhookEventType.CONTENT_PROCESSED, data));
    this.on('purchase:completed', (data) => this.emitWebhook(WebhookEventType.PURCHASE_COMPLETED, data));
    this.on('payout:processed', (data) => this.emitWebhook(WebhookEventType.PAYOUT_PROCESSED, data));
    this.on('leak:detected', (data) => this.emitWebhook(WebhookEventType.LEAK_DETECTED, data));
    this.on('compliance:violation', (data) => this.emitWebhook(WebhookEventType.COMPLIANCE_VIOLATION, data));
  }

  // Create a new webhook endpoint
  async createEndpoint(endpoint: Omit<WebhookEndpoint, 'id' | 'createdAt'>): Promise<WebhookEndpoint> {
    const newEndpoint: WebhookEndpoint = {
      ...endpoint,
      id: crypto.randomUUID(),
      createdAt: new Date()
    };

    // Store in database (mock for now)
    await this.storeEndpoint(newEndpoint);
    
    logger.info('Webhook endpoint created', { 
      endpointId: newEndpoint.id, 
      organizationId: newEndpoint.organizationId 
    });

    return newEndpoint;
  }

  // Update webhook endpoint
  async updateEndpoint(endpointId: string, updates: Partial<WebhookEndpoint>): Promise<WebhookEndpoint> {
    const endpoint = await this.getEndpoint(endpointId);
    if (!endpoint) {
      throw new Error('Webhook endpoint not found');
    }

    const updatedEndpoint = { ...endpoint, ...updates };
    await this.storeEndpoint(updatedEndpoint);

    logger.info('Webhook endpoint updated', { endpointId });
    return updatedEndpoint;
  }

  // Delete webhook endpoint
  async deleteEndpoint(endpointId: string): Promise<void> {
    await this.removeEndpoint(endpointId);
    logger.info('Webhook endpoint deleted', { endpointId });
  }

  // Emit a webhook event
  async emitWebhook(type: WebhookEventType, data: any): Promise<void> {
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      type,
      organizationId: data.organizationId,
      data,
      timestamp: new Date(),
      version: '1.0'
    };

    // Get all endpoints for this organization that listen to this event type
    const endpoints = await this.getEndpointsForEvent(event.organizationId, type);
    
    // Deliver to each endpoint
    for (const endpoint of endpoints) {
      if (endpoint.isActive) {
        await this.deliverWebhook(event, endpoint);
      }
    }

    logger.info('Webhook event emitted', { 
      eventId: event.id, 
      type, 
      organizationId: event.organizationId,
      endpointCount: endpoints.length 
    });
  }

  // Deliver webhook to specific endpoint
  private async deliverWebhook(event: WebhookEvent, endpoint: WebhookEndpoint): Promise<void> {
    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      eventId: event.id,
      endpointId: endpoint.id,
      url: endpoint.url,
      attempt: 1,
      status: 'pending'
    };

    try {
      await this.attemptDelivery(event, endpoint, delivery);
    } catch (error) {
      logger.error('Webhook delivery failed', { 
        deliveryId: delivery.id, 
        error: error.message 
      });
      
      // Schedule retry if within retry limits
      if (delivery.attempt < endpoint.retryPolicy.maxRetries) {
        await this.scheduleRetry(event, endpoint, delivery);
      }
    }
  }

  // Attempt webhook delivery
  private async attemptDelivery(
    event: WebhookEvent, 
    endpoint: WebhookEndpoint, 
    delivery: WebhookDelivery
  ): Promise<void> {
    const payload = {
      id: event.id,
      type: event.type,
      data: event.data,
      timestamp: event.timestamp.toISOString(),
      version: event.version
    };

    const signature = this.generateSignature(JSON.stringify(payload), endpoint.secret);
    
    try {
      const response = await axios.post(endpoint.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-ID': event.id,
          'X-Webhook-Timestamp': event.timestamp.toISOString(),
          'User-Agent': 'DecentralizedPlatform-Webhooks/1.0'
        },
        timeout: 30000, // 30 second timeout
        validateStatus: (status) => status >= 200 && status < 300
      });

      delivery.status = 'success';
      delivery.httpStatus = response.status;
      delivery.responseBody = JSON.stringify(response.data).substring(0, 1000);
      delivery.deliveredAt = new Date();

      await this.updateEndpointLastSuccess(endpoint.id);
      
      logger.info('Webhook delivered successfully', { 
        deliveryId: delivery.id,
        httpStatus: response.status 
      });
    } catch (error) {
      delivery.status = 'failed';
      delivery.httpStatus = error.response?.status;
      delivery.errorMessage = error.message;
      
      logger.warn('Webhook delivery attempt failed', { 
        deliveryId: delivery.id,
        attempt: delivery.attempt,
        httpStatus: error.response?.status,
        error: error.message 
      });

      throw error;
    } finally {
      await this.storeDelivery(delivery);
    }
  }

  // Schedule webhook retry
  private async scheduleRetry(
    event: WebhookEvent, 
    endpoint: WebhookEndpoint, 
    delivery: WebhookDelivery
  ): Promise<void> {
    const nextAttempt = delivery.attempt + 1;
    const backoffMs = Math.min(
      this.initialBackoffMs * Math.pow(endpoint.retryPolicy.backoffMultiplier, delivery.attempt - 1),
      endpoint.retryPolicy.maxBackoffSeconds * 1000
    );
    
    const nextRetryAt = new Date(Date.now() + backoffMs);
    
    delivery.status = 'retrying';
    delivery.nextRetryAt = nextRetryAt;
    await this.storeDelivery(delivery);

    // Schedule the retry (in production, use a proper job queue)
    setTimeout(async () => {
      const retryDelivery: WebhookDelivery = {
        ...delivery,
        id: crypto.randomUUID(),
        attempt: nextAttempt,
        status: 'pending',
        nextRetryAt: undefined
      };

      try {
        await this.attemptDelivery(event, endpoint, retryDelivery);
      } catch (error) {
        if (nextAttempt < endpoint.retryPolicy.maxRetries) {
          await this.scheduleRetry(event, endpoint, retryDelivery);
        } else {
          logger.error('Webhook delivery failed after all retries', { 
            eventId: event.id,
            endpointId: endpoint.id,
            maxAttempts: endpoint.retryPolicy.maxRetries 
          });
        }
      }
    }, backoffMs);

    logger.info('Webhook retry scheduled', { 
      deliveryId: delivery.id,
      nextAttempt,
      nextRetryAt 
    });
  }

  // Generate webhook signature
  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  // Verify webhook signature
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  // Mock database operations (replace with actual DB calls)
  private async storeEndpoint(endpoint: WebhookEndpoint): Promise<void> {
    await redis.setex(`webhook:endpoint:${endpoint.id}`, 86400, JSON.stringify(endpoint));
  }

  private async getEndpoint(endpointId: string): Promise<WebhookEndpoint | null> {
    const data = await redis.get(`webhook:endpoint:${endpointId}`);
    return data ? JSON.parse(data) : null;
  }

  private async removeEndpoint(endpointId: string): Promise<void> {
    await redis.del(`webhook:endpoint:${endpointId}`);
  }

  private async getEndpointsForEvent(organizationId: string, eventType: WebhookEventType): Promise<WebhookEndpoint[]> {
    // Mock implementation - in production, query database
    return [];
  }

  private async storeDelivery(delivery: WebhookDelivery): Promise<void> {
    await redis.setex(`webhook:delivery:${delivery.id}`, 86400, JSON.stringify(delivery));
  }

  private async updateEndpointLastSuccess(endpointId: string): Promise<void> {
    const endpoint = await this.getEndpoint(endpointId);
    if (endpoint) {
      endpoint.lastSuccessAt = new Date();
      await this.storeEndpoint(endpoint);
    }
  }
}

export const webhookService = new WebhookService();