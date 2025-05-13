import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { AppSettings, DEFAULT_APP_SETTINGS } from '../../lib/types';

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
      'Firebase Admin SDK not initialized. Missing FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS. API operations might fail.'
    );
  }
}

const db = admin.firestore();
const APP_SETTINGS_COLLECTION = 'app_settings';
const GLOBAL_SETTINGS_DOC_ID = 'global_settings';

/**
 * GET /api/settings
 * Fetches the current application settings.
 * Initializes with default settings if not found.
 */
export async function GET(request: NextRequest) {
  try {
    const settingsRef = db.collection(APP_SETTINGS_COLLECTION).doc(GLOBAL_SETTINGS_DOC_ID);
    const docSnap = await settingsRef.get();

    if (!docSnap.exists) {
      console.log(`Settings document not found, initializing with defaults: ${APP_SETTINGS_COLLECTION}/${GLOBAL_SETTINGS_DOC_ID}`);
      await settingsRef.set(DEFAULT_APP_SETTINGS);
      return NextResponse.json(DEFAULT_APP_SETTINGS, { status: 200 }); // Return 200 as per typical GET, even if created
    }

    const settings = docSnap.data() as AppSettings;
    // Ensure all fields from AppSettings are present, merging with defaults if necessary
    // This handles cases where new settings fields are added to AppSettings but not yet in Firestore
    const completeSettings = { ...DEFAULT_APP_SETTINGS, ...settings };

    return NextResponse.json(completeSettings, { status: 200 });
  } catch (error) {
    console.error(`Error fetching app settings:`, error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Failed to fetch app settings.', details: errorMessage }, { status: 500 });
  }
}

/**
 * PUT /api/settings
 * Updates the application settings.
 * Accepts a partial AppSettings object in the request body.
 */
export async function PUT(request: NextRequest) {
  try {
    const settingsRef = db.collection(APP_SETTINGS_COLLECTION).doc(GLOBAL_SETTINGS_DOC_ID);
    const body = await request.json();

    // Validate that the body contains at least one valid AppSettings key
    // For this specific task, we are interested in disableIncomingWebhookAuth
    const updateData: Partial<AppSettings> = {};
    if (typeof body.disableIncomingWebhookAuth === 'boolean') {
      updateData.disableIncomingWebhookAuth = body.disableIncomingWebhookAuth;
    }
    // Add other settings fields here if they become updatable in the future
    // e.g., if (body.someOtherSetting !== undefined) { updateData.someOtherSetting = body.someOtherSetting; }


    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid settings provided for update.' }, { status: 400 });
    }

    // Ensure the document exists before updating, or create it if it doesn't (though GET should handle creation)
    const docSnap = await settingsRef.get();
    if (!docSnap.exists) {
        // Initialize with defaults, then apply the update.
        // This ensures that if the doc is missing, we start from a known state.
        await settingsRef.set(DEFAULT_APP_SETTINGS);
        await settingsRef.update(updateData);
        console.log(`Initialized and updated settings: ${APP_SETTINGS_COLLECTION}/${GLOBAL_SETTINGS_DOC_ID}`);
    } else {
        await settingsRef.update(updateData); // Use update to only change specified fields
        console.log(`Updated settings: ${APP_SETTINGS_COLLECTION}/${GLOBAL_SETTINGS_DOC_ID}`);
    }


    const updatedDocSnap = await settingsRef.get();
    const updatedSettings = updatedDocSnap.data() as AppSettings;
    
    // Ensure all fields from AppSettings are present in the response
    const completeUpdatedSettings = { ...DEFAULT_APP_SETTINGS, ...updatedSettings };

    return NextResponse.json(completeUpdatedSettings, { status: 200 });
  } catch (error) {
    console.error(`Error updating app settings:`, error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    // Check for specific error types if needed, e.g., JSON parsing errors
    if (error instanceof SyntaxError) { // From await request.json()
        return NextResponse.json({ error: 'Invalid JSON in request body.', details: errorMessage }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update app settings.', details: errorMessage }, { status: 500 });
  }
}