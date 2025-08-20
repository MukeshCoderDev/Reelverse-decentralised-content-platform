import React, { useState, useCallback } from 'react';
import { useAgeGate } from '../../hooks/useAgeGate';
import AgeGateModal from './AgeGateModal';
import './BlurUntilAdult.css';

interface BlurUntilAdultProps {
  children: React.ReactNode;
}

const BlurUntilAdult: React.FC<BlurUntilAdultProps> = ({ children }) => {
  const { accepted, accept, config, shouldGate } = useAgeGate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleAcceptAge = useCallback(() => {
    accept();
    setIsModalOpen(false);
  }, [accept]);

  const handleLeave = useCallback(() => {
    window.location.href = 'https://www.google.com'; // Redirect to a safe page
  }, []);

  // The blur and banner should only show if shouldGate is true for the current path
  // The actual modal rendering is handled in App.tsx based on shouldGate
  if (accepted) {
    return <>{children}</>;
  }

  return (
    <div className="blur-container">
      <div className="blurred-content">{children}</div>
      <div className="age-gate-banner">
        <p>18+ Required. Click to verify</p>
        <button onClick={handleOpenModal} className="banner-button">
          Verify Age
        </button>
      </div>
      {/* AgeGateModal is rendered by App.tsx as a portal, not here */}
      {isModalOpen && (
        <AgeGateModal
          isOpen={isModalOpen}
          onAccept={handleAcceptAge}
          onLeave={handleLeave}
          minAge={config.minAge}
        />
      )}
    </div>
  );
};

export default BlurUntilAdult;