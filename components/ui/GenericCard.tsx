import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ className, children, ...props }) => {
  const baseClasses = 'rounded-lg border bg-card text-card-foreground shadow-sm';
  const combinedClasses = `${baseClasses} ${className || ''}`;

  return (
    <div className={combinedClasses} {...props}>
      {children}
    </div>
  );
};

export default Card;