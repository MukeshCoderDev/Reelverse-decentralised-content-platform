import { EventEmitter } from 'events';

export interface CoreWebVitals {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
}

export interface PerformanceMetrics {
  timestamp: Date;
  url: string;
  coreWebVitals: CoreWebVitals;
  resourceTiming: {
    totalResources: number;
    totalSize: number;
    loadTime: number;
    criticalResources: number;
  };
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  networkInfo: {
    effectiveType: string;
    downlink: number;
    rtt: number;
  };
  deviceInfo: {
    deviceMemory?: number;
    hardwareConcurrency: number;
    isMobile: boolean;
  };
}

export interface PerformanceOptimization {
  id: string;
  type: 'image' | 'script' | 'style' | 'font' | 'api' | 'render';
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  estimatedImprovement: {
    lcp?: number;
    fid?: number;
    cls?: number;
  };
  implemented: boolean;
}

export class PerformanceService extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private observer: PerformanceObserver | null = null;
  private isMonitoring = false;
  private optimizations: Map<string, PerformanceOptimization> = new Map();

  constructor() {
    super();
    this.initializeOptimizations();
    this.startMonitoring();
  }

  private initializeOptimizations() {
    const optimizations: PerformanceOptimization[] = [
      {
        id: 'lazy-loading',
        type: 'image',
        description: 'Implement lazy loading for images and videos',
        impact: 'high',
        effort: 'medium',
        estimatedImprovement: { lcp: -500, cls: -0.05 },
        implemented: false
      },
      {
        id: 'code-splitting',
        type: 'script',
        description: 'Implement route-based code splitting',
        impact: 'high',
        effort: 'high',
        estimatedImprovement: { lcp: -800, fid: -50 },
        implemented: false
      },
      {
        id: 'critical-css',
        type: 'style',
        description: 'Extract and inline critical CSS',
        impact: 'medium',
        effort: 'medium',
        estimatedImprovement: { lcp: -300, cls: -0.02 },
        implemented: false
      },
      {
        id: 'font-optimization',
        type: 'font',
        description: 'Optimize font loading with font-display: swap',
        impact: 'medium',
        effort: 'low',
        estimatedImprovement: { lcp: -200, cls: -0.03 },
        implemented: false
      },
      {
        id: 'api-caching',
        type: 'api',
        description: 'Implement aggressive API response caching',
        impact: 'high',
        effort: 'medium',
        estimatedImprovement: { lcp: -400, fid: -30 },
        implemented: false
      },
      {
        id: 'virtual-scrolling',
        type: 'render',
        description: 'Implement virtual scrolling for large lists',
        impact: 'high',
        effort: 'high',
        estimatedImprovement: { fid: -100, cls: -0.1 },
        implemented: false
      }
    ];

    optimizations.forEach(opt => {
      this.optimizations.set(opt.id, opt);
    });
  }

  startMonitoring(): void {
    if (this.isMonitoring || typeof window === 'undefined') return;

    this.isMonitoring = true;

    // Monitor Core Web Vitals
    this.observeCoreWebVitals();

    // Monitor resource loading
    this.observeResourceTiming();

    // Monitor memory usage
    this.monitorMemoryUsage();

    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectMetrics();
    }, 30000);
  }

  private observeCoreWebVitals(): void {
    if (!('PerformanceObserver' in window)) return;

    // Largest Contentful Paint
    this.observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'largest-contentful-paint') {
          this.emit('lcpMeasured', entry.startTime);
        }
      });
    });

    try {
      this.observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      console.warn('LCP observation not supported');
    }

    // First Input Delay
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (entry.entryType === 'first-input') {
          this.emit('fidMeasured', entry.processingStart - entry.startTime);
        }
      });
    });

    try {
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      console.warn('FID observation not supported');
    }

    // Cumulative Layout Shift
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
          clsValue += entry.value;
          this.emit('clsMeasured', clsValue);
        }
      });
    });

    try {
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      console.warn('CLS observation not supported');
    }
  }

  private observeResourceTiming(): void {
    if (!('PerformanceObserver' in window)) return;

    const resourceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (entry.entryType === 'resource') {
          this.emit('resourceLoaded', {
            name: entry.name,
            duration: entry.duration,
            size: entry.transferSize,
            type: this.getResourceType(entry.name)
          });
        }
      });
    });

    try {
      resourceObserver.observe({ entryTypes: ['resource'] });
    } catch (e) {
      console.warn('Resource timing observation not supported');
    }
  }

  private getResourceType(url: string): string {
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image';
    if (url.match(/\.(js|mjs)$/i)) return 'script';
    if (url.match(/\.css$/i)) return 'stylesheet';
    if (url.match(/\.(woff|woff2|ttf|otf)$/i)) return 'font';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }

  private monitorMemoryUsage(): void {
    if (!('memory' in performance)) return;

    setInterval(() => {
      const memory = (performance as any).memory;
      if (memory) {
        this.emit('memoryUsage', {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
        });
      }
    }, 10000);
  }

  private collectMetrics(): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    
    const fcp = paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
    const ttfb = navigation?.responseStart - navigation?.requestStart || 0;

    // Get network information
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      url: window.location.href,
      coreWebVitals: {
        lcp: this.getLatestLCP(),
        fid: this.getLatestFID(),
        cls: this.getLatestCLS(),
        fcp,
        ttfb
      },
      resourceTiming: this.getResourceTimingMetrics(),
      memoryUsage: this.getMemoryUsage(),
      networkInfo: {
        effectiveType: connection?.effectiveType || 'unknown',
        downlink: connection?.downlink || 0,
        rtt: connection?.rtt || 0
      },
      deviceInfo: {
        deviceMemory: (navigator as any).deviceMemory,
        hardwareConcurrency: navigator.hardwareConcurrency || 1,
        isMobile: /Mobi|Android/i.test(navigator.userAgent)
      }
    };

    this.metrics.push(metrics);
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    this.emit('metricsCollected', metrics);
    this.analyzePerformance(metrics);
  }

  private getLatestLCP(): number {
    // In a real implementation, this would track the latest LCP value
    return Math.random() * 3000 + 1000; // Mock value between 1-4s
  }

  private getLatestFID(): number {
    // In a real implementation, this would track the latest FID value
    return Math.random() * 200 + 50; // Mock value between 50-250ms
  }

  private getLatestCLS(): number {
    // In a real implementation, this would track the cumulative CLS value
    return Math.random() * 0.2; // Mock value between 0-0.2
  }

  private getResourceTimingMetrics() {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    return {
      totalResources: resources.length,
      totalSize: resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0),
      loadTime: resources.reduce((sum, resource) => sum + resource.duration, 0),
      criticalResources: resources.filter(resource => 
        resource.name.includes('.css') || 
        resource.name.includes('.js') ||
        resource.name.includes('/api/')
      ).length
    };
  }

  private getMemoryUsage() {
    const memory = (performance as any).memory;
    if (memory) {
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      };
    }
    return { used: 0, total: 0, percentage: 0 };
  }

  private analyzePerformance(metrics: PerformanceMetrics): void {
    const issues = [];

    // Check Core Web Vitals thresholds
    if (metrics.coreWebVitals.lcp > 2500) {
      issues.push({
        type: 'lcp',
        severity: metrics.coreWebVitals.lcp > 4000 ? 'high' : 'medium',
        message: `LCP is ${metrics.coreWebVitals.lcp.toFixed(0)}ms (target: <2500ms)`,
        recommendations: ['Optimize images', 'Reduce server response time', 'Eliminate render-blocking resources']
      });
    }

    if (metrics.coreWebVitals.fid > 100) {
      issues.push({
        type: 'fid',
        severity: metrics.coreWebVitals.fid > 300 ? 'high' : 'medium',
        message: `FID is ${metrics.coreWebVitals.fid.toFixed(0)}ms (target: <100ms)`,
        recommendations: ['Reduce JavaScript execution time', 'Code splitting', 'Remove unused JavaScript']
      });
    }

    if (metrics.coreWebVitals.cls > 0.1) {
      issues.push({
        type: 'cls',
        severity: metrics.coreWebVitals.cls > 0.25 ? 'high' : 'medium',
        message: `CLS is ${metrics.coreWebVitals.cls.toFixed(3)} (target: <0.1)`,
        recommendations: ['Set dimensions for images and videos', 'Reserve space for ads', 'Avoid inserting content above existing content']
      });
    }

    // Check memory usage
    if (metrics.memoryUsage.percentage > 80) {
      issues.push({
        type: 'memory',
        severity: 'high',
        message: `High memory usage: ${metrics.memoryUsage.percentage.toFixed(1)}%`,
        recommendations: ['Check for memory leaks', 'Optimize large objects', 'Implement virtual scrolling']
      });
    }

    if (issues.length > 0) {
      this.emit('performanceIssues', issues);
    }
  }

  // Performance Optimization Methods
  async implementOptimization(optimizationId: string): Promise<boolean> {
    const optimization = this.optimizations.get(optimizationId);
    if (!optimization || optimization.implemented) {
      return false;
    }

    // Simulate implementation
    optimization.implemented = true;
    this.optimizations.set(optimizationId, optimization);

    this.emit('optimizationImplemented', optimization);
    return true;
  }

  getOptimizations(): PerformanceOptimization[] {
    return Array.from(this.optimizations.values());
  }

  getPendingOptimizations(): PerformanceOptimization[] {
    return Array.from(this.optimizations.values()).filter(opt => !opt.implemented);
  }

  getPerformanceScore(): number {
    const latest = this.getLatestMetrics();
    if (!latest) return 0;

    let score = 100;

    // LCP scoring
    if (latest.coreWebVitals.lcp > 4000) score -= 30;
    else if (latest.coreWebVitals.lcp > 2500) score -= 15;

    // FID scoring
    if (latest.coreWebVitals.fid > 300) score -= 25;
    else if (latest.coreWebVitals.fid > 100) score -= 10;

    // CLS scoring
    if (latest.coreWebVitals.cls > 0.25) score -= 25;
    else if (latest.coreWebVitals.cls > 0.1) score -= 10;

    // Memory usage scoring
    if (latest.memoryUsage.percentage > 90) score -= 15;
    else if (latest.memoryUsage.percentage > 80) score -= 8;

    return Math.max(0, score);
  }

  getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getMetricsHistory(hours: number = 24): PerformanceMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics.filter(metric => metric.timestamp >= cutoff);
  }

  // Image Optimization
  optimizeImage(src: string, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpeg' | 'png';
  } = {}): string {
    const { width, height, quality = 80, format = 'webp' } = options;
    
    // In production, this would integrate with an image optimization service
    let optimizedSrc = src;
    
    if (width || height) {
      optimizedSrc += `?w=${width || ''}&h=${height || ''}`;
    }
    
    if (quality !== 80) {
      optimizedSrc += `&q=${quality}`;
    }
    
    if (format !== 'jpeg') {
      optimizedSrc += `&f=${format}`;
    }
    
    return optimizedSrc;
  }

  // Lazy Loading Utilities
  createIntersectionObserver(callback: (entries: IntersectionObserverEntry[]) => void): IntersectionObserver {
    return new IntersectionObserver(callback, {
      rootMargin: '50px 0px',
      threshold: 0.1
    });
  }

  // Bundle Analysis
  analyzeBundleSize(): {
    totalSize: number;
    chunks: Array<{
      name: string;
      size: number;
      percentage: number;
    }>;
    recommendations: string[];
  } {
    // Mock bundle analysis - in production, this would analyze actual webpack stats
    const chunks = [
      { name: 'main', size: 245000, percentage: 35 },
      { name: 'vendor', size: 180000, percentage: 26 },
      { name: 'live-streaming', size: 120000, percentage: 17 },
      { name: 'charts', size: 85000, percentage: 12 },
      { name: 'notifications', size: 70000, percentage: 10 }
    ];

    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    
    const recommendations = [];
    
    if (totalSize > 500000) {
      recommendations.push('Consider code splitting to reduce initial bundle size');
    }
    
    const largeChunks = chunks.filter(chunk => chunk.size > 100000);
    if (largeChunks.length > 0) {
      recommendations.push(`Large chunks detected: ${largeChunks.map(c => c.name).join(', ')}`);
    }

    return {
      totalSize,
      chunks,
      recommendations
    };
  }

  // Resource Hints
  preloadResource(href: string, as: string): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    document.head.appendChild(link);
  }

  prefetchResource(href: string): void {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  }

  // Critical Resource Detection
  getCriticalResources(): string[] {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    return resources
      .filter(resource => {
        // Consider resources critical if they're CSS, JS, or loaded early
        return (
          resource.name.includes('.css') ||
          (resource.name.includes('.js') && resource.startTime < 1000) ||
          resource.name.includes('/api/') && resource.startTime < 2000
        );
      })
      .map(resource => resource.name);
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// Singleton instance
export const performanceService = new PerformanceService();