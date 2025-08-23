/**
 * Upload Store
 * 
 * React Context-based state management for upload functionality
 * with localStorage persistence
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { 
  UploadState, 
  UploadActions, 
  UploadSessionClient, 
  UploadProgress, 
  ContentMetadata, 
  MonetizationSettings, 
  UploadStatus,
  DEFAULT_METADATA,
  DEFAULT_MONETIZATION
} from '../types/upload';

// Storage key for localStorage persistence
const STORAGE_KEY = 'rv.upload.state';

// Initial state
const initialState: UploadState = {
  session: null,
  progress: {
    bytesUploaded: 0,
    totalBytes: 0,
    percentage: 0,
    speed: 0,
    estimatedTimeRemaining: 0,
    chunkNumber: 0,
    totalChunks: 0
  },
  file: {
    instance: null,
    preview: null,
    fingerprint: null,
    name: '',
    size: 0,
    type: '',
    lastModified: 0
  },
  metadata: DEFAULT_METADATA,
  monetization: DEFAULT_MONETIZATION,
  ui: {
    currentStep: 0,
    isPaused: false,
    showAdvanced: false,
    errors: [],
    isUploading: false,
    canPublish: false
  },
  status: 'idle',
  content: {}
};

// Action types
type UploadAction = 
  | { type: 'SET_FILE'; payload: File }
  | { type: 'CLEAR_FILE' }
  | { type: 'SET_SESSION'; payload: UploadSessionClient }
  | { type: 'UPDATE_PROGRESS'; payload: Partial<UploadProgress> }
  | { type: 'UPDATE_METADATA'; payload: Partial<ContentMetadata> }
  | { type: 'UPDATE_MONETIZATION'; payload: Partial<MonetizationSettings> }
  | { type: 'SET_CURRENT_STEP'; payload: number }
  | { type: 'ADD_ERROR'; payload: string }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_UPLOADING'; payload: boolean }
  | { type: 'SET_PAUSED'; payload: boolean }
  | { type: 'SET_STATUS'; payload: UploadStatus }
  | { type: 'UPDATE_CONTENT'; payload: Partial<UploadState['content']> }
  | { type: 'RESET' }
  | { type: 'LOAD_FROM_STORAGE'; payload: Partial<UploadState> };

// Generate file fingerprint
function generateFileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

// Reducer function
function uploadReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case 'SET_FILE': {
      const file = action.payload;
      const fingerprint = generateFileFingerprint(file);
      
      return {
        ...state,
        file: {
          instance: file,
          preview: null, // Will be set by component
          fingerprint,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        },
        progress: {
          ...state.progress,
          totalBytes: file.size,
          totalChunks: 0 // Will be calculated when session is created
        },
        ui: {
          ...state.ui,
          errors: []
        }
      };
    }

    case 'CLEAR_FILE':
      return {
        ...state,
        file: initialState.file,
        progress: initialState.progress,
        session: null,
        status: 'idle',
        ui: {
          ...state.ui,
          currentStep: 0,
          isUploading: false,
          canPublish: false,
          errors: []
        }
      };

    case 'SET_SESSION':
      return {
        ...state,
        session: action.payload,
        progress: {
          ...state.progress,
          totalChunks: Math.ceil(action.payload.totalBytes / action.payload.chunkSize)
        }
      };

    case 'UPDATE_PROGRESS':
      return {
        ...state,
        progress: {
          ...state.progress,
          ...action.payload
        }
      };

    case 'UPDATE_METADATA':
      const updatedMetadata = {
        ...state.metadata,
        ...action.payload
      };
      
      // Update canPublish based on title requirement
      const canPublish = updatedMetadata.title.trim().length > 0 && 
                        (state.status === 'playable' || state.status === 'hd_ready' || state.status === 'uploaded');
      
      return {
        ...state,
        metadata: updatedMetadata,
        ui: {
          ...state.ui,
          canPublish
        }
      };

    case 'UPDATE_MONETIZATION':
      return {
        ...state,
        monetization: {
          ...state.monetization,
          ...action.payload
        }
      };

    case 'SET_CURRENT_STEP':
      return {
        ...state,
        ui: {
          ...state.ui,
          currentStep: action.payload
        }
      };

    case 'ADD_ERROR':
      return {
        ...state,
        ui: {
          ...state.ui,
          errors: [...state.ui.errors, action.payload]
        }
      };

    case 'CLEAR_ERRORS':
      return {
        ...state,
        ui: {
          ...state.ui,
          errors: []
        }
      };

    case 'SET_UPLOADING':
      return {
        ...state,
        ui: {
          ...state.ui,
          isUploading: action.payload
        }
      };

    case 'SET_PAUSED':
      return {
        ...state,
        ui: {
          ...state.ui,
          isPaused: action.payload
        }
      };

    case 'SET_STATUS': {
      const newStatus = action.payload;
      const canPublish = state.metadata.title.trim().length > 0 && 
                        (newStatus === 'playable' || newStatus === 'hd_ready' || newStatus === 'uploaded');
      
      return {
        ...state,
        status: newStatus,
        ui: {
          ...state.ui,
          canPublish,
          isUploading: newStatus === 'uploading'
        }
      };
    }

    case 'UPDATE_CONTENT':
      return {
        ...state,
        content: {
          ...state.content,
          ...action.payload
        }
      };

    case 'RESET':
      return initialState;

    case 'LOAD_FROM_STORAGE':
      return {
        ...state,
        ...action.payload,
        file: {
          ...state.file,
          instance: null // File instance cannot be persisted
        }
      };

    default:
      return state;
  }
}

// Context creation
const UploadContext = createContext<{
  state: UploadState;
  actions: UploadActions;
} | null>(null);

// Provider props
interface UploadProviderProps {
  children: ReactNode;
}

// Provider component
export const UploadProvider: React.FC<UploadProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(uploadReducer, initialState);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        dispatch({ type: 'LOAD_FROM_STORAGE', payload: parsedState });
      }
    } catch (error) {
      console.warn('Failed to load upload state from localStorage:', error);
    }
  }, []);

  // Save to localStorage when state changes (excluding file instance)
  useEffect(() => {
    try {
      const stateToSave = {
        ...state,
        file: {
          ...state.file,
          instance: null // Don't persist File object
        }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Failed to save upload state to localStorage:', error);
    }
  }, [state]);

  // Actions
  const actions: UploadActions = {
    setFile: (file: File) => {
      dispatch({ type: 'SET_FILE', payload: file });
    },

    clearFile: () => {
      dispatch({ type: 'CLEAR_FILE' });
    },

    setSession: (session: UploadSessionClient) => {
      dispatch({ type: 'SET_SESSION', payload: session });
    },

    updateProgress: (progress: Partial<UploadProgress>) => {
      dispatch({ type: 'UPDATE_PROGRESS', payload: progress });
    },

    updateMetadata: (metadata: Partial<ContentMetadata>) => {
      dispatch({ type: 'UPDATE_METADATA', payload: metadata });
    },

    updateMonetization: (monetization: Partial<MonetizationSettings>) => {
      dispatch({ type: 'UPDATE_MONETIZATION', payload: monetization });
    },

    setCurrentStep: (step: number) => {
      dispatch({ type: 'SET_CURRENT_STEP', payload: step });
    },

    addError: (error: string) => {
      dispatch({ type: 'ADD_ERROR', payload: error });
    },

    clearErrors: () => {
      dispatch({ type: 'CLEAR_ERRORS' });
    },

    setUploading: (uploading: boolean) => {
      dispatch({ type: 'SET_UPLOADING', payload: uploading });
    },

    setPaused: (paused: boolean) => {
      dispatch({ type: 'SET_PAUSED', payload: paused });
    },

    setStatus: (status: UploadStatus) => {
      dispatch({ type: 'SET_STATUS', payload: status });
    },

    updateContent: (content: Partial<UploadState['content']>) => {
      dispatch({ type: 'UPDATE_CONTENT', payload: content });
    },

    reset: () => {
      dispatch({ type: 'RESET' });
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.warn('Failed to remove upload state from localStorage:', error);
      }
    }
  };

  return (
    <UploadContext.Provider value={{
      state,
      actions
    }}>
      {children}
    </UploadContext.Provider>
  );
};

// Hook to use upload context
export const useUploadStore = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUploadStore must be used within an UploadProvider');
  }
  return context;
};

// Utility functions
export const getUploadStepInfo = (step: number) => {
  const steps = [
    { id: 'upload', label: 'Upload', completed: false },
    { id: 'details', label: 'Details', completed: false },
    { id: 'monetize', label: 'Monetize & Distribute', completed: false },
    { id: 'publish', label: 'Publish', completed: false }
  ];

  return steps.map((s, index) => ({
    ...s,
    completed: index < step
  }));
};

export const validateMetadata = (metadata: ContentMetadata): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!metadata.title.trim()) {
    errors.title = 'Title is required';
  } else if (metadata.title.length > 100) {
    errors.title = 'Title must be 100 characters or less';
  }

  if (metadata.description.length > 5000) {
    errors.description = 'Description must be 5000 characters or less';
  }

  if (metadata.tags.length > 10) {
    errors.tags = 'Maximum 10 tags allowed';
  }

  return errors;
};

export const validateMonetization = (monetization: MonetizationSettings): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (monetization.type === 'pay-per-view' && monetization.price < 0.5) {
    errors.price = 'Minimum price is $0.50';
  }

  return errors;
};