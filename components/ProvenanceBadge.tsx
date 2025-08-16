import React, { useState, useEffect } from 'react';
import { ProvenanceBadge as ProvenanceBadgeType, ProvenanceRecord, c2paProvenanceService } from '../services/c2paProvenanceService';

interface ProvenanceBadgeProps {
  contentId: string;
  className?: string;
  showDetails?: boolean;
}

interface VerificationResult {
  isValid: boolean;
  trustScore: number;
  issues: string[];
  badge: ProvenanceBadgeType;
}

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({
  contentId,
  className = '',
  showDetails = false
}) => {
  const [provenanceRecord, setProvenanceRecord] = useState<ProvenanceRecord | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadProvenanceData();
  }, [contentId]);

  const loadProvenanceData = async () => {
    try {
      setLoading(true);
      
      const record = await c2paProvenanceService.getProvenanceByContentId(contentId);
      setProvenanceRecord(record);
      
      if (record) {
        const verificationResult = await c2paProvenanceService.verifyProvenance(record.id);
        setVerification(verificationResult);
      }
      
    } catch (error) {
      console.error('Failed to load provenance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBadgeColor = (level: ProvenanceBadgeType['level']) => {
    switch (level) {
      case 'verified': return 'bg-green-600 text-white border-green-500';
      case 'attested': return 'bg-blue-600 text-white border-blue-500';
      case 'basic': return 'bg-yellow-600 text-white border-yellow-500';
      case 'none': return 'bg-gray-600 text-white border-gray-500';
      default: return 'bg-gray-600 text-white border-gray-500';
    }
  };

  const getTrustScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className={`inline-flex items-center px-2 py-1 rounded text-xs ${className}`}>
        <div className="animate-spin w-3 h-3 border border-gray-400 border-t-transparent rounded-full mr-1"></div>
        <span>Verifying...</span>
      </div>
    );
  }

  if (!provenanceRecord || !verification) {
    return (
      <div className={`inline-flex items-center px-2 py-1 rounded text-xs bg-gray-600 text-white border border-gray-500 ${className}`}>
        <span className="mr-1">❓</span>
        <span>No Provenance</span>
      </div>
    );
  }

  const { badge } = verification;

  return (
    <>
      <div
        className={`inline-flex items-center px-2 py-1 rounded text-xs border cursor-pointer hover:opacity-80 transition-opacity ${getBadgeColor(badge.level)} ${className}`}
        onClick={() => showDetails && setShowModal(true)}
        title={showDetails ? 'Click for details' : badge.description}
      >
        <span className="mr-1">{badge.icon}</span>
        <span>{badge.description}</span>
        {verification.trustScore > 0 && (
          <span className="ml-1 text-xs opacity-75">
            ({verification.trustScore})
          </span>
        )}
      </div>

      {/* Provenance Details Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Content Provenance Details</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Verification Status */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`px-3 py-1 rounded border ${getBadgeColor(badge.level)}`}>
                    <span className="mr-2">{badge.icon}</span>
                    {badge.description}
                  </div>
                  <div className="text-sm text-gray-400">
                    Trust Score: <span className={getTrustScoreColor(verification.trustScore)}>{verification.trustScore}/100</span>
                  </div>
                </div>

                {verification.issues.length > 0 && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded p-3 mb-3">
                    <div className="text-red-400 font-medium mb-2">⚠️ Verification Issues:</div>
                    <ul className="text-sm text-red-300 space-y-1">
                      {verification.issues.map((issue, index) => (
                        <li key={index}>• {issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-gray-800 rounded p-3">
                  <div className="text-sm font-medium text-gray-300 mb-2">Trust Indicators:</div>
                  <ul className="text-sm text-gray-400 space-y-1">
                    {badge.trustIndicators.map((indicator, index) => (
                      <li key={index} className="flex items-center">
                        <span className="text-green-400 mr-2">✓</span>
                        {indicator}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* C2PA Manifest */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">C2PA Manifest</h3>
                <div className="bg-gray-800 rounded p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Manifest ID:</span>
                      <div className="text-white font-mono text-xs break-all">{provenanceRecord.c2paManifest.id}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Created:</span>
                      <div className="text-white">{provenanceRecord.c2paManifest.createdAt.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Claim Generator:</span>
                      <div className="text-white">{provenanceRecord.c2paManifest.claimGenerator}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Assertions:</span>
                      <div className="text-white">{provenanceRecord.c2paManifest.assertions.length} assertions</div>
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-400 text-sm">Assertions:</span>
                    <div className="mt-2 space-y-2">
                      {provenanceRecord.c2paManifest.assertions.map((assertion, index) => (
                        <div key={index} className="bg-gray-700 rounded p-2">
                          <div className="text-white text-sm font-medium">{assertion.label}</div>
                          <div className="text-gray-400 text-xs">{assertion.kind}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Device Attestation */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">Device Attestation</h3>
                <div className="bg-gray-800 rounded p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Device Type:</span>
                      <div className="text-white capitalize">{provenanceRecord.deviceAttestation.deviceType}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Trusted Environment:</span>
                      <div className={provenanceRecord.deviceAttestation.trustedEnvironment ? 'text-green-400' : 'text-red-400'}>
                        {provenanceRecord.deviceAttestation.trustedEnvironment ? '✓ Yes' : '✗ No'}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400">Biometric Auth:</span>
                      <div className={provenanceRecord.deviceAttestation.biometricAuth ? 'text-green-400' : 'text-red-400'}>
                        {provenanceRecord.deviceAttestation.biometricAuth ? '✓ Yes' : '✗ No'}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400">Device ID:</span>
                      <div className="text-white font-mono text-xs">{provenanceRecord.deviceAttestation.deviceId}</div>
                    </div>
                  </div>

                  {provenanceRecord.deviceAttestation.manufacturer && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="text-sm">
                        <span className="text-gray-400">Device:</span>
                        <span className="text-white ml-2">
                          {provenanceRecord.deviceAttestation.manufacturer} {provenanceRecord.deviceAttestation.model}
                        </span>
                      </div>
                      {provenanceRecord.deviceAttestation.osVersion && (
                        <div className="text-sm mt-1">
                          <span className="text-gray-400">OS Version:</span>
                          <span className="text-white ml-2">{provenanceRecord.deviceAttestation.osVersion}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {provenanceRecord.deviceAttestation.locationData && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="text-sm">
                        <span className="text-gray-400">Location:</span>
                        <span className="text-white ml-2">
                          {provenanceRecord.deviceAttestation.locationData.latitude.toFixed(4)}, {provenanceRecord.deviceAttestation.locationData.longitude.toFixed(4)}
                        </span>
                        <span className="text-gray-400 ml-2">
                          (±{provenanceRecord.deviceAttestation.locationData.accuracy}m)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Metadata */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Upload Metadata</h3>
                <div className="bg-gray-800 rounded p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Original Filename:</span>
                      <div className="text-white">{provenanceRecord.uploadMetadata.originalFilename}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Upload Time:</span>
                      <div className="text-white">{provenanceRecord.uploadMetadata.timestamp.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">File Hash:</span>
                      <div className="text-white font-mono text-xs break-all">{provenanceRecord.uploadMetadata.fileHash}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">IP Address:</span>
                      <div className="text-white font-mono">{provenanceRecord.uploadMetadata.ipAddress}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};