import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { AgeVerificationService, AgeVerificationStatus } from '../services/ageVerificationService';
import { Modal } from '../src/components/shared/Modal'; // Use the shared Modal component
import { getLang } from '../src/i18n/auth'; // Import getLang

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
  const i18n = getLang();

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

  const handleClose = useCallback(() => {
    if (required && status?.status !== 'verified') {
      // Don't allow closing if verification is required and not completed
      return;
    }
    onClose();
  }, [required, status, onClose]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="rv-card w-[400px] max-w-[90vw] p-6 sm:p-8 text-center"
      overlayClassName="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      contentClassName="relative bg-rv-surface rounded-rv-md shadow-rv-2"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      aria-describedby="age-gate-description"
    >
      <h2 id="age-gate-title" className="text-2xl font-bold mb-4">
        {i18n.ageGateTitle}
      </h2>
      <p id="age-gate-description" className="text-rv-muted mb-6">
        {i18n.ageGateDescription}
      </p>

      {!isConnected ? (
        <div className="not-connected mb-4">
          <p className="text-rv-error">{i18n.somethingWentWrong}</p> {/* Placeholder for wallet connection */}
        </div>
      ) : loading ? (
        <div className="loading py-5">
          <p className="text-rv-muted mb-2">Loading...</p>
          <p className="text-sm text-rv-muted">Checking verification status...</p>
        </div>
      ) : error ? (
        <div className="error mb-4">
          <p className="rv-error mb-4"><strong>Error:</strong> {error}</p>
          <button
            onClick={loadVerificationStatus}
            className="rv-btn rv-secondary w-full"
          >
            {i18n.tryAgain}
          </button>
        </div>
      ) : status ? (
        <div className="verification-status space-y-4">
          <div className={`status-info p-3 rounded-rv-sm border ${
            status.status === 'verified' ? 'border-green-500 bg-green-100 text-green-800' :
            status.status === 'pending' ? 'border-yellow-500 bg-yellow-100 text-yellow-800' :
            'border-rv-danger bg-red-100 text-rv-danger'
          }`}>
            <p className="font-bold mb-1">
              Status: {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
            </p>
            <p className="text-sm">
              {ageVerificationService.getStatusMessage(status)}
            </p>
          </div>

          {status.status === 'verified' && (
            <div className="verified-info text-rv-muted text-sm">
              <p><strong>✓ {i18n.ageGateConfirm}</strong></p>
              <p>
                Verified on: {status.verifiedAt ? new Date(status.verifiedAt).toLocaleDateString() : 'Unknown'}
              </p>
              {status.expiresAt && (
                <p>
                  Expires: {new Date(status.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {status.status === 'pending' && (
            <div className="pending-info text-rv-muted text-sm">
              <p>Your age verification is being processed.</p>
              <p>This may take a few minutes. You can close this modal and check back later.</p>
            </div>
          )}

          {(status.status === 'failed' || status.status === 'expired') && (
            <div className="failed-info text-rv-muted text-sm">
              <p>Age verification was not successful.</p>
              {status.failureReason && (
                <p>
                  Reason: {status.failureReason}
                </p>
              )}
              <p>You can try again with the button below.</p>
            </div>
          )}

          <div className="verification-actions space-y-3 mt-6">
            {(status.status === 'none' || status.status === 'failed' || status.status === 'expired') && (
              <button
                onClick={handleStartVerification}
                disabled={loading}
                className="rv-btn rv-primary w-full"
              >
                {loading ? 'Starting Verification...' : i18n.ageGateConfirm}
              </button>
            )}

            {status.status === 'verified' && !required && (
              <button
                onClick={handleClose}
                className="rv-btn rv-primary w-full"
              >
                Continue
              </button>
            )}

            <button
              onClick={loadVerificationStatus}
              className="rv-btn rv-secondary w-full"
            >
              Refresh Status
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={handleStartVerification}
            disabled={loading}
            className="rv-btn rv-primary w-full"
          >
            {loading ? 'Starting Verification...' : i18n.ageGateConfirm}
          </button>
          <button
            onClick={handleClose}
            className="rv-btn rv-ghost w-full"
          >
            {i18n.ageGateCancel}
          </button>
        </div>
      )}

      <div className="verification-info text-rv-muted text-sm mt-6 p-4 bg-rv-elev rounded-rv-sm">
        <h4 className="font-semibold text-rv-text mb-2">About Age Verification</h4>
        <ul className="list-disc list-inside text-left">
          <li>We use Persona for secure identity verification</li>
          <li>You must be 18+ to access adult content</li>
          <li>Your personal information is encrypted and secure</li>
          <li>Verification is valid for one year</li>
          <li>You'll receive a blockchain badge upon successful verification</li>
        </ul>
      </div>
    </Modal>
  );
};

export default AgeVerificationModal;
