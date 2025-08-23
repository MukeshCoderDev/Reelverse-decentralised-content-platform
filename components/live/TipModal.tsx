import { useState, useEffect } from 'react';
import { useNumberFormat } from '../../hooks/useNumberFormat';

/**
 * Tip option interface
 */
export interface TipOption {
  amount: number; // USDC amount
  label: string;
  emoji?: string;
  popular?: boolean;
}

/**
 * Tip modal component properties
 */
export interface TipModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Function to close the modal */
  onClose: () => void;
  /** Streamer ID */
  streamerId: string;
  /** Streamer display name */
  streamerName: string;
  /** Streamer avatar URL */
  streamerAvatar?: string;
  /** Callback when tip is sent */
  onTipSent?: (amount: number, message?: string) => void;
  /** Whether user has sufficient balance */
  hasSufficientBalance?: boolean;
  /** User's current USDC balance */
  userBalance?: number;
}

/**
 * Predefined tip options
 */
const TIP_OPTIONS: TipOption[] = [
  { amount: 1, label: '$1', emoji: '👍', popular: false },
  { amount: 5, label: '$5', emoji: '🔥', popular: true },
  { amount: 10, label: '$10', emoji: '❤️', popular: true },
  { amount: 25, label: '$25', emoji: '🎉', popular: false },
  { amount: 50, label: '$50', emoji: '💯', popular: false },
  { amount: 100, label: '$100', emoji: '💎', popular: false }
];

/**
 * TipModal component for USDC tipping with walletless integration
 */
export function TipModal({
  isOpen,
  onClose,
  streamerId,
  streamerName,
  streamerAvatar,
  onTipSent,
  hasSufficientBalance = true,
  userBalance = 100
}: TipModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'select' | 'confirm' | 'success' | 'error'>('select');
  const [error, setError] = useState<string | null>(null);
  
  const { formatCurrency } = useNumberFormat();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedAmount(null);
      setCustomAmount('');
      setMessage('');
      setIsProcessing(false);
      setStep('select');
      setError(null);
    }
  }, [isOpen]);

  // Get final tip amount
  const getFinalAmount = () => {
    if (selectedAmount) return selectedAmount;
    const custom = parseFloat(customAmount);
    return !isNaN(custom) && custom > 0 ? custom : 0;
  };

  // Handle tip submission
  const handleSendTip = async () => {
    const amount = getFinalAmount();
    
    if (amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amount > userBalance) {
      setError('Insufficient balance');
      return;
    }

    if (amount < 1) {
      setError('Minimum tip amount is $1 USDC');
      return;
    }

    if (amount > 1000) {
      setError('Maximum tip amount is $1000 USDC');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setStep('confirm');

    try {
      // Simulate API call for tip transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock success (90% success rate)
      if (Math.random() > 0.1) {
        setStep('success');
        onTipSent?.(amount, message);
        
        // Auto-close after success
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle custom amount input
  const handleCustomAmountChange = (value: string) => {
    // Only allow numbers and decimal point
    const sanitized = value.replace(/[^0-9.]/g, '');
    // Only allow one decimal point
    const parts = sanitized.split('.');
    if (parts.length > 2) return;
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) return;
    
    setCustomAmount(sanitized);
    setSelectedAmount(null);
  };

  // Close modal handler
  const handleClose = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            {streamerAvatar && (
              <img 
                src={streamerAvatar} 
                alt={streamerName}
                className="h-10 w-10 rounded-full"
              />
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">Send tip</h2>
              <p className="text-sm text-slate-400">to {streamerName}</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-white transition-colors p-1 disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'select' && (
            <>
              {/* Balance display */}
              <div className="mb-6 p-4 bg-slate-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Your balance</span>
                  <span className="text-white font-semibold">{formatCurrency(userBalance)}</span>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Gas covered by Treasury
                  </span>
                </div>
              </div>

              {/* Tip amount selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Choose amount
                </label>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {TIP_OPTIONS.map((option) => (
                    <button
                      key={option.amount}
                      onClick={() => {
                        setSelectedAmount(option.amount);
                        setCustomAmount('');
                      }}
                      className={`
                        relative p-3 rounded-lg border-2 transition-all
                        ${selectedAmount === option.amount
                          ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                        }
                      `}
                    >
                      <div className="text-lg mb-1">{option.emoji}</div>
                      <div className="font-semibold">{option.label}</div>
                      {option.popular && (
                        <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                          Popular
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom amount input */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Or enter custom amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="text"
                      value={customAmount}
                      onChange={(e) => handleCustomAmountChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-12 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm">USDC</span>
                  </div>
                </div>
              </div>

              {/* Optional message */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Message (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Say something nice..."
                  maxLength={200}
                  rows={3}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
                <div className="text-xs text-slate-500 mt-1 text-right">
                  {message.length}/200
                </div>
              </div>

              {/* Error display */}
              {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-700/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Send button */}
              <button
                onClick={handleSendTip}
                disabled={getFinalAmount() <= 0 || !hasSufficientBalance}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                Send {getFinalAmount() > 0 ? formatCurrency(getFinalAmount()) : 'Tip'}
              </button>
            </>
          )}

          {step === 'confirm' && (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Processing tip...</h3>
              <p className="text-slate-400">Sending {formatCurrency(getFinalAmount())} to {streamerName}</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-6">
              <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Tip sent!</h3>
              <p className="text-slate-400">
                {formatCurrency(getFinalAmount())} sent to {streamerName}
              </p>
              {message && (
                <div className="mt-3 p-3 bg-slate-800 rounded-lg text-sm text-slate-300">
                  "{message}"
                </div>
              )}
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-6">
              <div className="h-16 w-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Tip failed</h3>
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}