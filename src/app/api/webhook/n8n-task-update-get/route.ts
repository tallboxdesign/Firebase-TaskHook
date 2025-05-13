// src/app/api/webhook/n8n-task-update-get/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import type { PriorityLevel, TaskCategory, TaskStatus } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    // Security Check: Validate the secret token using environment variables
    const expectedHeaderName = process.env.APP_INCOMING_WEBHOOK_HEADER_NAME;
    const expectedSecretValue = process.env.APP_INCOMING_WEBHOOK_SECRET_VALUE;

    if (!expectedHeaderName || !expectedSecretValue) {
      console.error('Incoming Webhook Security Error: APP_INCOMING_WEBHOOK_HEADER_NAME or APP_INCOMING_WEBHOOK_SECRET_VALUE is not set on the server. Rejecting request.');
      return NextResponse.json({ error: 'Webhook security not configured on the server.' }, { status: 500 });
    }

    // Check for the header in the standard way
    let requestHeaderValue = request.headers.get(expectedHeaderName);
    
    // If not found, check if it might be in Basic Auth format
    if (!requestHeaderValue) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Basic ')) {
        try {
          const base64Credentials = authHeader.split(' ')[1];
          const credentials = atob(base64Credentials);
          const [username, password] = credentials.split(':');
          
          // Check if either username or password matches our expected secret
          if (username === expectedSecretValue || password === expectedSecretValue) {
            requestHeaderValue = expectedSecretValue;
            console.log('Using Basic Auth credentials for webhook authentication');
          }
        } catch (error) {
          console.error('Error parsing Basic Auth header:', error);
        }
      }
    }

    if (!requestHeaderValue || requestHeaderValue !== expectedSecretValue) {
      console.warn(\Unauthorized access attempt to n8n webhook. Header '\' was '\'. IP: \\);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Process GET request parameters
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
