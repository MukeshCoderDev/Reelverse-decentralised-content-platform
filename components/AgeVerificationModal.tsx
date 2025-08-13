import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { AgeVerificationService, AgeVerificationStatus } from '../services/ageVerificationService';

interface AgeVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified?: (status: AgeVerificationStatus) => void;
  required?: boolean;
}

export const AgeVerificationModal: React.FC<AgeVerificationModalProps> = ({
  isOpen,
  onClose,
  onVerified,
  required = false
}) => {
  const { account, isConnected } = useWallet();
  const [status, setStatus] = useState<AgeVerificationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ageVerificationService = AgeVerificationService.getInstance();

  // Load verification status when modal opens
  useEffect(() => {
    if (isOpen && account) {
      loadVerificationStatus();
    }
  }, [isOpen, account]);

  const loadVerificationStatus = async () => {
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

  const handleStartVerification = async () => {
    if (!account) return;

    try {
      setLoading(true);
      setError(null);

      const result = await ageVerificationService.completeVerification(
        account,
        (updatedStatus) => {
          setStatus(updatedStatus);
          if (updatedStatus.status === 'verified' && onVerified) {
            onVerified(updatedStatus);
          }
        }
      );

      setStatus(result);
      
      if (result.status === 'verified') {
        if (onVerified) {
          onVerified(result);
        }
        if (!required) {
          onClose();
        }
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (required && status?.status !== 'verified') {
      // Don't allow closing if verification is required and not completed
      return;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div className="modal-header" style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#333' }}>Age Verification</h2>
          {!required && (
            <button
              onClick={handleClose}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ×
            </button>
          )}
        </div>

        <div className="modal-body">
          {!isConnected ? (
            <div className="not-connected">
              <p>Please connect your wallet to proceed with age verification.</p>
            </div>
          ) : loading ? (
            <div className="loading" style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ marginBottom: '10px' }}>Loading...</div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                Checking verification status...
              </div>
            </div>
          ) : error ? (
            <div className="error" style={{ color: '#dc3545', marginBottom: '20px' }}>
              <p><strong>Error:</strong> {error}</p>
              <button
                onClick={loadVerificationStatus}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Retry
              </button>
            </div>
          ) : status ? (
            <div className="verification-status">
              <div className="status-info" style={{ marginBottom: '20px' }}>
                <div style={{
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: status.status === 'verified' ? '#d4edda' : 
                                   status.status === 'pending' ? '#fff3cd' : '#f8d7da',
                  border: `1px solid ${ageVerificationService.getStatusColor(status)}`,
                  marginBottom: '16px'
                }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    color: ageVerificationService.getStatusColor(status),
                    marginBottom: '4px'
                  }}>
                    Status: {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {ageVerificationService.getStatusMessage(status)}
                  </div>
                </div>

                {status.status === 'verified' && (
                  <div className="verified-info">
                    <p><strong>✓ Age Verified</strong></p>
                    <p style={{ fontSize: '14px', color: '#666' }}>
                      Verified on: {status.verifiedAt ? new Date(status.verifiedAt).toLocaleDateString() : 'Unknown'}
                    </p>
                    {status.expiresAt && (
                      <p style={{ fontSize: '14px', color: '#666' }}>
                        Expires: {new Date(status.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {status.status === 'pending' && (
                  <div className="pending-info">
                    <p>Your age verification is being processed.</p>
                    <p style={{ fontSize: '14px', color: '#666' }}>
                      This may take a few minutes. You can close this modal and check back later.
                    </p>
                  </div>
                )}

                {(status.status === 'failed' || status.status === 'expired') && (
                  <div className="failed-info">
                    <p>Age verification was not successful.</p>
                    {status.failureReason && (
                      <p style={{ fontSize: '14px', color: '#666' }}>
                        Reason: {status.failureReason}
                      </p>
                    )}
                    <p style={{ fontSize: '14px', color: '#666' }}>
                      You can try again with the button below.
                    </p>
                  </div>
                )}
              </div>

              <div className="verification-actions">
                {(status.status === 'none' || status.status === 'failed' || status.status === 'expired') && (
                  <button
                    onClick={handleStartVerification}
                    disabled={loading}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      width: '100%',
                      marginBottom: '12px'
                    }}
                  >
                    {loading ? 'Starting Verification...' : 'Start Age Verification'}
                  </button>
                )}

                {status.status === 'verified' && !required && (
                  <button
                    onClick={handleClose}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      width: '100%'
                    }}
                  >
                    Continue
                  </button>
                )}

                <button
                  onClick={loadVerificationStatus}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: '#007bff',
                    border: '1px solid #007bff',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    width: '100%'
                  }}
                >
                  Refresh Status
                </button>
              </div>
            </div>
          ) : null}

          <div className="verification-info" style={{ 
            marginTop: '20px', 
            padding: '16px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '6px',
            fontSize: '14px',
            color: '#666'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>About Age Verification</h4>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>We use Persona for secure identity verification</li>
              <li>You must be 18+ to access adult content</li>
              <li>Your personal information is encrypted and secure</li>
              <li>Verification is valid for one year</li>
              <li>You'll receive a blockchain badge upon successful verification</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgeVerificationModal;