import React, { useState, useEffect } from 'react';
import TipButton from '../payment/TipButton';
import SubscribeButton from '../payment/SubscribeButton';
import ShareMenu from '../share/ShareMenu';
import Icon from '../Icon';
import { useAuth } from '../../src/auth/AuthProvider';

interface ActionRailProps {
  videoId: string;
  creatorId: string;
  creatorName?: string;
  videoTitle?: string;
  className?: string;
  onTipSuccess?: (amount: number) => void;
  onSubscriptionChange?: (subscribed: boolean) => void;
}

/**
 * ActionRail Component
 * 
 * Provides monetization and engagement actions for videos:
 * - TipButton for USDC tipping with splits
 * - SubscribeButton for walletless subscriptions
 * - Enhanced share functionality with referral codes
 * - Like/unlike actions
 * - Responsive layout for mobile and desktop
 */
export default function ActionRail({
  videoId,
  creatorId,
  creatorName,
  videoTitle,
  className = '',
  onTipSuccess,
  onSubscriptionChange
}: ActionRailProps) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);

  // Handle like/unlike
  const handleLikeClick = async () => {
    try {
      const response = await fetch(`/api/videos/${videoId}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        setIsLiked(!isLiked);
        setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  // Handle share click
  const handleShareClick = () => {
    setIsShareMenuOpen(true);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Primary Actions Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Tip Button */}
        <TipButton
          videoId={videoId}
          creatorId={creatorId}
          creatorName={creatorName}
          onTipSuccess={onTipSuccess}
          className="flex-shrink-0"
        />

        {/* Subscribe Button */}
        <SubscribeButton
          creatorId={creatorId}
          creatorName={creatorName}
          onSubscriptionChange={onSubscriptionChange}
          className="flex-shrink-0"
        />

        {/* Like Button */}
        <button
          onClick={handleLikeClick}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isLiked
              ? 'bg-red-600/20 text-red-400 border border-red-600/30'
              : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
          }`}
        >
          <Icon 
            name={isLiked ? 'heart' : 'heart'} 
            size={16} 
            className={isLiked ? 'fill-current' : ''} 
          />
          <span className="hidden sm:inline">
            {isLiked ? 'Liked' : 'Like'}
          </span>
          {likeCount > 0 && (
            <span className="text-xs text-slate-400">
              {likeCount}
            </span>
          )}
        </button>

        {/* Share Button */}
        <button
          onClick={handleShareClick}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors"
        >
          <Icon name="share" size={16} />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>

      {/* Secondary Actions Row (Mobile) */}
      <div className="flex sm:hidden items-center gap-2 text-xs text-slate-400">
        <span>Support {creatorName || 'this creator'} with tips and subscriptions</span>
      </div>

      {/* Enhanced Share Menu */}
      <ShareMenu
        videoId={videoId}
        creatorId={creatorId}
        videoTitle={videoTitle}
        creatorName={creatorName}
        isOpen={isShareMenuOpen}
        onClose={() => setIsShareMenuOpen(false)}
      />
    </div>
  );
}