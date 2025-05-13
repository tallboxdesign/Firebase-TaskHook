
import { config } from 'dotenv';
config();

import '@/ai/flows/prioritize-tasks.ts';
import '@/ai/flows/generate-task-tags.ts';
import '@/ai/flows/parse-voice-transcript.ts';
