import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { AppSettings, DEFAULT_APP_SETTINGS } from '../../../lib/types';

// Ensure Firebase Admin SDK is initialized
// This is a common pattern. If your project initializes admin differently, adjust accordingly.
if (!admin.apps.length) {
  // These credentials would typically be set via environment variables
  // For Vercel/Next.js, these are often set in the project settings
  // Ensure GOOGLE_APPLICATION_CREDENTIALS is set, or provide serviceAccountKey path
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined; // Or load from a file if not in env var

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com` // Optional if not using Realtime Database
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
     admin.initializeApp({
        credential: admin.credential.applicationDefault(),
     });
  } else {
    console.warn(
      'Firebase Admin SDK not initialized. Missing FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS. App settings initialization might fail.'
    );
    // Potentially throw an error or handle this case based on project requirements
    // For this example, we'll let it proceed, and Firestore operations will likely fail if not initialized.
  }
}

const db = admin.firestore();
const APP_SETTINGS_COLLECTION = 'app_settings';
const GLOBAL_SETTINGS_DOC_ID = 'global_settings';

export async function GET(request: NextRequest) {
  try {
    const settingsRef = db.collection(APP_SETTINGS_COLLECTION).doc(GLOBAL_SETTINGS_DOC_ID);
    const docSnap = await settingsRef.get();

    if (!docSnap.exists) {
      await settingsRef.set(DEFAULT_APP_SETTINGS);
      console.log(`Initialized ${APP_SETTINGS_COLLECTION}/${GLOBAL_SETTINGS_DOC_ID} with default values.`);
      return NextResponse.json({
        message: `Successfully initialized ${APP_SETTINGS_COLLECTION}/${GLOBAL_SETTINGS_DOC_ID}.`,
        settings: DEFAULT_APP_SETTINGS,
      }, { status: 201 });
    } else {
      console.log(`${APP_SETTINGS_COLLECTION}/${GLOBAL_SETTINGS_DOC_ID} already exists.`);
      return NextResponse.json({
        message: `${APP_SETTINGS_COLLECTION}/${GLOBAL_SETTINGS_DOC_ID} already exists.`,
        settings: docSnap.data() as AppSettings,
      }, { status: 200 });
    }
  } catch (error) {
    console.error(`Error initializing app settings:`, error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Failed to initialize app settings.', details: errorMessage }, { status: 500 });
  }
}