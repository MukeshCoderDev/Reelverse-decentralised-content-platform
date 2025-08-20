import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { YouTubeStyleVideoPlayer } from '../components/content/YouTubeStyleVideoPlayer';
import { useReturnTo } from '../src/hooks/useReturnTo';
import Icon from '../components/Icon';

const WatchPage: React.FC = () => {
  const { contentId } = useParams<{ contentId: string }>();
  const { goBack } = useReturnTo();
  const [videoData, setVideoData] = useState<any>(null); // Replace 'any' with actual Content type

  useEffect(() => {
    // In a real application, you would fetch video data based on contentId
    // For now, we'll use a mock data structure
    const mockVideoData = {
      id: contentId,
      title: `Video Title for ${contentId}`,
      creator: 'Mock Creator',
      creatorAvatar: '/placeholder.svg',
      subscribers: 123456,
      views: 7890123,
      likes: 45678,
      dislikes: 123,
      uploadDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      description: `This is a mock description for the video with ID: ${contentId}. It's a great video!`,
      tags: ['mock', 'video', 'test'],
      isSubscribed: false,
      isLiked: false,
      isDisliked: false,
      isSaved: false,
    };
    setVideoData(mockVideoData);
  }, [contentId]);

  if (!videoData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Icon name="loader" size={48} className="animate-spin mx-auto mb-4" />
          <p>Loading video...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <YouTubeStyleVideoPlayer
        videoSrc="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" // Use a generic sample video for now
        videoData={videoData}
        onClose={() => goBack('/')} // Use goBack for closing/back navigation
        contentId={contentId || ''}
        isAdultContent={false} // Adjust based on actual content data
        requiresEntitlement={false} // Adjust based on actual content data
      />
    </div>
  );
};

export default WatchPage;