import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';

interface SessionKeyContextType {
  smartAccountAddress: string | null;
  sessionKeyInfo: {
    id: string;
    publicKey: string;
    expiresAt: string;
    scope: any;
  } | null;
  loading: boolean;
  error: string | null;
  createSessionKey: (ttlMins: number, scope: any) => Promise<void>;
  revokeSessionKey: (sessionKeyId: string) => Promise<void>;
}

const SessionKeyContext = createContext<SessionKeyContextType | undefined>(undefined);

export const SessionKeyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null);
  const [sessionKeyInfo, setSessionKeyInfo] = useState<SessionKeyContextType['sessionKeyInfo']>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccountDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/aa/account');
      setSmartAccountAddress(response.data.smartAccountAddress);

      if (response.data.sessionKeyManagerSupported) {
        // Check for active sessions
        const sessionStatusResponse = await axios.get('/api/aa/session/status');
        if (sessionStatusResponse.data && sessionStatusResponse.data.length > 0) {
          // Assuming only one active session for simplicity, or pick the latest
          setSessionKeyInfo(sessionStatusResponse.data[0]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching account details:', err);
      setError(err.response?.data?.error || 'Failed to fetch account details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountDetails();
  }, []);

  const createSessionKey = async (ttlMins: number, scope: any) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post('/api/aa/session/create', { ttlMins, scope });
      if (response.data.supported === false) {
        setError(response.data.message);
        return;
      }
      setSessionKeyInfo({
        id: response.data.sessionKeyId,
        publicKey: response.data.publicKey,
        expiresAt: response.data.expiresAt,
        scope: scope,
      });
      console.log('Session key created:', response.data);
    } catch (err: any) {
      console.error('Error creating session key:', err);
      setError(err.response?.data?.error || 'Failed to create session key.');
    } finally {
      setLoading(false);
    }
  };

  const revokeSessionKey = async (sessionKeyId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post('/api/aa/session/revoke', { sessionKeyId });
      if (response.data.supported === false) {
        setError(response.data.message);
        return;
      }
      setSessionKeyInfo(null);
      console.log('Session key revoked:', response.data);
    } catch (err: any) {
      console.error('Error revoking session key:', err);
      setError(err.response?.data?.error || 'Failed to revoke session key.');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    smartAccountAddress,
    sessionKeyInfo,
    loading,
    error,
    createSessionKey,
    revokeSessionKey,
  };

  return <SessionKeyContext.Provider value={value}>{children}</SessionKeyContext.Provider>;
};

export const useSessionKey = () => {
  const context = useContext(SessionKeyContext);
  if (context === undefined) {
    throw new Error('useSessionKey must be used within a SessionKeyProvider');
  }
  return context;
};