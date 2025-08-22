// src/components/auth/PhoneSignIn.tsx
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { getLang } from "../../i18n/auth";

// Dummy country codes for demonstration. In a real app, this would come from an API or a larger library.
const countryCodes = [
  { code: "+1", name: "US" },
  { code: "+44", name: "UK" },
  { code: "+91", name: "IN" },
  { code: "+52", name: "MX" },
  { code: "+55", name: "BR" },
];

export const PhoneSignIn: React.FC = () => {
  const { otpStart, login, isLoading, error } = useAuth();
  const [selectedCountryCode, setSelectedCountryCode] = useState(countryCodes[0].code);
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [txId, setTxId] = useState<string | null>(null);
  const [maskedPhoneNumber, setMaskedPhoneNumber] = useState<string | null>(
    null
  );
  const [step, setStep] = useState<"inputPhone" | "verifyOtp">("inputPhone");
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
    if (!phoneNumber) return;

    const fullPhoneNumber = `${selectedCountryCode}${phoneNumber.replace(/\D/g, '')}`;
    const response = await otpStart(fullPhoneNumber, "sms"); // Assuming SMS for phone OTP
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

  const isPhoneValid = phoneNumber.replace(/\D/g, '').length > 5; // Basic validation, stripping non-digits
  const isOtpValid = otpCode.length === 6; // Assuming 6-digit OTP

  return (
    <div className="space-y-6">
      {step === "inputPhone" ? (
        <form onSubmit={handleStartOtp} className="space-y-6">
          <div>
            <label htmlFor="countryCode" className="block text-sm font-medium text-rv-text mb-1">
              {i18n.countryCodeLabel}
            </label>
            <select
              id="countryCode"
              className="rv-input w-full mb-4"
              value={selectedCountryCode}
              onChange={(e) => setSelectedCountryCode(e.target.value)}
              disabled={isLoading}
            >
              {countryCodes.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} ({country.code})
                </option>
              ))}
            </select>

            <label htmlFor="phoneNumber" className="block text-sm font-medium text-rv-text mb-1">
              {i18n.phoneNumberLabel}
            </label>
            <input
              type="tel"
              inputMode="numeric"
              id="phoneNumber"
              className="rv-input w-full"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder={i18n.enterPhoneNumberHint}
              required
              disabled={isLoading}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "phone-error" : undefined}
            />
            {error && <p id="phone-error" className="rv-error">{i18n.invalidPhone}</p>}
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
        <form onSubmit={handleVerifyOtp} className="space-y-6">
          <p className="text-rv-muted text-sm text-center">
            {i18n.codeSentTo.replace("{destination}", maskedPhoneNumber || "")}
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
