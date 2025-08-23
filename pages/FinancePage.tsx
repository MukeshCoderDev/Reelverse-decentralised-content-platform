import React, { useState } from 'react';
import { useAuth } from '../src/auth/AuthProvider';
import EarningsTab from './finance/EarningsTab';
import PayoutsTab from './finance/PayoutsTab';

/**
 * FinancePage - Unified hub for all monetary operations
 * Replaces separate wallet and buy crypto interfaces
 * Features walletless authentication and USDC-only transactions
 */
export default function FinancePage() {
  const [tab, setTab] = useState<'earnings' | 'payouts'>('earnings');
  const { user, openSignInModal } = useAuth();
  
  // Show sign-in prompt for non-authenticated users
  if (!user) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 md:px-6 py-10 text-center">
        <h1 className="text-2xl font-bold text-slate-100 mb-3">Earnings & Payouts</h1>
        <p className="text-slate-400 mb-6">Sign in to view your earnings. No wallet required.</p>
        <button 
          onClick={() => openSignInModal()}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          Sign in to Reelverse
        </button>
      </div>
    );
  }
  
  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-6">
      <h1 className="text-2xl font-bold text-slate-100 mb-4">Earnings & Payouts</h1>
      
      {/* Tab Navigation */}
      <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/60 p-1 mb-6">
        <button 
          onClick={() => setTab('earnings')} 
          className={`px-4 py-2 rounded-md text-sm transition-colors ${
            tab === 'earnings' 
              ? 'bg-slate-800 text-white' 
              : 'text-slate-300 hover:text-white'
          }`}
        >
          Earnings
        </button>
        <button 
          onClick={() => setTab('payouts')} 
          className={`px-4 py-2 rounded-md text-sm transition-colors ${
            tab === 'payouts' 
              ? 'bg-slate-800 text-white' 
              : 'text-slate-300 hover:text-white'
          }`}
        >
          Payouts
        </button>
      </div>
      
      {/* Tab Content */}
      {tab === 'earnings' ? <EarningsTab /> : <PayoutsTab />}
    </div>
  );
}