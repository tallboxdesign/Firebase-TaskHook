'use server';
/**
 * @fileOverview An AI agent for generating task tags.
 *
 * - generateTaskTags - A function that handles task tag generation.
 */

import {ai} from '@/ai/genkit';
import { DEFAULT_AI_MODEL_ID } from '@/lib/types';
import {
  GenerateTaskTagsPromptDataSchema,
  GenerateTaskTagsFlowInputSchema,
  type GenerateTaskTagsFlowInput,
  GenerateTaskTagsOutputSchema,
  type GenerateTaskTagsOutput,
} from '@/ai/schemas';

export async function generateTaskTags(input: GenerateTaskTagsFlowInput): Promise<GenerateTaskTagsOutput> {
  return generateTaskTagsFlow(input);
}

const generateTagsPrompt = ai.definePrompt({
  name: 'generateTaskTagsPrompt',
  input: {schema: GenerateTaskTagsPromptDataSchema},
  output: {schema: GenerateTaskTagsOutputSchema.pick({ tags: true })}, // Prompt only defines tags, tokens are from usage
  prompt: `You are an AI assistant specialized in analyzing tasks and extracting relevant keywords or tags.
Given the task title and description, generate 3 to 5 concise and relevant tags.
The tags should help categorize and quickly understand the task's nature.
Each tag should be a single word or a very short phrase (max 2 words).
Return the tags as a JSON array of strings.

Task Title: {{{title}}}
Task Description: {{{description}}}`,
});

const generateTaskTagsFlow = ai.defineFlow(
  {
    name: 'generateTaskTagsFlow',
    inputSchema: GenerateTaskTagsFlowInputSchema,
    outputSchema: GenerateTaskTagsOutputSchema, // Full output schema including tokens
  },
  async (input: GenerateTaskTagsFlowInput): Promise<GenerateTaskTagsOutput> => {
    const promptData = {
      title: input.title,
      description: input.description,
    };
    const modelToUse = input.modelId || DEFAULT_AI_MODEL_ID;
    const apiKeyToUse = input.apiKey;

    if (!modelToUse.startsWith('googleai/') && !modelToUse.startsWith('xai/')) {
      console.warn(`Attempting to use non-Google/XAI model '${modelToUse}' for tag generation without a dedicated Genkit plugin. This will likely fail.`);
    }

    console.log(`Generating tags using model: ${modelToUse}`);
    if (apiKeyToUse) {
      console.log("Using API key provided in flow input for tag generation.");
    }
    
    const result = await generateTagsPrompt(promptData, { model: modelToUse, apiKey: apiKeyToUse });
    const output = result.output;
    const usage = result.usage;

    if (!output) {
      console.warn('AI failed to generate tags or output was empty. Returning empty array.');
      return { 
        tags: [],
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
      };
    }
    const cleanedTags = output.tags.filter(tag => tag && tag.trim() !== '').map(tag => tag.trim());
    return { 
      tags: cleanedTags.slice(0, 5),
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
    };
  }
);