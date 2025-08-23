import React from 'react';

interface BalancePillProps {
  amount?: number;
  currency?: string;
  className?: string;
}

/**
 * BalancePill component for displaying user's earnings balance in the header
 * Features emerald theme colors and hover states
 * Shows currency balance with $ prefix
 */
export function BalancePill({ 
  amount = 128.59, 
  currency = 'USDC',
  className = ''
}: BalancePillProps) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full bg-emerald-800/30 text-emerald-300 border border-emerald-700 px-3 py-1 text-sm hover:bg-emerald-800/40 transition-colors cursor-pointer ${className}`}>
      <span className="text-emerald-400">$</span>
      <span className="font-medium">{amount.toFixed(2)}</span>
      <span className="text-emerald-400 text-xs">{currency}</span>
    </span>
  );
}