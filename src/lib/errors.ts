// Comprehensive error handling system for Reelverse18

export enum ErrorCodes {
  // Authentication Errors
  INVALID_SIGNATURE = 'AUTH_001',
  SESSION_EXPIRED = 'AUTH_002',
  WALLET_NOT_CONNECTED = 'AUTH_003',
  SIWE_VERIFICATION_FAILED = 'AUTH_004',
  
  // Age Verification Errors
  AGE_VERIFICATION_REQUIRED = 'AGE_001',
  AGE_VERIFICATION_FAILED = 'AGE_002',
  KYC_PROVIDER_ERROR = 'AGE_003',
  PERSONA_WEBHOOK_ERROR = 'AGE_004',
  
  // Content Access Errors
  CONTENT_NOT_FOUND = 'CONTENT_001',
  INSUFFICIENT_ENTITLEMENT = 'CONTENT_002',
  GEO_RESTRICTED = 'CONTENT_003',
  CONTENT_MODERATED = 'CONTENT_004',
  CONTENT_PROCESSING = 'CONTENT_005',
  
  // Payment Errors
  PAYMENT_FAILED = 'PAY_001',
  INSUFFICIENT_BALANCE = 'PAY_002',
  PERMIT_EXPIRED = 'PAY_003',
  FIAT_PROVIDER_ERROR = 'PAY_004',
  USDC_TRANSFER_FAILED = 'PAY_005',
  
  // Upload Errors
  UPLOAD_FAILED = 'UPLOAD_001',
  FILE_TOO_LARGE = 'UPLOAD_002',
  INVALID_FILE_TYPE = 'UPLOAD_003',
  ENCRYPTION_FAILED = 'UPLOAD_004',
  TRANSCODING_FAILED = 'UPLOAD_005',
  
  // Organization Errors
  ORG_NOT_FOUND = 'ORG_001',
  INSUFFICIENT_PERMISSIONS = 'ORG_002',
  QUOTA_EXCEEDED = 'ORG_003',
  MEMBER_NOT_FOUND = 'ORG_004',
  
  // Blockchain Errors
  TRANSACTION_FAILED = 'CHAIN_001',
  NETWORK_ERROR = 'CHAIN_002',
  CONTRACT_ERROR = 'CHAIN_003',
  GAS_ESTIMATION_FAILED = 'CHAIN_004',
  
  // System Errors
  INTERNAL_SERVER_ERROR = 'SYS_001',
  SERVICE_UNAVAILABLE = 'SYS_002',
  RATE_LIMIT_EXCEEDED = 'SYS_003',
  MAINTENANCE_MODE = 'SYS_004'
}

export interface APIError {
  code: ErrorCodes;
  message: string;
  details?: any;
  timestamp: number;
  requestId: string;
  retryable: boolean;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  action?: string;
  actionUrl?: string;
  retryable: boolean;
}

export const ERROR_MESSAGES: Record<ErrorCodes, UserFriendlyError> = {
  // Authentication
  [ErrorCodes.INVALID_SIGNATURE]: {
    title: "Invalid Signature",
    message: "Please sign the message with your wallet to continue.",
    action: "Try Again",
    retryable: true
  },
  [ErrorCodes.SESSION_EXPIRED]: {
    title: "Session Expired",
    message: "Your session has expired. Please reconnect your wallet.",
    action: "Reconnect Wallet",
    retryable: true
  },
  [ErrorCodes.WALLET_NOT_CONNECTED]: {
    title: "Wallet Required",
    message: "Connect your wallet to access this feature.",
    action: "Connect Wallet",
    retryable: true
  },
  [ErrorCodes.SIWE_VERIFICATION_FAILED]: {
    title: "Verification Failed",
    message: "Unable to verify your wallet signature. Please try again.",
    action: "Retry",
    retryable: true
  },
  
  // Age Verification
  [ErrorCodes.AGE_VERIFICATION_REQUIRED]: {
    title: "Age Verification Required",
    message: "This content is for adults only. Verify once, enjoy everywhere.",
    action: "Verify Age",
    actionUrl: "/verify",
    retryable: false
  },
  [ErrorCodes.AGE_VERIFICATION_FAILED]: {
    title: "Verification Failed",
    message: "Age verification was unsuccessful. Please contact support if you believe this is an error.",
    action: "Contact Support",
    actionUrl: "/support",
    retryable: false
  },
  [ErrorCodes.KYC_PROVIDER_ERROR]: {
    title: "Verification Service Error",
    message: "Our verification service is temporarily unavailable. Please try again later.",
    action: "Try Again",
    retryable: true
  },
  [ErrorCodes.PERSONA_WEBHOOK_ERROR]: {
    title: "Verification Processing",
    message: "Your verification is being processed. This may take a few minutes.",
    retryable: false
  },
  
  // Content Access
  [ErrorCodes.CONTENT_NOT_FOUND]: {
    title: "Content Not Found",
    message: "This content doesn't exist or has been removed.",
    retryable: false
  },
  [ErrorCodes.INSUFFICIENT_ENTITLEMENT]: {
    title: "Premium Content",
    message: "Support this creator and unlock exclusive content.",
    action: "Purchase Access",
    retryable: false
  },
  [ErrorCodes.GEO_RESTRICTED]: {
    title: "Not Available in Your Region",
    message: "This content is not available in your location due to local regulations.",
    retryable: false
  },
  [ErrorCodes.CONTENT_MODERATED]: {
    title: "Content Under Review",
    message: "This content is currently under moderation review.",
    retryable: false
  },
  [ErrorCodes.CONTENT_PROCESSING]: {
    title: "Content Processing",
    message: "This content is still being processed. Please check back in a few minutes.",
    action: "Refresh",
    retryable: true
  },
  
  // Payments
  [ErrorCodes.PAYMENT_FAILED]: {
    title: "Payment Failed",
    message: "Your payment could not be processed. Please try again or use a different payment method.",
    action: "Try Again",
    retryable: true
  },
  [ErrorCodes.INSUFFICIENT_BALANCE]: {
    title: "Insufficient Balance",
    message: "You don't have enough USDC to complete this purchase.",
    action: "Add Funds",
    retryable: false
  },
  [ErrorCodes.PERMIT_EXPIRED]: {
    title: "Transaction Expired",
    message: "Your transaction approval has expired. Please try again.",
    action: "Retry Payment",
    retryable: true
  },
  [ErrorCodes.FIAT_PROVIDER_ERROR]: {
    title: "Payment Service Error",
    message: "Our payment service is temporarily unavailable. Please try again later.",
    action: "Try Again",
    retryable: true
  },
  [ErrorCodes.USDC_TRANSFER_FAILED]: {
    title: "Transfer Failed",
    message: "USDC transfer failed. Please check your wallet and try again.",
    action: "Retry",
    retryable: true
  },
  
  // Upload
  [ErrorCodes.UPLOAD_FAILED]: {
    title: "Upload Failed",
    message: "Your file could not be uploaded. Please check your connection and try again.",
    action: "Try Again",
    retryable: true
  },
  [ErrorCodes.FILE_TOO_LARGE]: {
    title: "File Too Large",
    message: "Your file exceeds the maximum size limit. Please compress or choose a smaller file.",
    retryable: false
  },
  [ErrorCodes.INVALID_FILE_TYPE]: {
    title: "Invalid File Type",
    message: "This file type is not supported. Please upload a video file (MP4, MOV, AVI).",
    retryable: false
  },
  [ErrorCodes.ENCRYPTION_FAILED]: {
    title: "Processing Error",
    message: "File encryption failed. Please try uploading again.",
    action: "Try Again",
    retryable: true
  },
  [ErrorCodes.TRANSCODING_FAILED]: {
    title: "Processing Error",
    message: "Video processing failed. Please try a different file or contact support.",
    action: "Contact Support",
    actionUrl: "/support",
    retryable: false
  },
  
  // Organization
  [ErrorCodes.ORG_NOT_FOUND]: {
    title: "Organization Not Found",
    message: "The requested organization doesn't exist or you don't have access.",
    retryable: false
  },
  [ErrorCodes.INSUFFICIENT_PERMISSIONS]: {
    title: "Access Denied",
    message: "You don't have permission to perform this action.",
    retryable: false
  },
  [ErrorCodes.QUOTA_EXCEEDED]: {
    title: "Upload Quota Exceeded",
    message: "You've reached your upload limit. Contact your organization admin for more quota.",
    action: "Contact Admin",
    retryable: false
  },
  [ErrorCodes.MEMBER_NOT_FOUND]: {
    title: "Member Not Found",
    message: "The requested member is not part of this organization.",
    retryable: false
  },
  
  // Blockchain
  [ErrorCodes.TRANSACTION_FAILED]: {
    title: "Transaction Failed",
    message: "Your blockchain transaction failed. Please try again with higher gas.",
    action: "Try Again",
    retryable: true
  },
  [ErrorCodes.NETWORK_ERROR]: {
    title: "Network Error",
    message: "Unable to connect to the blockchain. Please check your connection.",
    action: "Retry",
    retryable: true
  },
  [ErrorCodes.CONTRACT_ERROR]: {
    title: "Smart Contract Error",
    message: "The smart contract operation failed. Please try again.",
    action: "Try Again",
    retryable: true
  },
  [ErrorCodes.GAS_ESTIMATION_FAILED]: {
    title: "Gas Estimation Failed",
    message: "Unable to estimate transaction cost. Please try again.",
    action: "Retry",
    retryable: true
  },
  
  // System
  [ErrorCodes.INTERNAL_SERVER_ERROR]: {
    title: "Server Error",
    message: "Something went wrong on our end. Please try again later.",
    action: "Try Again",
    retryable: true
  },
  [ErrorCodes.SERVICE_UNAVAILABLE]: {
    title: "Service Unavailable",
    message: "This service is temporarily unavailable. Please try again later.",
    action: "Try Again",
    retryable: true
  },
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: {
    title: "Too Many Requests",
    message: "You're making requests too quickly. Please wait a moment and try again.",
    action: "Wait and Retry",
    retryable: true
  },
  [ErrorCodes.MAINTENANCE_MODE]: {
    title: "Maintenance Mode",
    message: "The platform is currently under maintenance. Please check back soon.",
    retryable: false
  }
};

export class ReelverseError extends Error {
  public readonly code: ErrorCodes;
  public readonly details?: any;
  public readonly timestamp: number;
  public readonly requestId: string;
  public readonly retryable: boolean;

  constructor(
    code: ErrorCodes,
    message?: string,
    details?: any,
    requestId?: string
  ) {
    const errorInfo = ERROR_MESSAGES[code];
    super(message || errorInfo.message);
    
    this.name = 'ReelverseError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
    this.requestId = requestId || generateRequestId();
    this.retryable = errorInfo.retryable;
  }

  toJSON(): APIError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
      retryable: this.retryable
    };
  }

  getUserFriendlyMessage(): UserFriendlyError {
    return ERROR_MESSAGES[this.code];
  }
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Utility functions for error handling
export function isRetryableError(error: any): boolean {
  if (error instanceof ReelverseError) {
    return error.retryable;
  }
  
  // Check for common retryable errors
  if (error.code === 'NETWORK_ERROR' || 
      error.code === 'TIMEOUT' ||
      error.message?.includes('timeout') ||
      error.message?.includes('network')) {
    return true;
  }
  
  return false;
}

export function getErrorCode(error: any): ErrorCodes {
  if (error instanceof ReelverseError) {
    return error.code;
  }
  
  // Map common error patterns to error codes
  if (error.message?.includes('signature')) {
    return ErrorCodes.INVALID_SIGNATURE;
  }
  
  if (error.message?.includes('network') || error.code === 'NETWORK_ERROR') {
    return ErrorCodes.NETWORK_ERROR;
  }
  
  if (error.message?.includes('gas')) {
    return ErrorCodes.GAS_ESTIMATION_FAILED;
  }
  
  return ErrorCodes.INTERNAL_SERVER_ERROR;
}