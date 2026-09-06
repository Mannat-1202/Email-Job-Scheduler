import React from 'react';
import { EmailStatus } from '../../types';

export interface BadgeProps {
  status: EmailStatus | string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  const normalized = status.toUpperCase();

  const getStyle = () => {
    switch (normalized) {
      case 'SCHEDULED':
        return 'bg-blue-950/60 text-blue-300 border-blue-800/60';
      case 'PROCESSING':
        return 'bg-amber-950/60 text-amber-300 border-amber-800/60 animate-pulse';
      case 'SENT':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60';
      case 'FAILED':
        return 'bg-rose-950/60 text-rose-300 border-rose-800/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStyle()} ${className}`}
    >
      {normalized}
    </span>
  );
};
