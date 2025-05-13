export type PriorityLevel = "Low" | "Medium" | "High";
export type TaskStatus = "Pending" | "Completed";

export type TaskCategory = "Work" | "Personal" | "Learning" | "Health" | "Finance" | "Home Chores" | "Errands" | "Other";

export const PREDEFINED_CATEGORIES: TaskCategory[] = [
  "Work",
  "Personal",
  "Learning",
  "Health",
  "Finance",
  "Home Chores",
  "Errands",
  "Other",
];

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  priority: PriorityLevel;
  status: TaskStatus;
  category: TaskCategory;
  tags: string[];
  createdAt: Date; 
  completedAt?: Date | null;
  instructions?: string; // From n8n if applicable
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface AIPrioritizationResult extends TokenUsage {
  aiPriorityScore: number;
  reasoning: string;
  suggestedAction: string;
  combinedScore: number;
  isVague?: boolean;
  lastOperationCost?: number; // Cost of the last AI operation (prioritization + tags for this task)
}

export interface DisplayTask extends Task {
  aiData?: AIPrioritizationResult;
  totalAICostForTask?: number; // Cumulative AI cost for this task over its lifetime
}

// This is specifically for data sent TO the AI flow, not the main app's Task type
export interface AIFlowTaskData { // Renamed from TaskData to avoid confusion
  id: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD format for AI
  priority: PriorityLevel | string; // AI flow can receive string
  userId: string; // Mocked for now
  category: TaskCategory | string; // AI flow can receive string
  tags: string[];
}


export interface TaskFormData {
  title: string;
  description: string;
  dueDate: Date;
  priority: PriorityLevel;
  category: TaskCategory;
  tags?: string[];
}

export interface TokenPricingDetail {
  usd: number;
  perTokens: number; 
  notes?: string; 
}

export interface AIModelPricing {
  input?: TokenPricingDetail;
  output?: TokenPricingDetail;
  // For Gemini 1.5 Pro/Flash style tiered pricing based on context window
  inputStandardContextLt128k?: TokenPricingDetail; 
  outputStandardContextLt128k?: TokenPricingDetail;
  inputStandardContextGt128k?: TokenPricingDetail; 
  outputStandardContextGt128k?: TokenPricingDetail;
  // For audio or specific output types like Gemini 2.5 Flash (renamed from gemini-2.5-flash to match actual naming)
  inputAudio?: TokenPricingDetail; // For direct audio input if supported by model
  outputNoThinking?: TokenPricingDetail; // Specific to models like Gemini 2.5 Flash for simple outputs
  outputWithThinking?: TokenPricingDetail; // Specific to models like Gemini 2.5 Flash for complex outputs
  tuning?: TokenPricingDetail; // For fine-tuning costs
  notes?: string; // General notes for the pricing model
}

export interface AIModelInfo {
  id: string;
  name: string;
  provider: 'Google' | 'XAI' | 'Other';
  pricing: AIModelPricing;
  pricingSummary: string[]; // Short summary for UI
  notes: string; // Additional notes for UI
  isDefault?: boolean;
}

// Updated pricing details and model names as per user's latest request
export const SUPPORTED_AI_MODELS: AIModelInfo[] = [
  {
    id: 'googleai/gemini-1.5-flash-latest' as const, 
    name: 'Gemini 1.5 Flash (Google - Default)',
    provider: 'Google',
    isDefault: true,
    pricing: {
      inputStandardContextLt128k: { usd: 0.35, perTokens: 1000000 }, 
      outputStandardContextLt128k: { usd: 0.70, perTokens: 1000000 }, 
      inputStandardContextGt128k: { usd: 0.70, perTokens: 1000000 },
      outputStandardContextGt128k: { usd: 1.40, perTokens: 1000000 },
    },
    pricingSummary: [
      "Input (<128K tokens): $0.35 / 1M tokens",
      "Output (<128K tokens): $0.70 / 1M tokens",
      "Input (>128K tokens): $0.70 / 1M tokens",
      "Output (>128K tokens): $1.40 / 1M tokens",
    ],
    notes: 'Fast & cost-effective. Free tier may apply.',
  },
  {
    id: 'googleai/gemini-1.5-pro-latest' as const, 
    name: 'Gemini 1.5 Pro (Google)',
    provider: 'Google',
    pricing: {
      inputStandardContextLt128k: { usd: 3.50, perTokens: 1000000 },
      outputStandardContextLt128k: { usd: 10.50, perTokens: 1000000 },
      inputStandardContextGt128k: { usd: 7.00, perTokens: 1000000 },
      outputStandardContextGt128k: { usd: 21.00, perTokens: 1000000 },
    },
    pricingSummary: [
      "Input (<128K tokens): $3.50 / 1M tokens",
      "Output (<128K tokens): $10.50 / 1M tokens",
      "Input (>128K tokens): $7.00 / 1M tokens",
      "Output (>128K tokens): $21.00 / 1M tokens",
    ],
    notes: 'Most capable model. Free tier may apply.',
  },
   {
    id: 'xai/grok-1' as const, // Placeholder - check correct Genkit ID for Grok-1
    name: 'Grok-1 (XAI)',
    provider: 'XAI',
    pricing: { 
      input: { usd: 1.00, perTokens: 1000000, notes: "Illustrative placeholder" }, 
      output: { usd: 1.00, perTokens: 1000000, notes: "Illustrative placeholder" }, 
    },
    pricingSummary: [
      "Input: (Check XAI for current rates - placeholder: ~$1/1M tokens)",
      "Output: (Check XAI for current rates - placeholder: ~$1/1M tokens)",
    ],
    notes: 'Requires XAI API Key and Genkit XAI plugin. Pricing is illustrative and subject to XAI terms. XAI typically charges per character or via subscription tiers.',
  },
];

const defaultModel = SUPPORTED_AI_MODELS.find(m => m.isDefault) || SUPPORTED_AI_MODELS[0];
export const DEFAULT_AI_MODEL_ID: AIModelId = defaultModel ? defaultModel.id : (SUPPORTED_AI_MODELS[0]?.id || 'googleai/gemini-1.5-flash-latest') as AIModelId;

const modelIds = SUPPORTED_AI_MODELS.map(m => m.id) as [string, ...string[]];
if (modelIds.length === 0) {
  modelIds.push(DEFAULT_AI_MODEL_ID as any); 
}
export const ALL_MODEL_IDS_ENUM = modelIds;
export type AIModelId = typeof SUPPORTED_AI_MODELS[number]['id'];


export type PriorityFocus = "Deadlines" | "Importance" | "Categories" | "Balanced";
export type UrgencyThresholdPreset = "1 day" | "3 days" | "1 week";
export type ImportanceAspectPreset = "Work/Career" | "Affecting Others" | "High Stakes";

export interface PriorityPreferences {
  focus: PriorityFocus;
  urgencyThresholdPreset?: UrgencyThresholdPreset;
  importanceAspectPreset?: ImportanceAspectPreset;
  preferredCategories?: TaskCategory[]; 
  customKeywords?: string[];
  urgencyWeight: number;
  importanceWeight: number;
}

export interface SettingsValues {
  n8nWebhookUrl?: string; // Outgoing: App -> n8n
  apiKey?: string; // For Genkit AI (Gemini/XAI)
  openaiApiKey?: string; // For OpenAI Whisper
  selectedAIModel?: AIModelId;
  priorityPreferences?: PriorityPreferences;
  n8nUserConfiguredIncomingHeaderName?: string; // For Incoming: n8n -> App (Header Name)
  n8nUserConfiguredIncomingSecret?: string;   // For Incoming: n8n -> App (Header Secret Value)
  confirmTaskCreation?: boolean; // Added confirmation setting
}

export const DEFAULT_PRIORITY_PREFERENCES: PriorityPreferences = {
  focus: "Balanced",
  urgencyWeight: 0.4, 
  importanceWeight: 0.6, 
  customKeywords: ["urgent", "deadline", "critical", "blocker"],
};

export const DEFAULT_SETTINGS: SettingsValues = {
  n8nWebhookUrl: "",
  apiKey: "", 
  selectedAIModel: DEFAULT_AI_MODEL_ID,
  priorityPreferences: DEFAULT_PRIORITY_PREFERENCES, 
  openaiApiKey: "", 
  n8nUserConfiguredIncomingHeaderName: 'X-TaskHook-Secret', // Updated default header name
  n8nUserConfiguredIncomingSecret: '', // Default empty secret
  confirmTaskCreation: false, // Default to false
};


export type Timeframe = "Today" | "ThisWeek" | "NextTwoWeeks" | "ThisMonth" | "PastUncompleted" | "MostImportant" | "All";
export type AccordionSectionKey = "today" | "thisWeek" | "nextTwoWeeks" | "thisMonth" | "completedTasks" | "pastUncompleted";
export type ReprioritizationScope = "All" | "ThisMonth" | "NextTwoWeeks" | "Today";
