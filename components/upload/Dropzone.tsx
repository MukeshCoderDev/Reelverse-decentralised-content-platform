/**
 * Dropzone Component
 * 
 * Drag-and-drop file selection with accessibility and validation
 */

import React, { useCallback, useState, useRef } from 'react';
import { DropzoneProps } from '../../types/upload';
import Icon from '../Icon';
import Button from '../Button';

const Dropzone: React.FC<DropzoneProps> = ({
  onFileSelect,
  accept,
  maxSize,
  disabled = false,
  error
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDragReject, setIsDragReject] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatMaxSize = formatFileSize(maxSize);

  const validateFile = (file: File): string | null => {
    // Check file type
    const acceptedTypes = accept.split(',').map(t => t.trim());
    if (!acceptedTypes.includes(file.type)) {
      return 'Unsupported file type. Please use MP4, MOV, or MKV format.';
    }

    // Check file size
    if (file.size > maxSize) {
      return `File exceeds ${formatMaxSize} limit. Please compress or split your video.`;
    }

    return null;
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validationError = validateFile(file);
    
    if (validationError) {
      // Handle error - could emit an error event or call an error callback
      console.error(validationError);
      return;
    }

    onFileSelect(file);
  }, [onFileSelect, accept, maxSize]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;

    const items = Array.from(e.dataTransfer.items);
    const hasValidFile = items.some(item => {
      if (item.kind !== 'file') return false;
      const acceptedTypes = accept.split(',').map(t => t.trim());
      return acceptedTypes.includes(item.type);
    });

    setIsDragActive(true);
    setIsDragReject(!hasValidFile);
  }, [disabled, accept]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only hide drag state if leaving the dropzone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragActive(false);
      setIsDragReject(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragActive(false);
    setIsDragReject(false);
    
    if (disabled) return;

    handleFiles(e.dataTransfer.files);
  }, [disabled, handleFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [handleFiles]);

  const handleClick = useCallback(() => {
    if (disabled || !fileInputRef.current) return;
    fileInputRef.current.click();
  }, [disabled]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  const getDropzoneClasses = () => {
    const baseClasses = "relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2";
    
    if (disabled) {
      return `${baseClasses} border-gray-300 bg-gray-50 cursor-not-allowed opacity-50`;
    }
    
    if (error) {
      return `${baseClasses} border-rose-300 bg-rose-50 text-rose-700`;
    }
    
    if (isDragReject) {
      return `${baseClasses} border-rose-400 bg-rose-50 text-rose-600`;
    }
    
    if (isDragActive) {
      return `${baseClasses} border-violet-400 bg-violet-50 text-violet-700`;
    }
    
    return `${baseClasses} border-slate-300 bg-slate-50 hover:border-violet-400 hover:bg-violet-50 cursor-pointer text-slate-600 hover:text-violet-700`;
  };

  return (
    <div className="w-full">
      <div
        className={getDropzoneClasses()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label="Upload video file"
        aria-describedby="dropzone-description"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="sr-only"
          disabled={disabled}
          aria-hidden="true"
        />
        
        <div className="flex flex-col items-center space-y-4">
          {/* Upload Icon */}
          <div className={`p-3 rounded-full ${
            error ? 'bg-rose-100' : 
            isDragReject ? 'bg-rose-100' : 
            isDragActive ? 'bg-violet-100' : 
            'bg-slate-100 group-hover:bg-violet-100'
          }`}>
            <Icon 
              name={error || isDragReject ? 'alert-circle' : 'upload'} 
              size={24} 
              className={
                error ? 'text-rose-600' : 
                isDragReject ? 'text-rose-500' : 
                isDragActive ? 'text-violet-600' : 
                'text-slate-500 group-hover:text-violet-600'
              }
            />
          </div>
          
          {/* Main Message */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium">
              {isDragActive ? (
                isDragReject ? 'File type not supported' : 'Drop your video here'
              ) : (
                'Drag a video here or browse'
              )}
            </h3>
            
            <p 
              id="dropzone-description" 
              className="text-sm text-slate-500"
            >
              MP4, MOV, MKV • Up to {formatMaxSize} • Resumable • No wallet needed
            </p>
          </div>
          
          {/* Browse Button */}
          {!isDragActive && !disabled && (
            <Button 
              variant="secondary" 
              className="mt-4"
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
            >
              Browse Files
            </Button>
          )}
        </div>
        
        {/* Walletless Badge */}
        <div className="absolute top-4 right-4 flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          <Icon name="shield-check" size={12} />
          <span>Free Upload</span>
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="mt-2 flex items-center space-x-2 text-sm text-rose-600">
          <Icon name="alert-circle" size={16} />
          <span>{error}</span>
        </div>
      )}
      
      {/* Help Text */}
      <div className="mt-4 p-4 bg-violet-50 rounded-lg border border-violet-200">
        <h4 className="text-sm font-medium text-violet-800 mb-2">
          Free, walletless uploads
        </h4>
        <p className="text-sm text-violet-700">
          Storage and gas fees are paid by the Reelverse Treasury. 
          You can close this tab safely - we'll resume your upload when you return.
        </p>
      </div>
    </div>
  );
};

export default Dropzone;