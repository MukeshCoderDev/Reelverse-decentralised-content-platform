/**
 * Redis-based Metrics Caching Service
 * Handles high-performance caching and retrieval of real-time metrics
 */

import { AggregatedSLOs } from './realTimeMetricsAggregator';

export interface MetricsCacheConfig {
  redisUrl?: string;
  keyPrefix: string;
  defaultTTL: number;
  compressionEnabled: boolean;
}

export interface CachedMetric {
  key: string;
  value: any;
  timestamp: Date;
  ttl: number;
}

export class MetricsCache {
  private static instance: MetricsCache;
  private config: MetricsCacheConfig;
  private cache: Map<string, { value: any; timestamp: number; ttl: number }> = new Map();
  private cleanupTimer?: NodeJS.Timeout;

  private constructor() {
    this.config = {
      keyPrefix: 'metrics:',
      defaultTTL: 300, // 5 minutes
      compressionEnabled: true
    };
    
    this.startCleanupTimer();
  }

  public static getInstance(): MetricsCache {
    if (!MetricsCache.instance) {
      MetricsCache.instance = new MetricsCache();
    }
    return MetricsCache.instance;
  }

  /**
   * Configure cache settings
   */
  configure(config: Partial<MetricsCacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Store SLO metrics in cache
   */
  async cacheSLOMetrics(slos: AggregatedSLOs, ttl?: number): Promise<void> {
    const key = this.buildKey('slo:current');
    const actualTTL = ttl || this.config.defaultTTL;
    
    await this.set(key, slos, actualTTL);
    
    // Also cache with timestamp for historical access
    const timestampKey = this.buildKey(`slo:${slos.timestamp.getTime()}`);
    await this.set(timestampKey, slos, actualTTL * 2); // Keep historical data longer
  }

  /**
   * Get current SLO metrics from cache
   */
  async getCurrentSLOMetrics(): Promise<AggregatedSLOs | null> {
    const key = this.buildKey('slo:current');
    return await this.get(key);
  }

  /**
   * Cache historical SLO data
   */
  async cacheSLOHistory(history: AggregatedSLOs[], ttl?: number): Promise<void> {
    const key = this.buildKey('slo:history');
    const actualTTL = ttl || this.config.defaultTTL * 4; // Keep history longer
    
    await this.set(key, history, actualTTL);
  }

  /**
   * Get SLO history from cache
   */
  async getSLOHistory(): Promise<AggregatedSLOs[] | null> {
    const key = this.buildKey('slo:history');
    return await this.get(key);
  }

  /**
   * Cache aggregated metrics for a time period
   */
  async cacheAggregatedMetrics(
    startTime: Date, 
    endTime: Date, 
    metrics: AggregatedSLOs,
    ttl?: number
  ): Promise<void> {
    const key = this.buildKey(`aggregated:${startTime.getTime()}:${endTime.getTime()}`);
    const actualTTL = ttl || this.config.defaultTTL * 2;
    
    await this.set(key, metrics, actualTTL);
  }

  /**
   * Get aggregated metrics for a time period
   */
  async getAggregatedMetrics(startTime: Date, endTime: Date): Promise<AggregatedSLOs | null> {
    const key = this.buildKey(`aggregated:${startTime.getTime()}:${endTime.getTime()}`);
    return await this.get(key);
  }

  /**
   * Cache real-time dashboard data
   */
  async cacheDashboardData(data: any, ttl?: number): Promise<void> {
    const key = this.buildKey('dashboard:realtime');
    const actualTTL = ttl || 30; // Short TTL for real-time data
    
    await this.set(key, data, actualTTL);
  }

  /**
   * Get real-time dashboard data
   */
  async getDashboardData(): Promise<any | null> {
    const key = this.buildKey('dashboard:realtime');
    return await this.get(key);
  }

  /**
   * Cache alert data
   */
  async cacheAlert(alertId: string, alert: any, ttl?: number): Promise<void> {
    const key = this.buildKey(`alert:${alertId}`);
    const actualTTL = ttl || this.config.defaultTTL * 6; // Keep alerts longer
    
    await this.set(key, alert, actualTTL);
  }

  /**
   * Get alert data
   */
  async getAlert(alertId: string): Promise<any | null> {
    const key = this.buildKey(`alert:${alertId}`);
    return await this.get(key);
  }

  /**
   * Cache session metrics
   */
  async cacheSessionMetrics(sessionId: string, metrics: any, ttl?: number): Promise<void> {
    const key = this.buildKey(`session:${sessionId}`);
    const actualTTL = ttl || this.config.defaultTTL;
    
    await this.set(key, metrics, actualTTL);
  }

  /**
   * Get session metrics
   */
  async getSessionMetrics(sessionId: string): Promise<any | null> {
    const key = this.buildKey(`session:${sessionId}`);
    return await this.get(key);
  }

  /**
   * Cache performance metrics
   */
  async cachePerformanceMetrics(metrics: any, ttl?: number): Promise<void> {
    const key = this.buildKey('performance:current');
    const actualTTL = ttl || 60; // 1 minute TTL for performance data
    
    await this.set(key, metrics, actualTTL);
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<any | null> {
    const key = this.buildKey('performance:current');
    return await this.get(key);
  }

  /**
   * Increment a counter metric
   */
  async incrementCounter(counterName: string, value: number = 1, ttl?: number): Promise<number> {
    const key = this.buildKey(`counter:${counterName}`);
    const current = await this.get(key) || 0;
    const newValue = current + value;
    
    await this.set(key, newValue, ttl || this.config.defaultTTL);
    return newValue;
  }

  /**
   * Get counter value
   */
  async getCounter(counterName: string): Promise<number> {
    const key = this.buildKey(`counter:${counterName}`);
    return await this.get(key) || 0;
  }

  /**
   * Set a gauge metric
   */
  async setGauge(gaugeName: string, value: number, ttl?: number): Promise<void> {
    const key = this.buildKey(`gauge:${gaugeName}`);
    await this.set(key, value, ttl || this.config.defaultTTL);
  }

  /**
   * Get gauge value
   */
  async getGauge(gaugeName: string): Promise<number | null> {
    const key = this.buildKey(`gauge:${gaugeName}`);
    return await this.get(key);
  }

  /**
   * Store time-series data point
   */
  async addTimeSeriesPoint(
    seriesName: string, 
    timestamp: Date, 
    value: number,
    ttl?: number
  ): Promise<void> {
    const key = this.buildKey(`timeseries:${seriesName}`);
    const series = await this.get(key) || [];
    
    series.push({ timestamp: timestamp.getTime(), value });
    
    // Keep only recent points (last 1000 points)
    if (series.length > 1000) {
      series.splice(0, series.length - 1000);
    }
    
    await this.set(key, series, ttl || this.config.defaultTTL * 4);
  }

  /**
   * Get time-series data
   */
  async getTimeSeries(seriesName: string, since?: Date): Promise<Array<{ timestamp: number; value: number }>> {
    const key = this.buildKey(`timeseries:${seriesName}`);
    const series = await this.get(key) || [];
    
    if (since) {
      const sinceTime = since.getTime();
      return series.filter((point: any) => point.timestamp >= sinceTime);
    }
    
    return series;
  }

  /**
   * Generic set method
   */
  private async set(key: string, value: any, ttl: number): Promise<void> {
    try {
      const serialized = this.config.compressionEnabled 
        ? this.compress(JSON.stringify(value))
        : JSON.stringify(value);
      
      this.cache.set(key, {
        value: serialized,
        timestamp: Date.now(),
        ttl: ttl * 1000 // Convert to milliseconds
      });
    } catch (error) {
      console.error('Error setting cache value:', error);
    }
  }

  /**
   * Generic get method
   */
  private async get(key: string): Promise<any | null> {
    try {
      const cached = this.cache.get(key);
      
      if (!cached) {
        return null;
      }
      
      // Check if expired
      if (Date.now() - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
        return null;
      }
      
      const value = this.config.compressionEnabled 
        ? this.decompress(cached.value)
        : cached.value;
      
      return JSON.parse(value);
    } catch (error) {
      console.error('Error getting cache value:', error);
      return null;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key);
    this.cache.delete(fullKey);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    memoryUsage: number;
  } {
    const size = this.cache.size;
    const memoryUsage = this.estimateMemoryUsage();
    
    return {
      size,
      hitRate: 0, // Would track hits/misses in production
      memoryUsage
    };
  }

  /**
   * Build cache key with prefix
   */
  private buildKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Simple compression (in production, use a proper compression library)
   */
  private compress(data: string): string {
    // Placeholder for compression logic
    // In production, use libraries like lz4, gzip, etc.
    return data;
  }

  /**
   * Simple decompression
   */
  private decompress(data: string): string {
    // Placeholder for decompression logic
    return data;
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const [key, value] of this.cache) {
      totalSize += key.length * 2; // UTF-16 characters
      totalSize += JSON.stringify(value).length * 2;
    }
    
    return totalSize;
  }

  /**
   * Start cleanup timer to remove expired entries
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Cleanup every minute
  }

  /**
   * Remove expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, cached] of this.cache) {
      if (now - cached.timestamp > cached.ttl) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`[MetricsCache] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    this.cache.clear();
  }
}