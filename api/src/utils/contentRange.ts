import { logger } from './logger';

export interface ContentRangeInfo {
  start: number;
  end: number;
  total: number;
  isStatusProbe: boolean; // true for bytes */{total} or bytes */ probes
}

export interface ChunkValidationResult {
  valid: boolean;
  partNumber?: number;
  expectedSize?: number;
  error?: string;
}

/**
 * Parse Content-Range header with robust validation
 * 
 * Supports Google-style formats:
 * - bytes 0-1023/2048 (chunk upload)
 * - bytes */2048 (status probe with known total)
 * - bytes */ (status probe without total)
 */
export function parseContentRange(contentRange: string): ContentRangeInfo | null {
  if (!contentRange || typeof contentRange !== 'string') {
    return null;
  }

  const trimmed = contentRange.trim();
  
  // Must start with "bytes "
  if (!trimmed.startsWith('bytes ')) {
    return null;
  }

  const rangeSpec = trimmed.substring(6); // Remove "bytes "
  
  // Handle status probe formats: */ or */total
  if (rangeSpec.startsWith('*/')) {
    const totalPart = rangeSpec.substring(2);
    
    if (totalPart === '') {
      // bytes */ format (probe without total)
      return {
        start: 0,
        end: -1,
        total: -1,
        isStatusProbe: true,
      };
    }
    
    const total = parseInt(totalPart, 10);
    if (isNaN(total) || total < 0) {
      return null;
    }
    
    // bytes */total format (probe with total)
    return {
      start: 0,
      end: -1,
      total,
      isStatusProbe: true,
    };
  }
  
  // Handle chunk upload format: start-end/total
  const match = rangeSpec.match(/^(\d+)-(\d+)\/(\d+|\*)$/);
  if (!match) {
    return null;
  }
  
  const start = parseInt(match[1], 10);
  const end = parseInt(match[2], 10);
  const totalStr = match[3];
  
  // Validate start and end
  if (isNaN(start) || isNaN(end) || start < 0 || end < start) {
    return null;
  }
  
  // Parse total (can be * for unknown)
  let total = -1;
  if (totalStr !== '*') {
    total = parseInt(totalStr, 10);
    if (isNaN(total) || total < 0) {
      return null;
    }
    
    // Validate end is within total
    if (end >= total) {
      return null;
    }
  }
  
  return {
    start,
    end,
    total,
    isStatusProbe: false,
  };
}

/**
 * Validate chunk upload against session state
 * 
 * Uses Google 308 semantics - always respond with 308 for corrections,
 * only 416 for truly invalid ranges that cannot be interpreted.
 */
export function validateChunk(
  rangeInfo: ContentRangeInfo,
  sessionBytesReceived: number,
  sessionTotalBytes: number,
  sessionChunkSize: number,
  contentLength: number
): ChunkValidationResult {
  
  // Handle status probes
  if (rangeInfo.isStatusProbe) {
    return { valid: true };
  }
  
  const { start, end, total } = rangeInfo;
  
  // Validate total matches session (if provided)
  if (total !== -1 && total !== sessionTotalBytes) {
    return {
      valid: false,
      error: 'Total size mismatch with session',
    };
  }
  
  // Validate Content-Length matches range
  const rangeLength = end - start + 1;
  if (contentLength !== rangeLength) {
    return {
      valid: false,
      error: 'Content-Length does not match range size',
    };
  }
  
  // Handle out-of-sync chunks (client behind or ahead)
  if (start !== sessionBytesReceived) {
    return {
      valid: false,
      error: 'Chunk out of sync with current position',
    };
  }
  
  // Calculate expected chunk size
  const remainingBytes = sessionTotalBytes - sessionBytesReceived;
  const expectedSize = Math.min(sessionChunkSize, remainingBytes);
  
  // Validate chunk size (except for final chunk)
  if (rangeLength !== expectedSize) {
    return {
      valid: false,
      error: 'Invalid chunk size',
    };
  }
  
  // Calculate part number for multipart upload
  const partNumber = Math.floor(start / sessionChunkSize) + 1;
  
  // Validate part number is within S3 limits
  if (partNumber > 10000) {
    return {
      valid: false,
      error: 'Too many parts - file too large for current chunk size',
    };
  }
  
  return {
    valid: true,
    partNumber,
    expectedSize,
  };
}

/**
 * Generate Range header for 308 responses
 */
export function generateRangeHeader(bytesReceived: number): string | undefined {
  if (bytesReceived <= 0) {
    return undefined; // No range header if no bytes received
  }
  
  return `bytes=0-${bytesReceived - 1}`;
}

/**
 * Generate Upload-Offset header for 308 responses
 */
export function generateUploadOffsetHeader(bytesReceived: number): string {
  return bytesReceived.toString();
}

/**
 * Calculate dynamic chunk size to avoid S3's 10,000 part limit
 */
export function calculateOptimalChunkSize(totalBytes: number): number {
  const MIN_CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB
  const MAX_PARTS = 9000; // Stay under S3's 10k limit
  const FIVE_MIB = 5 * 1024 * 1024;
  
  // Calculate size needed to stay under part limit
  const calculatedSize = Math.ceil(totalBytes / MAX_PARTS);
  
  // Round up to nearest 5 MiB boundary (S3 requirement except last part)
  const roundedSize = Math.ceil(calculatedSize / FIVE_MIB) * FIVE_MIB;
  
  // Ensure minimum chunk size
  return Math.max(MIN_CHUNK_SIZE, roundedSize);
}

/**
 * Validate file size limits
 */
export function validateFileSize(size: number): { valid: boolean; error?: string } {
  const maxSize = parseInt(process.env.MAX_FILE_SIZE_BYTES || '21474836480', 10); // 20 GiB default
  
  if (size <= 0) {
    return { valid: false, error: 'File size must be greater than 0' };
  }
  
  if (size > maxSize) {
    return { 
      valid: false, 
      error: `File size exceeds maximum allowed size of ${Math.round(maxSize / (1024 * 1024 * 1024))} GB` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate MIME type for video uploads
 */
export function validateMimeType(mimeType: string): { valid: boolean; error?: string } {
  const allowedTypes = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/ogg',
    'video/3gpp',
    'video/x-flv',
    'video/x-ms-wmv',
  ];
  
  if (!mimeType || !allowedTypes.includes(mimeType.toLowerCase())) {
    return { 
      valid: false, 
      error: 'Unsupported file type. Please upload a video file.' 
    };
  }
  
  return { valid: true };
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) {
    return 'upload';
  }
  
  // Replace unsafe characters with underscores
  const sanitized = filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .slice(0, 255); // Limit length
  
  // Ensure it doesn't start/end with underscore or dot
  return sanitized.replace(/^[_.]+|[_.]+$/g, '') || 'upload';
}

/**
 * Log Content-Range parsing details for debugging
 */
export function logContentRangeInfo(
  contentRange: string,
  rangeInfo: ContentRangeInfo | null,
  sessionId: string
): void {
  logger.debug('Content-Range parsing', {
    sessionId,
    contentRange,
    parsed: rangeInfo,
    isStatusProbe: rangeInfo?.isStatusProbe || false,
  });
}