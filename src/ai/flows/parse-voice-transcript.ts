
'use server';
/**
 * @fileOverview An AI agent for parsing a full voice transcript into multiple tasks.
 *
 * - parseVoiceTranscript - A function that handles transcript parsing.
 * - ParseVoiceTranscriptInput - The input type for the parseVoiceTranscript function.
 * - ParseVoiceTranscriptOutput - The return type for the parseVoiceTranscript function.
 */

import {ai} from '@/ai/genkit';
import { DEFAULT_AI_MODEL_ID } from '@/lib/types';
import {
  ParseVoiceTranscriptInputSchema,
  type ParseVoiceTranscriptInput,
  ParseVoiceTranscriptOutputSchema,
  type ParseVoiceTranscriptOutput,
} from '@/ai/schemas';
import { format, addDays, nextDay, Day } from 'date-fns';


// Export the wrapper function
export async function parseVoiceTranscript(input: ParseVoiceTranscriptInput): Promise<ParseVoiceTranscriptOutput> {
  return parseVoiceTranscriptFlow(input);
}

// Helper to get current date and relative dates for prompt examples
const getFormattedDate = (offsetDays: number = 0, baseDate: Date = new Date()): string => {
  const targetDate = new Date(baseDate);
  targetDate.setDate(baseDate.getDate() + offsetDays);
  return format(targetDate, 'yyyy-MM-dd');
};

const todayStr = getFormattedDate(0);
const tomorrowStr = getFormattedDate(1);

// Helper to find next specific day of the week (e.g., next Monday)
const getNextDayOfWeek = (day: Day, baseDate: Date = new Date()): string => {
  return format(nextDay(baseDate, day), 'yyyy-MM-dd'); // Corrected to yyyy-MM-dd
};

const nextMondayStr = getNextDayOfWeek(1); // 1 for Monday
const fiveDaysLaterStr = getFormattedDate(5);
const twoWeeksLaterStr = getFormattedDate(14);


const parseTranscriptPrompt = ai.definePrompt({
  name: 'parseVoiceTranscriptPrompt',
  input: {schema: ParseVoiceTranscriptInputSchema.pick({ fullTranscript: true })},
  output: {schema: ParseVoiceTranscriptOutputSchema.pick({ parsedTasks: true })},
  prompt: `You are an intelligent task assistant. Your goal is to parse the given full transcript of a user's voice input and split it into one or more distinct tasks.

For each identified task, you MUST provide:
1.  'title': A concise and clear title for the task (e.g., "Buy 2 bags of potatoes", "Call John about the project"). The title should capture the main action and key details, BUT EXCLUDE ANY DATE/TIME PHRASES (like "tomorrow", "next week", "in 5 days").
2.  'description': The original segment of the transcript that pertains to this specific task, or a slightly cleaned up version if necessary for clarity, BUT EXCLUDE ANY DATE/TIME PHRASES. This description should provide full context of WHAT needs to be done. If the original transcript implies a shared context for multiple tasks (e.g., "Buy X for today and Y for next week"), ensure the description for each task contains that shared context, minus the date/time part. For example, if transcript is "Buy 2kg sausages tomorrow and 5kg next week same day", the description for the second task should be something like "Buy 5kg sausages".
3.  'dueDate': The due date for the task, if mentioned. Format this strictly as YYYY-MM-DD. If no specific date is mentioned, or if it's ambiguous (e.g., "soon"), set dueDate to an empty string "". Use today's date (${todayStr}) as the reference for relative dates like "tomorrow", "next week". For phrases like "after X days" or "X days later" from a previous date mentioned in the transcript, calculate the date relative to that *previous* date.

Full Transcript:
"{{{fullTranscript}}}"

Important Instructions:
- If the transcript contains multiple distinct actions or items, split them into separate task objects in the JSON array.
- If a common action applies to multiple items with different timings (e.g., "Buy X for today and Y for next week"), create separate tasks for each. Ensure the full context of the action (what is being bought/done) is present in each task's title and description, WITHOUT the date/time phrases.
- If the transcript is very short and clearly a single task, return a single task object in the array.
- If no tasks can be clearly identified, or the transcript is nonsensical, return an empty array for 'parsedTasks'.
- Ensure the output is a valid JSON array of objects adhering to the structure: { "title": "string (no dates)", "description": "string (no dates)", "dueDate": "YYYY-MM-DD" or "" }.

Example 1 (Shared context, relative dates):
Transcript: "Remind me to buy 1 kg of sausages tomorrow and next week the same day 5 kg."
Expected JSON Output for 'parsedTasks' (assuming today is ${todayStr}):
[
  {
    "title": "Buy 1 kg of sausages",
    "description": "Remind me to buy 1 kg of sausages",
    "dueDate": "${tomorrowStr}"
  },
  {
    "title": "Buy 5 kg of sausages",
    "description": "Buy 5 kg of sausages",
    "dueDate": "${getFormattedDate(7, new Date(tomorrowStr))}" 
  }
]

Example 2 (Shared context, different timings):
Transcript: "Buy 2 bags of potatoes, one for today and one for 5 days later."
Expected JSON Output for 'parsedTasks' (assuming today is ${todayStr}):
[
  {
    "title": "Buy 2 bags of potatoes",
    "description": "Buy 2 bags of potatoes, one",
    "dueDate": "${todayStr}"
  },
  {
    "title": "Buy 2 bags of potatoes",
    "description": "Buy 2 bags of potatoes, one",
    "dueDate": "${fiveDaysLaterStr}"
  }
]

Example 3 (Distinct actions, cleaning titles/descriptions):
Transcript: "Remind me to buy 2 liters of water for next week Monday and after 2 weeks to buy 5 tons of concrete."
Expected JSON Output for 'parsedTasks' (assuming today is ${todayStr}):
[
  {
    "title": "Buy 2 liters of water",
    "description": "Remind me to buy 2 liters of water",
    "dueDate": "${nextMondayStr}"
  },
  {
    "title": "Buy 5 tons of concrete",
    "description": "Buy 5 tons of concrete",
    "dueDate": "${addDays(new Date(nextMondayStr), 14).toISOString().split('T')[0]}"
  }
]


Return ONLY the JSON array for 'parsedTasks'. Do not include any other text or explanations.`,
});

const parseVoiceTranscriptFlow = ai.defineFlow(
  {
    name: 'parseVoiceTranscriptFlow',
    inputSchema: ParseVoiceTranscriptInputSchema,
    outputSchema: ParseVoiceTranscriptOutputSchema,
  },
  async (input: ParseVoiceTranscriptInput): Promise<ParseVoiceTranscriptOutput> => {
    const modelToUse = input.modelId || DEFAULT_AI_MODEL_ID;
    const apiKeyToUse = input.apiKey;

    const promptData = { fullTranscript: input.fullTranscript };

    console.log(`Parsing voice transcript with model: ${modelToUse}. Transcript: "${input.fullTranscript}"`);
    
    const result = await parseTranscriptPrompt(promptData, { model: modelToUse, apiKey: apiKeyToUse });
    const output = result.output;
    const usage = result.usage;

    if (!output || !output.parsedTasks) {
      console.warn('AI failed to parse transcript or output structure was invalid. Returning empty array. Output received:', output);
      return {
        parsedTasks: [],
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
      };
    }

    const validatedTasks = output.parsedTasks.map(task => {
        let validatedDueDate = "";
        if (task.dueDate && typeof task.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
            try {
                const d = new Date(task.dueDate + "T00:00:00Z"); // Ensure UTC context for date-only strings
                if (!isNaN(d.getTime())) {
                    validatedDueDate = task.dueDate;
                } else {
                  console.warn(`AI returned an invalid date format for dueDate: ${task.dueDate}. Setting to empty string.`);
                }
            } catch (e) {
              console.warn(`Error parsing AI dueDate '${task.dueDate}':`, e, ". Setting to empty string.");
            }
        } else if (task.dueDate) {
             console.warn(`AI returned dueDate in unexpected format or type: ${task.dueDate}. Setting to empty string.`);
        }
        return { 
          title: task.title || "Untitled Task", // Ensure title exists
          description: task.description || (task.title || "No description provided"), // Ensure description exists
          dueDate: validatedDueDate 
        };
    });
    console.log("AI Parsed Tasks (validated):", validatedTasks, "Tokens:", {in: usage?.inputTokens, out: usage?.outputTokens});

    return {
      parsedTasks: validatedTasks,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
    };
  }
);

