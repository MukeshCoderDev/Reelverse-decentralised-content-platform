import React from 'react';
import { Video } from '../types';

interface CardProps {
  video: Video;
}

const Card: React.FC<CardProps> = ({ video }) => {
  return (
    <div className="group flex flex-col space-y-2 cursor-pointer">
      <div className="aspect-video w-full bg-secondary rounded-lg overflow-hidden relative">
        <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      </div>
      <div className="flex items-start space-x-3">
        <img src={video.creatorAvatar} alt={video.creator} className="w-9 h-9 rounded-full bg-secondary" />
        <div className="flex-1">
          <h3 className="font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">{video.title}</h3>
          <p className="text-sm text-muted-foreground">{video.creator}</p>
          <p className="text-sm text-muted-foreground">{video.views} views &middot; {video.uploadedAt}</p>
        </div>
      </div>
    </div>
  );
};

export default Card;