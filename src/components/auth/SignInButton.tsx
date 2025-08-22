// src/components/auth/SignInButton.tsx
import React from "react";
import { useAuth } from "../../auth/AuthProvider";
import { getLang } from "../../i18n/auth";

export const SignInButton: React.FC = () => {
  const { openSignInModal } = useAuth();

  return (
    <button
      onClick={() => openSignInModal()}
      className="rv-btn rv-primary"
    >
      {getLang().signInTitle}
    </button>
  );
};
