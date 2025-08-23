import React, { useState } from 'react';

interface DescriptionBoxProps {
  meta: any;
}

/**
 * Description box component with collapsible text
 */
export default function DescriptionBox({ meta }: DescriptionBoxProps) {
  const [open, setOpen] = useState(false);
  const text = meta?.description ?? '';
  
  // Show expand button only if description is long enough
  const shouldShowToggle = text.length > 150;
  const displayText = shouldShowToggle && !open ? text.substring(0, 150) + '...' : text;
  
  return (
    <div className="mt-3 rounded-card border border-border bg-surface p-3 text-[14px]">
      <div className={open ? '' : 'line-clamp-3'}>
        {displayText || 'No description available'}
      </div>
      {shouldShowToggle && (
        <button 
          onClick={() => setOpen(v => !v)} 
          className="text-text hover:underline text-[13px] mt-1"
        >
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}