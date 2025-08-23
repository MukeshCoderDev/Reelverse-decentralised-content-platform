/**
 * PublishBar Component
 * 
 * Final actions bar with Preview, Save Draft, and Publish buttons
 */

import React, { useState } from 'react';
import { PublishBarProps, UploadStatus } from '../../types/upload';
import Icon from '../Icon';
import Button from '../Button';

const PublishBar: React.FC<PublishBarProps> = ({
  canPublish,
  status,
  onSaveDraft,
  onPublish,
  onPreview,
  disabledReason
}) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Handle publish with loading state
  const handlePublish = async () => {
    if (!canPublish) return;
    
    setIsPublishing(true);
    try {
      await onPublish();
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle save draft with loading state
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      await onSaveDraft();
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Get status-based messaging
  const getStatusMessage = (): { message: string; color: string; canShowPreview: boolean } => {
    switch (status) {
      case 'uploading':
        return {
          message: 'Upload in progress...',
          color: 'text-blue-600',
          canShowPreview: false
        };
      case 'uploaded':
        return {
          message: 'Upload complete! Processing for playback...',
          color: 'text-green-600',
          canShowPreview: false
        };
      case 'processing':
        return {
          message: 'Processing video... You can publish when SD is ready',
          color: 'text-amber-600',
          canShowPreview: false
        };
      case 'playable':
        return {
          message: 'SD quality ready! HD finishing in background',
          color: 'text-green-600',
          canShowPreview: true
        };
      case 'hd_ready':
        return {
          message: 'All qualities ready!',
          color: 'text-emerald-600',
          canShowPreview: true
        };
      case 'failed':
        return {
          message: 'Upload failed. Please try again.',
          color: 'text-rose-600',
          canShowPreview: false
        };
      case 'aborted':
        return {
          message: 'Upload was cancelled.',
          color: 'text-slate-600',
          canShowPreview: false
        };
      default:
        return {
          message: 'Ready to upload',
          color: 'text-slate-600',
          canShowPreview: false
        };
    }
  };

  const statusInfo = getStatusMessage();

  // Determine if publish button should be enabled
  const publishEnabled = canPublish && !isPublishing && (status === 'playable' || status === 'hd_ready' || status === 'uploaded');

  return (
    <div className="bg-white border-t border-slate-200 p-6 space-y-4">
      {/* Status Message */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2">
          {(status === 'uploading' || status === 'processing') && (
            <Icon name="loader" size={16} className="animate-spin text-violet-600" />
          )}
          {(status === 'playable' || status === 'hd_ready') && (
            <Icon name="check-circle" size={16} className="text-green-600" />
          )}
          {status === 'failed' && (
            <Icon name="alert-circle" size={16} className="text-rose-600" />
          )}
          <span className={`text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.message}
          </span>
        </div>
      </div>

      {/* Disabled Reason */}
      {disabledReason && !canPublish && (
        <div className="flex items-center space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Icon name="info" size={16} className="text-amber-600" />
          <span className="text-sm text-amber-800">{disabledReason}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Save Draft Button */}
          <Button
            variant="secondary"
            onClick={handleSaveDraft}
            disabled={isSavingDraft}
            className="flex items-center space-x-2"
          >
            {isSavingDraft ? (
              <>
                <Icon name="loader" size={16} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Icon name="file-dashed" size={16} />
                <span>Save Draft</span>
              </>
            )}
          </Button>

          {/* Preview Button */}
          {statusInfo.canShowPreview && onPreview && (
            <Button
              variant="ghost"
              onClick={onPreview}
              className="flex items-center space-x-2"
            >
              <Icon name="eye" size={16} />
              <span>Preview</span>
            </Button>
          )}
        </div>

        {/* Publish Button */}
        <div className="flex items-center space-x-3">
          {/* Auto-publish Option */}
          {status === 'processing' && (
            <label className="flex items-center space-x-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="text-violet-600 focus:ring-violet-500"
              />
              <span>Auto-publish when ready</span>
            </label>
          )}

          <Button
            variant="default"
            onClick={handlePublish}
            disabled={!publishEnabled}
            className="flex items-center space-x-2 min-w-[120px]"
          >
            {isPublishing ? (
              <>
                <Icon name="loader" size={16} className="animate-spin" />
                <span>Publishing...</span>
              </>
            ) : (
              <>
                <Icon name="upload" size={16} />
                <span>Publish</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Publishing Guidelines */}
      <div className="pt-4 border-t border-slate-100">
        <details className="group">
          <summary className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
            <Icon 
              name="chevron-right" 
              size={16} 
              className="transform transition-transform group-open:rotate-90"
            />
            <span>Publishing Guidelines</span>
          </summary>
          <div className="mt-3 ml-6 text-sm text-slate-600 space-y-2">
            <p>• Content must comply with our community guidelines</p>
            <p>• Age-restricted content requires proper labeling</p>
            <p>• Ensure you have rights to all music and video content</p>
            <p>• Misleading titles or thumbnails are not allowed</p>
          </div>
        </details>
      </div>

      {/* Success State */}
      {status === 'hd_ready' && canPublish && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <Icon name="check-circle" size={20} className="text-green-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-green-800 mb-1">
                Ready to Publish!
              </h4>
              <p className="text-sm text-green-700">
                Your video has been processed in all qualities and is ready to go live.
                You can publish now or save as a draft to publish later.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Processing State */}
      {status === 'processing' && (
        <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <Icon name="loader" size={20} className="text-violet-600 mt-0.5 animate-spin" />
            <div>
              <h4 className="text-sm font-medium text-violet-800 mb-1">
                Processing Video
              </h4>
              <p className="text-sm text-violet-700">
                We're transcoding your video for every device. You can publish as soon as SD quality is ready - 
                HD will finish in the background.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* What Happens Next */}
      {publishEnabled && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h4 className="text-sm font-medium text-slate-800 mb-2">
            What happens after publishing?
          </h4>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• Your video will be immediately available to viewers</li>
            <li>• Content will be pinned to IPFS for decentralized storage</li>
            <li>• Analytics and engagement data will start tracking</li>
            <li>• You can edit metadata and monetization settings anytime</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default PublishBar;