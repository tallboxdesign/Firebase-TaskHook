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

// Re-trigger build
// Force new build - attempt 2
export async function POST(request: NextRequest) {
  try {
    // Ensure admin is initialized before getting firestore
    if (!admin.apps.length) {
      console.error("CRITICAL: Firebase Admin not initialized in POST handler for n8n-task-update. Cannot proceed.");
      return NextResponse.json({ error: 'Firebase Admin not initialized on server.' }, { status: 500 });
    }
    // const db = getFirestore(); // Firestore access for settings is removed as per new spec

    // --- NEW AUTHENTICATION LOGIC ---

    // 1. Highest Priority - Master Disable via ENV
    if (process.env.DISABLE_INCOMING_WEBHOOK_AUTH === 'true') {
      console.warn("SERVER ENV: Auth bypassed via DISABLE_INCOMING_WEBHOOK_AUTH. This is for testing only.");
    } else {
      // 2. Second Priority - Specific Server Secret Validation via ENV
      const serverExpectedHeaderName = process.env.APP_INCOMING_WEBHOOK_HEADER_NAME;
      const serverExpectedSecretValue = process.env.APP_INCOMING_WEBHOOK_SECRET_VALUE;

      if (serverExpectedHeaderName && serverExpectedSecretValue) {
        const requestHeaderValue = request.headers.get(serverExpectedHeaderName);

        if (requestHeaderValue === serverExpectedSecretValue) {
          console.log("Authorized via SERVER ENV VARS (specific header/secret match).");
        } else {
          const reason = `Unauthorized (SERVER ENV VALIDATION): Header '${serverExpectedHeaderName}' was '${requestHeaderValue ? "provided but incorrect" : "missing"}'.`;
          console.warn(reason);
          return NextResponse.json({ error: reason }, { status: 401 });
        }
      } else {
        // 3. Fallback / Less Secure Mode (No Strict Server ENV Config)
        console.warn("No server-specific secrets (APP_INCOMING_WEBHOOK_HEADER_NAME/SECRET_VALUE) are defined, and auth is not disabled by DISABLE_INCOMING_WEBHOOK_AUTH. The endpoint is currently less secure. For production, set these ENV VARs.");
        // Proceed to payload processing without strict server-side secret enforcement.
        // Client-sent headers might still be checked if old logic for UI-defined secrets were to be re-introduced,
        // but the current spec implies server ENV vars are the primary mechanism.
      }
    }

    // --- END OF NEW AUTHENTICATION LOGIC ---

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
