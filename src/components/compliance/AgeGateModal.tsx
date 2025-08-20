import React, { useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './AgeGateModal.css';

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

  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
      event.stopPropagation(); // Prevent clicks outside modal from doing anything
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus trap: ensure focus stays within the modal
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

  return ReactDOM.createPortal(
    <div className="age-gate-overlay" role="dialog" aria-modal="true" aria-labelledby="age-gate-title" onClick={handleOverlayClick}>
      <div className="age-gate-modal" ref={modalRef}>
        <h2 id="age-gate-title">Age Verification Required</h2>
        <p>
          You must be {minAge}+ to access this content. By clicking "I am {minAge}+ Enter", you confirm that you meet the age requirement and agree to our{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
        </p>
        <div className="age-gate-actions">
          <button onClick={onAccept} className="age-gate-button primary">
            I am {minAge}+ Enter
          </button>
          <button onClick={onLeave} className="age-gate-button secondary">
            Leave
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AgeGateModal;