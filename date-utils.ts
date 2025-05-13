
import { 
  isToday, 
  isPast, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval,
  addWeeks,
  isThisWeek, // Added missing import
  parseISO 
} from 'date-fns';
import type { DisplayTask, AccordionSectionKey, TaskStatus, PriorityPreferences } from './types';
import { DEFAULT_PRIORITY_PREFERENCES } from './types';

const weekOptions = { weekStartsOn: 1 } as const; // Monday

export const getTaskTimeframe = (task: { dueDate: Date; status: TaskStatus }): AccordionSectionKey | null => {
  const taskDueDate = startOfDay(new Date(task.dueDate)); // Normalize to start of day for consistent comparisons
  const today = startOfDay(new Date());

  if (task.status === 'Completed') {
    return 'completedTasks';
  }

  // Past due (and not today)
  if (isPast(taskDueDate) && !isToday(taskDueDate)) {
    return 'pastUncompleted';
  }

  // Today
  if (isToday(taskDueDate)) {
    return 'today';
  }

  // This Week (tasks due in the current calendar week, Monday-Sunday, excluding today)
  // isThisWeek checks if taskDueDate is in the current Mon-Sun week.
  // Since 'today' is handled above, this effectively becomes "rest of this week".
  if (isThisWeek(taskDueDate, weekOptions)) {
    return 'thisWeek';
  }

  // Next Two Weeks (defined as the next two full calendar weeks: Week N+1 and Week N+2)
  // Week N+1: Starts on Monday of the week after the current week.
  // Week N+2: Ends on Sunday of the week after Week N+1.
  const startOfNextCalendarWeek = startOfWeek(addWeeks(today, 1), weekOptions);
  const endOfSecondNextCalendarWeek = endOfWeek(addWeeks(today, 2), weekOptions); // End of week N+2

  if (isWithinInterval(taskDueDate, { start: startOfNextCalendarWeek, end: endOfSecondNextCalendarWeek })) {
    return 'nextTwoWeeks';
  }

  // This Month (tasks in the current calendar month not covered by 'today', 'thisWeek', or 'nextTwoWeeks')
  // These tasks must be after the 'nextTwoWeeks' period if that period is within the current month,
  // or simply later in the month if 'nextTwoWeeks' extends into the next month.
  const currentMonthStart = startOfMonth(today);
  const currentMonthEnd = endOfMonth(today);

  // The order of checks ensures that if a task is in the current month but was already
  // categorized as 'today', 'thisWeek', or 'nextTwoWeeks', it won't be re-categorized as 'thisMonth'.
  if (isWithinInterval(taskDueDate, { start: currentMonthStart, end: currentMonthEnd })) {
    // Ensure it's not already covered by nextTwoWeeks if nextTwoWeeks falls into current month.
    // This means the task's due date must be after the end of the "next two weeks" period.
    if (taskDueDate > endOfSecondNextCalendarWeek) {
      return 'thisMonth';
    }
    // If nextTwoWeeks extends beyond this month, any task in thisMonth not in today/thisWeek is valid.
    // This check implicitly handles cases where endOfSecondNextCalendarWeek is already in the next month or further.
    // A task can be in "thisMonth" if its due date is within the month AND it's not "today" or "thisWeek".
    // The "nextTwoWeeks" check already ensures tasks in that specific range are handled.
    // So, if a task is in this month, and not today, not thisWeek, and not nextTwoWeeks, it's "thisMonth".
    // This might require checking if it's *not* in nextTwoWeeks explicitly if there's overlap.
    // However, the sequential nature of the `if`s should handle this.
    // Let's simplify: if it's in the month and not caught by earlier checks, it's 'thisMonth'.
    // The crucial part is the order of these `if` statements.
    return 'thisMonth';
  }
  
  // For tasks further in the future (e.g., next month and beyond 'nextTwoWeeks')
  return null; 
};

export const isTaskImportant = (
  task: { priority: PriorityLevel; aiData?: { aiPriorityScore: number } },
  preferences?: PriorityPreferences
): boolean => {
  const prefs = preferences || DEFAULT_PRIORITY_PREFERENCES;

  if (prefs.focus === "Importance") {
    if (task.aiData && task.aiData.aiPriorityScore >= 75) return true; 
    return task.priority === 'High';
  }
  
  if (task.priority === 'High') return true;

  if ((prefs.focus === "Balanced" || prefs.focus === "Deadlines") && task.aiData && task.aiData.aiPriorityScore >= 85) {
    return true;
  }

  return false;
};

