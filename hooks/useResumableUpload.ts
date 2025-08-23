/**
 * useResumableUpload Hook
 * 
 * Custom hook for managing resumable upload logic with pause/resume/abort functionality
 */

import { useRef, useCallback, useEffect } from 'react';
import { useUploadStore } from '../store/uploadStore';
import { 
  ResumableUploadClient, 
  UploadMetadata, 
  UploadOptions,
  UploadResult,
  generateIdempotencyKey
} from '../lib/uploadResumable';
import { UploadSessionClient, UploadProgress, UploadStatus } from '../types/upload';

// Configuration constants
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 * 1024; // 20 GB
const SUPPORTED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-matroska'];
const STATUS_POLL_INTERVAL = 5000; // 5 seconds
const API_BASE_URL = '/api/v1';

interface UseResumableUploadOptions {
  onUploadComplete?: (result: UploadResult) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: UploadStatus) => void;
}

export const useResumableUpload = (options: UseResumableUploadOptions = {}) => {
  const { state, actions } = useUploadStore();
  const uploadClientRef = useRef<ResumableUploadClient | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const statusPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize upload client
  useEffect(() => {
    uploadClientRef.current = new ResumableUploadClient({
      apiBaseUrl: API_BASE_URL,
      retryAttempts: 3,
      retryDelayMs: 1000
    });
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
      }
    };
  }, []);

  // Generate file fingerprint
  const generateFileFingerprint = useCallback((file: File): string => {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }, []);

  // Validate file
  const validateFile = useCallback((file: File): string | null => {
    if (!SUPPORTED_TYPES.includes(file.type)) {
      return 'Unsupported file type. Please use MP4, MOV, or MKV format.';
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return 'File exceeds 20 GB limit. Please compress or split your video.';
    }

    return null;
  }, []);

  // Start status polling
  const startStatusPolling = useCallback((uploadId: string) => {
    if (statusPollIntervalRef.current) {
      clearInterval(statusPollIntervalRef.current);
    }

    statusPollIntervalRef.current = setInterval(async () => {
      try {
        if (!uploadClientRef.current) return;

        const status = await uploadClientRef.current.getUploadStatus(uploadId);
        
        actions.setStatus(status.status);
        actions.updateContent({
          cid: status.cid,
          playbackUrl: status.playbackUrl,
          errorCode: status.errorCode,
          firstPlayableReadyAt: status.firstPlayableReadyAt,
          hdReadyAt: status.hdReadyAt
        });

        // Stop polling if upload is complete or failed
        if (['playable', 'hd_ready', 'failed', 'aborted'].includes(status.status)) {
          if (statusPollIntervalRef.current) {
            clearInterval(statusPollIntervalRef.current);
            statusPollIntervalRef.current = null;
          }
        }

        options.onStatusChange?.(status.status);
      } catch (error) {
        console.error('Failed to poll upload status:', error);
      }
    }, STATUS_POLL_INTERVAL);
  }, [actions, options]);

  // Stop status polling
  const stopStatusPolling = useCallback(() => {
    if (statusPollIntervalRef.current) {
      clearInterval(statusPollIntervalRef.current);
      statusPollIntervalRef.current = null;
    }
  }, []);

  // Select file for upload
  const selectFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      actions.addError(validationError);
      return;
    }

    actions.clearErrors();
    actions.setFile(file);
    
    // Auto-generate title from filename if empty
    if (!state.metadata.title.trim()) {
      const title = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      actions.updateMetadata({ title });
    }
  }, [actions, state.metadata.title, validateFile]);

  // Start upload
  const startUpload = useCallback(async () => {
    if (!state.file.instance || !uploadClientRef.current) {
      actions.addError('No file selected');
      return;
    }

    try {
      actions.clearErrors();
      actions.setUploading(true);
      actions.setStatus('uploading');

      // Create abort controller for this upload
      abortControllerRef.current = new AbortController();

      const file = state.file.instance;
      const idempotencyKey = generateIdempotencyKey(file);

      // Prepare metadata
      const metadata: UploadMetadata = {
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        title: state.metadata.title,
        description: state.metadata.description,
        tags: state.metadata.tags,
        visibility: state.metadata.visibility,
        category: state.metadata.category
      };

      // Upload options
      const uploadOptions: UploadOptions = {
        idempotencyKey,
        onProgress: (progress: UploadProgress) => {
          actions.updateProgress(progress);
        },
        onStatusChange: (status: string) => {
          actions.setStatus(status as UploadStatus);
        },
        onError: (error: Error) => {
          actions.addError(error.message);
          actions.setUploading(false);
          options.onError?.(error);
        }
      };

      // Start upload
      const result = await uploadClientRef.current.uploadFile(file, metadata, uploadOptions);

      // Create session object
      const session: UploadSessionClient = {
        uploadId: result.uploadId,
        sessionUrl: '', // Will be set by the client
        chunkSize: 0, // Will be set by the client
        totalBytes: file.size,
        lastByte: file.size, // Upload complete
        fileFingerprint: generateFileFingerprint(file),
        idempotencyKey,
        draftId: result.draftId,
        createdAt: Date.now()
      };

      actions.setSession(session);
      actions.setStatus('uploaded');
      actions.setUploading(false);

      // Start polling for processing status
      startStatusPolling(result.uploadId);

      options.onUploadComplete?.(result);
    } catch (error) {
      console.error('Upload failed:', error);
      actions.addError((error as Error).message);
      actions.setUploading(false);
      actions.setStatus('failed');
      options.onError?.(error as Error);
    }
  }, [state.file.instance, state.metadata, actions, generateFileFingerprint, startStatusPolling, options]);

  // Pause upload
  const pauseUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    actions.setPaused(true);
    actions.setUploading(false);
  }, [actions]);

  // Resume upload
  const resumeUpload = useCallback(async () => {
    if (!state.file.instance || !state.session) {
      actions.addError('Cannot resume: no file or session found');
      return;
    }

    // Check if file matches the original
    const currentFingerprint = generateFileFingerprint(state.file.instance);
    if (currentFingerprint !== state.session.fileFingerprint) {
      actions.addError('File mismatch. Please select the original file to resume.');
      return;
    }

    actions.setPaused(false);
    actions.clearErrors();
    
    // Restart the upload process
    await startUpload();
  }, [state.file.instance, state.session, actions, generateFileFingerprint, startUpload]);

  // Abort upload
  const abortUpload = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    stopStatusPolling();

    if (state.session?.uploadId && uploadClientRef.current) {
      try {
        await uploadClientRef.current.abortUpload(state.session.uploadId);
      } catch (error) {
        console.error('Failed to abort upload:', error);
      }
    }

    actions.setStatus('aborted');
    actions.setUploading(false);
    actions.setPaused(false);
  }, [state.session, actions, stopStatusPolling]);

  // Save draft metadata
  const saveDraft = useCallback(async () => {
    if (!state.session?.uploadId || !uploadClientRef.current) {
      actions.addError('Cannot save draft: no upload session');
      return;
    }

    try {
      await uploadClientRef.current.updateDraft(state.session.uploadId, {
        title: state.metadata.title,
        description: state.metadata.description,
        tags: state.metadata.tags,
        visibility: state.metadata.visibility,
        category: state.metadata.category
      });
    } catch (error) {
      console.error('Failed to save draft:', error);
      actions.addError('Failed to save draft');
    }
  }, [state.session, state.metadata, actions]);

  // Publish content
  const publishContent = useCallback(async () => {
    if (!state.session?.uploadId) {
      actions.addError('Cannot publish: no upload session');
      return;
    }

    try {
      // Save final metadata
      await saveDraft();

      // Make publish API call
      const response = await fetch(`${API_BASE_URL}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uploadId: state.session.uploadId,
          draftId: state.session.draftId,
          monetization: state.monetization,
          visibility: state.metadata.visibility
        })
      });

      if (!response.ok) {
        throw new Error('Failed to publish content');
      }

      // Reset upload state after successful publish
      actions.reset();
    } catch (error) {
      console.error('Failed to publish content:', error);
      actions.addError('Failed to publish content');
    }
  }, [state.session, state.metadata, state.monetization, actions, saveDraft]);

  // Preview content
  const previewContent = useCallback(() => {
    if (state.content.playbackUrl) {
      // Open preview modal or navigate to preview page
      window.open(state.content.playbackUrl, '_blank');
    }
  }, [state.content.playbackUrl]);

  // Reset upload
  const resetUpload = useCallback(() => {
    abortUpload();
    actions.reset();
  }, [abortUpload, actions]);

  return {
    // State
    file: state.file,
    session: state.session,
    progress: state.progress,
    status: state.status,
    errors: state.ui.errors,
    isUploading: state.ui.isUploading,
    isPaused: state.ui.isPaused,
    canPublish: state.ui.canPublish,
    content: state.content,

    // Actions
    selectFile,
    startUpload,
    pauseUpload,
    resumeUpload,
    abortUpload,
    saveDraft,
    publishContent,
    previewContent,
    resetUpload,

    // Validation
    validateFile,

    // Utils
    generateFileFingerprint
  };
};