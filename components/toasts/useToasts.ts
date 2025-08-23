/**
 * Toast Notifications
 * 
 * Simple toast notification system for success/error messages
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Icon from '../components/Icon';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Toast Provider Component
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove toast after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

// Hook to use toasts
export const useToasts = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToasts must be used within a ToastProvider');
  }
  return context;
};

// Toast Container Component
const ToastContainer: React.FC<{
  toasts: Toast[];
  onRemove: (id: string) => void;
}> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

// Individual Toast Component
const ToastItem: React.FC<{
  toast: Toast;
  onRemove: (id: string) => void;
}> = ({ toast, onRemove }) => {
  const getToastStyles = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-rose-50 border-rose-200 text-rose-800';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-800';
    }
  };

  const getIconName = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'alert-circle';
      case 'warning':
        return 'alert-circle';
      case 'info':
        return 'info';
      default:
        return 'info';
    }
  };

  const getIconColor = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-rose-600';
      case 'warning':
        return 'text-amber-600';
      case 'info':
        return 'text-blue-600';
      default:
        return 'text-slate-600';
    }
  };

  return (
    <div
      className={`p-4 border rounded-lg shadow-lg animate-slide-in ${getToastStyles(toast.type)}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start space-x-3">
        <Icon 
          name={getIconName(toast.type)} 
          size={20} 
          className={`mt-0.5 ${getIconColor(toast.type)}`}
        />
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium">{toast.title}</h4>
          {toast.message && (
            <p className="text-sm mt-1 opacity-90">{toast.message}</p>
          )}
          
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="text-sm font-medium underline mt-2 hover:no-underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        
        <button
          onClick={() => onRemove(toast.id)}
          className="text-sm hover:opacity-70 focus:outline-none"
          aria-label="Close notification"
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

// Utility functions for common toast types
export const showSuccessToast = (addToast: ToastContextType['addToast']) => (
  title: string,
  message?: string,
  action?: Toast['action']
) => {
  addToast({
    type: 'success',
    title,
    message,
    action,
    duration: 4000
  });
};

export const showErrorToast = (addToast: ToastContextType['addToast']) => (
  title: string,
  message?: string,
  action?: Toast['action']
) => {
  addToast({
    type: 'error',
    title,
    message,
    action,
    duration: 6000
  });
};

export const showWarningToast = (addToast: ToastContextType['addToast']) => (
  title: string,
  message?: string,
  action?: Toast['action']
) => {
  addToast({
    type: 'warning',
    title,
    message,
    action,
    duration: 5000
  });
};

export const showInfoToast = (addToast: ToastContextType['addToast']) => (
  title: string,
  message?: string,
  action?: Toast['action']
) => {
  addToast({
    type: 'info',
    title,
    message,
    action,
    duration: 4000
  });
};