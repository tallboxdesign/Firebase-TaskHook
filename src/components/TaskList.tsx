"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ListX, RotateCw, Loader2, ChevronDown, ChevronRight, SlidersHorizontal, Star, ListFilter, PanelLeft, RefreshCw } from "lucide-react";
import type { DisplayTask, AccordionSectionKey, Timeframe, ReprioritizationScope, PriorityPreferences } from "@/lib/types";
import { TaskCard } from "./TaskCard";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isTaskImportant } from "@/lib/date-utils";


interface TaskListProps {
  groupedTasks: Record<AccordionSectionKey, DisplayTask[]>;
  top10Tasks?: DisplayTask[];
  onToggleComplete: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (task: DisplayTask) => void;
  onReprioritizeScopedTasks: (scope: ReprioritizationScope) => Promise<void>;
  isReprioritizing: boolean;
  expandedSections: AccordionSectionKey[];
  setExpandedSections: React.Dispatch<React.SetStateAction<AccordionSectionKey[]>>;
  thisWeekTaskFilter: "important" | "all";
  setThisWeekTaskFilter: (filter: "important" | "all") => void;
  activeTimeframeGlobalFilter: Timeframe;
  showCompletedTasksState: boolean; 
  onShowAllPending: () => void; 
  getTasksForScope: (scope: ReprioritizationScope) => DisplayTask[];
  priorityPreferences: PriorityPreferences;
}

const sectionOrder: AccordionSectionKey[] = ["pastUncompleted", "today", "thisWeek", "nextTwoWeeks", "thisMonth", "completedTasks"];

const sectionTitles: Record<AccordionSectionKey, string> = {
  today: "Today",
  thisWeek: "This Week",
  nextTwoWeeks: "Next Two Weeks",
  thisMonth: "This Month",
  pastUncompleted: "Past Due Tasks",
  completedTasks: "Completed Tasks",
};

const reprioritizationScopes: { scope: ReprioritizationScope; label: string }[] = [
  { scope: "All", label: "All Pending Tasks" },
  { scope: "Today", label: "Today's Tasks" },
  { scope: "NextTwoWeeks", label: "Next Two Weeks" },
  { scope: "ThisMonth", label: "This Month's Tasks" },
];

export function TaskList({ 
  groupedTasks, 
  top10Tasks,
  onToggleComplete, 
  onDeleteTask, 
  onEditTask,
  onReprioritizeScopedTasks, 
  isReprioritizing,
  expandedSections,
  setExpandedSections,
  thisWeekTaskFilter,
  setThisWeekTaskFilter,
  activeTimeframeGlobalFilter,
  showCompletedTasksState, 
  onShowAllPending,
  getTasksForScope,
  priorityPreferences,
}: TaskListProps) {

  const isGeneralView = activeTimeframeGlobalFilter === "All" || activeTimeframeGlobalFilter === "MostImportant";
  const shouldShowTop10Section = top10Tasks && top10Tasks.length > 0 && isGeneralView;
  
  const totalTasksInAccordion = Object.values(groupedTasks).flat().length;
  // Calculate total displayed tasks considering the thisWeekTaskFilter for accurate count when "This Week" is active
  let effectiveThisWeekCount = groupedTasks.thisWeek?.length || 0;
  if (activeTimeframeGlobalFilter === "ThisWeek" && thisWeekTaskFilter === 'important') {
    effectiveThisWeekCount = (groupedTasks.thisWeek || []).filter(task => isTaskImportant(task, priorityPreferences)).length;
  } else if ((activeTimeframeGlobalFilter === "All" || activeTimeframeGlobalFilter === "MostImportant") && thisWeekTaskFilter === 'important'){
    // if general view and "important" is on for thisWeek, count only important ones for that section
    effectiveThisWeekCount = (groupedTasks.thisWeek || []).filter(task => isTaskImportant(task, priorityPreferences)).length;
  }


  const adjustedTotalTasksInAccordion = 
    (groupedTasks.today?.length || 0) +
    effectiveThisWeekCount + // Use the potentially filtered count
    (groupedTasks.nextTwoWeeks?.length || 0) +
    (groupedTasks.thisMonth?.length || 0) +
    (groupedTasks.pastUncompleted?.length || 0) +
    (showCompletedTasksState ? (groupedTasks.completedTasks?.length || 0) : 0);

  const totalDisplayedTasks = (shouldShowTop10Section ? top10Tasks!.length : 0) + adjustedTotalTasksInAccordion;


  if (totalDisplayedTasks === 0 && ! (showCompletedTasksState && (groupedTasks.completedTasks?.length || 0) > 0) ) {
     const filterName = activeTimeframeGlobalFilter === "All" || activeTimeframeGlobalFilter === "MostImportant" 
                        ? "current view" 
                        : sectionTitles[activeTimeframeGlobalFilter.toLowerCase() as AccordionSectionKey] || activeTimeframeGlobalFilter;
     const message = (activeTimeframeGlobalFilter === "All" || activeTimeframeGlobalFilter === "MostImportant")
        ? "No tasks yet. Create a new task to get started!" 
        : `No tasks match "${filterName}". Try a different filter or create a new task.`;
    return (
      <div className="mt-8 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-white shadow-sm">
        <ListX className="h-16 w-16 text-slate-400 mb-4" />
        <h3 className="text-xl font-semibold text-slate-700 mb-1">
          { (activeTimeframeGlobalFilter === "All" || activeTimeframeGlobalFilter === "MostImportant") ? "No Tasks Yet" : `No Tasks for "${filterName}"`}
        </h3>
        <p className="text-slate-500 text-sm">{message}</p>
      </div>
    );
  }
  
  const handleToggleSection = (value: string[]) => {
    setExpandedSections(value as AccordionSectionKey[]);
  };

  return (
    <div className="mx-4 mb-6"> 
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <Star size={16} className="text-amber-400 mr-1.5" /> 
          <h3 className="font-medium text-slate-700 text-base"> 
            {shouldShowTop10Section ? "Key Priorities" : "Tasks"}
          </h3>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            variant="outlined-claude" 
            size="claude-sm" 
            onClick={onShowAllPending}
            className="border-slate-300"
          >
            <PanelLeft size={14} className="mr-1.5" /> 
            All Pending
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="primary-claude" 
                size="claude-sm" 
                disabled={isReprioritizing}
              >
                {isReprioritizing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw size={14} className="mr-1.5" />
                )}
                Re-prioritize
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Select Scope for AI Re-prioritization</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {reprioritizationScopes.map(({ scope, label }) => {
                const tasksInScopeCount = getTasksForScope(scope).length;
                return (
                  <DropdownMenuItem
                    key={scope}
                    disabled={isReprioritizing || tasksInScopeCount === 0}
                    onSelect={() => onReprioritizeScopedTasks(scope)}
                    className="cursor-pointer"
                  >
                    {label} ({tasksInScopeCount})
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {shouldShowTop10Section && top10Tasks && top10Tasks.length > 0 && (
        <div className="mb-6"> 
          <div className="space-y-3"> 
            <AnimatePresence>
              {top10Tasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  <TaskCard
                    task={task}
                    onToggleComplete={onToggleComplete}
                    onDeleteTask={onDeleteTask}
                    onEdit={onEditTask}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      <Accordion 
        type="multiple" 
        value={expandedSections} 
        onValueChange={handleToggleSection}
        className="w-full space-y-2" 
      >
        {sectionOrder.map(sectionKey => {
          let tasksSource = groupedTasks[sectionKey] || [];
          let displayTasksInSection = [...tasksSource];
          const title = sectionTitles[sectionKey];
          
          const isSectionCurrentlyActiveFilter = activeTimeframeGlobalFilter.toLowerCase() === sectionKey;

          // Determine if this accordion section should be rendered at all based on the global filter
          const shouldRenderAccordionShell = 
            isGeneralView || // Always render all shells in general view
            isSectionCurrentlyActiveFilter || // Render if it's the specifically selected filter
            (sectionKey === "completedTasks" && showCompletedTasksState); // Always render completed if toggled

          if (!shouldRenderAccordionShell) {
            return null;
          }

          // Apply "important" filter for "This Week" section for display, using the passed priorityPreferences
          if (sectionKey === 'thisWeek' && thisWeekTaskFilter === 'important') {
            displayTasksInSection = tasksSource.filter(task => isTaskImportant(task, priorityPreferences));
          }
          
          // Determine if the accordion item itself (header + content) should be shown,
          // even if it means showing an empty state for the content.
          // We show it if:
          // 1. It has tasks to display.
          // 2. It's the actively selected global filter (e.g., "This Week" filter is on, show the "This Week" accordion even if empty).
          // 3. It's "Today" or "This Week" in a general view (we always want these accordions present).
          // 4. It's "Completed Tasks", it's toggled to be shown, and it's expanded.
          const shouldDisplayContentArea = 
            displayTasksInSection.length > 0 ||
            isSectionCurrentlyActiveFilter ||
            (isGeneralView && (sectionKey === "today" || sectionKey === "thisWeek")) ||
            (sectionKey === "completedTasks" && showCompletedTasksState && expandedSections.includes("completedTasks"));

          if (!shouldDisplayContentArea && sectionKey !== "completedTasks") { 
             // If not displaying content area and it's not completed tasks section, don't render accordion at all.
             // This helps hide empty "NextTwoWeeks", "ThisMonth", "PastUncompleted" in general view if they have no tasks.
             // Exception: "Today" and "ThisWeek" are always shown in general view.
             if (!isGeneralView || (sectionKey !== "today" && sectionKey !== "thisWeek")) {
                return null;
             }
          }
          if (sectionKey === "completedTasks" && !showCompletedTasksState) return null;


          return (
            <AccordionItem value={sectionKey} key={sectionKey} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:bg-slate-50 transition-colors text-base font-medium text-slate-700 data-[state=open]:border-b data-[state=open]:border-slate-200">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center">
                    {title}
                  </div>
                  <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-600">{displayTasksInSection.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                {sectionKey === 'thisWeek' && 
                 (isGeneralView || activeTimeframeGlobalFilter === "ThisWeek") &&
                 ( tasksSource.length > 0 ) && // Only show filter button if there are tasks in the source for this week
                  (
                  <div className="mb-3 text-right"> 
                    <Button 
                      variant="outlined-claude" 
                      size="claude-xs" 
                      onClick={() => setThisWeekTaskFilter(thisWeekTaskFilter === 'all' ? 'important' : 'all')}
                      className="border-slate-300"
                    >
                      <SlidersHorizontal className="mr-1.5 h-3 w-3"/>
                      {thisWeekTaskFilter === 'all' ? 'Show Important Only' : 'Show All This Week'}
                    </Button>
                  </div>
                )}
                {displayTasksInSection.length > 0 ? (
                  <div className="space-y-3"> 
                    <AnimatePresence>
                      {displayTasksInSection.map((task) => (
                        <motion.div
                          key={task.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        >
                          <TaskCard
                            task={task}
                            onToggleComplete={onToggleComplete}
                            onDeleteTask={onDeleteTask}
                            onEdit={onEditTask}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                   (isSectionCurrentlyActiveFilter || (isGeneralView && (sectionKey === "today" || sectionKey === "thisWeek")) || (sectionKey === "completedTasks" && showCompletedTasksState)) && (
                    <p className="text-sm text-slate-500 py-4 text-center">
                       {`No tasks for ${title.toLowerCase()} currently.`}
                    </p>
                   )
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}