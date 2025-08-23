import React, { useState, useEffect } from 'react';
import Icon from '../Icon';
import { useAuth } from '../../src/auth/AuthProvider';
import { 
  getUserReferralCodes, 
  createReferralCode, 
  generateShareUrl,
  getReferralBonusRate 
} from '../../utils/ref';

interface ReferralCode {
  id: string;
  code: string;
  userId: string;
  isActive: boolean;
  clickCount: number;
  signupCount: number;
  earningsUSDC: number;
}

interface ShareMenuProps {
  videoId: string;
  creatorId: string;
  videoTitle?: string;
  creatorName?: string;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

/**
 * ShareMenu Component
 * 
 * Comprehensive sharing interface with:
 * - Referral code generation and management
 * - Multiple sharing platforms
 * - Copy link functionality
 * - Referral earnings tracking
 * - Social media integration
 */
export default function ShareMenu({
  videoId,
  creatorId,
  videoTitle = 'this video',
  creatorName,
  isOpen,
  onClose,
  className = ''
}: ShareMenuProps) {
  const { user, openSignInModal } = useAuth();
  const [referralCodes, setReferralCodes] = useState<ReferralCode[]>([]);
  const [selectedCode, setSelectedCode] = useState<ReferralCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Load referral codes when menu opens
  useEffect(() => {
    if (isOpen && user) {
      loadReferralCodes();
    }
  }, [isOpen, user]);

  const loadReferralCodes = async () => {
    if (!user || loading) return;
    
    try {
      setLoading(true);
      const codes = await getUserReferralCodes();
      setReferralCodes(codes);
      
      // Select first active code or first code
      const defaultCode = codes.find(c => c.isActive) || codes[0];
      setSelectedCode(defaultCode || null);
    } catch (error) {
      console.error('Failed to load referral codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCode = async () => {
    if (!user || creating) return;
    
    try {
      setCreating(true);
      const newCode = await createReferralCode();
      
      if (newCode) {
        setReferralCodes(prev => [...prev, newCode]);
        setSelectedCode(newCode);
      }
    } catch (error) {
      console.error('Failed to create referral code:', error);
    } finally {
      setCreating(false);
    }
  };

  const getShareUrl = (includeReferral = false) => {
    const baseUrl = `${window.location.origin}/watch/${videoId}`;
    
    if (includeReferral && selectedCode) {
      return generateShareUrl(baseUrl, selectedCode.code);
    }
    
    return baseUrl;
  };

  const handleCopyLink = async (includeReferral = false) => {
    const url = getShareUrl(includeReferral);
    
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(includeReferral ? 'Referral link copied!' : 'Link copied!');
      
      // Track copy event
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', includeReferral ? 'referral_link_copy' : 'link_copy', {
          video_id: videoId,
          creator_id: creatorId,
          referral_code: includeReferral ? selectedCode?.code : undefined
        });
      }
      
      // Clear success message after 2 seconds
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleSocialShare = (platform: 'twitter' | 'facebook' | 'linkedin', includeReferral = false) => {
    const url = getShareUrl(includeReferral);
    const text = `Check out "${videoTitle}"${creatorName ? ` by ${creatorName}` : ''} on Reelverse!`;
    
    let shareUrl = '';
    
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
      
      // Track social share
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'social_share', {
          platform,
          video_id: videoId,
          creator_id: creatorId,
          with_referral: includeReferral,
          referral_code: includeReferral ? selectedCode?.code : undefined
        });
      }
    }
  };

  const bonusRate = getReferralBonusRate();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Menu */}
      <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 p-6 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-100">Share Video</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300 transition-colors"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Success Message */}
        {copySuccess && (
          <div className="mb-4 p-3 bg-emerald-600/20 border border-emerald-600/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Icon name="check" size={16} className="text-emerald-400" />
              <span className="text-emerald-300 text-sm">{copySuccess}</span>
            </div>
          </div>
        )}

        {/* Basic Share Options */}
        <div className="space-y-3 mb-6">
          <h4 className="text-sm font-medium text-slate-300">Quick Share</h4>
          
          <button
            onClick={() => handleCopyLink(false)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
          >
            <Icon name="link" size={16} className="text-slate-400" />
            <div>
              <div className="text-slate-200 font-medium">Copy Link</div>
              <div className="text-slate-400 text-sm">Share this video directly</div>
            </div>
          </button>
          
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleSocialShare('twitter', false)}
              className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
              <Icon name="twitter" size={20} className="text-blue-400" />
              <span className="text-xs text-slate-300">Twitter</span>
            </button>
            
            <button
              onClick={() => handleSocialShare('facebook', false)}
              className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
              <Icon name="facebook" size={20} className="text-blue-500" />
              <span className="text-xs text-slate-300">Facebook</span>
            </button>
            
            <button
              onClick={() => handleSocialShare('linkedin', false)}
              className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
              <Icon name="linkedin" size={20} className="text-blue-600" />
              <span className="text-xs text-slate-300">LinkedIn</span>
            </button>
          </div>
        </div>

        {/* Referral Share Section */}
        <div className="border-t border-slate-700 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-sm font-medium text-slate-300">Earn Referral Rewards</h4>
            <div className="px-2 py-1 bg-emerald-600/20 text-emerald-400 text-xs rounded">
              +{Math.round(bonusRate * 100)}%
            </div>
          </div>
          
          {!user ? (
            <div className="text-center py-4">
              <p className="text-slate-400 text-sm mb-3">
                Sign in to earn {Math.round(bonusRate * 100)}% on referrals
              </p>
              <button
                onClick={() => {
                  onClose();
                  openSignInModal();
                }}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm"
              >
                Sign In
              </button>
            </div>
          ) : loading ? (
            <div className="text-center py-4">
              <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Loading referral codes...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Referral Code Selection */}
              {referralCodes.length > 0 && (
                <div>
                  <label className="block text-xs text-slate-400 mb-2">Your Referral Code</label>
                  <select
                    value={selectedCode?.id || ''}
                    onChange={(e) => {
                      const code = referralCodes.find(c => c.id === e.target.value);
                      setSelectedCode(code || null);
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-violet-500 focus:outline-none"
                  >
                    {referralCodes.map((code) => (
                      <option key={code.id} value={code.id}>
                        {code.code} ({code.clickCount} clicks, ${code.earningsUSDC.toFixed(2)} earned)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Create New Code */}
              {referralCodes.length === 0 && (
                <div className="text-center py-2">
                  <p className="text-slate-400 text-sm mb-3">
                    Create your first referral code to start earning
                  </p>
                  <button
                    onClick={handleCreateCode}
                    disabled={creating}
                    className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors text-sm"
                  >
                    {creating ? 'Creating...' : 'Create Referral Code'}
                  </button>
                </div>
              )}
              
              {/* Referral Share Options */}
              {selectedCode && (
                <>
                  <button
                    onClick={() => handleCopyLink(true)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-emerald-700 bg-emerald-900/20 hover:bg-emerald-900/30 transition-colors text-left"
                  >
                    <Icon name="users" size={16} className="text-emerald-400" />
                    <div>
                      <div className="text-emerald-300 font-medium">Copy Referral Link</div>
                      <div className="text-emerald-400 text-sm">
                        Earn {Math.round(bonusRate * 100)}% when people sign up
                      </div>
                    </div>
                  </button>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleSocialShare('twitter', true)}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-emerald-700 bg-emerald-900/20 hover:bg-emerald-900/30 transition-colors"
                    >
                      <Icon name="twitter" size={16} className="text-emerald-400" />
                      <span className="text-xs text-emerald-300">Twitter</span>
                    </button>
                    
                    <button
                      onClick={() => handleSocialShare('facebook', true)}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-emerald-700 bg-emerald-900/20 hover:bg-emerald-900/30 transition-colors"
                    >
                      <Icon name="facebook" size={16} className="text-emerald-400" />
                      <span className="text-xs text-emerald-300">Facebook</span>
                    </button>
                    
                    <button
                      onClick={() => handleSocialShare('linkedin', true)}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-emerald-700 bg-emerald-900/20 hover:bg-emerald-900/30 transition-colors"
                    >
                      <Icon name="linkedin" size={16} className="text-emerald-400" />
                      <span className="text-xs text-emerald-300">LinkedIn</span>
                    </button>
                  </div>
                </>
              )}
              
              {/* Add More Codes */}
              {referralCodes.length > 0 && referralCodes.length < 5 && (
                <button
                  onClick={handleCreateCode}
                  disabled={creating}
                  className="w-full py-2 text-sm text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : '+ Create Another Code'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}