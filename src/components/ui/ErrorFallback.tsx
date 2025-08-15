import React from 'react';
import { AlertTriangle, RefreshCw, Home, MessageCircle, Copy, CheckCircle } from 'lucide-react';
import { ErrorFallbackProps } from './ErrorBoundary';
import { errorHandler } from '../../lib/errors/ErrorHandler';
import { ErrorCodes } from '../../lib/errors/ErrorCodes';

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  resetError,
  retry
}) => {
  const [copied, setCopied] = React.useState(false);
  const errorDetails = errorHandler.handleError(error);

  const handleCopyError = async () => {
    const errorText = `
Error Code: ${error.code}
Message: ${error.message}
Timestamp: ${new Date(error.timestamp).toISOString()}
Request ID: ${error.requestId || 'N/A'}
Context: ${JSON.stringify(error.context || {}, null, 2)}
Stack: ${error.stack || 'N/A'}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  const getSeverityColor = () => {
    switch (errorDetails.severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-red-500 bg-red-50 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getIcon = () => {
    switch (errorDetails.severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-8 w-8 text-red-500" />;
      case 'medium':
        return <AlertTriangle className="h-8 w-8 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-8 w-8 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className={`max-w-md w-full rounded-lg border p-6 ${getSeverityColor()}`}>
        <div className="flex items-center space-x-3 mb-4">
          {getIcon()}
          <div>
            <h3 className="text-lg font-semibold">
              {errorDetails.severity === 'critical' ? 'Critical Error' :
               errorDetails.severity === 'high' ? 'Error' :
               errorDetails.severity === 'medium' ? 'Something went wrong' :
               'Minor Issue'}
            </h3>
            <p className="text-sm opacity-75">
              Error Code: {error.code}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm leading-relaxed">
            {errorDetails.userMessage}
          </p>
          
          {error.requestId && (
            <p className="text-xs mt-2 opacity-75">
              Reference ID: {error.requestId}
            </p>
          )}
        </div>

        <div className="space-y-3">
          {/* Primary Action */}
          {errorDetails.action && retry && (
            <button
              onClick={retry}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>{errorDetails.action}</span>
            </button>
          )}

          {/* Reset/Go Back */}
          <button
            onClick={resetError}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>Go Back</span>
          </button>

          {/* Copy Error Details */}
          <button
            onClick={handleCopyError}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy Error Details</span>
              </>
            )}
          </button>

          {/* Contact Support for Critical Errors */}
          {(errorDetails.severity === 'critical' || errorDetails.severity === 'high') && (
            <a
              href="/support"
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Contact Support</span>
            </a>
          )}
        </div>

        {/* Development Info */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 p-3 bg-gray-100 rounded-md">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Development Details
            </summary>
            <div className="mt-2 space-y-2 text-xs text-gray-600">
              <div>
                <strong>Error:</strong> {error.message}
              </div>
              <div>
                <strong>Code:</strong> {error.code}
              </div>
              <div>
                <strong>Category:</strong> {errorDetails.category}
              </div>
              <div>
                <strong>Retryable:</strong> {errorDetails.retryable ? 'Yes' : 'No'}
              </div>
              {error.context && (
                <div>
                  <strong>Context:</strong>
                  <pre className="mt-1 p-2 bg-gray-200 rounded text-xs overflow-auto">
                    {JSON.stringify(error.context, null, 2)}
                  </pre>
                </div>
              )}
              {errorInfo && (
                <div>
                  <strong>Component Stack:</strong>
                  <pre className="mt-1 p-2 bg-gray-200 rounded text-xs overflow-auto">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

// Specialized fallback components for different contexts

export const PaymentErrorFallback: React.FC<ErrorFallbackProps> = (props) => {
  const { error } = props;
  
  // Payment-specific messaging
  const getPaymentMessage = () => {
    switch (error.code) {
      case ErrorCodes.INSUFFICIENT_BALANCE:
        return "You don't have enough funds in your wallet. Please add funds and try again.";
      case ErrorCodes.PERMIT_EXPIRED:
        return "Payment authorization expired. Please try the purchase again.";
      case ErrorCodes.TRANSACTION_REVERTED:
        return "Transaction failed on the blockchain. This might be due to network congestion.";
      default:
        return "Payment failed. Please try again or use a different payment method.";
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center space-x-3 mb-4">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <div>
          <h3 className="text-lg font-semibold text-red-800">Payment Failed</h3>
          <p className="text-sm text-red-600">Error Code: {error.code}</p>
        </div>
      </div>
      
      <p className="text-red-700 mb-6">{getPaymentMessage()}</p>
      
      <div className="space-y-3">
        {props.retry && (
          <button
            onClick={props.retry}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        )}
        <button
          onClick={props.resetError}
          className="w-full px-4 py-2 bg-white text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
        >
          Choose Different Payment Method
        </button>
      </div>
    </div>
  );
};

export const UploadErrorFallback: React.FC<ErrorFallbackProps> = (props) => {
  const { error } = props;
  
  const getUploadMessage = () => {
    switch (error.code) {
      case ErrorCodes.FILE_TOO_LARGE:
        return "File is too large. Please compress your video or choose a smaller file.";
      case ErrorCodes.INVALID_FILE_TYPE:
        return "File type not supported. Please use MP4, MOV, or AVI format.";
      case ErrorCodes.STORAGE_QUOTA_EXCEEDED:
        return "Storage limit reached. Please delete some content or upgrade your plan.";
      case ErrorCodes.TRANSCODING_FAILED:
        return "Video processing failed. Please check the file quality and try again.";
      default:
        return "Upload failed. Please check your connection and try again.";
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-center space-x-3 mb-4">
        <AlertTriangle className="h-8 w-8 text-yellow-500" />
        <div>
          <h3 className="text-lg font-semibold text-yellow-800">Upload Failed</h3>
          <p className="text-sm text-yellow-600">Error Code: {error.code}</p>
        </div>
      </div>
      
      <p className="text-yellow-700 mb-6">{getUploadMessage()}</p>
      
      <div className="space-y-3">
        {props.retry && (
          <button
            onClick={props.retry}
            className="w-full px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
          >
            Retry Upload
          </button>
        )}
        <button
          onClick={props.resetError}
          className="w-full px-4 py-2 bg-white text-yellow-600 border border-yellow-300 rounded-md hover:bg-yellow-50 transition-colors"
        >
          Choose Different File
        </button>
      </div>
    </div>
  );
};

export const VideoPlayerErrorFallback: React.FC<ErrorFallbackProps> = (props) => {
  return (
    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-center p-6">
        <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Video Unavailable
        </h3>
        <p className="text-gray-600 mb-4">
          Unable to load video content. Please try refreshing the page.
        </p>
        {props.retry && (
          <button
            onClick={props.retry}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};