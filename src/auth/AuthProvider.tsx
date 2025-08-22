// src/auth/AuthProvider.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { authService } from "./authService";

interface User {
  uid: string;
  // Add other user profile details here
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (txId: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  otpStart: (
    target: string,
    channel: "sms" | "whatsapp" | "email"
  ) => Promise<{ txId: string; maskedTarget: string } | null>;
  otpVerify: (txId: string, code: string) => Promise<boolean>;
  requireAuth: <T extends (...args: any[]) => any>(
    action: T,
    onAuthSuccess?: (...args: Parameters<T>) => void
  ) => (...args: Parameters<T>) => void;
  // Function to trigger the sign-in modal, to be implemented later
  openSignInModal: (callback?: () => void) => void;
  closeSignInModal: () => void;
  isSignInModalOpen: boolean;
  onSignInSuccessCallback: (() => void) | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState<boolean>(false);
  const [onSignInSuccessCallback, setOnSignInSuccessCallback] = useState<(() => void) | null>(null);


  const fetchSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const session = await authService.session();
      if (session) {
        setUser({ uid: session.uid }); // Assuming session directly returns uid
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to fetch session:", err);
      setUser(null);
      setError("Failed to load session.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const login = useCallback(
    async (txId: string, code: string): Promise<boolean> => {
      setError(null);
      try {
        const response = await authService.otpVerify(txId, code);
        if (response.success) {
          await fetchSession(); // Re-fetch session to update user state
          if (onSignInSuccessCallback) {
            onSignInSuccessCallback();
            setOnSignInSuccessCallback(null); // Clear callback after execution
          }
          return true;
        } else {
          setError(response.message || "OTP verification failed.");
          return false;
        }
      } catch (err: any) {
        console.error("Login failed:", err);
        setError(err.message || "An unexpected error occurred during login.");
        return false;
      }
    },
    [fetchSession, onSignInSuccessCallback]
  );

  const logout = useCallback(async () => {
    setError(null);
    try {
      await authService.logout();
      setUser(null);
      // Optionally, redirect to home or refresh page
    } catch (err: any) {
      console.error("Logout failed:", err);
      setError(err.message || "An unexpected error occurred during logout.");
    }
  }, []);

  const otpStart = useCallback(
    async (
      target: string,
      channel: "sms" | "whatsapp" | "email"
    ): Promise<{ txId: string; maskedTarget: string } | null> => {
      setError(null);
      try {
        const response = await authService.otpStart(target, channel);
        return { txId: response.txId, maskedTarget: response.maskedTarget };
      } catch (err: any) {
        console.error("OTP start failed:", err);
        setError(err.message || "Failed to send OTP.");
        return null;
      }
    },
    []
  );

  const otpVerify = useCallback(
    async (txId: string, code: string): Promise<boolean> => {
      setError(null);
      try {
        const response = await authService.otpVerify(txId, code);
        if (response.success) {
          await fetchSession(); // Re-fetch session to update user state
          return true;
        } else {
          setError(response.message || "OTP verification failed.");
          return false;
        }
      } catch (err: any) {
        console.error("OTP verification failed:", err);
        setError(err.message || "An unexpected error occurred during OTP verification.");
        return false;
      }
    },
    [fetchSession]
  );

  const openSignInModal = useCallback((callback?: () => void) => {
    setIsSignInModalOpen(true);
    if (callback) {
      setOnSignInSuccessCallback(() => callback);
    }
  }, []);

  const closeSignInModal = useCallback(() => {
    setIsSignInModalOpen(false);
    setOnSignInSuccessCallback(null); // Clear callback if modal is closed without success
  }, []);

  const requireAuth = useCallback(
    <T extends (...args: any[]) => any>(
      action: T,
      onAuthSuccess?: (...args: Parameters<T>) => void
    ) =>
    (...args: Parameters<T>) => {
      if (user) {
        // User is authenticated, proceed with the action
        action(...args);
      } else {
        // User is not authenticated, open sign-in modal
        openSignInModal(() => {
          // This callback runs after successful sign-in
          if (onAuthSuccess) {
            onAuthSuccess(...args);
          } else {
            action(...args); // Resume original action
          }
        });
      }
    },
    [user, openSignInModal]
  );

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    otpStart,
    otpVerify,
    requireAuth,
    openSignInModal,
    closeSignInModal,
    isSignInModalOpen,
    onSignInSuccessCallback,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
