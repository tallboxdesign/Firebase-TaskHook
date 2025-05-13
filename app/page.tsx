"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { DisplayTask, SettingsValues, TaskFormData, Timeframe, AccordionSectionKey, PriorityPreferences, ReprioritizationScope, TaskCategory, PriorityLevel } from "@/lib/types";
import { DEFAULT_SETTINGS, DEFAULT_PRIORITY_PREFERENCES } from "@/lib/types"; 
import { TaskList } from "@/components/TaskList";
import { AppHeader } from "@/components/AppHeader";
import { SettingsDialog } from "@/components/SettingsDialog";
import { PriorityPreferencesDialog } from "@/components/PriorityPreferencesDialog"; 
import { EditTaskDialog } from "@/components/EditTaskDialog"; 
import { CollapsibleTaskCreator } from "@/components/CollapsibleTaskCreator"; 
import StatsGrid from '@/components/stats/StatsGrid';
import { AnimatePresence, motion } from "framer-motion";
import { updateTaskDetailsAndReprioritize, reprioritizeAllTasksWithAI, createTaskWithAIPrioritization } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { getTaskTimeframe, isTaskImportant } from "@/lib/date-utils";
import { compareDesc, startOfDay, isToday, addDays, endOfDay, isWithinInterval, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';


export default function HomePage() {
  const [tasks, setTasks] = useState<DisplayTask[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isPriorityPrefsDialogOpen, setIsPriorityPrefsDialogOpen] = useState(false); 
  const [settings, setSettings] = useState<SettingsValues>(DEFAULT_SETTINGS);
  const [isReprioritizing, setIsReprioritizing] = useState(false);
  const { toast } = useToast();
  const [cumulativeTotalAICost, setCumulativeTotalAICost] = useState(0);
  const [lastBatchAICost, setLastBatchAICost] = useState<number | undefined>(undefined);

  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>("All"); 
  const [showCompletedTasksState, setShowCompletedTasksState] = useState(false); 
  const [expandedSections, setExpandedSections] = useState<AccordionSectionKey[]>([]);
  const [thisWeekTaskFilter, setThisWeekTaskFilter] = useState<"important" | "all">("important");
  
  const [editingTask, setEditingTask] = useState<DisplayTask | null>(null);
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false);


  useEffect(() => {
    setIsClient(true);
    const storedTasks = localStorage.getItem("tasks");
    if (storedTasks) {
      try {
        const parsedTasks: DisplayTask[] = JSON.parse(storedTasks).map((task: any) => {
          let dueDate = new Date();
          if (task.dueDate && isValid(parseISO(task.dueDate))) {
            dueDate = parseISO(task.dueDate);
          } else if (task.dueDate) { // if it exists but not valid ISO, try direct Date constructor
            const directDate = new Date(task.dueDate);
            if (isValid(directDate)) {
              dueDate = directDate;
            }
          }

          return {
          ...task,
          dueDate, 
          createdAt: task.createdAt && isValid(parseISO(task.createdAt)) ? parseISO(task.createdAt) : new Date(),
          completedAt: task.completedAt && isValid(parseISO(task.completedAt)) ? parseISO(task.completedAt) : null,
          instructions: task.instructions || undefined,
          tags: Array.isArray(task.tags) ? task.tags : [],
          category: task.category || "Other",
           aiData: task.aiData ? {
            ...task.aiData,
            combinedScore: typeof task.aiData.combinedScore === 'number' ? task.aiData.combinedScore : 0,
            isVague: task.aiData.isVague ?? false,
            lastOperationCost: typeof task.aiData.lastOperationCost === 'number' ? task.aiData.lastOperationCost : 0,
            inputTokens: typeof task.aiData.inputTokens === 'number' ? task.aiData.inputTokens : 0,
            outputTokens: typeof task.aiData.outputTokens === 'number' ? task.aiData.outputTokens : 0,
          } : undefined,
          totalAICostForTask: typeof task.totalAICostForTask === 'number' ? task.totalAICostForTask : 0,
        }});
        setTasks(parsedTasks);
        const totalCost = parsedTasks.reduce((sum, task) => sum + (task.totalAICostForTask || 0), 0);
        setCumulativeTotalAICost(totalCost);
      } catch (error) {
        console.error("Error parsing tasks from local storage:", error);
        setTasks([]);
        setCumulativeTotalAICost(0);
      }
    }
    const storedSettings = localStorage.getItem("appSettings");
    if (storedSettings) {
      try {
        const parsedSettings = JSON.parse(storedSettings);
        // Ensure confirmTaskCreation is loaded or defaults to false
        const confirmSetting = parsedSettings.confirmTaskCreation ?? DEFAULT_SETTINGS.confirmTaskCreation;
        setSettings({ 
          ...DEFAULT_SETTINGS, 
          ...parsedSettings, 
          confirmTaskCreation: confirmSetting,
          selectedAIModel: parsedSettings.selectedAIModel || DEFAULT_SETTINGS.selectedAIModel,
          priorityPreferences: parsedSettings.priorityPreferences || DEFAULT_SETTINGS.priorityPreferences,
          n8nUserConfiguredIncomingHeaderName: parsedSettings.n8nUserConfiguredIncomingHeaderName || DEFAULT_SETTINGS.n8nUserConfiguredIncomingHeaderName,
          n8nUserConfiguredIncomingSecret: parsedSettings.n8nUserConfiguredIncomingSecret || DEFAULT_SETTINGS.n8nUserConfiguredIncomingSecret,
        });
      } catch (error) {
        console.error("Error parsing settings from local storage:", error);
        setSettings(DEFAULT_SETTINGS);
      }
    } else {
      setSettings(DEFAULT_SETTINGS); 
    }
    const storedLastBatchCost = localStorage.getItem("lastBatchAICost");
    if (storedLastBatchCost) {
      setLastBatchAICost(parseFloat(storedLastBatchCost));
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem("tasks", JSON.stringify(tasks.map(task => ({
        ...task,
        dueDate: task.dueDate.toISOString(), 
        createdAt: task.createdAt.toISOString(),
        completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      }))));
      const totalCost = tasks.reduce((sum, task) => sum + (task.totalAICostForTask || 0), 0);
      setCumulativeTotalAICost(totalCost);
    }
  }, [tasks, isClient]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem("appSettings", JSON.stringify(settings));
    }
  }, [settings, isClient]);
  
  useEffect(() => {
    if (isClient && typeof lastBatchAICost === 'number') {
      localStorage.setItem("lastBatchAICost", lastBatchAICost.toString());
    }
  }, [lastBatchAICost, isClient]);

  const sortTasksStandard = (tasksToSort: DisplayTask[]): DisplayTask[] => {
    return [...tasksToSort].sort((a, b) => {
      if (a.status === "Completed" && b.status === "Completed") {
        const completedA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const completedB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return completedB - completedA; 
      }
      if (a.status === "Completed") return 1; 
      if (b.status === "Completed") return -1;

      const scoreA = a.aiData?.combinedScore ?? -Infinity; 
      const scoreB = b.aiData?.combinedScore ?? -Infinity;
      if (scoreA !== scoreB) return scoreB - scoreA; 
      
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  };

  // This is the final task creation logic, called either directly or after confirmation
  const handleTaskCreated = useCallback(async (formData: TaskFormData) => {
    setIsReprioritizing(true); // Use general loading state
    toast({ title: "Creating Task & AI Processing", description: "Please wait..." });
    try {
      const result = await createTaskWithAIPrioritization(formData, settings);
      if (result.task) {
        setTasks((prevTasks) => sortTasksStandard([result.task!, ...prevTasks]));
        
        let toastMessage = `"${result.task.title}" added.`;
        let toastTitle = "Task Created";
        let duration = 5000;

        if (result.aiProcessed) {
          toastMessage += " AI processing successful.";
          if (result.task.priority !== formData.priority) {
            toastMessage += ` Priority adjusted by AI to ${result.task.priority}.`;
          }
           if (result.task.aiData?.isVague) {
            toastMessage += " AI suggests adding more details for clarity.";
            duration = 8000;
          }
        } else {
            toastTitle = "Task Created (AI Issues)";
            duration = 8000;
             if (result.aiError) { 
                toastMessage += ` ${result.aiError}`; 
                console.error("AI Error during task creation:", result.aiError);
            } else if (!result.apiKeyAvailable) {
                 toastMessage += " API Key not available for the selected model. AI features skipped.";
            } else {
                toastMessage += " AI processing was skipped or encountered an issue.";
            }
        }
        if(result.task.aiData?.lastOperationCost) {
            toastMessage += ` Est. Cost: ${formatCurrency(result.task.aiData.lastOperationCost)}.`;
        }
        toast({ title: toastTitle, description: toastMessage, duration });

      } else {
        toast({ title: "Error Creating Task", description: result.error || "Failed to create task.", variant: "destructive" });
        throw new Error(result.error || "Failed to create task."); // Throw error to be caught by caller if needed
      }
    } catch (error: any) {
       toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
       throw error; // Re-throw error to be caught by caller
    } finally {
       setIsReprioritizing(false);
    }
  }, [settings, toast]); // Include toast in dependencies

  const handleTasksCreated = useCallback(async (parsedVoiceTasks: { title: string; description: string; dueDate?: Date, category: TaskCategory, priority: PriorityLevel }[]) => {
    setIsReprioritizing(true);
    toast({ title: `Processing ${parsedVoiceTasks.length} Voice Tasks...`, description: "AI prioritization in progress for multiple tasks." });

    let createdTasksBatch: DisplayTask[] = [];
    let creationErrors: string[] = [];
    let batchAICost = 0;

    // Note: Voice task creation currently bypasses the single-task confirmation setting.
    // You might want to add a similar confirmation step for voice tasks if needed.
    for (const pTask of parsedVoiceTasks) {
        const taskData: TaskFormData = {
            title: pTask.title,
            description: pTask.description || pTask.title,
            dueDate: pTask.dueDate || new Date(),
            priority: pTask.priority || 'Medium',
            category: pTask.category || 'Personal',
            tags: [],
        };
        try {
            const result = await createTaskWithAIPrioritization(taskData, settings);
            if (result.task) {
                createdTasksBatch.push(result.task);
                if (result.task.aiData?.lastOperationCost) {
                    batchAICost += result.task.aiData.lastOperationCost;
                }
            } else {
                const errorMessage = result.error || result.aiError || `Failed to create task "${pTask.title}".`;
                creationErrors.push(errorMessage);
            }
        } catch (err: any) {
            const errorMessage = `Failed to save task "${pTask.title}": ${err.message || 'Unknown error'}`;
            creationErrors.push(errorMessage);
        }
    }
    
    if (createdTasksBatch.length > 0) {
        setTasks(prevTasks => sortTasksStandard([...createdTasksBatch, ...prevTasks]));
    }

    let finalToastTitle = "Voice Tasks Processed";
    let finalToastDescription = "";
    if (createdTasksBatch.length > 0) {
        finalToastDescription = `${createdTasksBatch.length} task(s) created.`;
        if (batchAICost > 0) {
            finalToastDescription += ` Est. Batch AI Cost: ${formatCurrency(batchAICost)}.`;
        }
    }
    if (creationErrors.length > 0) {
        finalToastTitle = createdTasksBatch.length > 0 ? "Partial Success Creating Voice Tasks" : "Error Creating Voice Tasks";
        finalToastDescription += ` ${creationErrors.length} task(s) failed to create. Check console.`;
        creationErrors.forEach(err => console.error("Voice Task Creation Error:", err));
    }
    if (!finalToastDescription && createdTasksBatch.length === 0 && creationErrors.length === 0) {
        finalToastDescription = "No tasks were processed from voice input.";
    }

    toast({ title: finalToastTitle, description: finalToastDescription, variant: creationErrors.length > 0 ? "destructive" : "default", duration: 8000 });
    setIsReprioritizing(false);
  }, [settings, toast]); // Include toast in dependencies


  const handleToggleComplete = useCallback((taskId: string) => {
    setTasks((prevTasks) =>
      sortTasksStandard(
        prevTasks.map((task) =>
          task.id === taskId
            ? { 
                ...task, 
                status: task.status === "Pending" ? "Completed" : "Pending",
                completedAt: task.status === "Pending" ? new Date() : null 
              }
            : task
        )
      )
    );
  }, []);

  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
  }, []);

  const handleSettingsChange = useCallback((newSettings: SettingsValues) => {
    setSettings(newSettings);
  }, []);

  const handleOpenEditDialog = (task: DisplayTask) => {
    setEditingTask(task);
    setIsEditTaskDialogOpen(true);
  };

  const handleSaveEditedTask = async (taskId: string, formData: TaskFormData) => {
    setIsReprioritizing(true); 
    toast({ title: "Updating Task & AI", description: "Processing task update with AI..." });
    
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) {
        toast({ title: "Error Updating Task", description: "Task not found.", variant: "destructive" });
        setIsReprioritizing(false);
        return;
    }

    try {
      const result = await updateTaskDetailsAndReprioritize(taskId, formData, taskToUpdate, settings);
      if (result.task) {
        setTasks(prevTasks => sortTasksStandard(prevTasks.map(t => t.id === taskId ? result.task! : t)));
        let toastMessage = `Task "${result.task.title}" updated.`;
        if (result.task.aiData?.lastOperationCost) {
           toastMessage += ` AI Op Cost: ${formatCurrency(result.task.aiData.lastOperationCost)}.`;
        }
        if (result.aiProcessed) {
            toastMessage += " AI re-prioritization successful.";
            if (result.task.aiData?.isVague && result.task.aiData.suggestedAction.includes("unclear")) {
               toastMessage += ` AI suggests: ${result.task.aiData.suggestedAction}`;
            }
        } else if (result.aiError) {
            toastMessage += ` AI Error: ${result.aiError}`;
        } else if (!result.apiKeyAvailable && (settings.selectedAIModel?.startsWith('googleai/') || settings.selectedAIModel?.startsWith('xai/'))) {
             toastMessage += " API Key not available. AI re-prioritization skipped.";
        }
        toast({ title: "Task Updated", description: toastMessage, duration: result.aiError || (result.task.aiData?.isVague && result.task.aiData.suggestedAction.includes("unclear")) ? 8000: 5000 });
        setIsEditTaskDialogOpen(false);
        setEditingTask(null);
      } else if (result.error) {
        toast({ title: "Error Updating Task", description: result.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Update Error", description: error.message || "Failed to update task.", variant: "destructive" });
    } finally {
      setIsReprioritizing(false);
    }
  };

  const getTasksForScope = (allTasks: DisplayTask[], scope: ReprioritizationScope): DisplayTask[] => {
    const pendingTasks = allTasks.filter(t => t.status === "Pending");
    const today = startOfDay(new Date());
  
    switch (scope) {
      case "Today":
        return pendingTasks.filter(task => isToday(startOfDay(new Date(task.dueDate))));
      case "NextTwoWeeks":
        const twoWeeksLater = endOfDay(addDays(today, 13)); 
        return pendingTasks.filter(task => {
          const taskDueDate = startOfDay(new Date(task.dueDate));
          return isWithinInterval(taskDueDate, { start: today, end: twoWeeksLater });
        });
      case "ThisMonth":
        const monthStart = startOfMonth(today);
        const monthEnd = endOfMonth(today);
        return pendingTasks.filter(task => {
          const taskDueDate = startOfDay(new Date(task.dueDate));
          return isWithinInterval(taskDueDate, { start: monthStart, end: monthEnd });
        });
      case "All":
      default:
        return pendingTasks;
    }
  };

  const handleReprioritizeScopedTasks = async (scope: ReprioritizationScope) => {
    if (isReprioritizing) return;
    setIsReprioritizing(true);
    
    const tasksToReprioritize = getTasksForScope(tasks, scope);
    const scopeText = scope === "All" ? "all pending" : `pending tasks for "${scope.replace(/([A-Z])/g, ' $1').trim()}"`;

    toast({ title: `AI Re-prioritization Started`, description: `Processing ${tasksToReprioritize.length} ${scopeText}...` });

    if (tasksToReprioritize.length === 0) {
      toast({ title: `No Pending Tasks for Scope: ${scope}`, description: `There are no pending tasks to re-prioritize for ${scopeText}.`, duration: 5000 });
      setIsReprioritizing(false);
      return;
    }
    
    try {
      const result = await reprioritizeAllTasksWithAI(tasksToReprioritize, settings); 
      
      if (result.tasks) {
        const newTaskList = tasks.map(t => {
          const updatedVersion = result.tasks?.find(ut => ut.id === t.id);
          return updatedVersion || t;
        });
        setTasks(sortTasksStandard(newTaskList)); 

        if (typeof result.batchAICost === 'number') {
          setLastBatchAICost(result.batchAICost);
        }
        
        let description = `${result.aiProcessedCount}/${result.totalTasks} ${scopeText} AI-processed.`;
        if (typeof result.batchAICost === 'number') {
          description += ` Batch Cost: ${formatCurrency(result.batchAICost)}.`;
        }
        if (result.aiErrorMessages && result.aiErrorMessages.length > 0) {
          description += ` ${result.aiErrorMessages.length} task(s) had AI errors. Check console for details.`;
           result.aiErrorMessages.forEach(err => console.error("Reprioritization AI Error:", err));
        }
         toast({
          title: `AI Re-prioritization Complete for ${scope}`,
          description: description,
          duration: 8000,
        });

        if (result.error && result.aiErrorMessages?.length === 0) { 
           toast({
            title: "AI Re-prioritization Issue",
            description: result.error,
            variant: "destructive",
            duration: 10000,
          });
        }
      } else if (result.error) { 
        toast({
          title: "AI Re-prioritization Failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error during bulk re-prioritization:", error);
      toast({
        title: "Re-prioritization Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsReprioritizing(false);
    }
  };

  const handleShowPastUncompleted = () => {
    setActiveTimeframe("PastUncompleted");
  };

  const handleShowAllPending = () => {
    setActiveTimeframe("All"); 
  };

  const filteredAndGroupedTasks = useMemo(() => {
    const allPendingGlobal = tasks.filter(task => task.status === 'Pending');
    const completed = tasks.filter(task => task.status === 'Completed');
  
    let top10Tasks: DisplayTask[] = [];
    let pendingForTimeframeGroups: DisplayTask[] = [...allPendingGlobal]; 
  
    if (activeTimeframe === "All" || activeTimeframe === "MostImportant") {
      const sortedAllPending = sortTasksStandard(allPendingGlobal);
      top10Tasks = sortedAllPending.slice(0, 10);
      const top10TaskIds = new Set(top10Tasks.map(t => t.id));
      pendingForTimeframeGroups = allPendingGlobal.filter(t => !top10TaskIds.has(t.id));
    }
  
    const grouped: Record<AccordionSectionKey, DisplayTask[]> = {
      today: [],
      thisWeek: [],
      nextTwoWeeks: [],
      thisMonth: [],
      pastUncompleted: [],
      completedTasks: showCompletedTasksState ? sortTasksStandard(completed) : [],
    };
  
    pendingForTimeframeGroups.forEach(task => {
      const timeframeKey = getTaskTimeframe(task); 
      if (timeframeKey && timeframeKey !== 'completedTasks') {
        if (activeTimeframe !== "All" && activeTimeframe !== "MostImportant") {
          if (activeTimeframe.toLowerCase() === timeframeKey || 
              (activeTimeframe === "PastUncompleted" && timeframeKey === "pastUncompleted")) {
            grouped[timeframeKey].push(task);
          }
        } else {
          grouped[timeframeKey].push(task);
        }
      }
    });
  
    if (activeTimeframe === "PastUncompleted") {
        (Object.keys(grouped) as AccordionSectionKey[]).forEach(key => {
            if (key !== 'pastUncompleted' && key !== 'completedTasks') grouped[key] = [];
        });
        grouped.pastUncompleted = allPendingGlobal.filter(task => getTaskTimeframe(task) === 'pastUncompleted');
    }
    
    // Apply "important" filter for "This Week" section only when global filter is "All" or "MostImportant".
    // If global filter is "ThisWeek", TaskList component will handle the sub-filter.
    if (activeTimeframe === "All" || activeTimeframe === "MostImportant") {
      if (thisWeekTaskFilter === "important") {
          grouped.thisWeek = grouped.thisWeek.filter(task => isTaskImportant(task, settings.priorityPreferences || DEFAULT_PRIORITY_PREFERENCES));
      }
    }
    // Note: When activeTimeframe === "ThisWeek", grouped.thisWeek contains all tasks for this week.
    // The TaskList component will apply the `thisWeekTaskFilter` for display purposes.
  
    for (const key in grouped) {
      if (key !== 'completedTasks' && grouped[key as AccordionSectionKey]) {
         grouped[key as AccordionSectionKey] = sortTasksStandard(grouped[key as AccordionSectionKey]);
      }
    }
    
    return { tasks: grouped, top10Tasks };
  }, [tasks, activeTimeframe, showCompletedTasksState, thisWeekTaskFilter, settings.priorityPreferences]);


  useEffect(() => {
    let newExpanded: AccordionSectionKey[] = [];
    const { tasks: currentGroupedTasks } = filteredAndGroupedTasks;
  
    const expandIfTasks = (key: AccordionSectionKey) => {
      if (currentGroupedTasks[key] && currentGroupedTasks[key].length > 0) {
        newExpanded.push(key);
      }
    };
  
    if (activeTimeframe === "All" || activeTimeframe === "MostImportant") {
      expandIfTasks("today");
      expandIfTasks("thisWeek");
    } else if (activeTimeframe === "Today") {
      expandIfTasks("today");
    } else if (activeTimeframe === "ThisWeek") {
      expandIfTasks("thisWeek");
    } else if (activeTimeframe === "NextTwoWeeks") {
      expandIfTasks("nextTwoWeeks");
    } else if (activeTimeframe === "ThisMonth") {
      expandIfTasks("thisMonth");
    } else if (activeTimeframe === "PastUncompleted") {
      expandIfTasks("pastUncompleted");
    }
  
    if (showCompletedTasksState && currentGroupedTasks.completedTasks && currentGroupedTasks.completedTasks.length > 0) {
      newExpanded = Array.from(new Set([...newExpanded, "completedTasks"]));
    }
    
    setExpandedSections(newExpanded);
  }, [activeTimeframe, showCompletedTasksState, filteredAndGroupedTasks]);

  const handleStatCardClick = (label: string) => {
    setShowCompletedTasksState(false); 
    let newActiveTimeframe: Timeframe = "All";
    let toastMessage = `Viewing tasks for: ${label}`;

    if (label === 'Done') {
      setShowCompletedTasksState(true);
      newActiveTimeframe = "All"; 
      setExpandedSections(["completedTasks"]); 
      toastMessage = "Viewing Completed Tasks";
    } else if (label === 'In Progress') {
      newActiveTimeframe = "ThisWeek"; // Show "This Week" by default for In Progress
      toastMessage = "Viewing In Progress Tasks (This Week)";
    } else if (label === 'Upcoming') {
      newActiveTimeframe = "NextTwoWeeks";
      toastMessage = "Viewing Upcoming Tasks (Next Two Weeks)";
    } else if (label === 'Waiting for Review') {
      newActiveTimeframe = "All"; 
      toastMessage = "Viewing All Pending Tasks";
    }
    
    setActiveTimeframe(newActiveTimeframe);
    toast({ title: "Filter Applied", description: toastMessage });
  };


  if (!isClient) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <AppHeader
            settings={settings}
            onOpenSettings={() => {}}
            onOpenPriorityPreferences={() => {}}
            activeTimeframe={"All"}
            setActiveTimeframe={() => {}}
            showCompletedTasks={false}
            setShowCompletedTasks={() => {}}
            onShowPastUncompleted={() => {}}
            onShowAllPending={() => {}}
        />
        <main className="flex-grow container mx-auto px-4 py-8 max-w-4xl"> 
           <div className="animate-pulse space-y-6">
            <div className="h-24 bg-slate-200 rounded-xl w-full"></div> 
            <div className="h-16 bg-slate-200 rounded-xl w-full"></div> 
            <div className="space-y-4">
              <div className="h-32 bg-slate-200 rounded-xl"></div> 
              <div className="h-32 bg-slate-200 rounded-xl"></div> 
            </div>
          </div>
        </main>
      </div>
    );
  }

  const formatCurrency = (amount?: number, precision = 6) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '$0.000000';
    return `$${amount.toFixed(precision)}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50"> 
      <AppHeader
        settings={settings}
        onOpenSettings={() => setIsSettingsDialogOpen(true)}
        onOpenPriorityPreferences={() => setIsPriorityPrefsDialogOpen(true)}
        activeTimeframe={activeTimeframe}
        setActiveTimeframe={setActiveTimeframe}
        showCompletedTasks={showCompletedTasksState}
        setShowCompletedTasks={setShowCompletedTasksState}
        onShowPastUncompleted={handleShowPastUncompleted}
        onShowAllPending={handleShowAllPending}
      />
      <main className="flex-grow container mx-auto px-2 sm:px-4 py-6 max-w-4xl"> 
        
        {/* Update CollapsibleTaskCreator props */}
        <CollapsibleTaskCreator 
          onTaskSubmit={handleTaskCreated} // Pass the handler to the new prop 
          onTasksCreated={handleTasksCreated} // Keep this for multi-task voice input
          settings={settings} 
        />
        
        <StatsGrid onStatClick={handleStatCardClick} />

        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }} 
          >
            <TaskList
              groupedTasks={filteredAndGroupedTasks.tasks}
              top10Tasks={filteredAndGroupedTasks.top10Tasks}
              onToggleComplete={handleToggleComplete}
              onDeleteTask={handleDeleteTask}
              onEditTask={handleOpenEditDialog} 
              onReprioritizeScopedTasks={handleReprioritizeScopedTasks}
              isReprioritizing={isReprioritizing}
              expandedSections={expandedSections}
              setExpandedSections={setExpandedSections}
              thisWeekTaskFilter={thisWeekTaskFilter}
              setThisWeekTaskFilter={setThisWeekTaskFilter}
              activeTimeframeGlobalFilter={activeTimeframe}
              showCompletedTasksState={showCompletedTasksState} 
              onShowAllPending={handleShowAllPending}
              getTasksForScope={(scope) => getTasksForScope(tasks, scope)}
              priorityPreferences={settings.priorityPreferences || DEFAULT_PRIORITY_PREFERENCES}
            />
          </motion.div>
        </AnimatePresence>
      </main>
      <SettingsDialog
        isOpen={isSettingsDialogOpen}
        onClose={() => setIsSettingsDialogOpen(false)}
        currentSettings={settings}
        onSettingsChange={handleSettingsChange}
        lastBatchAICost={lastBatchAICost}
        cumulativeTotalAICost={cumulativeTotalAICost}
      />
      <PriorityPreferencesDialog
        isOpen={isPriorityPrefsDialogOpen}
        onClose={() => setIsPriorityPrefsDialogOpen(false)}
        currentSettings={settings}
        onSettingsChange={handleSettingsChange} 
      />
      {editingTask && (
        <EditTaskDialog
          isOpen={isEditTaskDialogOpen}
          onClose={() => {
            setIsEditTaskDialogOpen(false);
            setEditingTask(null);
          }}
          taskToEdit={editingTask}
          onSave={handleSaveEditedTask}
          settings={settings}
        />
      )}
    </div>
  );
}