// src/components/stats/StatsGrid.tsx
import React, { useMemo } from 'react';
import StatsCard from './StatsCard';
import type { DisplayTask, TaskStatus } from '@/lib/types'; // Assuming TaskStatus is 'Pending', 'Completed', 'InProgress'
import { isWithinInterval, startOfMonth, endOfMonth, isFuture } from 'date-fns';

interface StatItem {
  value: number; // Value should be number for counts
  label: string;
  borderColor?: string;
}

interface StatsGridProps {
  tasks: DisplayTask[];
  onStatClick?: (label: string) => void;
}

const StatsGrid: React.FC<StatsGridProps> = ({ tasks, onStatClick }) => {
  const taskStats = useMemo(() => {
    const doneCount = tasks.filter(task => task.status === 'Completed').length;
    
    // Assuming 'In Progress' is a status. If not, this needs adjustment.
    // For now, let's assume 'Pending' tasks due soon could be 'In Progress' or we need a specific status.
    // Let's simplify: 'In Progress' will be 0 if no such status exists, or count tasks with that status.
    // If 'In Progress' isn't a direct status, we might need to infer it or set it to 0.
    // 'InProgress' status does not exist in TaskStatus type.
    const inProgressCount = 0; // Set to 0 as 'InProgress' is not a defined status

    const today = new Date();
    const currentMonthStart = startOfMonth(today);
    const currentMonthEnd = endOfMonth(today);

    const upcomingCount = tasks.filter(task =>
      task.status === 'Pending' &&
      isFuture(new Date(task.dueDate)) &&
      isWithinInterval(new Date(task.dueDate), { start: currentMonthStart, end: currentMonthEnd })
    ).length;

    // 'Waiting for Review' is not a standard status in DisplayTask.
    // Let's count all 'Pending' tasks that are not 'Upcoming' for this month as a proxy, or set to 0.
    // Or, more simply, all pending tasks that aren't 'upcoming' this month.
    // This definition might need refinement based on actual workflow.
    // For now, let's count pending tasks that are not 'upcoming' this month.
    const waitingForReviewCount = tasks.filter(task =>
      task.status === 'Pending' &&
      !(isFuture(new Date(task.dueDate)) && isWithinInterval(new Date(task.dueDate), { start: currentMonthStart, end: currentMonthEnd }))
    ).length;


    return {
      done: doneCount,
      inProgress: inProgressCount, // This will be 0 if 'InProgress' status doesn't exist
      upcoming: upcomingCount,
      waitingForReview: waitingForReviewCount, // Or simply all other pending tasks
    };
  }, [tasks]);

  const statCards: StatItem[] = [
    { value: taskStats.done, label: 'Done', borderColor: 'border-emerald-400' },
    { value: taskStats.inProgress, label: 'In Progress', borderColor: 'border-amber-400' },
    { value: taskStats.upcoming, label: 'Upcoming', borderColor: 'border-pink-400' },
    { value: taskStats.waitingForReview, label: 'Waiting for Review', borderColor: 'border-blue-400' }
  ];

  // If there are no tasks at all, set all values to 0
  if (tasks.length === 0) {
    statCards.forEach(card => card.value = 0);
  }

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
