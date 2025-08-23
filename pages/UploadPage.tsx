/**
 * UploadPage Component
 * 
 * Main upload page with stepper layout and responsive design
 */

import React, { useEffect } from 'react';
import { UploadProvider, useUploadStore } from '../store/uploadStore';
import { useResumableUpload } from '../hooks/useResumableUpload';
import UploadStepper, { CompactStepper } from '../components/upload/UploadStepper';
import Dropzone from '../components/upload/Dropzone';
import ProgressBar from '../components/upload/ProgressBar';
import StatusPills, { PipelineStatus } from '../components/upload/StatusPills';
import MetadataForm from '../components/upload/MetadataForm';
import MonetizationForm from '../components/upload/MonetizationForm';
import PublishBar from '../components/upload/PublishBar';
import Icon from '../components/Icon';
import Button from '../components/Button';
import { formatBytes, formatDuration } from '../lib/uploadResumable';
import { validateMetadata, validateMonetization } from '../store/uploadStore';

// Configuration constants
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 * 1024; // 20 GB
const SUPPORTED_TYPES = 'video/mp4,video/quicktime,video/x-matroska';

// Upload Page Content Component
const UploadPageContent: React.FC = () => {
  const { state, actions } = useUploadStore();
  const {
    file,
    session,
    progress,
    status,
    errors,
    isUploading,
    isPaused,
    canPublish,
    content,
    selectFile,
    startUpload,
    pauseUpload,
    resumeUpload,
    abortUpload,
    saveDraft,
    publishContent,
    previewContent,
    resetUpload
  } = useResumableUpload({
    onUploadComplete: (result) => {
      console.log('Upload completed:', result);
      // Auto-advance to next step
      if (state.ui.currentStep === 0) {
        actions.setCurrentStep(1);
      }
    },
    onError: (error) => {
      console.error('Upload error:', error);
    },
    onStatusChange: (newStatus) => {
      console.log('Status changed to:', newStatus);
    }
  });

  // Auto-save draft metadata
  useEffect(() => {
    if (session?.uploadId && state.metadata.title.trim()) {
      const timeoutId = setTimeout(() => {
        saveDraft();
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [state.metadata, session, saveDraft]);

  // Handle file selection
  const handleFileSelect = (selectedFile: File) => {
    selectFile(selectedFile);
    startUpload();
  };

  // Handle step navigation
  const handleStepClick = (step: number) => {
    // Allow navigation to previous steps or current step + 1
    if (step <= state.ui.currentStep + 1) {
      actions.setCurrentStep(step);
    }
  };

  // Get current step content
  const getCurrentStepContent = () => {
    switch (state.ui.currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Upload Your Video
              </h2>
              <p className="text-slate-600">
                Select a video file to start uploading. Your progress will be saved automatically.
              </p>
            </div>
            <Dropzone
              onFileSelect={handleFileSelect}
              accept={SUPPORTED_TYPES}
              maxSize={MAX_FILE_SIZE_BYTES}
              disabled={isUploading}
              error={errors[0]}
            />
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Add Details
              </h2>
              <p className="text-slate-600">
                Add a title, description, and tags to help viewers find your content.
              </p>
            </div>
            <MetadataForm
              value={state.metadata}
              onChange={actions.updateMetadata}
              errors={validateMetadata(state.metadata)}
              disabled={false}
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Monetize & Distribute
              </h2>
              <p className="text-slate-600">
                Choose how viewers can access your content and set pricing options.
              </p>
            </div>
            <MonetizationForm
              value={state.monetization}
              onChange={actions.updateMonetization}
              disabled={false}
            />
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Publish
              </h2>
              <p className="text-slate-600">
                Review your settings and publish your video when ready.
              </p>
            </div>
            
            {/* Content Summary */}
            <div className="bg-slate-50 rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-medium text-slate-900">Summary</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-slate-700">Title:</span>
                  <p className="text-slate-600">{state.metadata.title || 'Untitled'}</p>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Visibility:</span>
                  <p className="text-slate-600 capitalize">{state.metadata.visibility}</p>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Category:</span>
                  <p className="text-slate-600">{state.metadata.category || 'Uncategorized'}</p>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Monetization:</span>
                  <p className="text-slate-600 capitalize">
                    {state.monetization.type === 'pay-per-view' 
                      ? `Pay-per-view ($${state.monetization.price} USDC)`
                      : state.monetization.type
                    }
                  </p>
                </div>
              </div>
              
              {state.metadata.tags.length > 0 && (
                <div>
                  <span className="font-medium text-slate-700 text-sm">Tags:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {state.metadata.tags.map((tag, index) => (
                      <span 
                        key={index}
                        className="px-2 py-1 bg-violet-100 text-violet-700 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Get disabled reason for publish
  const getPublishDisabledReason = (): string | undefined => {
    if (!state.metadata.title.trim()) {
      return 'Title is required to publish';
    }
    if (status === 'uploading') {
      return 'Upload in progress';
    }
    if (status === 'processing') {
      return 'Video is still processing';
    }
    if (status === 'failed') {
      return 'Upload failed - please try again';
    }
    return undefined;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Upload Video</h1>
              <p className="text-slate-600 mt-1">
                Free, walletless uploads. We cover gas and storage from the Reelverse Treasury.
              </p>
            </div>
            
            {/* Reset Button */}
            {(file.instance || session) && (
              <Button
                variant="ghost"
                onClick={resetUpload}
                className="flex items-center space-x-2"
              >
                <Icon name="refresh-cw" size={16} />
                <span>Start Over</span>
              </Button>
            )}
          </div>
          
          {/* Desktop Stepper */}
          <div className="hidden md:block mt-8">
            <UploadStepper
              currentStep={state.ui.currentStep}
              onStepClick={handleStepClick}
              disabled={isUploading}
            />
          </div>
          
          {/* Mobile Stepper */}
          <div className="md:hidden mt-6">
            <CompactStepper
              currentStep={state.ui.currentStep}
              onStepClick={handleStepClick}
              disabled={isUploading}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - 60% on desktop */}
          <div className="lg:col-span-2 space-y-8">
            {getCurrentStepContent()}
            
            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
              <Button
                variant="ghost"
                onClick={() => actions.setCurrentStep(Math.max(0, state.ui.currentStep - 1))}
                disabled={state.ui.currentStep === 0}
                className="flex items-center space-x-2"
              >
                <Icon name="chevron-left" size={16} />
                <span>Previous</span>
              </Button>
              
              <Button
                variant="default"
                onClick={() => actions.setCurrentStep(Math.min(3, state.ui.currentStep + 1))}
                disabled={state.ui.currentStep === 3 || (!file.instance && state.ui.currentStep === 0)}
                className="flex items-center space-x-2"
              >
                <span>Next</span>
                <Icon name="chevron-right" size={16} />
              </Button>
            </div>
          </div>

          {/* Right Panel - 40% on desktop */}
          <div className="space-y-6">
            {/* Upload Status Card */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 sticky top-6">
              <h3 className="text-lg font-medium text-slate-900 mb-4">Upload Status</h3>
              
              {file.instance ? (
                <div className="space-y-4">
                  {/* File Info */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Icon name="video" size={16} className="text-slate-500" />
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {file.name}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatBytes(file.size)}
                    </div>
                  </div>

                  {/* Session Info */}
                  {session && (
                    <div className="p-3 bg-slate-50 rounded border text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Session ID:</span>
                        <code className="text-slate-800 font-mono">
                          {session.uploadId.slice(0, 8)}...
                        </code>
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(session.uploadId)}
                        className="text-violet-600 hover:text-violet-700"
                      >
                        Copy full ID
                      </button>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {isUploading && (
                    <ProgressBar
                      progress={progress.percentage}
                      speed={progress.speed}
                      eta={progress.estimatedTimeRemaining}
                    />
                  )}

                  {/* Status Pills */}
                  <StatusPills
                    status={status}
                    progress={progress.percentage}
                    showRetry={status === 'failed'}
                    onRetry={resumeUpload}
                  />

                  {/* Pipeline Status */}
                  <PipelineStatus
                    currentStatus={status}
                    progress={progress.percentage}
                  />

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    {isUploading && (
                      <Button
                        variant="secondary"
                        onClick={pauseUpload}
                        className="w-full flex items-center justify-center space-x-2"
                      >
                        <Icon name="pause" size={16} />
                        <span>Pause</span>
                      </Button>
                    )}
                    
                    {isPaused && (
                      <Button
                        variant="default"
                        onClick={resumeUpload}
                        className="w-full flex items-center justify-center space-x-2"
                      >
                        <Icon name="play" size={16} />
                        <span>Resume</span>
                      </Button>
                    )}
                    
                    {(isUploading || isPaused) && (
                      <Button
                        variant="destructive"
                        onClick={abortUpload}
                        className="w-full flex items-center justify-center space-x-2"
                      >
                        <Icon name="x" size={16} />
                        <span>Abort</span>
                      </Button>
                    )}
                  </div>

                  {/* Resume Tips */}
                  {session && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded text-xs">
                      <p className="text-green-800 font-medium mb-1">Resume Tips</p>
                      <p className="text-green-700">
                        You can safely close this tab. Your upload will resume when you return.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Icon name="upload" size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select a file to start uploading</p>
                </div>
              )}
            </div>

            {/* What Happens Next */}
            {file.instance && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer">
                    <h3 className="text-lg font-medium text-slate-900">What happens next?</h3>
                    <Icon 
                      name="chevron-right" 
                      size={16} 
                      className="transform transition-transform group-open:rotate-90 text-slate-500"
                    />
                  </summary>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="flex items-start space-x-3">
                      <Icon name="upload" size={16} className="text-blue-500 mt-0.5" />
                      <div>
                        <p className="font-medium">1. Upload</p>
                        <p>Your video is uploaded to our secure storage</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Icon name="loader" size={16} className="text-amber-500 mt-0.5" />
                      <div>
                        <p className="font-medium">2. Processing</p>
                        <p>We create multiple quality versions (SD, HD, 4K)</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Icon name="globe" size={16} className="text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium">3. IPFS Pinning</p>
                        <p>Content is pinned to IPFS for decentralized storage</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Icon name="play" size={16} className="text-violet-500 mt-0.5" />
                      <div>
                        <p className="font-medium">4. Ready to Publish</p>
                        <p>Your video is ready for viewers</p>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Publish Bar - Fixed at bottom */}
      {state.ui.currentStep === 3 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 lg:static lg:z-auto">
          <PublishBar
            canPublish={canPublish}
            status={status}
            onSaveDraft={saveDraft}
            onPublish={publishContent}
            onPreview={content.playbackUrl ? previewContent : undefined}
            disabledReason={getPublishDisabledReason()}
          />
        </div>
      )}
    </div>
  );
};

// Main Upload Page Component with Provider
const UploadPage: React.FC = () => {
  return (
    <UploadProvider>
      <UploadPageContent />
    </UploadProvider>
  );
};

export default UploadPage;