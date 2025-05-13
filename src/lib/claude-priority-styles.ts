// src/lib/claude-priority-styles.ts

export type PriorityLevelClaude = "high" | "medium" | "low";

interface ClaudePriorityStyle {
  gradient: string;
  badge: string;
  border: string;
}

export const PRIORITY_CONFIG_CLAUDE: Record<PriorityLevelClaude, ClaudePriorityStyle> = {
  high: {
    gradient: 'from-rose-300 to-rose-400',
    badge: 'bg-rose-50 text-rose-500',
    border: 'border-rose-400',
  },
  medium: {
    gradient: 'from-amber-200 to-amber-300',
    badge: 'bg-amber-50 text-amber-600',
    border: 'border-amber-400',
  },
  low: {
    gradient: 'from-emerald-200 to-emerald-300',
    badge: 'bg-emerald-50 text-emerald-600',
    border: 'border-emerald-400',
  }
};
