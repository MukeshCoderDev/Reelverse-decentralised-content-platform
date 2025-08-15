/**
 * Migration Service
 * Handles content import from CSV/JSON and link-in-bio platforms
 */

export interface ContentImportItem {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  category?: string;
  ageRating?: '18+' | '21+';
  thumbnail?: string;
  trailer?: string;
  duration?: number;
  originalUrl?: string;
  platform?: string;
  status: 'pending' | 'validated' | 'imported' | 'failed';
  validationErrors?: string[];
}

export interface ImportBatch {
  id: string;
  organizationId?: string;
  source: 'csv' | 'json' | 'linkinbio';
  platform?: 'beacons' | 'linktree' | 'allmylinks' | 'custom';
  totalItems: number;
  validItems: number;
  invalidItems: number;
  importedItems: number;
  status: 'processing' | 'validated' | 'importing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  items: ContentImportItem[];
  settings: ImportSettings;
}

export interface ImportSettings {
  autoPublish: boolean;
  defaultStorageClass: 'shreddable' | 'permanent';
  enableEncryption: boolean;
  enableWatermarking: boolean;
  defaultAgeRating: '18+' | '21+';
  categoryMapping: Record<string, string>;
  tagMapping: Record<string, string[]>;
  skipDuplicates: boolean;
}

export interface LinkInBioData {
  platform: 'beacons' | 'linktree' | 'allmylinks';
  username: string;
  profileUrl: string;
  items: Array<{
    title: string;
    url: string;
    description?: string;
    thumbnail?: string;
    category?: string;
  }>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export class MigrationService {
  private static instance: MigrationService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  public static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  /**
   * Parse CSV file and create import batch
   */
  async parseCSVFile(file: File, organizationId?: string): Promise<ImportBatch> {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        throw new Error('CSV file is empty');
      }

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredHeaders = ['title'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
      }

      // Parse data rows
      const items: ContentImportItem[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const item: ContentImportItem = {
          id: `import_${Date.now()}_${i}`,
          title: values[headers.indexOf('title')] || '',
          description: values[headers.indexOf('description')] || undefined,
          tags: values[headers.indexOf('tags')]?.split(';').map(t => t.trim()) || [],
          category: values[headers.indexOf('category')] || undefined,
          ageRating: (values[headers.indexOf('age_rating')] as '18+' | '21+') || '18+',
          thumbnail: values[headers.indexOf('thumbnail')] || undefined,
          trailer: values[headers.indexOf('trailer')] || undefined,
          duration: parseInt(values[headers.indexOf('duration')]) || undefined,
          originalUrl: values[headers.indexOf('url')] || undefined,
          platform: values[headers.indexOf('platform')] || undefined,
          status: 'pending'
        };
        items.push(item);
      }

      const batch: ImportBatch = {
        id: `batch_${Date.now()}`,
        organizationId,
        source: 'csv',
        totalItems: items.length,
        validItems: 0,
        invalidItems: 0,
        importedItems: 0,
        status: 'processing',
        createdAt: new Date().toISOString(),
        items,
        settings: this.getDefaultImportSettings()
      };

      return batch;
    } catch (error) {
      console.error('Error parsing CSV file:', error);
      throw new Error('Failed to parse CSV file');
    }
  }

  /**
   * Parse JSON file and create import batch
   */
  async parseJSONFile(file: File, organizationId?: string): Promise<ImportBatch> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!Array.isArray(data)) {
        throw new Error('JSON must contain an array of content items');
      }

      const items: ContentImportItem[] = data.map((item, index) => ({
        id: `import_${Date.now()}_${index}`,
        title: item.title || '',
        description: item.description,
        tags: Array.isArray(item.tags) ? item.tags : [],
        category: item.category,
        ageRating: item.ageRating || '18+',
        thumbnail: item.thumbnail,
        trailer: item.trailer,
        duration: item.duration,
        originalUrl: item.url || item.originalUrl,
        platform: item.platform,
        status: 'pending'
      }));

      const batch: ImportBatch = {
        id: `batch_${Date.now()}`,
        organizationId,
        source: 'json',
        totalItems: items.length,
        validItems: 0,
        invalidItems: 0,
        importedItems: 0,
        status: 'processing',
        createdAt: new Date().toISOString(),
        items,
        settings: this.getDefaultImportSettings()
      };

      return batch;
    } catch (error) {
      console.error('Error parsing JSON file:', error);
      throw new Error('Failed to parse JSON file');
    }
  }

  /**
   * Import from link-in-bio platform
   */
  async importFromLinkInBio(platform: string, username: string, organizationId?: string): Promise<ImportBatch> {
    try {
      // For demo purposes, return mock data
      console.log(`Importing from ${platform} for user: ${username}`);
      
      const mockItems: ContentImportItem[] = [
        {
          id: 'linkinbio_1',
          title: 'Premium Content Collection',
          description: 'Exclusive content from my premium tier',
          tags: ['premium', 'exclusive'],
          category: 'premium',
          ageRating: '18+',
          originalUrl: `https://${platform}.com/${username}/premium`,
          platform,
          status: 'pending'
        },
        {
          id: 'linkinbio_2',
          title: 'Behind the Scenes',
          description: 'Exclusive behind the scenes content',
          tags: ['bts', 'exclusive'],
          category: 'behind-scenes',
          ageRating: '18+',
          originalUrl: `https://${platform}.com/${username}/bts`,
          platform,
          status: 'pending'
        }
      ];

      const batch: ImportBatch = {
        id: `batch_${Date.now()}`,
        organizationId,
        source: 'linkinbio',
        platform: platform as any,
        totalItems: mockItems.length,
        validItems: 0,
        invalidItems: 0,
        importedItems: 0,
        status: 'processing',
        createdAt: new Date().toISOString(),
        items: mockItems,
        settings: this.getDefaultImportSettings()
      };

      return batch;
    } catch (error) {
      console.error('Error importing from link-in-bio:', error);
      throw new Error('Failed to import from link-in-bio platform');
    }
  }

  /**
   * Validate import batch
   */
  async validateBatch(batchId: string): Promise<ImportBatch> {
    try {
      // For demo purposes, simulate validation
      console.log('Validating batch:', batchId);
      
      // Mock validation logic
      const batch = await this.getBatch(batchId);
      let validItems = 0;
      let invalidItems = 0;

      batch.items.forEach(item => {
        const validation = this.validateItem(item);
        if (validation.isValid) {
          item.status = 'validated';
          validItems++;
        } else {
          item.status = 'failed';
          item.validationErrors = validation.errors;
          invalidItems++;
        }
      });

      batch.validItems = validItems;
      batch.invalidItems = invalidItems;
      batch.status = 'validated';

      return batch;
    } catch (error) {
      console.error('Error validating batch:', error);
      throw new Error('Failed to validate import batch');
    }
  }

  /**
   * Start import process
   */
  async startImport(batchId: string, settings: ImportSettings): Promise<void> {
    try {
      console.log('Starting import for batch:', batchId);
      
      const batch = await this.getBatch(batchId);
      batch.settings = settings;
      batch.status = 'importing';

      // Simulate import process
      for (const item of batch.items) {
        if (item.status === 'validated') {
          // Simulate import delay
          await new Promise(resolve => setTimeout(resolve, 500));
          item.status = 'imported';
          batch.importedItems++;
        }
      }

      batch.status = 'completed';
      batch.completedAt = new Date().toISOString();
    } catch (error) {
      console.error('Error starting import:', error);
      throw new Error('Failed to start import process');
    }
  }

  /**
   * Get import batch
   */
  async getBatch(batchId: string): Promise<ImportBatch> {
    // For demo purposes, return mock batch
    const mockBatch: ImportBatch = {
      id: batchId,
      source: 'csv',
      totalItems: 3,
      validItems: 2,
      invalidItems: 1,
      importedItems: 0,
      status: 'processing',
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 'item_1',
          title: 'Sample Content 1',
          description: 'Description for content 1',
          tags: ['tag1', 'tag2'],
          category: 'premium',
          ageRating: '18+',
          status: 'pending'
        },
        {
          id: 'item_2',
          title: 'Sample Content 2',
          description: 'Description for content 2',
          tags: ['tag3'],
          category: 'standard',
          ageRating: '18+',
          status: 'pending'
        }
      ],
      settings: this.getDefaultImportSettings()
    };

    return mockBatch;
  }

  /**
   * Get user's import history
   */
  async getImportHistory(organizationId?: string): Promise<ImportBatch[]> {
    // For demo purposes, return mock history
    const mockHistory: ImportBatch[] = [
      {
        id: 'batch_recent',
        organizationId,
        source: 'csv',
        totalItems: 25,
        validItems: 23,
        invalidItems: 2,
        importedItems: 23,
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        completedAt: new Date(Date.now() - 86000000).toISOString(),
        items: [],
        settings: this.getDefaultImportSettings()
      },
      {
        id: 'batch_older',
        organizationId,
        source: 'linkinbio',
        platform: 'linktree',
        totalItems: 12,
        validItems: 12,
        invalidItems: 0,
        importedItems: 12,
        status: 'completed',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        completedAt: new Date(Date.now() - 172000000).toISOString(),
        items: [],
        settings: this.getDefaultImportSettings()
      }
    ];

    return mockHistory;
  }

  /**
   * Validate individual item
   */
  private validateItem(item: ContentImportItem): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required field validation
    if (!item.title || item.title.trim().length === 0) {
      errors.push('Title is required');
    }

    // Title length validation
    if (item.title && item.title.length > 100) {
      warnings.push('Title is longer than recommended (100 characters)');
    }

    // Description validation
    if (item.description && item.description.length > 500) {
      warnings.push('Description is longer than recommended (500 characters)');
    }

    // URL validation
    if (item.originalUrl && !this.isValidUrl(item.originalUrl)) {
      errors.push('Invalid URL format');
    }

    // Age rating validation
    if (item.ageRating && !['18+', '21+'].includes(item.ageRating)) {
      errors.push('Age rating must be 18+ or 21+');
    }

    // Suggestions
    if (!item.description) {
      suggestions.push('Consider adding a description for better discoverability');
    }

    if (!item.tags || item.tags.length === 0) {
      suggestions.push('Adding tags will improve content discoverability');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Check if URL is valid
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get default import settings
   */
  private getDefaultImportSettings(): ImportSettings {
    return {
      autoPublish: false,
      defaultStorageClass: 'shreddable',
      enableEncryption: true,
      enableWatermarking: false,
      defaultAgeRating: '18+',
      categoryMapping: {},
      tagMapping: {},
      skipDuplicates: true
    };
  }
}