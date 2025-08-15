/**
 * Bulk Upload Service
 * Handles resumable bulk uploads with Uppy + Tus integration
 */

export interface BulkUploadBatch {
  id: string;
  organizationId?: string;
  files: BulkUploadFile[];
  totalSize: number;
  uploadedSize: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'paused';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  settings: BulkUploadSettings;
}

export interface BulkUploadFile {
  id: string;
  batchId: string;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'paused';
  progress: number;
  uploadedBytes: number;
  uploadUrl?: string;
  tusId?: string;
  contentId?: string;
  error?: string;
  metadata?: FileMetadata;
}

export interface FileMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  ageRating?: '18+' | '21+';
  thumbnail?: string;
  duration?: number;
}

export interface BulkUploadSettings {
  storageClass: 'shreddable' | 'permanent';
  enableEncryption: boolean;
  enableWatermarking: boolean;
  autoPublish: boolean;
  defaultAgeRating: '18+' | '21+';
  defaultTags: string[];
  geoRestrictions: string[];
}

export interface SFTPWatchFolder {
  id: string;
  organizationId: string;
  folderPath: string;
  isActive: boolean;
  lastScan?: string;
  processedCount: number;
  errorCount: number;
  settings: BulkUploadSettings;
  createdAt: string;
}

export interface S3PullConfig {
  id: string;
  organizationId: string;
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  manifestPath: string;
  isActive: boolean;
  lastPull?: string;
  processedCount: number;
  errorCount: number;
  settings: BulkUploadSettings;
  createdAt: string;
}

export interface UploadProgress {
  batchId: string;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  currentFile?: string;
  estimatedTimeRemaining?: number;
  uploadSpeed?: number;
}

export class BulkUploadService {
  private static instance: BulkUploadService;
  private baseUrl: string;
  private uppyInstances: Map<string, any> = new Map();

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  public static getInstance(): BulkUploadService {
    if (!BulkUploadService.instance) {
      BulkUploadService.instance = new BulkUploadService();
    }
    return BulkUploadService.instance;
  }

  /**
   * Initialize bulk upload batch
   */
  async initializeBatch(files: File[], settings: BulkUploadSettings, organizationId?: string): Promise<BulkUploadBatch> {
    try {
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      
      const response = await fetch(`${this.baseUrl}/api/v1/upload/bulk/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileCount: files.length,
          totalSize,
          organizationId,
          settings
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize batch: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error initializing bulk upload batch:', error);
      throw new Error('Failed to initialize bulk upload');
    }
  }

  /**
   * Start resumable upload using Uppy + Tus
   */
  async startResumableUpload(
    batchId: string, 
    files: File[], 
    onProgress?: (progress: UploadProgress) => void,
    onFileComplete?: (fileId: string, response: any) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      // Dynamic import of Uppy to avoid SSR issues
      const { Uppy } = await import('@uppy/core');
      const { Tus } = await import('@uppy/tus');
      const { Dashboard } = await import('@uppy/dashboard');

      const uppy = new Uppy({
        id: batchId,
        autoProceed: false,
        allowMultipleUploads: true,
        restrictions: {
          maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
          allowedFileTypes: ['video/*'],
        },
      });

      // Configure Tus for resumable uploads
      uppy.use(Tus, {
        endpoint: `${this.baseUrl}/api/v1/upload/tus`,
        resume: true,
        autoRetry: true,
        retryDelays: [0, 1000, 3000, 5000],
        metadata: {
          batchId,
          filename: (file: any) => file.name,
          filetype: (file: any) => file.type,
        },
        onError: (error: Error) => {
          console.error('Tus upload error:', error);
          onError?.(error);
        },
        onProgress: (bytesUploaded: number, bytesTotal: number) => {
          if (onProgress) {
            this.calculateBatchProgress(batchId).then(onProgress);
          }
        },
        onSuccess: (file: any, response: any) => {
          onFileComplete?.(file.id, response);
        },
      });

      // Add files to Uppy
      files.forEach(file => {
        uppy.addFile({
          name: file.name,
          type: file.type,
          data: file,
          meta: {
            batchId,
          },
        });
      });

      // Store Uppy instance for later control
      this.uppyInstances.set(batchId, uppy);

      // Start upload
      await uppy.upload();
    } catch (error) {
      console.error('Error starting resumable upload:', error);
      throw new Error('Failed to start resumable upload');
    }
  }

  /**
   * Pause bulk upload
   */
  async pauseUpload(batchId: string): Promise<void> {
    const uppy = this.uppyInstances.get(batchId);
    if (uppy) {
      uppy.pauseAll();
      await this.updateBatchStatus(batchId, 'paused');
    }
  }

  /**
   * Resume bulk upload
   */
  async resumeUpload(batchId: string): Promise<void> {
    const uppy = this.uppyInstances.get(batchId);
    if (uppy) {
      uppy.resumeAll();
      await this.updateBatchStatus(batchId, 'uploading');
    }
  }

  /**
   * Cancel bulk upload
   */
  async cancelUpload(batchId: string): Promise<void> {
    const uppy = this.uppyInstances.get(batchId);
    if (uppy) {
      uppy.cancelAll();
      uppy.close();
      this.uppyInstances.delete(batchId);
      await this.updateBatchStatus(batchId, 'failed');
    }
  }

  /**
   * Get batch status
   */
  async getBatchStatus(batchId: string): Promise<BulkUploadBatch> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/upload/bulk/${batchId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to get batch status: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting batch status:', error);
      throw new Error('Failed to get batch status');
    }
  }

  /**
   * Calculate batch progress
   */
  async calculateBatchProgress(batchId: string): Promise<UploadProgress> {
    try {
      const batch = await this.getBatchStatus(batchId);
      
      const totalFiles = batch.files.length;
      const completedFiles = batch.files.filter(f => f.status === 'completed').length;
      const failedFiles = batch.files.filter(f => f.status === 'failed').length;
      const totalBytes = batch.totalSize;
      const uploadedBytes = batch.files.reduce((sum, f) => sum + f.uploadedBytes, 0);
      
      const currentFile = batch.files.find(f => f.status === 'uploading')?.name;
      
      // Calculate upload speed and ETA
      const uploadSpeed = this.calculateUploadSpeed(batchId, uploadedBytes);
      const remainingBytes = totalBytes - uploadedBytes;
      const estimatedTimeRemaining = uploadSpeed > 0 ? remainingBytes / uploadSpeed : undefined;

      return {
        batchId,
        totalFiles,
        completedFiles,
        failedFiles,
        totalBytes,
        uploadedBytes,
        currentFile,
        estimatedTimeRemaining,
        uploadSpeed,
      };
    } catch (error) {
      console.error('Error calculating batch progress:', error);
      throw new Error('Failed to calculate progress');
    }
  }

  /**
   * Finalize batch upload
   */
  async finalizeBatch(batchId: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/upload/bulk/${batchId}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to finalize batch: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Clean up Uppy instance
      const uppy = this.uppyInstances.get(batchId);
      if (uppy) {
        uppy.close();
        this.uppyInstances.delete(batchId);
      }

      return data.data.contentIds;
    } catch (error) {
      console.error('Error finalizing batch:', error);
      throw new Error('Failed to finalize batch upload');
    }
  }

  /**
   * Setup SFTP watch folder
   */
  async setupSFTPWatch(config: {
    organizationId: string;
    folderPath: string;
    settings: BulkUploadSettings;
  }): Promise<SFTPWatchFolder> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/upload/sftp/watch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to setup SFTP watch: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error setting up SFTP watch:', error);
      throw new Error('Failed to setup SFTP watch folder');
    }
  }

  /**
   * Setup S3/Wasabi pull
   */
  async setupS3Pull(config: {
    organizationId: string;
    bucketName: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    manifestPath: string;
    settings: BulkUploadSettings;
  }): Promise<S3PullConfig> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/upload/s3/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to setup S3 pull: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error setting up S3 pull:', error);
      throw new Error('Failed to setup S3 pull');
    }
  }

  /**
   * Validate files before upload
   */
  validateFiles(files: File[]): { valid: File[]; invalid: Array<{ file: File; reason: string }> } {
    const valid: File[] = [];
    const invalid: Array<{ file: File; reason: string }> = [];

    files.forEach(file => {
      // Check file type
      if (!file.type.startsWith('video/')) {
        invalid.push({ file, reason: 'Invalid file type. Only video files are allowed.' });
        return;
      }

      // Check file size (2GB limit)
      if (file.size > 2 * 1024 * 1024 * 1024) {
        invalid.push({ file, reason: 'File size exceeds 2GB limit.' });
        return;
      }

      // Check file name
      if (file.name.length > 255) {
        invalid.push({ file, reason: 'File name is too long (max 255 characters).' });
        return;
      }

      valid.push(file);
    });

    return { valid, invalid };
  }

  /**
   * Private helper methods
   */
  private async updateBatchStatus(batchId: string, status: BulkUploadBatch['status']): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/v1/upload/bulk/${batchId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error updating batch status:', error);
    }
  }

  private calculateUploadSpeed(batchId: string, currentBytes: number): number {
    // Simple implementation - in production, you'd want to track this over time
    const now = Date.now();
    const key = `speed_${batchId}`;
    
    const lastMeasurement = (this as any)[key];
    if (!lastMeasurement) {
      (this as any)[key] = { bytes: currentBytes, time: now };
      return 0;
    }

    const timeDiff = (now - lastMeasurement.time) / 1000; // seconds
    const bytesDiff = currentBytes - lastMeasurement.bytes;
    
    if (timeDiff > 0) {
      const speed = bytesDiff / timeDiff; // bytes per second
      (this as any)[key] = { bytes: currentBytes, time: now };
      return speed;
    }

    return 0;
  }

  /**
   * Get user-friendly file size
   */
  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get user-friendly time duration
   */
  formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}m`;
    } else {
      return `${Math.round(seconds / 3600)}h`;
    }
  }
}