import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { ErrorCodes } from '../../lib/errors/ErrorCodes';
import { PlatformError } from '../../lib/errors/ErrorHandler';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  persistent?: boolean;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  showError: (error: PlatformError | Error | string, action?: Toast['action']) => string;
  showSuccess: (message: string, action?: Toast['action']) => string;
  showWarning: (message: string, action?: Toast['action']) => string;
  showInfo: (message: string, action?: Toast['action']) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? (toast.type === 'error' ? 8000 : 5000)
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove toast after duration (unless persistent)
    if (!newToast.persistent && newToast.duration) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showError = useCallback((
    error: PlatformError | Error | string,
    action?: Toast['action']
  ) => {
    let title: string;
    let message: string | undefined;

    if (typeof error === 'string') {
      title = 'Error';
      message = error;
    } else if ('code' in error) {
      // Platform error
      const platformError = error as PlatformError;
      title = getErrorTitle(platformError.code);
      message = getErrorMessage(platformError.code);
    } else {
      // Generic error
      title = 'Error';
      message = error.message;
    }

    return addToast({
      type: 'error',
      title,
      message,
      action,
      persistent: action !== undefined // Keep persistent if there's an action
    });
  }, [addToast]);

  const showSuccess = useCallback((message: string, action?: Toast['action']) => {
    return addToast({
      type: 'success',
      title: 'Success',
      message,
      action
    });
  }, [addToast]);

  const showWarning = useCallback((message: string, action?: Toast['action']) => {
    return addToast({
      type: 'warning',
      title: 'Warning',
      message,
      action
    });
  }, [addToast]);

  const showInfo = useCallback((message: string, action?: Toast['action']) => {
    return addToast({
      type: 'info',
      title: 'Info',
      message,
      action
    });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{
      toasts,
      addToast,
      removeToast,
      clearToasts,
      showError,
      showSuccess,
      showWarning,
      showInfo
    }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300); // Match animation duration
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getTextColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-yellow-800';
      case 'info':
        return 'text-blue-800';
    }
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${getBackgroundColor()}
        border rounded-lg shadow-lg p-4 max-w-sm w-full
      `}
    >
      <div className="flex items-start space-x-3">
        {getIcon()}
        
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold ${getTextColor()}`}>
            {toast.title}
          </h4>
          {toast.message && (
            <p className={`text-sm mt-1 ${getTextColor()} opacity-90`}>
              {toast.message}
            </p>
          )}
          
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className={`
                text-sm font-medium mt-2 underline hover:no-underline
                ${getTextColor()}
              `}
            >
              {toast.action.label}
            </button>
          )}
        </div>

        <button
          onClick={handleClose}
          className={`
            flex-shrink-0 p-1 rounded-md hover:bg-black hover:bg-opacity-10
            ${getTextColor()}
          `}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Helper functions for error messages
function getErrorTitle(errorCode: ErrorCodes): string {
  switch (errorCode) {
    case ErrorCodes.WALLET_NOT_CONNECTED:
      return 'Wallet Required';
    case ErrorCodes.AGE_VERIFICATION_REQUIRED:
      return 'Age Verification Required';
    case ErrorCodes.INSUFFICIENT_ENTITLEMENT:
      return 'Premium Content';
    case ErrorCodes.PAYMENT_FAILED:
      return 'Payment Failed';
    case ErrorCodes.UPLOAD_FAILED:
      return 'Upload Failed';
    case ErrorCodes.NETWORK_ERROR:
      return 'Connection Error';
    case ErrorCodes.SERVICE_UNAVAILABLE:
      return 'Service Unavailable';
    default:
      return 'Error';
  }
}

function getErrorMessage(errorCode: ErrorCodes): string {
  switch (errorCode) {
    case ErrorCodes.WALLET_NOT_CONNECTED:
      return 'Please connect your wallet to continue.';
    case ErrorCodes.AGE_VERIFICATION_REQUIRED:
      return 'This content is for adults only. Verify once, enjoy everywhere.';
    case ErrorCodes.INSUFFICIENT_ENTITLEMENT:
      return 'Support this creator and unlock exclusive content.';
    case ErrorCodes.PAYMENT_FAILED:
      return 'Payment failed. Please check your wallet and try again.';
    case ErrorCodes.UPLOAD_FAILED:
      return 'Upload failed. Please check your connection and try again.';
    case ErrorCodes.NETWORK_ERROR:
      return 'Network error. Please check your connection and try again.';
    case ErrorCodes.SERVICE_UNAVAILABLE:
      return 'Service is temporarily unavailable. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}