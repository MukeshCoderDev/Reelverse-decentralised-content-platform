import React, { useState, useCallback } from 'react';
import { useAgeGate } from '../../hooks/useAgeGate'; // Adjust path as needed
import AgeGateModal from './AgeGateModal'; // Adjust path as needed
import './BlurUntilAdult.css'; // Assuming you'll create this CSS file

interface BlurUntilAdultProps {
  children: React.ReactNode;
  safeRoutes?: string[]; // Optional array of routes where blur should not apply
}

const BlurUntilAdult: React.FC<BlurUntilAdultProps> = ({ children, safeRoutes = [] }) => {
  const { accepted, accept, config } = useAgeGate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const currentPath = window.location.pathname;
  const isSafeRoute = safeRoutes.some(route => currentPath.startsWith(route));

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

  if (accepted || isSafeRoute) {
    return <>{children}</>;
  }

  return (
    <div className="blur-container">
      <div className="blurred-content">{children}</div>
      <div className="age-gate-banner">
        <p>Content is for 18+ only.</p>
        <button onClick={handleOpenModal} className="banner-button">
          Verify Age
        </button>
      </div>
      <AgeGateModal
        isOpen={isModalOpen}
        onAccept={handleAcceptAge}
        onLeave={handleLeave}
        minAge={config.minAge}
      />
    </div>
  );
};

export default BlurUntilAdult;