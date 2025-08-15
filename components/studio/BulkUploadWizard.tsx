import React, { useState, useCallback, useRef } from 'react';
import Button from '../Button';
import Icon from '../Icon';
import { useWallet } from '../../contexts/WalletContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { BulkUploadService, BulkUploadSettings, UploadProgress, BulkUploadBatch } from '../../services/bulkUploadService';

interface BulkUploadWizardProps {
  onComplete: (contentIds: string[]) => void;
  onCancel: () => void;
}

const BulkUploadWizard: React.FC<BulkUploadWizardProps> = ({ onComplete, onCancel }) => {
  const { account } = useWallet();
  const { currentOrganization, canUploadContent, getRemainingQuota } = useOrganization();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [invalidFiles, setInvalidFiles] = useState<Array<{ file: File; reason: string }>>([]);
  const [uploadSettings, setUploadSettings] = useState<BulkUploadSettings>({
    storageClass: 'shreddable',
    enableEncryption: true,
    enableWatermarking: true,
    autoPublish: false,
    defaultAgeRating: '18+',
    defaultTags: [],
    geoRestrictions: [],
  });
  const [currentBatch, setCurrentBatch] = useState<BulkUploadBatch | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkUploadService = BulkUploadService.getInstance();

  const steps = [
    {
      id: 'file-select',
      title: 'Select Files',
      description: 'Choose multiple video files for bulk upload',
    },
    {
      id: 'settings',
      title: 'Upload Settings',
      description: 'Configure processing and metadata options',
    },
    {
      id: 'upload',
      title: 'Upload Progress',
      description: 'Monitor upload progress and handle any issues',
    },
  ];

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate files
    const { valid, invalid } = bulkUploadService.validateFiles(files);
    
    setSelectedFiles(valid);
    setInvalidFiles(invalid);
    setError(null);

    // Check quota
    const totalSize = valid.reduce((sum, file) => sum + file.size, 0);
    const remainingQuota = getRemainingQuota() * 1024 * 1024; // Convert MB to bytes
    
    if (totalSize > remainingQuota) {
      setError(`Upload size (${bulkUploadService.formatFileSize(totalSize)}) exceeds remaining quota (${bulkUploadService.formatFileSize(remainingQuota)})`);
    }
  }, [bulkUploadService, getRemainingQuota]);

  const handleFolderSelect = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.webkitdirectory = true;
      fileInputRef.current.click();
    }
  }, []);

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartUpload = async () => {
    if (!selectedFiles.length || !account || !canUploadContent()) return;

    try {
      setIsProcessing(true);
      setCurrentStep(2);
      setError(null);

      // Initialize batch
      const batch = await bulkUploadService.initializeBatch(
        selectedFiles,
        uploadSettings,
        currentOrganization?.id
      );
      setCurrentBatch(batch);

      // Start resumable upload
      await bulkUploadService.startResumableUpload(
        batch.id,
        selectedFiles,
        (progress) => setUploadProgress(progress),
        (fileId, response) => {
          console.log('File completed:', fileId, response);
        },
        (error) => {
          console.error('Upload error:', error);
          setError(error.message);
        }
      );

      // Finalize batch when all files are uploaded
      const contentIds = await bulkUploadService.finalizeBatch(batch.id);
      onComplete(contentIds);
    } catch (error: any) {
      setError(error.message || 'Upload failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePauseResume = async () => {
    if (!currentBatch) return;

    try {
      if (isPaused) {
        await bulkUploadService.resumeUpload(currentBatch.id);
        setIsPaused(false);
      } else {
        await bulkUploadService.pauseUpload(currentBatch.id);
        setIsPaused(true);
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleCancelUpload = async () => {
    if (!currentBatch) return;

    try {
      await bulkUploadService.cancelUpload(currentBatch.id);
      onCancel();
    } catch (error: any) {
      setError(error.message);
    }
  };

  const renderFileSelect = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="bulk-file-upload"
          />
          
          <div className="flex flex-col items-center gap-4">
            <Icon name="upload" size={48} className="text-gray-400" />
            
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-900">
                {selectedFiles.length > 0 
                  ? `${selectedFiles.length} files selected`
                  : 'Choose video files for bulk upload'
                }
              </p>
              <p className="text-sm text-gray-500">
                {selectedFiles.length > 0
                  ? `Total size: ${bulkUploadService.formatFileSize(selectedFiles.reduce((sum, f) => sum + f.size, 0))}`
                  : 'Select multiple video files or an entire folder'
                }
              </p>
            </div>

            <div className="flex gap-3">
              <label htmlFor="bulk-file-upload" className="cursor-pointer">
                <Button variant="outline">
                  <Icon name="file" size={16} className="mr-2" />
                  Select Files
                </Button>
              </label>
              <Button variant="outline" onClick={handleFolderSelect}>
                <Icon name="folder" size={16} className="mr-2" />
                Select Folder
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* File List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium">Selected Files ({selectedFiles.length})</h4>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Icon name="video" size={16} className="text-gray-600" />
                  <div>
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {bulkUploadService.formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFile(index)}
                >
                  <Icon name="x" size={14} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invalid Files */}
      {invalidFiles.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-800 mb-2">Invalid Files ({invalidFiles.length})</h4>
          <div className="space-y-1">
            {invalidFiles.map((item, index) => (
              <div key={index} className="text-sm text-red-700">
                <span className="font-medium">{item.file.name}:</span> {item.reason}
              </div>
            ))}
          </div>
        </div>
      )}

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
        <Button 
          onClick={() => setCurrentStep(1)} 
          disabled={selectedFiles.length === 0 || !!error}
        >
          Next: Configure Settings
        </Button>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      {/* Storage Options */}
      <div>
        <h3 className="text-lg font-medium mb-4">Storage & Processing</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div 
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              uploadSettings.storageClass === 'shreddable' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setUploadSettings(prev => ({ ...prev, storageClass: 'shreddable' }))}
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
              uploadSettings.storageClass === 'permanent' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setUploadSettings(prev => ({ ...prev, storageClass: 'permanent' }))}
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

        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={uploadSettings.enableEncryption}
              onChange={(e) => setUploadSettings(prev => ({ ...prev, enableEncryption: e.target.checked }))}
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
              checked={uploadSettings.enableWatermarking}
              onChange={(e) => setUploadSettings(prev => ({ ...prev, enableWatermarking: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <div>
              <span className="font-medium">Enable Watermarking</span>
              <p className="text-sm text-gray-600">Add dynamic watermarks during playback</p>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={uploadSettings.autoPublish}
              onChange={(e) => setUploadSettings(prev => ({ ...prev, autoPublish: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <div>
              <span className="font-medium">Auto-Publish</span>
              <p className="text-sm text-gray-600">Automatically publish content after processing</p>
            </div>
          </label>
        </div>
      </div>

      {/* Default Metadata */}
      <div>
        <h3 className="text-lg font-medium mb-4">Default Metadata</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Age Rating
            </label>
            <select
              value={uploadSettings.defaultAgeRating}
              onChange={(e) => setUploadSettings(prev => ({ ...prev, defaultAgeRating: e.target.value as '18+' | '21+' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="18+">18+ (Adult Content)</option>
              <option value="21+">21+ (Explicit Content)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Tags
            </label>
            <input
              type="text"
              placeholder="Enter tags separated by commas"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = e.currentTarget.value.trim();
                  if (value) {
                    setUploadSettings(prev => ({ 
                      ...prev, 
                      defaultTags: [...prev.defaultTags, value] 
                    }));
                    e.currentTarget.value = '';
                  }
                }
              }}
            />
            {uploadSettings.defaultTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {uploadSettings.defaultTags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      onClick={() => setUploadSettings(prev => ({
                        ...prev,
                        defaultTags: prev.defaultTags.filter((_, i) => i !== index)
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
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(0)}>
          Back
        </Button>
        <Button onClick={handleStartUpload} disabled={!canUploadContent()}>
          Start Bulk Upload
        </Button>
      </div>
    </div>
  );

  const renderUploadProgress = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Icon name="upload" size={48} className="text-blue-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Bulk Upload in Progress</h3>
        <p className="text-gray-600">
          {isPaused ? 'Upload paused' : 'Uploading your files with resumable technology'}
        </p>
      </div>

      {uploadProgress && (
        <div className="space-y-4">
          {/* Overall Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Overall Progress</span>
              <span>{uploadProgress.completedFiles} / {uploadProgress.totalFiles} files</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(uploadProgress.completedFiles / uploadProgress.totalFiles) * 100}%` }}
              />
            </div>
          </div>

          {/* Data Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Data Uploaded</span>
              <span>
                {bulkUploadService.formatFileSize(uploadProgress.uploadedBytes)} / {bulkUploadService.formatFileSize(uploadProgress.totalBytes)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(uploadProgress.uploadedBytes / uploadProgress.totalBytes) * 100}%` }}
              />
            </div>
          </div>

          {/* Upload Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-lg font-semibold text-green-600">{uploadProgress.completedFiles}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-lg font-semibold text-red-600">{uploadProgress.failedFiles}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Speed</p>
              <p className="text-lg font-semibold text-blue-600">
                {uploadProgress.uploadSpeed ? `${bulkUploadService.formatFileSize(uploadProgress.uploadSpeed)}/s` : '-'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">ETA</p>
              <p className="text-lg font-semibold text-purple-600">
                {uploadProgress.estimatedTimeRemaining ? bulkUploadService.formatDuration(uploadProgress.estimatedTimeRemaining) : '-'}
              </p>
            </div>
          </div>

          {/* Current File */}
          {uploadProgress.currentFile && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                Currently uploading: <span className="font-medium">{uploadProgress.currentFile}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Upload Controls */}
      <div className="flex justify-center gap-3">
        <Button
          variant="outline"
          onClick={handlePauseResume}
          disabled={!currentBatch}
        >
          <Icon name={isPaused ? "play" : "pause"} size={16} className="mr-2" />
          {isPaused ? 'Resume' : 'Pause'}
        </Button>
        <Button
          variant="outline"
          onClick={handleCancelUpload}
          disabled={!currentBatch}
          className="text-red-600 hover:text-red-700 hover:border-red-300"
        >
          <Icon name="x" size={16} className="mr-2" />
          Cancel
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <Icon name="alert-circle" size={20} />
            <span className="font-medium">Upload Error</span>
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
        {currentStep === 0 && renderFileSelect()}
        {currentStep === 1 && renderSettings()}
        {currentStep === 2 && renderUploadProgress()}
      </div>

      {/* Cancel Button */}
      {currentStep < 2 && (
        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={onCancel}>
            Cancel Bulk Upload
          </Button>
        </div>
      )}
    </div>
  );
};

export default BulkUploadWizard;