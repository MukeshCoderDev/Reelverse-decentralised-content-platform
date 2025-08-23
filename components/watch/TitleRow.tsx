import React, { useState } from 'react';

interface TitleRowProps {
  meta: any;
}

/**
 * Title row component showing video title and channel information
 */
export default function TitleRow({ meta }: TitleRowProps) {
  const [subscribed, setSubscribed] = useState(false);
  
  return (
    <div className="mt-3">
      <h1 className="text-[18px] font-semibold text-text">{meta?.title ?? 'Video title'}</h1>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img 
            src={meta?.channel?.avatarUrl} 
            alt="" 
            className="h-10 w-10 rounded-full" 
          />
          <div>
            <div className="text-[14px] font-medium">{meta?.channel?.name ?? 'Channel'}</div>
            <div className="text-[12px] text-text-2">{meta?.channel?.subscribers ?? '—'} subscribers</div>
          </div>
        </div>
        <button 
          onClick={() => setSubscribed(!subscribed)}
          className={`rounded-full px-4 py-2 text-[14px] transition-colors ${
            subscribed 
              ? 'bg-surface border border-border text-text' 
              : 'bg-text text-white hover:bg-text/90'
          }`}
        >
          {subscribed ? 'Subscribed' : 'Subscribe'}
        </button>
      </div>
    </div>
  );
}