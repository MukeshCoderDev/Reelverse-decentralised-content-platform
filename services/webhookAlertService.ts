/**
 * Webhook Alert Service
 * Handles webhook notifications for SLO threshold breaches and incidents
 */

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret?: string;
  enabled: boolean;
  events: WebhookEventType[];
  headers?: Record<string, string>;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  createdAt: Date;
  lastTriggered?: Date;
  successCount: number;
  failureCount: number;
}

export type WebhookEventType = 
  | 'slo.breach.warning'
  | 'slo.breach.critical'
  | 'incident.created'
  | 'incident.updated'
  | 'incident.resolved'
  | 'service.degraded'
  | 'service.outage'
  | 'metric.anomaly';

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: Date;
  data: any;
  metadata: {
    webhookId: string;
    deliveryId: string;
    attempt: number;
  };
}

export interface SLOBreachAlert {
  metric: string;
  currentValue: number;
  threshold: number;
  severity: 'warning' | 'critical';
  description: string;
  timestamp: Date;
  windowDuration: number;
  sampleSize: number;
}

export interface IncidentAlert {
  incident: {
    id: string;
    title: string;
    description: string;
    status: string;
    severity: string;
    startedAt: Date;
    resolvedAt?: Date;
    affectedServices: string[];
  };
  action: 'created' | 'updated' | 'resolved';
}

export interface ServiceAlert {
  serviceName: string;
  status: string;
  previousStatus: string;
  uptime: number;
  responseTime: number;
  timestamp: Date;
}

export class WebhookAlertService {
  private static instance: WebhookAlertService;
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private deliveryQueue: Array<{
    endpoint: WebhookEndpoint;
    payload: WebhookPayload;
    attempt: number;
    scheduledAt: Date;
  }> = [];
  private processingTimer?: NodeJS.Timeout;

  private constructor() {
    this.startDeliveryProcessor();
    this.setupDefaultEndpoints();
  }

  public static getInstance(): WebhookAlertService {
    if (!WebhookAlertService.instance) {
      WebhookAlertService.instance = new WebhookAlertService();
    }
    return WebhookAlertService.instance;
  }

  /**
   * Setup default webhook endpoints for demo
   */
  private setupDefaultEndpoints(): void {
    // Slack webhook example
    this.addEndpoint({
      name: 'Operations Slack',
      url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK',
      events: ['slo.breach.critical', 'incident.created', 'service.outage'],
      headers: {
        'Content-Type': 'application/json'
      },
      retryConfig: {
        maxRetries: 3,
        retryDelay: 5000,
        backoffMultiplier: 2
      }
    });

    // Discord webhook example
    this.addEndpoint({
      name: 'Engineering Discord',
      url: 'https://discord.com/api/webhooks/YOUR/DISCORD/WEBHOOK',
      events: ['slo.breach.warning', 'slo.breach.critical', 'metric.anomaly'],
      headers: {
        'Content-Type': 'application/json'
      },
      retryConfig: {
        maxRetries: 2,
        retryDelay: 3000,
        backoffMultiplier: 1.5
      }
    });

    // PagerDuty webhook example
    this.addEndpoint({
      name: 'PagerDuty Alerts',
      url: 'https://events.pagerduty.com/v2/enqueue',
      events: ['slo.breach.critical', 'incident.created', 'service.outage'],
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Token token=YOUR_PAGERDUTY_TOKEN'
      },
      retryConfig: {
        maxRetries: 5,
        retryDelay: 2000,
        backoffMultiplier: 2
      }
    });

    // Custom monitoring system webhook
    this.addEndpoint({
      name: 'Internal Monitoring',
      url: 'https://monitoring.internal.com/webhooks/alerts',
      events: ['slo.breach.warning', 'slo.breach.critical', 'incident.created', 'incident.updated', 'incident.resolved'],
      secret: 'your-webhook-secret',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Platform-Webhook/1.0'
      },
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2
      }
    });
  }

  /**
   * Add a new webhook endpoint
   */
  addEndpoint(config: {
    name: string;
    url: string;
    events: WebhookEventType[];
    secret?: string;
    headers?: Record<string, string>;
    retryConfig?: Partial<WebhookEndpoint['retryConfig']>;
  }): string {
    const id = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const endpoint: WebhookEndpoint = {
      id,
      name: config.name,
      url: config.url,
      secret: config.secret,
      enabled: true,
      events: config.events,
      headers: config.headers,
      retryConfig: {
        maxRetries: 3,
        retryDelay: 5000,
        backoffMultiplier: 2,
        ...config.retryConfig
      },
      createdAt: new Date(),
      successCount: 0,
      failureCount: 0
    };

    this.endpoints.set(id, endpoint);
    console.log(`Webhook endpoint added: ${config.name} (${id})`);
    
    return id;
  }

  /**
   * Remove a webhook endpoint
   */
  removeEndpoint(id: string): boolean {
    const removed = this.endpoints.delete(id);
    if (removed) {
      console.log(`Webhook endpoint removed: ${id}`);
    }
    return removed;
  }

  /**
   * Update a webhook endpoint
   */
  updateEndpoint(id: string, updates: Partial<WebhookEndpoint>): boolean {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) {
      return false;
    }

    const updatedEndpoint = { ...endpoint, ...updates };
    this.endpoints.set(id, updatedEndpoint);
    
    console.log(`Webhook endpoint updated: ${id}`);
    return true;
  }

  /**
   * Get all webhook endpoints
   */
  getEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Get a specific webhook endpoint
   */
  getEndpoint(id: string): WebhookEndpoint | undefined {
    return this.endpoints.get(id);
  }

  /**
   * Send SLO breach alert
   */
  async sendSLOBreachAlert(alert: SLOBreachAlert): Promise<void> {
    const eventType: WebhookEventType = alert.severity === 'critical' 
      ? 'slo.breach.critical' 
      : 'slo.breach.warning';

    const payload = this.createPayload(eventType, {
      alert,
      formatted: {
        title: `SLO Breach: ${alert.metric}`,
        message: `${alert.description}\nCurrent: ${alert.currentValue}, Threshold: ${alert.threshold}`,
        severity: alert.severity,
        timestamp: alert.timestamp.toISOString(),
        metric: alert.metric,
        breach_percentage: ((alert.currentValue - alert.threshold) / alert.threshold * 100).toFixed(2)
      }
    });

    await this.triggerWebhooks(eventType, payload);
  }

  /**
   * Send incident alert
   */
  async sendIncidentAlert(alert: IncidentAlert): Promise<void> {
    const eventType: WebhookEventType = `incident.${alert.action}` as WebhookEventType;

    const payload = this.createPayload(eventType, {
      incident: alert.incident,
      action: alert.action,
      formatted: {
        title: `Incident ${alert.action}: ${alert.incident.title}`,
        message: alert.incident.description,
        severity: alert.incident.severity,
        status: alert.incident.status,
        affected_services: alert.incident.affectedServices.join(', '),
        started_at: alert.incident.startedAt.toISOString(),
        resolved_at: alert.incident.resolvedAt?.toISOString(),
        duration: alert.incident.resolvedAt 
          ? this.formatDuration(alert.incident.resolvedAt.getTime() - alert.incident.startedAt.getTime())
          : null
      }
    });

    await this.triggerWebhooks(eventType, payload);
  }

  /**
   * Send service alert
   */
  async sendServiceAlert(alert: ServiceAlert): Promise<void> {
    const eventType: WebhookEventType = alert.status === 'major_outage' || alert.status === 'partial_outage'
      ? 'service.outage'
      : 'service.degraded';

    const payload = this.createPayload(eventType, {
      service: alert,
      formatted: {
        title: `Service ${alert.status}: ${alert.serviceName}`,
        message: `${alert.serviceName} status changed from ${alert.previousStatus} to ${alert.status}`,
        service_name: alert.serviceName,
        status: alert.status,
        previous_status: alert.previousStatus,
        uptime: `${alert.uptime.toFixed(2)}%`,
        response_time: `${alert.responseTime.toFixed(0)}ms`,
        timestamp: alert.timestamp.toISOString()
      }
    });

    await this.triggerWebhooks(eventType, payload);
  }

  /**
   * Send metric anomaly alert
   */
  async sendMetricAnomalyAlert(metric: string, currentValue: number, expectedValue: number, deviation: number): Promise<void> {
    const payload = this.createPayload('metric.anomaly', {
      metric,
      current_value: currentValue,
      expected_value: expectedValue,
      deviation_percentage: deviation,
      formatted: {
        title: `Metric Anomaly: ${metric}`,
        message: `${metric} is ${deviation.toFixed(1)}% ${deviation > 0 ? 'above' : 'below'} expected value`,
        current: currentValue,
        expected: expectedValue,
        deviation: `${deviation.toFixed(1)}%`
      }
    });

    await this.triggerWebhooks('metric.anomaly', payload);
  }

  /**
   * Test a webhook endpoint
   */
  async testEndpoint(id: string): Promise<{ success: boolean; error?: string; responseTime?: number }> {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) {
      return { success: false, error: 'Endpoint not found' };
    }

    const testPayload = this.createPayload('slo.breach.warning', {
      test: true,
      message: 'This is a test webhook from the Platform Status System',
      timestamp: new Date().toISOString()
    });

    const startTime = Date.now();
    
    try {
      const response = await this.deliverWebhook(endpoint, testPayload, 1);
      const responseTime = Date.now() - startTime;
      
      return {
        success: response.success,
        error: response.error,
        responseTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Create webhook payload
   */
  private createPayload(event: WebhookEventType, data: any): WebhookPayload {
    return {
      event,
      timestamp: new Date(),
      data,
      metadata: {
        webhookId: '',
        deliveryId: `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        attempt: 1
      }
    };
  }

  /**
   * Trigger webhooks for an event type
   */
  private async triggerWebhooks(eventType: WebhookEventType, payload: WebhookPayload): Promise<void> {
    const relevantEndpoints = Array.from(this.endpoints.values())
      .filter(endpoint => endpoint.enabled && endpoint.events.includes(eventType));

    for (const endpoint of relevantEndpoints) {
      const endpointPayload = {
        ...payload,
        metadata: {
          ...payload.metadata,
          webhookId: endpoint.id
        }
      };

      this.queueDelivery(endpoint, endpointPayload);
    }

    console.log(`Triggered ${relevantEndpoints.length} webhooks for event: ${eventType}`);
  }

  /**
   * Queue webhook delivery
   */
  private queueDelivery(endpoint: WebhookEndpoint, payload: WebhookPayload): void {
    this.deliveryQueue.push({
      endpoint,
      payload,
      attempt: 1,
      scheduledAt: new Date()
    });
  }

  /**
   * Start the delivery processor
   */
  private startDeliveryProcessor(): void {
    this.processingTimer = setInterval(async () => {
      await this.processDeliveryQueue();
    }, 1000); // Process every second
  }

  /**
   * Process the delivery queue
   */
  private async processDeliveryQueue(): Promise<void> {
    if (this.deliveryQueue.length === 0) {
      return;
    }

    const now = new Date();
    const readyDeliveries = this.deliveryQueue.filter(delivery => delivery.scheduledAt <= now);
    
    // Remove processed deliveries from queue
    this.deliveryQueue = this.deliveryQueue.filter(delivery => delivery.scheduledAt > now);

    for (const delivery of readyDeliveries) {
      try {
        const result = await this.deliverWebhook(delivery.endpoint, delivery.payload, delivery.attempt);
        
        if (result.success) {
          delivery.endpoint.successCount++;
          delivery.endpoint.lastTriggered = now;
          console.log(`Webhook delivered successfully: ${delivery.endpoint.name}`);
        } else {
          delivery.endpoint.failureCount++;
          
          // Retry if within retry limits
          if (delivery.attempt < delivery.endpoint.retryConfig.maxRetries) {
            const nextAttempt = delivery.attempt + 1;
            const delay = delivery.endpoint.retryConfig.retryDelay * 
                         Math.pow(delivery.endpoint.retryConfig.backoffMultiplier, delivery.attempt - 1);
            
            this.deliveryQueue.push({
              ...delivery,
              attempt: nextAttempt,
              scheduledAt: new Date(now.getTime() + delay)
            });
            
            console.log(`Webhook delivery failed, retrying in ${delay}ms: ${delivery.endpoint.name} (attempt ${nextAttempt})`);
          } else {
            console.error(`Webhook delivery failed after ${delivery.attempt} attempts: ${delivery.endpoint.name}`, result.error);
          }
        }
      } catch (error) {
        console.error(`Error processing webhook delivery: ${delivery.endpoint.name}`, error);
        delivery.endpoint.failureCount++;
      }
    }
  }

  /**
   * Deliver webhook to endpoint
   */
  private async deliverWebhook(
    endpoint: WebhookEndpoint, 
    payload: WebhookPayload, 
    attempt: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const body = JSON.stringify(payload);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Platform-Webhook/1.0',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Delivery': payload.metadata.deliveryId,
        'X-Webhook-Attempt': attempt.toString(),
        ...endpoint.headers
      };

      // Add signature if secret is provided
      if (endpoint.secret) {
        const signature = await this.generateSignature(body, endpoint.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (response.ok) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${response.statusText}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Generate webhook signature
   */
  private async generateSignature(body: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `sha256=${hashHex}`;
  }

  /**
   * Format duration in human readable format
   */
  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get webhook statistics
   */
  getStatistics(): {
    totalEndpoints: number;
    enabledEndpoints: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    queueSize: number;
  } {
    const endpoints = Array.from(this.endpoints.values());
    const totalDeliveries = endpoints.reduce((sum, e) => sum + e.successCount + e.failureCount, 0);
    const successfulDeliveries = endpoints.reduce((sum, e) => sum + e.successCount, 0);
    const failedDeliveries = endpoints.reduce((sum, e) => sum + e.failureCount, 0);

    return {
      totalEndpoints: endpoints.length,
      enabledEndpoints: endpoints.filter(e => e.enabled).length,
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      queueSize: this.deliveryQueue.length
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }
    
    this.deliveryQueue = [];
    this.endpoints.clear();
  }
}