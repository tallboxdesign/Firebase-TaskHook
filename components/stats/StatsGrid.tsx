// src/components/stats/StatsGrid.tsx
import React from 'react';
import StatsCard from './StatsCard';

interface StatItem {
  value: string | number;
  label: string;
  borderColor?: string;
}

interface StatsGridProps {
  onStatClick?: (label: string) => void; 
}

const StatsGrid: React.FC<StatsGridProps> = ({ onStatClick }) => {
  // Using mock data as per the example plan
  const statCards: StatItem[] = [
    { value: 22, label: 'Done', borderColor: 'border-emerald-400' },
    { value: 7, label: 'In Progress', borderColor: 'border-amber-400' },
    { value: 12, label: 'Upcoming', borderColor: 'border-pink-400' }, // Using rose as pink from palette
    { value: 14, label: 'Waiting for Review', borderColor: 'border-blue-400' } // Using primary as blue from palette
  ];

  return (
    <div className="mx-4 mb-4">
      <h3 className="font-medium text-slate-700 mb-3 text-base">Monthly Preview</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3"> {/* Adjusted for more cards */}
        {statCards.map((stat, index) => (
          <StatsCard 
            key={index}
            value={stat.value}
            label={stat.label}
            borderColor={stat.borderColor}
            onClick={onStatClick ? () => onStatClick(stat.label) : undefined}
          />
        ))}
      </div>
    </div>
  );
};

export default StatsGrid;
