import axios, { AxiosResponse } from 'axios';

export interface WebhookPayload {
  type: string;
  timestamp: string;
  [key: string]: any;
}

export interface WebhookConfig {
  retryAttempts: number;
  retryDelay: number; // milliseconds
  timeout: number; // milliseconds
}

export class WebhookService {
  private config: WebhookConfig;

  constructor(config: WebhookConfig = {
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 5000
  }) {
    this.config = config;
  }

  /**
   * Send webhook with retry logic
   */
  async send(url: string, payload: WebhookPayload): Promise<void> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response: AxiosResponse = await axios.post(url, payload, {
          timeout: this.config.timeout,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'LeakDetection-Webhook/1.0'
          }
        });

        if (response.status >= 200 && response.status < 300) {
          console.log(`Webhook sent successfully to ${url} (attempt ${attempt})`);
          return;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error;
        console.warn(`Webhook attempt ${attempt} failed:`, error.message);

        if (attempt < this.config.retryAttempts) {
          await this.sleep(this.config.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(`Webhook failed after ${this.config.retryAttempts} attempts: ${lastError.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}