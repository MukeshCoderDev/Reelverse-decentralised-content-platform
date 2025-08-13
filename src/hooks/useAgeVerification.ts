import { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { AgeVerificationService, AgeVerificationStatus } from '../../services/ageVerificationService';

export interface UseAgeVerificationReturn {
  status: AgeVerificationStatus | null;
  loading: boolean;
  error: string | null;
  isVerified: boolean;
  needsVerification: boolean;
  startVerification: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  clearError: () => void;
}

export const useAgeVerification = (): UseAgeVerificationReturn => {
  const { account, isConnected } = useWallet();
  const [status, setStatus] = useState<AgeVerificationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ageVerificationService = AgeVerificationService.getInstance();

  // Load status when account changes
  useEffect(() => {
    if (isConnected && account) {
      refreshStatus();
    } else {
      setStatus(null);
      setError(null);
    }
  }, [account, isConnected]);

  const refreshStatus = async () => {
    if (!account) return;

    try {
      setLoading(true);
      setError(null);
      const verificationStatus = await ageVerificationService.getVerificationStatus(account);
      setStatus(verificationStatus);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const startVerification = async () => {
    if (!account) {
      setError('Wallet must be connected to start verification');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await ageVerificationService.completeVerification(
        account,
        (updatedStatus) => {
          setStatus(updatedStatus);
        }
      );

      setStatus(result);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const isVerified = status?.status === 'verified';
  const needsVerification = status ? status.status !== 'verified' : true;

  return {
    status,
    loading,
    error,
    isVerified,
    needsVerification,
    startVerification,
    refreshStatus,
    clearError
  };
};