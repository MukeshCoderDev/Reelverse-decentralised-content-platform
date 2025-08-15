import { BulkUploadService, BulkUploadSettings } from '../../services/bulkUploadService';

// Mock fetch globally
global.fetch = jest.fn();

describe('BulkUploadService', () => {
  let bulkUploadService: BulkUploadService;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    bulkUploadService = BulkUploadService.getInstance();
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('validateFiles', () => {
    it('should validate video files correctly', () => {
      const validFile = new File(['video content'], 'video.mp4', { type: 'video/mp4' });
      const invalidTypeFile = new File(['text content'], 'document.txt', { type: 'text/plain' });
      
      // Mock file size for large file test
      const largeFile = new File(['video content'], 'large.mp4', { type: 'video/mp4' });
      Object.defineProperty(largeFile, 'size', {
        value: 3 * 1024 * 1024 * 1024, // 3GB
        writable: false
      });

      const files = [validFile, invalidTypeFile, largeFile];
      const result = bulkUploadService.validateFiles(files);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]).toBe(validFile);
      
      expect(result.invalid).toHaveLength(2);
      expect(result.invalid[0].file).toBe(invalidTypeFile);
      expect(result.invalid[0].reason).toContain('Invalid file type');
      expect(result.invalid[1].file).toBe(largeFile);
      expect(result.invalid[1].reason).toContain('File size exceeds 2GB');
    });

    it('should validate file name length', () => {
      const longNameFile = new File(['video content'], 'a'.repeat(300) + '.mp4', { type: 'video/mp4' });
      
      const result = bulkUploadService.validateFiles([longNameFile]);
      
      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].reason).toContain('File name is too long');
    });
  });

  describe('initializeBatch', () => {
    it('should initialize batch successfully', async () => {
      const files = [
        new File(['video1'], 'video1.mp4', { type: 'video/mp4' }),
        new File(['video2'], 'video2.mp4', { type: 'video/mp4' })
      ];
      
      const settings: BulkUploadSettings = {
        storageClass: 'shreddable',
        enableEncryption: true,
        enableWatermarking: true,
        autoPublish: false,
        defaultAgeRating: '18+',
        defaultTags: ['test'],
        geoRestrictions: []
      };

      const mockBatch = {
        id: 'batch_123',
        organizationId: 'org_1',
        files: [],
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        uploadedSize: 0,
        status: 'pending',
        createdAt: '2024-01-01T00:00:00Z',
        settings
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockBatch })
      } as Response);

      const result = await bulkUploadService.initializeBatch(files, settings, 'org_1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/upload/bulk/init',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileCount: 2,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            organizationId: 'org_1',
            settings
          }),
          credentials: 'include'
        })
      );
      expect(result).toEqual(mockBatch);
    });

    it('should throw error when initialization fails', async () => {
      const files = [new File(['video'], 'video.mp4', { type: 'video/mp4' })];
      const settings: BulkUploadSettings = {
        storageClass: 'shreddable',
        enableEncryption: true,
        enableWatermarking: true,
        autoPublish: false,
        defaultAgeRating: '18+',
        defaultTags: [],
        geoRestrictions: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request'
      } as Response);

      await expect(bulkUploadService.initializeBatch(files, settings))
        .rejects.toThrow('Failed to initialize bulk upload');
    });
  });

  describe('getBatchStatus', () => {
    it('should get batch status successfully', async () => {
      const mockBatch = {
        id: 'batch_123',
        files: [
          {
            id: 'file_1',
            batchId: 'batch_123',
            name: 'video1.mp4',
            size: 1000000,
            type: 'video/mp4',
            status: 'completed',
            progress: 100,
            uploadedBytes: 1000000
          }
        ],
        totalSize: 1000000,
        uploadedSize: 1000000,
        status: 'completed',
        createdAt: '2024-01-01T00:00:00Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockBatch })
      } as Response);

      const result = await bulkUploadService.getBatchStatus('batch_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/upload/bulk/batch_123/status',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        })
      );
      expect(result).toEqual(mockBatch);
    });
  });

  describe('setupSFTPWatch', () => {
    it('should setup SFTP watch folder successfully', async () => {
      const config = {
        organizationId: 'org_1',
        folderPath: '/uploads',
        settings: {
          storageClass: 'shreddable' as const,
          enableEncryption: true,
          enableWatermarking: true,
          autoPublish: false,
          defaultAgeRating: '18+' as const,
          defaultTags: [],
          geoRestrictions: []
        }
      };

      const mockWatchFolder = {
        id: 'watch_123',
        organizationId: 'org_1',
        folderPath: '/uploads',
        isActive: true,
        processedCount: 0,
        errorCount: 0,
        settings: config.settings,
        createdAt: '2024-01-01T00:00:00Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockWatchFolder })
      } as Response);

      const result = await bulkUploadService.setupSFTPWatch(config);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/upload/sftp/watch',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
          credentials: 'include'
        })
      );
      expect(result).toEqual(mockWatchFolder);
    });
  });

  describe('setupS3Pull', () => {
    it('should setup S3 pull successfully', async () => {
      const config = {
        organizationId: 'org_1',
        bucketName: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'AKIATEST',
        secretAccessKey: 'secret',
        manifestPath: 'manifest.json',
        settings: {
          storageClass: 'permanent' as const,
          enableEncryption: true,
          enableWatermarking: true,
          autoPublish: true,
          defaultAgeRating: '18+' as const,
          defaultTags: ['imported'],
          geoRestrictions: []
        }
      };

      const mockS3Config = {
        id: 's3_123',
        organizationId: 'org_1',
        bucketName: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'AKIATEST',
        secretAccessKey: 'secret',
        manifestPath: 'manifest.json',
        isActive: true,
        processedCount: 0,
        errorCount: 0,
        settings: config.settings,
        createdAt: '2024-01-01T00:00:00Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockS3Config })
      } as Response);

      const result = await bulkUploadService.setupS3Pull(config);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/upload/s3/pull',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
          credentials: 'include'
        })
      );
      expect(result).toEqual(mockS3Config);
    });
  });

  describe('formatFileSize', () => {
    it('should format file sizes correctly', () => {
      expect(bulkUploadService.formatFileSize(500)).toBe('500.0 B');
      expect(bulkUploadService.formatFileSize(1024)).toBe('1.0 KB');
      expect(bulkUploadService.formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(bulkUploadService.formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
      expect(bulkUploadService.formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('formatDuration', () => {
    it('should format durations correctly', () => {
      expect(bulkUploadService.formatDuration(30)).toBe('30s');
      expect(bulkUploadService.formatDuration(90)).toBe('2m');
      expect(bulkUploadService.formatDuration(3600)).toBe('1h');
      expect(bulkUploadService.formatDuration(7200)).toBe('2h');
    });
  });

  describe('finalizeBatch', () => {
    it('should finalize batch and return content IDs', async () => {
      const mockResponse = {
        contentIds: ['content_1', 'content_2', 'content_3']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResponse })
      } as Response);

      const result = await bulkUploadService.finalizeBatch('batch_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/upload/bulk/batch_123/finalize',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        })
      );
      expect(result).toEqual(mockResponse.contentIds);
    });
  });
});