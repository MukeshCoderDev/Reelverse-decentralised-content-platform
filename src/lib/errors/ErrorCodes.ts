/**
 * Comprehensive error codes for the Reelverse18 platform
 * Organized by domain for easy maintenance and debugging
 */

export enum ErrorCodes {
  // Authentication Errors (AUTH_xxx)
  INVALID_SIGNATURE = 'AUTH_001',
  SESSION_EXPIRED = 'AUTH_002', 
  WALLET_NOT_CONNECTED = 'AUTH_003',
  SIWE_VERIFICATION_FAILED = 'AUTH_004',
  NONCE_EXPIRED = 'AUTH_005',
  UNAUTHORIZED_ACCESS = 'AUTH_006',

  // Age Verification Errors (AGE_xxx)
  AGE_VERIFICATION_REQUIRED = 'AGE_001',
  AGE_VERIFICATION_FAILED = 'AGE_002',
  KYC_PROVIDER_ERROR = 'AGE_003',
  PERSONA_WEBHOOK_ERROR = 'AGE_004',
  UNDERAGE_USER = 'AGE_005',
  VERIFICATION_PENDING = 'AGE_006',

  // Content Access Errors (CONTENT_xxx)
  CONTENT_NOT_FOUND = 'CONTENT_001',
  INSUFFICIENT_ENTITLEMENT = 'CONTENT_002',
  GEO_RESTRICTED = 'CONTENT_003',
  CONTENT_MODERATED = 'CONTENT_004',
  CONTENT_PROCESSING = 'CONTENT_005',
  CONTENT_EXPIRED = 'CONTENT_006',
  WATERMARK_GENERATION_FAILED = 'CONTENT_007',
  PLAYBACK_TOKEN_INVALID = 'CONTENT_008',

  // Payment Errors (PAY_xxx)
  PAYMENT_FAILED = 'PAY_001',
  INSUFFICIENT_BALANCE = 'PAY_002',
  PERMIT_EXPIRED = 'PAY_003',
  FIAT_PROVIDER_ERROR = 'PAY_004',
  TRANSACTION_REVERTED = 'PAY_005',
  NETWORK_CONGESTION = 'PAY_006',
  USDC_APPROVAL_FAILED = 'PAY_007',
  REVENUE_SPLIT_FAILED = 'PAY_008',

  // Upload Errors (UPLOAD_xxx)
  UPLOAD_FAILED = 'UPLOAD_001',
  FILE_TOO_LARGE = 'UPLOAD_002',
  INVALID_FILE_TYPE = 'UPLOAD_003',
  ENCRYPTION_FAILED = 'UPLOAD_004',
  TRANSCODING_FAILED = 'UPLOAD_005',
  STORAGE_QUOTA_EXCEEDED = 'UPLOAD_006',
  PERCEPTUAL_HASH_FAILED = 'UPLOAD_007',
  METADATA_VALIDATION_FAILED = 'UPLOAD_008',

  // Organization Errors (ORG_xxx)
  ORGANIZATION_NOT_FOUND = 'ORG_001',
  INSUFFICIENT_PERMISSIONS = 'ORG_002',
  MEMBER_ALREADY_EXISTS = 'ORG_003',
  MEMBER_NOT_FOUND = 'ORG_004',
  QUOTA_EXCEEDED = 'ORG_005',
  INVALID_ROLE = 'ORG_006',
  ORGANIZATION_INACTIVE = 'ORG_007',

  // Moderation Errors (MOD_xxx)
  MODERATION_REQUIRED = 'MOD_001',
  INVALID_MODERATION_STATUS = 'MOD_002',
  DMCA_MATCH_FOUND = 'MOD_003',
  CONTENT_FLAGGED = 'MOD_004',
  MODERATOR_PERMISSIONS_REQUIRED = 'MOD_005',

  // Compliance Errors (COMP_xxx)
  COMPLIANCE_VIOLATION = 'COMP_001',
  MISSING_2257_RECORDS = 'COMP_002',
  CONSENT_REQUIRED = 'COMP_003',
  CONSENT_REVOKED = 'COMP_004',
  AUDIT_TRAIL_INCOMPLETE = 'COMP_005',
  LEGAL_HOLD_ACTIVE = 'COMP_006',

  // Network/Infrastructure Errors (NET_xxx)
  NETWORK_ERROR = 'NET_001',
  SERVICE_UNAVAILABLE = 'NET_002',
  RATE_LIMIT_EXCEEDED = 'NET_003',
  TIMEOUT_ERROR = 'NET_004',
  DATABASE_ERROR = 'NET_005',
  BLOCKCHAIN_ERROR = 'NET_006',
  IPFS_ERROR = 'NET_007',
  CDN_ERROR = 'NET_008',

  // Generic Errors (GEN_xxx)
  UNKNOWN_ERROR = 'GEN_001',
  VALIDATION_ERROR = 'GEN_002',
  CONFIGURATION_ERROR = 'GEN_003',
  FEATURE_DISABLED = 'GEN_004',
  MAINTENANCE_MODE = 'GEN_005'
}

export interface ErrorDetails {
  code: ErrorCodes;
  message: string;
  userMessage: string;
  action?: string;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
}

export const ERROR_CATALOG: Record<ErrorCodes, ErrorDetails> = {
  // Authentication Errors
  [ErrorCodes.INVALID_SIGNATURE]: {
    code: ErrorCodes.INVALID_SIGNATURE,
    message: 'Invalid wallet signature provided',
    userMessage: 'Wallet signature verification failed. Please try signing again.',
    action: 'Sign Message',
    retryable: true,
    severity: 'medium',
    category: 'Authentication'
  },
  [ErrorCodes.SESSION_EXPIRED]: {
    code: ErrorCodes.SESSION_EXPIRED,
    message: 'User session has expired',
    userMessage: 'Your session has expired. Please reconnect your wallet.',
    action: 'Reconnect Wallet',
    retryable: true,
    severity: 'low',
    category: 'Authentication'
  },
  [ErrorCodes.WALLET_NOT_CONNECTED]: {
    code: ErrorCodes.WALLET_NOT_CONNECTED,
    message: 'Wallet not connected',
    userMessage: 'Please connect your wallet to continue.',
    action: 'Connect Wallet',
    retryable: true,
    severity: 'medium',
    category: 'Authentication'
  },
  [ErrorCodes.SIWE_VERIFICATION_FAILED]: {
    code: ErrorCodes.SIWE_VERIFICATION_FAILED,
    message: 'Sign-In with Ethereum verification failed',
    userMessage: 'Wallet verification failed. Please try again.',
    action: 'Retry Verification',
    retryable: true,
    severity: 'medium',
    category: 'Authentication'
  },
  [ErrorCodes.NONCE_EXPIRED]: {
    code: ErrorCodes.NONCE_EXPIRED,
    message: 'Authentication nonce has expired',
    userMessage: 'Authentication expired. Please try signing in again.',
    action: 'Sign In Again',
    retryable: true,
    severity: 'low',
    category: 'Authentication'
  },
  [ErrorCodes.UNAUTHORIZED_ACCESS]: {
    code: ErrorCodes.UNAUTHORIZED_ACCESS,
    message: 'User lacks required permissions',
    userMessage: 'You don\'t have permission to access this resource.',
    retryable: false,
    severity: 'medium',
    category: 'Authentication'
  },

  // Age Verification Errors
  [ErrorCodes.AGE_VERIFICATION_REQUIRED]: {
    code: ErrorCodes.AGE_VERIFICATION_REQUIRED,
    message: 'Age verification required for adult content',
    userMessage: 'This content is for adults only. Verify once, enjoy everywhere.',
    action: 'Verify Age',
    retryable: true,
    severity: 'medium',
    category: 'Age Verification'
  },
  [ErrorCodes.AGE_VERIFICATION_FAILED]: {
    code: ErrorCodes.AGE_VERIFICATION_FAILED,
    message: 'Age verification process failed',
    userMessage: 'Age verification failed. Please contact support if you believe this is an error.',
    retryable: false,
    severity: 'high',
    category: 'Age Verification'
  },
  [ErrorCodes.KYC_PROVIDER_ERROR]: {
    code: ErrorCodes.KYC_PROVIDER_ERROR,
    message: 'KYC provider service error',
    userMessage: 'Verification service is temporarily unavailable. Please try again later.',
    action: 'Try Again Later',
    retryable: true,
    severity: 'medium',
    category: 'Age Verification'
  },
  [ErrorCodes.PERSONA_WEBHOOK_ERROR]: {
    code: ErrorCodes.PERSONA_WEBHOOK_ERROR,
    message: 'Persona webhook processing failed',
    userMessage: 'Verification processing failed. Please contact support.',
    retryable: false,
    severity: 'high',
    category: 'Age Verification'
  },
  [ErrorCodes.UNDERAGE_USER]: {
    code: ErrorCodes.UNDERAGE_USER,
    message: 'User is under required age limit',
    userMessage: 'You must be 18 or older to access this platform.',
    retryable: false,
    severity: 'high',
    category: 'Age Verification'
  },
  [ErrorCodes.VERIFICATION_PENDING]: {
    code: ErrorCodes.VERIFICATION_PENDING,
    message: 'Age verification is still pending',
    userMessage: 'Your age verification is being processed. This usually takes a few minutes.',
    retryable: true,
    severity: 'low',
    category: 'Age Verification'
  },

  // Content Access Errors
  [ErrorCodes.CONTENT_NOT_FOUND]: {
    code: ErrorCodes.CONTENT_NOT_FOUND,
    message: 'Requested content does not exist',
    userMessage: 'This content is no longer available.',
    retryable: false,
    severity: 'low',
    category: 'Content Access'
  },
  [ErrorCodes.INSUFFICIENT_ENTITLEMENT]: {
    code: ErrorCodes.INSUFFICIENT_ENTITLEMENT,
    message: 'User lacks required entitlement for content',
    userMessage: 'Support this creator and unlock exclusive content.',
    action: 'Purchase Access',
    retryable: true,
    severity: 'medium',
    category: 'Content Access'
  },
  [ErrorCodes.GEO_RESTRICTED]: {
    code: ErrorCodes.GEO_RESTRICTED,
    message: 'Content is geo-restricted in user location',
    userMessage: 'This content is not available in your location due to local regulations.',
    retryable: false,
    severity: 'medium',
    category: 'Content Access'
  },
  [ErrorCodes.CONTENT_MODERATED]: {
    code: ErrorCodes.CONTENT_MODERATED,
    message: 'Content has been moderated and is unavailable',
    userMessage: 'This content is currently under review and temporarily unavailable.',
    retryable: false,
    severity: 'medium',
    category: 'Content Access'
  },
  [ErrorCodes.CONTENT_PROCESSING]: {
    code: ErrorCodes.CONTENT_PROCESSING,
    message: 'Content is still being processed',
    userMessage: 'This content is still being processed. Please check back in a few minutes.',
    action: 'Refresh',
    retryable: true,
    severity: 'low',
    category: 'Content Access'
  },
  [ErrorCodes.CONTENT_EXPIRED]: {
    code: ErrorCodes.CONTENT_EXPIRED,
    message: 'Content access has expired',
    userMessage: 'Your access to this content has expired.',
    action: 'Renew Access',
    retryable: true,
    severity: 'medium',
    category: 'Content Access'
  },
  [ErrorCodes.WATERMARK_GENERATION_FAILED]: {
    code: ErrorCodes.WATERMARK_GENERATION_FAILED,
    message: 'Failed to generate content watermark',
    userMessage: 'Unable to prepare content for playback. Please try again.',
    action: 'Retry',
    retryable: true,
    severity: 'medium',
    category: 'Content Access'
  },
  [ErrorCodes.PLAYBACK_TOKEN_INVALID]: {
    code: ErrorCodes.PLAYBACK_TOKEN_INVALID,
    message: 'Playback token is invalid or expired',
    userMessage: 'Playback session expired. Please refresh and try again.',
    action: 'Refresh',
    retryable: true,
    severity: 'low',
    category: 'Content Access'
  },

  // Payment Errors
  [ErrorCodes.PAYMENT_FAILED]: {
    code: ErrorCodes.PAYMENT_FAILED,
    message: 'Payment transaction failed',
    userMessage: 'Payment failed. Please check your wallet and try again.',
    action: 'Try Again',
    retryable: true,
    severity: 'high',
    category: 'Payment'
  },
  [ErrorCodes.INSUFFICIENT_BALANCE]: {
    code: ErrorCodes.INSUFFICIENT_BALANCE,
    message: 'Insufficient balance for transaction',
    userMessage: 'Insufficient funds in your wallet. Please add funds and try again.',
    action: 'Add Funds',
    retryable: true,
    severity: 'medium',
    category: 'Payment'
  },
  [ErrorCodes.PERMIT_EXPIRED]: {
    code: ErrorCodes.PERMIT_EXPIRED,
    message: 'USDC permit signature has expired',
    userMessage: 'Payment authorization expired. Please try the purchase again.',
    action: 'Retry Purchase',
    retryable: true,
    severity: 'medium',
    category: 'Payment'
  },
  [ErrorCodes.FIAT_PROVIDER_ERROR]: {
    code: ErrorCodes.FIAT_PROVIDER_ERROR,
    message: 'Fiat payment provider error',
    userMessage: 'Payment service is temporarily unavailable. Please try crypto payment or try again later.',
    action: 'Try Crypto Payment',
    retryable: true,
    severity: 'medium',
    category: 'Payment'
  },
  [ErrorCodes.TRANSACTION_REVERTED]: {
    code: ErrorCodes.TRANSACTION_REVERTED,
    message: 'Blockchain transaction was reverted',
    userMessage: 'Transaction failed on the blockchain. Please try again with higher gas.',
    action: 'Retry with Higher Gas',
    retryable: true,
    severity: 'medium',
    category: 'Payment'
  },
  [ErrorCodes.NETWORK_CONGESTION]: {
    code: ErrorCodes.NETWORK_CONGESTION,
    message: 'Blockchain network is congested',
    userMessage: 'Network is busy. Transaction may take longer than usual.',
    retryable: true,
    severity: 'low',
    category: 'Payment'
  },
  [ErrorCodes.USDC_APPROVAL_FAILED]: {
    code: ErrorCodes.USDC_APPROVAL_FAILED,
    message: 'USDC token approval failed',
    userMessage: 'Failed to approve USDC spending. Please try again.',
    action: 'Retry Approval',
    retryable: true,
    severity: 'medium',
    category: 'Payment'
  },
  [ErrorCodes.REVENUE_SPLIT_FAILED]: {
    code: ErrorCodes.REVENUE_SPLIT_FAILED,
    message: 'Revenue split execution failed',
    userMessage: 'Payment processing failed. Please contact support.',
    retryable: false,
    severity: 'critical',
    category: 'Payment'
  },

  // Upload Errors
  [ErrorCodes.UPLOAD_FAILED]: {
    code: ErrorCodes.UPLOAD_FAILED,
    message: 'File upload failed',
    userMessage: 'Upload failed. Please check your connection and try again.',
    action: 'Retry Upload',
    retryable: true,
    severity: 'medium',
    category: 'Upload'
  },
  [ErrorCodes.FILE_TOO_LARGE]: {
    code: ErrorCodes.FILE_TOO_LARGE,
    message: 'File exceeds maximum size limit',
    userMessage: 'File is too large. Please compress or choose a smaller file.',
    retryable: false,
    severity: 'medium',
    category: 'Upload'
  },
  [ErrorCodes.INVALID_FILE_TYPE]: {
    code: ErrorCodes.INVALID_FILE_TYPE,
    message: 'File type is not supported',
    userMessage: 'File type not supported. Please use MP4, MOV, or AVI format.',
    retryable: false,
    severity: 'medium',
    category: 'Upload'
  },
  [ErrorCodes.ENCRYPTION_FAILED]: {
    code: ErrorCodes.ENCRYPTION_FAILED,
    message: 'File encryption failed during upload',
    userMessage: 'Upload processing failed. Please try again.',
    action: 'Retry Upload',
    retryable: true,
    severity: 'high',
    category: 'Upload'
  },
  [ErrorCodes.TRANSCODING_FAILED]: {
    code: ErrorCodes.TRANSCODING_FAILED,
    message: 'Video transcoding failed',
    userMessage: 'Video processing failed. Please check the file and try again.',
    action: 'Try Different File',
    retryable: true,
    severity: 'high',
    category: 'Upload'
  },
  [ErrorCodes.STORAGE_QUOTA_EXCEEDED]: {
    code: ErrorCodes.STORAGE_QUOTA_EXCEEDED,
    message: 'User storage quota exceeded',
    userMessage: 'Storage limit reached. Please delete some content or upgrade your plan.',
    action: 'Manage Storage',
    retryable: false,
    severity: 'medium',
    category: 'Upload'
  },
  [ErrorCodes.PERCEPTUAL_HASH_FAILED]: {
    code: ErrorCodes.PERCEPTUAL_HASH_FAILED,
    message: 'Perceptual hash generation failed',
    userMessage: 'Content analysis failed. Please try uploading again.',
    action: 'Retry Upload',
    retryable: true,
    severity: 'medium',
    category: 'Upload'
  },
  [ErrorCodes.METADATA_VALIDATION_FAILED]: {
    code: ErrorCodes.METADATA_VALIDATION_FAILED,
    message: 'Content metadata validation failed',
    userMessage: 'Please check all required fields and try again.',
    retryable: true,
    severity: 'medium',
    category: 'Upload'
  },

  // Organization Errors
  [ErrorCodes.ORGANIZATION_NOT_FOUND]: {
    code: ErrorCodes.ORGANIZATION_NOT_FOUND,
    message: 'Organization does not exist',
    userMessage: 'Organization not found.',
    retryable: false,
    severity: 'medium',
    category: 'Organization'
  },
  [ErrorCodes.INSUFFICIENT_PERMISSIONS]: {
    code: ErrorCodes.INSUFFICIENT_PERMISSIONS,
    message: 'User lacks required organization permissions',
    userMessage: 'You don\'t have permission to perform this action.',
    retryable: false,
    severity: 'medium',
    category: 'Organization'
  },
  [ErrorCodes.MEMBER_ALREADY_EXISTS]: {
    code: ErrorCodes.MEMBER_ALREADY_EXISTS,
    message: 'User is already a member of the organization',
    userMessage: 'This user is already a member of the organization.',
    retryable: false,
    severity: 'low',
    category: 'Organization'
  },
  [ErrorCodes.MEMBER_NOT_FOUND]: {
    code: ErrorCodes.MEMBER_NOT_FOUND,
    message: 'Organization member not found',
    userMessage: 'Member not found in this organization.',
    retryable: false,
    severity: 'low',
    category: 'Organization'
  },
  [ErrorCodes.QUOTA_EXCEEDED]: {
    code: ErrorCodes.QUOTA_EXCEEDED,
    message: 'User has exceeded their upload quota',
    userMessage: 'Upload quota exceeded. Please contact your organization admin.',
    retryable: false,
    severity: 'medium',
    category: 'Organization'
  },
  [ErrorCodes.INVALID_ROLE]: {
    code: ErrorCodes.INVALID_ROLE,
    message: 'Invalid organization role specified',
    userMessage: 'Invalid role specified.',
    retryable: false,
    severity: 'medium',
    category: 'Organization'
  },
  [ErrorCodes.ORGANIZATION_INACTIVE]: {
    code: ErrorCodes.ORGANIZATION_INACTIVE,
    message: 'Organization is inactive',
    userMessage: 'This organization is currently inactive.',
    retryable: false,
    severity: 'medium',
    category: 'Organization'
  },

  // Moderation Errors
  [ErrorCodes.MODERATION_REQUIRED]: {
    code: ErrorCodes.MODERATION_REQUIRED,
    message: 'Content requires moderation approval',
    userMessage: 'Content is pending moderation review.',
    retryable: false,
    severity: 'low',
    category: 'Moderation'
  },
  [ErrorCodes.INVALID_MODERATION_STATUS]: {
    code: ErrorCodes.INVALID_MODERATION_STATUS,
    message: 'Invalid moderation status provided',
    userMessage: 'Invalid moderation status.',
    retryable: false,
    severity: 'medium',
    category: 'Moderation'
  },
  [ErrorCodes.DMCA_MATCH_FOUND]: {
    code: ErrorCodes.DMCA_MATCH_FOUND,
    message: 'Content matches existing DMCA claim',
    userMessage: 'This content appears to match copyrighted material.',
    retryable: false,
    severity: 'high',
    category: 'Moderation'
  },
  [ErrorCodes.CONTENT_FLAGGED]: {
    code: ErrorCodes.CONTENT_FLAGGED,
    message: 'Content has been flagged for review',
    userMessage: 'This content has been flagged and is under review.',
    retryable: false,
    severity: 'medium',
    category: 'Moderation'
  },
  [ErrorCodes.MODERATOR_PERMISSIONS_REQUIRED]: {
    code: ErrorCodes.MODERATOR_PERMISSIONS_REQUIRED,
    message: 'Moderator permissions required',
    userMessage: 'You need moderator permissions to perform this action.',
    retryable: false,
    severity: 'medium',
    category: 'Moderation'
  },

  // Compliance Errors
  [ErrorCodes.COMPLIANCE_VIOLATION]: {
    code: ErrorCodes.COMPLIANCE_VIOLATION,
    message: 'Content violates compliance requirements',
    userMessage: 'Content does not meet compliance requirements.',
    retryable: false,
    severity: 'high',
    category: 'Compliance'
  },
  [ErrorCodes.MISSING_2257_RECORDS]: {
    code: ErrorCodes.MISSING_2257_RECORDS,
    message: 'Required 2257 records are missing',
    userMessage: 'Missing required age verification records.',
    retryable: true,
    severity: 'high',
    category: 'Compliance'
  },
  [ErrorCodes.CONSENT_REQUIRED]: {
    code: ErrorCodes.CONSENT_REQUIRED,
    message: 'Participant consent is required',
    userMessage: 'All participants must provide consent before publishing.',
    action: 'Collect Consent',
    retryable: true,
    severity: 'high',
    category: 'Compliance'
  },
  [ErrorCodes.CONSENT_REVOKED]: {
    code: ErrorCodes.CONSENT_REVOKED,
    message: 'Participant consent has been revoked',
    userMessage: 'Consent has been revoked for this content.',
    retryable: false,
    severity: 'critical',
    category: 'Compliance'
  },
  [ErrorCodes.AUDIT_TRAIL_INCOMPLETE]: {
    code: ErrorCodes.AUDIT_TRAIL_INCOMPLETE,
    message: 'Audit trail is incomplete',
    userMessage: 'Compliance audit trail is incomplete.',
    retryable: false,
    severity: 'high',
    category: 'Compliance'
  },
  [ErrorCodes.LEGAL_HOLD_ACTIVE]: {
    code: ErrorCodes.LEGAL_HOLD_ACTIVE,
    message: 'Content is under legal hold',
    userMessage: 'This content is subject to a legal hold and cannot be modified.',
    retryable: false,
    severity: 'critical',
    category: 'Compliance'
  },

  // Network/Infrastructure Errors
  [ErrorCodes.NETWORK_ERROR]: {
    code: ErrorCodes.NETWORK_ERROR,
    message: 'Network connection error',
    userMessage: 'Network error. Please check your connection and try again.',
    action: 'Retry',
    retryable: true,
    severity: 'medium',
    category: 'Network'
  },
  [ErrorCodes.SERVICE_UNAVAILABLE]: {
    code: ErrorCodes.SERVICE_UNAVAILABLE,
    message: 'Service is temporarily unavailable',
    userMessage: 'Service is temporarily unavailable. Please try again later.',
    action: 'Try Again Later',
    retryable: true,
    severity: 'medium',
    category: 'Network'
  },
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: {
    code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    message: 'Rate limit exceeded',
    userMessage: 'Too many requests. Please wait a moment and try again.',
    action: 'Wait and Retry',
    retryable: true,
    severity: 'low',
    category: 'Network'
  },
  [ErrorCodes.TIMEOUT_ERROR]: {
    code: ErrorCodes.TIMEOUT_ERROR,
    message: 'Request timed out',
    userMessage: 'Request timed out. Please try again.',
    action: 'Retry',
    retryable: true,
    severity: 'medium',
    category: 'Network'
  },
  [ErrorCodes.DATABASE_ERROR]: {
    code: ErrorCodes.DATABASE_ERROR,
    message: 'Database operation failed',
    userMessage: 'A temporary error occurred. Please try again.',
    action: 'Retry',
    retryable: true,
    severity: 'high',
    category: 'Network'
  },
  [ErrorCodes.BLOCKCHAIN_ERROR]: {
    code: ErrorCodes.BLOCKCHAIN_ERROR,
    message: 'Blockchain operation failed',
    userMessage: 'Blockchain error. Please try again or contact support.',
    action: 'Retry',
    retryable: true,
    severity: 'high',
    category: 'Network'
  },
  [ErrorCodes.IPFS_ERROR]: {
    code: ErrorCodes.IPFS_ERROR,
    message: 'IPFS operation failed',
    userMessage: 'Storage error. Please try again.',
    action: 'Retry',
    retryable: true,
    severity: 'medium',
    category: 'Network'
  },
  [ErrorCodes.CDN_ERROR]: {
    code: ErrorCodes.CDN_ERROR,
    message: 'CDN delivery failed',
    userMessage: 'Content delivery error. Please refresh and try again.',
    action: 'Refresh',
    retryable: true,
    severity: 'medium',
    category: 'Network'
  },

  // Generic Errors
  [ErrorCodes.UNKNOWN_ERROR]: {
    code: ErrorCodes.UNKNOWN_ERROR,
    message: 'An unknown error occurred',
    userMessage: 'An unexpected error occurred. Please try again or contact support.',
    action: 'Contact Support',
    retryable: true,
    severity: 'high',
    category: 'Generic'
  },
  [ErrorCodes.VALIDATION_ERROR]: {
    code: ErrorCodes.VALIDATION_ERROR,
    message: 'Input validation failed',
    userMessage: 'Please check your input and try again.',
    retryable: true,
    severity: 'medium',
    category: 'Generic'
  },
  [ErrorCodes.CONFIGURATION_ERROR]: {
    code: ErrorCodes.CONFIGURATION_ERROR,
    message: 'System configuration error',
    userMessage: 'System configuration error. Please contact support.',
    retryable: false,
    severity: 'critical',
    category: 'Generic'
  },
  [ErrorCodes.FEATURE_DISABLED]: {
    code: ErrorCodes.FEATURE_DISABLED,
    message: 'Feature is currently disabled',
    userMessage: 'This feature is currently unavailable.',
    retryable: false,
    severity: 'low',
    category: 'Generic'
  },
  [ErrorCodes.MAINTENANCE_MODE]: {
    code: ErrorCodes.MAINTENANCE_MODE,
    message: 'System is in maintenance mode',
    userMessage: 'System is under maintenance. Please try again later.',
    retryable: true,
    severity: 'medium',
    category: 'Generic'
  }
};