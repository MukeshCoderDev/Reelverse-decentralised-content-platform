/**
 * Referral system utilities
 * Handles referral code generation, validation, URL management, and fraud protection
 */

interface ReferralCode {
  id: string;
  code: string;
  userId: string;
  isActive: boolean;
  clickCount: number;
  signupCount: number;
  earningsUSDC: number;
  createdAt: string;
  expiresAt?: string;
}

interface ReferralClaimResult {
  success: boolean;
  message: string;
  code?: string;
  attribution?: {
    referrerId: string;
    referralId: string;
    bonusRate: number;
    expiresAt: string;
  };
}

/**
 * Generate a user-friendly referral code
 * Format: 3 words separated by dashes (e.g., "sunny-wave-42")
 */
export function generateReferralCode(): string {
  const adjectives = [
    'sunny', 'bright', 'cool', 'fast', 'smart', 'happy', 'lucky', 'gold', 'star', 'blue',
    'red', 'green', 'quick', 'swift', 'bold', 'epic', 'wild', 'fire', 'ice', 'wave'
  ];
  
  const nouns = [
    'tiger', 'eagle', 'shark', 'wolf', 'lion', 'bear', 'fox', 'hawk', 'ray', 'wave',
    'storm', 'flame', 'wind', 'rock', 'moon', 'sun', 'star', 'gem', 'coin', 'bolt'
  ];
  
  const numbers = Array.from({ length: 100 }, (_, i) => i);
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = numbers[Math.floor(Math.random() * numbers.length)];
  
  return `${adj}-${noun}-${num}`;
}

/**
 * Validate referral code format
 */
export function isValidReferralCode(code: string): boolean {
  // Check format: word-word-number
  const pattern = /^[a-z]+-[a-z]+-\d+$/;
  return pattern.test(code.toLowerCase());
}

/**
 * Extract referral code from URL
 */
export function extractReferralFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const refParam = urlObj.searchParams.get('ref');
    
    if (refParam && isValidReferralCode(refParam)) {
      return refParam.toLowerCase();
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Add referral code to URL
 */
export function addReferralToUrl(baseUrl: string, referralCode: string): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('ref', referralCode.toLowerCase());
    return url.toString();
  } catch {
    return baseUrl;
  }
}

/**
 * Get current referral code from browser URL
 */
export function getCurrentReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  
  return extractReferralFromUrl(window.location.href);
}

/**
 * Store referral attribution in localStorage for later claim
 */
export function storeReferralAttribution(code: string): void {
  if (typeof window === 'undefined') return;
  
  const attribution = {
    code: code.toLowerCase(),
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    // Store for 6 months (referral attribution window)
    expiresAt: Date.now() + (6 * 30 * 24 * 60 * 60 * 1000)
  };
  
  try {
    localStorage.setItem('referral_attribution', JSON.stringify(attribution));
  } catch (error) {
    console.warn('Failed to store referral attribution:', error);
  }
}

/**
 * Get stored referral attribution
 */
export function getStoredReferralAttribution(): { code: string; timestamp: number; expiresAt: number } | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem('referral_attribution');
    if (!stored) return null;
    
    const attribution = JSON.parse(stored);
    
    // Check if attribution has expired
    if (Date.now() > attribution.expiresAt) {
      localStorage.removeItem('referral_attribution');
      return null;
    }
    
    return attribution;
  } catch {
    return null;
  }
}

/**
 * Clear stored referral attribution
 */
export function clearReferralAttribution(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem('referral_attribution');
  } catch (error) {
    console.warn('Failed to clear referral attribution:', error);
  }
}

/**
 * Claim referral code (process attribution on signup/first purchase)
 */
export async function claimReferralCode(code?: string): Promise<ReferralClaimResult> {
  // Use provided code or get from storage
  const referralCode = code || getStoredReferralAttribution()?.code;
  
  if (!referralCode) {
    return {
      success: false,
      message: 'No referral code to claim'
    };
  }
  
  try {
    const response = await fetch('/api/referrals/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        referralCode: referralCode.toLowerCase(),
        // Include fraud protection data
        metadata: {
          userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
          timestamp: Date.now(),
          url: typeof window !== 'undefined' ? window.location.href : undefined
        }
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      // Clear stored attribution after successful claim
      clearReferralAttribution();
      
      return {
        success: true,
        message: `Welcome! You've been referred by ${result.referrerName || 'a friend'}.`,
        code: referralCode,
        attribution: result.attribution
      };
    } else {
      return {
        success: false,
        message: result.error || 'Failed to claim referral code'
      };
    }
  } catch (error) {
    console.error('Failed to claim referral:', error);
    return {
      success: false,
      message: 'Network error. Please try again.'
    };
  }
}

/**
 * Get user's referral codes
 */
export async function getUserReferralCodes(): Promise<ReferralCode[]> {
  try {
    const response = await fetch('/api/referrals/codes', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch referral codes');
    }
    
    const data = await response.json();
    return data.codes || [];
  } catch (error) {
    console.error('Failed to fetch referral codes:', error);
    return [];
  }
}

/**
 * Create a new referral code
 */
export async function createReferralCode(): Promise<ReferralCode | null> {
  try {
    const response = await fetch('/api/referrals/codes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        code: generateReferralCode()
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create referral code');
    }
    
    const data = await response.json();
    return data.code;
  } catch (error) {
    console.error('Failed to create referral code:', error);
    return null;
  }
}

/**
 * Generate shareable URL with referral code
 */
export function generateShareUrl(baseUrl: string, referralCode: string): string {
  return addReferralToUrl(baseUrl, referralCode);
}

/**
 * Initialize referral tracking on page load
 * Call this in your app initialization
 */
export function initializeReferralTracking(): void {
  if (typeof window === 'undefined') return;
  
  // Check for referral code in current URL
  const referralCode = getCurrentReferralCode();
  
  if (referralCode) {
    // Store attribution for later claiming
    storeReferralAttribution(referralCode);
    
    // Clean URL by removing ref parameter (optional)
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('ref');
    
    // Update browser history without the ref parameter
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, cleanUrl.toString());
    }
  }
}

/**
 * Format referral earnings for display
 */
export function formatReferralEarnings(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Calculate referral bonus percentage
 */
export function getReferralBonusRate(): number {
  return 0.10; // 10% referral bonus
}

/**
 * Get referral attribution window in days
 */
export function getReferralAttributionWindow(): number {
  return 180; // 6 months
}