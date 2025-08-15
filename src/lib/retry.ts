// Retry mechanism utilities for Reelverse18

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
  retryCondition?: (error: any) => boolean;
  onRetry?: (error: any, attempt: number) => void;
}

export class RetryError extends Error {
  public readonly attempts: number;
  public readonly lastError: Error;

  constructor(message: string, attempts: number, lastError: Error) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxRetries,
    baseDelay,
    maxDelay = 30000,
    backoffFactor = 2,
    jitter = true,
    retryCondition = () => true,
    onRetry
  } = options;

  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Check if we should retry this error
      if (!retryCondition(lastError)) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      let delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay);
      
      // Add jitter to prevent thundering herd
      if (jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }
      
      // Call retry callback
      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new RetryError(
    `Failed after ${maxRetries + 1} attempts`,
    maxRetries + 1,
    lastError!
  );
}

// Predefined retry configurations
export const RETRY_CONFIGS = {
  // Quick retries for network requests
  NETWORK: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    retryCondition: (error: any) => {
      return error.code === 'NETWORK_ERROR' || 
             error.message?.includes('timeout') ||
             error.message?.includes('network') ||
             error.status >= 500;
    }
  },
  
  // Blockchain transaction retries
  BLOCKCHAIN: {
    maxRetries: 2,
    baseDelay: 3000,
    maxDelay: 10000,
    retryCondition: (error: any) => {
      return error.code === 'NETWORK_ERROR' ||
             error.message?.includes('gas') ||
             error.message?.includes('nonce') ||
             error.message?.includes('timeout');
    }
  },
  
  // Payment processing retries
  PAYMENT: {
    maxRetries: 2,
    baseDelay: 2000,
    maxDelay: 8000,
    retryCondition: (error: any) => {
      // Don't retry on insufficient funds or invalid signatures
      if (error.code === 'INSUFFICIENT_BALANCE' || 
          error.code === 'INVALID_SIGNATURE') {
        return false;
      }
      return error.code === 'NETWORK_ERROR' ||
             error.code === 'PAYMENT_FAILED' ||
             error.status >= 500;
    }
  },
  
  // File upload retries
  UPLOAD: {
    maxRetries: 3,
    baseDelay: 5000,
    maxDelay: 20000,
    retryCondition: (error: any) => {
      // Don't retry on file validation errors
      if (error.code === 'FILE_TOO_LARGE' || 
          error.code === 'INVALID_FILE_TYPE') {
        return false;
      }
      return error.code === 'NETWORK_ERROR' ||
             error.code === 'UPLOAD_FAILED' ||
             error.status >= 500;
    }
  },
  
  // API request retries
  API: {
    maxRetries: 2,
    baseDelay: 1500,
    maxDelay: 6000,
    retryCondition: (error: any) => {
      // Don't retry on client errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        return false;
      }
      return error.status >= 500 || 
             error.code === 'NETWORK_ERROR' ||
             error.message?.includes('timeout');
    }
  }
};

// Circuit breaker implementation
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Utility functions for common retry scenarios
export function retryNetworkRequest<T>(fn: () => Promise<T>) {
  return retryWithBackoff(fn, RETRY_CONFIGS.NETWORK);
}

export function retryBlockchainTransaction<T>(fn: () => Promise<T>) {
  return retryWithBackoff(fn, RETRY_CONFIGS.BLOCKCHAIN);
}

export function retryPayment<T>(fn: () => Promise<T>) {
  return retryWithBackoff(fn, RETRY_CONFIGS.PAYMENT);
}

export function retryUpload<T>(fn: () => Promise<T>) {
  return retryWithBackoff(fn, RETRY_CONFIGS.UPLOAD);
}

export function retryApiRequest<T>(fn: () => Promise<T>) {
  return retryWithBackoff(fn, RETRY_CONFIGS.API);
}