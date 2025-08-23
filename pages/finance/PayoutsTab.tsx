import React, { useState, useEffect } from 'react';
import Icon from '../../components/Icon';

interface PayoutMethod {
  id: string;
  type: 'crypto' | 'bank';
  name: string;
  address?: string;
  accountNumber?: string;
  isVerified: boolean;
  isDefault: boolean;
}

interface PayoutRequest {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payoutMethod: PayoutMethod;
  requestedAt: string;
  processedAt?: string;
  transactionHash?: string;
  failureReason?: string;
}

interface PayoutSummary {
  availableUSDC: number;
  minimumPayout: number;
  processingUSDC: number;
  lastPayoutAt?: string;
}

/**
 * Fetch payout summary
 */
const fetchPayoutSummary = async (): Promise<PayoutSummary> => {
  const response = await fetch('/api/payouts/summary', { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to fetch payout summary');
  return await response.json();
};

/**
 * Fetch payout methods
 */
const fetchPayoutMethods = async (): Promise<PayoutMethod[]> => {
  const response = await fetch('/api/payouts/methods', { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to fetch payout methods');
  const data = await response.json();
  return data.methods || [];
};

/**
 * Fetch payout history
 */
const fetchPayoutHistory = async (): Promise<PayoutRequest[]> => {
  const response = await fetch('/api/payouts/history', { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to fetch payout history');
  const data = await response.json();
  return data.payouts || [];
};

/**
 * Request a payout
 */
const requestPayout = async (amount: number, methodId: string): Promise<PayoutRequest> => {
  const response = await fetch('/api/payouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ amountUSDC: amount, payoutMethodId: methodId })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to request payout');
  }
  
  return await response.json();
};

/**
 * PayoutsTab component for the Finance page
 * Displays payout method configuration, withdrawal options, and payout history
 * Emphasizes walletless payouts with KYC integration for larger amounts
 */
export default function PayoutsTab() {
  const [summary, setSummary] = useState<PayoutSummary>({
    availableUSDC: 0,
    minimumPayout: 10,
    processingUSDC: 0
  });
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [showAddMethod, setShowAddMethod] = useState(false);

  // Load payout data
  useEffect(() => {
    loadPayoutData();
  }, []);

  const loadPayoutData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [summaryData, methodsData, historyData] = await Promise.all([
        fetchPayoutSummary(),
        fetchPayoutMethods(),
        fetchPayoutHistory()
      ]);
      
      setSummary(summaryData);
      setPayoutMethods(methodsData);
      setPayoutHistory(historyData);
      
      // Set default method
      const defaultMethod = methodsData.find(m => m.isDefault);
      if (defaultMethod) {
        setSelectedMethod(defaultMethod.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load payout data');
    } finally {
      setLoading(false);
    }
  };

  // Handle payout request
  const handlePayoutRequest = async () => {
    if (!payoutAmount || !selectedMethod) return;
    
    const amount = parseFloat(payoutAmount);
    if (amount < summary.minimumPayout) {
      setError(`Minimum payout amount is $${summary.minimumPayout}`);
      return;
    }
    
    if (amount > summary.availableUSDC) {
      setError('Insufficient available balance');
      return;
    }

    try {
      setPayoutLoading(true);
      setError(null);
      
      const newPayout = await requestPayout(amount, selectedMethod);
      
      // Update local state
      setPayoutHistory(prev => [newPayout, ...prev]);
      setSummary(prev => ({
        ...prev,
        availableUSDC: prev.availableUSDC - amount,
        processingUSDC: prev.processingUSDC + amount
      }));
      
      setShowPayoutModal(false);
      setPayoutAmount('');
    } catch (err: any) {
      setError(err.message || 'Failed to request payout');
    } finally {
      setPayoutLoading(false);
    }
  };

  // Format currency
  const formatAmount = (amount: number) => amount.toFixed(2);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-slate-800 rounded-xl"></div>
          <div className="h-48 bg-slate-800 rounded-xl"></div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Payouts</h2>
          <p className="text-sm text-slate-400 mt-1">
            Withdraw your earnings to crypto wallets or bank accounts
          </p>
        </div>
        
        <button
          onClick={() => setShowPayoutModal(true)}
          disabled={summary.availableUSDC < summary.minimumPayout}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Icon name="arrow-up" size={16} />
          Request Payout
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-600/20 border border-red-600/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Icon name="alert-circle" size={16} className="text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Payout Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-emerald-800/30 bg-emerald-900/20 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="dollar-sign" size={16} className="text-emerald-400" />
            <span className="text-emerald-300 font-medium">Available</span>
          </div>
          <div className="text-2xl font-bold text-emerald-100">${formatAmount(summary.availableUSDC)}</div>
          <div className="text-xs text-emerald-400 mt-1">Ready to withdraw</div>
        </div>
        
        <div className="rounded-xl border border-yellow-800/30 bg-yellow-900/20 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="clock" size={16} className="text-yellow-400" />
            <span className="text-yellow-300 font-medium">Processing</span>
          </div>
          <div className="text-2xl font-bold text-yellow-100">${formatAmount(summary.processingUSDC)}</div>
          <div className="text-xs text-yellow-400 mt-1">In progress</div>
        </div>
        
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="info" size={16} className="text-slate-400" />
            <span className="text-slate-300 font-medium">Minimum</span>
          </div>
          <div className="text-2xl font-bold text-slate-100">${formatAmount(summary.minimumPayout)}</div>
          <div className="text-xs text-slate-400 mt-1">Required to withdraw</div>
        </div>
      </div>
      {/* Payout Methods */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-100 font-semibold">Payout Methods</h3>
          <button
            onClick={() => setShowAddMethod(true)}
            className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            + Add Method
          </button>
        </div>
        
        {payoutMethods.length > 0 ? (
          <div className="space-y-3">
            {payoutMethods.map((method) => (
              <div key={method.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-800 bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                    <Icon name={method.type === 'crypto' ? 'wallet' : 'credit-card'} size={16} className="text-slate-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-200 font-medium">{method.name}</span>
                      {method.isDefault && (
                        <span className="px-2 py-1 rounded text-xs bg-violet-600/20 text-violet-400">Default</span>
                      )}
                      {method.isVerified && (
                        <Icon name="check-circle" size={14} className="text-emerald-400" />
                      )}
                    </div>
                    <div className="text-slate-400 text-sm">
                      {method.type === 'crypto' ? 
                        `${method.address?.slice(0, 8)}...${method.address?.slice(-6)}` :
                        `****${method.accountNumber?.slice(-4)}`
                      }
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!method.isVerified && (
                    <button className="text-xs text-yellow-400 hover:text-yellow-300">
                      Verify
                    </button>
                  )}
                  <button className="text-xs text-slate-400 hover:text-slate-300">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center">
              <Icon name="wallet" size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-400 text-sm mb-2">No payout methods</p>
            <p className="text-slate-500 text-xs mb-4">
              Add a crypto wallet or bank account to receive payouts
            </p>
            <button
              onClick={() => setShowAddMethod(true)}
              className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              Add your first method
            </button>
          </div>
        )}
      </div>

      {/* Recent Payouts */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h3 className="text-slate-100 font-semibold mb-4">Recent Payouts</h3>
        
        {payoutHistory.length > 0 ? (
          <div className="space-y-3">
            {payoutHistory.slice(0, 5).map((payout) => (
              <div key={payout.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-800 bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    payout.status === 'completed' ? 'bg-emerald-600/20 text-emerald-400' :
                    payout.status === 'processing' ? 'bg-yellow-600/20 text-yellow-400' :
                    payout.status === 'failed' ? 'bg-red-600/20 text-red-400' :
                    'bg-slate-600/20 text-slate-400'
                  }`}>
                    <Icon name={
                      payout.status === 'completed' ? 'check' :
                      payout.status === 'processing' ? 'clock' :
                      payout.status === 'failed' ? 'x' : 'clock'
                    } size={14} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-200">
                      ${formatAmount(payout.amount)} to {payout.payoutMethod.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatDate(payout.requestedAt)}
                      {payout.status === 'failed' && payout.failureReason && (
                        <span className="text-red-400 ml-2">• {payout.failureReason}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-xs font-medium ${
                    payout.status === 'completed' ? 'text-emerald-400' :
                    payout.status === 'processing' ? 'text-yellow-400' :
                    payout.status === 'failed' ? 'text-red-400' :
                    'text-slate-400'
                  }`}>
                    {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                  </div>
                  {payout.transactionHash && (
                    <button className="text-xs text-violet-400 hover:text-violet-300 mt-1">
                      View Tx
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {payoutHistory.length > 5 && (
              <div className="pt-3 border-t border-slate-800">
                <button className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
                  View all payouts →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center">
              <Icon name="arrow-up" size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-400 text-sm mb-2">No payouts yet</p>
            <p className="text-slate-500 text-xs">
              Request your first payout when you have at least ${summary.minimumPayout} available
            </p>
          </div>
        )}
      </div>
      {/* Payout Information */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h3 className="text-slate-100 font-semibold mb-4">How Payouts Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon name="check" size={12} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-300">Automatic Settlement</div>
                <div className="text-xs text-slate-400">Earnings are settled in USDC automatically</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon name="shield" size={12} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-300">Gas Fees Covered</div>
                <div className="text-xs text-slate-400">All transaction fees paid by Reelverse Treasury</div>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon name="zap" size={12} className="text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-300">Fast Processing</div>
                <div className="text-xs text-slate-400">Instant for crypto, 2-3 days for bank transfers</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon name="dollar-sign" size={12} className="text-violet-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-300">Low Minimums</div>
                <div className="text-xs text-slate-400">Minimum payout: ${summary.minimumPayout} USDC</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payout Request Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">Request Payout</h3>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Amount (USDC)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    min={summary.minimumPayout}
                    max={summary.availableUSDC}
                    step="0.01"
                    className="w-full px-3 py-2 pr-20 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:border-violet-500 focus:outline-none"
                    placeholder="0.00"
                  />
                  <button
                    onClick={() => setPayoutAmount(summary.availableUSDC.toString())}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-violet-400 hover:text-violet-300"
                  >
                    Max
                  </button>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Available: ${formatAmount(summary.availableUSDC)} USDC
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Payout Method
                </label>
                <select
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:border-violet-500 focus:outline-none"
                >
                  <option value="">Select method...</option>
                  {payoutMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name} ({method.type})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handlePayoutRequest}
                  disabled={!payoutAmount || !selectedMethod || payoutLoading}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {payoutLoading ? 'Processing...' : 'Request Payout'}
                </button>
                
                <button
                  onClick={() => setShowPayoutModal(false)}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}