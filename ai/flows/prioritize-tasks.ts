
'use server';
/**
 * @fileOverview A task prioritization AI agent.
 *
 * - prioritizeTasks - A function that handles the task prioritization process.
 */
import {ai} from '@/ai/genkit';
import { DEFAULT_AI_MODEL_ID } from '@/lib/types';
import {
  PrioritizeTasksPromptDataSchema,
  PrioritizeTasksFlowInputSchema,
  type PrioritizeTasksFlowInput,
  PrioritizeTasksOutputSchema,
  type PrioritizeTasksOutput,
  type AIFlowTaskData, 
} from '@/ai/schemas';

export async function prioritizeTasks(input: PrioritizeTasksFlowInput): Promise<PrioritizeTasksOutput> {
  return prioritizeTasksFlow(input);
}

const prioritizeTasksPrompt = ai.definePrompt({
  name: 'prioritizeTasksPrompt',
  input: {schema: PrioritizeTasksPromptDataSchema},
  output: {schema: PrioritizeTasksOutputSchema.omit({ inputTokens: true, outputTokens: true })}, 
  prompt: `You are an AI task prioritization expert. Your goal is to help users manage their tasks effectively by providing an objective AI-driven priority assessment.

User's Prioritization Preferences & Context:
{{{userContext}}}

Analyze the following task details:
  Task Title: {{{task.title}}}
  Task Description: {{{task.description}}}
  Task Category: {{{task.category}}}
  Task Tags: {{#if task.tags.length}}{{#each task.tags}}#{{this}} {{/each}}{{else}}No tags provided.{{/if}}
  Due Date: {{{task.dueDate}}}
  User Priority: {{{task.priority}}}

Based on ALL the information above (task details AND user preferences), you will determine:
1.  An 'aiPriorityScore' (an integer between 0 and 100, where 100 is highest priority). This score should reflect the user's stated preferences. For example, if user prioritizes "Deadlines" and set "1 day" as urgent, a task due tomorrow should get a very high score, even if its content seems less critical than another task with a farther due date.
2.  A 'reasoning' (a concise explanation for your score, mentioning how user preferences influenced it if applicable).
3.  A 'suggestedAction' (a concrete next step for the user).
4.  An 'isVague' flag (boolean, true ONLY if the task is extremely unclear and needs more details).

Key Considerations (incorporating user preferences):

1.  **User Preferences are Paramount**:
    *   The 'User's Prioritization Preferences & Context' section is your primary guide. Your scoring must align with these preferences.
    *   If user focuses on "Deadlines" with a specific threshold (e.g., "1 day"), tasks meeting that threshold get top priority.
    *   If user focuses on "Importance" with specific aspects (e.g., "Work/Career"), tasks matching those aspects (identified via title, description, category) get higher priority.
    *   If user focuses on "Categories", tasks in their preferred categories get higher priority.
    *   If user provided "Keywords", their presence in title/description significantly boosts priority.

2.  **Semantic Urgency and Importance (within preference framework)**:
    *   Keywords like "urgent", "critical", "blocker", "ASAP", "emergency", "dying", "very hungry", "immediately", "deadline approaching", "crucial", "baby on the way" are still important, especially if they align with or amplify user preferences (e.g., user focuses on importance and task says "critical client issue").
    *   If user preferences are "Balanced" or don't strongly contradict, these semantic cues carry significant weight. A task with "baby on the way" or "very hungry dying" should always receive a very high score, reflecting extreme urgency.

3.  **Due Date (interpreted by preferences)**:
    *   If focus is "Deadlines", due date is the dominant factor.
    *   Otherwise, due date is a secondary factor, but still considered. An extremely urgent task ("baby on the way") with a near due date is still very high priority even if user focus is "Categories" and this isn't a preferred one.

4.  **User-Assigned Priority (as input, not override)**:
    *   Consider the user's priority as one piece of input. Your AI score should reflect a holistic assessment based on user *preferences* and task content. If AI score differs significantly, explain why in reasoning, linking back to preferences.

5.  **Task Clarity and Detail (isVague flag)**:
    *   The 'isVague' flag should ONLY be set to \`true\` if the task title AND description, when considered together, are extremely uninformative, nonsensical, or purely gibberish, making it impossible to determine a reasonable course of action or priority, even considering user preferences.
    *   Examples of tasks that ARE VAGUE: Title: "3133", Description: "3333333"; Title: "asdf", Description: "qwert".
    *   Examples of tasks that ARE NOT VAGUE (even if brief): Title: "Pay mortgage", Description: "Monthly payment"; Title: "Call John"; Title: "Stone formation", Description: "get stone".
    *   If 'isVague' is \`true\`: Your 'suggestedAction' MUST be: "This task is unclear. Please add more details to the title and/or description for better prioritization." 'aiPriorityScore' should be low (0-15).
    *   If 'isVague' is \`false\` but task could benefit from more detail for *optimal* prioritization (e.g., "Pay mortgage" could benefit from amount/method), you can still provide a 'suggestedAction' like "Consider adding specific details (e.g., amount, payment method) for a more precise assessment.", but ensure 'isVague' is \`false\`.


Example with User Preference "Deadlines - 1 day":
  - User Context: "User's primary prioritization focus is 'Deadlines'. They consider tasks due within '1 day' as particularly urgent."
  - Task Title: "Submit report"
  - Due Date: Tomorrow
  - Your Assessment: aiPriorityScore very high (e.g., 95-100) because it matches the user's primary urgency criterion. Reasoning: "High priority as task is due tomorrow, aligning with user's preference for 1-day deadlines."

Example with User Preference "Importance - Work/Career":
  - User Context: "User's primary prioritization focus is 'Importance'. Key aspects of importance for them include: 'Work/Career'."
  - Task Title: "Prepare client presentation"
  - Category: Work
  - Due Date: Next week
  - Your Assessment: aiPriorityScore high (e.g., 80-90) because it's a "Work/Career" task, matching user's importance focus. Reasoning: "High priority as this is a work-related task, aligning with user's focus on career impact."

Ensure your response strictly adheres to the JSON output schema provided.
For 'aiPriorityScore', provide an integer between 0 and 100. Tasks with phrases like "very hungry dying" or "baby on the way" should get scores of 95-100 regardless of other factors unless user context explicitly downplays them.
For 'reasoning', provide a concise explanation for your scoring, referencing user preferences where applicable.
For 'suggestedAction', suggest a concrete next step for the user.
For 'isVague', provide a boolean value.`,
});

const prioritizeTasksFlow = ai.defineFlow(
  {
    name: 'prioritizeTasksFlow',
    inputSchema: PrioritizeTasksFlowInputSchema,
    outputSchema: PrioritizeTasksOutputSchema, 
  },
  async (input: PrioritizeTasksFlowInput): Promise<PrioritizeTasksOutput> => {
    const promptData: { task: AIFlowTaskData; userContext?: string } = { 
      task: input.task,
      userContext: input.userContext || "User has not specified any particular prioritization preferences. Use general best practices.", // Default context
    };
    const modelToUse = input.modelId || DEFAULT_AI_MODEL_ID;
    const apiKeyToUse = input.apiKey; 

    if (!modelToUse.startsWith('googleai/') && !modelToUse.startsWith('xai/')) {
      console.warn(`Attempting to use model '${modelToUse}' from an unsupported provider for prioritization. This will likely fail.`);
    }

    console.log(`Prioritizing task "${input.task.title}" using model: ${modelToUse}. User Context: ${promptData.userContext}`);
    if (apiKeyToUse) {
      console.log("Using API key provided in flow input for task prioritization.");
    } else if (process.env.GOOGLE_API_KEY && modelToUse.startsWith('googleai/')) {
      console.log("Using GOOGLE_API_KEY from environment for task prioritization (Google model).");
    } else if (process.env.XAI_API_KEY && modelToUse.startsWith('xai/')) {
      console.log("Using XAI_API_KEY from environment for task prioritization (XAI model).");
    } else if (modelToUse.startsWith('googleai/')) {
      console.warn("No API key available for Google AI task prioritization (neither settings nor GOOGLE_API_KEY env var). AI call will likely fail.");
    } else if (modelToUse.startsWith('xai/')) {
      console.warn("No API key available for XAI task prioritization (neither settings nor XAI_API_KEY env var). AI call will likely fail.");
    }

    const result = await prioritizeTasksPrompt(promptData, { model: modelToUse, apiKey: apiKeyToUse });
    const output = result.output;
    const usage = result.usage;
    
    if (!output) {
      throw new Error('AI response was empty or not in the expected JSON format for prioritization.');
    }
    
    return { 
      ...output, 
      isVague: output.isVague ?? false,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
    };
  }
);
