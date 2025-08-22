// src/components/auth/EmailSignIn.tsx
import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "verifyOtp" && resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
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
    <div className="space-y-4">
      {step === "inputEmail" ? (
        <form onSubmit={handleStartOtp} className="space-y-4">
          <div>
            <label htmlFor="email" className="sr-only">
              {i18n.emailPlaceholder}
            </label>
            <input
              type="email"
              id="email"
              className="rv-input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={i18n.emailPlaceholder}
              required
              disabled={isLoading}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "email-error" : undefined}
            />
            {error && <p id="email-error" className="text-rv-danger text-sm mt-1">{i18n.invalidEmail}</p>}
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
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <p className="text-rv-muted text-sm text-center">
            {i18n.resendIn.replace("{seconds}", resendCountdown.toString())}
          </p>
          <div>
            <label htmlFor="otpCode" className="sr-only">
              {i18n.otpPlaceholder}
            </label>
            <input
              type="text"
              id="otpCode"
              className="rv-input w-full text-center tracking-widest"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder={i18n.otpPlaceholder}
              required
              disabled={isLoading}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "otp-error" : undefined}
            />
            {error && <p id="otp-error" className="text-rv-danger text-sm mt-1">{i18n.invalidOtp}</p>}
          </div>
          <button
            type="submit"
            className="rv-btn rv-primary w-full"
            disabled={isLoading || !isOtpValid}
            aria-live="polite"
          >
            {isLoading ? i18n.verifying : i18n.continueButton}
          </button>
          <button
            type="button"
            onClick={(e) => handleStartOtp(e, true)}
            className="rv-btn rv-ghost w-full"
            disabled={isLoading || resendCountdown > 0}
          >
            {i18n.resendNow}
          </button>
        </form>
      )}
    </div>
  );
};
