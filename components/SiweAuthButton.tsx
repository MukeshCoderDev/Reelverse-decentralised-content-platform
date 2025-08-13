import React from 'react';
import { useWallet } from '../contexts/WalletContext';

/**
 * Example component demonstrating SIWE authentication integration
 * This shows how to use the enhanced WalletContext with SIWE
 */
export const SiweAuthButton: React.FC = () => {
  const {
    isConnected,
    isAuthenticated,
    isAuthenticating,
    account,
    session,
    authError,
    authenticate,
    logout,
    clearAuthError
  } = useWallet();

  const handleAuthenticate = async () => {
    try {
      await authenticate();
    } catch (error) {
      console.error('Authentication failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Show nothing if wallet is not connected
  if (!isConnected || !account) {
    return (
      <div className="siwe-auth-button">
        <p>Connect your wallet first to authenticate</p>
      </div>
    );
  }

  return (
    <div className="siwe-auth-button">
      <div className="auth-status">
        <p><strong>Account:</strong> {account}</p>
        <p><strong>Status:</strong> {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</p>
        {session && <p><strong>Session:</strong> {session.substring(0, 20)}...</p>}
      </div>

      {authError && (
        <div className="auth-error" style={{ color: 'red', marginBottom: '10px' }}>
          <p>Authentication Error: {authError}</p>
          <button onClick={clearAuthError}>Clear Error</button>
        </div>
      )}

      <div className="auth-actions">
        {!isAuthenticated ? (
          <button 
            onClick={handleAuthenticate}
            disabled={isAuthenticating}
            style={{
              padding: '10px 20px',
              backgroundColor: isAuthenticating ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: isAuthenticating ? 'not-allowed' : 'pointer'
            }}
          >
            {isAuthenticating ? 'Authenticating...' : 'Sign In with Ethereum'}
          </button>
        ) : (
          <button 
            onClick={handleLogout}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        )}
      </div>

      <div className="auth-info" style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
        <p>SIWE (Sign-In with Ethereum) provides secure blockchain-based authentication.</p>
        <p>Your signature proves ownership of your wallet address.</p>
      </div>
    </div>
  );
};

export default SiweAuthButton;