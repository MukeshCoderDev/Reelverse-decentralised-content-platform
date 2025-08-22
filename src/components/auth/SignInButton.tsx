// src/components/auth/SignInButton.tsx
import React from "react";
import { useAuth } from "../../auth/AuthProvider";

export const SignInButton: React.FC = () => {
  const { openSignInModal } = useAuth();

  return (
    <button
      onClick={() => openSignInModal()}
      className="rv-btn rv-primary"
    >
      Sign In
    </button>
  );
};
