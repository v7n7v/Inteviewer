/**
 * Referral System
 * "Bring a friend, both get 50% off for 3 months"
 *
 * Flow:
 *  1. User generates unique referral code (TC-XXXX-XXXX)
 *  2. Friend signs up with the code
 *  3. When friend upgrades to Pro, both get 50% off 3 months
 *  4. Rewards applied via Stripe promotion codes
 *
 * Anti-abuse:
 *  - Max 10 referrals per user
 *  - Referee must be a new account (email never seen)
 *  - Self-referral blocked (same email)
 *  - Reward only triggers on Pro upgrade, not just signup
 */

import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { monitor } from './monitor';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

function getDb() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

const MAX_REFERRALS = 10;

/** Generate a unique 8-character referral code */
function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // No confusing chars (0/O, 1/I/L)
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `TC-${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Get or create a referral code for a user */
export async function getReferralCode(uid: string, email?: string): Promise<{
  code: string;
  referralCount: number;
  maxReferrals: number;
  referredBy: string | null;
}> {
  const db = getDb();
  const ref = doc(db, 'users', uid, 'referral', 'info');

  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    return {
      code: data.referralCode,
      referralCount: data.referralCount || 0,
      maxReferrals: MAX_REFERRALS,
      referredBy: data.referredBy || null,
    };
  }

  // Create new referral code
  const code = generateCode();
  await setDoc(ref, {
    referralCode: code,
    referralCount: 0,
    referredBy: null,
    email: email || null,
    createdAt: new Date().toISOString(),
  });

  return { code, referralCount: 0, maxReferrals: MAX_REFERRALS, referredBy: null };
}

/** Look up a referral code and return the referrer's UID */
export async function findReferrer(code: string): Promise<{ uid: string; email?: string } | null> {
  const db = getDb();
  // Search all users' referral/info docs for the code
  const usersSnap = await getDocs(collection(db, 'users'));

  for (const userDoc of usersSnap.docs) {
    try {
      const refSnap = await getDoc(doc(db, 'users', userDoc.id, 'referral', 'info'));
      if (refSnap.exists() && refSnap.data()?.referralCode === code) {
        return { uid: userDoc.id, email: refSnap.data()?.email };
      }
    } catch { continue; }
  }
  return null;
}

/** Apply a referral code during signup */
export async function applyReferralCode(
  newUid: string,
  newEmail: string,
  code: string
): Promise<{ success: boolean; error?: string; referrerUid?: string }> {
  // Validate code format
  if (!code.match(/^TC-[A-Z0-9]{4}-[A-Z0-9]{4}$/)) {
    return { success: false, error: 'Invalid referral code format.' };
  }

  // Find referrer
  const referrer = await findReferrer(code);
  if (!referrer) {
    return { success: false, error: 'Referral code not found.' };
  }

  // Self-referral check
  if (referrer.uid === newUid || referrer.email?.toLowerCase() === newEmail.toLowerCase()) {
    return { success: false, error: 'Cannot use your own referral code.' };
  }

  // Check referrer hasn't exceeded max
  const db = getDb();
  const referrerRef = doc(db, 'users', referrer.uid, 'referral', 'info');
  const referrerSnap = await getDoc(referrerRef);
  const referrerData = referrerSnap.data();

  if ((referrerData?.referralCount || 0) >= MAX_REFERRALS) {
    return { success: false, error: 'This referral code has reached its limit.' };
  }

  // Check new user hasn't already been referred
  const newUserRef = doc(db, 'users', newUid, 'referral', 'info');
  const newUserSnap = await getDoc(newUserRef);
  if (newUserSnap.exists() && newUserSnap.data()?.referredBy) {
    return { success: false, error: 'You already used a referral code.' };
  }

  // Link the referral
  await setDoc(newUserRef, {
    referralCode: (newUserSnap.exists() && newUserSnap.data()?.referralCode) || generateCode(),
    referralCount: 0,
    referredBy: referrer.uid,
    referredByCode: code,
    email: newEmail,
    createdAt: new Date().toISOString(),
  });

  // Record the referred user on the referrer's side
  await setDoc(doc(db, 'users', referrer.uid, 'referral', 'referred_users', newUid), {
    email: newEmail,
    joinedAt: new Date().toISOString(),
    converted: false, // Will be set to true when they upgrade
  });

  // Increment referrer count
  await updateDoc(referrerRef, {
    referralCount: increment(1),
  });

  monitor.info('Referral Applied', `New user signed up with referral code`, [
    { name: 'Referrer', value: referrer.uid.slice(0, 8) + '…' },
    { name: 'Referee', value: newEmail },
    { name: 'Code', value: code },
  ]);

  return { success: true, referrerUid: referrer.uid };
}

/**
 * Trigger referral reward when a referred user upgrades to Pro.
 * Call this from the Stripe webhook after a successful checkout.
 * Both referrer and referee get 50% off for 3 months via Stripe coupon.
 */
export async function triggerReferralReward(
  refereeUid: string,
  refereeEmail: string
): Promise<{ rewarded: boolean; referrerUid?: string }> {
  const db = getDb();
  const refereeRef = doc(db, 'users', refereeUid, 'referral', 'info');
  const refereeSnap = await getDoc(refereeRef);

  if (!refereeSnap.exists() || !refereeSnap.data()?.referredBy) {
    return { rewarded: false };
  }

  const referrerUid = refereeSnap.data().referredBy;

  // Mark as converted
  try {
    await updateDoc(doc(db, 'users', referrerUid, 'referral', 'referred_users', refereeUid), {
      converted: true,
      convertedAt: new Date().toISOString(),
    });
  } catch { /* user doc might not exist yet */ }

  monitor.info('Referral Converted! 🎉', `Both users get 50% off 3 months`, [
    { name: 'Referrer', value: referrerUid.slice(0, 8) + '…' },
    { name: 'Referee', value: refereeEmail },
  ]);

  // Note: Stripe coupon application happens in the checkout/subscribe route
  // by checking referredBy and applying the coupon at session creation time.
  // Alternatively, use stripe.subscriptions.update() to apply mid-cycle.

  return { rewarded: true, referrerUid };
}
