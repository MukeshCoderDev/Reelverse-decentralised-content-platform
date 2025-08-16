import { EventEmitter } from 'events';

export interface PilotAgency {
  id: string;
  name: string;
  contactEmail: string;
  contactName: string;
  website?: string;
  size: 'small' | 'medium' | 'large' | 'enterprise';
  specialization: string[];
  onboardingStatus: 'invited' | 'in_progress' | 'completed' | 'active' | 'paused';
  invitedAt: Date;
  onboardedAt?: Date;
  lastActivity?: Date;
  metrics: AgencyMetrics;
  supportChannel?: string; // Slack Connect channel ID
  feedback: AgencyFeedback[];
  requirements: AgencyRequirements;
}

export interface AgencyMetrics {
  creatorsOnboarded: number;
  contentUploaded: number;
  totalRevenue: number;
  averagePayoutTime: number; // minutes
  supportTickets: number;
  satisfactionScore: number; // 1-5
  apiCalls: number;
  errorRate: number;
  uptimeExperienced: number;
}

export interface AgencyFeedback {
  id: string;
  agencyId: string;
  type: 'bug_report' | 'feature_request' | 'general_feedback' | 'complaint' | 'praise';
  category: 'onboarding' | 'api' | 'ui' | 'performance' | 'support' | 'billing' | 'compliance';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  submittedAt: Date;
  resolvedAt?: Date;
  assignedTo?: string;
  resolution?: string;
  metadata: Record<string, any>;
}

export interface AgencyRequirements {
  apiAccess: boolean;
  whiteLabeling: boolean;
  customBranding: boolean;
  dedicatedSupport: boolean;
  slaRequirements: {
    uptime: number; // percentage
    responseTime: number; // milliseconds
    payoutTime: number; // hours
  };
  complianceNeeds: string[];
  integrationRequirements: string[];
}

export interface OnboardingKit {
  id: string;
  agencyId: string;
  version: string;
  components: {
    welcomeGuide: string;
    apiDocumentation: string;
    metricsPortal: string;
    supportChannelInvite: string;
    sampleEvidencePack: string;
    referralMaterials: string;
    trendingExplanation: string;
  };
  customizations: Record<string, any>;
  generatedAt: Date;
  deliveredAt?: Date;
}

export interface SoftLaunchMetrics {
  totalAgencies: number;
  activeAgencies: number;
  onboardingCompletionRate: number;
  averageOnboardingTime: number; // days
  overallSatisfaction: number;
  criticalIssues: number;
  featureAdoptionRates: Record<string, number>;
  performanceMetrics: {
    averageUptime: number;
    averageResponseTime: number;
    averagePayoutTime: number;
    errorRate: number;
  };
}

export class AgencyOnboardingService extends EventEmitter {
  private pilotAgencies: Map<string, PilotAgency> = new Map();
  private onboardingKits: Map<string, OnboardingKit> = new Map();
  private feedbackItems: Map<string, AgencyFeedback> = new Map();
  private softLaunchStartDate: Date = new Date();

  constructor() {
    super();
    this.initializePilotAgencies();
    this.startMetricsCollection();
  }

  private initializePilotAgencies(): void {
    const pilotAgencies: Omit<PilotAgency, 'id' | 'invitedAt' | 'metrics' | 'feedback'>[] = [
      {
        name: 'Elite Content Agency',
        contactEmail: 'partnerships@elitecontent.com',
        contactName: 'Sarah Johnson',
        website: 'https://elitecontent.com',
        size: 'large',
        specialization: ['premium_content', 'influencer_management', 'brand_partnerships'],
        onboardingStatus: 'invited',
        requirements: {
          apiAccess: true,
          whiteLabeling: true,
          customBranding: true,
          dedicatedSupport: true,
          slaRequirements: {
            uptime: 99.9,
            responseTime: 500,
            payoutTime: 24
          },
          complianceNeeds: ['GDPR', 'CCPA', '2257'],
          integrationRequirements: ['CRM', 'analytics_dashboard', 'payment_processing']
        }
      },
      {
        name: 'Digital Creators Collective',
        contactEmail: 'hello@digitalcreators.co',
        contactName: 'Mike Chen',
        website: 'https://digitalcreators.co',
        size: 'medium',
        specialization: ['content_creation', 'social_media', 'monetization'],
        onboardingStatus: 'invited',
        requirements: {
          apiAccess: true,
          whiteLabeling: false,
          customBranding: true,
          dedicatedSupport: true,
          slaRequirements: {
            uptime: 99.5,
            responseTime: 1000,
            payoutTime: 48
          },
          complianceNeeds: ['GDPR', 'CCPA'],
          integrationRequirements: ['analytics_dashboard', 'creator_tools']
        }
      },
      {
        name: 'Boutique Media Partners',
        contactEmail: 'partnerships@boutiquemedia.net',
        contactName: 'Emma Rodriguez',
        size: 'small',
        specialization: ['niche_content', 'community_building', 'creator_support'],
        onboardingStatus: 'invited',
        requirements: {
          apiAccess: false,
          whiteLabeling: false,
          customBranding: false,
          dedicatedSupport: false,
          slaRequirements: {
            uptime: 99.0,
            responseTime: 2000,
            payoutTime: 72
          },
          complianceNeeds: ['GDPR'],
          integrationRequirements: ['basic_analytics']
        }
      }
    ];

    pilotAgencies.forEach(agency => {
      const pilotAgency: PilotAgency = {
        ...agency,
        id: `agency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        invitedAt: new Date(),
        metrics: {
          creatorsOnboarded: 0,
          contentUploaded: 0,
          totalRevenue: 0,
          averagePayoutTime: 0,
          supportTickets: 0,
          satisfactionScore: 0,
          apiCalls: 0,
          errorRate: 0,
          uptimeExperienced: 100
        },
        feedback: []
      };

      this.pilotAgencies.set(pilotAgency.id, pilotAgency);
    });
  }

  // Agency Management
  public async inviteAgency(agencyData: Omit<PilotAgency, 'id' | 'invitedAt' | 'metrics' | 'feedback'>): Promise<PilotAgency> {
    const agency: PilotAgency = {
      ...agencyData,
      id: `agency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      invitedAt: new Date(),
      metrics: {
        creatorsOnboarded: 0,
        contentUploaded: 0,
        totalRevenue: 0,
        averagePayoutTime: 0,
        supportTickets: 0,
        satisfactionScore: 0,
        apiCalls: 0,
        errorRate: 0,
        uptimeExperienced: 100
      },
      feedback: []
    };

    this.pilotAgencies.set(agency.id, agency);
    
    // Generate onboarding kit
    await this.generateOnboardingKit(agency.id);
    
    // Send invitation
    await this.sendAgencyInvitation(agency);

    this.emit('agencyInvited', agency);
    
    return agency;
  }

  public async startAgencyOnboarding(agencyId: string): Promise<boolean> {
    const agency = this.pilotAgencies.get(agencyId);
    if (!agency) {
      throw new Error('Agency not found');
    }

    agency.onboardingStatus = 'in_progress';
    this.pilotAgencies.set(agencyId, agency);

    // Set up support channel
    if (agency.requirements.dedicatedSupport) {
      agency.supportChannel = await this.createSupportChannel(agency);
    }

    // Provide API access if required
    if (agency.requirements.apiAccess) {
      await this.provideAPIAccess(agency);
    }

    this.emit('onboardingStarted', agency);
    
    return true;
  }

  public async completeAgencyOnboarding(agencyId: string): Promise<boolean> {
    const agency = this.pilotAgencies.get(agencyId);
    if (!agency) {
      throw new Error('Agency not found');
    }

    agency.onboardingStatus = 'completed';
    agency.onboardedAt = new Date();
    this.pilotAgencies.set(agencyId, agency);

    // Activate agency
    await this.activateAgency(agencyId);

    this.emit('onboardingCompleted', agency);
    
    return true;
  }

  public async activateAgency(agencyId: string): Promise<boolean> {
    const agency = this.pilotAgencies.get(agencyId);
    if (!agency) {
      throw new Error('Agency not found');
    }

    agency.onboardingStatus = 'active';
    agency.lastActivity = new Date();
    this.pilotAgencies.set(agencyId, agency);

    this.emit('agencyActivated', agency);
    
    return true;
  }

  // Onboarding Kit Generation
  private async generateOnboardingKit(agencyId: string): Promise<OnboardingKit> {
    const agency = this.pilotAgencies.get(agencyId);
    if (!agency) {
      throw new Error('Agency not found');
    }

    const kit: OnboardingKit = {
      id: `kit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agencyId,
      version: '1.0.0',
      components: {
        welcomeGuide: await this.generateWelcomeGuide(agency),
        apiDocumentation: await this.generateAPIDocumentation(agency),
        metricsPortal: await this.generateMetricsPortalAccess(agency),
        supportChannelInvite: await this.generateSupportChannelInvite(agency),
        sampleEvidencePack: await this.generateSampleEvidencePack(agency),
        referralMaterials: await this.generateReferralMaterials(agency),
        trendingExplanation: await this.generateTrendingExplanation(agency)
      },
      customizations: this.generateCustomizations(agency),
      generatedAt: new Date()
    };

    this.onboardingKits.set(kit.id, kit);
    
    return kit;
  }

  private async generateWelcomeGuide(agency: PilotAgency): Promise<string> {
    return `
# Welcome to the Platform, ${agency.name}!

## Getting Started

Welcome to our decentralized adult content platform pilot program. We're excited to have ${agency.name} as one of our launch partners.

### What's Included in Your Pilot Access

- **Full Platform Access**: Complete access to all creator and viewer features
- **Real-time Metrics**: Live dashboard showing performance metrics
- **48-hour Payout SLA**: Guaranteed payout processing within 48 hours
- **Evidence Pack System**: One-click evidence generation for compliance
- **Dedicated Support**: ${agency.requirements.dedicatedSupport ? 'Dedicated Slack Connect channel' : 'Priority support queue'}

### Key Features for Agencies

1. **Creator Onboarding**: Streamlined process for bringing creators to the platform
2. **Revenue Sharing**: Transparent revenue splits with real-time tracking
3. **Compliance Tools**: Built-in 2257, DMCA, and sanctions screening
4. **Analytics Dashboard**: Comprehensive performance and earnings analytics
5. **API Access**: ${agency.requirements.apiAccess ? 'Full API access for integrations' : 'Web-based management tools'}

### Next Steps

1. Review the metrics portal and familiarize yourself with the dashboard
2. ${agency.requirements.apiAccess ? 'Set up API integration using the provided documentation' : 'Explore the web interface'}
3. ${agency.requirements.dedicatedSupport ? 'Join your dedicated Slack Connect channel' : 'Bookmark the support portal'}
4. Begin onboarding your first creators
5. Schedule a check-in call with our team

### Support & Resources

- **Support**: ${agency.supportChannel || 'support@platform.com'}
- **Documentation**: https://docs.platform.com/agencies
- **Status Page**: https://status.platform.com
- **Metrics Portal**: https://metrics.platform.com/agency/${agency.id}

We're here to ensure your success. Don't hesitate to reach out with any questions!
    `.trim();
  }

  private async generateAPIDocumentation(agency: PilotAgency): Promise<string> {
    if (!agency.requirements.apiAccess) {
      return 'API access not included in your plan. Contact support for upgrade options.';
    }

    return `
# API Documentation for ${agency.name}

## Authentication

Your API key: \`${this.generateAPIKey(agency.id)}\`

## Base URL

\`https://api.platform.com/v1\`

## Key Endpoints

### Creator Management
- \`POST /creators\` - Onboard new creator
- \`GET /creators/{id}\` - Get creator details
- \`PUT /creators/{id}\` - Update creator information

### Content Management
- \`GET /content\` - List content
- \`POST /content\` - Upload new content
- \`GET /content/{id}/analytics\` - Get content analytics

### Revenue & Payouts
- \`GET /revenue\` - Get revenue summary
- \`GET /payouts\` - List payouts
- \`POST /payouts\` - Initiate payout

### Compliance
- \`GET /evidence-packs/{id}\` - Download evidence pack
- \`POST /dmca-requests\` - Submit DMCA request
- \`GET /compliance/status\` - Check compliance status

## Rate Limits

- 1000 requests per hour for standard endpoints
- 100 requests per hour for analytics endpoints
- 10 requests per hour for payout endpoints

## Webhooks

Configure webhooks to receive real-time updates:
- Creator onboarding events
- Content upload events
- Payout completion events
- Compliance alerts

## SDKs

- JavaScript/Node.js: \`npm install @platform/api-client\`
- Python: \`pip install platform-api-client\`
- PHP: \`composer require platform/api-client\`

## Support

For API support, contact your dedicated support channel or email api-support@platform.com
    `.trim();
  }

  private async generateMetricsPortalAccess(agency: PilotAgency): Promise<string> {
    return `https://metrics.platform.com/agency/${agency.id}?token=${this.generateAccessToken(agency.id)}`;
  }

  private async generateSupportChannelInvite(agency: PilotAgency): Promise<string> {
    if (!agency.requirements.dedicatedSupport) {
      return 'Standard support available at support@platform.com';
    }

    return `Slack Connect invitation sent to ${agency.contactEmail} for dedicated support channel.`;
  }

  private async generateSampleEvidencePack(agency: PilotAgency): Promise<string> {
    return `
# Sample Evidence Pack for ${agency.name}

## What is an Evidence Pack?

An evidence pack is a comprehensive compliance document that includes:

1. **Content Verification**
   - Original upload timestamps
   - Creator identity verification
   - Age verification records (2257 compliance)
   - Content authenticity certificates

2. **Blockchain Anchoring**
   - Merkle tree root hash: \`0x${Math.random().toString(16).substr(2, 64)}\`
   - Block number: ${Math.floor(Math.random() * 1000000) + 18000000}
   - Transaction hash: \`0x${Math.random().toString(16).substr(2, 64)}\`

3. **Compliance Records**
   - DMCA compliance status
   - Sanctions screening results
   - Content moderation logs
   - Payout verification

## Sample Evidence Pack

**Content ID**: sample-content-123
**Creator**: sample-creator@example.com
**Upload Date**: ${new Date().toISOString()}
**Verification Status**: ✅ Verified
**Compliance Status**: ✅ Compliant

### Blockchain Proof
- **Hash**: \`0x${Math.random().toString(16).substr(2, 64)}\`
- **Timestamp**: ${Math.floor(Date.now() / 1000)}
- **Verification URL**: https://etherscan.io/tx/0x${Math.random().toString(16).substr(2, 64)}

This evidence pack can be generated for any content on the platform with one click.
    `.trim();
  }

  private async generateReferralMaterials(agency: PilotAgency): Promise<string> {
    return `
# Referral & Affiliate Program for ${agency.name}

## Program Overview

Earn additional revenue by referring other agencies and creators to the platform.

### Commission Structure

- **Agency Referrals**: 10% of referred agency's first-year revenue
- **Creator Referrals**: 5% of referred creator's first 6 months revenue
- **Volume Bonuses**: Additional 2-5% for high-volume referrers

### Your Referral Code

\`${agency.name.toUpperCase().replace(/\s+/g, '')}-${agency.id.substr(-6).toUpperCase()}\`

### Marketing Materials

1. **Agency Pitch Deck**: Customized presentation highlighting platform benefits
2. **Creator Onboarding Guide**: Step-by-step guide for new creators
3. **ROI Calculator**: Tool showing potential earnings for prospects
4. **Case Studies**: Success stories from existing partners
5. **Demo Videos**: Platform walkthrough and feature demonstrations

### Tracking & Payouts

- Real-time tracking in your metrics portal
- Monthly payout with your regular revenue share
- Detailed reporting on referral performance
- Attribution tracking for 90 days

### Support Materials

- **Sales Training**: Best practices for agency outreach
- **Technical FAQ**: Common questions and answers
- **Competitive Analysis**: How we compare to other platforms
- **Pricing Sheets**: Transparent pricing for prospects

Contact your support channel for access to all marketing materials.
    `.trim();
  }

  private async generateTrendingExplanation(agency: PilotAgency): Promise<string> {
    return `
# How Trending Works - Transparency for ${agency.name}

## Trending Algorithm Overview

Our trending system is designed to be fair, transparent, and resistant to manipulation.

### Factors Considered

1. **Engagement Velocity** (40% weight)
   - Views per hour in first 24 hours
   - Like/dislike ratio
   - Comment engagement rate
   - Share velocity

2. **Creator Performance** (25% weight)
   - Historical performance
   - Subscriber growth rate
   - Audience retention metrics
   - Content consistency

3. **Content Quality** (20% weight)
   - Video/audio quality scores
   - Content completeness
   - Metadata richness
   - Compliance status

4. **Audience Diversity** (15% weight)
   - Geographic distribution
   - Demographic spread
   - New vs. returning viewers
   - Cross-platform engagement

### Anti-Gaming Measures

- **Bot Detection**: Advanced ML models detect artificial engagement
- **Velocity Limits**: Sudden spikes are flagged for review
- **Quality Thresholds**: Minimum quality standards must be met
- **Human Review**: Trending content undergoes human verification

### Transparency Features

- **Trending Score**: Visible to creators and agencies
- **Factor Breakdown**: Detailed explanation of score components
- **Historical Data**: Track trending performance over time
- **Appeal Process**: Contest trending decisions through support

### Best Practices for Agencies

1. Focus on authentic engagement over raw numbers
2. Encourage creators to optimize for retention, not just views
3. Maintain consistent content quality standards
4. Build genuine communities around creators
5. Use analytics to understand audience preferences

### Trending Categories

- **Rising**: New content gaining momentum
- **Hot**: Currently popular content
- **Sustained**: Content maintaining popularity over time
- **Niche**: Popular within specific categories

This system ensures fair discovery while rewarding quality content and genuine engagement.
    `.trim();
  }

  private generateCustomizations(agency: PilotAgency): Record<string, any> {
    return {
      branding: {
        enabled: agency.requirements.customBranding,
        logoUrl: agency.requirements.customBranding ? `https://assets.platform.com/agencies/${agency.id}/logo.png` : null,
        colorScheme: agency.requirements.customBranding ? 'custom' : 'default'
      },
      whiteLabel: {
        enabled: agency.requirements.whiteLabeling,
        domain: agency.requirements.whiteLabeling ? `${agency.name.toLowerCase().replace(/\s+/g, '')}.platform.com` : null
      },
      sla: agency.requirements.slaRequirements,
      features: {
        apiAccess: agency.requirements.apiAccess,
        dedicatedSupport: agency.requirements.dedicatedSupport,
        customBranding: agency.requirements.customBranding
      }
    };
  }

  // Support and Communication
  private async createSupportChannel(agency: PilotAgency): Promise<string> {
    // Simulate Slack Connect channel creation
    const channelId = `slack-connect-${agency.id}`;
    console.log(`Creating Slack Connect channel for ${agency.name}: ${channelId}`);
    return channelId;
  }

  private async provideAPIAccess(agency: PilotAgency): Promise<void> {
    // Simulate API key generation and access provisioning
    const apiKey = this.generateAPIKey(agency.id);
    console.log(`Generated API key for ${agency.name}: ${apiKey.substr(0, 8)}...`);
  }

  private async sendAgencyInvitation(agency: PilotAgency): Promise<void> {
    // Simulate sending invitation email
    console.log(`Sending invitation to ${agency.contactEmail} for ${agency.name}`);
  }

  // Feedback Management
  public async submitFeedback(
    agencyId: string,
    type: AgencyFeedback['type'],
    category: AgencyFeedback['category'],
    title: string,
    description: string,
    priority: AgencyFeedback['priority'] = 'medium'
  ): Promise<AgencyFeedback> {
    const feedback: AgencyFeedback = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agencyId,
      type,
      category,
      title,
      description,
      priority,
      status: 'open',
      submittedAt: new Date(),
      metadata: {}
    };

    this.feedbackItems.set(feedback.id, feedback);

    // Add to agency feedback list
    const agency = this.pilotAgencies.get(agencyId);
    if (agency) {
      agency.feedback.push(feedback);
      this.pilotAgencies.set(agencyId, agency);
    }

    this.emit('feedbackSubmitted', feedback);
    
    return feedback;
  }

  public async resolveFeedback(feedbackId: string, resolution: string, assignedTo?: string): Promise<boolean> {
    const feedback = this.feedbackItems.get(feedbackId);
    if (!feedback) {
      return false;
    }

    feedback.status = 'resolved';
    feedback.resolvedAt = new Date();
    feedback.resolution = resolution;
    feedback.assignedTo = assignedTo;

    this.feedbackItems.set(feedbackId, feedback);
    
    this.emit('feedbackResolved', feedback);
    
    return true;
  }

  // Metrics and Analytics
  public async updateAgencyMetrics(agencyId: string, metrics: Partial<AgencyMetrics>): Promise<boolean> {
    const agency = this.pilotAgencies.get(agencyId);
    if (!agency) {
      return false;
    }

    agency.metrics = { ...agency.metrics, ...metrics };
    agency.lastActivity = new Date();
    this.pilotAgencies.set(agencyId, agency);

    return true;
  }

  public getSoftLaunchMetrics(): SoftLaunchMetrics {
    const agencies = Array.from(this.pilotAgencies.values());
    const activeAgencies = agencies.filter(a => a.onboardingStatus === 'active');
    const completedOnboarding = agencies.filter(a => a.onboardingStatus === 'completed' || a.onboardingStatus === 'active');

    const totalOnboardingTime = completedOnboarding
      .filter(a => a.onboardedAt)
      .reduce((sum, a) => {
        const days = (a.onboardedAt!.getTime() - a.invitedAt.getTime()) / (1000 * 60 * 60 * 24);
        return sum + days;
      }, 0);

    const avgOnboardingTime = completedOnboarding.length > 0 ? totalOnboardingTime / completedOnboarding.length : 0;

    const satisfactionScores = activeAgencies
      .map(a => a.metrics.satisfactionScore)
      .filter(score => score > 0);
    const overallSatisfaction = satisfactionScores.length > 0 
      ? satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length 
      : 0;

    const criticalFeedback = Array.from(this.feedbackItems.values())
      .filter(f => f.priority === 'critical' && f.status !== 'resolved');

    return {
      totalAgencies: agencies.length,
      activeAgencies: activeAgencies.length,
      onboardingCompletionRate: agencies.length > 0 ? (completedOnboarding.length / agencies.length) * 100 : 0,
      averageOnboardingTime: avgOnboardingTime,
      overallSatisfaction,
      criticalIssues: criticalFeedback.length,
      featureAdoptionRates: this.calculateFeatureAdoptionRates(activeAgencies),
      performanceMetrics: this.calculatePerformanceMetrics(activeAgencies)
    };
  }

  private calculateFeatureAdoptionRates(agencies: PilotAgency[]): Record<string, number> {
    if (agencies.length === 0) return {};

    const features = {
      apiAccess: agencies.filter(a => a.requirements.apiAccess).length,
      customBranding: agencies.filter(a => a.requirements.customBranding).length,
      whiteLabeling: agencies.filter(a => a.requirements.whiteLabeling).length,
      dedicatedSupport: agencies.filter(a => a.requirements.dedicatedSupport).length
    };

    return Object.fromEntries(
      Object.entries(features).map(([feature, count]) => [
        feature,
        (count / agencies.length) * 100
      ])
    );
  }

  private calculatePerformanceMetrics(agencies: PilotAgency[]): SoftLaunchMetrics['performanceMetrics'] {
    if (agencies.length === 0) {
      return {
        averageUptime: 100,
        averageResponseTime: 0,
        averagePayoutTime: 0,
        errorRate: 0
      };
    }

    return {
      averageUptime: agencies.reduce((sum, a) => sum + a.metrics.uptimeExperienced, 0) / agencies.length,
      averageResponseTime: 450, // Simulated
      averagePayoutTime: agencies.reduce((sum, a) => sum + a.metrics.averagePayoutTime, 0) / agencies.length,
      errorRate: agencies.reduce((sum, a) => sum + a.metrics.errorRate, 0) / agencies.length
    };
  }

  // Utility Methods
  private generateAPIKey(agencyId: string): string {
    return `pk_${agencyId}_${Math.random().toString(36).substr(2, 32)}`;
  }

  private generateAccessToken(agencyId: string): string {
    return `at_${agencyId}_${Math.random().toString(36).substr(2, 24)}`;
  }

  // Public API Methods
  public getPilotAgencies(): PilotAgency[] {
    return Array.from(this.pilotAgencies.values());
  }

  public getPilotAgency(agencyId: string): PilotAgency | undefined {
    return this.pilotAgencies.get(agencyId);
  }

  public getOnboardingKit(agencyId: string): OnboardingKit | undefined {
    return Array.from(this.onboardingKits.values()).find(kit => kit.agencyId === agencyId);
  }

  public getAgencyFeedback(agencyId: string): AgencyFeedback[] {
    return Array.from(this.feedbackItems.values()).filter(f => f.agencyId === agencyId);
  }

  public getAllFeedback(): AgencyFeedback[] {
    return Array.from(this.feedbackItems.values());
  }

  // Periodic metrics collection
  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectAgencyMetrics();
    }, 60000); // Every minute
  }

  private async collectAgencyMetrics(): Promise<void> {
    // Simulate metrics collection from various sources
    const activeAgencies = Array.from(this.pilotAgencies.values())
      .filter(a => a.onboardingStatus === 'active');

    for (const agency of activeAgencies) {
      // Simulate metric updates
      const updates: Partial<AgencyMetrics> = {
        apiCalls: agency.metrics.apiCalls + Math.floor(Math.random() * 100),
        errorRate: Math.random() * 0.05, // 0-5% error rate
        uptimeExperienced: 99.5 + Math.random() * 0.5 // 99.5-100% uptime
      };

      await this.updateAgencyMetrics(agency.id, updates);
    }
  }
}

export const agencyOnboardingService = new AgencyOnboardingService();