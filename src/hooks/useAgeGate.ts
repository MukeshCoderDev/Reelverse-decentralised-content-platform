import { useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';

interface AgeGateConfig {
  minAge: number;
  rememberDays: number;
  enabled: boolean;
}

interface AgeGateHook {
  accepted: boolean;
  accept: () => void;
  reset: () => void;
  config: AgeGateConfig;
  shouldGate: (pathname: string) => boolean;
}

const DEFAULT_MIN_AGE = 18;
const DEFAULT_REMEMBER_DAYS = 30;
const SAFE_ROUTES = ['/legal', '/privacy', '/terms'];

const getAgeGateConfig = (): AgeGateConfig => {
  const enabled = (import.meta.env.VITE_AGE_GATE_ENABLED ?? 'true') === 'true';
  const minAge = parseInt(import.meta.env.VITE_AGE_GATE_MIN_AGE || DEFAULT_MIN_AGE.toString(), 10);
  const rememberDays = parseInt(import.meta.env.VITE_AGE_GATE_REMEMBER_DAYS || DEFAULT_REMEMBER_DAYS.toString(), 10);
  return { enabled, minAge, rememberDays };
};

export const useAgeGate = (): AgeGateHook => {
  const [config] = useState(getAgeGateConfig());
  const [accepted, setAccepted] = useState(false);

  const checkAcceptance = useCallback(() => {
    const storedAcceptedAt = localStorage.getItem('ageGateAcceptedAt');
    const cookieAccepted = Cookies.get('age_gate') === '1';

    if (storedAcceptedAt && cookieAccepted) {
      const acceptedTimestamp = parseInt(storedAcceptedAt, 10);
      const now = Date.now();
      const expiryTimestamp = acceptedTimestamp + config.rememberDays * 86400 * 1000; // rememberDays in milliseconds

      if (now < expiryTimestamp) {
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
    const now = Date.now();
    localStorage.setItem('ageGateAcceptedAt', now.toString());
    Cookies.set('age_gate', '1', { expires: config.rememberDays, path: '/', sameSite: 'Lax' });
    setAccepted(true);
  }, [config.rememberDays]);

  const reset = useCallback(() => {
    localStorage.removeItem('ageGateAcceptedAt');
    Cookies.remove('age_gate', { path: '/' });
    setAccepted(false);
  }, []);

  const shouldGate = useCallback((pathname: string): boolean => {
    const pathnameNormalized = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    return config.enabled && !accepted && !SAFE_ROUTES.includes(pathnameNormalized);
  }, [config.enabled, accepted]);

  return { accepted, accept, reset, config, shouldGate };
};