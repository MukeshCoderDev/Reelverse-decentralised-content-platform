import crypto from 'crypto';
import { logger } from './logger';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  metadata?: {
    duration?: number;
    resolution?: string;
    bitrate?: number;
    codec?: string;
  };
}

export class FileUtils {
  /**
   * Validate video file
   */
  static validateVideoFile(file: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    size: number;
  }): FileValidationResult {
    try {
      // Check file size (max 5GB)
      const maxSize = 5 * 1024 * 1024 * 1024;
      if (file.size > maxSize) {
        return {
          isValid: false,
          error: 'File size exceeds maximum limit of 5GB'
        };
      }

      // Check minimum file size (1MB)
      const minSize = 1024 * 1024;
      if (file.size < minSize) {
        return {
          isValid: false,
          error: 'File size is too small (minimum 1MB)'
        };
      }

      // Check MIME type
      const allowedMimeTypes = [
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo',
        'video/webm',
        'video/x-flv',
        'video/3gpp',
        'video/x-ms-wmv'
      ];

      if (!allowedMimeTypes.includes(file.mimeType)) {
        return {
          isValid: false,
          error: `Unsupported video format: ${file.mimeType}`
        };
      }

      // Check file extension
      const allowedExtensions = ['.mp4', '.mpeg', '.mpg', '.mov', '.avi', '.webm', '.flv', '.3gp', '.wmv'];
      const fileExtension = file.originalName.toLowerCase().substring(file.originalName.lastIndexOf('.'));
      
      if (!allowedExtensions.includes(fileExtension)) {
        return {
          isValid: false,
          error: `Unsupported file extension: ${fileExtension}`
        };
      }

      // Basic file header validation
      const isValidHeader = this.validateVideoHeader(file.buffer, file.mimeType);
      if (!isValidHeader) {
        return {
          isValid: false,
          error: 'Invalid video file format or corrupted file'
        };
      }

      return {
        isValid: true,
        metadata: {
          // These would be extracted using a proper video analysis library
          // For now, return placeholder values
          duration: 0,
          resolution: 'unknown',
          bitrate: 0,
          codec: 'unknown'
        }
      };

    } catch (error) {
      logger.error('Error validating video file:', error);
      return {
        isValid: false,
        error: 'File validation failed'
      };
    }
  }

  /**
   * Validate video file header
   */
  private static validateVideoHeader(buffer: Buffer, mimeType: string): boolean {
    try {
      if (buffer.length < 12) {
        return false;
      }

      // Check for common video file signatures
      const header = buffer.subarray(0, 12);
      
      switch (mimeType) {
        case 'video/mp4':
          // MP4 files typically start with ftyp box
          return header.includes(Buffer.from('ftyp')) || 
                 header.subarray(4, 8).toString() === 'ftyp';
        
        case 'video/webm':
          // WebM files start with EBML header
          return header.subarray(0, 4).toString('hex') === '1a45dfa3';
        
        case 'video/x-msvideo':
          // AVI files start with RIFF header
          return header.subarray(0, 4).toString() === 'RIFF' &&
                 header.subarray(8, 12).toString() === 'AVI ';
        
        case 'video/quicktime':
          // MOV files have various signatures
          return header.includes(Buffer.from('moov')) ||
                 header.includes(Buffer.from('mdat')) ||
                 header.includes(Buffer.from('ftyp'));
        
        default:
          // For other formats, do basic checks
          return buffer.length > 0;
      }
    } catch (error) {
      logger.error('Error validating video header:', error);
      return false;
    }
  }

  /**
   * Generate file hash
   */
  static generateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Generate secure filename
   */
  static generateSecureFilename(originalName: string, uploadId: string): string {
    const extension = originalName.substring(originalName.lastIndexOf('.'));
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    
    return `${uploadId}_${timestamp}_${random}${extension}`;
  }

  /**
   * Sanitize filename
   */
  static sanitizeFilename(filename: string): string {
    // Remove or replace dangerous characters
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255);
  }

  /**
   * Get file extension
   */
  static getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot) : '';
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    
    return `${size.toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Estimate upload time based on file size and connection speed
   */
  static estimateUploadTime(fileSize: number, connectionSpeedMbps: number = 10): number {
    // Convert Mbps to bytes per second
    const bytesPerSecond = (connectionSpeedMbps * 1024 * 1024) / 8;
    
    // Add 20% overhead for processing
    const estimatedSeconds = (fileSize / bytesPerSecond) * 1.2;
    
    return Math.ceil(estimatedSeconds);
  }

  /**
   * Check if file is likely to be a valid video based on size and type
   */
  static isLikelyValidVideo(file: {
    size: number;
    mimeType: string;
    originalName: string;
  }): boolean {
    // Basic heuristics for video file validation
    const minVideoSize = 1024 * 1024; // 1MB minimum
    const maxVideoSize = 5 * 1024 * 1024 * 1024; // 5GB maximum
    
    if (file.size < minVideoSize || file.size > maxVideoSize) {
      return false;
    }

    if (!file.mimeType.startsWith('video/')) {
      return false;
    }

    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
    const extension = this.getFileExtension(file.originalName.toLowerCase());
    
    return videoExtensions.includes(extension);
  }
}

export default FileUtils;