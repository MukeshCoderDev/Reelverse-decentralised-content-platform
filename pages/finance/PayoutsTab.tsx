import React from 'react';

/**
 * PayoutsTab component for the Finance page
 * Displays payout method configuration and withdrawal options
 * Emphasizes optional wallet integration and upcoming features
 */
export default function PayoutsTab() {
  return (
    <div className="space-y-6">
      {/* Payout Methods Configuration */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h3 className="text-slate-100 font-semibold mb-2">Payout methods</h3>
        
        <ul className="space-y-3">
          {/* USDC Address Option */}
          <li className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div>
              <div className="text-slate-200 font-medium">USDC address (optional)</div>
              <div className="text-slate-400 text-sm">
                Add an address if you want on‑chain payouts later. Not required to earn.
              </div>
            </div>
            <button className="rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950">
              Add address
            </button>
          </li>
          
          {/* Bank Transfer Option (Coming Soon) */}
          <li className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div>
              <div className="text-slate-200 font-medium">Bank transfer</div>
              <div className="text-slate-400 text-sm">
                Cash out via off‑ramp partner (coming soon).
              </div>
            </div>
            <button 
              disabled 
              className="rounded-md bg-slate-800/50 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
            >
              Soon
            </button>
          </li>
        </ul>
      </div>
      
      {/* Payout Information */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h3 className="text-slate-100 font-semibold mb-3">How payouts work</h3>
        <div className="space-y-2 text-slate-400 text-sm">
          <p>• Earnings are settled in USDC automatically</p>
          <p>• Gas fees are covered by the Reelverse Treasury</p>
          <p>• Minimum payout threshold: $10 USDC</p>
          <p>• Processing time: Instant for crypto, 2-3 days for bank transfers</p>
        </div>
      </div>
      
      {/* Treasury Information */}
      <div className="rounded-xl border border-emerald-800/30 bg-emerald-900/20 p-4">
        <h3 className="text-emerald-300 font-semibold mb-2">Treasury-sponsored gas</h3>
        <p className="text-emerald-400 text-sm">
          All transaction fees are covered by the Reelverse Treasury. 
          You keep 100% of your earnings minus the platform fee.
        </p>
      </div>
    </div>
  );
}