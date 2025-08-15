/**
 * Promotional Content Generation Service
 * Handles automated trailer creation, thumbnail generation, and social media assets
 */

export interface PromoAsset {
  id: string;
  type: 'trailer' | 'thumbnail' | 'social_image' | 'caption';
  url?: string;
  data?: string;
  metadata: {
    duration?: number;
    dimensions?: { width: number; height: number };
    format?: string;
    timestamp?: number;
    platform?: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface PromoKit {
  id: string;
  contentId: string;
  organizationId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  assets: PromoAsset[];
  settings: PromoKitSettings;
  createdAt: string;
  completedAt?: string;
  estimatedCompletionTime?: string;
}

export interface PromoKitSettings {
  trailerDuration: 30 | 45 | 60;
  thumbnailCount: 3 | 6 | 9;
  generateSocialAssets: boolean;
  platforms: ('twitter' | 'reddit' | 'telegram' | 'instagram')[];
  includeWatermark: boolean;
  sfwOnly: boolean;
  customBranding?: {
    logo?: string;
    colors?: { primary: string; secondary: string };
    fonts?: { primary: string; secondary: string };
  };
}

export interface SocialAsset {
  platform: 'twitter' | 'reddit' | 'telegram' | 'instagram';
  type: 'image' | 'caption' | 'hashtags';
  content: string;
  dimensions?: { width: number; height: number };
  characterCount?: number;
}

export interface TrailerOptions {
  duration: number;
  segments: Array<{
    startTime: number;
    endTime: number;
    type: 'intro' | 'highlight' | 'outro';
  }>;
  transitions: 'fade' | 'cut' | 'dissolve';
  includeAudio: boolean;
  sfwOnly: boolean;
}

export class PromoKitService {
  private static instance: PromoKitService;
  private baseUrl: string;
  private processingQueue: Map<string, PromoKit> = new Map();

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  public static getInstance(): PromoKitService {
    if (!PromoKitService.instance) {
      PromoKitService.instance = new PromoKitService();
    }
    return PromoKitService.instance;
  }

  /**
   * Generate complete promotional kit for content
   */
  async generatePromoKit(
    contentId: string,
    settings: PromoKitSettings,
    organizationId?: string
  ): Promise<PromoKit> {
    try {
      const promoKit: PromoKit = {
        id: `promo_${Date.now()}`,
        contentId,
        organizationId,
        status: 'pending',
        progress: 0,
        assets: [],
        settings,
        createdAt: new Date().toISOString(),
        estimatedCompletionTime: this.calculateEstimatedTime(settings)
      };

      // Add to processing queue
      this.processingQueue.set(promoKit.id, promoKit);

      // Start processing (simulate async processing)
      this.processPromoKit(promoKit.id);

      return promoKit;
    } catch (error) {
      console.error('Error generating promo kit:', error);
      throw new Error('Failed to generate promotional kit');
    }
  }

  /**
   * Generate trailer from video content
   */
  async generateTrailer(
    contentId: string,
    options: TrailerOptions,
    organizationId?: string
  ): Promise<PromoAsset> {
    try {
      console.log(`Generating trailer for content: ${contentId}`);
      
      // For demo purposes, simulate trailer generation
      const asset: PromoAsset = {
        id: `trailer_${Date.now()}`,
        type: 'trailer',
        metadata: {
          duration: options.duration,
          dimensions: { width: 1920, height: 1080 },
          format: 'mp4'
        },
        status: 'processing',
        createdAt: new Date().toISOString()
      };

      // Simulate processing time
      setTimeout(() => {
        asset.status = 'completed';
        asset.url = `https://demo-cdn.example.com/trailers/${asset.id}.mp4`;
        asset.completedAt = new Date().toISOString();
      }, 3000);

      return asset;
    } catch (error) {
      console.error('Error generating trailer:', error);
      throw new Error('Failed to generate trailer');
    }
  }

  /**
   * Generate thumbnails at different timestamps
   */
  async generateThumbnails(
    contentId: string,
    count: number = 6,
    organizationId?: string
  ): Promise<PromoAsset[]> {
    try {
      console.log(`Generating ${count} thumbnails for content: ${contentId}`);
      
      const thumbnails: PromoAsset[] = [];
      
      for (let i = 0; i < count; i++) {
        const timestamp = (i + 1) * (100 / (count + 1)); // Distribute evenly
        
        const asset: PromoAsset = {
          id: `thumb_${Date.now()}_${i}`,
          type: 'thumbnail',
          metadata: {
            dimensions: { width: 1920, height: 1080 },
            format: 'jpg',
            timestamp
          },
          status: 'processing',
          createdAt: new Date().toISOString()
        };

        thumbnails.push(asset);

        // Simulate processing
        setTimeout(() => {
          asset.status = 'completed';
          asset.url = `https://demo-cdn.example.com/thumbnails/${asset.id}.jpg`;
          asset.completedAt = new Date().toISOString();
        }, 1000 + (i * 500));
      }

      return thumbnails;
    } catch (error) {
      console.error('Error generating thumbnails:', error);
      throw new Error('Failed to generate thumbnails');
    }
  }

  /**
   * Generate social media assets
   */
  async generateSocialAssets(
    contentId: string,
    platforms: string[],
    organizationId?: string
  ): Promise<PromoAsset[]> {
    try {
      console.log(`Generating social assets for platforms: ${platforms.join(', ')}`);
      
      const assets: PromoAsset[] = [];

      for (const platform of platforms) {
        // Generate image asset
        const imageAsset: PromoAsset = {
          id: `social_img_${platform}_${Date.now()}`,
          type: 'social_image',
          metadata: {
            dimensions: this.getSocialImageDimensions(platform),
            format: 'jpg',
            platform
          },
          status: 'processing',
          createdAt: new Date().toISOString()
        };

        // Generate caption asset
        const captionAsset: PromoAsset = {
          id: `social_caption_${platform}_${Date.now()}`,
          type: 'caption',
          data: this.generateSocialCaption(platform),
          metadata: {
            platform
          },
          status: 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        };

        assets.push(imageAsset, captionAsset);

        // Simulate image processing
        setTimeout(() => {
          imageAsset.status = 'completed';
          imageAsset.url = `https://demo-cdn.example.com/social/${imageAsset.id}.jpg`;
          imageAsset.completedAt = new Date().toISOString();
        }, 2000);
      }

      return assets;
    } catch (error) {
      console.error('Error generating social assets:', error);
      throw new Error('Failed to generate social media assets');
    }
  }

  /**
   * Get promo kit status
   */
  async getPromoKit(promoKitId: string): Promise<PromoKit | null> {
    const kit = this.processingQueue.get(promoKitId);
    if (kit) {
      return kit;
    }

    // For demo purposes, return mock data if not in queue
    const mockKit: PromoKit = {
      id: promoKitId,
      contentId: 'demo_content',
      status: 'completed',
      progress: 100,
      assets: [
        {
          id: 'trailer_demo',
          type: 'trailer',
          url: 'https://demo-cdn.example.com/trailers/demo.mp4',
          metadata: {
            duration: 30,
            dimensions: { width: 1920, height: 1080 },
            format: 'mp4'
          },
          status: 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        },
        {
          id: 'thumb_demo_1',
          type: 'thumbnail',
          url: 'https://demo-cdn.example.com/thumbnails/demo1.jpg',
          metadata: {
            dimensions: { width: 1920, height: 1080 },
            format: 'jpg',
            timestamp: 25
          },
          status: 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        }
      ],
      settings: this.getDefaultSettings(),
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };

    return mockKit;
  }

  /**
   * Get user's promo kit history
   */
  async getPromoKitHistory(organizationId?: string): Promise<PromoKit[]> {
    // For demo purposes, return mock history
    const mockHistory: PromoKit[] = [
      {
        id: 'promo_recent',
        contentId: 'content_123',
        organizationId,
        status: 'completed',
        progress: 100,
        assets: [
          {
            id: 'trailer_recent',
            type: 'trailer',
            url: 'https://demo-cdn.example.com/trailers/recent.mp4',
            metadata: { duration: 30, dimensions: { width: 1920, height: 1080 }, format: 'mp4' },
            status: 'completed',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            completedAt: new Date(Date.now() - 3500000).toISOString()
          }
        ],
        settings: this.getDefaultSettings(),
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date(Date.now() - 3500000).toISOString()
      },
      {
        id: 'promo_older',
        contentId: 'content_456',
        organizationId,
        status: 'completed',
        progress: 100,
        assets: [],
        settings: this.getDefaultSettings(),
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        completedAt: new Date(Date.now() - 86000000).toISOString()
      }
    ];

    return mockHistory;
  }

  /**
   * Share to social media platform
   */
  async shareToSocial(
    platform: string,
    assetId: string,
    caption?: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      console.log(`Sharing asset ${assetId} to ${platform}`);
      
      // For demo purposes, simulate successful sharing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const shareUrl = `https://${platform}.com/share/${assetId}`;
      
      return {
        success: true,
        url: shareUrl
      };
    } catch (error) {
      console.error('Error sharing to social media:', error);
      return {
        success: false,
        error: 'Failed to share to social media'
      };
    }
  }

  /**
   * Process promo kit (simulate async processing)
   */
  private async processPromoKit(promoKitId: string): Promise<void> {
    const kit = this.processingQueue.get(promoKitId);
    if (!kit) return;

    try {
      kit.status = 'processing';
      
      // Generate trailer
      kit.progress = 10;
      const trailerAsset = await this.generateTrailer(
        kit.contentId,
        {
          duration: kit.settings.trailerDuration,
          segments: [
            { startTime: 0, endTime: 10, type: 'intro' },
            { startTime: 30, endTime: 50, type: 'highlight' },
            { startTime: 80, endTime: 90, type: 'outro' }
          ],
          transitions: 'fade',
          includeAudio: true,
          sfwOnly: kit.settings.sfwOnly
        },
        kit.organizationId
      );
      kit.assets.push(trailerAsset);
      kit.progress = 40;

      // Generate thumbnails
      const thumbnailAssets = await this.generateThumbnails(
        kit.contentId,
        kit.settings.thumbnailCount,
        kit.organizationId
      );
      kit.assets.push(...thumbnailAssets);
      kit.progress = 70;

      // Generate social assets if enabled
      if (kit.settings.generateSocialAssets) {
        const socialAssets = await this.generateSocialAssets(
          kit.contentId,
          kit.settings.platforms,
          kit.organizationId
        );
        kit.assets.push(...socialAssets);
      }

      kit.progress = 100;
      kit.status = 'completed';
      kit.completedAt = new Date().toISOString();

    } catch (error) {
      console.error('Error processing promo kit:', error);
      kit.status = 'failed';
      kit.progress = 0;
    }
  }

  /**
   * Calculate estimated completion time
   */
  private calculateEstimatedTime(settings: PromoKitSettings): string {
    let estimatedMinutes = 1; // Base time
    
    // Add time for trailer
    estimatedMinutes += Math.ceil(settings.trailerDuration / 30);
    
    // Add time for thumbnails
    estimatedMinutes += Math.ceil(settings.thumbnailCount / 3);
    
    // Add time for social assets
    if (settings.generateSocialAssets) {
      estimatedMinutes += settings.platforms.length * 0.5;
    }

    const completionTime = new Date(Date.now() + estimatedMinutes * 60000);
    return completionTime.toISOString();
  }

  /**
   * Get social image dimensions for platform
   */
  private getSocialImageDimensions(platform: string): { width: number; height: number } {
    const dimensions = {
      twitter: { width: 1200, height: 675 },
      reddit: { width: 1200, height: 630 },
      telegram: { width: 1280, height: 720 },
      instagram: { width: 1080, height: 1080 }
    };

    return dimensions[platform as keyof typeof dimensions] || { width: 1200, height: 630 };
  }

  /**
   * Generate social media caption
   */
  private generateSocialCaption(platform: string): string {
    const captions = {
      twitter: "🔥 New exclusive content just dropped! Check out this amazing preview and get full access on our platform. #exclusive #content #creator",
      reddit: "Just released some new content! Here's a sneak peek - full version available on our platform with exclusive access.",
      telegram: "🎬 New content alert! Premium exclusive content now available. Join our community for full access and more!",
      instagram: "✨ New content is live! Swipe to see more and get exclusive access to the full experience. Link in bio! 🔗"
    };

    return captions[platform as keyof typeof captions] || "New exclusive content available now!";
  }

  /**
   * Get default promo kit settings
   */
  private getDefaultSettings(): PromoKitSettings {
    return {
      trailerDuration: 30,
      thumbnailCount: 6,
      generateSocialAssets: true,
      platforms: ['twitter', 'reddit'],
      includeWatermark: false,
      sfwOnly: true
    };
  }
}