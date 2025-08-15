import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorHandler, PlatformError } from '../../lib/errors/ErrorHandler';
import { ErrorCodes } from '../../lib/errors/ErrorCodes';
import { ErrorFallback } from './ErrorFallback';

interface Props {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean; // If true, only catches errors from direct children
}

interface State {
  hasError: boolean;
  error?: PlatformError;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

export interface ErrorFallbackProps {
  error: PlatformError;
  errorInfo?: ErrorInfo;
  resetError: () => void;
  retry?: () => void;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Convert to platform error if needed
    const platformError = error instanceof Error && 'code' in error 
      ? error as PlatformError
      : errorHandler.createError(ErrorCodes.UNKNOWN_ERROR, error);

    return {
      hasError: true,
      error: platformError,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const platformError = this.state.error || errorHandler.createError(
      ErrorCodes.UNKNOWN_ERROR, 
      error,
      {
        componentStack: errorInfo.componentStack,
        errorBoundary: this.constructor.name
      }
    );

    // Update state with error info
    this.setState({ errorInfo });

    // Handle error through error handler
    errorHandler.handleError(platformError);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Platform Error:', platformError);
      console.groupEnd();
    }
  }

  resetError = () => {
    this.retryCount = 0;
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      errorId: undefined 
    });
  };

  retryOperation = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.resetError();
    }
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || ErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          resetError={this.resetError}
          retry={errorHandler.isRetryable(this.state.error) ? this.retryOperation : undefined}
        />
      );
    }

    return this.props.children;
  }
}

// Specialized error boundaries for different contexts

export class PaymentErrorBoundary extends ErrorBoundary {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Add payment-specific context
    const platformError = errorHandler.createError(
      ErrorCodes.PAYMENT_FAILED,
      error,
      {
        context: 'payment',
        componentStack: errorInfo.componentStack
      }
    );

    super.componentDidCatch(platformError, errorInfo);
  }
}

export class UploadErrorBoundary extends ErrorBoundary {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Add upload-specific context
    const platformError = errorHandler.createError(
      ErrorCodes.UPLOAD_FAILED,
      error,
      {
        context: 'upload',
        componentStack: errorInfo.componentStack
      }
    );

    super.componentDidCatch(platformError, errorInfo);
  }
}

export class VideoPlayerErrorBoundary extends ErrorBoundary {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Add video player-specific context
    const platformError = errorHandler.createError(
      ErrorCodes.CONTENT_PROCESSING,
      error,
      {
        context: 'video_player',
        componentStack: errorInfo.componentStack
      }
    );

    super.componentDidCatch(platformError, errorInfo);
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for error boundary context
export function useErrorHandler() {
  return {
    handleError: (error: Error) => {
      const platformError = errorHandler.handleError(error);
      throw error; // Re-throw to trigger error boundary
    },
    createError: errorHandler.createError.bind(errorHandler),
    isRetryable: errorHandler.isRetryable.bind(errorHandler),
    getUserMessage: errorHandler.getUserMessage.bind(errorHandler),
    getErrorAction: errorHandler.getErrorAction.bind(errorHandler)
  };
}