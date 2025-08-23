/**
 * YouTube/Google-Style Resumable Upload Client
 * 
 * Handles large file uploads with resumability across network interruptions,
 * using localStorage persistence and exponential backoff retry strategy.
 */

export interface UploadMetadata {
  filename: string;
  size: number;
  mimeType: string;
  title?: string;
  description?: string;
  tags?: string[];
  visibility?: 'public' | 'private' | 'unlisted';
  category?: string;
}

export interface UploadSession {
  uploadId: string;
  sessionUrl: string;
  chunkSize: number;
  totalBytes: number;
  draftId?: string;
}

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  chunkNumber: number;
  totalChunks: number;
  speed?: number; // bytes per second
  estimatedTimeRemaining?: number; // seconds
}

export interface UploadStatus {
  status: 'uploading' | 'uploaded' | 'processing' | 'playable' | 'hd_ready' | 'failed' | 'aborted';
  bytesReceived: number;
  totalBytes: number;
  progress: number;
  cid?: string;
  playbackUrl?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: Error) => void;
  retryAttempts?: number;
  retryDelayMs?: number;
  apiBaseUrl?: string;
  authToken?: string;
  idempotencyKey?: string;
}

export interface UploadResult {
  uploadId: string;
  storageKey: string;
  size: number;
  draftId?: string;
}

interface StoredSession {
  uploadId: string;
  sessionUrl: string;
  chunkSize: number;
  totalBytes: number;
  lastByte: number;
  draftId?: string;
  createdAt: number;
  file: {
    name: string;
    size: number;
    type: string;
    lastModified: number;
  };
}

/**
 * Resumable Upload Client
 */
export class ResumableUploadClient {
  private apiBaseUrl: string;
  private authToken?: string;
  private storageKey: string;

  constructor(options: UploadOptions = {}) {
    this.apiBaseUrl = options.apiBaseUrl || '/api/v1';
    this.authToken = options.authToken;
    this.storageKey = 'rv.upload.sessions';
  }

  /**
   * Upload a file with resumability
   */
  async uploadFile(
    file: File,
    metadata: UploadMetadata,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const uploadOptions = { ...options };
    const retryAttempts = uploadOptions.retryAttempts || 3;
    const retryDelayMs = uploadOptions.retryDelayMs || 1000;

    // Check for existing session
    let session = this.findExistingSession(file);
    let lastByte = 0;

    try {
      if (session) {
        // Resume existing upload
        uploadOptions.onStatusChange?.('resuming');
        console.log('Resuming upload from byte', session.lastByte);
        
        // Probe current offset
        const probeResult = await this.probeUploadOffset(session.sessionUrl);
        lastByte = probeResult.nextOffset;
        
        // Update stored session
        session.lastByte = lastByte;
        this.saveSession(session);
      } else {
        // Create new upload session
        uploadOptions.onStatusChange?.('initializing');
        session = await this.createUploadSession(file, metadata, uploadOptions.idempotencyKey);
        this.saveSession(session);
      }

      // Upload file in chunks
      uploadOptions.onStatusChange?.('uploading');
      const result = await this.uploadChunks(file, session, lastByte, uploadOptions);

      // Clean up stored session on success
      this.removeSession(session.uploadId);
      
      uploadOptions.onStatusChange?.('completed');
      return result;

    } catch (error) {
      uploadOptions.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Get upload status
   */
  async getUploadStatus(uploadId: string): Promise<UploadStatus> {
    const response = await this.makeRequest(`${this.apiBaseUrl}/resumable-uploads/${uploadId}/status`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to get upload status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update content draft metadata
   */
  async updateDraft(uploadId: string, metadata: Partial<UploadMetadata>): Promise<void> {
    const response = await this.makeRequest(`${this.apiBaseUrl}/resumable-uploads/${uploadId}/draft`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      throw new Error(`Failed to update draft: ${response.statusText}`);
    }
  }

  /**
   * Abort upload
   */
  async abortUpload(uploadId: string): Promise<void> {
    const response = await this.makeRequest(`${this.apiBaseUrl}/resumable-uploads/${uploadId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to abort upload: ${response.statusText}`);
    }

    // Remove from localStorage
    this.removeSession(uploadId);
  }

  /**
   * List stored sessions for debugging
   */
  getStoredSessions(): StoredSession[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  /**
   * Clear all stored sessions
   */
  clearStoredSessions(): void {
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Create new upload session
   */
  private async createUploadSession(
    file: File,
    metadata: UploadMetadata,
    idempotencyKey?: string
  ): Promise<UploadSession> {
    const requestBody = {
      filename: metadata.filename || file.name,
      size: file.size,
      mimeType: metadata.mimeType || file.type,
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      visibility: metadata.visibility,
      category: metadata.category,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const response = await this.makeRequest(`${this.apiBaseUrl}/resumable-uploads?uploadType=resumable`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Failed to create upload session: ${error.error || response.statusText}`);
    }

    const result = await response.json();
    return {
      uploadId: result.uploadId,
      sessionUrl: result.sessionUrl,
      chunkSize: result.chunkSize,
      totalBytes: file.size,
      draftId: result.draftId,
    };
  }

  /**
   * Probe upload offset
   */
  private async probeUploadOffset(sessionUrl: string): Promise<{ nextOffset: number; range?: string }> {
    const response = await this.makeRequest(sessionUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': 'bytes */*',
        'Content-Length': '0',
      },
    });

    if (response.status === 308) {
      const uploadOffset = response.headers.get('Upload-Offset');
      const range = response.headers.get('Range');
      
      return {
        nextOffset: uploadOffset ? parseInt(uploadOffset, 10) : 0,
        range: range || undefined,
      };
    } else if (response.status === 201) {
      // Upload already completed
      throw new Error('Upload already completed');
    } else {
      throw new Error(`Unexpected response status: ${response.status}`);
    }
  }

  /**
   * Upload file in chunks
   */
  private async uploadChunks(
    file: File,
    session: UploadSession,
    startByte: number,
    options: UploadOptions
  ): Promise<UploadResult> {
    const { chunkSize, totalBytes } = session;
    let currentByte = startByte;
    const totalChunks = Math.ceil(totalBytes / chunkSize);
    
    const startTime = Date.now();
    let lastProgressTime = startTime;
    let lastProgressBytes = startByte;

    while (currentByte < totalBytes) {
      const chunkStart = currentByte;
      const chunkEnd = Math.min(currentByte + chunkSize - 1, totalBytes - 1);
      const chunkNumber = Math.floor(chunkStart / chunkSize) + 1;
      
      // Create chunk blob
      const chunk = file.slice(chunkStart, chunkEnd + 1);
      
      // Upload chunk with retries
      await this.uploadChunkWithRetry(session.sessionUrl, chunk, chunkStart, chunkEnd, totalBytes, options);
      
      currentByte = chunkEnd + 1;
      
      // Update progress
      const now = Date.now();
      const timeDelta = (now - lastProgressTime) / 1000;
      const bytesDelta = currentByte - lastProgressBytes;
      const speed = timeDelta > 0 ? bytesDelta / timeDelta : 0;
      const remainingBytes = totalBytes - currentByte;
      const estimatedTimeRemaining = speed > 0 ? remainingBytes / speed : undefined;

      const progress: UploadProgress = {
        bytesUploaded: currentByte,
        totalBytes,
        percentage: (currentByte / totalBytes) * 100,
        chunkNumber,
        totalChunks,
        speed,
        estimatedTimeRemaining,
      };

      options.onProgress?.(progress);
      
      // Update stored session
      const storedSession = this.findExistingSession(file);
      if (storedSession) {
        storedSession.lastByte = currentByte;
        this.saveSession(storedSession);
      }

      lastProgressTime = now;
      lastProgressBytes = currentByte;
    }

    // Upload completed
    return {
      uploadId: session.uploadId,
      storageKey: `uploads/${session.uploadId}`, // Approximate storage key
      size: totalBytes,
      draftId: session.draftId,
    };
  }

  /**
   * Upload single chunk with retry logic
   */
  private async uploadChunkWithRetry(
    sessionUrl: string,
    chunk: Blob,
    start: number,
    end: number,
    total: number,
    options: UploadOptions,
    attempt: number = 1
  ): Promise<void> {
    const retryAttempts = options.retryAttempts || 3;
    const retryDelayMs = options.retryDelayMs || 1000;

    try {
      const response = await this.makeRequest(sessionUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Content-Length': chunk.size.toString(),
        },
        body: chunk,
      });

      if (response.status === 308) {
        // Chunk accepted, continue
        return;
      } else if (response.status === 201) {
        // Upload completed
        return;
      } else if (response.status >= 400) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`Upload failed: ${error.error || response.statusText}`);
      }
    } catch (error) {
      if (attempt <= retryAttempts) {
        console.warn(`Chunk upload failed (attempt ${attempt}/${retryAttempts}), retrying...`, error);
        
        // Exponential backoff
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.uploadChunkWithRetry(sessionUrl, chunk, start, end, total, options, attempt + 1);
      } else {
        throw error;
      }
    }
  }

  /**
   * Make authenticated request
   */
  private async makeRequest(url: string, options: RequestInit): Promise<Response> {
    const headers = new Headers(options.headers);
    
    if (this.authToken) {
      headers.set('Authorization', `Bearer ${this.authToken}`);
    }

    return fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * Find existing session for file
   */
  private findExistingSession(file: File): StoredSession | null {
    try {
      const sessions = this.getStoredSessions();
      
      return sessions.find(session => 
        session.file.name === file.name &&
        session.file.size === file.size &&
        session.file.type === file.type &&
        session.file.lastModified === file.lastModified
      ) || null;
    } catch {
      return null;
    }
  }

  /**
   * Save session to localStorage
   */
  private saveSession(session: StoredSession | UploadSession): void {
    try {
      const sessions = this.getStoredSessions();
      const existingIndex = sessions.findIndex(s => s.uploadId === session.uploadId);
      
      const storedSession: StoredSession = 'lastByte' in session ? session : {
        ...session,
        lastByte: 0,
        createdAt: Date.now(),
        file: {
          name: '',
          size: session.totalBytes,
          type: '',
          lastModified: 0,
        },
      };

      if (existingIndex >= 0) {
        sessions[existingIndex] = storedSession;
      } else {
        sessions.push(storedSession);
      }

      // Keep only recent sessions (last 24 hours)
      const cutoff = Date.now() - (24 * 60 * 60 * 1000);
      const recentSessions = sessions.filter(s => s.createdAt > cutoff);

      localStorage.setItem(this.storageKey, JSON.stringify(recentSessions));
    } catch (error) {
      console.warn('Failed to save upload session to localStorage:', error);
    }
  }

  /**
   * Remove session from localStorage
   */
  private removeSession(uploadId: string): void {
    try {
      const sessions = this.getStoredSessions();
      const filteredSessions = sessions.filter(s => s.uploadId !== uploadId);
      localStorage.setItem(this.storageKey, JSON.stringify(filteredSessions));
    } catch (error) {
      console.warn('Failed to remove upload session from localStorage:', error);
    }
  }
}

/**
 * Convenience function for simple uploads
 */
export async function uploadResumable(
  file: File,
  metadata: UploadMetadata,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const client = new ResumableUploadClient(options);
  return client.uploadFile(file, metadata, options);
}

/**
 * Generate idempotency key for uploads
 */
export function generateIdempotencyKey(file: File, userId?: string): string {
  const data = `${file.name}-${file.size}-${file.lastModified}-${userId || 'anonymous'}`;
  
  // Simple hash function (for production, use crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `upload-${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`;
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}