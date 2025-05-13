
"use client";

import { format } from "date-fns";
import { BadgeCheck, CalendarDays, CheckCircle2, Circle, Edit3, FolderKanban, Info, MessageSquareQuote, Tag as TagIconLucide, Trash2, Zap, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag"; // Using the new Tag component
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { DisplayTask } from "@/lib/types";
import { PRIORITY_CONFIG_CLAUDE, type PriorityLevelClaude } from "@/lib/claude-priority-styles";
import { cn } from "@/lib/utils";
import React, { useState } from "react";

interface TaskCardProps {
  task: DisplayTask;
  onToggleComplete: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEdit: (task: DisplayTask) => void;
}

const formatCurrency = (amount?: number) => {
  if (typeof amount !== 'number') return 'N/A';
  return `$${amount.toFixed(6)}`;
};

export function TaskCard({ task, onToggleComplete, onDeleteTask, onEdit }: TaskCardProps) {
  const [aiDetailsExpanded, setAiDetailsExpanded] = useState(false);
  const isCompleted = task.status === "Completed";
  
  const priorityLevel = task.priority.toLowerCase() as PriorityLevelClaude;
  const priorityStyle = PRIORITY_CONFIG_CLAUDE[priorityLevel] || PRIORITY_CONFIG_CLAUDE.medium;

  const toggleAiDetails = () => setAiDetailsExpanded(!aiDetailsExpanded);

  return (
    <div 
      className="bg-white rounded-xl shadow-sm overflow-hidden"
      data-ai-hint="task card item"
    >
      <div className={`h-1 bg-gradient-to-r ${priorityStyle.gradient}`}></div>
      <div className="p-4">
        {/* Title and Priority Badge */}
        <div className="flex justify-between items-start mb-2">
          <h3 className={cn("font-medium text-slate-800", isCompleted && "line-through text-slate-500")}>
            {task.title}
          </h3>
          <Badge variant={`${priorityLevel}-claude` as any}>{task.priority} Priority</Badge>
        </div>
        
        {/* Metadata */}
        <div className="flex items-center text-xs text-slate-500 space-x-4 mb-2">
          <span className="flex items-center">
            <CalendarDays size={12} className="mr-1" /> 
            Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
          </span>
          <span className="flex items-center">
            <FolderKanban size={12} className="mr-1" /> 
            Category: {task.category}
          </span>
        </div>
        
        {/* Description - Only if different from title */}
        {task.description && task.description !== task.title && !isCompleted && (
          <p className="text-sm text-slate-600 mb-3">{task.description}</p>
        )}
         {task.description && task.description !== task.title && isCompleted && (
          <p className="text-sm text-slate-600 mb-3 line-through">{task.description}</p>
        )}
        
        {/* AI Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {task.tags.map((tag, index) => (
              <Tag key={index}>{tag}</Tag>
            ))}
          </div>
        )}
        
        {/* Actions & AI Toggle */}
        <div className="flex justify-between items-center">
          <Button 
            variant="subtle-claude" 
            size="claude-sm" 
            onClick={toggleAiDetails}
            aria-expanded={aiDetailsExpanded}
          >
            <Zap size={12} className="mr-1.5" />
            AI Details
            {aiDetailsExpanded ? <ChevronUp size={12} className="ml-1" /> : <ChevronDown size={12} className="ml-1" />}
          </Button>
          
          <div className="flex space-x-2">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => onToggleComplete(task.id)}
                    className="p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                    aria-label={isCompleted ? "Mark as pending" : "Mark as complete"}
                  >
                    {isCompleted ? <Circle size={16} /> : <CheckCircle2 size={16} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top"><p>{isCompleted ? "Mark as Pending" : "Mark as Complete"}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                   <button
                    onClick={() => onEdit(task)}
                    className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    aria-label={`Edit task ${task.title}`}
                    disabled={isCompleted}
                  >
                    <Edit3 size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top"><p>Edit Task</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="p-1.5 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                    aria-label="Delete task"
                  >
                    <Trash2 size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top"><p>Delete Task</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
      
      {/* Expanded AI Details */}
      {aiDetailsExpanded && task.aiData && (
        <div className="px-4 py-3 bg-slate-50 text-xs border-t border-slate-200">
          <div className="flex justify-between mb-2 text-slate-500 items-center">
            <Badge variant="outline" className="border-primary/50 text-primary">AI Score: {task.aiData.aiPriorityScore}/100</Badge>
            {typeof task.aiData.inputTokens === 'number' && typeof task.aiData.outputTokens === 'number' && (
              <Badge variant="outline" className="text-xs">
                  Tokens: {task.aiData.inputTokens} In / {task.aiData.outputTokens} Out
              </Badge>
            )}
          </div>
          
          <div className="mb-2.5">
            <div className="font-medium text-slate-700 mb-0.5 flex items-center"><MessageSquareQuote size={14} className="mr-1.5 text-slate-500"/>Reasoning:</div>
            <p className="text-slate-600 pl-1">{task.aiData.reasoning}</p>
          </div>
          
          <div className="mb-2.5">
            <div className="font-medium text-slate-700 mb-0.5 flex items-center"><Info size={14} className="mr-1.5 text-slate-500"/>Suggestion:</div>
            <p className="text-slate-600 pl-1">{task.aiData.suggestedAction}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between text-xs text-slate-500 pt-2 border-t border-slate-200/60 mt-2 gap-1 sm:gap-2">
            <span className="flex items-center">
              <Zap size={12} className="mr-1 text-green-600"/>Last AI Op Cost: {formatCurrency(task.aiData.lastOperationCost)}
            </span>
            <span className="flex items-center">
               <Zap size={12} className="mr-1 text-blue-600"/>Total Task AI Cost: {formatCurrency(task.totalAICostForTask)}
            </span>
          </div>
        </div>
      )}

       {task.aiData?.isVague && !isCompleted && !aiDetailsExpanded && ( 
          <div className="px-4 pb-3 pt-1"> 
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(task)}
              className="w-full flex items-center justify-center text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300 rounded-md p-1.5 transition-colors"
              aria-label={`Add details for task ${task.title}`}
            >
              <AlertTriangle size={14} className="mr-1.5 shrink-0" />
              AI suggests adding more details for clarity. Click to edit.
            </Button>
          </div>
        )}
    </div>
  );
}
