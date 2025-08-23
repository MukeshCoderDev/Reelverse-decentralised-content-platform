/**
 * Hook for consistent number and currency formatting across the application
 * Uses Intl.NumberFormat for proper internationalization
 */
export function useNumberFormat() {
  /**
   * Format numbers with compact notation (11.2K, 1.5M, etc.)
   * @param count - The number to format
   * @returns Formatted string with compact notation
   */
  const formatCount = (count?: number): string => {
    return new Intl.NumberFormat('en', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(count ?? 0);
  };

  /**
   * Format currency amounts with USDC label for clarity
   * @param amount - The amount to format in USD
   * @returns Formatted string with USDC label
   */
  const formatCurrency = (amount?: number): string => {
    const formatted = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount ?? 0);
    return `${formatted} USDC`; // Label as USDC to avoid confusion
  };

  /**
   * Format viewer count specifically for live streams
   * @param viewers - Number of viewers
   * @returns Formatted string with "watching" suffix
   */
  const formatViewers = (viewers?: number): string => {
    return `${formatCount(viewers)} watching`;
  };

  /**
   * Format duration in minutes and hours
   * @param minutes - Duration in minutes
   * @returns Formatted duration string
   */
  const formatDuration = (minutes?: number): string => {
    if (!minutes || minutes < 60) {
      return `${minutes || 0}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  return { 
    formatCount, 
    formatCurrency, 
    formatViewers, 
    formatDuration 
  };
}