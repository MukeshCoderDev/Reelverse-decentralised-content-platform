// src/components/auth/EmailSignIn.tsx
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { getLang } from "../../i18n/auth";

export const EmailSignIn: React.FC = () => {
  const { otpStart, login, isLoading, error } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [txId, setTxId] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [step, setStep] = useState<"inputEmail" | "verifyOtp">("inputEmail");
  const [resendCountdown, setResendCountdown] = useState(0);
  const i18n = getLang();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (step === "verifyOtp" && resendCountdown > 0) {
      intervalRef.current = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    } else if (resendCountdown === 0 && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [step, resendCountdown]);

  const handleStartOtp = async (e: React.FormEvent, isResend = false) => {
    e.preventDefault();
    if (!email) return;

    const response = await otpStart(email, "email");
    if (response) {
      setTxId(response.txId);
      setMaskedEmail(response.maskedTarget);
      setStep("verifyOtp");
      setResendCountdown(60); // Start 60-second countdown
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txId || !otpCode) return;

    const success = await login(txId, otpCode);
    if (success) {
      // Login successful, modal will close via AuthProvider
      setEmail("");
      setOtpCode("");
      setTxId(null);
      setMaskedEmail(null);
      setStep("inputEmail");
      setResendCountdown(0);
    }
    // Error message will be displayed by AuthProvider
  };

  const isEmailValid = email.includes("@") && email.includes("."); // Basic validation
  const isOtpValid = otpCode.length === 6; // Assuming 6-digit OTP

  return (
    <div className="space-y-6">
      {step === "inputEmail" ? (
        <form onSubmit={handleStartOtp} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-rv-text mb-1">
              {i18n.emailAddressLabel}
            </label>
            <input
              type="email"
              id="email"
              className="rv-input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={i18n.enterEmailAddressHint}
              required
              disabled={isLoading}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "email-error" : undefined}
            />
            {error && <p id="email-error" className="rv-error">{i18n.invalidEmail}</p>}
          </div>
          <button
            type="submit"
            className="rv-btn rv-primary w-full"
            disabled={isLoading || !isEmailValid}
            aria-live="polite"
          >
            {isLoading ? i18n.sending : i18n.continueButton}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-6">
          <p className="text-rv-muted text-sm text-center">
            {i18n.codeSentTo.replace("{destination}", maskedEmail || "")}
          </p>
          <div>
            <label htmlFor="otpCode" className="block text-sm font-medium text-rv-text mb-1">
              {i18n.verificationCodeLabel}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              id="otpCode"
              className="rv-input w-full text-center tracking-widest"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder={i18n.enterVerificationCodeHint}
              maxLength={6}
              required
              disabled={isLoading}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "otp-error" : undefined}
            />
            {error && <p id="otp-error" className="rv-error">{i18n.invalidOtp}</p>}
          </div>
          <button
            type="submit"
            className="rv-btn rv-primary w-full"
            disabled={isLoading || !isOtpValid}
            aria-live="polite"
          >
            {isLoading ? i18n.verifying : i18n.continueButton}
          </button>
          <div className="flex justify-center mt-4">
            {resendCountdown > 0 ? (
              <span className="text-rv-muted text-sm">
                {i18n.resendIn.replace("{seconds}", resendCountdown.toString())}
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => handleStartOtp(e, true)}
                className="rv-btn rv-ghost text-sm"
                disabled={isLoading}
              >
                {i18n.resendNow}
              </button>
            )}
          </div>
          {error && <p className="rv-error text-center mt-2">{i18n.tryAgain}</p>}
        </form>
      )}
    </div>
  );
};
