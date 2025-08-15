import { 
  FeatureFlag, 
  FeatureFlagConfig, 
  FeatureFlagContext, 
  FeatureFlagProvider,
  DEFAULT_FLAG_CONFIG 
} from '../FeatureFlags';

interface RemoteProviderConfig {
  apiEndpoint: string;
  apiKey?: string;
  pollInterval?: number; // milliseconds
  timeout?: number; // milliseconds
}

interface RemoteFlagResponse {
  flags: Record<FeatureFlag, FeatureFlagConfig>;
  version?: string;
  timestamp?: number;
}

/**
 * Remote API-based feature flag provider
 * Supports real-time updates and centralized management
 */
export class RemoteFeatureFlagProvider implements FeatureFlagProvider {
  private config: RemoteProviderConfig;
  private flags: Record<FeatureFlag, FeatureFlagConfig> = DEFAULT_FLAG_CONFIG;
  private version?: string;
  private pollTimer?: NodeJS.Timeout;
  private listeners: Array<(flags: Record<FeatureFlag, FeatureFlagConfig>) => void> = [];

  constructor(config: RemoteProviderConfig) {
    this.config = {
      pollInterval: 60000, // 1 minute default
      timeout: 5000, // 5 seconds default
      ...config
    };

    // Initial fetch
    this.fetchFlags().catch(error => {
      console.error('Failed to fetch initial feature flags:', error);
    });

    // Start polling if interval is set
    if (this.config.pollInterval && this.config.pollInterval > 0) {
      this.startPolling();
    }
  }

  async getFlag(flag: FeatureFlag, context?: FeatureFlagContext): Promise<boolean> {
    const config = this.flags[flag];
    if (!config) {
      return false;
    }

    return this.evaluateFlag(config, context, flag);
  }

  async getAllFlags(context?: FeatureFlagContext): Promise<Record<FeatureFlag, boolean>> {
    const result: Record<FeatureFlag, boolean> = {} as any;
    
    for (const [flag, config] of Object.entries(this.flags)) {
      result[flag as FeatureFlag] = this.evaluateFlag(config, context, flag as FeatureFlag);
    }

    return result;
  }

  async updateFlag(flag: FeatureFlag, config: FeatureFlagConfig): Promise<void> {
    const response = await this.makeRequest('PUT', `/flags/${flag}`, config);
    
    if (response.ok) {
      // Update local cache
      this.flags[flag] = config;
      this.notifyListeners();
    } else {
      throw new Error(`Failed to update flag: ${response.statusText}`);
    }
  }

  /**
   * Manually refresh flags from remote
   */
  async refresh(): Promise<void> {
    await this.fetchFlags();
  }

  /**
   * Add listener for flag updates
   */
  addUpdateListener(listener: (flags: Record<FeatureFlag, FeatureFlagConfig>) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove update listener
   */
  removeUpdateListener(listener: (flags: Record<FeatureFlag, FeatureFlagConfig>) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Stop polling and cleanup
   */
  destroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    this.listeners = [];
  }

  /**
   * Get current version/timestamp of flags
   */
  getVersion(): string | undefined {
    return this.version;
  }

  private async fetchFlags(): Promise<void> {
    try {
      const response = await this.makeRequest('GET', '/flags');
      
      if (response.ok) {
        const data: RemoteFlagResponse = await response.json();
        
        // Only update if version has changed
        if (!this.version || data.version !== this.version) {
          this.flags = { ...DEFAULT_FLAG_CONFIG, ...data.flags };
          this.version = data.version;
          this.notifyListeners();
        }
      } else {
        console.error('Failed to fetch feature flags:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      // Keep using cached flags on error
    }
  }

  private async makeRequest(
    method: string, 
    path: string, 
    body?: any
  ): Promise<Response> {
    const url = `${this.config.apiEndpoint}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      this.fetchFlags().catch(error => {
        console.error('Error during flag polling:', error);
      });
    }, this.config.pollInterval);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.flags);
      } catch (error) {
        console.error('Error in flag update listener:', error);
      }
    });
  }

  private evaluateFlag(
    config: FeatureFlagConfig, 
    context?: FeatureFlagContext,
    flag?: FeatureFlag
  ): boolean {
    // Check if flag is enabled
    if (!config.enabled) {
      return false;
    }

    // Check date range
    if (config.startDate && new Date() < new Date(config.startDate)) {
      return false;
    }
    if (config.endDate && new Date() > new Date(config.endDate)) {
      return false;
    }

    // Check user segments
    if (config.userSegments && context?.userSegment) {
      if (!config.userSegments.includes(context.userSegment)) {
        return false;
      }
    }

    // Check geo targeting
    if (config.geoTargeting && context?.country) {
      const { includedCountries, excludedCountries } = config.geoTargeting;
      
      if (includedCountries && !includedCountries.includes(context.country)) {
        return false;
      }
      
      if (excludedCountries && excludedCountries.includes(context.country)) {
        return false;
      }
    }

    // Check rollout percentage
    if (config.rolloutPercentage !== undefined) {
      const hash = this.hashString((flag || 'unknown') + (context?.userId || 'anonymous'));
      const percentage = (hash % 100) + 1;
      return percentage <= config.rolloutPercentage;
    }

    return true;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}