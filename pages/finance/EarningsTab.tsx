import React, { useState, useEffect } from 'react';

/**
 * Fetcher function for earnings data
 * Uses credentials include for authentication
 */
const fetchEarningsData = async () => {
  try {
    const response = await fetch('/api/earnings/today', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch earnings');
    return await response.json();
  } catch (error) {
    console.error('Error fetching earnings:', error);
    throw error;
  }
};

/**
 * EarningsTab component for the Finance page
 * Displays earnings metrics and recent transaction history
 * Features walletless messaging and USDC-focused interface
 */
export default function EarningsTab() {
  const [data, setData] = useState({
    todayUSDC: 0,
    pendingUSDC: 0,
    lifetimeUSDC: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch earnings data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchEarningsData();
        setData(result);
      } catch (err) {
        setError('Failed to load earnings data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    
    // Set up periodic refresh every 2 minutes
    const interval = setInterval(loadData, 120000);
    return () => clearInterval(interval);
  }, []);
  
  /**
   * Format amount for display
   */
  const formatAmount = (amount: any) => Number(amount ?? 0).toFixed(2);
  
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 animate-pulse">
              <div className="h-4 bg-slate-800 rounded mb-2"></div>
              <div className="h-6 bg-slate-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-red-800 bg-red-900/40 p-4">
          <h3 className="text-red-300 font-semibold mb-2">Error Loading Earnings</h3>
          <p className="text-red-400 text-sm">
            Unable to load earnings data. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Earnings Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Metric label="Today" value={`$${formatAmount(data?.todayUSDC)} USDC`} />
        <Metric label="Pending" value={`$${formatAmount(data?.pendingUSDC)} USDC`} />
        <Metric label="Lifetime" value={`$${formatAmount(data?.lifetimeUSDC)} USDC`} />
      </div>
      
      {/* Walletless Information Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h3 className="text-slate-100 font-semibold mb-3">Recent earnings</h3>
        <p className="text-slate-400 text-sm mb-2">
          Walletless by default — we settle USDC to your payout method. 
          We cover gas from the Reelverse Treasury.
        </p>
        <p className="text-slate-500 text-xs">
          Connect a wallet later only if you want on-chain payouts.
        </p>
      </div>
      
      {/* Recent Transactions Placeholder */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h3 className="text-slate-100 font-semibold mb-3">Transaction History</h3>
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center">
            <span className="text-slate-400">💰</span>
          </div>
          <p className="text-slate-400 text-sm mb-2">No earnings yet</p>
          <p className="text-slate-500 text-xs">
            Start creating content to begin earning revenue from subscriptions, pay-per-view, and tips.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Metric component for displaying earnings statistics
 */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-slate-400 text-sm">{label}</div>
      <div className="text-xl font-semibold text-slate-100">{value}</div>
    </div>
  );
}