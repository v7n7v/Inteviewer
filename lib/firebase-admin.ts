/**
 * Firebase Admin SDK — Server-side only
 * Used for verifying ID tokens in API routes and middleware.
 */
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  // Initialize with project ID only (no service account needed for ID token verification
  // when running in the same Firebase project)
  adminApp = initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });

  return adminApp;
}

export function getAdminAuth(): Auth {
  if (adminAuth) return adminAuth;
  adminAuth = getAuth(getAdminApp());
  return adminAuth;
}

export function getAdminDb(): Firestore {
  if (adminDb) return adminDb;
  adminDb = getFirestore(getAdminApp());
  return adminDb;
}

/**
 * Verify a Firebase ID token from the Authorization header.
 * Returns the decoded token (with uid, email, etc.) or null if invalid.
 */
export async function verifyIdToken(token: string) {
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded;
  } catch {
    return null;
  }
}
