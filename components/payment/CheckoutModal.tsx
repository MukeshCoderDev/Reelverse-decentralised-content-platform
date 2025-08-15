import React, { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { PaymentService, PaymentMethod, PaymentResult } from '../../services/paymentService';
import Icon from '../Icon';
import Button from '../Button';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: PaymentResult) => void;
  contentId: string;
  contentTitle: string;
  creatorName: string;
  priceUSDC?: number; // Price in USDC (6 decimals)
  priceFiat?: number; // Price in USD
  entitlementType: 'ppv' | 'subscription';
  subscriptionDuration?: number; // Days for subscription
}

type PaymentStep = 'method' | 'processing' | 'success' | 'error';

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  contentId,
  contentTitle,
  creatorName,
  priceUSDC,
  priceFiat,
  entitlementType,
  subscriptionDuration = 30
}) => {
  const { account, isConnected, isAuthenticated } = useWallet();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('usdc');
  const [currentStep, setCurrentStep] = useState<PaymentStep>('method');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  
  const paymentService = PaymentService.getInstance();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('method');
      setError(null);
      setIsProcessing(false);
      setPaymentResult(null);
      // Default to USDC if available, otherwise fiat
      setSelectedMethod(priceUSDC ? 'usdc' : 'fiat');
    }
  }, [isOpen, priceUSDC]);

  const handlePayment = async () => {
    if (!account || !isConnected || !isAuthenticated) {
      setError('Please connect and authenticate your wallet first');
      return;
    }

    try {
      setIsProcessing(true);
      setCurrentStep('processing');
      setError(null);

      let result: PaymentResult;

      if (selectedMethod === 'usdc' && priceUSDC) {
        result = await paymentService.processUSDCPayment({
          contentId,
          userAddress: account,
          amount: priceUSDC,
          entitlementType,
          subscriptionDuration: entitlementType === 'subscription' ? subscriptionDuration : undefined
        });
      } else if (selectedMethod === 'fiat' && priceFiat) {
        result = await paymentService.processFiatPayment({
          contentId,
          userAddress: account,
          amount: priceFiat,
          entitlementType,
          subscriptionDuration: entitlementType === 'subscription' ? subscriptionDuration : undefined
        });
      } else {
        throw new Error('Invalid payment configuration');
      }

      setPaymentResult(result);
      setCurrentStep('success');
      
      // Call success callback after a brief delay
      setTimeout(() => {
        onSuccess(result);
      }, 1500);

    } catch (error: any) {
      console.error('Payment failed:', error);
      setError(error.message || 'Payment failed. Please try again.');
      setCurrentStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  const formatPrice = (price: number, currency: 'USDC' | 'USD') => {
    if (currency === 'USDC') {
      return `${(price / 1000000).toFixed(2)} USDC`;
    }
    return `$${price.toFixed(2)} USD`;
  };

  const getEntitlementDescription = () => {
    if (entitlementType === 'subscription') {
      return `${subscriptionDuration}-day subscription access`;
    }
    return 'Lifetime access to this content';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-background rounded-xl border border-border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">
            {currentStep === 'success' ? 'Payment Successful!' : 'Purchase Content'}
          </h2>
          {!isProcessing && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8"
            >
              <Icon name="x" size={16} />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Content Info */}
          <div className="mb-6 p-4 bg-secondary/50 rounded-lg">
            <h3 className="font-medium text-sm mb-1">{contentTitle}</h3>
            <p className="text-xs text-muted-foreground mb-2">by {creatorName}</p>
            <p className="text-xs text-muted-foreground">{getEntitlementDescription()}</p>
          </div>

          {/* Payment Method Selection */}
          {currentStep === 'method' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-3">Choose Payment Method</h4>
                <div className="space-y-3">
                  {/* USDC Payment Option */}
                  {priceUSDC && (
                    <label className="flex items-center p-4 border border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="usdc"
                        checked={selectedMethod === 'usdc'}
                        onChange={(e) => setSelectedMethod(e.target.value as PaymentMethod)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">$</span>
                            </div>
                            <div>
                              <p className="font-medium text-sm">Pay with USDC</p>
                              <p className="text-xs text-muted-foreground">Instant crypto payment</p>
                            </div>
                          </div>
                          <span className="font-semibold text-sm">{formatPrice(priceUSDC, 'USDC')}</span>
                        </div>
                      </div>
                    </label>
                  )}

                  {/* Fiat Payment Option */}
                  {priceFiat && (
                    <label className="flex items-center p-4 border border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="fiat"
                        checked={selectedMethod === 'fiat'}
                        onChange={(e) => setSelectedMethod(e.target.value as PaymentMethod)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                              <Icon name="credit-card" size={16} className="text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">Pay with Card</p>
                              <p className="text-xs text-muted-foreground">Credit/Debit card</p>
                            </div>
                          </div>
                          <span className="font-semibold text-sm">{formatPrice(priceFiat, 'USD')}</span>
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Payment Button */}
              <Button
                onClick={handlePayment}
                disabled={!isConnected || !isAuthenticated}
                className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
              >
                {!isConnected ? 'Connect Wallet First' :
                 !isAuthenticated ? 'Authenticate First' :
                 `Pay ${selectedMethod === 'usdc' && priceUSDC ? formatPrice(priceUSDC, 'USDC') : 
                      selectedMethod === 'fiat' && priceFiat ? formatPrice(priceFiat, 'USD') : ''}`}
              </Button>

              {/* Payment Info */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Secure payment processing</p>
                <p>• Instant access after payment</p>
                <p>• 90% goes directly to creator</p>
                {selectedMethod === 'usdc' && <p>• No additional fees for crypto payments</p>}
              </div>
            </div>
          )}

          {/* Processing State */}
          {currentStep === 'processing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <h3 className="text-lg font-medium mb-2">Processing Payment</h3>
              <p className="text-sm text-muted-foreground">
                {selectedMethod === 'usdc' 
                  ? 'Please confirm the transaction in your wallet...'
                  : 'Redirecting to payment processor...'
                }
              </p>
            </div>
          )}

          {/* Success State */}
          {currentStep === 'success' && paymentResult && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="check" size={32} className="text-white" />
              </div>
              <h3 className="text-lg font-medium mb-2">Payment Successful!</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You now have access to this content
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-left">
                <div className="text-xs space-y-1">
                  <p><strong>Transaction ID:</strong> {paymentResult.transactionId}</p>
                  <p><strong>Amount:</strong> {paymentResult.amount} {paymentResult.currency}</p>
                  <p><strong>Method:</strong> {paymentResult.method.toUpperCase()}</p>
                  {paymentResult.entitlementId && (
                    <p><strong>Entitlement:</strong> {paymentResult.entitlementId}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {currentStep === 'error' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="x" size={32} className="text-white" />
              </div>
              <h3 className="text-lg font-medium mb-2">Payment Failed</h3>
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <div className="space-y-3">
                <Button
                  onClick={() => setCurrentStep('method')}
                  variant="outline"
                  className="w-full"
                >
                  Try Again
                </Button>
                <Button
                  onClick={handleClose}
                  variant="ghost"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};