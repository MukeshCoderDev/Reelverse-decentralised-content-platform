// src/components/auth/PhoneSignIn.tsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { getLang } from "../../i18n/auth";

export const PhoneSignIn: React.FC = () => {
  const { otpStart, login, isLoading, error } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [txId, setTxId] = useState<string | null>(null);
  const [maskedPhoneNumber, setMaskedPhoneNumber] = useState<string | null>(
    null
  );
  const [step, setStep] = useState<"inputPhone" | "verifyOtp">("inputPhone");
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
    if (!phoneNumber) return;

    const response = await otpStart(phoneNumber, "sms"); // Assuming SMS for phone OTP
    if (response) {
      setTxId(response.txId);
      setMaskedPhoneNumber(response.maskedTarget);
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
      setPhoneNumber("");
      setOtpCode("");
      setTxId(null);
      setMaskedPhoneNumber(null);
      setStep("inputPhone");
      setResendCountdown(0);
    }
    // Error message will be displayed by AuthProvider
  };

  const isPhoneValid = phoneNumber.length > 5; // Basic validation
  const isOtpValid = otpCode.length === 6; // Assuming 6-digit OTP

  return (
    <div className="space-y-4">
      {step === "inputPhone" ? (
        <form onSubmit={handleStartOtp} className="space-y-4">
          <div>
            <label htmlFor="phoneNumber" className="sr-only">
              {i18n.phonePlaceholder}
            </label>
            <input
              type="tel"
              id="phoneNumber"
              className="rv-input w-full"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder={i18n.phonePlaceholder}
              required
              disabled={isLoading}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "phone-error" : undefined}
            />
            {error && <p id="phone-error" className="text-rv-danger text-sm mt-1">{i18n.invalidPhone}</p>}
          </div>
          <button
            type="submit"
            className="rv-btn rv-primary w-full"
            disabled={isLoading || !isPhoneValid}
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
