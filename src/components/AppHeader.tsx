
"use client";

import { ListChecks, Settings, CalendarDays, CheckSquare, Archive, Star, Filter, Sparkles, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Timeframe } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  onOpenSettings: () => void;
  onOpenPriorityPreferences: () => void;
  activeTimeframe: Timeframe;
  setActiveTimeframe: (timeframe: Timeframe) => void;
  showCompletedTasks: boolean;
  setShowCompletedTasks: (show: boolean) => void;
  onShowPastUncompleted: () => void;
  onShowAllPending: () => void; // Added this prop
}

export function AppHeader({ 
  onOpenSettings, 
  onOpenPriorityPreferences,
  activeTimeframe, 
  setActiveTimeframe,
  showCompletedTasks,
  setShowCompletedTasks,
  onShowPastUncompleted,
  onShowAllPending // Added this prop
}: AppHeaderProps) {

  // Timeframe filter options from previous implementation, can be adjusted
  const timeframeOptions: { value: Timeframe; label: string; icon: React.ElementType }[] = [
    { value: "Today", label: "Today", icon: CalendarDays },
    { value: "ThisWeek", label: "This Week", icon: CalendarDays },
    { value: "NextTwoWeeks", label: "Next Two Weeks", icon: CalendarDays },
    { value: "ThisMonth", label: "This Month", icon: CalendarDays },
    { value: "MostImportant", label: "Most Important", icon: Star },
    // "All" filter is now handled by a dedicated button "All Pending"
  ];

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center">
          {/* New Logo */}
          <div className="flex items-center mr-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white">
              <div className="w-4 flex flex-col">
                <div className="h-0.5 w-3 bg-white mb-0.5 rounded-full"></div>
                <div className="h-0.5 w-4 bg-white mb-0.5 rounded-full"></div>
                <div className="h-0.5 w-3 bg-white rounded-full"></div>
              </div>
            </div>
          </div>
          <h1 className="font-semibold text-slate-800 text-lg">TaskHook</h1> {/* Renamed here */}
        </div>

        <div className="flex items-center space-x-2">
          {/* Timeframe Dropdown - kept for consistency with existing filtering, styled with new Button variant */}
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                     <Button variant="outlined-claude" size="claude-md" className="border-slate-300">
                      <Filter className="mr-1.5 h-4 w-4" />
                      {timeframeOptions.find(tf => tf.value === activeTimeframe)?.label || "Filter View"}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Filter tasks by timeframe</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filter by Timeframe</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={activeTimeframe} onValueChange={(value) => setActiveTimeframe(value as Timeframe)}>
                {timeframeOptions.map(option => (
                  <DropdownMenuRadioItem key={option.value} value={option.value} className="cursor-pointer">
                    <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outlined-claude" size="claude-md" onClick={onShowAllPending} className="border-slate-300">
            <PanelLeft size={14} className="mr-1.5" /> All Pending
          </Button>
          
          <Button variant="outlined-claude" size="claude-md" onClick={onShowPastUncompleted} className="border-slate-300">
            <Archive size={14} className="mr-1.5" /> Past Due
          </Button>
          
          <Button 
            variant="outlined-claude"
            size="claude-md" 
            onClick={() => setShowCompletedTasks(!showCompletedTasks)}
            className={cn("border-slate-300", showCompletedTasks && "bg-slate-100")}
          >
            <CheckSquare size={14} className="mr-1.5" /> 
            {showCompletedTasks ? "Hide Completed" : "Show Completed"}
          </Button>

          <Button variant="primary-claude" size="claude-md" onClick={onOpenPriorityPreferences}>
            <Star size={14} className="mr-1.5" /> Set Priorities
          </Button>

          <button 
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md" // Adjusted for consistency
            onClick={onOpenSettings} 
            aria-label="Open settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
