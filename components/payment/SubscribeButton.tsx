import React, { useState, useEffect } from 'react';
import { useAuth } from '../../src/auth/AuthProvider';

interface SubscriptionPlan {
  id: string;
  name: string;
  priceUSDC: number;
  cadence: 'monthly' | 'annual';
  subscriberCount?: number;
}

interface UserSubscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due';
  priceUSDC: number;
  nextBillingAt: string;
  canceledAt?: string;
  plan: {
    name: string;
    cadence: 'monthly' | 'annual';
  };
}

interface SubscribeButtonProps {
  creatorId: string;
  creatorName?: string;
  className?: string;
  variant?: 'default' | 'compact';
  onSubscriptionChange?: (subscribed: boolean) => void;
}

/**
 * SubscribeButton Component
 * 
 * Features:
 * - Subscription state management
 * - Plan selection modal
 * - Cancel/reactivate functionality
 * - Progress indicators
 * - Error handling and retry logic
 * - Monthly/annual plan support
 */
export default function SubscribeButton({
  creatorId,
  creatorName = 'Creator',
  className = '',
  variant = 'default',
  onSubscriptionChange
}: SubscribeButtonProps) {
  const { user, openSignInModal } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Load user's subscription status and available plans
  useEffect(() => {
    if (user && creatorId) {
      loadSubscriptionData();
    }
  }, [user, creatorId]);

  const loadSubscriptionData = async () => {
    if (!user) return;

    try {
      // Load user's subscriptions
      const subscriptionsResponse = await fetch('/api/subscriptions/user', {
        credentials: 'include'
      });

      if (subscriptionsResponse.ok) {
        const subscriptionsData = await subscriptionsResponse.json();
        const currentSub = subscriptionsData.subscriptions?.find(
          (sub: any) => sub.creatorId === creatorId && sub.status === 'active'
        );
        setSubscription(currentSub || null);
      }

      // Load creator's available plans
      const plansResponse = await fetch(`/api/subscriptions/creator/${creatorId}/plans`);
      
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setAvailablePlans(plansData.plans || []);
        
        // Set default selected plan (first monthly, or first available)
        const defaultPlan = plansData.plans?.find((p: SubscriptionPlan) => p.cadence === 'monthly') || 
                           plansData.plans?.[0];
        setSelectedPlan(defaultPlan || null);
      }

    } catch (error) {
      console.error('Failed to load subscription data:', error);
    }
  };

  // Handle subscribe button click
  const handleSubscribeClick = () => {
    if (!user) {
      openSignInModal();
      return;
    }

    // Track subscription click
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'sub_click', {
        creator_id: creatorId,
        creator_name: creatorName
      });
    }

    if (subscription?.status === 'active') {
      // Show manage subscription modal
      setIsModalOpen(true);
    } else {
      // Show subscribe modal
      setIsModalOpen(true);
    }
  };

  // Handle subscription creation
  const handleSubscribe = async () => {
    if (!user || !selectedPlan) return;

    setIsLoading(true);
    setError(null);

    try {
      // Generate idempotency key
      const idempotencyKey = `sub_${user.id}_${creatorId}_${selectedPlan.id}_${Date.now()}`;

      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        credentials: 'include',
        body: JSON.stringify({
          creatorId,
          planId: selectedPlan.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subscription');
      }

      // Success! Update state
      const newSubscription: UserSubscription = {
        id: data.subscriptionId,
        status: 'active',
        priceUSDC: selectedPlan.priceUSDC,
        nextBillingAt: data.nextRenewalDate,
        plan: {
          name: selectedPlan.name,
          cadence: selectedPlan.cadence
        }
      };

      setSubscription(newSubscription);
      setShowSuccess(true);
      setIsModalOpen(false);

      // Track successful subscription
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'sub_started', {
          creator_id: creatorId,
          creator_name: creatorName,
          plan_id: selectedPlan.id,
          price: selectedPlan.priceUSDC,
          cadence: selectedPlan.cadence
        });
      }

      // Update balance pill
      if (typeof window !== 'undefined' && (window as any).mutate) {
        (window as any).mutate('/api/finance/summary');
      }

      // Call change callback
      if (onSubscriptionChange) {
        onSubscriptionChange(true);
      }

      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);

    } catch (err: any) {
      console.error('Subscription failed:', err);
      setError(err.message || 'Failed to create subscription. Please try again.');

      // Track subscription failure
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'sub_failed', {
          creator_id: creatorId,
          error: err.message
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle subscription cancellation
  const handleCancelSubscription = async () => {
    if (!subscription) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'cancel',
          reason: 'user_canceled'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      // Update subscription state
      setSubscription({
        ...subscription,
        status: 'canceled',
        canceledAt: new Date().toISOString()
      });

      setIsModalOpen(false);

      // Call change callback
      if (onSubscriptionChange) {
        onSubscriptionChange(false);
      }

    } catch (err: any) {
      console.error('Cancellation failed:', err);
      setError(err.message || 'Failed to cancel subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Close modal
  const closeModal = () => {
    if (!isLoading) {
      setIsModalOpen(false);
      setError(null);
    }
  };

  // Format price display
  const formatPrice = (price: number, cadence: string) => {
    return cadence === 'annual' ? `$${price}/year` : `$${price}/month`;
  };

  // Render button based on subscription status
  const renderButton = () => {
    if (showSuccess) {
      return (
        <button
          className={`inline-flex items-center gap-2 rounded-lg bg-green-600 text-white px-4 py-2.5 text-sm font-medium scale-105 transition-all ${className}`}
          disabled
        >
          <span>✓ Subscribed!</span>
        </button>
      );
    }

    if (subscription?.status === 'active') {
      return (
        <button
          onClick={handleSubscribeClick}
          className={`inline-flex items-center gap-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 ${className}`}
        >
          <span className="w-2 h-2 bg-green-400 rounded-full"></span>
          <span>Subscribed</span>
        </button>
      );
    }

    if (subscription?.status === 'canceled') {
      return (
        <button
          onClick={handleSubscribeClick}
          className={`inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 ${className}`}
        >
          <span>Resubscribe</span>
        </button>
      );
    }

    // Default subscribe button
    const defaultPrice = selectedPlan?.priceUSDC || availablePlans[0]?.priceUSDC || 4.99;
    
    return (
      <button
        onClick={handleSubscribeClick}
        className={`inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-950 ${className}`}
      >
        <span>💜</span>
        <span>Subscribe ${formatPrice(defaultPrice, 'monthly')}</span>
      </button>
    );
  };

  return (
    <>
      {renderButton()}
      {isModalOpen && <SubscriptionModal />}
    </>
  );

  // Subscription Modal Component
  function SubscriptionModal() {
    const isManaging = subscription?.status === 'active';

    if (isManaging) {
      return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-slate-100">
                Manage Subscription
              </h3>
              <button
                onClick={closeModal}
                disabled={isLoading}
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-full hover:bg-slate-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Current Subscription Info */}
            <div className="bg-slate-800 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                <span className="text-slate-200 font-medium">Active Subscription</span>
              </div>
              <p className="text-slate-300 text-sm">
                {subscription?.plan.name} • {formatPrice(subscription?.priceUSDC || 0, subscription?.plan.cadence || 'monthly')}
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Next billing: {subscription?.nextBillingAt ? new Date(subscription.nextBillingAt).toLocaleDateString() : 'Unknown'}
              </p>
            </div>

            {/* Description */}
            <p className="text-slate-300 text-sm mb-6">
              Cancel anytime. 90% goes directly to {creatorName}.
            </p>

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
                disabled={isLoading}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
              >
                Close
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={isLoading}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Canceling...</span>
                  </>
                ) : (
                  <span>Cancel Subscription</span>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Subscribe Modal
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-slate-100">
              Subscribe to {creatorName}
            </h3>
            <button
              onClick={closeModal}
              disabled={isLoading}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-full hover:bg-slate-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Description */}
          <p className="text-slate-300 text-sm mb-6">
            Cancel anytime. 90% goes directly to the creator. Support {creatorName}'s content with a monthly subscription.
          </p>

          {/* Plan Selection */}
          {availablePlans.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-200 mb-3">
                Choose Plan
              </label>
              <div className="space-y-2">
                {availablePlans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    disabled={isLoading}
                    className={`w-full p-3 text-left rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                      selectedPlan?.id === plan.id
                        ? 'bg-violet-900/30 border-violet-600 text-violet-200'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{plan.name}</p>
                        <p className="text-sm text-slate-400">
                          {formatPrice(plan.priceUSDC, plan.cadence)}
                        </p>
                      </div>
                      {plan.cadence === 'annual' && (
                        <span className="px-2 py-1 bg-green-600 text-green-100 text-xs rounded-full">
                          Save 20%
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

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
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubscribe}
              disabled={isLoading || !selectedPlan}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <span>
                  Subscribe {selectedPlan ? formatPrice(selectedPlan.priceUSDC, selectedPlan.cadence) : ''}
                </span>
              )}
            </button>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-slate-400 mt-4 text-center">
            Subscriptions are processed monthly and can be canceled anytime
          </p>
        </div>
      </div>
    );
  }
}