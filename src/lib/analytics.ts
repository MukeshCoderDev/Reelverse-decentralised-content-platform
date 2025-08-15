// Comprehensive analytics and monitoring system

export interface AnalyticsEvent {
  event: string;
  properties: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp: number;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface BusinessMetric {
  name: string;
  value: number;
  period: string;
  timestamp: number;
}

class AnalyticsService {
  private sessionId: string;
  private userId?: string;
  private performanceObserver?: PerformanceObserver;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializePerformanceTracking();
  }

  // User identification
  identify(userId: string, traits?: Record<string, any>) {
    this.userId = userId;
    this.track('user_identified', { userId, ...traits });
  }

  // Event tracking
  track(event: string, properties: Record<string, any> = {}) {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        url: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    };

    this.sendEvent(analyticsEvent);
  }

  // Page view tracking
  page(name?: string, properties: Record<string, any> = {}) {
    this.track('page_viewed', {
      page: name || document.title,
      path: window.location.pathname,
      ...properties
    });
  }

  // Content-specific tracking
  trackContentView(contentId: string, properties: Record<string, any> = {}) {
    this.track('content_viewed', {
      contentId,
      ...properties
    });
  }

  trackContentPurchase(contentId: string, amount: number, currency: string, method: string) {
    this.track('content_purchased', {
      contentId,
      amount,
      currency,
      paymentMethod: method,
      revenue: amount
    });
  }

  trackVideoPlayback(contentId: string, duration: number, quality: string) {
    this.track('video_playback_started', {
      contentId,
      duration,
      quality,
      device: this.getDeviceType()
    });
  }

  trackVideoComplete(contentId: string, watchTime: number, totalDuration: number) {
    const completionRate = (watchTime / totalDuration) * 100;
    this.track('video_playback_completed', {
      contentId,
      watchTime,
      totalDuration,
      completionRate,
      device: this.getDeviceType()
    });
  }

  // Conversion tracking
  trackConversion(type: string, value?: number, properties: Record<string, any> = {}) {
    this.track('conversion', {
      conversionType: type,
      value,
      ...properties
    });
  }

  // Error tracking
  trackError(error: Error, context?: Record<string, any>) {
    this.track('error_occurred', {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
      ...context
    });
  }

  // Performance tracking
  trackPerformance(metric: Omit<PerformanceMetric, 'timestamp'>) {
    const performanceMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now()
    };

    this.sendPerformanceMetric(performanceMetric);
  }

  // Business metrics
  trackBusinessMetric(metric: Omit<BusinessMetric, 'timestamp'>) {
    const businessMetric: BusinessMetric = {
      ...metric,
      timestamp: Date.now()
    };

    this.sendBusinessMetric(businessMetric);
  }

  // Web Vitals tracking
  private initializePerformanceTracking() {
    // Track Core Web Vitals
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      this.observePerformanceEntry('largest-contentful-paint', (entries) => {
        const lcp = entries[entries.length - 1];
        this.trackPerformance({
          name: 'largest_contentful_paint',
          value: lcp.startTime,
          unit: 'ms'
        });
      });

      // First Input Delay
      this.observePerformanceEntry('first-input', (entries) => {
        const fid = entries[0];
        this.trackPerformance({
          name: 'first_input_delay',
          value: fid.processingStart - fid.startTime,
          unit: 'ms'
        });
      });

      // Cumulative Layout Shift
      let clsValue = 0;
      this.observePerformanceEntry('layout-shift', (entries) => {
        for (const entry of entries) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        this.trackPerformance({
          name: 'cumulative_layout_shift',
          value: clsValue,
          unit: 'score'
        });
      });
    }

    // Track page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        this.trackPerformance({
          name: 'page_load_time',
          value: navigation.loadEventEnd - navigation.fetchStart,
          unit: 'ms'
        });

        this.trackPerformance({
          name: 'dom_content_loaded',
          value: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          unit: 'ms'
        });

        this.trackPerformance({
          name: 'time_to_first_byte',
          value: navigation.responseStart - navigation.fetchStart,
          unit: 'ms'
        });
      }, 0);
    });
  }

  private observePerformanceEntry(type: string, callback: (entries: PerformanceEntry[]) => void) {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true });
    } catch (error) {
      console.warn(`Failed to observe ${type}:`, error);
    }
  }

  private async sendEvent(event: AnalyticsEvent) {
    try {
      // Send to analytics service
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
    } catch (error) {
      console.warn('Failed to send analytics event:', error);
    }
  }

  private async sendPerformanceMetric(metric: PerformanceMetric) {
    try {
      await fetch('/api/analytics/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric)
      });
    } catch (error) {
      console.warn('Failed to send performance metric:', error);
    }
  }

  private async sendBusinessMetric(metric: BusinessMetric) {
    try {
      await fetch('/api/analytics/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric)
      });
    } catch (error) {
      console.warn('Failed to send business metric:', error);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private getDeviceType(): string {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }
}

// Singleton instance
export const analytics = new AnalyticsService();

// React hook for analytics
export function useAnalytics() {
  const trackEvent = (event: string, properties?: Record<string, any>) => {
    analytics.track(event, properties);
  };

  const trackPageView = (name?: string, properties?: Record<string, any>) => {
    analytics.page(name, properties);
  };

  const trackConversion = (type: string, value?: number, properties?: Record<string, any>) => {
    analytics.trackConversion(type, value, properties);
  };

  return {
    trackEvent,
    trackPageView,
    trackConversion,
    identify: analytics.identify.bind(analytics),
    trackError: analytics.trackError.bind(analytics)
  };
}

// Monitoring and alerting
class MonitoringService {
  private errorThreshold = 10; // errors per minute
  private errorCount = 0;
  private lastErrorReset = Date.now();

  trackError(error: Error, context?: Record<string, any>) {
    this.errorCount++;
    
    // Reset counter every minute
    const now = Date.now();
    if (now - this.lastErrorReset > 60000) {
      this.errorCount = 1;
      this.lastErrorReset = now;
    }

    // Send alert if threshold exceeded
    if (this.errorCount >= this.errorThreshold) {
      this.sendAlert('high_error_rate', {
        errorCount: this.errorCount,
        timeWindow: '1 minute',
        lastError: error.message
      });
    }

    // Track in analytics
    analytics.trackError(error, context);
  }

  trackPerformanceIssue(metric: string, value: number, threshold: number) {
    if (value > threshold) {
      this.sendAlert('performance_degradation', {
        metric,
        value,
        threshold,
        severity: value > threshold * 2 ? 'critical' : 'warning'
      });
    }
  }

  private async sendAlert(type: string, data: Record<string, any>) {
    try {
      await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          data,
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.error('Failed to send monitoring alert:', error);
    }
  }
}

export const monitoring = new MonitoringService();

// Business KPI tracking
export class BusinessKPITracker {
  // Conversion rates
  trackSignupConversion(source: string) {
    analytics.trackConversion('signup', 1, { source });
  }

  trackVerificationConversion(userId: string, verificationType: 'age' | 'talent') {
    analytics.trackConversion('verification', 1, { userId, verificationType });
  }

  trackPurchaseConversion(userId: string, contentId: string, amount: number) {
    analytics.trackConversion('purchase', amount, { userId, contentId });
  }

  trackSubscriptionConversion(userId: string, planId: string, amount: number) {
    analytics.trackConversion('subscription', amount, { userId, planId });
  }

  // Engagement metrics
  trackContentEngagement(contentId: string, engagementType: string, value?: number) {
    analytics.track('content_engagement', {
      contentId,
      engagementType,
      value
    });
  }

  trackSessionDuration(duration: number) {
    analytics.track('session_duration', { duration });
  }

  // Revenue metrics
  trackRevenue(amount: number, currency: string, source: string) {
    analytics.trackBusinessMetric({
      name: 'revenue',
      value: amount,
      period: 'daily'
    });

    analytics.track('revenue_generated', {
      amount,
      currency,
      source
    });
  }

  // Platform health metrics
  trackUploadSuccess(duration: number, fileSize: number) {
    analytics.trackPerformance({
      name: 'upload_duration',
      value: duration,
      unit: 'ms',
      tags: { fileSize: fileSize.toString() }
    });
  }

  trackPlaybackQuality(contentId: string, startTime: number, bufferEvents: number) {
    analytics.trackPerformance({
      name: 'playback_start_time',
      value: startTime,
      unit: 'ms',
      tags: { contentId }
    });

    analytics.track('playback_quality', {
      contentId,
      startTime,
      bufferEvents,
      quality: bufferEvents < 3 ? 'good' : 'poor'
    });
  }
}

export const businessKPI = new BusinessKPITracker();