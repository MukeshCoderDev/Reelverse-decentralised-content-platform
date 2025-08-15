import React, { useState, useCallback } from 'react';
import Button from '../Button';
import Icon from '../Icon';
import { useWallet } from '../../contexts/WalletContext';
import ConsentStepper, { ConsentData } from './ConsentStepper';

export interface UploadStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export interface UploadOptions {
  storageClass: 'shreddable' | 'permanent';
  enableEncryption: boolean;
  enableWatermarking: boolean;
  title: string;
  description: string;
  tags: string[];
  ageRating: '18+' | '21+';
  geoRestrictions: string[];
  requiresConsent: boolean;
  consentCompleted: boolean;
}

interface UploadWizardProps {
  onComplete: (contentId: string) => void;
  onCancel: () => void;
}

const UploadWizard: React.FC<UploadWizardProps> = ({ onComplete, onCancel }) => {
  const { account } = useWallet();
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadOptions, setUploadOptions] = useState<UploadOptions>({
    storageClass: 'shreddable',
    enableEncryption: true,
    enableWatermarking: true,
    title: '',
    description: '',
    tags: [],
    ageRating: '18+',
    geoRestrictions: [],
    requiresConsent: false,
    consentCompleted: false,
  });
  const [consentData, setConsentData] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const steps: UploadStep[] = [
    {
      id: 'file-select',
      title: 'Select File',
      description: 'Choose your video file to upload',
      status: currentStep === 0 ? 'active' : currentStep > 0 ? 'completed' : 'pending',
    },
    {
      id: 'options',
      title: 'Upload Options',
      description: 'Configure storage and processing options',
      status: currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : 'pending',
    },
    {
      id: 'metadata',
      title: 'Content Details',
      description: 'Add title, description, and tags',
      status: currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : 'pending',
    },
    {
      id: 'consent',
      title: 'Participant Consent',
      description: 'Collect consent from all participants',
      status: currentStep === 3 ? 'active' : currentStep > 3 ? 'completed' : 'pending',
    },
    {
      id: 'processing',
      title: 'Processing',
      description: 'Upload, encrypt, and process your content',
      status: currentStep === 4 ? 'active' : currentStep > 4 ? 'completed' : 'pending',
    },
  ];

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        setError('Please select a valid video file');
        return;
      }

      // Validate file size (max 2GB for demo)
      if (file.size > 2 * 1024 * 1024 * 1024) {
        setError('File size must be less than 2GB');
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStartProcessing = async () => {
    if (!selectedFile || !account) return;

    // Check if consent is required but not completed
    if (uploadOptions.requiresConsent && !uploadOptions.consentCompleted) {
      setError('Participant consent must be completed before uploading');
      return;
    }

    try {
      setIsProcessing(true);
      setCurrentStep(uploadOptions.requiresConsent ? 4 : 3);
      setError(null);

      // Simulate upload and processing steps
      await simulateUploadProcess();

      // Mock content ID - in real implementation this would come from the backend
      const mockContentId = `content_${Date.now()}`;
      onComplete(mockContentId);
    } catch (error: any) {
      setError(error.message || 'Upload failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConsentComplete = (consentData: ConsentData) => {
    setConsentData(consentData);
    setUploadOptions(prev => ({ ...prev, consentCompleted: true }));
    setCurrentStep(4); // Move to processing step
    handleStartProcessing();
  };

  const handleConsentCancel = () => {
    setCurrentStep(2); // Go back to metadata step
  };

  const simulateUploadProcess = async () => {
    const steps = [
      { name: 'Uploading file...', duration: 2000 },
      { name: 'Encrypting content...', duration: 1500 },
      { name: 'Transcoding video...', duration: 3000 },
      { name: 'Applying watermarks...', duration: 1000 },
      { name: 'Computing perceptual hash...', duration: 800 },
      { name: 'Registering on blockchain...', duration: 1200 },
    ];

    let progress = 0;
    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, step.duration));
      progress += 100 / steps.length;
      setUploadProgress(Math.min(progress, 100));
    }
  };

  const renderFileSelect = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
          <input
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="flex flex-col items-center">
              <Icon name="upload" size={48} className="text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {selectedFile ? selectedFile.name : 'Choose a video file'}
              </p>
              <p className="text-sm text-gray-500">
                {selectedFile 
                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
                  : 'MP4, MOV, AVI up to 2GB'
                }
              </p>
            </div>
          </label>
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

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={!selectedFile}>
          Next
        </Button>
      </div>
    </div>
  );

  const renderOptions = () => (
    <div className="space-y-6">
      {/* Storage Class Selection */}
      <div>
        <h3 className="text-lg font-medium mb-4">Storage Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              uploadOptions.storageClass === 'shreddable' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setUploadOptions(prev => ({ ...prev, storageClass: 'shreddable' }))}
          >
            <div className="flex items-center gap-3 mb-2">
              <Icon name="trash-2" size={20} className="text-gray-600" />
              <h4 className="font-medium">Shreddable Storage</h4>
            </div>
            <p className="text-sm text-gray-600">
              Content can be permanently deleted when needed. Lower cost, suitable for most content.
            </p>
          </div>

          <div 
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              uploadOptions.storageClass === 'permanent' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setUploadOptions(prev => ({ ...prev, storageClass: 'permanent' }))}
          >
            <div className="flex items-center gap-3 mb-2">
              <Icon name="archive" size={20} className="text-gray-600" />
              <h4 className="font-medium">Permanent Storage</h4>
            </div>
            <p className="text-sm text-gray-600">
              Content stored permanently on Arweave. Higher cost, immutable storage.
            </p>
          </div>
        </div>
      </div>

      {/* Processing Options */}
      <div>
        <h3 className="text-lg font-medium mb-4">Processing Options</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={uploadOptions.enableEncryption}
              onChange={(e) => setUploadOptions(prev => ({ ...prev, enableEncryption: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <div>
              <span className="font-medium">Enable Encryption</span>
              <p className="text-sm text-gray-600">Encrypt content with AES-128 CENC for security</p>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={uploadOptions.enableWatermarking}
              onChange={(e) => setUploadOptions(prev => ({ ...prev, enableWatermarking: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <div>
              <span className="font-medium">Enable Watermarking</span>
              <p className="text-sm text-gray-600">Add dynamic watermarks during playback</p>
            </div>
          </label>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>
        <Button onClick={handleNext}>
          Next
        </Button>
      </div>
    </div>
  );

  const renderMetadata = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Title *
        </label>
        <input
          type="text"
          value={uploadOptions.title}
          onChange={(e) => setUploadOptions(prev => ({ ...prev, title: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter content title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={uploadOptions.description}
          onChange={(e) => setUploadOptions(prev => ({ ...prev, description: e.target.value }))}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Describe your content"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Age Rating *
        </label>
        <select
          value={uploadOptions.ageRating}
          onChange={(e) => setUploadOptions(prev => ({ ...prev, ageRating: e.target.value as '18+' | '21+' }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="18+">18+ (Adult Content)</option>
          <option value="21+">21+ (Explicit Content)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tags
        </label>
        <input
          type="text"
          placeholder="Enter tags separated by commas"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const value = e.currentTarget.value.trim();
              if (value) {
                setUploadOptions(prev => ({ 
                  ...prev, 
                  tags: [...prev.tags, value] 
                }));
                e.currentTarget.value = '';
              }
            }
          }}
        />
        {uploadOptions.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {uploadOptions.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
              >
                {tag}
                <button
                  onClick={() => setUploadOptions(prev => ({
                    ...prev,
                    tags: prev.tags.filter((_, i) => i !== index)
                  }))}
                  className="hover:text-blue-900"
                >
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={uploadOptions.requiresConsent}
            onChange={(e) => setUploadOptions(prev => ({ ...prev, requiresConsent: e.target.checked }))}
            className="rounded border-gray-300"
          />
          <div>
            <span className="font-medium">Requires Participant Consent</span>
            <p className="text-sm text-gray-600">Check this if other people appear in your content and need to provide consent</p>
          </div>
        </label>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>
        <Button 
          onClick={uploadOptions.requiresConsent ? handleNext : handleStartProcessing} 
          disabled={!uploadOptions.title.trim()}
        >
          {uploadOptions.requiresConsent ? 'Next: Consent' : 'Start Upload'}
        </Button>
      </div>
    </div>
  );

  const renderProcessing = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mb-4">
          <Icon name="upload" size={48} className="text-blue-500 mx-auto" />
        </div>
        <h3 className="text-lg font-medium mb-2">Processing Your Content</h3>
        <p className="text-gray-600">
          Please wait while we upload, encrypt, and process your video.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Upload Progress</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium mb-2">Processing Steps:</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>✓ File validation and upload</li>
            {uploadOptions.enableEncryption && <li>✓ AES-128 CENC encryption</li>}
            <li>✓ Livepeer transcoding to multiple qualities</li>
            {uploadOptions.enableWatermarking && <li>✓ Dynamic watermark template creation</li>}
            <li>✓ Perceptual hash computation for anti-piracy</li>
            <li>✓ Blockchain content registration</li>
          </ul>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <Icon name="alert-circle" size={20} />
            <span className="font-medium">Upload Failed</span>
          </div>
          <p className="text-red-600 mt-1">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentStep(0)}
            className="mt-3"
          >
            Start Over
          </Button>
        </div>
      )}
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
                step.status === 'completed' 
                  ? 'bg-green-500 text-white' 
                  : step.status === 'active'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {step.status === 'completed' ? (
                  <Icon name="check" size={16} />
                ) : (
                  index + 1
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${
                  step.status === 'active' ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-px mx-4 ${
                  step.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {currentStep === 0 && renderFileSelect()}
        {currentStep === 1 && renderOptions()}
        {currentStep === 2 && renderMetadata()}
        {currentStep === 3 && uploadOptions.requiresConsent && (
          <ConsentStepper
            sceneHash={`scene_${Date.now()}`}
            contentTitle={uploadOptions.title}
            contentDescription={uploadOptions.description}
            onComplete={handleConsentComplete}
            onCancel={handleConsentCancel}
          />
        )}
        {((currentStep === 3 && !uploadOptions.requiresConsent) || currentStep === 4) && renderProcessing()}
      </div>

      {/* Cancel Button */}
      {((currentStep < 3) || (currentStep === 3 && uploadOptions.requiresConsent)) && (
        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={onCancel}>
            Cancel Upload
          </Button>
        </div>
      )}
    </div>
  );
};

export default UploadWizard;