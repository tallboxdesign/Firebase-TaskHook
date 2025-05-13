// src/components/stats/StatsCard.tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  value: string | number;
  label: string;
  borderColor?: string; // e.g., 'border-emerald-400'
  className?: string;
  onClick?: () => void;
}

const StatsCard: React.FC<StatsCardProps> = ({ value, label, borderColor, className, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-white rounded-xl overflow-hidden shadow-sm border-l-4 text-left w-full transition-all hover:shadow-md hover:scale-[1.02]",
        borderColor || 'border-slate-400', // Default border if none provided
        onClick ? "cursor-pointer" : "cursor-default",
        className
      )}
      data-ai-hint="statistic card"
      disabled={!onClick} // Disable if no onClick is provided
    >
      <div className="p-4">
        <div className="text-3xl font-bold text-slate-800">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
    </button>
  );
};

export default StatsCard;
