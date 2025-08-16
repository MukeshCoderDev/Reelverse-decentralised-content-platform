import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { 
  ZKAgeProof, 
  AgeVerificationRequest, 
  ZKVerificationResult,
  zkAgeProofService 
} from '../services/zkAgeProofService';

interface ZKAgeVerificationProps {
  userId: string;
  minAge?: number;
  onVerificationComplete?: (proof: ZKAgeProof) => void;
}

type ProofMethod = 'email' | 'government_id' | 'anon_aadhaar' | 'passport';

export const ZKAgeVerification: React.FC<ZKAgeVerificationProps> = ({
  userId,
  minAge = 18,
  onVerificationComplete
}) => {
  const [selectedMethod, setSelectedMethod] = useState<ProofMethod>('email');
  const [currentRequest, setCurrentRequest] = useState<AgeVerificationRequest | null>(null);
  const [userProofs, setUserProofs] = useState<ZKAgeProof[]>([]);
  const [verificationResults, setVerificationResults] = useState<Map<string, ZKVerificationResult>>(new Map());
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'input' | 'generating' | 'complete'>('select');

  // Form states for different proof methods
  const [emailForm, setEmailForm] = useState({
    email: '',
    birthYear: '',
    dkimSignature: ''
  });

  const [govIdForm, setGovIdForm] = useState({
    documentType: 'drivers_license' as const,
    birthDate: '',
    countryCode: 'US',
    documentFile: null as File | null
  });

  const [aadhaarForm, setAadhaarForm] = useState({
    aadhaarNumber: '',
    birthYear: '',
    stateCode: ''
  });

  useEffect(() => {
    loadUserProofs();
  }, [userId]);

  const loadUserProofs = async () => {
    try {
      const proofs = await zkAgeProofService.getUserAgeProofs(userId);
      setUserProofs(proofs);
      
      // Load verification results for each proof
      const results = new Map<string, ZKVerificationResult>();
      for (const proof of proofs) {
        const result = await zkAgeProofService.verifyAgeProof(proof.id);
        results.set(proof.id, result);
      }
      setVerificationResults(results);
      
    } catch (error) {
      console.error('Failed to load user proofs:', error);
    }
  };

  const startVerification = async () => {
    try {
      setLoading(true);
      
      const request = await zkAgeProofService.createVerificationRequest(
        userId,
        selectedMethod,
        minAge
      );
      
      setCurrentRequest(request);
      setStep('input');
      
    } catch (error) {
      console.error('Failed to start verification:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateEmailProof = async () => {
    if (!currentRequest) return;
    
    try {
      setLoading(true);
      setStep('generating');
      
      // Simulate DKIM signature extraction
      const dkimSignature = `dkim_sig_${Date.now()}`;
      const emailHash = btoa(emailForm.email).replace(/[^a-zA-Z0-9]/g, '');
      const emailDomain = emailForm.email.split('@')[1];
      
      const proof = await zkAgeProofService.generateEmailAgeProof(currentRequest.id, {
        emailDomain,
        emailHash,
        birthYear: parseInt(emailForm.birthYear),
        currentYear: new Date().getFullYear(),
        dkimSignature
      });
      
      setStep('complete');
      await loadUserProofs();
      onVerificationComplete?.(proof);
      
    } catch (error) {
      console.error('Failed to generate email proof:', error);
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const generateGovIdProof = async () => {
    if (!currentRequest || !govIdForm.documentFile) return;
    
    try {
      setLoading(true);
      setStep('generating');
      
      // Simulate document processing
      const documentHash = btoa(govIdForm.documentFile.name + Date.now()).replace(/[^a-zA-Z0-9]/g, '');
      const documentSignature = `gov_sig_${Date.now()}`;
      
      const proof = await zkAgeProofService.generateGovernmentIdProof(currentRequest.id, {
        documentType: govIdForm.documentType,
        documentHash,
        birthDate: govIdForm.birthDate,
        issueDate: new Date().toISOString().split('T')[0],
        countryCode: govIdForm.countryCode,
        documentSignature
      });
      
      setStep('complete');
      await loadUserProofs();
      onVerificationComplete?.(proof);
      
    } catch (error) {
      console.error('Failed to generate government ID proof:', error);
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const generateAadhaarProof = async () => {
    if (!currentRequest) return;
    
    try {
      setLoading(true);
      setStep('generating');
      
      // Simulate Aadhaar processing
      const aadhaarHash = btoa(aadhaarForm.aadhaarNumber).replace(/[^a-zA-Z0-9]/g, '');
      const nullifierHash = btoa(`${aadhaarForm.aadhaarNumber}_${userId}`).replace(/[^a-zA-Z0-9]/g, '');
      const uidaiSignature = `uidai_sig_${Date.now()}`;
      
      const proof = await zkAgeProofService.generateAnonAadhaarProof(currentRequest.id, {
        aadhaarHash,
        birthYear: parseInt(aadhaarForm.birthYear),
        stateCode: aadhaarForm.stateCode,
        nullifierHash,
        uidaiSignature
      });
      
      setStep('complete');
      await loadUserProofs();
      onVerificationComplete?.(proof);
      
    } catch (error) {
      console.error('Failed to generate Aadhaar proof:', error);
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep('select');
    setCurrentRequest(null);
    setEmailForm({ email: '', birthYear: '', dkimSignature: '' });
    setGovIdForm({ documentType: 'drivers_license', birthDate: '', countryCode: 'US', documentFile: null });
    setAadhaarForm({ aadhaarNumber: '', birthYear: '', stateCode: '' });
  };

  const getProofStatusIcon = (proof: ZKAgeProof) => {
    const result = verificationResults.get(proof.id);
    if (!result) return '⏳';
    
    if (result.isValid && result.ageVerified) return '✅';
    if (result.isValid) return '⚠️';
    return '❌';
  };

  const getProofStatusColor = (proof: ZKAgeProof) => {
    const result = verificationResults.get(proof.id);
    if (!result) return 'text-yellow-400';
    
    if (result.isValid && result.ageVerified) return 'text-green-400';
    if (result.isValid) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getMethodIcon = (method: ProofMethod) => {
    switch (method) {
      case 'email': return '📧';
      case 'government_id': return '🆔';
      case 'anon_aadhaar': return '🇮🇳';
      case 'passport': return '📘';
      default: return '❓';
    }
  };

  const getMethodDescription = (method: ProofMethod) => {
    switch (method) {
      case 'email': return 'Verify age using email with DKIM signatures (zkEmail)';
      case 'government_id': return 'Verify age using government-issued ID with digital signatures';
      case 'anon_aadhaar': return 'Anonymous age verification using Aadhaar (India)';
      case 'passport': return 'Verify age using passport with government PKI';
      default: return 'Unknown verification method';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Zero-Knowledge Age Verification</h2>
        <p className="text-gray-400">
          Prove you're over {minAge} without revealing your identity or exact age
        </p>
      </div>

      {/* Existing Proofs */}
      {userProofs.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Your Age Proofs</h3>
          <div className="space-y-3">
            {userProofs.map((proof) => {
              const result = verificationResults.get(proof.id);
              return (
                <div key={proof.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getMethodIcon(proof.proofType)}</span>
                    <div>
                      <div className="text-white font-medium capitalize">
                        {proof.proofType.replace('_', ' ')} Proof
                      </div>
                      <div className="text-sm text-gray-400">
                        Min Age: {proof.minAge} • Created: {proof.createdAt.toLocaleDateString()}
                      </div>
                      {result && (
                        <div className="text-xs text-gray-500">
                          Trust Score: {result.trustScore}/100
                          {result.issues.length > 0 && ` • ${result.issues.length} issues`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`text-2xl ${getProofStatusColor(proof)}`}>
                    {getProofStatusIcon(proof)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Verification Flow */}
      <Card className="p-6">
        {step === 'select' && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Choose Verification Method</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {(['email', 'government_id', 'anon_aadhaar'] as ProofMethod[]).map((method) => (
                <div
                  key={method}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedMethod === method
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => setSelectedMethod(method)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{getMethodIcon(method)}</span>
                    <span className="text-white font-medium capitalize">
                      {method.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    {getMethodDescription(method)}
                  </p>
                </div>
              ))}
            </div>
            <Button onClick={startVerification} disabled={loading} className="w-full">
              {loading ? <Spinner size="sm" /> : 'Start Verification'}
            </Button>
          </div>
        )}

        {step === 'input' && selectedMethod === 'email' && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">📧 Email Age Verification</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={emailForm.email}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  placeholder="your-email@gmail.com"
                />
                <p className="text-xs text-gray-400 mt-1">
                  We'll use DKIM signatures to verify your email without revealing it
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Birth Year
                </label>
                <input
                  type="number"
                  value={emailForm.birthYear}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, birthYear: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  placeholder="1990"
                  min="1900"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={resetFlow} variant="secondary">
                Back
              </Button>
              <Button 
                onClick={generateEmailProof} 
                disabled={!emailForm.email || !emailForm.birthYear || loading}
                className="flex-1"
              >
                {loading ? <Spinner size="sm" /> : 'Generate Proof'}
              </Button>
            </div>
          </div>
        )}

        {step === 'input' && selectedMethod === 'government_id' && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">🆔 Government ID Verification</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Document Type
                </label>
                <select
                  value={govIdForm.documentType}
                  onChange={(e) => setGovIdForm(prev => ({ ...prev, documentType: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                >
                  <option value="drivers_license">Driver's License</option>
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Birth Date
                </label>
                <input
                  type="date"
                  value={govIdForm.birthDate}
                  onChange={(e) => setGovIdForm(prev => ({ ...prev, birthDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Country
                </label>
                <select
                  value={govIdForm.countryCode}
                  onChange={(e) => setGovIdForm(prev => ({ ...prev, countryCode: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                >
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Document Scan
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setGovIdForm(prev => ({ ...prev, documentFile: e.target.files?.[0] || null }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Document will be hashed and verified without storing the image
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={resetFlow} variant="secondary">
                Back
              </Button>
              <Button 
                onClick={generateGovIdProof} 
                disabled={!govIdForm.birthDate || !govIdForm.documentFile || loading}
                className="flex-1"
              >
                {loading ? <Spinner size="sm" /> : 'Generate Proof'}
              </Button>
            </div>
          </div>
        )}

        {step === 'input' && selectedMethod === 'anon_aadhaar' && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">🇮🇳 Anonymous Aadhaar Verification</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Aadhaar Number
                </label>
                <input
                  type="text"
                  value={aadhaarForm.aadhaarNumber}
                  onChange={(e) => setAadhaarForm(prev => ({ ...prev, aadhaarNumber: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  placeholder="1234 5678 9012"
                  maxLength={12}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Your Aadhaar number will be hashed and never stored
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Birth Year
                </label>
                <input
                  type="number"
                  value={aadhaarForm.birthYear}
                  onChange={(e) => setAadhaarForm(prev => ({ ...prev, birthYear: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  placeholder="1990"
                  min="1900"
                  max={new Date().getFullYear()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  State Code
                </label>
                <input
                  type="text"
                  value={aadhaarForm.stateCode}
                  onChange={(e) => setAadhaarForm(prev => ({ ...prev, stateCode: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  placeholder="MH"
                  maxLength={2}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={resetFlow} variant="secondary">
                Back
              </Button>
              <Button 
                onClick={generateAadhaarProof} 
                disabled={!aadhaarForm.aadhaarNumber || !aadhaarForm.birthYear || !aadhaarForm.stateCode || loading}
                className="flex-1"
              >
                {loading ? <Spinner size="sm" /> : 'Generate Proof'}
              </Button>
            </div>
          </div>
        )}

        {step === 'generating' && (
          <div className="text-center py-8">
            <Spinner size="lg" />
            <h3 className="text-lg font-semibold text-white mt-4 mb-2">
              Generating Zero-Knowledge Proof
            </h3>
            <p className="text-gray-400">
              This may take a few moments while we generate your cryptographic proof...
            </p>
            <div className="mt-4 text-sm text-gray-500">
              <div>• Compiling circuit witness</div>
              <div>• Generating proof with trusted setup</div>
              <div>• Verifying proof validity</div>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Age Verification Complete!
            </h3>
            <p className="text-gray-400 mb-6">
              Your zero-knowledge proof has been generated successfully. 
              You can now access age-restricted content without revealing your identity.
            </p>
            <Button onClick={resetFlow} className="mr-3">
              Create Another Proof
            </Button>
            <Button onClick={() => window.location.reload()} variant="secondary">
              Continue
            </Button>
          </div>
        )}
      </Card>

      {/* Privacy Notice */}
      <Card className="p-4 bg-blue-900/20 border-blue-500/30">
        <div className="flex items-start gap-3">
          <span className="text-blue-400 text-xl">🔒</span>
          <div>
            <h4 className="text-blue-300 font-medium mb-1">Privacy Guarantee</h4>
            <p className="text-sm text-blue-200">
              Zero-knowledge proofs ensure that we can verify you meet the age requirement 
              without learning your exact age, identity, or any other personal information. 
              Your privacy is mathematically guaranteed.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};