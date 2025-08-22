// src/components/auth/SignInModal.tsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { PhoneSignIn } from "./PhoneSignIn";
import { EmailSignIn } from "./EmailSignIn";
import { Modal } from "../shared/Modal";
import { Tab, Tabs, TabList, TabPanel } from "../shared/Tabs";
import { getLang } from "../../i18n/auth"; // Import getLang

// Define authentication channels from environment variables
const AUTH_CHANNELS = import.meta.env.VITE_AUTH_CHANNELS
  ? import.meta.env.VITE_AUTH_CHANNELS.split(",")
  : ["phone", "email"]; // Default channels

export const SignInModal: React.FC = () => {
  const { isSignInModalOpen, closeSignInModal, error } = useAuth();
  const [activeTab, setActiveTab] = useState(AUTH_CHANNELS[0]);
  const i18n = getLang(); // Get localized strings

  useEffect(() => {
    if (isSignInModalOpen) {
      // Reset active tab when modal opens
      setActiveTab(AUTH_CHANNELS[0]);
    }
  }, [isSignInModalOpen]);

  if (!isSignInModalOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isSignInModalOpen}
      onClose={closeSignInModal}
      title={i18n.signInTitle}
      className="rv-card w-[400px] max-w-[90vw] p-6 sm:p-8" // Apply card styling
      overlayClassName="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      contentClassName="relative bg-rv-surface rounded-rv-md shadow-rv-2"
      aria-modal="true"
      aria-labelledby="signin-modal-title"
      aria-describedby="signin-modal-description"
    >
      <h2 id="signin-modal-title" className="text-2xl font-bold text-center mb-6">
        {i18n.signInTitle}
      </h2>

      {error && (
        <div
          className="bg-rv-danger text-rv-primary-contrast p-3 rounded-rv-sm mb-4 text-center"
          role="alert"
        >
          {error}
        </div>
      )}

      <Tabs activeTab={activeTab} onTabChange={setActiveTab}>
        <TabList className="flex border-b border-rv-border mb-6">
          {AUTH_CHANNELS.includes("phone") && (
            <Tab
              id="phone"
              className={`flex-1 text-center py-3 cursor-pointer text-rv-muted hover:text-rv-text ${
                activeTab === "phone" ? "border-b-2 border-rv-primary text-rv-text font-medium" : ""
              }`}
            >
              {i18n.phoneTab}
            </Tab>
          )}
          {AUTH_CHANNELS.includes("email") && (
            <Tab
              id="email"
              className={`flex-1 text-center py-3 cursor-pointer text-rv-muted hover:text-rv-text ${
                activeTab === "email" ? "border-b-2 border-rv-primary text-rv-text font-medium" : ""
              }`}
            >
              {i18n.emailTab}
            </Tab>
          )}
        </TabList>
        {AUTH_CHANNELS.includes("phone") && (
          <TabPanel id="phone">
            <PhoneSignIn />
          </TabPanel>
        )}
        {AUTH_CHANNELS.includes("email") && (
          <TabPanel id="email">
            <EmailSignIn />
          </TabPanel>
        )}
      </Tabs>

      <p id="signin-modal-description" className="text-rv-muted text-sm text-center mt-6">
        {i18n.secureCookieMessage}
      </p>
      <div className="flex justify-center gap-4 mt-2 text-sm">
        <a href="/terms" className="text-rv-muted hover:text-rv-primary" target="_blank" rel="noopener noreferrer">
          {i18n.terms}
        </a>
        <a href="/privacy" className="text-rv-muted hover:text-rv-primary" target="_blank" rel="noopener noreferrer">
          {i18n.privacy}
        </a>
      </div>
    </Modal>
  );
};
