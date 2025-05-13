
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Mic, ArrowRight, Edit, AudioLines, ListPlus, CheckSquare, BarChart3, Zap, Loader2, Info } from 'lucide-react'; // Added Info
import { Card, CardHeader, CardContent } from '@/components/ui/card'; // Card still used for overall container
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskForm } from './TaskForm';
import { VoiceTaskInput, type VoiceTaskInputRef } from './VoiceTaskInput';
import { ConfirmTaskDialog } from './ConfirmTaskDialog'; // Import the confirmation dialog
import type { SettingsValues, TaskFormData, DisplayTask, TaskCategory, PriorityLevel } from '@/lib/types';
import { PREDEFINED_CATEGORIES } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import * as chrono from 'chrono-node';

interface CollapsibleTaskCreatorProps {
  // We need the actual function that handles the final task creation (potentially after AI processing)
  onTaskSubmit: (formData: TaskFormData) => Promise<void>; 
  // Keep onTasksCreated for voice, assuming it might bypass single-task confirmation or handle confirmation internally
  onTasksCreated: (parsedVoiceTasks: { title: string; description: string; dueDate?: Date, category: TaskCategory, priority: PriorityLevel }[]) => Promise<void>; 
  settings: SettingsValues;
}

interface ParsedQuickTask {
  title: string;
  description?: string;
  category?: TaskCategory;
  priority?: PriorityLevel;
  dueDate?: Date;
}

// Helper component for the chevron icon as per new design
const ChevronIcon = ({ size, direction = 'down', className = '' }: {size: number, direction: 'up' | 'down', className?: string}) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    style={{
      transform: direction === 'up' ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 0.2s ease'
    }}
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);


function parseQuickAddText(text: string): ParsedQuickTask {
  let remainingText = text;
  let category: TaskCategory | undefined;
  let priority: PriorityLevel | undefined;
  let dueDate: Date | undefined;

  const categoryRegex = /#([a-zA-Z0-9_\-]+)/g;
  let categoryMatch;
  while((categoryMatch = categoryRegex.exec(remainingText)) !== null) {
    const catName = categoryMatch[1].toLowerCase();
    const foundCategory = PREDEFINED_CATEGORIES.find(pc => pc.toLowerCase() === catName);
    if (foundCategory) {
      category = foundCategory;
      remainingText = remainingText.replace(categoryMatch[0], '').trim();
      break; 
    }
  }
  
  const priorityMatch = remainingText.match(/!(low|medium|high)/i);
  if (priorityMatch) {
    const prioLevel = priorityMatch[1].toLowerCase();
    if (prioLevel === 'high') priority = 'High';
    else if (prioLevel === 'medium') priority = 'Medium';
    else if (prioLevel === 'low') priority = 'Low';
    remainingText = remainingText.replace(priorityMatch[0], '').trim();
  }

  const parsedDateInfo = chrono.parse(remainingText, new Date(), { forwardDate: true });
  if (parsedDateInfo.length > 0) {
    dueDate = parsedDateInfo[0].start.date();
    remainingText = remainingText.replace(parsedDateInfo[0].text, '').trim();
  }
  
  let title = remainingText.trim();
  let description: string | undefined = undefined;

  if (title.length > 100) {
    const sentenceEnd = title.indexOf('.');
    if (sentenceEnd > 0 && sentenceEnd < title.length - 1) {
        description = title.substring(sentenceEnd + 1).trim();
        title = title.substring(0, sentenceEnd + 1);
    }
  }
  if (!title && (category || priority || dueDate)) {
    title = "Quick Task";
  }
  if (!title) title = "Untitled Task";


  return { title, description, category, priority, dueDate };
}


export function CollapsibleTaskCreator({ onTaskSubmit, onTasksCreated, settings }: CollapsibleTaskCreatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'voice' | 'form'>(settings.confirmTaskCreation ? 'form' : 'form'); // Default to form, maybe rethink if voice is primary
  const [quickAddTaskText, setQuickAddTaskText] = useState('');
  const [detailedFormInitialValues, setDetailedFormInitialValues] = useState<Partial<TaskFormData> | undefined>(undefined);
  const { toast } = useToast();
  const [isLoadingQuickAdd, setIsLoadingQuickAdd] = useState(false);
  const voiceInputRef = useRef<VoiceTaskInputRef>(null);
  
  // State for confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [taskToConfirm, setTaskToConfirm] = useState<TaskFormData | null>(null);

  const handleToggleExpand = () => setIsExpanded(!isExpanded);

  const handleMicClick = () => {
    setIsExpanded(true);
    setActiveTab('voice');
    // Logic in VoiceTaskInput handles actual recording start
  };

  // Unified handler for submitting task data, either directly or via confirmation
  const submitTaskData = async (formData: TaskFormData) => {
      if (settings.confirmTaskCreation) {
          setTaskToConfirm(formData);
          setShowConfirmDialog(true);
      } else {
          await onTaskSubmit(formData); // Call the passed-in submit handler directly
      }
  };

  // Handler for when the confirmation dialog is approved
  const handleConfirmAndSubmit = async (confirmedTaskData: TaskFormData) => {
      await onTaskSubmit(confirmedTaskData); 
      setShowConfirmDialog(false); // Close dialog after submission
      setTaskToConfirm(null);
  };

  const handleQuickAddSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!quickAddTaskText.trim()) return;
    setIsLoadingQuickAdd(true);

    const parsed = parseQuickAddText(quickAddTaskText);

    const formData: TaskFormData = {
      title: parsed.title,
      description: parsed.description || parsed.title, 
      dueDate: parsed.dueDate || new Date(),
      priority: parsed.priority || 'Medium',
      category: parsed.category || 'Personal',
      tags: [], 
    };

    try {
        await submitTaskData(formData); // Use the unified submit handler
        setQuickAddTaskText(''); // Clear input only on successful path (direct or confirmed)
    } catch (error: any) {
      // Error handling might already be inside onTaskSubmit, but add a fallback
      toast({ title: "Error", description: error.message || "An unexpected error occurred during task submission.", variant: "destructive" });
    } finally {
      setIsLoadingQuickAdd(false);
    }
  };

  const handleQuickTemplateClick = (templateName: string) => {
    let text = '';
    let detailedData: Partial<TaskFormData> = {};

    if (templateName === 'Daily Standup') {
      text = 'Daily Standup #Work !Medium @today';
      detailedData = { title: 'Daily Standup', category: 'Work', priority: 'Medium', dueDate: new Date() };
    } else if (templateName === 'Workout') {
      text = 'Workout #Health !Medium @today';
      detailedData = { title: 'Workout', category: 'Health', priority: 'Medium', dueDate: new Date() };
    } else if (templateName === 'Shopping') {
      text = 'Shopping #Errands !Low @saturday';
      detailedData = { title: 'Shopping List', category: 'Errands', priority: 'Low' }; 
    }
    
    setQuickAddTaskText(text); 
    setDetailedFormInitialValues(detailedData);
    
    if(!isExpanded) setIsExpanded(true); // Expand if not already
    setActiveTab('form'); // Switch to form tab to show prefill
  };
  
  const quickTemplates = [
    { name: 'Daily Standup', icon: <BarChart3 className="mr-2 h-4 w-4" /> },
    { name: 'Workout', icon: <Zap className="mr-2 h-4 w-4" /> },
    { name: 'Shopping', icon: <CheckSquare className="mr-2 h-4 w-4" /> },
  ];

  // Submit button text based on active tab when expanded
  const submitButtonText = activeTab === 'voice' ? 'Add Parsed Voice Tasks' : 'Add Task (Detailed)';

  return (
    <div className="bg-white mx-4 my-4 rounded-xl shadow-sm overflow-hidden">
      <div 
        className="px-4 py-3 border-b flex justify-between items-center cursor-pointer hover:bg-slate-50"
        onClick={handleToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleToggleExpand();}}
        aria-expanded={isExpanded}
        aria-controls="collapsible-task-content"
      >
        <h2 className="font-medium text-slate-800">Add New Task</h2>
        <button 
          className="text-slate-400 hover:text-slate-600"
          aria-label={isExpanded ? "Collapse task creator" : "Expand task creator"}
        >
          <ChevronIcon 
            size={16} 
            direction={isExpanded ? 'up' : 'down'} 
          />
        </button>
      </div>
      
      <div className="p-3 border-b"> {/* Removed pt-0, Quick add bar is always under header */}
        <form onSubmit={handleQuickAddSubmit} className="flex bg-slate-50 border rounded-lg overflow-hidden">
          <Input
            type="text"
            placeholder="Type task + #category !priority @date"
            className="flex-1 px-3 py-2 bg-transparent border-none outline-none text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            value={quickAddTaskText}
            onChange={(e) => setQuickAddTaskText(e.target.value)}
            disabled={isLoadingQuickAdd}
          />
          <Button 
            type="button" 
            variant="ghost"
            size="icon"
            className="px-2 text-slate-400 hover:text-slate-700 h-auto w-auto"
            onClick={handleMicClick}
            aria-label="Use voice input"
          >
            <Mic size={16} />
          </Button>
          <Button 
            type="submit"
            variant="primary-claude"
            size="icon"
            className="text-white px-3 flex items-center justify-center h-auto w-auto rounded-none rounded-r-md" 
            aria-label="Add quick task" 
            disabled={isLoadingQuickAdd || !quickAddTaskText.trim()}
          >
            {isLoadingQuickAdd ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight size={16} />}
          </Button>
        </form>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.section
            id="collapsible-task-content"
            key="content"
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={{
              open: { opacity: 1, height: 'auto', transition: { duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] } },
              collapsed: { opacity: 0, height: 0, transition: { duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] } },
            }}
          >
            <div className="p-4"> {/* Standard padding for expanded content */}
             {settings.confirmTaskCreation && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 flex items-center">
                    <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>Task confirmation is enabled. Tasks entered here will require approval before being added.</span>
                </div>
             )}
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'voice' | 'form')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100">
                  <TabsTrigger value="voice" className="data-[state=active]:bg-white data-[state=active]:text-slate-700 data-[state=active]:shadow-sm">
                    <AudioLines className="mr-2 h-4 w-4"/> Voice Input
                  </TabsTrigger>
                  <TabsTrigger value="form" className="data-[state=active]:bg-white data-[state=active]:text-slate-700 data-[state=active]:shadow-sm">
                    <Edit className="mr-2 h-4 w-4"/> Detailed Form
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="voice">
                  <VoiceTaskInput
                    ref={voiceInputRef}
                    onTasksCreated={onTasksCreated} // Pass the handler for multiple tasks
                    settings={settings} // Pass settings for potential internal logic
                    isEmbedded
                  />
                </TabsContent>
                <TabsContent value="form">
                  <TaskForm 
                    // Pass the unified submit handler to the detailed form
                    onTaskSubmit={submitTaskData} 
                    settings={settings} 
                    isEmbedded 
                    initialValues={detailedFormInitialValues}
                    key={JSON.stringify(detailedFormInitialValues)} 
                  />
                </TabsContent>
              </Tabs>

              <div className="mt-6">
                <h4 className="text-sm font-medium text-slate-600 mb-2">Quick Templates</h4>
                <div className="flex flex-wrap gap-2">
                  {quickTemplates.map(template => (
                    <Button 
                      key={template.name} 
                      variant="outlined-claude" 
                      size="claude-xs" 
                      onClick={() => handleQuickTemplateClick(template.name)}
                      className="border-slate-200" // Lighter border for template pills
                    >
                      {template.icon}
                      {template.name}
                    </Button>
                  ))}
                </div>
              </div>
              {/* Submit button for expanded view is handled by individual forms/voice input logic */}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      
      {/* Render the confirmation dialog */} 
      {taskToConfirm && (
          <ConfirmTaskDialog 
              isOpen={showConfirmDialog}
              onClose={() => {
                  setShowConfirmDialog(false);
                  setTaskToConfirm(null);
              }}
              onConfirm={handleConfirmAndSubmit}
              taskData={taskToConfirm}
          />
      )}
    </div>
  );
}
