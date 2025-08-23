/**
 * UploadStepper Component
 * 
 * 4-step progress indicator with accessibility support
 */

import React from 'react';
import { StepperProps } from '../../types/upload';
import Icon from '../Icon';

interface Step {
  id: string;
  label: string;
  description: string;
  completed: boolean;
}

interface UploadStepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  disabled?: boolean;
  className?: string;
}

const UploadStepper: React.FC<UploadStepperProps> = ({
  currentStep,
  onStepClick,
  disabled = false,
  className = ''
}) => {
  const steps: Step[] = [
    {
      id: 'upload',
      label: 'Upload',
      description: 'Select and upload your video',
      completed: currentStep > 0
    },
    {
      id: 'details',
      label: 'Details',
      description: 'Add title, description, and tags',
      completed: currentStep > 1
    },
    {
      id: 'monetize',
      label: 'Monetize & Distribute',
      description: 'Set pricing and visibility',
      completed: currentStep > 2
    },
    {
      id: 'publish',
      label: 'Publish',
      description: 'Review and publish your content',
      completed: currentStep > 3
    }
  ];

  const getStepClasses = (index: number): string => {
    const baseClasses = "relative flex items-center";
    
    if (disabled) {
      return `${baseClasses} opacity-50 cursor-not-allowed`;
    }
    
    if (onStepClick) {
      return `${baseClasses} cursor-pointer hover:bg-slate-50 rounded-lg p-2 -m-2 transition-colors duration-200`;
    }
    
    return baseClasses;
  };

  const getStepButtonClasses = (index: number): string => {
    const baseClasses = "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2";
    
    if (steps[index].completed) {
      return `${baseClasses} bg-violet-600 text-white`;
    } else if (index === currentStep) {
      return `${baseClasses} bg-violet-100 text-violet-600 ring-2 ring-violet-600`;
    } else {
      return `${baseClasses} bg-slate-200 text-slate-500`;
    }
  };

  const getStepLabelClasses = (index: number): string => {
    const baseClasses = "text-sm font-medium transition-colors duration-200";
    
    if (steps[index].completed) {
      return `${baseClasses} text-violet-600`;
    } else if (index === currentStep) {
      return `${baseClasses} text-slate-900`;
    } else {
      return `${baseClasses} text-slate-500`;
    }
  };

  const getStepDescriptionClasses = (index: number): string => {
    const baseClasses = "text-xs transition-colors duration-200";
    
    if (steps[index].completed) {
      return `${baseClasses} text-violet-500`;
    } else if (index === currentStep) {
      return `${baseClasses} text-slate-600`;
    } else {
      return `${baseClasses} text-slate-400`;
    }
  };

  const getConnectorClasses = (index: number): string => {
    const baseClasses = "absolute top-4 left-8 w-full h-0.5 transition-colors duration-200";
    
    if (steps[index].completed) {
      return `${baseClasses} bg-violet-600`;
    } else {
      return `${baseClasses} bg-slate-200`;
    }
  };

  const handleStepClick = (index: number) => {
    if (!disabled && onStepClick) {
      onStepClick(index);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleStepClick(index);
    }
  };

  return (
    <nav 
      aria-label="Upload progress" 
      className={`w-full ${className}`}
      role="tablist"
    >
      <div className="flex items-start justify-between">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex-1 ${index < steps.length - 1 ? 'pr-8' : ''} ${getStepClasses(index)}`}
            onClick={() => handleStepClick(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            tabIndex={disabled || !onStepClick ? -1 : 0}
            role="tab"
            aria-selected={index === currentStep}
            aria-controls={`panel-${step.id}`}
            aria-label={`Step ${index + 1}: ${step.label} - ${step.description}`}
          >
            <div className="relative flex flex-col items-start w-full min-h-[44px]">
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className={getConnectorClasses(index)} />
              )}
              
              {/* Step Content */}
              <div className="flex items-center space-x-3 w-full">
                {/* Step Number/Check */}
                <div className={getStepButtonClasses(index)}>
                  {step.completed ? (
                    <Icon name="check" size={16} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                
                {/* Step Text */}
                <div className="flex-1 min-w-0">
                  <div className={getStepLabelClasses(index)}>
                    {step.label}
                  </div>
                  <div className={getStepDescriptionClasses(index)}>
                    {step.description}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Screen reader only current step announcement */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        Currently on step {currentStep + 1} of {steps.length}: {steps[currentStep]?.label}
      </div>
    </nav>
  );
};

// Compact version for mobile
export const CompactStepper: React.FC<UploadStepperProps> = ({
  currentStep,
  onStepClick,
  disabled = false,
  className = ''
}) => {
  const steps = ['Upload', 'Details', 'Monetize', 'Publish'];
  
  return (
    <div className={`flex items-center justify-center space-x-2 ${className}`}>
      {steps.map((step, index) => (
        <button
          key={step}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 ${
            index === currentStep
              ? 'bg-violet-600 text-white'
              : index < currentStep
              ? 'bg-violet-100 text-violet-600'
              : 'bg-slate-200 text-slate-500'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
          onClick={() => !disabled && onStepClick?.(index)}
          disabled={disabled}
          aria-label={`Step ${index + 1}: ${step}`}
          aria-current={index === currentStep ? 'step' : undefined}
        >
          {step}
        </button>
      ))}
    </div>
  );
};

// Progress indicator version (just visual, no interaction)
export const StepperProgress: React.FC<{
  currentStep: number;
  totalSteps?: number;
  className?: string;
}> = ({
  currentStep,
  totalSteps = 4,
  className = ''
}) => {
  const progress = ((currentStep + 1) / totalSteps) * 100;
  
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
        <span>Step {currentStep + 1} of {totalSteps}</span>
        <span>{Math.round(progress)}% Complete</span>
      </div>
      
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Upload progress: ${Math.round(progress)}% complete`}
        />
      </div>
    </div>
  );
};

export default UploadStepper;