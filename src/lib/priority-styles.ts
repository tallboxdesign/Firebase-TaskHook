export type PriorityLevel = "Low" | "Medium" | "High";

export interface PriorityStyle {
  borderClass: string;
  bgClass: string;
  textClass: string;
  badgeClasses: string; // For the priority pill itself
}

export const PRIORITY_STYLES: Record<PriorityLevel, PriorityStyle> = {
  High: {
    borderClass: "border-red-500", // Tailwind: #ef4444
    bgClass: "bg-red-100",         // Tailwind: #fee2e2
    textClass: "text-red-600",       // Tailwind: #dc2626 (slightly darker for better contrast on red-100)
    badgeClasses: "bg-red-100 text-red-700 border-red-300",
  },
  Medium: {
    borderClass: "border-amber-500", // Tailwind: #f59e0b
    bgClass: "bg-amber-100",       // Tailwind: #fef3c7
    textClass: "text-amber-600",     // Tailwind: #d97706
    badgeClasses: "bg-amber-100 text-amber-700 border-amber-300",
  },
  Low: {
    borderClass: "border-green-500", // Tailwind: #22c55e
    bgClass: "bg-green-100",       // Tailwind: #dcfce7
    textClass: "text-green-600",     // Tailwind: #16a34a
    badgeClasses: "bg-green-100 text-green-700 border-green-300",
  },
};
