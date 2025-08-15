import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReelverseError, ErrorCodes, isRetryableError, getErrorCode } from '../lib/errors';
import { retryWithBackoff, CircuitBreaker, RETRY_CONFIGS } from '../lib/retry';

describe('Error Handling System', () => {
  describe('ReelverseError', () => {
    it('should create error with correct properties', () => {
      const error = new ReelverseError(
        ErrorCodes.PAYMENT_FAILED,
        'Custom message',
        { detail: 'test' }
      );

      expect(error.code).toBe(ErrorCodes.PAYMENT_FAILED);
      expect(error.message).toBe('Custom message');
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.retryable).toBe(true);
      expect(error.requestId).toBeDefined();
      expect(error.timestamp).toBeDefined();
    });

    it('should use default message if none provided', () => {
      const error = new ReelverseError(ErrorCodes.AGE_VERIFICATION_REQUIRED);
      expect(error.message).toBe('This content is for adults only. Verify once, enjoy everywhere.');
    });

    it('should serialize to JSON correctly', () => {
      const error = new ReelverseError(ErrorCodes.CONTENT_NOT_FOUND);
      const json = error.toJSON();

      expect(json.code).toBe(ErrorCodes.CONTENT_NOT_FOUND);
      expect(json.message).toBeDefined();
      expect(json.timestamp).toBeDefined();
      expect(json.requestId).toBeDefined();
      expect(json.retryable).toBe(false);
    });

    it('should return user-friendly message', () => {
      const error = new ReelverseError(ErrorCodes.INSUFFICIENT_BALANCE);
      const userMessage = error.getUserFriendlyMessage();

      expect(userMessage.title).toBe('Insufficient Balance');
      expect(userMessage.action).toBe('Add Funds');
      expect(userMessage.retryable).toBe(false);
    });
  });

  describe('Error Utilities', () => {
    it('should identify retryable errors correctly', () => {
      const retryableError = new ReelverseError(ErrorCodes.NETWORK_ERROR);
      const nonRetryableError = new ReelverseError(ErrorCodes.CONTENT_NOT_FOUND);

      expect(isRetryableError(retryableError)).toBe(true);
      expect(isRetryableError(nonRetryableError)).toBe(false);
    });

    it('should map generic errors to error codes', () => {
      const networkError = new Error('network timeout');
      const signatureError = new Error('invalid signature');
      const genericError = new Error('something went wrong');

      expect(getErrorCode(networkError)).toBe(ErrorCodes.NETWORK_ERROR);
      expect(getErrorCode(signatureError)).toBe(ErrorCodes.INVALID_SIGNATURE);
      expect(getErrorCode(genericError)).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Retry Mechanism', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should succeed on first attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      
      const result = await retryWithBackoff(mockFn, {
        maxRetries: 3,
        baseDelay: 1000
      });

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const retryPromise = retryWithBackoff(mockFn, {
        maxRetries: 3,
        baseDelay: 1000
      });

      // Fast-forward through delays
      vi.advanceTimersByTime(5000);
      
      const result = await retryPromise;
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should respect retry condition', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('non-retryable'));
      
      await expect(
        retryWithBackoff(mockFn, {
          maxRetries: 3,
          baseDelay: 1000,
          retryCondition: () => false
        })
      ).rejects.toThrow('non-retryable');

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      
      const onRetry = vi.fn();

      const retryPromise = retryWithBackoff(mockFn, {
        maxRetries: 2,
        baseDelay: 1000,
        onRetry
      });

      vi.advanceTimersByTime(2000);
      
      await retryPromise;
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    });
  });

  describe('Circuit Breaker', () => {
    it('should allow requests when closed', async () => {
      const circuitBreaker = new CircuitBreaker(3, 5000);
      const mockFn = vi.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(mockFn);
      expect(result).toBe('success');
      expect(circuitBreaker.getState().state).toBe('CLOSED');
    });

    it('should open after failure threshold', async () => {
      const circuitBreaker = new CircuitBreaker(2, 5000);
      const mockFn = vi.fn().mockRejectedValue(new Error('fail'));

      // First two failures
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();

      expect(circuitBreaker.getState().state).toBe('OPEN');

      // Should reject without calling function
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Circuit breaker is OPEN');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should transition to half-open after timeout', async () => {
      vi.useFakeTimers();
      
      const circuitBreaker = new CircuitBreaker(1, 5000);
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      // Trigger failure to open circuit
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      expect(circuitBreaker.getState().state).toBe('OPEN');

      // Fast-forward past reset timeout
      vi.advanceTimersByTime(6000);

      // Should allow one request (half-open)
      const result = await circuitBreaker.execute(mockFn);
      expect(result).toBe('success');
      expect(circuitBreaker.getState().state).toBe('CLOSED');

      vi.useRealTimers();
    });
  });

  describe('Retry Configurations', () => {
    it('should have correct network retry config', () => {
      const config = RETRY_CONFIGS.NETWORK;
      
      expect(config.maxRetries).toBe(3);
      expect(config.baseDelay).toBe(1000);
      expect(config.retryCondition).toBeDefined();
      
      // Test retry condition
      expect(config.retryCondition!({ code: 'NETWORK_ERROR' })).toBe(true);
      expect(config.retryCondition!({ status: 500 })).toBe(true);
      expect(config.retryCondition!({ status: 404 })).toBe(false);
    });

    it('should have correct payment retry config', () => {
      const config = RETRY_CONFIGS.PAYMENT;
      
      expect(config.maxRetries).toBe(2);
      expect(config.retryCondition).toBeDefined();
      
      // Test retry condition
      expect(config.retryCondition!({ code: 'INSUFFICIENT_BALANCE' })).toBe(false);
      expect(config.retryCondition!({ code: 'INVALID_SIGNATURE' })).toBe(false);
      expect(config.retryCondition!({ code: 'NETWORK_ERROR' })).toBe(true);
    });

    it('should have correct upload retry config', () => {
      const config = RETRY_CONFIGS.UPLOAD;
      
      expect(config.maxRetries).toBe(3);
      expect(config.baseDelay).toBe(5000);
      
      // Test retry condition
      expect(config.retryCondition!({ code: 'FILE_TOO_LARGE' })).toBe(false);
      expect(config.retryCondition!({ code: 'INVALID_FILE_TYPE' })).toBe(false);
      expect(config.retryCondition!({ code: 'UPLOAD_FAILED' })).toBe(true);
    });
  });
});