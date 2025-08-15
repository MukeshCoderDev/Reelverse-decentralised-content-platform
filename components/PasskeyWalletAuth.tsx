import React, { useState, useEffect } from 'react';
import { PasskeyWalletService, DEFAULT_PASSKEY_CONFIG } from '../services/passkeyWalletService';
import { Button } from './Button';
import { Spinner } from './Spinner';

interface PasskeyWalletAuthProps {
  onSuccess: (walletAddress: string) => void;
  onError: (error: string) => void;
}

export const PasskeyWalletAuth: React.FC<PasskeyWalletAuthProps> = ({
  onSuccess,
  onError
}) => {
  const [email, setEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [passkeyService] = useState(() => new PasskeyWalletService(DEFAULT_PASSKEY_CONFIG));
  const [isSupported, setIsSupported] = useState(false);
  const [hasExistingWallet, setHasExistingWallet] = useState(false);

  useEffect(() => {
    // Check if WebAuthn is supported
    const supported = typeof window !== 'undefined' && 
      window.navigator && 
      window.navigator.credentials &&
      typeof window.navigator.credentials.create === 'function';
    
    setIsSupported(supported);
  }, []);

  useEffect(() => {
    // Check if user has existing passkey wallet
    const checkExistingWallet = async () => {
      if (email && isSupported) {
        try {
          const credentials = await passkeyService.listUserCredentials(email);
          setHasExistingWallet(credentials.length > 0);
        } catch (error) {
          setHasExistingWallet(false);
        }
      }
    };

    const timeoutId = setTimeout(checkExistingWallet, 500);
    return () => clearTimeout(timeoutId);
  }, [email, passkeyService, isSupported]);

  const handleCreateWallet = async () => {
    if (!email) {
      onError('Please enter your email address');
      return;
    }

    setIsCreating(true);
    try {
      const result = await passkeyService.createPasskeyWallet(email);
      
      if (result.success && result.walletAddress) {
        onSuccess(result.walletAddress);
      } else {
        onError(result.error || 'Failed to create passkey wallet');
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to create passkey wallet');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAuthenticate = async () => {
    if (!email) {
      onError('Please enter your email address');
      return;
    }

    setIsAuthenticating(true);
    try {
      const result = await passkeyService.authenticateWithPasskey(email);
      
      if (result.success && result.walletAddress) {
        onSuccess(result.walletAddress);
      } else {
        onError(result.error || 'Failed to authenticate with passkey');
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to authenticate with passkey');
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Passkey Not Supported
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                Your browser doesn't support passkey authentication. Please use a modern browser 
                like Chrome, Safari, or Firefox, or connect with a traditional wallet instead.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Passkey Wallet
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Create or access your wallet using biometric authentication. No seed phrases required.
        </p>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email Address
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter your email address"
          disabled={isCreating || isAuthenticating}
        />
      </div>

      {hasExistingWallet ? (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">
                  Existing passkey wallet found for this email.
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleAuthenticate}
            disabled={!email || isAuthenticating}
            className="w-full"
          >
            {isAuthenticating ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Authenticating...
              </>
            ) : (
              'Authenticate with Passkey'
            )}
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleCreateWallet}
          disabled={!email || isCreating}
          className="w-full"
        >
          {isCreating ? (
            <>
              <Spinner className="w-4 h-4 mr-2" />
              Creating Wallet...
            </>
          ) : (
            'Create Passkey Wallet'
          )}
        </Button>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-800">
              About Passkey Wallets
            </h4>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Secured by your device's biometric authentication</li>
                <li>No seed phrases to remember or lose</li>
                <li>Faster checkout with gasless transactions</li>
                <li>Works with Face ID, Touch ID, or Windows Hello</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};