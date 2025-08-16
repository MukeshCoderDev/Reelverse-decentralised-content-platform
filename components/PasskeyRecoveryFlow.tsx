import React, { useState } from 'react';
import { passkeyRecoveryService, RecoverySession, RecoveryMethod } from '../services/passkeyRecoveryService';

interface RecoveryFlowProps {
  onRecoveryComplete?: (deviceId: string) => void;
  onCancel?: () => void;
}

type RecoveryStep = 'method_selection' | 'verification' | 'device_setup' | 'complete';

export const PasskeyRecoveryFlow: React.FC<RecoveryFlowProps> = ({
  onRecoveryComplete,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState<RecoveryStep>('method_selection');
  const [selectedMethod, setSelectedMethod] = useState<RecoveryMethod['type']>('email');
  const [identifier, setIdentifier] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [recoverySession, setRecoverySession] = useState<RecoverySession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deviceInfo, setDeviceInfo] = useState({
    name: '',
    type: 'phone'
  });

  const handleInitiateRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const session = await passkeyRecoveryService.initiateRecovery(identifier, selectedMethod);
      setRecoverySession(session);
      setCurrentStep('verification');
    } catch (err: any) {
      setError(err.message || 'Failed to initiate recovery');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverySession) return;

    setLoading(true);
    setError('');

    try {
      await passkeyRecoveryService.verifyRecoveryCode(recoverySession.id, verificationCode);
      setCurrentStep('device_setup');
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverySession) return;

    setLoading(true);
    setError('');

    try {
      const newDevice = await passkeyRecoveryService.completeRecovery(recoverySession.id, {
        name: deviceInfo.name,
        type: deviceInfo.type,
        platform: navigator.platform,
        userAgent: navigator.userAgent
      });

      setCurrentStep('complete');
      onRecoveryComplete?.(newDevice.id);
    } catch (err: any) {
      setError(err.message || 'Failed to complete recovery');
    } finally {
      setLoading(false);
    }
  };

  const renderMethodSelection = () => (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">🔑</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Recovery</h2>
        <p className="text-gray-600">Choose how you'd like to recover your account</p>
      </div>

      <form onSubmit={handleInitiateRecovery} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recovery Method
          </label>
          <div className="space-y-2">
            {[
              { value: 'email', label: 'Email Address', icon: '📧' },
              { value: 'sms', label: 'SMS/Phone Number', icon: '📱' },
              { value: 'backup_codes', label: 'Backup Codes', icon: '🔢' }
            ].map((method) => (
              <label key={method.value} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="recoveryMethod"
                  value={method.value}
                  checked={selectedMethod === method.value}
                  onChange={(e) => setSelectedMethod(e.target.value as RecoveryMethod['type'])}
                  className="mr-3"
                />
                <span className="text-xl mr-3">{method.icon}</span>
                <span className="text-sm font-medium text-gray-900">{method.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {selectedMethod === 'email' ? 'Email Address' : 
             selectedMethod === 'sms' ? 'Phone Number' : 
             'Backup Code'}
          </label>
          <input
            type={selectedMethod === 'email' ? 'email' : 'text'}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={
              selectedMethod === 'email' ? 'your@email.com' :
              selectedMethod === 'sms' ? '+1234567890' :
              'Enter backup code'
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex">
              <span className="text-red-400 mr-2">⚠</span>
              <span className="text-sm text-red-700">{error}</span>
            </div>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending...' : 'Send Recovery Code'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  const renderVerification = () => (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">📧</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your {selectedMethod === 'email' ? 'Email' : 'Phone'}</h2>
        <p className="text-gray-600">
          We sent a verification code to{' '}
          <span className="font-medium">{identifier}</span>
        </p>
      </div>

      <form onSubmit={handleVerifyCode} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Verification Code
          </label>
          <input
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="Enter 6-digit code"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest"
            maxLength={6}
            required
          />
        </div>

        {recoverySession && (
          <div className="text-sm text-gray-500 text-center">
            Code expires in {Math.max(0, Math.floor((recoverySession.expiresAt.getTime() - Date.now()) / 60000))} minutes
            <br />
            Attempts remaining: {recoverySession.maxAttempts - recoverySession.attempts}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex">
              <span className="text-red-400 mr-2">⚠</span>
              <span className="text-sm text-red-700">{error}</span>
            </div>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={loading || verificationCode.length !== 6}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep('method_selection')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
          >
            Back
          </button>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setCurrentStep('method_selection');
              setError('');
            }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Didn't receive the code? Try a different method
          </button>
        </div>
      </form>
    </div>
  );

  const renderDeviceSetup = () => (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">📱</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Up New Device</h2>
        <p className="text-gray-600">Give your new device a name and configure passkey access</p>
      </div>

      <form onSubmit={handleCompleteRecovery} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Device Name
          </label>
          <input
            type="text"
            value={deviceInfo.name}
            onChange={(e) => setDeviceInfo({ ...deviceInfo, name: e.target.value })}
            placeholder="e.g., My iPhone, Work Laptop"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Device Type
          </label>
          <select
            value={deviceInfo.type}
            onChange={(e) => setDeviceInfo({ ...deviceInfo, type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="phone">Phone</option>
            <option value="tablet">Tablet</option>
            <option value="laptop">Laptop</option>
            <option value="desktop">Desktop</option>
            <option value="security_key">Security Key</option>
          </select>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex">
            <span className="text-blue-400 mr-2">ℹ</span>
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">Next Steps:</p>
              <p>After clicking "Complete Recovery", you'll be prompted to create a new passkey for this device using your device's built-in authentication (Face ID, Touch ID, Windows Hello, etc.).</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex">
              <span className="text-red-400 mr-2">⚠</span>
              <span className="text-sm text-red-700">{error}</span>
            </div>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Setting Up...' : 'Complete Recovery'}
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep('verification')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );

  const renderComplete = () => (
    <div className="max-w-md mx-auto text-center">
      <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
        <span className="text-3xl">✅</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Recovery Complete!</h2>
      <p className="text-gray-600 mb-6">
        Your account has been successfully recovered and a new passkey has been set up for this device.
      </p>
      
      <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
        <div className="flex">
          <span className="text-green-400 mr-2">✓</span>
          <div className="text-sm text-green-700 text-left">
            <p className="font-medium mb-2">What's Next:</p>
            <ul className="space-y-1">
              <li>• Your new device is now registered and trusted</li>
              <li>• Consider adding additional recovery methods</li>
              <li>• Review your device list in account settings</li>
              <li>• Set up additional security measures if needed</li>
            </ul>
          </div>
        </div>
      </div>

      <button
        onClick={() => onRecoveryComplete?.(recoverySession?.userId || '')}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
      >
        Continue to Account
      </button>
    </div>
  );

  const renderProgressBar = () => {
    const steps = [
      { id: 'method_selection', label: 'Method' },
      { id: 'verification', label: 'Verify' },
      { id: 'device_setup', label: 'Setup' },
      { id: 'complete', label: 'Complete' }
    ];

    const currentStepIndex = steps.findIndex(step => step.id === currentStep);

    return (
      <div className="mb-8">
        <div className="flex items-center justify-center">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= currentStepIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {index < currentStepIndex ? '✓' : index + 1}
                </div>
                <span className="text-xs text-gray-500 mt-1">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-2 ${
                  index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {renderProgressBar()}
        
        <div className="bg-white rounded-lg shadow-sm p-8">
          {currentStep === 'method_selection' && renderMethodSelection()}
          {currentStep === 'verification' && renderVerification()}
          {currentStep === 'device_setup' && renderDeviceSetup()}
          {currentStep === 'complete' && renderComplete()}
        </div>
      </div>
    </div>
  );
};