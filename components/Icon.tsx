
import React, { useEffect } from 'react';
import { IconName } from '../types';

interface IconProps extends React.HTMLAttributes<HTMLElement> {
  name: IconName;
  size?: number;
}

const Icon: React.FC<IconProps> = ({ name, size = 18, className, ...props }) => {
  const iconAttributes = {
    'data-lucide': name,
    width: size,
    height: size,
    ...props
  };
  
  // Lucide's createIcons() needs to be called to transform the `<i>` tags.
  // We call it after the component mounts or updates based on dependencies.
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [name, size, className]);

  return <i {...iconAttributes} className={className}></i>;
};

// Augment the global Window interface to include `lucide`
declare global {
  interface Window {
    lucide: {
      createIcons: () => void;
    };
  }
}


export default Icon;
