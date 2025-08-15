import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ReelverseError, ErrorCodes, ERROR_MESSAGES } from '../lib/errors';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log error to monitoring service
    this.logError(error, errorInfo);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private logError(error: Error, errorInfo: ErrorInfo) {
    // In production, send to monitoring service (Sentry, LogRocket, etc.)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Example: Send to monitoring service
    // Sentry.captureException(error, { extra: errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo!);
      }

      // Default error UI
      return (
        <ErrorFallback 
          error={this.state.error} 
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  onRetry: () => void;
}

function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const isReelverseError = error instanceof ReelverseError;
  const errorInfo = isReelverseError 
    ? error.getUserFriendlyMessage()
    : ERROR_MESSAGES[ErrorCodes.INTERNAL_SERVER_ERROR];

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {errorInfo.title}
        </h3>
        
        <p className="text-gray-600 mb-6">
          {errorInfo.message}
        </p>
        
        <div className="space-y-3">
          {errorInfo.retryable && (
            <button
              onClick={onRetry}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors"
            >
              {errorInfo.action || 'Try Again'}
            </button>
          )}
          
          {errorInfo.actionUrl && (
            <a
              href={errorInfo.actionUrl}
              className="block w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {errorInfo.action}
            </a>
          )}
          
          <button
            onClick={() => window.location.reload()}
            className="w-full text-gray-500 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Refresh Page
          </button>
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Error Details (Development)
            </summary>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// Specialized error boundaries for different contexts
export class PaymentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log payment-specific error
    console.error('Payment error:', error, errorInfo);
    
    // Track payment failure analytics
    // analytics.track('payment_error', { error: error.message });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <PaymentErrorFallback 
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false })}
        />
      );
    }

    return this.props.children;
  }
}

function PaymentErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const isReelverseError = error instanceof ReelverseError;
  const errorInfo = isReelverseError 
    ? error.getUserFriendlyMessage()
    : ERROR_MESSAGES[ErrorCodes.PAYMENT_FAILED];

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            {errorInfo.title}
          </h3>
          <p className="mt-1 text-sm text-red-700">
            {errorInfo.message}
          </p>
          {errorInfo.retryable && (
            <div className="mt-3">
              <button
                onClick={onRetry}
                className="bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200 transition-colors"
              >
                {errorInfo.action || 'Try Again'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export class UploadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log upload-specific error
    console.error('Upload error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <UploadErrorFallback 
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false })}
        />
      );
    }

    return this.props.children;
  }
}

function UploadErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const isReelverseError = error instanceof ReelverseError;
  const errorInfo = isReelverseError 
    ? error.getUserFriendlyMessage()
    : ERROR_MESSAGES[ErrorCodes.UPLOAD_FAILED];

  return (
    <div className="border-2 border-dashed border-red-300 rounded-lg p-6 text-center">
      <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">
        {errorInfo.title}
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        {errorInfo.message}
      </p>
      {errorInfo.retryable && (
        <div className="mt-4">
          <button
            onClick={onRetry}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 transition-colors"
          >
            {errorInfo.action || 'Try Again'}
          </button>
        </div>
      )}
    </div>
  );
}