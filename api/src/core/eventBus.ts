/**
 * Event Bus with Schema Validation and Correlation ID Propagation
 * Supports structured events with cryptographic integrity for audit trails
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { createHash } from 'crypto';

export interface PlatformEvent {
  id: string;
  type: string;
  version: string;
  timestamp: Date;
  correlationId: string;
  payload: any;
  metadata: EventMetadata;
  signature?: string;
}

export interface EventMetadata {
  source: string;
  userId?: string;
  organizationId?: string;
  contentId?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  traceId?: string;
}

export interface EventSchema {
  type: string;
  version: string;
  schema: any; // JSON Schema
  description: string;
}

export interface EventHandler {
  (event: PlatformEvent): Promise<void>;
}

export interface Subscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  unsubscribe: () => void;
}

export class EventBus extends EventEmitter {
  private schemas: Map<string, EventSchema> = new Map();
  private subscriptions: Map<string, Subscription[]> = new Map();
  private signingKey: string;
  private auditSink?: (event: PlatformEvent) => Promise<void>;

  constructor(signingKey?: string) {
    super();
    this.signingKey = signingKey || process.env.EVENT_SIGNING_KEY || 'default-key';
    this.setMaxListeners(100); // Support many subscribers
  }

  /**
   * Register audit sink for WORM storage
   */
  setAuditSink(sink: (event: PlatformEvent) => Promise<void>) {
    this.auditSink = sink;
  }

  /**
   * Register event schema for validation
   */
  async registerSchema(eventType: string, version: string, schema: any, description: string): Promise<void> {
    const key = `${eventType}:${version}`;
    this.schemas.set(key, {
      type: eventType,
      version,
      schema,
      description
    });
  }

  /**
   * Validate event against registered schema
   */
  validateEvent(event: PlatformEvent): { valid: boolean; errors?: string[] } {
    const key = `${event.type}:${event.version}`;
    const schema = this.schemas.get(key);
    
    if (!schema) {
      return { valid: false, errors: [`No schema registered for ${key}`] };
    }

    // Basic validation - in production, use ajv or similar
    const errors: string[] = [];
    
    if (!event.id || typeof event.id !== 'string') {
      errors.push('Event ID is required and must be string');
    }
    
    if (!event.correlationId || typeof event.correlationId !== 'string') {
      errors.push('Correlation ID is required and must be string');
    }
    
    if (!event.timestamp || !(event.timestamp instanceof Date)) {
      errors.push('Timestamp is required and must be Date');
    }
    
    if (!event.metadata || typeof event.metadata !== 'object') {
      errors.push('Metadata is required and must be object');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  /**
   * Sign event for integrity
   */
  private signEvent(event: PlatformEvent): string {
    const payload = JSON.stringify({
      id: event.id,
      type: event.type,
      version: event.version,
      timestamp: event.timestamp.toISOString(),
      correlationId: event.correlationId,
      payload: event.payload,
      metadata: event.metadata
    });
    
    return createHash('sha256')
      .update(payload + this.signingKey)
      .digest('hex');
  }

  /**
   * Publish event with validation and signing
   */
  async publish(eventData: Omit<PlatformEvent, 'id' | 'timestamp' | 'signature'>): Promise<void> {
    const event: PlatformEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      ...eventData
    };

    // Validate event
    const validation = this.validateEvent(event);
    if (!validation.valid) {
      throw new Error(`Event validation failed: ${validation.errors?.join(', ')}`);
    }

    // Sign event
    event.signature = this.signEvent(event);

    // Emit to subscribers
    this.emit(event.type, event);
    this.emit('*', event); // Global listener

    // Send to audit sink if configured
    if (this.auditSink) {
      try {
        await this.auditSink(event);
      } catch (error) {
        console.error('Failed to write to audit sink:', error);
        // Don't fail the event publication
      }
    }
  }

  /**
   * Subscribe to events with typed handler
   */
  async subscribe(eventType: string, handler: EventHandler): Promise<Subscription> {
    const subscription: Subscription = {
      id: uuidv4(),
      eventType,
      handler,
      unsubscribe: () => {
        this.removeListener(eventType, handler);
        const subs = this.subscriptions.get(eventType) || [];
        const index = subs.findIndex(s => s.id === subscription.id);
        if (index >= 0) {
          subs.splice(index, 1);
        }
      }
    };

    // Add to internal tracking
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }
    this.subscriptions.get(eventType)!.push(subscription);

    // Add event listener
    this.on(eventType, handler);

    return subscription;
  }

  /**
   * Get correlation ID from current context (async local storage in production)
   */
  static getCurrentCorrelationId(): string {
    // In production, use AsyncLocalStorage to track correlation IDs
    return process.env.CORRELATION_ID || uuidv4();
  }

  /**
   * Create event with correlation ID propagation
   */
  static createEvent(
    type: string,
    version: string,
    payload: any,
    metadata: Partial<EventMetadata> = {}
  ): Omit<PlatformEvent, 'id' | 'timestamp' | 'signature'> {
    return {
      type,
      version,
      correlationId: this.getCurrentCorrelationId(),
      payload,
      metadata: {
        source: 'reelverse-api',
        traceId: uuidv4(),
        ...metadata
      }
    };
  }
}

// Global event bus instance
export const eventBus = new EventBus();

// Register core event schemas
export async function registerCoreSchemas() {
  await eventBus.registerSchema('upload.started', '1.0', {
    type: 'object',
    properties: {
      contentId: { type: 'string' },
      creatorId: { type: 'string' },
      fileSize: { type: 'number' },
      contentType: { type: 'string' }
    },
    required: ['contentId', 'creatorId', 'fileSize', 'contentType']
  }, 'Content upload initiated');

  await eventBus.registerSchema('transcode.started', '1.0', {
    type: 'object',
    properties: {
      jobId: { type: 'string' },
      contentId: { type: 'string' },
      livepeerAssetId: { type: 'string' },
      profiles: { type: 'array' },
      organizationId: { type: 'string' },
      creatorId: { type: 'string' }
    },
    required: ['jobId', 'contentId', 'livepeerAssetId', 'profiles', 'organizationId', 'creatorId']
  }, 'Transcoding job started');

  await eventBus.registerSchema('transcode.completed', '1.0', {
    type: 'object',
    properties: {
      jobId: { type: 'string' },
      contentId: { type: 'string' },
      manifestUrl: { type: 'string' },
      thumbnailUrl: { type: 'string' },
      renditions: { type: 'array' },
      duration: { type: 'number' },
      organizationId: { type: 'string' },
      creatorId: { type: 'string' }
    },
    required: ['jobId', 'contentId', 'manifestUrl', 'renditions', 'organizationId', 'creatorId']
  }, 'Transcoding job completed');

  await eventBus.registerSchema('transcode.failed', '1.0', {
    type: 'object',
    properties: {
      jobId: { type: 'string' },
      contentId: { type: 'string' },
      error: { type: 'string' },
      retryCount: { type: 'number' },
      canRetry: { type: 'boolean' }
    },
    required: ['jobId', 'contentId', 'error', 'retryCount', 'canRetry']
  }, 'Transcoding job failed');

  await eventBus.registerSchema('transcode.retried', '1.0', {
    type: 'object',
    properties: {
      jobId: { type: 'string' },
      contentId: { type: 'string' },
      retryCount: { type: 'number' },
      livepeerAssetId: { type: 'string' }
    },
    required: ['jobId', 'contentId', 'retryCount', 'livepeerAssetId']
  }, 'Transcoding job retried');

  await eventBus.registerSchema('transcode.cancelled', '1.0', {
    type: 'object',
    properties: {
      jobId: { type: 'string' },
      contentId: { type: 'string' },
      reason: { type: 'string' }
    },
    required: ['jobId', 'contentId', 'reason']
  }, 'Transcoding job cancelled');

  await eventBus.registerSchema('package.completed', '1.0', {
    type: 'object',
    properties: {
      jobId: { type: 'string' },
      contentId: { type: 'string' },
      transcodingJobId: { type: 'string' },
      manifestUrls: { type: 'object' },
      keyIds: { type: 'array' },
      segmentCount: { type: 'number' },
      organizationId: { type: 'string' },
      creatorId: { type: 'string' }
    },
    required: ['jobId', 'contentId', 'transcodingJobId', 'manifestUrls', 'keyIds', 'segmentCount', 'organizationId', 'creatorId']
  }, 'Content packaging completed');

  await eventBus.registerSchema('license.issued', '1.0', {
    type: 'object',
    properties: {
      licenseId: { type: 'string' },
      contentId: { type: 'string' },
      userId: { type: 'string' },
      deviceId: { type: 'string' },
      drmSystem: { type: 'string' },
      expiresAt: { type: 'string' },
      sessionId: { type: 'string' }
    },
    required: ['licenseId', 'contentId', 'userId', 'deviceId', 'drmSystem', 'expiresAt', 'sessionId']
  }, 'DRM license issued');

  await eventBus.registerSchema('license.revoked', '1.0', {
    type: 'object',
    properties: {
      licenseId: { type: 'string' },
      contentId: { type: 'string' },
      userId: { type: 'string' },
      deviceId: { type: 'string' },
      reason: { type: 'string' },
      revokedAt: { type: 'string' },
      sessionsTerminated: { type: 'number' }
    },
    required: ['licenseId', 'contentId', 'userId', 'deviceId', 'reason', 'revokedAt', 'sessionsTerminated']
  }, 'DRM license revoked');

  await eventBus.registerSchema('takedown.initiated', '1.0', {
    type: 'object',
    properties: {
      caseId: { type: 'string' },
      contentId: { type: 'string' },
      reason: { type: 'string' },
      requesterId: { type: 'string' }
    },
    required: ['caseId', 'contentId', 'reason', 'requesterId']
  }, 'Content takedown initiated');

  await eventBus.registerSchema('key.rotated', '1.0', {
    type: 'object',
    properties: {
      contentId: { type: 'string' },
      oldKeyId: { type: 'string' },
      newKeyId: { type: 'string' },
      rotationType: { type: 'string', enum: ['scheduled', 'emergency'] }
    },
    required: ['contentId', 'oldKeyId', 'newKeyId', 'rotationType']
  }, 'Encryption key rotated');
}