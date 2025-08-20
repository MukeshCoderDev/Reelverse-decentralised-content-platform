import { useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';

interface AgeGateConfig {
  minAge: number;
  rememberDays: number;
}

interface AgeGateHook {
  accepted: boolean;
  accept: () => void;
  reset: () => void;
  config: AgeGateConfig;
}

const DEFAULT_MIN_AGE = 18;
const DEFAULT_REMEMBER_DAYS = 30;

const getAgeGateConfig = (): AgeGateConfig => {
  const minAge = parseInt(import.meta.env.VITE_AGE_GATE_MIN_AGE || DEFAULT_MIN_AGE.toString(), 10);
  const rememberDays = parseInt(import.meta.env.VITE_AGE_GATE_REMEMBER_DAYS || DEFAULT_REMEMBER_DAYS.toString(), 10);
  return { minAge, rememberDays };
};

export const useAgeGate = (): AgeGateHook => {
  const [config] = useState(getAgeGateConfig());
  const [accepted, setAccepted] = useState(false);

  const checkAcceptance = useCallback(() => {
    const storedAcceptedAt = localStorage.getItem('ageGateAcceptedAt');
    const cookieAccepted = Cookies.get('age_gate') === '1';

    if (storedAcceptedAt) {
      const acceptedDate = new Date(storedAcceptedAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - acceptedDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= config.rememberDays && cookieAccepted) {
        setAccepted(true);
        return;
      }
    }
    setAccepted(false);
  }, [config.rememberDays]);

  useEffect(() => {
    checkAcceptance();
  }, [checkAcceptance]);

  const accept = useCallback(() => {
    const now = new Date();
    localStorage.setItem('ageGateAcceptedAt', now.toISOString());
    Cookies.set('age_gate', '1', { expires: config.rememberDays, sameSite: 'Lax' });
    setAccepted(true);
  }, [config.rememberDays]);

  const reset = useCallback(() => {
    localStorage.removeItem('ageGateAcceptedAt');
    Cookies.remove('age_gate');
    setAccepted(false);
  }, []);

  return { accepted, accept, reset, config };
};