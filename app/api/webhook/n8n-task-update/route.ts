// src/app/api/webhook/n8n-task-update/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import type { PriorityLevel, AIPrioritizationResult, TaskCategory, TaskStatus, AIModelId } from '@/lib/types';

// Define a type for the expected webhook payload from n8n
interface N8NWebhookTaskPayload {
  id: string; // Mandatory
  title?: string;
  description?: string;
  dueDate?: string; 
  priority?: PriorityLevel;
  status?: TaskStatus;
  category?: TaskCategory;
  tags?: string[];
  completedAt?: string | null; 
  instructions?: string; 
  aiData?: Partial<AIPrioritizationResult>; 
}

export async function POST(request: NextRequest) {
  try {
    // Security Check: Validate the secret token using environment variables
    const expectedHeaderName = process.env.APP_INCOMING_WEBHOOK_HEADER_NAME;
    const expectedSecretValue = process.env.APP_INCOMING_WEBHOOK_SECRET_VALUE;

    if (!expectedHeaderName || !expectedSecretValue) {
      console.error('Incoming Webhook Security Error: APP_INCOMING_WEBHOOK_HEADER_NAME or APP_INCOMING_WEBHOOK_SECRET_VALUE is not set on the server. Rejecting request.');
      return NextResponse.json({ error: 'Webhook security not configured on the server.' }, { status: 500 });
    }

    const requestHeaderValue = request.headers.get(expectedHeaderName);

    if (!requestHeaderValue || requestHeaderValue !== expectedSecretValue) {
      console.warn(`Unauthorized access attempt to n8n webhook. Header '${expectedHeaderName}' was '${requestHeaderValue ? "provided but incorrect" : "missing"}'. IP: ${request.ip || 'unknown'}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    console.log('Received webhook payload from n8n:', JSON.stringify(payload, null, 2));
    const updatedTaskData = payload as N8NWebhookTaskPayload;

    if (!updatedTaskData.id) {
      console.error('N8N Webhook Error: Task ID is missing in the payload.');
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    // TODO: Core logic to process and store/update the task
    // This would involve fetching the task by ID from your data store (e.g., localStorage via client-side actions, or a backend DB),
    // merging the updatedTaskData, and saving it back.
    // Since this API route runs on the server, it cannot directly modify client-side localStorage.
    // A full solution would involve a backend data store or a way to signal the client to update.

    console.log(`Webhook for task ID ${updatedTaskData.id} received by Next.js API endpoint.`);
    if (updatedTaskData.priority) {
      console.log(`N8N suggests new priority for task ${updatedTaskData.id}: ${updatedTaskData.priority}`);
    }
    // ... log other relevant fields ...

    return NextResponse.json({ message: 'Task update received by Next.js API endpoint.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error processing n8n webhook:', error);
    let errorMessage = 'Internal Server Error while processing n8n webhook.';
    if (error instanceof SyntaxError && error.message.toLowerCase().includes('json')) {
      errorMessage = 'Invalid JSON payload received from n8n.';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json({ error: errorMessage, details: error.message }, { status: 500 });
  }
}
