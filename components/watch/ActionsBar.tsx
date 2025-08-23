import React, { useState } from 'react';
import { copyToClipboard, shareUrlAtCurrentTime } from '../../utils/share';
import { formatViews } from '../../utils/time';

interface ActionsBarProps {
  videoId: string;
  meta: any;
}

/**
 * Actions bar component with Like/Dislike/Share/Save/Tip actions
 */
export default function ActionsBar({ videoId, meta }: ActionsBarProps) {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const Action = ({ 
    icon, 
    label, 
    active = false,
    onClick
  }: {
    icon: string;
    label: string;
    active?: boolean;
    onClick?: () => void;
  }) => (
    <button 
      onClick={onClick}
      className={`rounded-full bg-chip border border-border px-3 py-1.5 text-[14px] text-text hover:bg-hover flex items-center gap-2 ${
        active ? 'text-brand border-brand' : ''
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
  
  const handleShare = async (withTime = false) => {
    const video = document.querySelector('video') as HTMLVideoElement | null;
    const currentTime = video?.currentTime ?? 0;
    
    const link = withTime 
      ? shareUrlAtCurrentTime(videoId, currentTime)
      : `${window.location.origin}/watch/${videoId}`;
    
    await copyToClipboard(link);
    // In a real app, you would show a toast notification here
    console.log(withTime ? 'Link with time copied!' : 'Link copied!');
  };
  
  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <Action 
        icon={liked ? "👍" : "👍"} 
        label={meta?.counts?.likes ? formatViews(meta.counts.likes + (liked ? 1 : 0) - (disliked ? 1 : 0)) : "Like"} 
        active={liked}
        onClick={() => {
          if (disliked) setDisliked(false);
          setLiked(!liked);
        }}
      />
      <Action 
        icon={disliked ? "👎" : "👎"} 
        label="Dislike" 
        active={disliked}
        onClick={() => {
          if (liked) setLiked(false);
          setDisliked(!disliked);
        }}
      />
      
      <div className="relative group">
        <Action icon="📤" label="Share" onClick={() => handleShare()} />
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-surface border border-border rounded-card shadow-lg w-48 z-10">
          <button 
            onClick={() => handleShare()}
            className="w-full text-left px-4 py-2 text-[14px] text-text hover:bg-hover"
          >
            Copy link
          </button>
          <button 
            onClick={() => handleShare(true)}
            className="w-full text-left px-4 py-2 text-[14px] text-text hover:bg-hover"
          >
            Copy link with time
          </button>
        </div>
      </div>
      
      <Action 
        icon={saved ? "✅" : "📥"} 
        label="Save" 
        active={saved}
        onClick={() => setSaved(!saved)}
      />
      <Action icon="💰" label="Tip" onClick={() => {
        // In a real app, this would open a tip modal
        console.log('Open tip modal');
      }} />
    </div>
  );
}