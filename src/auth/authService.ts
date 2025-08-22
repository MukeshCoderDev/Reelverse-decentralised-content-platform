// src/auth/authService.ts
import { http, get, post } from "../api/http";

const API_URL = import.meta.env.VITE_API_URL || "/api"; // Default to /api if not set

interface OtpStartResponse {
  txId: string;
  maskedTarget: string;
  expiresAt: string; // ISO string
}

interface OtpVerifyResponse {
  success: boolean;
  message?: string;
}

interface UserSession {
  uid: string;
  // Add other user details if available in the session payload
}

export const authService = {
  /**
   * Starts the OTP process for a given target (phone or email).
   * @param target The phone number (E.164) or email address.
   * @param channel The channel for OTP delivery (e.g., "sms", "whatsapp", "email").
   * @returns A transaction ID and masked target.
   */
  otpStart: async (
    target: string,
    channel: "sms" | "whatsapp" | "email"
  ): Promise<OtpStartResponse> => {
    return post<OtpStartResponse>(`${API_URL}/auth/otp/start`, {
      target,
      channel,
    });
  },

  /**
   * Verifies the OTP code for a given transaction.
   * @param txId The transaction ID received from otpStart.
   * @param code The OTP code entered by the user.
   * @returns Success status.
   */
  otpVerify: async (txId: string, code: string): Promise<OtpVerifyResponse> => {
    return post<OtpVerifyResponse>(`${API_URL}/auth/otp/verify`, {
      txId,
      code,
    });
  },

  /**
   * Retrieves the current user session.
   * @returns User session data or null if not authenticated.
   */
  session: async (): Promise<UserSession | null> => {
    try {
      return await get<UserSession>(`${API_URL}/auth/session`);
    } catch (error) {
      // If the session endpoint returns an error (e.g., 401 Unauthorized),
      // it means there's no active session.
      console.log("No active session:", error);
      return null;
    }
  },

  /**
   * Logs out the current user.
   * @returns A promise that resolves when logout is complete.
   */
  logout: async (): Promise<void> => {
    await post<void>(`${API_URL}/auth/logout`);
  },
};
