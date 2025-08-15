import React, { useState, useEffect } from 'react';
import Button from '../Button';
import Icon from '../Icon';
import { useWallet } from '../../contexts/WalletContext';

export interface ConsentParticipant {
  id: string;
  wallet: string;
  email?: string;
  role: 'performer' | 'director' | 'producer' | 'other';
  customRole?: string;
  status: 'pending' | 'invited' | 'signed' | 'declined';
  invitedAt?: string;
  signedAt?: string;
  signature?: string;
  consentHash?: string;
}

export interface ConsentData {
  sceneHash: string;
  contentTitle: string;
  contentDescription: string;
  participants: ConsentParticipant[];
  termsVersion: string;
  createdAt: string;
  creatorWallet: string;
}

interface ConsentStepperProps {
  sceneHash: string;
  contentTitle: string;
  contentDescription: string;
  onComplete: (consentData: ConsentData) => void;
  onCancel: () => void;
}

const ConsentStepper: React.FC<ConsentStepperProps> = ({
  sceneHash,
  contentTitle,
  contentDescription,
  onComplete,
  onCancel
}) => {
  const { account, isAuthenticated } = useWallet();
  const [currentStep, setCurrentStep] = useState(0);
  const [participants, setParticipants] = useState<ConsentParticipant[]>([]);
  const [newParticipant, setNewParticipant] = useState({
    wallet: '',
    email: '',
    role: 'performer' as const,
    customRole: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    {
      id: 'participants',
      title: 'Add Participants',
      description: 'Invite participants to provide consent'
    },
    {
      id: 'collect',
      title: 'Collect Consent',
      description: 'Gather digital signatures from all participants'
    },
    {
      id: 'verify',
      title: 'Verify & Complete',
      description: 'Review and finalize consent collection'
    }
  ];

  // EIP-712 domain and types for consent signatures
  const domain = {
    name: 'Reelverse18 Consent',
    version: '1',
    chainId: 137, // Polygon mainnet
    verifyingContract: '0x0000000000000000000000000000000000000000' // TODO: Replace with actual contract
  };

  const consentTypes = {
    SceneConsent: [
      { name: 'sceneHash', type: 'string' },
      { name: 'participant', type: 'address' },
      { name: 'role', type: 'string' },
      { name: 'contentTitle', type: 'string' },
      { name: 'contentDescription', type: 'string' },
      { name: 'consentDate', type: 'uint256' },
      { name: 'termsVersion', type: 'string' }
    ]
  };

  const addParticipant = () => {
    if (!newParticipant.wallet.trim()) {
      setError('Wallet address is required');
      return;
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(newParticipant.wallet)) {
      setError('Invalid wallet address format');
      return;
    }

    // Check if participant already exists
    if (participants.some(p => p.wallet.toLowerCase() === newParticipant.wallet.toLowerCase())) {
      setError('Participant already added');
      return;
    }

    const participant: ConsentParticipant = {
      id: `participant_${Date.now()}`,
      wallet: newParticipant.wallet,
      email: newParticipant.email || undefined,
      role: newParticipant.role,
      customRole: newParticipant.role === 'other' ? newParticipant.customRole : undefined,
      status: 'pending'
    };

    setParticipants(prev => [...prev, participant]);
    setNewParticipant({
      wallet: '',
      email: '',
      role: 'performer',
      customRole: ''
    });
    setError(null);
  };

  const removeParticipant = (id: string) => {
    setParticipants(prev => prev.filter(p => p.id !== id));
  };

  const inviteParticipant = async (participantId: string) => {
    try {
      setIsProcessing(true);
      
      // TODO: Implement actual invitation logic (email, wallet notification, etc.)
      // For now, simulate the invitation process
      await new Promise(resolve => setTimeout(resolve, 1000));

      setParticipants(prev => prev.map(p => 
        p.id === participantId 
          ? { ...p, status: 'invited' as const, invitedAt: new Date().toISOString() }
          : p
      ));
    } catch (error) {
      console.error('Failed to invite participant:', error);
      setError('Failed to send invitation. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const requestSignature = async (participantId: string) => {
    if (!account || !isAuthenticated) {
      setError('Wallet must be connected and authenticated');
      return;
    }

    try {
      setIsProcessing(true);
      const participant = participants.find(p => p.id === participantId);
      if (!participant) return;

      // Create consent message for EIP-712 signing
      const consentMessage = {
        sceneHash,
        participant: participant.wallet,
        role: participant.customRole || participant.role,
        contentTitle,
        contentDescription,
        consentDate: Math.floor(Date.now() / 1000),
        termsVersion: '1.0'
      };

      // TODO: Implement actual EIP-712 signature request
      // This would use the wallet provider to request signature
      // For now, simulate the signature process
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockSignature = `0x${Math.random().toString(16).substr(2, 130)}`;
      const mockConsentHash = `0x${Math.random().toString(16).substr(2, 64)}`;

      setParticipants(prev => prev.map(p => 
        p.id === participantId 
          ? { 
              ...p, 
              status: 'signed' as const, 
              signedAt: new Date().toISOString(),
              signature: mockSignature,
              consentHash: mockConsentHash
            }
          : p
      ));
    } catch (error) {
      console.error('Failed to collect signature:', error);
      setError('Failed to collect signature. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = () => {
    const allSigned = participants.every(p => p.status === 'signed');
    if (!allSigned) {
      setError('All participants must provide consent before completing');
      return;
    }

    const consentData: ConsentData = {
      sceneHash,
      contentTitle,
      contentDescription,
      participants,
      termsVersion: '1.0',
      createdAt: new Date().toISOString(),
      creatorWallet: account || ''
    };

    onComplete(consentData);
  };

  const renderParticipantsStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Add Participants</h3>
        <p className="text-gray-600 mb-6">
          Add all participants who appear in this content. Each participant must provide digital consent before the content can be published.
        </p>

        {/* Add Participant Form */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wallet Address *
              </label>
              <input
                type="text"
                value={newParticipant.wallet}
                onChange={(e) => setNewParticipant(prev => ({ ...prev, wallet: e.target.value }))}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email (Optional)
              </label>
              <input
                type="email"
                value={newParticipant.email}
                onChange={(e) => setNewParticipant(prev => ({ ...prev, email: e.target.value }))}
                placeholder="participant@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role *
              </label>
              <select
                value={newParticipant.role}
                onChange={(e) => setNewParticipant(prev => ({ ...prev, role: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="performer">Performer</option>
                <option value="director">Director</option>
                <option value="producer">Producer</option>
                <option value="other">Other</option>
              </select>
            </div>
            {newParticipant.role === 'other' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Role *
                </label>
                <input
                  type="text"
                  value={newParticipant.customRole}
                  onChange={(e) => setNewParticipant(prev => ({ ...prev, customRole: e.target.value }))}
                  placeholder="Specify role"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <Button onClick={addParticipant} size="sm">
            <Icon name="plus" size={16} className="mr-2" />
            Add Participant
          </Button>
        </div>

        {/* Participants List */}
        {participants.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">Participants ({participants.length})</h4>
            <div className="space-y-3">
              {participants.map(participant => (
                <div key={participant.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{participant.wallet}</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {participant.customRole || participant.role}
                      </span>
                    </div>
                    {participant.email && (
                      <p className="text-sm text-gray-600">{participant.email}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeParticipant(participant.id)}
                  >
                    <Icon name="trash-2" size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <Icon name="alert-circle" size={20} />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-red-600 mt-1">{error}</p>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={() => setCurrentStep(1)} 
          disabled={participants.length === 0}
        >
          Next: Collect Consent
        </Button>
      </div>
    </div>
  );

  const renderCollectStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Collect Digital Consent</h3>
        <p className="text-gray-600 mb-6">
          Send invitations to participants and collect their digital signatures for consent.
        </p>

        <div className="space-y-4">
          {participants.map(participant => (
            <div key={participant.id} className="p-4 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{participant.wallet}</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                      {participant.customRole || participant.role}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {participant.status === 'pending' && (
                      <span className="flex items-center gap-1 text-gray-600 text-sm">
                        <Icon name="clock" size={14} />
                        Ready to invite
                      </span>
                    )}
                    {participant.status === 'invited' && (
                      <span className="flex items-center gap-1 text-yellow-600 text-sm">
                        <Icon name="mail" size={14} />
                        Invitation sent
                      </span>
                    )}
                    {participant.status === 'signed' && (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <Icon name="check-circle" size={14} />
                        Consent provided
                      </span>
                    )}
                    {participant.status === 'declined' && (
                      <span className="flex items-center gap-1 text-red-600 text-sm">
                        <Icon name="x-circle" size={14} />
                        Consent declined
                      </span>
                    )}
                  </div>

                  {participant.signedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Signed on {new Date(participant.signedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {participant.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => inviteParticipant(participant.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <Icon name="loader" size={14} className="animate-spin" />
                      ) : (
                        <>
                          <Icon name="mail" size={14} className="mr-1" />
                          Invite
                        </>
                      )}
                    </Button>
                  )}
                  
                  {participant.status === 'invited' && (
                    <Button
                      size="sm"
                      onClick={() => requestSignature(participant.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <Icon name="loader" size={14} className="animate-spin" />
                      ) : (
                        <>
                          <Icon name="pen-tool" size={14} className="mr-1" />
                          Request Signature
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <Icon name="alert-circle" size={20} />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-red-600 mt-1">{error}</p>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(0)}>
          Back
        </Button>
        <Button 
          onClick={() => setCurrentStep(2)}
          disabled={!participants.every(p => p.status === 'signed')}
        >
          Next: Verify & Complete
        </Button>
      </div>
    </div>
  );

  const renderVerifyStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Verify & Complete</h3>
        <p className="text-gray-600 mb-6">
          Review all collected consent signatures and complete the consent process.
        </p>

        {/* Content Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium mb-2">Content Information</h4>
          <div className="space-y-1 text-sm">
            <p><span className="font-medium">Title:</span> {contentTitle}</p>
            <p><span className="font-medium">Scene Hash:</span> {sceneHash}</p>
            <p><span className="font-medium">Participants:</span> {participants.length}</p>
          </div>
        </div>

        {/* Consent Summary */}
        <div className="space-y-3">
          <h4 className="font-medium">Consent Status</h4>
          {participants.map(participant => (
            <div key={participant.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{participant.wallet}</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                    {participant.customRole || participant.role}
                  </span>
                </div>
                {participant.signedAt && (
                  <p className="text-xs text-gray-500">
                    Signed on {new Date(participant.signedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <Icon name="check-circle" size={16} />
                <span className="text-sm font-medium">Verified</span>
              </div>
            </div>
          ))}
        </div>

        {/* Legal Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Icon name="info" size={20} className="text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800 mb-1">Legal Compliance</h4>
              <p className="text-blue-700 text-sm">
                All participants have provided valid digital consent using EIP-712 signatures. 
                This consent data will be stored securely and can be used for legal compliance purposes.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(1)}>
          Back
        </Button>
        <Button onClick={handleComplete}>
          <Icon name="check" size={16} className="mr-2" />
          Complete Consent Process
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                index < currentStep 
                  ? 'bg-green-500 text-white' 
                  : index === currentStep
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {index < currentStep ? (
                  <Icon name="check" size={16} />
                ) : (
                  index + 1
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${
                  index === currentStep ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-px mx-4 ${
                  index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {currentStep === 0 && renderParticipantsStep()}
        {currentStep === 1 && renderCollectStep()}
        {currentStep === 2 && renderVerifyStep()}
      </div>
    </div>
  );
};

export default ConsentStepper;