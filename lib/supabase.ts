import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helpers
export const authHelpers = {
  async signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: undefined, // Don't use redirect, we'll verify with OTP
      },
    });
    return { data, error };
  },

  async verifyOTP(email: string, token: string, type: 'signup' | 'email' = 'signup') {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });
    return { data, error };
  },

  async resendOTP(email: string) {
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    return { data, error };
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  async signInWithOtp(email: string) {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Only allow login for existing users
      },
    });
    return { data, error };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  },

  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  async updateEmail(newEmail: string) {
    const { data, error } = await supabase.auth.updateUser({
      email: newEmail,
    });
    return { data, error };
  },

  async updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { data, error };
  },

  async verifyPassword(email: string, password: string) {
    // Use signInWithPassword to verify the current password
    // This creates a new session but confirms the password is correct
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { isValid: !error, error };
  },

  // OAuth Social Login
  async signInWithGoogle() {
    // Use NEXT_PUBLIC_SITE_URL for production, fallback to window.location.origin
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });
    return { data, error };
  },

  // Password Reset
  async resetPasswordForEmail(email: string) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/reset-password`,
    });
    return { data, error };
  },

  // MFA (Two-Factor Authentication)
  async enrollMFA() {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
    });
    return { data, error };
  },

  async verifyMFA(factorId: string, challengeId: string, code: string) {
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });
    return { data, error };
  },

  async challengeMFA(factorId: string) {
    const { data, error } = await supabase.auth.mfa.challenge({ factorId });
    return { data, error };
  },

  async unenrollMFA(factorId: string) {
    const { data, error } = await supabase.auth.mfa.unenroll({ factorId });
    return { data, error };
  },

  async getMFAFactors() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    return { data, error };
  },
};
