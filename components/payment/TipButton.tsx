import React, { useState, useEffect } from 'react';
import { useAuth } from '../../src/auth/AuthProvider';

interface TipButtonProps {
  videoId: string;
  creatorId: string;
  creatorName?: string;
  className?: string;
  variant?: 'default' | 'compact';
  onTipSuccess?: (amount: number) => void;
}

interface TipResponse {
  ok: boolean;
  transactionId: string;
  todayUSDC: number;
  pendingUSDC: number;
  availableUSDC: number;
}

/**
 * TipButton Component
 * 
 * Features:
 * - Modal flow with amount selection
 * - Success animations and feedback
 * - Balance pill updates via SWR mutate
 * - Error handling and retry logic
 * - Authentication integration
 * - Analytics tracking
 */
export default function TipButton({
  videoId,
  creatorId,
  creatorName,
  className = '',
  variant = 'default',
  onTipSuccess
}: TipButtonProps) {
  const { user, openSignInModal } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(5);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTipAmount, setLastTipAmount] = useState<number | null>(null);

  // Predefined tip amounts
  const quickAmounts = [2, 5, 10, 20, 50];
  const isCustomAmount = !quickAmounts.includes(selectedAmount);

  // Reset states when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      setError(null);
      setCustomAmount('');
      if (!quickAmounts.includes(selectedAmount)) {
        setSelectedAmount(5);
      }
    }
  }, [isModalOpen]);

  // Handle tip button click
  const handleTipClick = () => {
    if (!user) {
      openSignInModal();
      return;
    }

    // Track tip button click
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'tip_click', {
        video_id: videoId,
        creator_id: creatorId
      });
    }

    setIsModalOpen(true);
  };

  // Handle amount selection
  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
    setError(null);
  };

  // Handle custom amount input
  const handleCustomAmountChange = (value: string) => {
    const numericValue = value.replace(/[^0-9.]/g, '');
    setCustomAmount(numericValue);
    
    const amount = parseFloat(numericValue);
    if (!isNaN(amount) && amount > 0) {
      setSelectedAmount(amount);
    }
    
    setError(null);
  };

  // Validate tip amount
  const validateAmount = (amount: number): string | null => {
    if (amount < 1) return 'Minimum tip is $1';
    if (amount > 100) return 'Maximum tip is $100';
    if (amount.toString().split('.')[1]?.length > 2) {
      return 'Amount can only have 2 decimal places';
    }
    return null;
  };

  // Process tip transaction
  const handleTipSubmit = async () => {
    if (!user) return;

    const amount = isCustomAmount ? parseFloat(customAmount) : selectedAmount;
    
    // Validate amount
    const validationError = validateAmount(amount);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Prevent self-tipping
    if (user.id === creatorId) {
      setError('You cannot tip yourself');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Generate idempotency key
      const idempotencyKey = `tip_${user.id}_${videoId}_${Date.now()}_${Math.random()}`;

      const response = await fetch('/api/tips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        credentials: 'include',
        body: JSON.stringify({
          videoId,
          creatorId,
          amountUSDC: amount
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process tip');
      }

      const tipData = data as TipResponse;

      // Success! Show success animation
      setLastTipAmount(amount);
      setShowSuccess(true);
      setIsModalOpen(false);

      // Track successful tip
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'tip_success', {
          video_id: videoId,
          creator_id: creatorId,
          amount: amount,
          transaction_id: tipData.transactionId
        });
      }

      // Trigger balance pill update via SWR mutate
      if (typeof window !== 'undefined' && (window as any).mutate) {
        (window as any).mutate('/api/finance/summary');
      }

      // Call success callback
      if (onTipSuccess) {
        onTipSuccess(amount);
      }

      // Show success state for 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
        setLastTipAmount(null);
      }, 3000);

    } catch (err: any) {
      console.error('Tip failed:', err);
      setError(err.message || 'Failed to process tip. Please try again.');

      // Track tip failure
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'tip_failed', {
          video_id: videoId,
          creator_id: creatorId,
          amount: amount,
          error: err.message
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Close modal
  const closeModal = () => {
    if (!isProcessing) {
      setIsModalOpen(false);
    }
  };

  // Render compact variant
  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleTipClick}
          className={`inline-flex items-center gap-1 rounded-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 ${className}`}
          disabled={showSuccess}
        >
          {showSuccess ? (
            <>
              <span className="text-xs">✓</span>
              <span>${lastTipAmount}</span>
            </>
          ) : (
            <>
              <span className="text-base font-normal">$</span>
              <span>Tip</span>
            </>
          )}
        </button>
        {isModalOpen && <TipModal />}
      </>
    );
  }

  // Render default variant
  return (
    <>
      <button
        onClick={handleTipClick}
        className={`inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 ${showSuccess ? 'bg-emerald-500 scale-105' : ''} ${className}`}
        disabled={showSuccess}
      >
        {showSuccess ? (
          <>
            <span className="text-lg">🎉</span>
            <span>Tipped ${lastTipAmount}!</span>
          </>
        ) : (
          <>
            <span className="text-lg">💰</span>
            <span>Tip Creator</span>
          </>
        )}
      </button>
      {isModalOpen && <TipModal />}
    </>
  );

  // Tip Modal Component
  function TipModal() {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-slate-100">
              Tip {creatorName || 'Creator'}
            </h3>
            <button
              onClick={closeModal}
              disabled={isProcessing}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-full hover:bg-slate-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Description */}
          <p className="text-slate-300 text-sm mb-6">
            Tip in USDC — gas fees covered by Reelverse Treasury. 
            {creatorName ? ` Support ${creatorName}'s content!` : ' Support great content!'}
          </p>

          {/* Quick Amount Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-200 mb-3">
              Select Amount
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {quickAmounts.map(amount => (
                <button
                  key={amount}
                  onClick={() => handleAmountSelect(amount)}
                  disabled={isProcessing}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    selectedAmount === amount && !isCustomAmount
                      ? 'bg-emerald-700 text-white border-emerald-600'
                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:border-slate-600'
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>

            {/* Custom Amount Input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">$</span>
              <input
                type="text"
                placeholder="Custom amount"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                disabled={isProcessing}
                className="w-full pl-8 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={closeModal}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleTipSubmit}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Send ${isCustomAmount ? customAmount || '0' : selectedAmount} USDC</span>
                </>
              )}
            </button>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-slate-400 mt-4 text-center">
            Tips are processed instantly and cannot be reversed
          </p>
        </div>
      </div>
    );
  }
}