import { PlatformError } from '../errors/ErrorHandler';
import { ErrorDetails } from '../errors/ErrorCodes';

interface MonitoringConfig {
  apiEndpoint?: string;
  apiKey?: string;
  environment: 'development' | 'staging' | 'production';
  enableConsoleLogging: boolean;
  enableRemoteLogging: boolean;
  sampleRate: number; // 0-1, percentage of errors to send
}

interface ErrorMetrics {
  errorCount: number;
  errorsByCode: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsByCategory: Record<string, number>;
  lastError?: PlatformError;
  lastErrorTime?: number;
}

class ErrorMonitoringService {
  private config: MonitoringConfig;
  private metrics: ErrorMetrics;
  private errorQueue: Array<{ error: PlatformError; details: ErrorDetails; timestamp: number }> = [];
  private flushInterval?: NodeJS.Timeout;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.metrics = {
      errorCount: 0,
      errorsByCode: {},
      errorsBySeverity: {},
      errorsByCategory: {}
    };

    // Start periodic flush of error queue
    if (this.config.enableRemoteLogging) {
      this.flushInterval = setInterval(() => {
        this.flushErrorQueue();
      }, 30000); // Flush every 30 seconds
    }

    // Listen for page unload to flush remaining errors
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushErrorQueue();
      });
    }
  }

  /**
   * Log an error to the monitoring system
   */
  logError(error: PlatformError, details: ErrorDetails): void {
    // Update metrics
    this.updateMetrics(error, details);

    // Console logging
    if (this.config.enableConsoleLogging) {
      this.logToConsole(error, details);
    }

    // Remote logging (with sampling)
    if (this.config.enableRemoteLogging && this.shouldSample()) {
      this.queueForRemoteLogging(error, details);
    }

    // Store last error for debugging
    this.metrics.lastError = error;
    this.metrics.lastErrorTime = Date.now();
  }

  /**
   * Get current error metrics
   */
  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear metrics (useful for testing)
   */
  clearMetrics(): void {
    this.metrics = {
      errorCount: 0,
      errorsByCode: {},
      errorsBySeverity: {},
      errorsByCategory: {}
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Manually flush error queue
   */
  async flushErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0) {
      return;
    }

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      await this.sendErrorsToRemote(errors);
    } catch (error) {
      // If sending fails, put errors back in queue (up to a limit)
      if (this.errorQueue.length < 100) {
        this.errorQueue.unshift(...errors);
      }
      console.error('Failed to send errors to monitoring service:', error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushErrorQueue();
  }

  private updateMetrics(error: PlatformError, details: ErrorDetails): void {
    this.metrics.errorCount++;
    
    // Count by error code
    this.metrics.errorsByCode[error.code] = (this.metrics.errorsByCode[error.code] || 0) + 1;
    
    // Count by severity
    this.metrics.errorsBySeverity[details.severity] = (this.metrics.errorsBySeverity[details.severity] || 0) + 1;
    
    // Count by category
    this.metrics.errorsByCategory[details.category] = (this.metrics.errorsByCategory[details.category] || 0) + 1;
  }

  private logToConsole(error: PlatformError, details: ErrorDetails): void {
    const logLevel = this.getConsoleLogLevel(details.severity);
    const logMethod = console[logLevel] || console.error;

    logMethod.call(console, `[${details.severity.toUpperCase()}] ${details.category} Error:`, {
      code: error.code,
      message: error.message,
      userMessage: details.userMessage,
      timestamp: new Date(error.timestamp).toISOString(),
      requestId: error.requestId,
      context: error.context,
      stack: error.stack
    });
  }

  private getConsoleLogLevel(severity: string): 'error' | 'warn' | 'info' | 'debug' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
        return 'info';
      default:
        return 'debug';
    }
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private queueForRemoteLogging(error: PlatformError, details: ErrorDetails): void {
    // Limit queue size to prevent memory issues
    if (this.errorQueue.length >= 100) {
      this.errorQueue.shift(); // Remove oldest error
    }

    this.errorQueue.push({
      error,
      details,
      timestamp: Date.now()
    });
  }

  private async sendErrorsToRemote(
    errors: Array<{ error: PlatformError; details: ErrorDetails; timestamp: number }>
  ): Promise<void> {
    if (!this.config.apiEndpoint) {
      throw new Error('No monitoring API endpoint configured');
    }

    const payload = {
      environment: this.config.environment,
      errors: errors.map(({ error, details, timestamp }) => ({
        code: error.code,
        message: error.message,
        userMessage: details.userMessage,
        severity: details.severity,
        category: details.category,
        retryable: details.retryable,
        timestamp: error.timestamp,
        requestId: error.requestId,
        context: error.context,
        stack: error.stack,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        queuedAt: timestamp
      }))
    };

    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Monitoring API responded with ${response.status}: ${response.statusText}`);
    }
  }
}

// Default configuration
const defaultConfig: MonitoringConfig = {
  environment: (process.env.NODE_ENV as any) || 'development',
  enableConsoleLogging: true,
  enableRemoteLogging: process.env.NODE_ENV === 'production',
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% sampling in prod, 100% in dev
  apiEndpoint: process.env.REACT_APP_MONITORING_ENDPOINT,
  apiKey: process.env.REACT_APP_MONITORING_API_KEY
};

// Singleton instance
export const errorMonitoring = new ErrorMonitoringService(defaultConfig);

// React hook for error monitoring
export function useErrorMonitoring() {
  return {
    logError: errorMonitoring.logError.bind(errorMonitoring),
    getMetrics: errorMonitoring.getMetrics.bind(errorMonitoring),
    clearMetrics: errorMonitoring.clearMetrics.bind(errorMonitoring),
    flushErrors: errorMonitoring.flushErrorQueue.bind(errorMonitoring)
  };
}

// Performance monitoring for critical operations
export class PerformanceMonitor {
  private static measurements: Map<string, number> = new Map();

  static startMeasurement(operationId: string): void {
    this.measurements.set(operationId, performance.now());
  }

  static endMeasurement(operationId: string): number {
    const startTime = this.measurements.get(operationId);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operationId}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.measurements.delete(operationId);

    // Log slow operations
    if (duration > 5000) { // 5 seconds
      console.warn(`Slow operation detected: ${operationId} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  static measureAsync<T>(
    operationId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    this.startMeasurement(operationId);
    
    return operation().finally(() => {
      this.endMeasurement(operationId);
    });
  }
}

// Circuit breaker for preventing cascade failures
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
}