import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({ children, className = '', onClick, hoverable = false }: CardProps) {
  const hoverClass = hoverable || onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : '';

  return (
    <div
      className={`bg-theme-secondary rounded-xl shadow-sm border border-theme-primary ${hoverClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`px-6 py-4 border-b border-theme-primary ${className}`}>
      {children}
    </div>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function CardContent({ children, className = '', noPadding = false }: CardContentProps) {
  return <div className={`${noPadding ? '' : 'px-6 py-4'} ${className}`.trim()}>{children}</div>;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`px-6 py-4 border-t border-theme-primary bg-theme-tertiary rounded-b-xl ${className}`}>
      {children}
    </div>
  );
}
