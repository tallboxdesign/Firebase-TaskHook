import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { DEFAULT_AI_MODEL_ID } from '@/lib/types'; // Updated to DEFAULT_AI_MODEL_ID

// To support other AI providers like XAI, you would need to:
// 1. Install the appropriate Genkit plugin for that provider (e.g., a hypothetical `xaiPlugin()`).
// 2. Add the plugin to the `plugins` array below.
// 3. Ensure the model IDs in `src/lib/types.ts` match the IDs expected by that plugin.
// 4. Handle API key configuration for that provider, potentially by extending how `SettingsValues.apiKey`
//    is used or by adding provider-specific environment variables.

export const ai = genkit({
  plugins: [
    googleAI() 
    // Example: if an XAI plugin existed, you might add it here:
    // xaiPlugin({ apiKey: process.env.XAI_API_KEY })
  ],
  // The model name here is a fallback if a flow doesn't specify one.
  // Our flows currently always specify a model based on user selection or the default.
  model: DEFAULT_AI_MODEL_ID, 
});