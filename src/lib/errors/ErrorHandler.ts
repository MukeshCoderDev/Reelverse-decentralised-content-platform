import { ErrorCodes, ERROR_CATALOG, ErrorDetails } from './ErrorCodes';

export interface PlatformError extends Error {
  code: ErrorCodes;
  details?: any;
  timestamp: number;
  requestId?: string;
  userId?: string;
  context?: Record<string, any>;
}

export class PlatformErrorHandler {
  private static instance: PlatformErrorHandler;
  private errorListeners: Array<(error: PlatformError) => void> = [];
  private retryAttempts: Map<string, number> = new Map();

  static getInstance(): PlatformErrorHandler {
    if (!PlatformErrorHandler.instance) {
      PlatformErrorHandler.instance = new PlatformErrorHandler();
    }
    return PlatformErrorHandler.instance;
  }

  /**
   * Create a standardized platform error
   */
  createError(
    code: ErrorCodes,
    originalError?: Error,
    context?: Record<string, any>
  ): PlatformError {
    const errorDetails = ERROR_CATALOG[code];
    const error = new Error(errorDetails.message) as PlatformError;
    
    error.code = code;
    error.timestamp = Date.now();
    error.requestId = this.generateRequestId();
    error.context = context;
    
    if (originalError) {
      error.stack = originalError.stack;
      error.details = {
        originalMessage: originalError.message,
        originalStack: originalError.stack
      };
    }

    return error;
  }

  /**
   * Handle an error with appropriate logging and user feedback
   */
  handleError(error: PlatformError | Error): ErrorDetails {
    let platformError: PlatformError;

    if (this.isPlatformError(error)) {
      platformError = error;
    } else {
      // Convert generic error to platform error
      platformError = this.createError(ErrorCodes.UNKNOWN_ERROR, error);
    }

    // Log error for monitoring
    this.logError(platformError);

    // Notify error listeners
    this.notifyErrorListeners(platformError);

    // Return error details for UI display
    return ERROR_CATALOG[platformError.code] || ERROR_CATALOG[ErrorCodes.UNKNOWN_ERROR];
  }

  /**
   * Handle errors with retry logic
   */
  async handleErrorWithRetry<T>(
    operation: () => Promise<T>,
    errorCode: ErrorCodes,
    maxRetries: number = 3,
    backoffMs: number = 1000
  ): Promise<T> {
    const operationId = this.generateRequestId();
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        // Clear retry count on success
        this.retryAttempts.delete(operationId);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.retryAttempts.set(operationId, attempt);

        // Don't retry if error is not retryable
        const errorDetails = this.getErrorDetails(error);
        if (!errorDetails.retryable || attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = backoffMs * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }

    // All retries failed
    const platformError = this.createError(errorCode, lastError, {
      attempts: maxRetries,
      operationId
    });
    
    throw platformError;
  }

  /**
   * Add error listener for custom error handling
   */
  addErrorListener(listener: (error: PlatformError) => void): void {
    this.errorListeners.push(listener);
  }

  /**
   * Remove error listener
   */
  removeErrorListener(listener: (error: PlatformError) => void): void {
    const index = this.errorListeners.indexOf(listener);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: Error | PlatformError): string {
    const errorDetails = this.getErrorDetails(error);
    return errorDetails.userMessage;
  }

  /**
   * Get error action if available
   */
  getErrorAction(error: Error | PlatformError): string | undefined {
    const errorDetails = this.getErrorDetails(error);
    return errorDetails.action;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error: Error | PlatformError): boolean {
    const errorDetails = this.getErrorDetails(error);
    return errorDetails.retryable;
  }

  /**
   * Get error severity
   */
  getErrorSeverity(error: Error | PlatformError): 'low' | 'medium' | 'high' | 'critical' {
    const errorDetails = this.getErrorDetails(error);
    return errorDetails.severity;
  }

  /**
   * Create error from HTTP response
   */
  createErrorFromResponse(response: Response, context?: Record<string, any>): PlatformError {
    let errorCode: ErrorCodes;

    switch (response.status) {
      case 401:
        errorCode = ErrorCodes.UNAUTHORIZED_ACCESS;
        break;
      case 403:
        errorCode = ErrorCodes.INSUFFICIENT_PERMISSIONS;
        break;
      case 404:
        errorCode = ErrorCodes.CONTENT_NOT_FOUND;
        break;
      case 429:
        errorCode = ErrorCodes.RATE_LIMIT_EXCEEDED;
        break;
      case 500:
        errorCode = ErrorCodes.SERVICE_UNAVAILABLE;
        break;
      case 503:
        errorCode = ErrorCodes.SERVICE_UNAVAILABLE;
        break;
      default:
        errorCode = ErrorCodes.NETWORK_ERROR;
    }

    return this.createError(errorCode, undefined, {
      ...context,
      httpStatus: response.status,
      httpStatusText: response.statusText
    });
  }

  /**
   * Create error from blockchain transaction
   */
  createBlockchainError(
    transactionHash?: string,
    reason?: string,
    context?: Record<string, any>
  ): PlatformError {
    let errorCode: ErrorCodes;

    if (reason?.includes('insufficient funds')) {
      errorCode = ErrorCodes.INSUFFICIENT_BALANCE;
    } else if (reason?.includes('permit expired')) {
      errorCode = ErrorCodes.PERMIT_EXPIRED;
    } else if (reason?.includes('reverted')) {
      errorCode = ErrorCodes.TRANSACTION_REVERTED;
    } else {
      errorCode = ErrorCodes.BLOCKCHAIN_ERROR;
    }

    return this.createError(errorCode, undefined, {
      ...context,
      transactionHash,
      revertReason: reason
    });
  }

  private isPlatformError(error: any): error is PlatformError {
    return error && typeof error.code === 'string' && error.code in ErrorCodes;
  }

  private getErrorDetails(error: Error | PlatformError): ErrorDetails {
    if (this.isPlatformError(error)) {
      return ERROR_CATALOG[error.code] || ERROR_CATALOG[ErrorCodes.UNKNOWN_ERROR];
    }
    return ERROR_CATALOG[ErrorCodes.UNKNOWN_ERROR];
  }

  private logError(error: PlatformError): void {
    const errorDetails = ERROR_CATALOG[error.code];
    
    console.error('Platform Error:', {
      code: error.code,
      message: error.message,
      severity: errorDetails.severity,
      category: errorDetails.category,
      timestamp: error.timestamp,
      requestId: error.requestId,
      context: error.context,
      stack: error.stack
    });

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(error, errorDetails);
    }
  }

  private notifyErrorListeners(error: PlatformError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async sendToMonitoring(error: PlatformError, details: ErrorDetails): Promise<void> {
    try {
      // Send to monitoring service (Sentry, DataDog, etc.)
      // This is a placeholder - implement based on your monitoring solution
      await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            code: error.code,
            message: error.message,
            severity: details.severity,
            category: details.category,
            timestamp: error.timestamp,
            requestId: error.requestId,
            context: error.context,
            stack: error.stack
          }
        })
      });
    } catch (monitoringError) {
      console.error('Failed to send error to monitoring:', monitoringError);
    }
  }
}

// Export singleton instance
export const errorHandler = PlatformErrorHandler.getInstance();