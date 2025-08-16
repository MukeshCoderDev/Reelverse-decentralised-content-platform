/**
 * Policy Display Component
 * Displays legal policy documents with acceptance tracking
 */

import React, { useState, useEffect } from 'react';
import { PolicyManagementService, PolicyDocument, PolicyType } from '../services/policyManagementService';

interface PolicyDisplayProps {
  policyType?: PolicyType;
  userId?: string;
  showAcceptanceButton?: boolean;
  onAcceptance?: (policyId: string) => void;
}

interface PolicyAcceptanceModalProps {
  policies: PolicyDocument[];
  userId: string;
  onAccept: (policyId: string) => void;
  onClose: () => void;
}

const PolicyAcceptanceModal: React.FC<PolicyAcceptanceModalProps> = ({
  policies,
  userId,
  onAccept,
  onClose
}) => {
  const [currentPolicyIndex, setCurrentPolicyIndex] = useState(0);
  const [acceptedPolicies, setAcceptedPolicies] = useState<Set<string>>(new Set());

  const currentPolicy = policies[currentPolicyIndex];
  const isLastPolicy = currentPolicyIndex === policies.length - 1;
  const allAccepted = acceptedPolicies.size === policies.length;

  const handleAccept = () => {
    onAccept(currentPolicy.id);
    setAcceptedPolicies(prev => new Set(prev).add(currentPolicy.id));

    if (isLastPolicy) {
      // All policies accepted
      setTimeout(onClose, 1000);
    } else {
      setCurrentPolicyIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPolicyIndex > 0) {
      setCurrentPolicyIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentPolicyIndex < policies.length - 1) {
      setCurrentPolicyIndex(prev => prev + 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {currentPolicy.title}
            </h2>
            <p className="text-sm text-gray-500">
              Policy {currentPolicyIndex + 1} of {policies.length} • Version {currentPolicy.version}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {policies.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full ${
                  index === currentPolicyIndex
                    ? 'bg-blue-600'
                    : acceptedPolicies.has(policies[index].id)
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose max-w-none">
            <div 
              dangerouslySetInnerHTML={{ 
                __html: currentPolicy.content.replace(/\n/g, '<br>').replace(/## /g, '<h2>').replace(/### /g, '<h3>') 
              }} 
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="flex space-x-3">
            <button
              onClick={handlePrevious}
              disabled={currentPolicyIndex === 0}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            {!acceptedPolicies.has(currentPolicy.id) && (
              <button
                onClick={handleNext}
                disabled={isLastPolicy}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            )}
          </div>

          <div className="flex space-x-3">
            {acceptedPolicies.has(currentPolicy.id) ? (
              <div className="flex items-center text-green-600">
                <span className="mr-2">✓</span>
                Accepted
              </div>
            ) : (
              <button
                onClick={handleAccept}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                I Accept
              </button>
            )}

            {allAccepted && (
              <button
                onClick={onClose}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const PolicyDisplay: React.FC<PolicyDisplayProps> = ({
  policyType,
  userId,
  showAcceptanceButton = false,
  onAcceptance
}) => {
  const [policy, setPolicy] = useState<PolicyDocument | null>(null);
  const [allPolicies, setAllPolicies] = useState<PolicyDocument[]>([]);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [requiredPolicies, setRequiredPolicies] = useState<PolicyDocument[]>([]);

  const policyService = PolicyManagementService.getInstance();

  useEffect(() => {
    if (policyType) {
      const policyDoc = policyService.getActivePolicy(policyType);
      setPolicy(policyDoc);
      
      if (userId && policyDoc) {
        setHasAccepted(policyService.hasUserAcceptedPolicy(userId, policyType));
      }
    } else {
      setAllPolicies(policyService.getAllPolicies().filter(p => p.isActive));
    }

    if (userId) {
      const required = policyService.getPoliciesRequiringAcceptance(userId);
      setRequiredPolicies(required);
    }
  }, [policyType, userId]);

  const handleAcceptPolicy = (policyId: string) => {
    if (!userId) return;

    try {
      policyService.recordAcceptance({
        userId,
        policyId,
        ipAddress: '127.0.0.1', // Would get real IP in production
        userAgent: navigator.userAgent,
        acceptanceMethod: 'explicit'
      });

      if (policyType) {
        setHasAccepted(true);
      }

      if (onAcceptance) {
        onAcceptance(policyId);
      }

      // Refresh required policies
      const required = policyService.getPoliciesRequiringAcceptance(userId);
      setRequiredPolicies(required);

    } catch (error) {
      console.error('Error recording policy acceptance:', error);
    }
  };

  const handleShowAcceptanceModal = () => {
    setShowModal(true);
  };

  // Show acceptance modal if there are required policies
  useEffect(() => {
    if (requiredPolicies.length > 0 && userId && !showModal) {
      setShowModal(true);
    }
  }, [requiredPolicies, userId]);

  if (policyType && policy) {
    // Single policy display
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{policy.title}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Version {policy.version} • Effective {policy.effectiveDate.toLocaleDateString()}
                </p>
              </div>
              
              {userId && hasAccepted && (
                <div className="flex items-center text-green-600">
                  <span className="mr-2">✓</span>
                  Accepted
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            <div className="prose max-w-none">
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: policy.content
                    .replace(/\n/g, '<br>')
                    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                }} 
              />
            </div>
          </div>

          {showAcceptanceButton && userId && !hasAccepted && policy.requiresAcceptance && (
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  You must accept this policy to continue using the platform.
                </p>
                <button
                  onClick={() => handleAcceptPolicy(policy.id)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  I Accept
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // All policies display
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Legal Policies</h1>
        <p className="text-gray-600">
          Our legal policies and terms that govern the use of our platform.
        </p>
        
        {requiredPolicies.length > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-yellow-800">Action Required</h3>
                <p className="text-sm text-yellow-700">
                  You have {requiredPolicies.length} policy(ies) that require your acceptance.
                </p>
              </div>
              <button
                onClick={handleShowAcceptanceModal}
                className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Review Policies
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allPolicies.map((policyDoc) => {
          const isAccepted = userId ? policyService.hasUserAcceptedPolicy(userId, policyDoc.type) : false;
          
          return (
            <div key={policyDoc.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">{policyDoc.title}</h3>
                {userId && isAccepted && (
                  <span className="text-green-600 text-sm">✓</span>
                )}
              </div>
              
              <p className="text-sm text-gray-500 mb-3">
                Version {policyDoc.version} • {policyDoc.effectiveDate.toLocaleDateString()}
              </p>
              
              <p className="text-sm text-gray-600 mb-4">
                {policyDoc.metadata.category} • {policyDoc.metadata.tags.join(', ')}
              </p>
              
              <div className="flex items-center justify-between">
                <a
                  href={`/policies/${policyDoc.type}`}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Read Policy →
                </a>
                
                {policyDoc.requiresAcceptance && (
                  <span className="text-xs text-gray-500">
                    Acceptance Required
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Policy Acceptance Modal */}
      {showModal && requiredPolicies.length > 0 && userId && (
        <PolicyAcceptanceModal
          policies={requiredPolicies}
          userId={userId}
          onAccept={handleAcceptPolicy}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default PolicyDisplay;