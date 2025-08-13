import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { 
  ContentAccessService, 
  AccessCheckResult, 
  ContentRequirements,
  PlaybackTokenResult 
} from '../../services/contentAccessService';

export interface UseContentAccessReturn {
  // Access state
  accessResult: AccessCheckResult | null;
  requirements: ContentRequirements | null;
  playbackData: PlaybackTokenResult | null;
  
  // Loading states
  loading: boolean;
  requirementsLoading: boolean;
  
  // Error states
  error: string | null;
  
  // Computed states
  hasAccess: boolean;
  needsAgeVerification: boolean;
  needsEntitlement: boolean;
  isGeographicallyRestricted: boolean;
  
  // Actions
  checkAccess: () => Promise<void>;
  getPlaybackToken: () => Promise<PlaybackTokenResult | null>;
  refreshAccess: () => Promise<void>;
  clearError: () => void;
  
  // Utilities
  getAccessMessage: () => string;
  getSuggestedActions: () => Array<{ action: string; label: string; type: 'primary' | 'secondary' }>;
  getTimeRemaining: () => number;
}

export const useContentAccess = (contentId: string): UseContentAccessReturn => {
  const { account, isConnected } = useWallet();
  const [accessResult, setAccessResult] = useState<AccessCheckResult | null>(null);
  const [requirements, setRequirements] = useState<ContentRequirements | null>(null);
  const [playbackData, setPlaybackData] = useState<PlaybackTokenResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [requirementsLoading, setRequirementsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => ContentAccessService.getInstance().generateSessionId());
  
  const contentAccessService = ContentAccessService.getInstance();

  // Load requirements when contentId changes
  useEffect(() => {
    if (contentId) {
      loadRequirements();
    }
  }, [contentId]);

  // Check access when account or contentId changes
  useEffect(() => {
    if (isConnected && account && contentId) {
      checkAccess();
    } else {
      setAccessResult(null);
      setPlaybackData(null);
    }
  }, [contentId, account, isConnected]);

  const loadRequirements = async () => {
    try {
      setRequirementsLoading(true);
      const reqs = await contentAccessService.getContentRequirements(contentId);
      setRequirements(reqs);
    } catch (error: any) {
      console.error('Error loading requirements:', error);
      setError(error.message);
    } finally {
      setRequirementsLoading(false);
    }
  };

  const checkAccess = useCallback(async () => {
    if (!account || !contentId) return;

    try {
      setLoading(true);
      setError(null);

      const result = await contentAccessService.checkAccess({
        contentId,
        userAddress: account,
        sessionId
      });

      setAccessResult(result);
    } catch (error: any) {
      setError(error.message);
      setAccessResult(null);
    } finally {
      setLoading(false);
    }
  }, [account, contentId, sessionId]);

  const getPlaybackToken = useCallback(async (): Promise<PlaybackTokenResult | null> => {
    if (!account || !contentId || !accessResult?.allowed || !accessResult.accessToken) {
      return null;
    }

    try {
      const tokenData = await contentAccessService.getPlaybackToken({
        contentId,
        userAddress: account,
        accessToken: accessResult.accessToken,
        sessionId
      });

      setPlaybackData(tokenData);
      return tokenData;
    } catch (error: any) {
      setError(error.message);
      return null;
    }
  }, [account, contentId, accessResult, sessionId]);

  const refreshAccess = useCallback(async () => {
    await checkAccess();
    if (accessResult?.allowed) {
      await getPlaybackToken();
    }
  }, [checkAccess, getPlaybackToken, accessResult]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Computed states
  const hasAccess = accessResult?.allowed || false;
  
  const needsAgeVerification = accessResult?.reasons.some(
    reason => reason.type === 'age_verification'
  ) || false;
  
  const needsEntitlement = accessResult?.reasons.some(
    reason => reason.type === 'entitlement_required'
  ) || false;
  
  const isGeographicallyRestricted = accessResult?.reasons.some(
    reason => reason.type === 'geographic_restriction'
  ) || false;

  // Utility functions
  const getAccessMessage = useCallback((): string => {
    if (!accessResult) return 'Checking access...';
    if (accessResult.allowed) return 'Access granted';
    return contentAccessService.getAccessDenialMessage(accessResult.reasons);
  }, [accessResult]);

  const getSuggestedActions = useCallback(() => {
    if (!accessResult || accessResult.allowed) return [];
    return contentAccessService.getSuggestedActions(accessResult.reasons);
  }, [accessResult]);

  const getTimeRemaining = useCallback((): number => {
    if (!accessResult?.expiresAt) return 0;
    return contentAccessService.getTokenTimeRemaining(accessResult.expiresAt);
  }, [accessResult]);

  return {
    // Access state
    accessResult,
    requirements,
    playbackData,
    
    // Loading states
    loading,
    requirementsLoading,
    
    // Error states
    error,
    
    // Computed states
    hasAccess,
    needsAgeVerification,
    needsEntitlement,
    isGeographicallyRestricted,
    
    // Actions
    checkAccess,
    getPlaybackToken,
    refreshAccess,
    clearError,
    
    // Utilities
    getAccessMessage,
    getSuggestedActions,
    getTimeRemaining
  };
};