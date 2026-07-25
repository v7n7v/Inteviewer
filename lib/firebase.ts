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
  signInWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  verifyPasswordResetCode as firebaseVerifyPasswordResetCode,
  validatePassword as firebaseValidatePassword,
  checkActionCode as firebaseCheckActionCode,
  applyActionCode as firebaseApplyActionCode,
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
import { getStorage } from 'firebase/storage';
import { getDemoAuthUser, isDemoModeEnabled } from './demo-mode';
import {
  canUseSameOriginAuthRedirect,
  isPopupCancellation,
  mfaEnrollmentEnabled,
  normalizeAuthError,
  reportSanitizedAuthIssue,
  shouldUseRedirectFallback,
  type NormalizedAuthError,
} from './auth-flow';

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
const storage = getStorage(app);

async function sendAuthenticatedSecurityConfirmation(event: 'password_changed' | 'email_changed') {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const token = await user.getIdToken(true);
    await fetch('/api/auth/security-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ event }),
    });
  } catch {
    // The security action already succeeded. Confirmation delivery is monitored
    // server-side and must not cause the client to repeat the mutation.
  }
}

// Google OAuth provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export type ProfileBootstrapStatus = 'scheduled';

export type GoogleAuthResult =
  | { status: 'success'; user: User; isNewUser: boolean; profileBootstrap: ProfileBootstrapStatus }
  | { status: 'cancelled' }
  | { status: 'redirecting' }
  | { status: 'error'; error: NormalizedAuthError };

export type GoogleRedirectResult =
  | { status: 'success'; user: User; isNewUser: boolean; profileBootstrap: ProfileBootstrapStatus }
  | { status: 'none' }
  | { status: 'error'; error: NormalizedAuthError };

async function ensureUserProfile(user: User, fullName?: string) {
  const profileRef = doc(db, 'users', user.uid, 'profile', 'main');
  const profileSnap = await getDoc(profileRef);
  if (profileSnap.exists()) return;

  await setDoc(profileRef, {
    full_name: fullName || user.displayName || '',
    email: user.email || '',
    skills: [],
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}

async function bootstrapUserAfterAuth(user: User, fullName?: string) {
  const operations: Promise<unknown>[] = [ensureUserProfile(user, fullName)];
  if (fullName && user.displayName !== fullName) {
    operations.push(updateProfile(user, { displayName: fullName }));
  }

  const results = await Promise.allSettled(operations);
  for (const result of results) {
    if (result.status === 'rejected') reportSanitizedAuthIssue('profile-bootstrap', result.reason);
  }
}

function scheduleUserProfileBootstrap(user: User, fullName?: string): ProfileBootstrapStatus {
  void bootstrapUserAfterAuth(user, fullName);
  return 'scheduled';
}

// Auth helpers (drop-in replacement for Supabase authHelpers)
export const authHelpers = {
  async signUp(email: string, password: string, fullName: string) {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      const profileBootstrap = scheduleUserProfileBootstrap(user, fullName);
      return { data: { user, profileBootstrap }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async signIn(email: string, password: string) {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const profileBootstrap = scheduleUserProfileBootstrap(user);
      return { data: { user, session: { user }, profileBootstrap }, error: null, mfaResolver: null };
    } catch (error: any) {
      // If MFA is required, return the resolver instead of treating as error
      if (error.code === 'auth/multi-factor-auth-required') {
        const resolver = getMultiFactorResolver(auth, error);
        return { data: null, error: null, mfaResolver: resolver };
      }
      return { data: null, error, mfaResolver: null };
    }
  },

  async signInWithGoogle(): Promise<GoogleAuthResult> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return {
        status: 'success',
        user: result.user,
        isNewUser: getAdditionalUserInfo(result)?.isNewUser === true,
        profileBootstrap: scheduleUserProfileBootstrap(result.user),
      };
    } catch (error: unknown) {
      if (isPopupCancellation(error)) return { status: 'cancelled' };

      const hostname = typeof window === 'undefined' ? null : window.location.hostname;
      if (
        shouldUseRedirectFallback(error)
        && canUseSameOriginAuthRedirect(firebaseConfig.authDomain, hostname)
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return { status: 'redirecting' };
        } catch (redirectError: unknown) {
          return { status: 'error', error: normalizeAuthError(redirectError) };
        }
      }

      return { status: 'error', error: normalizeAuthError(error) };
    }
  },

  async completeGoogleRedirect(): Promise<GoogleRedirectResult> {
    const hostname = typeof window === 'undefined' ? null : window.location.hostname;
    if (!canUseSameOriginAuthRedirect(firebaseConfig.authDomain, hostname)) {
      return { status: 'none' };
    }

    try {
      const result = await getRedirectResult(auth);
      if (!result?.user) return { status: 'none' };

      return {
        status: 'success',
        user: result.user,
        isNewUser: getAdditionalUserInfo(result)?.isNewUser === true,
        profileBootstrap: scheduleUserProfileBootstrap(result.user),
      };
    } catch (error: unknown) {
      return { status: 'error', error: normalizeAuthError(error) };
    }
  },

  async signOut() {
    if (isDemoModeEnabled()) return { error: null };

    try {
      await firebaseSignOut(auth);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  },

  async getSession() {
    if (isDemoModeEnabled()) {
      return { session: { user: getDemoAuthUser() }, error: null };
    }

    // Wait for Firebase Auth to initialize (auth.currentUser is null on cold start)
    return new Promise<{ session: { user: User } | null; error: null }>((resolve) => {
      // If auth already has a user, return immediately
      if (auth.currentUser) {
        scheduleUserProfileBootstrap(auth.currentUser);
        resolve({ session: { user: auth.currentUser }, error: null });
        return;
      }
      // Otherwise wait for the first auth state emission
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        if (user) scheduleUserProfileBootstrap(user);
        resolve({ session: user ? { user } : null, error: null });
      });
    });
  },

  async getUser() {
    if (isDemoModeEnabled()) return { user: getDemoAuthUser(), error: null };
    return { user: auth.currentUser, error: null };
  },

  async resetPasswordForEmail(email: string) {
    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (!response.ok) {
        throw Object.assign(new Error(payload.error || 'Password reset could not be requested.'), {
          code: response.status === 429 ? 'auth/too-many-requests' : 'auth/unknown',
        });
      }
      return { data: { message: payload.message }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async verifyPasswordResetCode(code: string) {
    try {
      const email = await firebaseVerifyPasswordResetCode(auth, code);
      return { data: { email }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async validateNewPassword(password: string) {
    try {
      const status = await firebaseValidatePassword(auth, password);
      return { data: status, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async confirmPasswordReset(code: string, newPassword: string) {
    try {
      const response = await fetch('/api/auth/password-reset/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oobCode: code, newPassword }),
      });
      const payload = await response.json().catch(() => ({})) as { code?: string; error?: string };
      if (!response.ok) {
        throw Object.assign(new Error(payload.error || 'Password reset could not be completed.'), {
          code: payload.code || 'auth/unknown',
        });
      }
      return { data: {}, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async checkEmailActionCode(code: string) {
    try {
      const info = await firebaseCheckActionCode(auth, code);
      return { data: info, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async applyEmailActionCode(code: string) {
    try {
      await firebaseApplyActionCode(auth, code);
      return { data: {}, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async updateEmail(newEmail: string) {
    try {
      if (!auth.currentUser) throw new Error('Not authenticated');
      const token = await auth.currentUser.getIdToken(true);
      const response = await fetch('/api/auth/email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newEmail }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Email change could not be requested.');
      return { data: {}, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async updatePassword(newPassword: string) {
    try {
      if (!auth.currentUser) throw new Error('Not authenticated');
      await firebaseUpdatePassword(auth.currentUser, newPassword);
      void sendAuthenticatedSecurityConfirmation('password_changed');
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

  async beginMFAReauthentication(password: string) {
    try {
      const user = auth.currentUser;
      if (!user?.email) throw new Error('An email-authenticated Admin session is required.');
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      await user.getIdToken(true);
      return { complete: true as const, resolver: null, error: null };
    } catch (error: any) {
      if (error?.code === 'auth/multi-factor-auth-required') {
        return {
          complete: false as const,
          resolver: getMultiFactorResolver(auth, error),
          error: null,
        };
      }
      return { complete: false as const, resolver: null, error };
    }
  },

  async resolveTOTPReauthentication(
    resolver: MultiFactorResolver,
    otpCode: string,
    hintIndex: number = 0,
  ) {
    try {
      const hint = resolver.hints[hintIndex];
      if (!hint) throw new Error('No enrolled second factor is available.');
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, otpCode);
      const credential = await resolver.resolveSignIn(assertion);
      await credential.user.getIdToken(true);
      return { complete: true as const, error: null };
    } catch (error: any) {
      return { complete: false as const, error };
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
    if (isDemoModeEnabled()) {
      queueMicrotask(() => callback(getDemoAuthUser()));
      return () => {};
    }

    return onAuthStateChanged(auth, (user) => {
      if (user) scheduleUserProfileBootstrap(user);
      callback(user);
    });
  },

  // ============================================
  // MULTI-FACTOR AUTHENTICATION (TOTP / Google Authenticator)
  // ============================================

  /** Generate a TOTP secret for enrollment. Returns the secret + QR code URI. */
  async generateTOTPSecret() {
    try {
      if (!mfaEnrollmentEnabled) {
        throw Object.assign(new Error('MFA enrollment is not enabled.'), { code: 'auth/operation-not-allowed' });
      }
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
      if (!mfaEnrollmentEnabled) {
        throw Object.assign(new Error('MFA enrollment is not enabled.'), { code: 'auth/operation-not-allowed' });
      }
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
      scheduleUserProfileBootstrap(userCredential.user);
      return { data: { user: userCredential.user }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },
};

// Export Firebase instances
export { app, auth, db, storage };
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
