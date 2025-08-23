import React, { useEffect, useRef, useState } from 'react';
import Icon from '../Icon';

/**
 * Video data interface for ReelsFeed
 */
interface ReelVideo {
  id: string;
  title: string;
  hlsUrl: string;
  posterUrl: string;
  durationSec: number;
  author: {
    id: string;
    name: string;
    avatarUrl: string;
    isFollowed: boolean;
    isVerified: boolean;
  };
  counts: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    views: number;
  };
  tags: string[];
}

interface ReelsFeedProps {
  videos: ReelVideo[];
}

/**
 * Individual video card component
 */
interface VideoCardProps {
  video: ReelVideo;
  isActive: boolean;
  onPlay: () => void;
  onPause: () => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, isActive, onPlay, onPause }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Handle video play/pause based on visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.play().then(() => {
        setIsPlaying(true);
        onPlay();
      }).catch(console.error);
    } else {
      video.pause();
      setIsPlaying(false);
      onPause();
    }
  }, [isActive, onPlay, onPause]);

  // Update time progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    video.addEventListener('timeupdate', updateTime);
    return () => video.removeEventListener('timeupdate', updateTime);
  }, []);

  // Cleanup video resources when component unmounts
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.src = '';
        video.load();
      }
    };
  }, []);

  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play();
      setIsPlaying(true);
    }
  };

  const formatCount = (count: number): string => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${Math.floor(count / 100) / 10}K`;
    return `${Math.floor(count / 100000) / 10}M`;
  };

  return (
    <div className="h-full snap-start relative bg-black">
      {/* Video element */}
      <video
        ref={videoRef}
        src={video.hlsUrl}
        poster={video.posterUrl}
        className="w-full h-full object-cover"
        onClick={handleVideoClick}
        loop
        muted
        playsInline
        preload="metadata"
      />

      {/* Overlay content */}
      <div className="absolute inset-0 flex">
        {/* Main content area (clickable for play/pause) */}
        <div 
          className="flex-1 relative cursor-pointer"
          onClick={handleVideoClick}
        >
          {/* Play/pause indicator */}
          {!isPlaying && isActive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
                <Icon name="play" size={32} className="text-white ml-1" />
              </div>
            </div>
          )}

          {/* Video info overlay */}
          <div className="absolute bottom-0 left-0 right-20 p-4 bg-gradient-to-t from-black/80 to-transparent">
            {/* Author info */}
            <div className="flex items-center gap-3 mb-2">
              <img 
                src={video.author.avatarUrl} 
                alt={video.author.name}
                className="w-8 h-8 rounded-full border-2 border-white"
              />
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm">
                  {video.author.name}
                </span>
                {video.author.isVerified && (
                  <Icon name="check-circle" size={14} className="text-blue-400" />
                )}
                <button 
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    video.author.isFollowed 
                      ? 'bg-gray-600 text-gray-300' 
                      : 'bg-white text-black'
                  }`}
                >
                  {video.author.isFollowed ? 'Following' : 'Follow'}
                </button>
              </div>
            </div>

            {/* Video title */}
            <p className="text-white text-sm mb-2 line-clamp-2">
              {video.title}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              {video.tags.map((tag, index) => (
                <span key={index} className="text-white text-xs opacity-80">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-20 h-1 bg-white/20">
            <div 
              className="h-full bg-white transition-all duration-100"
              style={{ 
                width: `${(currentTime / video.durationSec) * 100}%` 
              }}
            />
          </div>
        </div>

        {/* Right sidebar actions */}
        <div className="w-16 flex flex-col items-center justify-end pb-4 space-y-4">
          {/* Like */}
          <button 
            className="flex flex-col items-center gap-1"
            onClick={() => setIsLiked(!isLiked)}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isLiked ? 'bg-red-600' : 'bg-black/30'
            }`}>
              <Icon 
                name="heart" 
                size={24} 
                className={isLiked ? 'text-white' : 'text-white'} 
              />
            </div>
            <span className="text-white text-xs font-semibold">
              {formatCount(video.counts.likes + (isLiked ? 1 : 0))}
            </span>
          </button>

          {/* Comment */}
          <button className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center">
              <Icon name="message-circle" size={24} className="text-white" />
            </div>
            <span className="text-white text-xs font-semibold">
              {formatCount(video.counts.comments)}
            </span>
          </button>

          {/* Share */}
          <button className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center">
              <Icon name="share" size={24} className="text-white" />
            </div>
            <span className="text-white text-xs font-semibold">
              {formatCount(video.counts.shares)}
            </span>
          </button>

          {/* Save */}
          <button 
            className="flex flex-col items-center gap-1"
            onClick={() => setIsSaved(!isSaved)}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isSaved ? 'bg-yellow-600' : 'bg-black/30'
            }`}>
              <Icon name="star" size={24} className="text-white" />
            </div>
            <span className="text-white text-xs font-semibold">
              {formatCount(video.counts.saves + (isSaved ? 1 : 0))}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * ReelsFeed component with vertical scroll-snap and single video autoplay
 */
export const ReelsFeed: React.FC<ReelsFeedProps> = ({ videos }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [playingVideos, setPlayingVideos] = useState<Set<string>>(new Set());

  // Intersection Observer for detecting active video
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.8) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            setActiveVideoIndex(index);
          }
        });
      },
      { 
        threshold: 0.8,
        root: container
      }
    );

    const videoCards = container.querySelectorAll('[data-index]');
    videoCards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, [videos]);

  // Handle video play/pause
  const handleVideoPlay = (videoId: string) => {
    setPlayingVideos(prev => new Set([videoId])); // Only one video plays at a time
  };

  const handleVideoPause = (videoId: string) => {
    setPlayingVideos(prev => {
      const next = new Set(prev);
      next.delete(videoId);
      return next;
    });
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;

      if (e.key === 'ArrowUp' && activeVideoIndex > 0) {
        e.preventDefault();
        const prevCard = container.children[activeVideoIndex - 1] as HTMLElement;
        prevCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (e.key === 'ArrowDown' && activeVideoIndex < videos.length - 1) {
        e.preventDefault();
        const nextCard = container.children[activeVideoIndex + 1] as HTMLElement;
        nextCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeVideoIndex, videos.length]);

  return (
    <div 
      ref={containerRef}
      className="h-full overflow-y-scroll snap-y snap-mandatory overscroll-contain scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {videos.map((video, index) => (
        <div
          key={video.id}
          data-index={index}
          className="h-full snap-start"
        >
          <VideoCard
            video={video}
            isActive={index === activeVideoIndex}
            onPlay={() => handleVideoPlay(video.id)}
            onPause={() => handleVideoPause(video.id)}
          />
        </div>
      ))}
    </div>
  );
};