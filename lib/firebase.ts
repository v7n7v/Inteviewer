/**
 * Firebase Configuration & Auth Helpers
 * Replaces Supabase for auth + database
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateEmail as firebaseUpdateEmail,
  updatePassword as firebaseUpdatePassword,
  updateProfile,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  TotpMultiFactorGenerator,
  TotpSecret,
  multiFactor,
  getMultiFactorResolver,
  type User,
  type MultiFactorResolver,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (singleton)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Google OAuth provider
const googleProvider = new GoogleAuthProvider();

// Auth helpers (drop-in replacement for Supabase authHelpers)
export const authHelpers = {
  async signUp(email: string, password: string, fullName: string) {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: fullName });
      // Create user profile document in Firestore
      await setDoc(doc(db, 'users', user.uid, 'profile', 'main'), {
        full_name: fullName,
        email,
        skills: [],
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      return { data: { user }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async signIn(email: string, password: string) {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      return { data: { user, session: { user } }, error: null, mfaResolver: null };
    } catch (error: any) {
      // If MFA is required, return the resolver instead of treating as error
      if (error.code === 'auth/multi-factor-auth-required') {
        const resolver = getMultiFactorResolver(auth, error);
        return { data: null, error: null, mfaResolver: resolver };
      }
      return { data: null, error, mfaResolver: null };
    }
  },

  async signInWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      // Create user profile if first sign-in (non-blocking)
      try {
        const profileRef = doc(db, 'users', user.uid, 'profile', 'main');
        const profileSnap = await getDoc(profileRef);
        if (!profileSnap.exists()) {
          await setDoc(profileRef, {
            full_name: user.displayName || '',
            email: user.email || '',
            skills: [],
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
        }
      } catch (firestoreErr) {
        // Don't block login if Firestore profile check fails
        console.warn('Firestore profile check skipped:', firestoreErr);
      }
      return { data: { user }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async signOut() {
    try {
      await firebaseSignOut(auth);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  },

  async getSession() {
    // Wait for Firebase Auth to initialize (auth.currentUser is null on cold start)
    return new Promise<{ session: { user: User } | null; error: null }>((resolve) => {
      // If auth already has a user, return immediately
      if (auth.currentUser) {
        resolve({ session: { user: auth.currentUser }, error: null });
        return;
      }
      // Otherwise wait for the first auth state emission
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve({ session: user ? { user } : null, error: null });
      });
    });
  },

  async getUser() {
    return { user: auth.currentUser, error: null };
  },

  async resetPasswordForEmail(email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
      return { data: {}, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async updateEmail(newEmail: string) {
    try {
      if (!auth.currentUser) throw new Error('Not authenticated');
      await firebaseUpdateEmail(auth.currentUser, newEmail);
      return { data: {}, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async updatePassword(newPassword: string) {
    try {
      if (!auth.currentUser) throw new Error('Not authenticated');
      await firebaseUpdatePassword(auth.currentUser, newPassword);
      return { data: {}, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async verifyPassword(email: string, password: string) {
    try {
      if (!auth.currentUser) throw new Error('Not authenticated');
      const credential = EmailAuthProvider.credential(email, password);
      await reauthenticateWithCredential(auth.currentUser, credential);
      return { isValid: true, error: null };
    } catch (error: any) {
      return { isValid: false, error };
    }
  },

  async updateProfile(profileData: { displayName?: string; photoURL?: string }) {
    try {
      if (!auth.currentUser) throw new Error('Not authenticated');
      await updateProfile(auth.currentUser, profileData);
      return { success: true, error: null };
    } catch (error: any) {
      return { success: false, error };
    }
  },

  // Listen for auth state changes
  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  // ============================================
  // MULTI-FACTOR AUTHENTICATION (TOTP / Google Authenticator)
  // ============================================

  /** Generate a TOTP secret for enrollment. Returns the secret + QR code URI. */
  async generateTOTPSecret() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      const session = await multiFactor(user).getSession();
      const totpSecret = await TotpMultiFactorGenerator.generateSecret(session);

      // Generate Google Authenticator-compatible QR URI
      const qrCodeUrl = totpSecret.generateQrCodeUrl(
        user.email || 'user@talentconsulting.io',
        'TalentConsulting.io'
      );

      return {
        totpSecret,
        qrCodeUrl,
        secretKey: totpSecret.secretKey,
        error: null,
      };
    } catch (error: any) {
      return { totpSecret: null, qrCodeUrl: null, secretKey: null, error };
    }
  },

  /** Complete TOTP enrollment with a code from authenticator app */
  async completeTOTPEnrollment(
    totpSecret: TotpSecret,
    verificationCode: string,
    displayName: string = 'Google Authenticator'
  ) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        totpSecret,
        verificationCode
      );
      await multiFactor(user).enroll(assertion, displayName);
      return { success: true, error: null };
    } catch (error: any) {
      return { success: false, error };
    }
  },

  /** Remove enrolled MFA factor */
  async unenrollMFA() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      const enrolledFactors = multiFactor(user).enrolledFactors;
      if (enrolledFactors.length === 0) throw new Error('No MFA factors enrolled');

      await multiFactor(user).unenroll(enrolledFactors[0]);
      return { success: true, error: null };
    } catch (error: any) {
      if (error.code === 'auth/user-token-expired') {
        // User was signed out after unenroll — they need to re-auth
        return { success: true, error: null };
      }
      return { success: false, error };
    }
  },

  /** Check if user has MFA enrolled, returns hints */
  getMFAStatus() {
    const user = auth.currentUser;
    if (!user) return { enrolled: false, hints: [] };

    const enrolledFactors = multiFactor(user).enrolledFactors;
    return {
      enrolled: enrolledFactors.length > 0,
      hints: enrolledFactors.map((f) => ({
        factorId: f.factorId,
        displayName: f.displayName,
        uid: f.uid,
      })),
    };
  },

  /** Resolve TOTP MFA sign-in challenge with authenticator code */
  async resolveTOTPSignIn(
    resolver: MultiFactorResolver,
    otpCode: string,
    hintIndex: number = 0
  ) {
    try {
      const hint = resolver.hints[hintIndex];
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(
        hint.uid,
        otpCode
      );
      const userCredential = await resolver.resolveSignIn(assertion);
      return { data: { user: userCredential.user }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },
};

// Export Firebase instances
export { app, auth, db };
export { serverTimestamp };
export type { User };

// Re-export Firestore utilities for use in database modules
export {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
};
