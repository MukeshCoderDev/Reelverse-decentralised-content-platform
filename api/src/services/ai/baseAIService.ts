import { logger } from '../../utils/logger';

export interface AIServiceError extends Error {
  code: string;
  retryable: boolean;
  originalError?: Error;
}

export class AIServiceError extends Error implements AIServiceError {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export abstract class BaseAIService {
  protected serviceName: string;
  protected maxRetries: number = 3;
  protected retryDelay: number = 1000; // 1 second

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(error as Error);
        
        if (!isRetryable || attempt === retries) {
          logger.error(`${this.serviceName} operation failed after ${attempt + 1} attempts`, {
            error: lastError.message,
            stack: lastError.stack,
          });
          throw new AIServiceError(
            `${this.serviceName} operation failed: ${lastError.message}`,
            'OPERATION_FAILED',
            isRetryable,
            lastError
          );
        }

        // Wait before retry with exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt);
        logger.warn(`${this.serviceName} operation failed, retrying in ${delay}ms`, {
          attempt: attempt + 1,
          maxRetries: retries,
          error: lastError.message,
        });
        
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  protected isRetryableError(error: Error): boolean {
    // Network errors, timeouts, and rate limits are typically retryable
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /rate limit/i,
      /429/,
      /502/,
      /503/,
      /504/,
    ];

    return retryablePatterns.some(pattern => 
      pattern.test(error.message) || 
      pattern.test(error.name)
    );
  }

  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected validateInput(input: any, fieldName: string): void {
    if (!input) {
      throw new AIServiceError(
        `${fieldName} is required`,
        'INVALID_INPUT',
        false
      );
    }
  }

  protected logOperation(operation: string, metadata?: any): void {
    logger.info(`${this.serviceName}: ${operation}`, metadata);
  }

  protected logError(operation: string, error: Error, metadata?: any): void {
    logger.error(`${this.serviceName}: ${operation} failed`, {
      error: error.message,
      stack: error.stack,
      ...metadata,
    });
  }
}

// Common AI service interfaces
export interface TagResult {
  tag: string;
  confidence: number;
  category: 'visual' | 'audio' | 'scene' | 'performer' | 'action' | 'setting';
}

export interface SearchResult {
  contentId: string;
  relevanceScore: number;
  matchedTags: string[];
  snippet?: string;
  metadata?: Record<string, any>;
}

export interface SearchFilters {
  category?: string;
  creatorId?: string;
  minDuration?: number;
  maxDuration?: number;
  ageRestricted?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface VideoFingerprint {
  frameHashes: string[];
  audioChroma: number[];
  duration: number;
  resolution: string;
  metadata?: {
    fps?: number;
    bitrate?: number;
    codec?: string;
  };
}

export interface MatchResult {
  similarity: number;
  matchedFrames: number;
  totalFrames: number;
  confidence: number;
}

// Queue job interfaces for async processing
export interface AIJobData {
  jobId: string;
  contentId: string;
  operation: string;
  priority: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
}

export interface AutoTaggingJobData extends AIJobData {
  operation: 'auto-tagging';
  mediaUrl: string;
  existingTags?: string[];
}

export interface FingerprintJobData extends AIJobData {
  operation: 'fingerprinting';
  videoUrl: string;
}

export interface LeakDetectionJobData extends AIJobData {
  operation: 'leak-detection';
  fingerprint: VideoFingerprint;
  platforms: string[];
}