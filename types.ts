
export type IconName = 
  | 'plus' | 'home' | 'users' | 'flame' | 'search' | 'badge-dollar' | 'users-round'
  | 'bell' | 'mail' | 'user' | 'clock' | 'star' | 'timer' | 'folder' | 'diamond'
  | 'file-dashed' | 'gauge' | 'film' | 'coins' | 'ticket' | 'git-merge' | 'chart'
  | 'shield-check' | 'wallet' | 'banknote' | 'credit-card' | 'settings' | 'plug'
  | 'lifebuoy' | 'activity' | 'broadcast' | 'ballot' | 'safe' | 'gift' | 'person'
  | 'info' | 'video' | 'image' | 'slash-circle' | 'filter' | 'heart' | 'message-circle'
  | 'share' | 'trending-up' | 'eye' | 'play' | 'chevron-right' | 'chevron-left'
  | 'gamepad-2' | 'music' | 'cpu' | 'graduation-cap' | 'tv' | 'trophy' | 'newspaper'
  | 'trending-down' | 'list' | 'grid' | 'check' | 'trash' | 'more-horizontal' | 'x'
  | 'download' | 'pause' | 'volume-x' | 'volume-1' | 'volume-2' | 'minimize' | 'maximize'
  | 'menu' | 'pin' | 'copy' | 'external-link' | 'refresh-cw' | 'loader' | 'alert-circle'
  | 'check-circle' | 'wifi' | 'wifi-off' | 'link' | 'unlink' | 'globe';

export interface SidebarItem {
  id: string;
  label: string;
  icon: IconName;
  route: string;
  role?: 'creator';
}

export interface SidebarGroup {
  id?: string;
  group?: string;
  items: readonly SidebarItem[];
  intent?: 'primary';
  role?: 'creator';
  featureFlag?: boolean;
}

export interface Content {
    id: string;
    title: string;
    creator: string;
    views: string;
    ago: string;
    thumbnail?: string;
    // TikTok-style engagement metrics
    likes?: number;
    comments?: number;
    shares?: number;
    trending?: boolean;
    // YouTube-style algorithm hints
    algorithmHint?: string;
    engagementRate?: number;
}

export interface Video {
    id: string;
    title: string;
    creator: string;
    creatorAvatar: string;
    views: string;
    uploadedAt: string;
    thumbnailUrl: string;
}

export interface VideoShelf {
  shelfTitle: string;
  videos: Video[];
}
// Compliance types
export interface ComplianceReport {
  contentId: string;
  riskScore: RiskScore;
  violations: ComplianceViolation[];
  recommendations: string[];
  evidenceComplete: boolean;
  consentValidation: ConsentValidation;
  documents: ComplianceDocument[];
  analyzedAt: Date;
  nextReviewDate: Date;
}

export interface ConsentValidation {
  contentId: string;
  isValid: boolean;
  anomalies: string[];
  participantCount: number;
  documentsFound: number;
  validatedAt: Date;
}

export interface RiskScore {
  overall: number;
  breakdown: {
    documentCompleteness: number;
    consentValidity: number;
    geoCompliance: number;
    ageVerification: number;
    contentRisk: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  calculatedAt: Date;
}

export interface ComplianceViolation {
  type: 'missing_document' | 'consent_anomaly' | 'expired_document' | 'geo_compliance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
  documentType?: string;
}

export interface ComplianceDocument {
  type: '2257' | 'consent' | 'id_verification' | 'geo_compliance' | 'age_verification';
  documentUrl: string;
  hash: string;
  verified: boolean;
  uploadedAt: Date;
  expiresAt?: Date;
}

export interface ContentMetadata {
  duration: number;
  participants?: Array<{
    id: string;
    name: string;
    age: number;
  }>;
  location?: string;
  uploadDate: string;
  tags?: string[];
  category?: string;
}

// Leak detection types
export interface VideoFingerprint {
  frameHashes: string[];
  audioChroma: number[];
  duration: number;
  resolution: string;
}

export interface LeakMatch {
  id: string;
  contentId: string;
  detectedUrl: string;
  platform: string;
  matchScore: number;
  detectedAt: Date;
  status: 'detected' | 'dmca_sent' | 'removed' | 'disputed';
  evidence: LeakEvidence;
}

export interface LeakEvidence {
  screenshots: string[];
  fingerprintMatch: MatchResult;
  metadata: PlatformMetadata;
}

export interface MatchResult {
  similarity: number;
  frameMatches: number;
  audioMatch: number;
  durationMatch: number;
}

export interface PlatformMetadata {
  title: string;
  duration: number;
  uploadDate: Date;
  platform: string;
}

export interface CrawlResult {
  platform: string;
  success: boolean;
  videosFound: number;
  crawledAt: Date;
  videos?: any[];
  error?: string;
}

// DMCA types
export interface DMCANotice {
  id: string;
  leakId: string;
  contentId: string;
  platform: string;
  targetUrl: string;
  noticeText: string;
  evidence: DMCAEvidence;
  generatedAt: Date;
  status: 'draft' | 'sent' | 'acknowledged' | 'removed' | 'disputed';
  trackingInfo?: {
    sentAt?: Date;
    responseAt?: Date;
    removalAt?: Date;
  };
}

export interface DMCAEvidence {
  screenshots: string[];
  fingerprintData: any;
  compliancePackUrl?: string;
  originalContentProof: string;
  copyrightOwnershipProof: string;
}

// Evidence Pack types
export interface EvidencePack {
  id: string;
  contentId: string;
  generatedAt: Date;
  merkleHash: string;
  documents: ComplianceDocument[];
  riskAssessment: RiskScore;
  validationResults: ConsentValidation[];
  pdfPath: string;
  blockchainTxHash?: string;
}