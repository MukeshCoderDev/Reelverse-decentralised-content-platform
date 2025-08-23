import { 
  parseContentRange, 
  validateChunk, 
  generateRangeHeader, 
  generateUploadOffsetHeader,
  calculateOptimalChunkSize,
  validateFileSize,
  validateMimeType,
  sanitizeFilename
} from '../../../src/utils/contentRange';

describe('Content-Range Parser', () => {
  describe('parseContentRange', () => {
    test('parses valid chunk upload format', () => {
      const result = parseContentRange('bytes 0-1023/2048');
      expect(result).toEqual({
        start: 0,
        end: 1023,
        total: 2048,
        isStatusProbe: false,
      });
    });

    test('parses status probe with total', () => {
      const result = parseContentRange('bytes */2048');
      expect(result).toEqual({
        start: 0,
        end: -1,
        total: 2048,
        isStatusProbe: true,
      });
    });

    test('parses status probe without total', () => {
      const result = parseContentRange('bytes */');
      expect(result).toEqual({
        start: 0,
        end: -1,
        total: -1,
        isStatusProbe: true,
      });
    });

    test('handles unknown total with asterisk', () => {
      const result = parseContentRange('bytes 0-1023/*');
      expect(result).toEqual({
        start: 0,
        end: 1023,
        total: -1,
        isStatusProbe: false,
      });
    });

    test('rejects invalid formats', () => {
      expect(parseContentRange('')).toBeNull();
      expect(parseContentRange('invalid')).toBeNull();
      expect(parseContentRange('bytes abc-def/ghi')).toBeNull();
      expect(parseContentRange('bytes 1023-0/2048')).toBeNull(); // end < start
      expect(parseContentRange('ranges 0-1023/2048')).toBeNull(); // wrong unit
    });

    test('validates range boundaries', () => {
      expect(parseContentRange('bytes -1-1023/2048')).toBeNull(); // negative start
      expect(parseContentRange('bytes 0-2048/2048')).toBeNull(); // end >= total
    });
  });

  describe('validateChunk', () => {
    const sessionBytesReceived = 1024;
    const sessionTotalBytes = 10240;
    const sessionChunkSize = 1024;

    test('validates correct chunk', () => {
      const rangeInfo = {
        start: 1024,
        end: 2047,
        total: 10240,
        isStatusProbe: false,
      };

      const result = validateChunk(rangeInfo, sessionBytesReceived, sessionTotalBytes, sessionChunkSize, 1024);
      
      expect(result.valid).toBe(true);
      expect(result.partNumber).toBe(2);
      expect(result.expectedSize).toBe(1024);
    });

    test('handles status probes', () => {
      const rangeInfo = {
        start: 0,
        end: -1,
        total: 10240,
        isStatusProbe: true,
      };

      const result = validateChunk(rangeInfo, sessionBytesReceived, sessionTotalBytes, sessionChunkSize, 0);
      
      expect(result.valid).toBe(true);
    });

    test('rejects total size mismatch', () => {
      const rangeInfo = {
        start: 1024,
        end: 2047,
        total: 5120, // Wrong total
        isStatusProbe: false,
      };

      const result = validateChunk(rangeInfo, sessionBytesReceived, sessionTotalBytes, sessionChunkSize, 1024);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Total size mismatch');
    });

    test('rejects Content-Length mismatch', () => {
      const rangeInfo = {
        start: 1024,
        end: 2047,
        total: 10240,
        isStatusProbe: false,
      };

      const result = validateChunk(rangeInfo, sessionBytesReceived, sessionTotalBytes, sessionChunkSize, 512); // Wrong length
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Content-Length does not match');
    });

    test('rejects out-of-sync chunks', () => {
      const rangeInfo = {
        start: 2048, // Should be 1024
        end: 3071,
        total: 10240,
        isStatusProbe: false,
      };

      const result = validateChunk(rangeInfo, sessionBytesReceived, sessionTotalBytes, sessionChunkSize, 1024);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('out of sync');
    });

    test('rejects invalid chunk size', () => {
      const rangeInfo = {
        start: 1024,
        end: 1535, // 512 bytes instead of 1024
        total: 10240,
        isStatusProbe: false,
      };

      const result = validateChunk(rangeInfo, sessionBytesReceived, sessionTotalBytes, sessionChunkSize, 512);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid chunk size');
    });

    test('handles final chunk correctly', () => {
      const finalSessionBytesReceived = 9216; // Last 1024 bytes remaining
      const rangeInfo = {
        start: 9216,
        end: 10239, // Final chunk, exactly 1024 bytes
        total: 10240,
        isStatusProbe: false,
      };

      const result = validateChunk(rangeInfo, finalSessionBytesReceived, sessionTotalBytes, sessionChunkSize, 1024);
      
      expect(result.valid).toBe(true);
      expect(result.partNumber).toBe(10);
    });

    test('validates part number limits', () => {
      const largeSessionBytesReceived = 0;
      const largeChunkSize = 5 * 1024 * 1024; // 5MB
      const rangeInfo = {
        start: 0,
        end: largeChunkSize - 1,
        total: 10001 * largeChunkSize, // Would create part 10001
        isStatusProbe: false,
      };

      const result = validateChunk(rangeInfo, largeSessionBytesReceived, 10001 * largeChunkSize, largeChunkSize, largeChunkSize);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Too many parts');
    });
  });

  describe('generateRangeHeader', () => {
    test('generates correct range header', () => {
      expect(generateRangeHeader(1024)).toBe('bytes=0-1023');
      expect(generateRangeHeader(1)).toBe('bytes=0-0');
    });

    test('returns undefined for zero bytes', () => {
      expect(generateRangeHeader(0)).toBeUndefined();
    });
  });

  describe('generateUploadOffsetHeader', () => {
    test('generates correct offset header', () => {
      expect(generateUploadOffsetHeader(1024)).toBe('1024');
      expect(generateUploadOffsetHeader(0)).toBe('0');
    });
  });

  describe('calculateOptimalChunkSize', () => {
    test('returns minimum chunk size for small files', () => {
      const result = calculateOptimalChunkSize(50 * 1024 * 1024); // 50MB
      expect(result).toBe(8 * 1024 * 1024); // 8MB minimum
    });

    test('calculates larger chunk size for big files', () => {
      const result = calculateOptimalChunkSize(100 * 1024 * 1024 * 1024); // 100GB
      expect(result).toBeGreaterThan(8 * 1024 * 1024);
      expect(result % (5 * 1024 * 1024)).toBe(0); // Multiple of 5MB
    });

    test('ensures part count stays under limit', () => {
      const totalBytes = 1000 * 1024 * 1024 * 1024; // 1TB
      const chunkSize = calculateOptimalChunkSize(totalBytes);
      const partCount = Math.ceil(totalBytes / chunkSize);
      
      expect(partCount).toBeLessThanOrEqual(9000);
    });
  });

  describe('validateFileSize', () => {
    test('accepts valid file sizes', () => {
      const result = validateFileSize(100 * 1024 * 1024); // 100MB
      expect(result.valid).toBe(true);
    });

    test('rejects zero or negative sizes', () => {
      expect(validateFileSize(0).valid).toBe(false);
      expect(validateFileSize(-1).valid).toBe(false);
    });

    test('rejects files exceeding maximum size', () => {
      const maxSize = 20 * 1024 * 1024 * 1024; // 20GB default
      const result = validateFileSize(maxSize + 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });
  });

  describe('validateMimeType', () => {
    test('accepts valid video MIME types', () => {
      expect(validateMimeType('video/mp4').valid).toBe(true);
      expect(validateMimeType('video/quicktime').valid).toBe(true);
      expect(validateMimeType('video/webm').valid).toBe(true);
    });

    test('rejects invalid MIME types', () => {
      expect(validateMimeType('image/jpeg').valid).toBe(false);
      expect(validateMimeType('text/plain').valid).toBe(false);
      expect(validateMimeType('').valid).toBe(false);
    });

    test('handles case insensitive types', () => {
      expect(validateMimeType('VIDEO/MP4').valid).toBe(true);
    });
  });

  describe('sanitizeFilename', () => {
    test('preserves valid filenames', () => {
      expect(sanitizeFilename('video.mp4')).toBe('video.mp4');
      expect(sanitizeFilename('My-Video_2024.mov')).toBe('My-Video_2024.mov');
    });

    test('replaces invalid characters', () => {
      expect(sanitizeFilename('video with spaces.mp4')).toBe('video_with_spaces.mp4');
      expect(sanitizeFilename('file/with\\slashes.mp4')).toBe('file_with_slashes.mp4');
    });

    test('handles edge cases', () => {
      expect(sanitizeFilename('')).toBe('upload');
      expect(sanitizeFilename('   ')).toBe('upload');
      expect(sanitizeFilename('...')).toBe('upload');
    });

    test('limits filename length', () => {
      const longName = 'a'.repeat(300);
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
    });

    test('collapses multiple underscores', () => {
      expect(sanitizeFilename('file___with___many___spaces.mp4')).toBe('file_with_many_spaces.mp4');
    });
  });
});

describe('Error Cases and Edge Conditions', () => {
  test('handles malformed Content-Range headers gracefully', () => {
    const malformedHeaders = [
      'bytes',
      'bytes ',
      'bytes 0',
      'bytes 0-',
      'bytes 0-1023',
      'bytes 0-1023/',
      'bytes start-end/total',
      'bytes 0-1023/abc',
    ];

    malformedHeaders.forEach(header => {
      expect(parseContentRange(header)).toBeNull();
    });
  });

  test('validateChunk handles extreme values', () => {
    const rangeInfo = {
      start: Number.MAX_SAFE_INTEGER,
      end: Number.MAX_SAFE_INTEGER,
      total: Number.MAX_SAFE_INTEGER,
      isStatusProbe: false,
    };

    const result = validateChunk(rangeInfo, 0, Number.MAX_SAFE_INTEGER, 1024, 1);
    expect(result.valid).toBe(false); // Should fail due to sync issues
  });

  test('calculateOptimalChunkSize handles edge cases', () => {
    expect(calculateOptimalChunkSize(1)).toBe(8 * 1024 * 1024); // Minimum
    expect(calculateOptimalChunkSize(Number.MAX_SAFE_INTEGER)).toBeGreaterThan(0);
  });
});