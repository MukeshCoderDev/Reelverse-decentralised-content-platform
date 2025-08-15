import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PlatformErrorHandler, PlatformError } from '../ErrorHandler';
import { ErrorCodes } from '../ErrorCodes';

describe('PlatformErrorHandler', () => {
  let errorHandler: PlatformErrorHandler;

  beforeEach(() => {
    errorHandler = new PlatformErrorHandler();
    jest.clearAllMocks();
  });

  describe('createError', () => {
    it('should create a platform error with correct properties', () => {
      const error = errorHandler.createError(ErrorCodes.WALLET_NOT_CONNECTED);

      expect(error.code).toBe(ErrorCodes.WALLET_NOT_CONNECTED);
      expect(error.message).toBe('Wallet not connected');
      expect(error.timestamp).toBeGreaterThan(0);
      expect(error.requestId).toBeDefined();
    });

    it('should include original error details', () => {
      const originalError = new Error('Original error message');
      const error = errorHandler.createError(
        ErrorCodes.NETWORK_ERROR,
        originalError
      );

      expect(error.details?.originalMessage).toBe('Original error message');
      expect(error.stack).toBe(originalError.stack);
    });

    it('should include context information', () => {
      const context = { userId: '123', action: 'upload' };
      const error = errorHandler.createError(
        ErrorCodes.UPLOAD_FAILED,
        undefined,
        context
      );

      expect(error.context).toEqual(context);
    });
  });

  describe('handleError', () => {
    it('should handle platform errors correctly', () => {
      const platformError = errorHandler.createError(ErrorCodes.PAYMENT_FAILED);
      const details = errorHandler.handleError(platformError);

      expect(details.code).toBe(ErrorCodes.PAYMENT_FAILED);
      expect(details.userMessage).toBe('Payment failed. Please check your wallet and try again.');
      expect(details.retryable).toBe(true);
    });

    it('should convert generic errors to platform errors', () => {
      const genericError = new Error('Generic error');
      const details = errorHandler.handleError(genericError);

      expect(details.code).toBe(ErrorCodes.UNKNOWN_ERROR);
      expect(details.userMessage).toBe('An unexpected error occurred. Please try again or contact support.');
    });
  });

  describe('handleErrorWithRetry', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve('success');
      });

      const result = await errorHandler.handleErrorWithRetry(
        operation,
        ErrorCodes.NETWORK_ERROR,
        3,
        10 // Short delay for testing
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(
        errorHandler.handleErrorWithRetry(
          operation,
          ErrorCodes.NETWORK_ERROR,
          2,
          10
        )
      ).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Non-retryable'));
      
      // Mock the error as non-retryable
      jest.spyOn(errorHandler, 'handleError').mockReturnValue({
        code: ErrorCodes.UNAUTHORIZED_ACCESS,
        message: 'Unauthorized',
        userMessage: 'Unauthorized access',
        retryable: false,
        severity: 'medium',
        category: 'Authentication'
      });

      await expect(
        errorHandler.handleErrorWithRetry(
          operation,
          ErrorCodes.UNAUTHORIZED_ACCESS,
          3,
          10
        )
      ).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('error listeners', () => {
    it('should notify error listeners', () => {
      const listener = jest.fn();
      errorHandler.addErrorListener(listener);

      const error = errorHandler.createError(ErrorCodes.PAYMENT_FAILED);
      errorHandler.handleError(error);

      expect(listener).toHaveBeenCalledWith(error);
    });

    it('should remove error listeners', () => {
      const listener = jest.fn();
      errorHandler.addErrorListener(listener);
      errorHandler.removeErrorListener(listener);

      const error = errorHandler.createError(ErrorCodes.PAYMENT_FAILED);
      errorHandler.handleError(error);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    it('should get user-friendly messages', () => {
      const error = errorHandler.createError(ErrorCodes.AGE_VERIFICATION_REQUIRED);
      const message = errorHandler.getUserMessage(error);

      expect(message).toBe('This content is for adults only. Verify once, enjoy everywhere.');
    });

    it('should get error actions', () => {
      const error = errorHandler.createError(ErrorCodes.AGE_VERIFICATION_REQUIRED);
      const action = errorHandler.getErrorAction(error);

      expect(action).toBe('Verify Age');
    });

    it('should check if error is retryable', () => {
      const retryableError = errorHandler.createError(ErrorCodes.NETWORK_ERROR);
      const nonRetryableError = errorHandler.createError(ErrorCodes.UNAUTHORIZED_ACCESS);

      expect(errorHandler.isRetryable(retryableError)).toBe(true);
      expect(errorHandler.isRetryable(nonRetryableError)).toBe(false);
    });

    it('should get error severity', () => {
      const criticalError = errorHandler.createError(ErrorCodes.REVENUE_SPLIT_FAILED);
      const lowError = errorHandler.createError(ErrorCodes.RATE_LIMIT_EXCEEDED);

      expect(errorHandler.getErrorSeverity(criticalError)).toBe('critical');
      expect(errorHandler.getErrorSeverity(lowError)).toBe('low');
    });
  });

  describe('createErrorFromResponse', () => {
    it('should create appropriate errors for HTTP status codes', () => {
      const response401 = { status: 401, statusText: 'Unauthorized' } as Response;
      const response404 = { status: 404, statusText: 'Not Found' } as Response;
      const response500 = { status: 500, statusText: 'Internal Server Error' } as Response;

      const error401 = errorHandler.createErrorFromResponse(response401);
      const error404 = errorHandler.createErrorFromResponse(response404);
      const error500 = errorHandler.createErrorFromResponse(response500);

      expect(error401.code).toBe(ErrorCodes.UNAUTHORIZED_ACCESS);
      expect(error404.code).toBe(ErrorCodes.CONTENT_NOT_FOUND);
      expect(error500.code).toBe(ErrorCodes.SERVICE_UNAVAILABLE);
    });
  });

  describe('createBlockchainError', () => {
    it('should create appropriate blockchain errors', () => {
      const insufficientFundsError = errorHandler.createBlockchainError(
        '0x123',
        'insufficient funds for gas'
      );
      const revertedError = errorHandler.createBlockchainError(
        '0x456',
        'execution reverted'
      );

      expect(insufficientFundsError.code).toBe(ErrorCodes.INSUFFICIENT_BALANCE);
      expect(revertedError.code).toBe(ErrorCodes.TRANSACTION_REVERTED);
    });
  });
});

describe('Error Code Coverage', () => {
  it('should have user messages for all error codes', () => {
    const errorHandler = new PlatformErrorHandler();
    
    Object.values(ErrorCodes).forEach(errorCode => {
      const error = errorHandler.createError(errorCode);
      const message = errorHandler.getUserMessage(error);
      
      expect(message).toBeDefined();
      expect(message.length).toBeGreaterThan(0);
    });
  });

  it('should have appropriate severity levels', () => {
    const errorHandler = new PlatformErrorHandler();
    
    Object.values(ErrorCodes).forEach(errorCode => {
      const error = errorHandler.createError(errorCode);
      const severity = errorHandler.getErrorSeverity(error);
      
      expect(['low', 'medium', 'high', 'critical']).toContain(severity);
    });
  });
});