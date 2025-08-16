import { Request, Response, NextFunction } from 'express';
import { referralService } from '../services/growth/ReferralService';
import { logger } from '../services/logging/Logger';

// Extended request interface with attribution data
export interface AttributionRequest extends Request {
  attribution?: {
    referralCode?: string;
    sessionId: string;
    source?: string;
    medium?: string;
    campaign?: string;
    isNewAttribution: boolean;
  };
}

export class AttributionTrackingMiddleware {
  // Main attribution tracking middleware
  static trackAttribution = async (req: AttributionRequest, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.sessionID || req.headers['x-session-id'] as string || 
                       req.cookies?.sessionId || `session-${Date.now()}-${Math.random()}`;
      
      // Initialize attribution object
      req.attribution = {
        sessionId,
        isNewAttribution: false
      };

      // Check for referral code in various places
      const referralCode = req.query.ref as string || 
                          req.query.referral as string ||
                          req.headers['x-referral-code'] as string;

      if (referralCode) {
        await AttributionTrackingMiddleware.processReferralAttribution(req, referralCode);
      }

      // Extract UTM parameters
      AttributionTrackingMiddleware.extractUTMParameters(req);

      // Set attribution cookie if new attribution
      if (req.attribution.isNewAttribution) {
        AttributionTrackingMiddleware.setAttributionCookie(res, req.attribution);
      }

      next();
    } catch (error) {
      logger.error('Attribution tracking error', { 
        error: error.message,
        url: req.url,
        userAgent: req.headers['user-agent']
      });
      
      // Don't block the request if attribution tracking fails
      next();
    }
  };

  // Process referral code attribution
  private static async processReferralAttribution(
    req: AttributionRequest, 
    referralCode: string
  ): Promise<void> {
    try {
      const attribution = await referralService.trackAttribution(referralCode, {
        sessionId: req.attribution!.sessionId,
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        source: req.query.utm_source as string,
        medium: req.query.utm_medium as string,
        campaign: req.query.utm_campaign as string,
        landingPage: `${req.protocol}://${req.get('host')}${req.originalUrl}`
      });

      if (attribution) {
        req.attribution!.referralCode = referralCode;
        req.attribution!.isNewAttribution = true;
        
        logger.info('Referral attribution processed', {
          attributionId: attribution.id,
          referralCode,
          sessionId: req.attribution!.sessionId,
          landingPage: req.originalUrl
        });
      }
    } catch (error) {
      logger.warn('Failed to process referral attribution', {
        referralCode,
        error: error.message
      });
    }
  }

  // Extract UTM parameters from query string
  private static extractUTMParameters(req: AttributionRequest): void {
    req.attribution!.source = req.query.utm_source as string || 'direct';
    req.attribution!.medium = req.query.utm_medium as string || 'none';
    req.attribution!.campaign = req.query.utm_campaign as string || 'none';
  }

  // Set attribution cookie for tracking
  private static setAttributionCookie(res: Response, attribution: any): void {
    const cookieData = {
      referralCode: attribution.referralCode,
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign,
      timestamp: new Date().toISOString()
    };

    res.cookie('attribution', JSON.stringify(cookieData), {
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
  }

  // Middleware to track page views with attribution
  static trackPageView = (req: AttributionRequest, res: Response, next: NextFunction) => {
    if (req.attribution?.referralCode) {
      // Log page view for analytics
      logger.info('Attributed page view', {
        referralCode: req.attribution.referralCode,
        sessionId: req.attribution.sessionId,
        page: req.originalUrl,
        source: req.attribution.source,
        medium: req.attribution.medium,
        campaign: req.attribution.campaign
      });
    }
    
    next();
  };

  // Middleware to handle conversion tracking
  static trackConversion = (conversionType: 'purchase' | 'subscription' | 'creator_signup') => {
    return async (req: AttributionRequest, res: Response, next: NextFunction) => {
      try {
        // This would typically be called after a successful conversion
        // The actual conversion value would be passed in the request body
        const { userId, conversionValue } = req.body;
        
        if (userId && conversionValue && req.attribution?.sessionId) {
          const attribution = await referralService.convertAttribution(
            userId,
            req.attribution.sessionId,
            conversionValue,
            conversionType
          );

          if (attribution) {
            logger.info('Conversion attributed', {
              attributionId: attribution.id,
              userId,
              conversionType,
              conversionValue,
              commission: attribution.commissionEarned
            });

            // Add attribution info to response for frontend
            res.locals.attribution = {
              attributionId: attribution.id,
              commission: attribution.commissionEarned,
              referralCode: req.attribution.referralCode
            };
          }
        }
      } catch (error) {
        logger.error('Conversion tracking error', {
          error: error.message,
          conversionType,
          sessionId: req.attribution?.sessionId
        });
      }
      
      next();
    };
  };

  // Middleware for A/B testing with attribution
  static attributionABTest = (testName: string, variants: string[]) => {
    return (req: AttributionRequest, res: Response, next: NextFunction) => {
      if (req.attribution?.referralCode) {
        // Assign variant based on referral code hash for consistency
        const hash = AttributionTrackingMiddleware.hashString(req.attribution.referralCode);
        const variantIndex = hash % variants.length;
        const variant = variants[variantIndex];
        
        req.attribution.abTestVariant = variant;
        
        logger.info('A/B test variant assigned', {
          testName,
          variant,
          referralCode: req.attribution.referralCode,
          sessionId: req.attribution.sessionId
        });
      }
      
      next();
    };
  };

  // Simple hash function for consistent variant assignment
  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Middleware to inject attribution data into templates
  static injectAttributionData = (req: AttributionRequest, res: Response, next: NextFunction) => {
    if (req.attribution) {
      res.locals.attribution = {
        hasAttribution: !!req.attribution.referralCode,
        referralCode: req.attribution.referralCode,
        source: req.attribution.source,
        medium: req.attribution.medium,
        campaign: req.attribution.campaign,
        sessionId: req.attribution.sessionId
      };
    }
    
    next();
  };

  // Middleware to handle referral code validation
  static validateReferralCode = async (req: Request, res: Response, next: NextFunction) => {
    const referralCode = req.query.ref as string;
    
    if (referralCode) {
      try {
        // In a real implementation, you'd validate the code exists and is active
        const isValid = referralCode.length >= 6 && /^[A-Z0-9]+$/.test(referralCode);
        
        if (!isValid) {
          logger.warn('Invalid referral code format', { referralCode });
          // Remove invalid referral code from query
          delete req.query.ref;
        }
      } catch (error) {
        logger.error('Referral code validation error', { 
          referralCode, 
          error: error.message 
        });
      }
    }
    
    next();
  };

  // Middleware to handle cross-domain attribution
  static crossDomainAttribution = (req: AttributionRequest, res: Response, next: NextFunction) => {
    const crossDomainRef = req.query.xref as string;
    
    if (crossDomainRef) {
      try {
        // Decode cross-domain referral data
        const decodedData = Buffer.from(crossDomainRef, 'base64').toString('utf-8');
        const attributionData = JSON.parse(decodedData);
        
        // Validate timestamp (within 24 hours)
        const timestamp = new Date(attributionData.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff <= 24 && attributionData.referralCode) {
          req.query.ref = attributionData.referralCode;
          req.query.utm_source = attributionData.source;
          req.query.utm_medium = attributionData.medium;
          req.query.utm_campaign = attributionData.campaign;
          
          logger.info('Cross-domain attribution processed', {
            referralCode: attributionData.referralCode,
            hoursSinceCreation: hoursDiff
          });
        }
      } catch (error) {
        logger.warn('Invalid cross-domain attribution data', { 
          crossDomainRef, 
          error: error.message 
        });
      }
    }
    
    next();
  };
}

// Export individual middleware functions for convenience
export const trackAttribution = AttributionTrackingMiddleware.trackAttribution;
export const trackPageView = AttributionTrackingMiddleware.trackPageView;
export const trackConversion = AttributionTrackingMiddleware.trackConversion;
export const attributionABTest = AttributionTrackingMiddleware.attributionABTest;
export const injectAttributionData = AttributionTrackingMiddleware.injectAttributionData;
export const validateReferralCode = AttributionTrackingMiddleware.validateReferralCode;
export const crossDomainAttribution = AttributionTrackingMiddleware.crossDomainAttribution;