
"use server";

import { prioritizeTasks } from "@/ai/flows/prioritize-tasks";
import { generateTaskTags } from "@/ai/flows/generate-task-tags";
import type {
  PrioritizeTasksFlowInput,
  PrioritizeTasksOutput as AIFlowPrioritizeOutput, 
  AIFlowTaskData, 
  GenerateTaskTagsFlowInput,
  GenerateTaskTagsOutput as AIFlowTagsOutput,
} from "@/ai/schemas";
import type { 
  DisplayTask, 
  TaskFormData, 
  Task, 
  PriorityLevel, 
  TaskCategory, 
  AIModelId, 
  AIPrioritizationResult, 
  SettingsValues, 
  TaskStatus,
  PriorityPreferences
} from "@/lib/types";
import { DEFAULT_AI_MODEL_ID, DEFAULT_PRIORITY_PREFERENCES } from "@/lib/types";
import { format, differenceInDays, startOfDay } from "date-fns";
import { calculateAICost } from "@/lib/cost-calculator";

const MOCK_USER_ID = "user123"; 

interface CreateTaskResult {
  task?: DisplayTask;
  error?: string;
  aiError?: string;
  apiKeyAvailable: boolean;
  aiProcessed: boolean;
}

interface UpdateTaskResult {
  task?: DisplayTask;
  error?: string;
  aiError?: string;
  apiKeyAvailable: boolean;
  aiProcessed: boolean;
}

interface ReprioritizeAllResult {
  tasks?: DisplayTask[];
  error?: string;
  apiKeyAvailable: boolean;
  aiProcessedCount: number;
  totalTasks: number;
  aiErrorMessages: string[];
  batchAICost?: number; 
}

async function sendToWebhook(task: DisplayTask, n8nWebhookUrlEndpoint?: string, eventType: string = 'task_created_or_updated') {
  if (n8nWebhookUrlEndpoint) {
    try {
      const response = await fetch(n8nWebhookUrlEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: eventType, task }),
      });
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Webhook (${eventType}) Error: ${response.status} ${response.statusText}`, errorBody);
      } else {
        console.log(`Task data (${eventType}) sent to n8n.`);
      }
    } catch (error) {
      console.error(`Webhook (${eventType}) Network Error:`, error);
    }
  } else {
    console.log(`N8N_WEBHOOK_URL not configured for ${eventType} event. Skipping webhook.`);
  }
}

function buildUserContextString(preferences: PriorityPreferences): string {
  let contextParts: string[] = [];
  contextParts.push(`User's primary prioritization focus is '${preferences.focus}'.`);

  if (preferences.focus === "Deadlines" && preferences.urgencyThresholdPreset) {
    contextParts.push(`They consider tasks due within '${preferences.urgencyThresholdPreset}' as particularly urgent.`);
  }
  if (preferences.focus === "Importance" && preferences.importanceAspectPreset) {
    contextParts.push(`Key aspects of importance for them include: '${preferences.importanceAspectPreset}'.`);
  }
  if (preferences.focus === "Categories" && preferences.preferredCategories && preferences.preferredCategories.length > 0) {
    contextParts.push(`They are focusing on these task categories: ${preferences.preferredCategories.join(', ')}.`);
  }
  if (preferences.customKeywords && preferences.customKeywords.length > 0) {
    contextParts.push(`Pay special attention to these keywords: ${preferences.customKeywords.join(', ')}.`);
  }
  
  return contextParts.join(' ');
}


function calculateCombinedScore(task: Task | DisplayTask, aiData?: AIPrioritizationResult, preferences?: PriorityPreferences): number {
  const effectivePrefs = preferences || DEFAULT_PRIORITY_PREFERENCES;
  let score = 0;

  const priorityMap: Record<PriorityLevel, number> = { High: 30, Medium: 20, Low: 10 };
  let userSetPriorityComponent = priorityMap[task.priority] || 0;

  let dueDateComponent = 0;
  const today = startOfDay(new Date());
  const taskDueDate = startOfDay(new Date(task.dueDate));
  const daysUntilDue = differenceInDays(taskDueDate, today);

  if (daysUntilDue < 0) dueDateComponent = 40; 
  else if (daysUntilDue === 0) dueDateComponent = 35; 
  else if (daysUntilDue <= 2) dueDateComponent = 30;
  else if (daysUntilDue <= 7) dueDateComponent = 20;
  else if (daysUntilDue <= 14) dueDateComponent = 10;
  
  if (effectivePrefs.focus === "Deadlines" && effectivePrefs.urgencyThresholdPreset) {
    if (effectivePrefs.urgencyThresholdPreset === "1 day" && daysUntilDue <= 1) dueDateComponent = Math.max(dueDateComponent, 38);
    if (effectivePrefs.urgencyThresholdPreset === "3 days" && daysUntilDue <= 3) dueDateComponent = Math.max(dueDateComponent, 33);
    if (effectivePrefs.urgencyThresholdPreset === "1 week" && daysUntilDue <= 7) dueDateComponent = Math.max(dueDateComponent, 25);
  }

  let aiAssessedScoreComponent = aiData?.aiPriorityScore || 0; 
  
  score = userSetPriorityComponent * 0.2; 
  score += dueDateComponent * effectivePrefs.urgencyWeight * 0.8; 
  score += aiAssessedScoreComponent * effectivePrefs.importanceWeight * 0.8; 

  const pUser = (priorityMap[task.priority] || 0) / 10; 
  const pDue = dueDateComponent / 10; 
  const pAi = (aiData?.aiPriorityScore || 0) / 10; 

  score = (0.2 * pUser) + (effectivePrefs.urgencyWeight * pDue) + (effectivePrefs.importanceWeight * pAi);
  
  let finalScore = 0;
  const prioPoints = { High: 3, Medium: 2, Low: 1 }[task.priority] || 0;
  
  let duePoints = 0;
  if (daysUntilDue < 0) duePoints = 3;
  else if (daysUntilDue <= (effectivePrefs.urgencyThresholdPreset === "1 day" ? 1 : effectivePrefs.urgencyThresholdPreset === "3 days" ? 3 : 7)) duePoints = (effectivePrefs.focus === "Deadlines" ? 3 : 2);
  else if (daysUntilDue <= 7) duePoints = (effectivePrefs.focus === "Deadlines" ? 2 : 1);
  else if (daysUntilDue <= 14) duePoints = 1;

  let aiPoints = 0;
  if(aiData?.aiPriorityScore) {
    if (aiData.aiPriorityScore >= 70) aiPoints = 3;
    else if (aiData.aiPriorityScore >= 40) aiPoints = 2;
    else aiPoints = 1;
  } else {
     aiPoints = 1; 
  }

  finalScore = prioPoints + duePoints + aiPoints;
  return Math.max(0, Math.min(finalScore, 11)); 
}


function mapScoreToPriorityLevel(score: number): PriorityLevel {
  if (score >= 7) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

function getEffectiveApiKeyAndSource(modelId: AIModelId, passedApiKey?: string): { effectiveApiKey?: string; apiKeySource: string } {
  const serverSideGoogleApiKey = process.env.GOOGLE_API_KEY;
  const serverSideXaiApiKey = process.env.XAI_API_KEY;
  
  let effectiveApiKey = passedApiKey;
  let apiKeySource = passedApiKey ? "settings" : "none";

  if (!effectiveApiKey) {
    if (modelId.startsWith('googleai/') && serverSideGoogleApiKey) {
      effectiveApiKey = serverSideGoogleApiKey;
      apiKeySource = "env_google";
    } else if (modelId.startsWith('xai/') && serverSideXaiApiKey) {
      effectiveApiKey = serverSideXaiApiKey;
      apiKeySource = "env_xai";
    }
  }
  return { effectiveApiKey, apiKeySource };
}

async function processSingleTaskWithAI(
  taskFields: {
    id: string;
    title: string;
    description: string;
    dueDate: Date;
    priority: PriorityLevel;
    category: TaskCategory;
    tags?: string[];
    status: TaskStatus;
    createdAt: Date;
    completedAt?: Date | null;
    instructions?: string;
    totalAICostForTask?: number; 
  },
  settings: SettingsValues,
  operationType: "create" | "update" | "reprioritize", 
  forceRegenerateTags: boolean = false,
  originalTitle?: string, // Used for tag generation logic if title changed
  originalDescription?: string // Used for tag generation logic if description changed
): Promise<{ task: DisplayTask; aiError?: string; apiKeyAvailable: boolean; aiProcessed: boolean }> {
  
  const modelToUse = settings.selectedAIModel || DEFAULT_AI_MODEL_ID;
  const priorityPrefs = settings.priorityPreferences || DEFAULT_PRIORITY_PREFERENCES;
  const userContextMessage = buildUserContextString(priorityPrefs);

  const { effectiveApiKey, apiKeySource } = getEffectiveApiKeyAndSource(modelToUse, settings.apiKey);
  const apiKeyIsAvailable = !!effectiveApiKey;
  
  let aiProcessedOverall = false;
  let aiErrorMessage: string | undefined = undefined;
  let generatedTags: string[] = taskFields.tags || [];
  let aiPrioritizationResultData: Omit<AIPrioritizationResult, 'combinedScore' | 'lastOperationCost'> | undefined; 
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const isSupportedModel = modelToUse.startsWith('googleai/') || modelToUse.startsWith('xai/');

  if (apiKeyIsAvailable && isSupportedModel) {
    const titleChanged = originalTitle !== undefined && taskFields.title !== originalTitle;
    const descriptionChanged = originalDescription !== undefined && taskFields.description !== originalDescription;
    
    const shouldGenerateTags = forceRegenerateTags || 
                             taskFields.id === "NEW_TASK_PLACEHOLDER_ID" || 
                             (taskFields.tags || []).length === 0 ||
                             (operationType === "update" && (titleChanged || descriptionChanged));


    if (shouldGenerateTags) {
      try {
        console.log(`Attempting to generate tags for task "${taskFields.title}" using model ${modelToUse} with API key from ${apiKeySource}...`);
        const tagGenInput: GenerateTaskTagsFlowInput = {
          title: taskFields.title,
          description: taskFields.description,
          modelId: modelToUse,
          apiKey: effectiveApiKey,
        };
        const tagGenOutput: AIFlowTagsOutput = await generateTaskTags(tagGenInput);
        generatedTags = tagGenOutput.tags || [];
        totalInputTokens += tagGenOutput.inputTokens || 0;
        totalOutputTokens += tagGenOutput.outputTokens || 0;
        console.log("Tags generated:", generatedTags, "Tokens:", {in: tagGenOutput.inputTokens, out: tagGenOutput.outputTokens});
      } catch (error: any) {
        const tagError = `Tag Generation Error: ${error.message}`;
        aiErrorMessage = tagError;
        console.error(tagError, error);
      }
    }

    try {
      console.log(`Attempting to prioritize task "${taskFields.title}" (Operation: ${operationType}) using model ${modelToUse} with API key from ${apiKeySource}...`);
      const taskDataForAI: AIFlowTaskData = {
        id: taskFields.id,
        title: taskFields.title,
        description: taskFields.description,
        dueDate: format(taskFields.dueDate, "yyyy-MM-dd"),
        priority: taskFields.priority,
        userId: MOCK_USER_ID,
        category: taskFields.category,
        tags: generatedTags,
      };

      let baseContext = userContextMessage;
      if(operationType === "create") {
        baseContext += " This is a new task. Consider the user-provided priority as a strong initial signal.";
      } else if (operationType === "update") {
        baseContext += " This task's details have been updated. Re-evaluate based on new information.";
      } else if (operationType === "reprioritize") {
         baseContext += " This task is being re-prioritized along with others. Evaluate its current standing.";
      }

      const prioritizationInput: PrioritizeTasksFlowInput = {
        task: taskDataForAI,
        userContext: baseContext,
        modelId: modelToUse,
        apiKey: effectiveApiKey,
      };
      const prioritizationOutput: AIFlowPrioritizeOutput = await prioritizeTasks(prioritizationInput);
      aiPrioritizationResultData = {
        aiPriorityScore: prioritizationOutput.aiPriorityScore,
        reasoning: prioritizationOutput.reasoning,
        suggestedAction: prioritizationOutput.suggestedAction,
        isVague: prioritizationOutput.isVague ?? false,
        inputTokens: prioritizationOutput.inputTokens, 
        outputTokens: prioritizationOutput.outputTokens,
      };
      totalInputTokens += prioritizationOutput.inputTokens || 0;
      totalOutputTokens += prioritizationOutput.outputTokens || 0;
      aiProcessedOverall = true;
      console.log("AI Prioritization successful:", prioritizationOutput, "Tokens:", {in: prioritizationOutput.inputTokens, out: prioritizationOutput.outputTokens});
    } catch (error: any) {
      console.error("Error during AI prioritization:", error);
      let specificError = error.message || "Unknown AI prioritization error";
      if (error.message && (error.message.includes('API key not valid') || error.message.includes('API_KEY_INVALID'))) {
        specificError = `AI Prioritization failed: Invalid or missing API Key. Ensure ${modelToUse.startsWith('googleai/') ? 'GOOGLE_API_KEY' : 'XAI_API_KEY'} is set on the server or a valid key is provided in settings for the selected model provider. (Source: ${apiKeySource})`;
      } else if (error.message && error.message.includes('quota')) {
        specificError = `AI Prioritization failed: Quota exceeded. ${error.message}.`;
      } else if (error.message && (error.message.includes('NOT_FOUND') || error.message.includes('Could not find model'))) {
        specificError = `AI Prioritization failed: Model '${modelToUse}' not found or access denied. Please check API key permissions or try a different model in settings. Original error: ${error.message}`;
      }
      const prioritizationErrorMsg = `Prioritization Error: ${specificError}`;
      aiErrorMessage = aiErrorMessage ? `${aiErrorMessage}. ${prioritizationErrorMsg}` : prioritizationErrorMsg;
      aiPrioritizationResultData = undefined;
    }

  } else if (!isSupportedModel) {
    aiErrorMessage = `AI features for model '${modelToUse}' are not integrated or model provider is unsupported. Task processed without AI features.`;
    console.warn(aiErrorMessage);
  } else { 
    aiErrorMessage = `API Key not available for model ${modelToUse} (source: ${apiKeySource}). AI features skipped.`;
    console.warn(aiErrorMessage);
  }

  const rawTask: Task = {
    id: taskFields.id,
    title: taskFields.title,
    description: taskFields.description,
    dueDate: taskFields.dueDate,
    priority: taskFields.priority,
    category: taskFields.category,
    tags: generatedTags,
    status: taskFields.status,
    createdAt: taskFields.createdAt,
    completedAt: taskFields.completedAt,
    instructions: taskFields.instructions,
  };

  const lastOperationCost = calculateAICost(modelToUse, totalInputTokens, totalOutputTokens);
  const newTotalAICostForTask = (taskFields.totalAICostForTask || 0) + lastOperationCost;

  const combinedScore = calculateCombinedScore(rawTask, aiPrioritizationResultData ? { ...aiPrioritizationResultData, combinedScore:0, lastOperationCost } : undefined, priorityPrefs); 
  
  const finalPriority = aiProcessedOverall && aiPrioritizationResultData
                        ? mapScoreToPriorityLevel(combinedScore)
                        : rawTask.priority;

  const finalAiData: AIPrioritizationResult | undefined = aiPrioritizationResultData
    ? { 
        ...aiPrioritizationResultData, 
        combinedScore, 
        lastOperationCost,
        inputTokens: totalInputTokens, 
        outputTokens: totalOutputTokens,
      }
    : {
        aiPriorityScore: 0,
        reasoning: aiErrorMessage || (apiKeyIsAvailable && isSupportedModel ? "AI processing not fully completed or failed." : `AI features skipped or model '${modelToUse}' is not supported.`),
        suggestedAction: "Review manually.",
        combinedScore, 
        isVague: false,
        lastOperationCost, 
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      };

  const processedTask: DisplayTask = {
    ...rawTask,
    priority: finalPriority,
    aiData: finalAiData,
    totalAICostForTask: newTotalAICostForTask,
  };

  return { task: processedTask, aiError: aiErrorMessage, apiKeyAvailable: apiKeyIsAvailable, aiProcessed: aiProcessedOverall };
}


export async function createTaskWithAIPrioritization(
  formData: TaskFormData,
  settings: SettingsValues
): Promise<CreateTaskResult> {
  const taskId = crypto.randomUUID();
  if (!taskId) {
    return { error: "Failed to generate task ID.", apiKeyAvailable: false, aiProcessed: false };
  }

  const taskFields = {
    id: taskId, 
    title: formData.title,
    description: formData.description,
    dueDate: formData.dueDate,
    priority: formData.priority,
    category: formData.category,
    tags: formData.tags || [],
    status: "Pending" as TaskStatus,
    createdAt: new Date(),
    completedAt: null,
    instructions: undefined, 
    totalAICostForTask: 0, 
  };

  const result = await processSingleTaskWithAI(
    taskFields,
    settings,
    "create",
    true 
  );

  const webhookTargetUrl = settings.n8nWebhookUrl || process.env.N8N_WEBHOOK_URL;
  if (webhookTargetUrl && result.task) {
    await sendToWebhook(result.task, webhookTargetUrl, 'task_created');
  } else if (!webhookTargetUrl) {
    console.log('N8N Webhook URL not provided for createTask. Skipping webhook.');
  }

  return { task: result.task, error: result.error, aiError: result.aiError, apiKeyAvailable: result.apiKeyAvailable, aiProcessed: result.aiProcessed };
}


export async function updateTaskDetailsAndReprioritize(
  taskId: string,
  updatedFormData: TaskFormData,
  originalTask: DisplayTask, // Pass the full original task
  settings: SettingsValues
): Promise<UpdateTaskResult> {
  
  const updatedTaskFields = {
    ...originalTask, // Spread original task to retain createdAt, status, etc.
    id: taskId, // Ensure ID is correct
    title: updatedFormData.title,
    description: updatedFormData.description,
    dueDate: updatedFormData.dueDate,
    priority: updatedFormData.priority,
    category: updatedFormData.category,
    tags: updatedFormData.tags || originalTask.tags || [], // Use new tags if provided, else old, else empty
    totalAICostForTask: originalTask.totalAICostForTask || 0, 
  };

  const result = await processSingleTaskWithAI(
    updatedTaskFields,
    settings,
    "update",
    true, // Force regenerate tags if title/description changed (handled inside processSingleTaskWithAI)
    originalTask.title,
    originalTask.description
  );
  
  const webhookTargetUrl = settings.n8nWebhookUrl || process.env.N8N_WEBHOOK_URL;
  if (webhookTargetUrl && result.task) {
    await sendToWebhook(result.task, webhookTargetUrl, 'task_updated'); 
  } else if (!webhookTargetUrl) {
    console.log('N8N Webhook URL not provided for updateTask. Skipping webhook.');
  }
  
  return { task: result.task, error: result.error, aiError: result.aiError, apiKeyAvailable: result.apiKeyAvailable, aiProcessed: result.aiProcessed };
}


export async function reprioritizeAllTasksWithAI(
  currentTasks: DisplayTask[],
  settings: SettingsValues
): Promise<ReprioritizeAllResult> {
  
  const modelToUse = settings.selectedAIModel || DEFAULT_AI_MODEL_ID;
  const priorityPrefs = settings.priorityPreferences || DEFAULT_PRIORITY_PREFERENCES;
  const userContextMessage = buildUserContextString(priorityPrefs);

  const { effectiveApiKey, apiKeySource } = getEffectiveApiKeyAndSource(modelToUse, settings.apiKey);
  const apiKeyIsAvailable = !!effectiveApiKey;

  const pendingTasks = currentTasks.filter(t => t.status === "Pending");
  const totalTasksToProcess = pendingTasks.length;
  let aiProcessedCount = 0;
  const aiErrorMessages: string[] = [];
  const updatedTasks: DisplayTask[] = [...currentTasks.filter(t => t.status === "Completed")];
  let currentBatchAICost = 0;
  
  const isSupportedModelForReprio = modelToUse.startsWith('googleai/') || modelToUse.startsWith('xai/');

  if (!apiKeyIsAvailable && totalTasksToProcess > 0 && isSupportedModelForReprio) {
    const processedPendingTasks = pendingTasks.map(task => {
        const combinedScore = calculateCombinedScore(task, task.aiData, priorityPrefs);
        return {
            ...task,
            aiData: task.aiData ? 
                    {...task.aiData, combinedScore, isVague: task.aiData.isVague ?? false } : 
                    { 
                        aiPriorityScore: 0, 
                        reasoning: `API key missing (source: ${apiKeySource}). AI re-prioritization cannot be performed for model ${modelToUse}.`, 
                        suggestedAction: "Review manually.",
                        combinedScore,
                        isVague: false,
                        lastOperationCost: 0,
                        inputTokens: 0,
                        outputTokens: 0,
                    }
        };
    });
    updatedTasks.push(...processedPendingTasks);
    return {
      tasks: updatedTasks,
      error: `API Key not available (source: ${apiKeySource}) for model ${modelToUse}. AI re-prioritization cannot be performed for pending tasks.`,
      apiKeyAvailable: apiKeyIsAvailable,
      aiProcessedCount: 0,
      totalTasks: totalTasksToProcess,
      aiErrorMessages: [`API Key missing for all pending tasks requiring model ${modelToUse} (source: ${apiKeySource}).`],
      batchAICost: 0,
    };
  }

  for (const task of pendingTasks) {
    let prioritizationOutputFromAI: AIFlowPrioritizeOutput | undefined = undefined; 
    let resultingPriority: PriorityLevel = task.priority; 
    let resultingAiData: AIPrioritizationResult = task.aiData || { 
        aiPriorityScore:0, reasoning:"", suggestedAction:"", combinedScore:0, isVague:false, lastOperationCost:0, inputTokens:0, outputTokens:0
    }; 
    let taskInputTokens = 0;
    let taskOutputTokens = 0;

    if (apiKeyIsAvailable && isSupportedModelForReprio) {
        try {
          console.log(`Re-prioritizing task "${task.title}" with AI model ${modelToUse} (API key from ${apiKeySource})...`);
          const taskDataForAI: AIFlowTaskData = {
              id: task.id,
              title: task.title,
              description: task.description,
              dueDate: format(new Date(task.dueDate), "yyyy-MM-dd"),
              priority: task.priority, 
              userId: MOCK_USER_ID,
              category: task.category,
              tags: task.tags || [], 
          };
          const prioritizationInput: PrioritizeTasksFlowInput = {
              task: taskDataForAI,
              userContext: userContextMessage + " This task is part of a bulk re-prioritization. Evaluate its current standing based on all available information and user preferences.",
              modelId: modelToUse,
              apiKey: effectiveApiKey,
          };
          prioritizationOutputFromAI = await prioritizeTasks(prioritizationInput);
          
          taskInputTokens = prioritizationOutputFromAI.inputTokens || 0;
          taskOutputTokens = prioritizationOutputFromAI.outputTokens || 0;
          
          const operationCost = calculateAICost(modelToUse, taskInputTokens, taskOutputTokens);
          currentBatchAICost += operationCost;

          aiProcessedCount++;
          console.log(`AI re-prioritization successful for "${task.title}":`, prioritizationOutputFromAI, `Cost: ${operationCost}`);
          
          const currentCombinedScore = calculateCombinedScore(task, {
            ...prioritizationOutputFromAI, 
            combinedScore: 0, 
            lastOperationCost: operationCost,
            inputTokens: taskInputTokens,
            outputTokens: taskOutputTokens
          }, priorityPrefs);
          resultingPriority = mapScoreToPriorityLevel(currentCombinedScore);
          resultingAiData = { 
            ...prioritizationOutputFromAI, 
            isVague: prioritizationOutputFromAI.isVague ?? false,
            combinedScore: currentCombinedScore, 
            lastOperationCost: operationCost,
            inputTokens: taskInputTokens,
            outputTokens: taskOutputTokens,
          };

        } catch (error: any) {
            let baseErrorMessage = error.message || "Unknown AI error";
            if (error.message?.includes('API key not valid') || error.message?.includes('API_KEY_INVALID')) {
                baseErrorMessage = `Invalid or missing API Key (source: ${apiKeySource}). Ensure ${modelToUse.startsWith('googleai/') ? 'GOOGLE_API_KEY' : 'XAI_API_KEY'} is set on the server or a valid key is provided in settings for the selected model provider.`;
            } else if (error.message?.includes('quota')) {
                baseErrorMessage = `API quota exceeded. ${error.message}`;
            } else if (error.message && (error.message.includes('NOT_FOUND') || error.message.includes('Could not find model'))) {
                 baseErrorMessage = `AI Model '${modelToUse}' not found or access denied. Please check your API key permissions, selected model in app settings, or try a different model. Original error: ${error.message}`;
            }
            const taskSpecificAiError = `Task "${task.title}": ${baseErrorMessage}`;
            aiErrorMessages.push(taskSpecificAiError);
            console.error(`Error re-prioritizing task "${task.title}":`, error);
            
            const existingCombinedScore = task.aiData ? (task.aiData.combinedScore ?? calculateCombinedScore(task, task.aiData, priorityPrefs)) : calculateCombinedScore(task, undefined, priorityPrefs);
            resultingPriority = task.priority; 
            resultingAiData = task.aiData ? 
              { ...task.aiData, reasoning: `${task.aiData.reasoning ? task.aiData.reasoning + ". " : ""}Reprioritization attempt failed: ${baseErrorMessage}`, combinedScore: existingCombinedScore, isVague: task.aiData.isVague ?? false, lastOperationCost: 0, inputTokens:0, outputTokens:0 } : 
              {
                  aiPriorityScore: 0,
                  reasoning: `AI re-prioritization attempt failed: ${baseErrorMessage}`,
                  suggestedAction: "Review manually.",
                  combinedScore: existingCombinedScore,
                  isVague: false, 
                  lastOperationCost: 0,
                  inputTokens:0, 
                  outputTokens:0,
              };
        }
    } else { 
        const combinedScore = calculateCombinedScore(task, task.aiData, priorityPrefs);
        resultingPriority = task.priority; 
        let reasoningText = "Review manually.";
        if (!isSupportedModelForReprio) {
            reasoningText = `AI processing skipped for model '${modelToUse}' (unsupported provider or requires specific Genkit plugin).`;
            aiErrorMessages.push(`Task "${task.title}": Skipped AI re-prioritization for unsupported model '${modelToUse}'.`);
        } else if (!apiKeyIsAvailable) { 
            reasoningText = `API key not available (source: ${apiKeySource}) for model ${modelToUse}. AI processing skipped for re-prioritization.`;
            aiErrorMessages.push(`Task "${task.title}": Skipped AI re-prioritization due to missing API key for model ${modelToUse} (source: ${apiKeySource}).`);
        }

        resultingAiData = task.aiData ? 
          { ...task.aiData, combinedScore, reasoning: task.aiData.reasoning || reasoningText, isVague: task.aiData.isVague ?? false, lastOperationCost: 0 } : 
          {
              aiPriorityScore: 0,
              reasoning: reasoningText,
              suggestedAction: "Review manually.",
              combinedScore,
              isVague: false,
              lastOperationCost: 0,
              inputTokens:0,
              outputTokens:0,
          };
    }
    
    const updatedTask = {
      ...task,
      priority: resultingPriority,
      aiData: resultingAiData,
      totalAICostForTask: (task.totalAICostForTask || 0) + (resultingAiData.lastOperationCost || 0),
    };
    updatedTasks.push(updatedTask);
    
    const webhookTargetUrl = settings.n8nWebhookUrl || process.env.N8N_WEBHOOK_URL;
    if (webhookTargetUrl) {
      await sendToWebhook(updatedTask, webhookTargetUrl, 'task_reprioritized_bulk'); 
    }

  }
  console.log(`Bulk re-prioritization: ${aiProcessedCount}/${totalTasksToProcess} pending tasks AI-processed. Batch cost: $${currentBatchAICost.toFixed(6)}. Errors: ${aiErrorMessages.length}`);
  return {
    tasks: updatedTasks,
    apiKeyAvailable: apiKeyIsAvailable,
    aiProcessedCount,
    totalTasks: totalTasksToProcess, 
    aiErrorMessages,
    batchAICost: currentBatchAICost,
  };
}
