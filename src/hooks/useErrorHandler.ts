import { useCallback, useState } from 'react';
import { ReelverseError, ErrorCodes, isRetryableError, getErrorCode } from '../lib/errors';

interface UseErrorHandlerOptions {
  onError?: (error: ReelverseError) => void;
  maxRetries?: number;
  retryDelay?: number;
}

interface ErrorState {
  error: ReelverseError | null;
  isRetrying: boolean;
  retryCount: number;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { onError, maxRetries = 3, retryDelay = 1000 } = options;
  
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isRetrying: false,
    retryCount: 0
  });

  const handleError = useCallback((error: any, context?: string) => {
    let reelverseError: ReelverseError;
    
    if (error instanceof ReelverseError) {
      reelverseError = error;
    } else {
      const errorCode = getErrorCode(error);
      reelverseError = new ReelverseError(
        errorCode,
        error.message || 'An unexpected error occurred',
        { originalError: error, context }
      );
    }

    setErrorState(prev => ({
      error: reelverseError,
      isRetrying: false,
      retryCount: prev.error?.code === reelverseError.code ? prev.retryCount : 0
    }));

    if (onError) {
      onError(reelverseError);
    }

    // Log error for monitoring
    console.error('Error handled:', reelverseError.toJSON());
    
    return reelverseError;
  }, [onError]);

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isRetrying: false,
      retryCount: 0
    });
  }, []);

  const retry = useCallback(async (retryFn: () => Promise<any>) => {
    if (!errorState.error || !isRetryableError(errorState.error)) {
      return;
    }

    if (errorState.retryCount >= maxRetries) {
      handleError(new ReelverseError(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Maximum retry attempts exceeded'
      ));
      return;
    }

    setErrorState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1
    }));

    // Exponential backoff delay
    const delay = retryDelay * Math.pow(2, errorState.retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const result = await retryFn();
      clearError();
      return result;
    } catch (error) {
      handleError(error);
    } finally {
      setErrorState(prev => ({
        ...prev,
        isRetrying: false
      }));
    }
  }, [errorState, maxRetries, retryDelay, handleError, clearError]);

  const withErrorHandling = useCallback(<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context?: string
  ) => {
    return async (...args: T): Promise<R | undefined> => {
      try {
        clearError();
        return await fn(...args);
      } catch (error) {
        handleError(error, context);
        return undefined;
      }
    };
  }, [handleError, clearError]);

  return {
    error: errorState.error,
    isRetrying: errorState.isRetrying,
    retryCount: errorState.retryCount,
    canRetry: errorState.error ? isRetryableError(errorState.error) && errorState.retryCount < maxRetries : false,
    handleError,
    clearError,
    retry,
    withErrorHandling
  };
}

// Specialized hooks for different contexts
export function usePaymentErrorHandler() {
  return useErrorHandler({
    maxRetries: 2,
    retryDelay: 2000,
    onError: (error) => {
      // Track payment errors for analytics
      console.log('Payment error tracked:', error.code);
    }
  });
}

export function useUploadErrorHandler() {
  return useErrorHandler({
    maxRetries: 3,
    retryDelay: 5000,
    onError: (error) => {
      // Track upload errors
      console.log('Upload error tracked:', error.code);
    }
  });
}

export function useBlockchainErrorHandler() {
  return useErrorHandler({
    maxRetries: 2,
    retryDelay: 3000,
    onError: (error) => {
      // Track blockchain errors
      console.log('Blockchain error tracked:', error.code);
    }
  });
}