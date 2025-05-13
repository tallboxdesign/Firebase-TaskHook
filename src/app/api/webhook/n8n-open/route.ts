// src/app/api/webhook/n8n-open/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import type { PriorityLevel, TaskCategory, TaskStatus } from '@/lib/types';

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
}

export async function POST(request: NextRequest) {
  try {
    // Parse the JSON body
    const payload = await request.json();
    console.log('Received webhook payload from n8n:', JSON.stringify(payload, null, 2));
    
    const updatedTaskData = payload as N8NWebhookTaskPayload;

    if (!updatedTaskData.id) {
      console.error('N8N Webhook Error: Task ID is missing in the payload.');
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    console.log(\Webhook for task ID \ received by Next.js API endpoint.\);
    if (updatedTaskData.priority) {
      console.log(\N8N suggests new priority for task \: \\);
    }

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

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const priority = url.searchParams.get('priority') as PriorityLevel | null;
    
    if (!id) {
      console.error('N8N Webhook Error: Task ID is missing in the query parameters.');
      return NextResponse.json({ error: 'Task ID is required in query parameters' }, { status: 400 });
    }
    
    const payload = { 
      id,
      priority: priority || undefined,
      title: url.searchParams.get('title') || undefined,
      description: url.searchParams.get('description') || undefined,
      dueDate: url.searchParams.get('dueDate') || undefined,
      status: url.searchParams.get('status') as TaskStatus | undefined,
      category: url.searchParams.get('category') as TaskCategory | undefined
    };
    
    console.log('Received webhook GET request from n8n:', payload);

    console.log(\Webhook for task ID \ received by Next.js API endpoint.\);
    if (payload.priority) {
      console.log(\N8N suggests new priority for task \: \\);
    }

    return NextResponse.json({ message: 'Task update received by Next.js API endpoint.' }, { status: 200 });
  } catch (error: any) {
    console.error('Error processing n8n webhook GET request:', error);
    let errorMessage = 'Internal Server Error while processing n8n webhook.';
    return NextResponse.json({ error: errorMessage, details: error.message }, { status: 500 });
  }
}
