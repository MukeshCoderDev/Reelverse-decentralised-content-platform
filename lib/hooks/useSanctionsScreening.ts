/**
 * Sanctions Screening Hook
 * React hook for integrating sanctions screening into user flows
 */

import { useState, useCallback } from 'react';
import { SanctionsScreeningService, SanctionsScreeningResult } from '../../services/sanctionsScreeningService';

export interface UserScreeningData {
  userId: string;
  fullName: string;
  dateOfBirth?: string;
  nationality?: string;
  address?: string;
  email?: string;
}

export interface PayoutScreeningData {
  userId: string;
  recipientName: string;
  bankName?: string;
  bankCountry?: string;
  amount: number;
  currency: string;
}

export interface ScreeningHookResult {
  screenUser: (userData: UserScreeningData) => Promise<SanctionsScreeningResult>;
  screenPayout: (payoutData: PayoutScreeningData) => Promise<SanctionsScreeningResult>;
  checkCountryBlocked: (countryCode: string) => boolean;
  isLoading: boolean;
  error: string | null;
  lastResult: SanctionsScreeningResult | null;
}

export function useSanctionsScreening(): ScreeningHookResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SanctionsScreeningResult | null>(null);

  const sanctionsService = SanctionsScreeningService.getInstance();

  const screenUser = useCallback(async (userData: UserScreeningData): Promise<SanctionsScreeningResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sanctionsService.screenUser({
        userId: userData.userId,
        fullName: userData.fullName,
        dateOfBirth: userData.dateOfBirth,
        nationality: userData.nationality,
        address: userData.address,
        email: userData.email
      });

      setLastResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Screening failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [sanctionsService]);

  const screenPayout = useCallback(async (payoutData: PayoutScreeningData): Promise<SanctionsScreeningResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sanctionsService.screenPayout({
        userId: payoutData.userId,
        recipientName: payoutData.recipientName,
        bankName: payoutData.bankName,
        bankCountry: payoutData.bankCountry,
        amount: payoutData.amount,
        currency: payoutData.currency
      });

      setLastResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payout screening failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [sanctionsService]);

  const checkCountryBlocked = useCallback((countryCode: string): boolean => {
    return sanctionsService.isCountryBlocked(countryCode);
  }, [sanctionsService]);

  return {
    screenUser,
    screenPayout,
    checkCountryBlocked,
    isLoading,
    error,
    lastResult
  };
}

// Hook for user registration with sanctions screening
export function useUserRegistrationScreening() {
  const { screenUser, checkCountryBlocked, isLoading, error } = useSanctionsScreening();
  const [screeningStatus, setScreeningStatus] = useState<'pending' | 'screening' | 'approved' | 'rejected' | 'review'>('pending');

  const validateAndScreenUser = useCallback(async (userData: UserScreeningData & { countryCode?: string }) => {
    setScreeningStatus('screening');

    try {
      // First check if country is blocked
      if (userData.countryCode && checkCountryBlocked(userData.countryCode)) {
        setScreeningStatus('rejected');
        throw new Error(`Registration not available in ${userData.countryCode}`);
      }

      // Run sanctions screening
      const result = await screenUser(userData);

      switch (result.status) {
        case 'clear':
          setScreeningStatus('approved');
          break;
        case 'flagged':
          setScreeningStatus('review');
          break;
        case 'blocked':
          setScreeningStatus('rejected');
          break;
      }

      return result;
    } catch (err) {
      setScreeningStatus('rejected');
      throw err;
    }
  }, [screenUser, checkCountryBlocked]);

  return {
    validateAndScreenUser,
    screeningStatus,
    isLoading,
    error
  };
}

// Hook for payout processing with sanctions screening
export function usePayoutScreening() {
  const { screenPayout, isLoading, error } = useSanctionsScreening();
  const [payoutStatus, setPayoutStatus] = useState<'pending' | 'screening' | 'approved' | 'rejected' | 'review'>('pending');

  const validatePayout = useCallback(async (payoutData: PayoutScreeningData) => {
    setPayoutStatus('screening');

    try {
      const result = await screenPayout(payoutData);

      switch (result.status) {
        case 'clear':
          setPayoutStatus('approved');
          break;
        case 'flagged':
          setPayoutStatus('review');
          break;
        case 'blocked':
          setPayoutStatus('rejected');
          break;
      }

      return result;
    } catch (err) {
      setPayoutStatus('rejected');
      throw err;
    }
  }, [screenPayout]);

  return {
    validatePayout,
    payoutStatus,
    isLoading,
    error
  };
}

// Hook for real-time country validation
export function useCountryValidation() {
  const { checkCountryBlocked } = useSanctionsScreening();

  const validateCountry = useCallback((countryCode: string) => {
    const isBlocked = checkCountryBlocked(countryCode);
    
    return {
      isBlocked,
      isAllowed: !isBlocked,
      message: isBlocked 
        ? `Service not available in ${countryCode} due to regulatory restrictions`
        : `Service available in ${countryCode}`
    };
  }, [checkCountryBlocked]);

  return {
    validateCountry,
    checkCountryBlocked
  };
}