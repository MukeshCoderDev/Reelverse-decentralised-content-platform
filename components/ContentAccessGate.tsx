import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { ContentAccessService, AccessCheckResult, ContentRequirements } from '../services/contentAccessService';
import { AgeVerificationModal } from './AgeVerificationModal';

interface ContentAccessGateProps {
  contentId: string;
  children: React.ReactNode;
  onAccessGranted?: (playbackData: any) => void;
  onAccessDenied?: (reasons: any[]) => void;
  showRequirements?: boolean;
}

export const ContentAccessGate: React.FC<ContentAccessGateProps> = ({
  contentId,
  children,
  onAccessGranted,
  onAccessDenied,
  showRequirements = true
}) => {
  const { account, isConnected } = useWallet();
  const [accessResult, setAccessResult] = useState<AccessCheckResult | null>(null);
  const [requirements, setRequirements] = useState<ContentRequirements | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [sessionId] = useState(() => ContentAccessService.getInstance().generateSessionId());
  
  const contentAccessService = ContentAccessService.getInstance();

  // Check access when component mounts or account changes
  useEffect(() => {
    if (isConnected && account) {
      checkAccess();
    } else {
      setAccessResult(null);
    }
  }, [contentId, account, isConnected]);

  // Load requirements when component mounts
  useEffect(() => {
    if (showRequirements) {
      loadRequirements();
    }
  }, [contentId, showRequirements]);

  const loadRequirements = async () => {
    try {
      const reqs = await contentAccessService.getContentRequirements(contentId);
      setRequirements(reqs);
    } catch (error: any) {
      console.error('Error loading requirements:', error);
    }
  };

  const checkAccess = async () => {
    if (!account) return;

    try {
      setLoading(true);
      setError(null);

      const result = await contentAccessService.checkAccess({
        contentId,
        userAddress: account,
        sessionId
      });

      setAccessResult(result);

      if (result.allowed && onAccessGranted) {
        // Get playback token if access is granted
        try {
          const playbackData = await contentAccessService.getPlaybackToken({
            contentId,
            userAddress: account,
            accessToken: result.accessToken!,
            sessionId
          });
          onAccessGranted(playbackData);
        } catch (error) {
          console.error('Error getting playback token:', error);
        }
      } else if (!result.allowed && onAccessDenied) {
        onAccessDenied(result.reasons);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action: string) => {
    switch (action) {
      case 'verify_age':
        setShowAgeModal(true);
        break;
      case 'purchase_content':
        // TODO: Implement purchase flow
        console.log('Purchase content clicked');
        break;
      case 'subscribe':
        // TODO: Implement subscription flow
        console.log('Subscribe clicked');
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  const handleAgeVerified = () => {
    setShowAgeModal(false);
    // Recheck access after age verification
    checkAccess();
  };

  // Show loading state
  if (loading) {
    return (
      <div className="content-access-gate loading" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '10px' }}>Checking access permissions...</div>
          <div style={{ fontSize: '14px', color: '#666' }}>Please wait</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="content-access-gate error" style={{
        padding: '20px',
        backgroundColor: '#f8d7da',
        borderRadius: '8px',
        border: '1px solid #f5c6cb',
        color: '#721c24'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Access Check Failed</h3>
        <p style={{ margin: '0 0 15px 0' }}>{error}</p>
        <button
          onClick={checkAccess}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Show wallet connection required
  if (!isConnected) {
    return (
      <div className="content-access-gate not-connected" style={{
        padding: '40px',
        backgroundColor: '#fff3cd',
        borderRadius: '8px',
        border: '1px solid #ffeaa7',
        textAlign: 'center'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#856404' }}>Wallet Connection Required</h3>
        <p style={{ margin: '0', color: '#856404' }}>
          Please connect your wallet to access this content.
        </p>
      </div>
    );
  }

  // Show access granted - render children
  if (accessResult?.allowed) {
    return (
      <div className="content-access-gate granted">
        {children}
        
        {/* Show access info if needed */}
        {accessResult.expiresAt && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            Access expires: {contentAccessService.formatTimeRemaining(
              contentAccessService.getTokenTimeRemaining(accessResult.expiresAt)
            )}
          </div>
        )}
      </div>
    );
  }

  // Show access denied with reasons and actions
  if (accessResult && !accessResult.allowed) {
    const suggestedActions = contentAccessService.getSuggestedActions(accessResult.reasons);
    const denialMessage = contentAccessService.getAccessDenialMessage(accessResult.reasons);

    return (
      <div className="content-access-gate denied" style={{
        padding: '40px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Access Restricted</h3>
          <p style={{ margin: '0 0 20px 0', color: '#6c757d' }}>{denialMessage}</p>
        </div>

        {/* Show requirements if available */}
        {requirements && showRequirements && (
          <div className="requirements" style={{
            backgroundColor: '#e9ecef',
            padding: '15px',
            borderRadius: '6px',
            marginBottom: '20px',
            textAlign: 'left'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Content Requirements:</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#6c757d' }}>
              {requirements.ageVerificationRequired && (
                <li>Age verification (18+) required</li>
              )}
              {requirements.geographicRestrictions.length > 0 && (
                <li>Geographic restrictions apply: {requirements.geographicRestrictions.join(', ')}</li>
              )}
              {requirements.entitlementRequired && (
                <li>
                  {requirements.entitlementType === 'ppv' ? 'Purchase' : 'Subscription'} required
                  {requirements.price && ` ($${requirements.price} ${requirements.currency || 'USDC'})`}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Show detailed reasons */}
        <div className="denial-reasons" style={{ marginBottom: '20px' }}>
          {accessResult.reasons.map((reason, index) => (
            <div
              key={index}
              style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '4px',
                padding: '10px',
                marginBottom: '10px',
                textAlign: 'left'
              }}
            >
              <strong style={{ color: '#856404' }}>
                {reason.type.replace('_', ' ').toUpperCase()}:
              </strong>
              <span style={{ color: '#856404', marginLeft: '5px' }}>
                {reason.message}
              </span>
            </div>
          ))}
        </div>

        {/* Show action buttons */}
        {suggestedActions.length > 0 && (
          <div className="suggested-actions">
            {suggestedActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleActionClick(action.action)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: action.type === 'primary' ? '#007bff' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  marginRight: '10px',
                  marginBottom: '10px'
                }}
              >
                {action.label}
              </button>
            ))}
            
            <button
              onClick={checkAccess}
              style={{
                padding: '12px 24px',
                backgroundColor: 'transparent',
                color: '#007bff',
                border: '1px solid #007bff',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Recheck Access
            </button>
          </div>
        )}

        {/* Age verification modal */}
        <AgeVerificationModal
          isOpen={showAgeModal}
          onClose={() => setShowAgeModal(false)}
          onVerified={handleAgeVerified}
          required={true}
        />
      </div>
    );
  }

  // Default loading state
  return (
    <div className="content-access-gate" style={{
      padding: '40px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #dee2e6',
      textAlign: 'center'
    }}>
      <p>Initializing content access...</p>
    </div>
  );
};

export default ContentAccessGate;