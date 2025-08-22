import React, { useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Modal } from '../shared/Modal'; // Use the shared Modal component

interface AgeGateModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onLeave: () => void;
  minAge: number;
}

const AgeGateModal: React.FC<AgeGateModalProps> = ({ isOpen, onAccept, onLeave, minAge }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Disable ESC key and outside clicks
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  // No need for handleOverlayClick here, as the shared Modal handles overlay clicks to close.
  // We want to prevent closing, so we'll rely on the Modal's `onClose` not being passed directly to the overlay.

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus trap: ensure focus stays within the modal
      // This logic might need adjustment if the shared Modal already handles focus.
      // For now, keep it to ensure focus management.
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements?.[0] as HTMLElement;
      firstElement?.focus();

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Prevent closing on overlay click by providing an empty function
      title="Age Verification Required"
      className="rv-card w-[400px] max-w-[90vw] p-6 sm:p-8"
      overlayClassName="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      contentClassName="relative bg-rv-surface rounded-rv-md shadow-rv-2"
      aria-modal="true"
      aria-labelledby="age-gate-title"
    >
      <div ref={modalRef}>
        <h2 id="age-gate-title" className="text-2xl font-bold text-center mb-6">
          Age Verification Required
        </h2>
        <p className="text-rv-text text-sm text-center mb-6">
          You must be {minAge}+ to access this content. By clicking "I am {minAge}+ Enter", you confirm that you meet the age requirement and agree to our{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-rv-primary hover:underline">Terms of Service</a> and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-rv-primary hover:underline">Privacy Policy</a>.
        </p>
        <div className="flex justify-center gap-4">
          <button onClick={onAccept} className="rv-btn rv-primary">
            I am {minAge}+ Enter
          </button>
          <button onClick={onLeave} className="rv-btn rv-secondary">
            Leave
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AgeGateModal;
