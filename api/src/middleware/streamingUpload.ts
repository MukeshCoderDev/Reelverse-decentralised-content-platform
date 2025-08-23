import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface StreamingUploadRequest extends Request {
  isStreamingUpload?: boolean;
  rawBody?: Buffer;
  contentLength?: number;
}

/**
 * Streaming Upload Middleware
 * 
 * Configures Express to handle raw binary data for resumable uploads
 * without buffering the entire chunk in memory. This is critical for
 * large file uploads to prevent memory exhaustion.
 */

/**
 * Skip body parsing for streaming upload routes
 * This prevents Express from buffering the entire request body
 */
export function skipBodyParser(req: StreamingUploadRequest, res: Response, next: NextFunction): void {
  // Mark request as streaming upload
  req.isStreamingUpload = true;
  
  // Get Content-Length header
  const contentLength = req.headers['content-length'];
  if (contentLength) {
    req.contentLength = parseInt(contentLength, 10);
  }
  
  logger.debug('Configured streaming upload request', {
    method: req.method,
    url: req.url,
    contentLength: req.contentLength,
    contentType: req.headers['content-type'],
    contentRange: req.headers['content-range'],
  });
  
  next();
}

/**
 * Collect raw body for small requests (like status probes)
 * Only for requests with Content-Length < 1KB
 */
export function collectSmallBody(req: StreamingUploadRequest, res: Response, next: NextFunction): void {
  if (!req.isStreamingUpload) {
    return next();
  }
  
  const contentLength = req.contentLength || 0;
  
  // Only collect body for small requests (status probes)
  if (contentLength > 0 && contentLength < 1024) {
    const chunks: Buffer[] = [];
    
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    req.on('end', () => {
      req.rawBody = Buffer.concat(chunks);
      logger.debug('Collected small body for upload request', {
        contentLength,
        actualLength: req.rawBody.length,
      });
      next();
    });
    
    req.on('error', (error) => {
      logger.error('Error collecting request body', { error: error.message });
      res.status(400).json({ error: 'Invalid request body' });
    });
  } else {
    // For larger requests, pass through without collecting body
    next();
  }
}

/**
 * Validate streaming upload headers
 */
export function validateUploadHeaders(req: StreamingUploadRequest, res: Response, next: NextFunction): void {
  if (!req.isStreamingUpload) {
    return next();
  }
  
  const contentRange = req.headers['content-range'] as string;
  const contentType = req.headers['content-type'] as string;
  const contentLength = req.contentLength;
  
  // For chunk uploads, require specific headers
  if (req.method === 'PUT' && contentLength && contentLength > 0) {
    // Must have Content-Range for chunk uploads
    if (!contentRange) {
      logger.warn('Missing Content-Range header for chunk upload', {
        method: req.method,
        contentLength,
        url: req.url,
      });
      return res.status(400).json({
        error: 'Content-Range header required for chunk uploads',
      });
    }
    
    // Must be application/octet-stream for chunk data
    if (contentType && contentType !== 'application/octet-stream') {
      logger.warn('Invalid Content-Type for chunk upload', {
        contentType,
        expected: 'application/octet-stream',
      });
      return res.status(400).json({
        error: 'Content-Type must be application/octet-stream for chunk uploads',
      });
    }
  }
  
  // Validate Content-Length is present and reasonable
  if (contentLength === undefined || contentLength < 0) {
    logger.warn('Invalid or missing Content-Length', {
      contentLength,
      method: req.method,
    });
    return res.status(400).json({
      error: 'Valid Content-Length header required',
    });
  }
  
  // Validate Content-Length doesn't exceed maximum chunk size
  const maxChunkSize = parseInt(process.env.MAX_CHUNK_SIZE_BYTES || '134217728', 10); // 128 MB default
  if (contentLength > maxChunkSize) {
    logger.warn('Content-Length exceeds maximum chunk size', {
      contentLength,
      maxChunkSize,
    });
    return res.status(413).json({
      error: `Chunk size exceeds maximum allowed size of ${Math.round(maxChunkSize / (1024 * 1024))} MB`,
    });
  }
  
  next();
}

/**
 * Set up request timeout for uploads
 */
export function setupUploadTimeout(timeoutMs: number = 300000) { // 5 minutes default
  return (req: StreamingUploadRequest, res: Response, next: NextFunction): void => {
    if (!req.isStreamingUpload) {
      return next();
    }
    
    // Set longer timeout for upload requests
    req.setTimeout(timeoutMs, () => {
      logger.warn('Upload request timeout', {
        method: req.method,
        url: req.url,
        contentLength: req.contentLength,
        timeout: timeoutMs,
      });
      
      if (!res.headersSent) {
        res.status(408).json({ error: 'Upload timeout' });
      }
    });
    
    next();
  };
}

/**
 * Log upload request details for monitoring
 */
export function logUploadRequest(req: StreamingUploadRequest, res: Response, next: NextFunction): void {
  if (!req.isStreamingUpload) {
    return next();
  }
  
  const startTime = Date.now();
  const sessionId = req.params.id || 'unknown';
  
  logger.info('Upload request started', {
    sessionId,
    method: req.method,
    contentLength: req.contentLength,
    contentRange: req.headers['content-range'],
    userAgent: req.headers['user-agent'],
    clientIp: req.ip,
  });
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Upload request completed', {
      sessionId,
      statusCode: res.statusCode,
      duration,
      contentLength: req.contentLength,
    });
  });
  
  next();
}

/**
 * Handle upload errors gracefully
 */
export function handleUploadErrors(error: Error, req: StreamingUploadRequest, res: Response, next: NextFunction): void {
  if (!req.isStreamingUpload) {
    return next(error);
  }
  
  logger.error('Upload request error', {
    sessionId: req.params.id || 'unknown',
    error: error.message,
    method: req.method,
    contentLength: req.contentLength,
    stack: error.stack,
  });
  
  // Don't expose internal errors to client
  if (!res.headersSent) {
    if (error.message.includes('timeout')) {
      res.status(408).json({ error: 'Upload timeout' });
    } else if (error.message.includes('ECONNRESET') || error.message.includes('EPIPE')) {
      res.status(499).json({ error: 'Client disconnected' });
    } else {
      res.status(500).json({ error: 'Upload failed' });
    }
  }
}

/**
 * Middleware stack for streaming uploads
 * Apply this to upload routes that need to handle raw binary data
 */
export function createUploadMiddleware() {
  return [
    setupUploadTimeout(),
    skipBodyParser,
    validateUploadHeaders,
    collectSmallBody,
    logUploadRequest,
  ];
}

/**
 * Check if request is a status probe (no body or bytes */{size})
 */
export function isStatusProbe(req: StreamingUploadRequest): boolean {
  const contentRange = req.headers['content-range'] as string;
  const contentLength = req.contentLength || 0;
  
  // Empty body or bytes */size format indicates status probe
  return contentLength === 0 || 
         (contentRange && contentRange.includes('*/'));
}

/**
 * Get request stream for processing
 * Returns the raw request stream for streaming to storage
 */
export function getRequestStream(req: StreamingUploadRequest): NodeJS.ReadableStream {
  return req;
}

/**
 * Calculate upload progress from request headers
 */
export function getUploadProgress(req: StreamingUploadRequest): { current: number; total: number } | null {
  const contentRange = req.headers['content-range'] as string;
  
  if (!contentRange) {
    return null;
  }
  
  // Parse Content-Range: bytes start-end/total
  const match = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
  if (match) {
    const end = parseInt(match[2], 10);
    const total = parseInt(match[3], 10);
    return { current: end + 1, total };
  }
  
  // Parse Content-Range: bytes */total (status probe)
  const probeMatch = contentRange.match(/bytes \*\/(\d+)/);
  if (probeMatch) {
    const total = parseInt(probeMatch[1], 10);
    return { current: 0, total };
  }
  
  return null;
}