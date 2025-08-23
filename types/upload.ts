/**
 * Upload UI Types
 * 
 * Defines all TypeScript interfaces and types for the upload functionality
 */

// Upload status states following the design specification
export type UploadStatus = 
  | 'idle'
  | 'uploading' 
  | 'uploaded' 
  | 'processing' 
  | 'playable' 
  | 'hd_ready' 
  | 'failed' 
  | 'aborted';

// Supported video file types
export type SupportedVideoType = 'video/mp4' | 'video/quicktime' | 'video/x-matroska';

// Upload session information from backend
export interface UploadSessionClient {
  uploadId: string;
  sessionUrl: string;
  chunkSize: number; // Dynamic from backend
  totalBytes: number;
  lastByte: number;
  fileFingerprint: string; // ${name}:${size}:${lastModified}
  idempotencyKey: string; // UUID v4 for retry-safe init
  draftId?: string;
  createdAt: number;
}

// Upload progress information
export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
  chunkNumber: number;
  totalChunks: number;
}

// File information for uploads
export interface UploadFile {
  instance: File | null;
  preview: string | null;
  fingerprint: string | null;
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

// Draft metadata for content
export interface ContentMetadata {
  title: string; // Required, max 100 chars
  description: string; // Optional, max 5000 chars
  tags: string[]; // Max 10 tags
  category: string;
  visibility: 'private' | 'public' | 'unlisted'; // Default: private
  language: string;
}

// Monetization settings
export interface MonetizationSettings {
  type: 'public' | 'subscribers' | 'pay-per-view';
  price: number; // Minimum $0.50 for pay-per-view
  currency: 'USDC';
  tipJarEnabled: boolean;
  nsfwGated: boolean;
}

// Upload state for the store
export interface UploadState {
  // Session Management
  session: UploadSessionClient | null;
  
  // Upload Progress
  progress: UploadProgress;
  
  // File Information
  file: UploadFile;
  
  // Draft Metadata
  metadata: ContentMetadata;
  
  // Monetization Settings
  monetization: MonetizationSettings;
  
  // UI State
  ui: {
    currentStep: number; // 0-3 for 4-step process
    isPaused: boolean;
    showAdvanced: boolean;
    errors: string[];
    isUploading: boolean;
    canPublish: boolean;
  };
  
  // Backend status
  status: UploadStatus;
  
  // Content information after processing
  content: {
    cid?: string;
    playbackUrl?: string;
    thumbnailUrl?: string;
    errorCode?: string;
    firstPlayableReadyAt?: string;
    hdReadyAt?: string;
  };
}

// Actions for the upload store
export interface UploadActions {
  // File operations
  setFile: (file: File) => void;
  clearFile: () => void;
  
  // Session management
  setSession: (session: UploadSessionClient) => void;
  updateProgress: (progress: Partial<UploadProgress>) => void;
  
  // Metadata operations
  updateMetadata: (metadata: Partial<ContentMetadata>) => void;
  updateMonetization: (monetization: Partial<MonetizationSettings>) => void;
  
  // UI operations
  setCurrentStep: (step: number) => void;
  addError: (error: string) => void;
  clearErrors: () => void;
  setUploading: (uploading: boolean) => void;
  setPaused: (paused: boolean) => void;
  
  // Status operations
  setStatus: (status: UploadStatus) => void;
  updateContent: (content: Partial<UploadState['content']>) => void;
  
  // Reset operations
  reset: () => void;
}

// Combined store type
export type UploadStore = UploadState & UploadActions;

// Upload API response types
export interface UploadInitResponse {
  uploadId: string;
  sessionUrl: string;
  chunkSize: number;
  draftId: string;
}

export interface UploadStatusResponse {
  status: UploadStatus;
  bytesReceived: number;
  totalBytes: number;
  chunkSize: number;
  progress: number;
  cid?: string;
  playbackUrl?: string;
  errorCode?: string;
  firstPlayableReadyAt?: string;
  hdReadyAt?: string;
}

export interface UploadResult {
  uploadId: string;
  storageKey: string;
  size: number;
  draftId?: string;
}

// Error types
export interface UploadError {
  code: string;
  message: string;
  details?: any;
}

// Configuration
export interface UploadConfig {
  maxFileSize: number; // bytes
  supportedTypes: SupportedVideoType[];
  chunkRetryAttempts: number;
  statusPollInterval: number; // milliseconds
  apiBaseUrl: string;
}

// Component prop types
export interface DropzoneProps {
  onFileSelect: (file: File) => void;
  accept: string;
  maxSize: number;
  disabled?: boolean;
  error?: string;
}

export interface ProgressBarProps {
  progress: number;
  isIndeterminate?: boolean;
  speed?: number;
  eta?: number;
  className?: string;
}

export interface StatusPillProps {
  status: UploadStatus;
  className?: string;
}

export interface StepperProps {
  currentStep: number;
  steps: Array<{
    id: string;
    label: string;
    completed: boolean;
  }>;
  onStepClick?: (step: number) => void;
}

export interface MetadataFormProps {
  value: ContentMetadata;
  onChange: (metadata: Partial<ContentMetadata>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export interface MonetizationFormProps {
  value: MonetizationSettings;
  onChange: (monetization: Partial<MonetizationSettings>) => void;
  disabled?: boolean;
}

export interface PublishBarProps {
  canPublish: boolean;
  status: UploadStatus;
  onSaveDraft: () => void;
  onPublish: () => void;
  onPreview?: () => void;
  disabledReason?: string;
}

// Constants
export const DEFAULT_METADATA: ContentMetadata = {
  title: '',
  description: '',
  tags: [],
  category: '',
  visibility: 'private',
  language: 'en'
};

export const DEFAULT_MONETIZATION: MonetizationSettings = {
  type: 'public',
  price: 0.5,
  currency: 'USDC',
  tipJarEnabled: false,
  nsfwGated: false
};

export const UPLOAD_STEPS = [
  { id: 'upload', label: 'Upload', description: 'Select and upload your video' },
  { id: 'details', label: 'Details', description: 'Add title, description, and tags' },
  { id: 'monetize', label: 'Monetize & Distribute', description: 'Set pricing and visibility' },
  { id: 'publish', label: 'Publish', description: 'Review and publish your content' }
];

export const STATUS_COLORS: Record<UploadStatus, string> = {
  idle: 'gray-500',
  uploading: 'blue-500',
  uploaded: 'blue-600',
  processing: 'amber-500',
  playable: 'green-500',
  hd_ready: 'emerald-500',
  failed: 'rose-500',
  aborted: 'gray-400'
};

export const ERROR_MESSAGES: Record<string, string> = {
  'FILE_TOO_LARGE': 'File exceeds 20 GB limit. Please compress or split your video.',
  'INVALID_TYPE': 'Unsupported file type. Please use MP4, MOV, or MKV format.',
  'NETWORK_ERROR': 'Connection lost. We\'ll keep trying... you can close the tab and resume anytime.',
  'STORAGE_QUOTA': 'Upload limit reached. Upgrade for unlimited uploads or contact support.',
  'SERVER_ERROR': 'Something went wrong on our end. Your progress is saved - try again in a moment.',
  'FILE_MISMATCH': 'This file looks different. Resume with the original file or start a new upload.',
  'UPLOAD_FAILED': 'Upload failed. Please try again.',
  'PROCESSING_FAILED': 'Video processing failed. Please try uploading again.'
};