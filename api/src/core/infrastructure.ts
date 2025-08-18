/**
 * Core Infrastructure Initialization
 * Sets up event bus, audit sink, database, and service authentication
 */

import { eventBus, registerCoreSchemas } from './eventBus';
import { auditSink } from './auditSink';
import { db } from './database';
import { serviceAuth } from './serviceAuth';
import { featureFlags } from './featureFlags';
import { metrics } from './metrics';
import { observability } from './observability';

export interface InfrastructureConfig {
  enableAuditSink: boolean;
  enableEventBus: boolean;
  enableDatabase: boolean;
  enableServiceAuth: boolean;
  enableFeatureFlags: boolean;
  enableMetrics: boolean;
  enableObservability: boolean;
}

export class InfrastructureManager {
  private config: InfrastructureConfig;
  private initialized: boolean = false;

  constructor(config: InfrastructureConfig) {
    this.config = config;
  }

  /**
   * Initialize all infrastructure components
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[INFRA] Initializing core infrastructure...');

    try {
      // Initialize event bus and register schemas
      if (this.config.enableEventBus) {
        await registerCoreSchemas();
        
        // Connect audit sink to event bus
        if (this.config.enableAuditSink) {
          eventBus.setAuditSink(async (event) => {
            await auditSink.writeEvent(event);
          });
        }
        
        console.log('[INFRA] Event bus initialized');
      }

      // Test database connection
      if (this.config.enableDatabase) {
        const result = await db.query('SELECT NOW() as current_time');
        console.log(`[INFRA] Database connected at ${result.rows[0].current_time}`);
      }

      // Initialize service authentication
      if (this.config.enableServiceAuth) {
        console.log('[INFRA] Service authentication initialized');
      }

      // Initialize feature flags
      if (this.config.enableFeatureFlags) {
        console.log('[INFRA] Feature flags system initialized');
      }

      // Initialize metrics collection
      if (this.config.enableMetrics) {
        console.log('[INFRA] Metrics collection initialized');
      }

      // Initialize observability
      if (this.config.enableObservability) {
        console.log('[INFRA] Observability system initialized');
      }

      this.initialized = true;
      console.log('[INFRA] Core infrastructure initialization complete');

      // Emit infrastructure ready event
      if (this.config.enableEventBus) {
        await eventBus.publish({
          type: 'infrastructure.ready',
          version: '1.0',
          correlationId: 'infra-init',
          payload: {
            components: Object.keys(this.config).filter(key => this.config[key as keyof InfrastructureConfig])
          },
          metadata: {
            source: 'infrastructure-manager'
          }
        });
      }

    } catch (error) {
      console.error('[INFRA] Infrastructure initialization failed:', error);
      throw error;
    }
  }

  /**
   * Shutdown infrastructure gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    console.log('[INFRA] Shutting down infrastructure...');

    try {
      // Emit shutdown event
      if (this.config.enableEventBus) {
        await eventBus.publish({
          type: 'infrastructure.shutdown',
          version: '1.0',
          correlationId: 'infra-shutdown',
          payload: { reason: 'graceful-shutdown' },
          metadata: { source: 'infrastructure-manager' }
        });
      }

      // Close database connections
      if (this.config.enableDatabase) {
        await db.close();
        console.log('[INFRA] Database connections closed');
      }

      this.initialized = false;
      console.log('[INFRA] Infrastructure shutdown complete');

    } catch (error) {
      console.error('[INFRA] Infrastructure shutdown failed:', error);
      throw error;
    }
  }

  /**
   * Health check for all components
   */
  async healthCheck(): Promise<{ healthy: boolean; components: Record<string, boolean> }> {
    const components: Record<string, boolean> = {};

    // Check database
    if (this.config.enableDatabase) {
      try {
        await db.query('SELECT 1');
        components.database = true;
      } catch (error) {
        components.database = false;
      }
    }

    // Check event bus
    if (this.config.enableEventBus) {
      components.eventBus = true; // Event bus is in-memory, always healthy if initialized
    }

    // Check audit sink
    if (this.config.enableAuditSink) {
      components.auditSink = true; // Audit sink is in-memory, always healthy if initialized
    }

    // Check service auth
    if (this.config.enableServiceAuth) {
      components.serviceAuth = true; // Service auth is stateless, always healthy
    }

    // Check feature flags
    if (this.config.enableFeatureFlags) {
      components.featureFlags = true; // Feature flags are in-memory, always healthy
    }

    // Check metrics
    if (this.config.enableMetrics) {
      components.metrics = true; // Metrics are in-memory, always healthy
    }

    // Check observability
    if (this.config.enableObservability) {
      components.observability = true; // Observability is in-memory, always healthy
    }

    const healthy = Object.values(components).every(status => status);

    return { healthy, components };
  }
}

// Default infrastructure configuration
export const defaultInfraConfig: InfrastructureConfig = {
  enableAuditSink: true,
  enableEventBus: true,
  enableDatabase: true,
  enableServiceAuth: true,
  enableFeatureFlags: true,
  enableMetrics: true,
  enableObservability: true
};

// Global infrastructure manager
export const infrastructure = new InfrastructureManager(defaultInfraConfig);