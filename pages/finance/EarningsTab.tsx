import React, { useState, useEffect } from 'react';
import Icon from '../../components/Icon';

interface EarningsData {
  todayUSDC: number;
  pendingUSDC: number;
  lifetimeUSDC: number;
  availableUSDC: number;
  totalReferralUSDC?: number;
  totalTipsUSDC?: number;
  totalSubscriptionUSDC?: number;
}

interface Transaction {
  id: string;
  type: 'tip' | 'subscription' | 'referral' | 'split_share';
  amount: number;
  source: string;
  createdAt: string;
  videoTitle?: string;
  referralCode?: string;
}

/**
 * Fetcher function for earnings data
 * Uses credentials include for authentication
 */
const fetchEarningsData = async (): Promise<EarningsData> => {
  try {
    const response = await fetch('/api/finance/summary', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch earnings');
    return await response.json();
  } catch (error) {
    console.error('Error fetching earnings:', error);
    throw error;
  }
};

/**
 * Fetcher function for transaction history
 */
const fetchTransactions = async (page = 1, limit = 50): Promise<{ transactions: Transaction[], total: number }> => {
  try {
    const response = await fetch(`/api/earnings/transactions?page=${page}&limit=${limit}`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch transactions');
    return await response.json();
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
};

/**
 * Export earnings to CSV
 */
const exportEarningsCSV = async (period: 'all' | '30d' | '7d' = 'all') => {
  try {
    const response = await fetch(`/api/earnings/export?period=${period}`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to export earnings');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earnings-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error exporting earnings:', error);
    throw error;
  }
};

/**
 * EarningsTab component for the Finance page
 * Displays earnings metrics and recent transaction history
 * Features walletless messaging, real-time updates, and CSV export
 */
export default function EarningsTab() {
  const [data, setData] = useState<EarningsData>({
    todayUSDC: 0,
    pendingUSDC: 0,
    lifetimeUSDC: 0,
    availableUSDC: 0,
    totalReferralUSDC: 0,
    totalTipsUSDC: 0,
    totalSubscriptionUSDC: 0
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load earnings data and transactions
  const loadData = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const [earningsResult, transactionsResult] = await Promise.all([
        fetchEarningsData(),
        fetchTransactions(1, 10) // Load first 10 transactions
      ]);
      
      setData(earningsResult);
      setTransactions(transactionsResult.transactions);
    } catch (err) {
      setError('Failed to load earnings data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch earnings data on component mount
  useEffect(() => {
    loadData();
    
    // Set up periodic refresh every 30 seconds for real-time updates
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle CSV export
  const handleExport = async (period: 'all' | '30d' | '7d') => {
    try {
      setExportLoading(true);
      await exportEarningsCSV(period);
      setShowExportMenu(false);
    } catch (err) {
      setError('Failed to export earnings data');
    } finally {
      setExportLoading(false);
    }
  };
  
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
      {/* Header with Export Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Earnings Overview</h2>
          <p className="text-sm text-slate-400 mt-1">
            Track your revenue from tips, subscriptions, and referrals
            {refreshing && <span className="ml-2 text-emerald-400">● Live</span>}
          </p>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={exportLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <Icon name={exportLoading ? "loader" : "download"} size={16} className={exportLoading ? "animate-spin" : ""} />
            Export CSV
          </button>
          
          {/* Export Menu */}
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10">
              <div className="p-2 space-y-1">
                <button
                  onClick={() => handleExport('all')}
                  className="w-full text-left px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  All time
                </button>
                <button
                  onClick={() => handleExport('30d')}
                  className="w-full text-left px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Last 30 days
                </button>
                <button
                  onClick={() => handleExport('7d')}
                  className="w-full text-left px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Last 7 days
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-900/40 p-4">
          <div className="flex items-center gap-2">
            <Icon name="alert-circle" size={16} className="text-red-400" />
            <h3 className="text-red-300 font-semibold">Error Loading Earnings</h3>
          </div>
          <p className="text-red-400 text-sm mt-1">{error}</p>
          <button
            onClick={() => loadData()}
            className="mt-3 text-sm text-red-300 hover:text-red-200 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Primary Earnings Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric 
          label="Available" 
          value={`$${formatAmount(data.availableUSDC)}`} 
          subtitle="Ready to withdraw"
          icon="dollar-sign"
          color="emerald"
          loading={loading}
        />
        <Metric 
          label="Today" 
          value={`$${formatAmount(data.todayUSDC)}`} 
          subtitle="Earned today"
          icon="trending-up"
          color="blue"
          loading={loading}
        />
        <Metric 
          label="Pending" 
          value={`$${formatAmount(data.pendingUSDC)}`} 
          subtitle="Processing"
          icon="clock"
          color="yellow"
          loading={loading}
        />
        <Metric 
          label="Lifetime" 
          value={`$${formatAmount(data.lifetimeUSDC)}`} 
          subtitle="Total earned"
          icon="award"
          color="violet"
          loading={loading}
        />
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <RevenueCard
          title="Tips"
          amount={data.totalTipsUSDC || 0}
          icon="heart"
          color="red"
          loading={loading}
        />
        <RevenueCard
          title="Subscriptions"
          amount={data.totalSubscriptionUSDC || 0}
          icon="users"
          color="blue"
          loading={loading}
        />
        <RevenueCard
          title="Referrals"
          amount={data.totalReferralUSDC || 0}
          icon="share"
          color="emerald"
          loading={loading}
        />
      </div>
      {/* Recent Transactions */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-100 font-semibold">Recent Transactions</h3>
          <button
            onClick={() => loadData(true)}
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            <Icon name="refresh-cw" size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
        
        {transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
            
            <div className="pt-3 border-t border-slate-800">
              <button className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
                View all transactions →
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center">
              <Icon name="dollar-sign" size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-400 text-sm mb-2">No earnings yet</p>
            <p className="text-slate-500 text-xs">
              Start creating content to begin earning revenue from tips, subscriptions, and referrals.
            </p>
          </div>
        )}
      </div>
      
      {/* Walletless Information Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center flex-shrink-0">
            <Icon name="shield-check" size={20} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-slate-100 font-semibold mb-2">Walletless by Design</h3>
            <p className="text-slate-400 text-sm mb-2">
              We settle USDC to your payout method automatically. All gas fees are covered by the Reelverse Treasury.
            </p>
            <p className="text-slate-500 text-xs">
              Connect a wallet later only if you want on-chain payouts.
            </p>
          </div>
        </div>
      </div>

      {/* Click outside to close export menu */}
      {showExportMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </div>
  );
}

/**
 * Enhanced Metric component for displaying earnings statistics
 */
function Metric({ 
  label, 
  value, 
  subtitle, 
  icon, 
  color = 'slate', 
  loading = false 
}: { 
  label: string; 
  value: string; 
  subtitle?: string;
  icon?: string;
  color?: 'emerald' | 'blue' | 'yellow' | 'violet' | 'red' | 'slate';
  loading?: boolean;
}) {
  const colorClasses = {
    emerald: 'border-emerald-800/30 bg-emerald-900/20 text-emerald-300',
    blue: 'border-blue-800/30 bg-blue-900/20 text-blue-300',
    yellow: 'border-yellow-800/30 bg-yellow-900/20 text-yellow-300',
    violet: 'border-violet-800/30 bg-violet-900/20 text-violet-300',
    red: 'border-red-800/30 bg-red-900/20 text-red-300',
    slate: 'border-slate-800 bg-slate-900/40 text-slate-100'
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 animate-pulse">
        <div className="h-4 bg-slate-800 rounded mb-2"></div>
        <div className="h-6 bg-slate-800 rounded mb-1"></div>
        <div className="h-3 bg-slate-800 rounded w-3/4"></div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{label}</div>
        {icon && <Icon name={icon} size={16} className="opacity-60" />}
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      {subtitle && (
        <div className="text-xs opacity-80">{subtitle}</div>
      )}
    </div>
  );
}

/**
 * Revenue breakdown card component
 */
function RevenueCard({ 
  title, 
  amount, 
  icon, 
  color, 
  loading = false 
}: {
  title: string;
  amount: number;
  icon: string;
  color: 'emerald' | 'blue' | 'red';
  loading?: boolean;
}) {
  const colorClasses = {
    emerald: 'text-emerald-400 bg-emerald-600/20',
    blue: 'text-blue-400 bg-blue-600/20',
    red: 'text-red-400 bg-red-600/20'
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 animate-pulse">
        <div className="h-4 bg-slate-800 rounded mb-3"></div>
        <div className="h-6 bg-slate-800 rounded"></div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClasses[color]}`}>
          <Icon name={icon} size={16} />
        </div>
        <span className="text-slate-300 font-medium">{title}</span>
      </div>
      <div className="text-xl font-bold text-slate-100">${formatAmount(amount)}</div>
    </div>
  );
}

/**
 * Transaction row component
 */
function TransactionRow({ transaction }: { transaction: Transaction }) {
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'tip': return 'heart';
      case 'subscription': return 'users';
      case 'referral': return 'share';
      case 'split_share': return 'users';
      default: return 'dollar-sign';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'tip': return 'text-red-400';
      case 'subscription': return 'text-blue-400';
      case 'referral': return 'text-emerald-400';
      case 'split_share': return 'text-violet-400';
      default: return 'text-slate-400';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-900/60">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center`}>
          <Icon name={getTransactionIcon(transaction.type)} size={14} className={getTransactionColor(transaction.type)} />
        </div>
        <div>
          <div className="text-sm font-medium text-slate-200">
            {transaction.type === 'tip' && 'Tip received'}
            {transaction.type === 'subscription' && 'Subscription payment'}
            {transaction.type === 'referral' && 'Referral bonus'}
            {transaction.type === 'split_share' && 'Revenue share'}
          </div>
          <div className="text-xs text-slate-400">
            {transaction.videoTitle && `${transaction.videoTitle} • `}
            {formatDate(transaction.createdAt)}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium text-slate-100">+${formatAmount(transaction.amount)}</div>
        <div className="text-xs text-slate-400">USDC</div>
      </div>
    </div>
  );
}