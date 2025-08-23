import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import Button from '../components/Button';
import { ReelsFeed } from '../components/feed/ReelsFeed';

/**
 * Mock shorts data - vertical short-form content
 */
const SHORTS = Array.from({ length: 12 }).map((_, i) => ({
  id: `short_${i + 1}`,
  title: `Pro tip #${i + 1}`,
  hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', // Test HLS for all
  posterUrl: `https://picsum.photos/seed/short${i}/600/1067`, // 9:16 aspect ratio
  durationSec: 25 + (i % 30),
  author: {
    id: `u_${i}`,
    name: ['TechGuru', 'PixelPlays', 'LensExplorer'][i % 3],
    avatarUrl: `https://i.pravatar.cc/64?img=${i + 30}`,
    isFollowed: i % 2 === 0,
    isVerified: i % 5 === 0
  },
  counts: {
    likes: 3000 + i * 5,
    comments: 100 + i,
    shares: 40 + i,
    saves: 15 + i,
    views: 20000 + i * 30
  },
  tags: ['#shorts', '#tips'],
}));

/**
 * ShortsFeedPage - Vertical scroll-snap video feed
 * Full-screen experience with playable short-form content
 * Only one video plays at a time based on viewport visibility
 */
export default function ShortsFeedPage() {
  return (
    <div className="h-[calc(100vh-64px)]">
      <ReelsFeed videos={SHORTS} />
    </div>
  );
}

/**
 * Individual Shorts Card Component
 */
interface ShortsCardProps {
  short: typeof SHORTS[0];
  index: number;
  isActive: boolean;
  onInView: () => void;
}

function ShortsCard({ short, index, isActive, onInView }: ShortsCardProps) {
  const [isLiked, setIsLiked] = useState(short.isLiked);
  const [isSaved, setIsSaved] = useState(short.isSaved);
  const [isFollowed, setIsFollowed] = useState(short.author.isFollowed);
  const [likes, setLikes] = useState(short.counts.likes);

  // Intersection observer to detect when card is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onInView();
        }
      },
      { threshold: 0.5 }
    );

    const element = document.getElementById(`short-${index}`);
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [index, onInView]);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikes(likes + (isLiked ? -1 : 1));
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
  };

  const handleFollow = () => {
    setIsFollowed(!isFollowed);
  };

  const formatCount = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${Math.floor(count / 100) / 10}K`;
    return `${Math.floor(count / 100000) / 10}M`;
  };

  return (
    <div
      id={`short-${index}`}
      className="h-screen w-full snap-start relative flex items-center justify-center bg-black overflow-hidden"
    >
      {/* Background Video/Image */}
      <div className="absolute inset-0">
        <img
          src={short.posterUrl}
          alt={short.title}
          className="w-full h-full object-cover"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full h-full flex">
        {/* Left side - tap to navigate */}
        <div className="flex-1" onClick={() => setCurrentIndex(Math.max(0, index - 1))} />
        
        {/* Right side - tap to navigate */}
        <div className="flex-1" onClick={() => setCurrentIndex(Math.min(MOCK_SHORTS.length - 1, index + 1))} />
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 z-20 flex">
        {/* Left spacer */}
        <div className="flex-1" />
        
        {/* Right side actions */}
        <div className="w-20 flex flex-col justify-end items-center pb-32 space-y-6">
          {/* Author Avatar */}
          <div className="relative">
            <Link to={`/u/${short.author.id}`} className="block">
              <img
                src={short.author.avatarUrl}
                alt={short.author.name}
                className="w-12 h-12 rounded-full border-2 border-white"
              />
              {short.author.isVerified && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <Icon name="check" size={12} className="text-white" />
                </div>
              )}
            </Link>
            {!isFollowed && (
              <button
                onClick={handleFollow}
                className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white"
                aria-label="Follow user"
              >
                <Icon name="plus" size={12} />
              </button>
            )}
          </div>

          {/* Like Button */}
          <button
            onClick={handleLike}
            className={`p-3 rounded-full transition-colors ${
              isLiked ? 'text-red-500' : 'text-white'
            }`}
            aria-label={`${isLiked ? 'Unlike' : 'Like'} video`}
          >
            <Icon name={isLiked ? 'heart' : 'heart'} size={24} fill={isLiked} />
            <span className="block text-xs mt-1">{formatCount(likes)}</span>
          </button>

          {/* Comment Button */}
          <button
            className="p-3 text-white transition-colors hover:text-blue-400"
            aria-label="View comments"
          >
            <Icon name="message-circle" size={24} />
            <span className="block text-xs mt-1">{formatCount(short.counts.comments)}</span>
          </button>

          {/* Share Button */}
          <button
            className="p-3 text-white transition-colors hover:text-green-400"
            aria-label="Share video"
          >
            <Icon name="share" size={24} />
            <span className="block text-xs mt-1">{formatCount(short.counts.shares)}</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className={`p-3 transition-colors ${
              isSaved ? 'text-yellow-500' : 'text-white'
            }`}
            aria-label={`${isSaved ? 'Unsave' : 'Save'} video`}
          >
            <Icon name={isSaved ? 'bookmark' : 'bookmark'} size={24} fill={isSaved} />
          </button>

          {/* More Options */}
          <button
            className="p-3 text-white transition-colors hover:text-gray-300"
            aria-label="More options"
          >
            <Icon name="more-horizontal" size={24} />
          </button>
        </div>
      </div>

      {/* Bottom Content */}
      <div className="absolute bottom-0 left-0 right-20 p-6 z-20">
        {/* Author Info */}
        <div className="mb-4">
          <Link
            to={`/u/${short.author.id}`}
            className="flex items-center space-x-3 text-white group"
          >
            <span className="font-semibold group-hover:underline">
              @{short.author.name}
            </span>
            {!isFollowed && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  handleFollow();
                }}
                className="text-xs px-3 py-1 border-white text-white hover:bg-white hover:text-black"
              >
                Follow
              </Button>
            )}
          </Link>
        </div>

        {/* Video Title */}
        <div className="mb-3">
          <p className="text-white text-sm leading-relaxed">
            {short.title}
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {short.tags.map((tag, i) => (
            <Link
              key={i}
              to={`/explore?tag=${tag.slice(1)}`}
              className="text-blue-400 text-sm hover:underline"
            >
              {tag}
            </Link>
          ))}
        </div>

        {/* View Count */}
        <div className="text-slate-300 text-xs">
          {formatCount(short.counts.views)} views
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="absolute top-4 left-4 right-4 z-20">
        <div className="flex space-x-1">
          {MOCK_SHORTS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded ${
                i === index ? 'bg-white' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}