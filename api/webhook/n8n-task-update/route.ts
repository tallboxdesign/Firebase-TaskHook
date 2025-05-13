// src/app/api/webhook/n8n-task-update/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
// Corrected relative path for types
import type { PriorityLevel, AIPrioritizationResult, TaskCategory, TaskStatus, AIModelId, AppSettings } from '../../../lib/types';
import { DEFAULT_APP_SETTINGS } from '../../../lib/types';

// Ensure Firebase Admin SDK is initialized
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
     admin.initializeApp({
        credential: admin.credential.applicationDefault(),
     });
  } else {
    console.warn(
      'Firebase Admin SDK not initialized for n8n-task-update. Missing FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS. API operations might fail.'
    );
    // Depending on strictness, you might want to throw an error or prevent further execution
  }
}

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
    // Ensure admin is initialized before getting firestore
    if (!admin.apps.length) {
      // This case should ideally be handled by the initialization block above.
      // If it still reaches here, it means initialization failed silently or was skipped.
      console.error("CRITICAL: Firebase Admin not initialized in POST handler for n8n-task-update. Cannot proceed.");
      return NextResponse.json({ error: 'Firebase Admin not initialized on server.' }, { status: 500 });
    }
    const db = getFirestore(); // Uses the default app instance after initialization
    let disableIncomingWebhookAuth = DEFAULT_APP_SETTINGS.disableIncomingWebhookAuth;

    try {
      // Using a consistent document ID, e.g., 'global_settings' as in api/settings/route.ts
      // Or, if 'default_settings' is specifically for this webhook, keep it.
      // For consistency with your example, let's assume 'default_settings' is intended here.
      const settingsRef = db.collection('app_settings').doc('default_settings');
      const settingsDoc = await settingsRef.get();

      if (settingsDoc.exists) {
        const settingsData = settingsDoc.data() as AppSettings;
        if (typeof settingsData.disableIncomingWebhookAuth === 'boolean') {
          disableIncomingWebhookAuth = settingsData.disableIncomingWebhookAuth;
        }
      }
    } catch (error) {
      console.error("Error fetching 'disableIncomingWebhookAuth' from Firestore, using default:", error);
      // Default is already set, so just log and continue
    }

    if (!disableIncomingWebhookAuth) {
      // Security Check: Validate the secret token using environment variables
      const expectedHeaderName = 'X-Webhook-Secret'; // As per new requirement
      const expectedSecretValue = process.env.N8N_WEBHOOK_SECRET; // As per new requirement

      if (!expectedSecretValue) {
        console.error('Incoming Webhook Security Error: N8N_WEBHOOK_SECRET is not set on the server. Rejecting request.');
        // Consider 403 Forbidden if it's a configuration issue server-side preventing auth
        return NextResponse.json({ error: 'Webhook security (secret) not configured on the server.' }, { status: 500 });
      }

      const requestHeaderValue = request.headers.get(expectedHeaderName);

      if (!requestHeaderValue || requestHeaderValue !== expectedSecretValue) {
        const clientIp = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
        console.warn(`Unauthorized access attempt to n8n webhook. Header '${expectedHeaderName}' was '${requestHeaderValue ? "provided but incorrect" : "missing"}'. IP: ${clientIp}`);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      console.log("Incoming webhook authentication is disabled via app_settings. Skipping header check.");
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
