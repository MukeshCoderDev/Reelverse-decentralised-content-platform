import React, { useState } from 'react';

interface Comment {
  id: string;
  author: {
    name: string;
    avatarUrl?: string;
  };
  text: string;
  timestamp: string;
  likes: number;
}

interface CommentsProps {
  videoId: string;
}

/**
 * Comments section component (stub implementation)
 */
export default function Comments({ videoId }: CommentsProps) {
  const [sortBy, setSortBy] = useState('top');
  const [commentText, setCommentText] = useState('');
  
  // Mock comments data
  const comments: Comment[] = [
    {
      id: '1',
      author: {
        name: 'User 1',
        avatarUrl: ''
      },
      text: 'This is a great video! Thanks for sharing.',
      timestamp: '2 days ago',
      likes: 24
    },
    {
      id: '2',
      author: {
        name: 'User 2',
        avatarUrl: ''
      },
      text: 'I learned so much from this. Can you make more videos like this?',
      timestamp: '1 day ago',
      likes: 12
    }
  ];
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      // In a real app, this would submit the comment
      console.log('Submitting comment:', commentText);
      setCommentText('');
    }
  };
  
  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-title font-semibold">Comments</h3>
        <select 
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-surface border border-border rounded-card px-3 py-1 text-[14px]"
        >
          <option value="top">Top</option>
          <option value="newest">Newest</option>
        </select>
      </div>
      
      {/* Comment input */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-surface border border-border flex-shrink-0" />
          <div className="flex-1">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="w-full bg-surface border border-border rounded-card px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setCommentText('')}
                className="px-4 py-2 text-[14px] text-text hover:bg-hover rounded-card"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-brand text-white text-[14px] rounded-card hover:bg-brand/90 disabled:opacity-50"
                disabled={!commentText.trim()}
              >
                Comment
              </button>
            </div>
          </div>
        </div>
      </form>
      
      {/* Comments list */}
      <div className="space-y-4">
        {comments.map(comment => (
          <div key={comment.id} className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-surface border border-border flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[14px]">{comment.author.name}</span>
                <span className="text-[12px] text-text-2">{comment.timestamp}</span>
              </div>
              <p className="text-[14px] mt-1">{comment.text}</p>
              <div className="flex items-center gap-4 mt-2">
                <button className="flex items-center gap-1 text-[13px] text-text-2 hover:text-text">
                  <span>👍</span>
                  <span>{comment.likes}</span>
                </button>
                <button className="text-[13px] text-text-2 hover:text-text">
                  Reply
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}