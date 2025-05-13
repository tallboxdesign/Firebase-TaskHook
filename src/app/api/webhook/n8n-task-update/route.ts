// src/app/api/webhook/n8n-task-update/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import type { PriorityLevel, AIPrioritizationResult, TaskCategory, TaskStatus } from '@/lib/types';

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

// Helper function to validate the webhook request
async function validateAndProcessWebhook(request: NextRequest, method: string) {
  try {
    // For POST requests, parse the JSON body
    let payload: N8NWebhookTaskPayload;
    
    if (method === 'GET') {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      const priority = url.searchParams.get('priority') as PriorityLevel | null;
      
      if (!id) {
        console.error('N8N Webhook Error: Task ID is missing in the query parameters.');
        return NextResponse.json({ error: 'Task ID is required in query parameters' }, { status: 400 });
      }
      
      payload = { 
        id,
        priority: priority || undefined,
        title: url.searchParams.get('title') || undefined,
        description: url.searchParams.get('description') || undefined,
        dueDate: url.searchParams.get('dueDate') || undefined,
        status: url.searchParams.get('status') as TaskStatus | undefined,
        category: url.searchParams.get('category') as TaskCategory | undefined
      };
      
      console.log('Received webhook GET request from n8n:', payload);
    } else {
      // For POST requests, parse the JSON body
      payload = await request.json();
      console.log('Received webhook payload from n8n:', JSON.stringify(payload, null, 2));
    }
    
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

    console.log(\Webhook for task ID \ received by Next.js API endpoint.\);
    if (updatedTaskData.priority) {
      console.log(\N8N suggests new priority for task \: \\);
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

// Support both POST and GET methods
export async function POST(request: NextRequest) {
  return validateAndProcessWebhook(request, 'POST');
}

export async function GET(request: NextRequest) {
  return validateAndProcessWebhook(request, 'GET');
}
