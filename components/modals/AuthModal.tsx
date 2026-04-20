'use client';

import { useState } from 'react';
import { authHelpers } from '@/lib/firebase';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import { analytics } from '@/lib/analytics';
import type { MultiFactorResolver } from 'firebase/auth';

interface AuthModalProps {
  mode: 'login' | 'signup';
  onClose: () => void;
  onSwitchMode: () => void;
}

export default function AuthModal({ mode, onClose, onSwitchMode }: AuthModalProps) {
  const { setUser } = useStore();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // MFA Challenge State (TOTP — Google Authenticator)
  const [showMFAChallenge, setShowMFAChallenge] = useState(false);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [totpCode, setTotpCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!formData.name || !formData.email || !formData.password) {
          setError('Please fill in all fields');
          setLoading(false);
          return;
        }
        if (formData.password.length < 10) {
          setError('Password must be at least 10 characters');
          setLoading(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }

        const { data, error } = await authHelpers.signUp(
          formData.email,
          formData.password,
          formData.name
        );

        if (error) throw error;

        if (data?.user) {
          setUser(data.user);
          analytics.signUp('email');
          showToast('Account created! Welcome!', 'check_circle');
          onClose();
        }
      } else {
        if (!formData.email || !formData.password) {
          setError('Please fill in all fields');
          setLoading(false);
          return;
        }

        const { data, error, mfaResolver: resolver } = await authHelpers.signIn(
          formData.email,
          formData.password
        );

        // MFA required — show authenticator code input
        if (resolver) {
          setMfaResolver(resolver);
          setShowMFAChallenge(true);
          setLoading(false);
          return;
        }

        if (error) {
          if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            throw new Error('Invalid email or password.');
          } else {
            throw error;
          }
        }

        if (data?.user) {
          setUser(data.user);
          analytics.login('email');
          showToast('Login successful!', 'check_circle');
          onClose();
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode || totpCode.length < 6) {
      setError('Please enter the 6-digit code from your authenticator app');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!mfaResolver) throw new Error('MFA session expired. Please try again.');

      const { data, error } = await authHelpers.resolveTOTPSignIn(
        mfaResolver,
        totpCode,
        0
      );

      if (error) throw error;

      if (data?.user) {
        setUser(data.user);
        analytics.login('mfa');
        showToast('Login successful!', 'check_circle');
        onClose();
      }
    } catch (err: any) {
      console.error('MFA verify error:', err);
      setError(err.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setOauthLoading(true);
    setError('');

    try {
      const { data, error } = await authHelpers.signInWithGoogle();
      if (error) throw error;
      if (data?.user) {
        setUser(data.user);
        analytics.signUp('google');
        showToast('Signed in with Google!', 'check_circle');
        onClose();
      }
    } catch (err: any) {
      console.error('OAuth error:', err);
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setOauthLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await authHelpers.resetPasswordForEmail(formData.email);
      if (error) throw error;

      setResetEmailSent(true);
      showToast('Password reset email sent!', 'mail');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // TOTP MFA VERIFICATION SCREEN
  // ============================================
  if (showMFAChallenge) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
              <span className="text-4xl">🔐</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Two-Factor Verification
            </h2>
            <p className="text-slate-400">
              Enter the 6-digit code from your <strong className="text-cyan-400">authenticator app</strong>
            </p>
          </div>

          <form onSubmit={handleMFAVerify} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Verification Code</label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-xl px-4 py-4 bg-white/5 border border-white/10 text-white text-center text-2xl tracking-[0.3em] font-mono focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                placeholder="000000"
                maxLength={6}
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || totpCode.length < 6}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Verify & Sign In'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowMFAChallenge(false);
                setTotpCode('');
                setError('');
                setMfaResolver(null);
              }}
              className="w-full text-sm text-slate-400 hover:text-white transition-colors"
            >
              ← Back to Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Password reset email sent screen
  if (resetEmailSent) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl"><span className="material-symbols-rounded">mail</span></span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Check Your Email!</h2>
            <p className="text-slate-400 mb-6">
              We've sent a password reset link to <strong className="text-cyan-400">{formData.email}</strong>
            </p>
            <button onClick={() => { setResetEmailSent(false); setShowForgotPassword(false); }} className="glass-button w-full">
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Forgot password form
  if (showForgotPassword) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md w-full">
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
            <span><span className="material-symbols-rounded">key</span></span> Reset Password
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Enter your email and we'll send you a reset link.
          </p>

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-lg px-4 py-3 bg-white/5 border border-white/10 text-white"
                placeholder="your@email.com"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => setShowForgotPassword(false)}
              className="w-full text-sm text-slate-400 hover:text-white"
            >
              ← Back to Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main login/signup form
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <span>{mode === 'login' ? '🔐' : <span className="material-symbols-rounded text-cyan-400">auto_awesome</span>}</span>
          {mode === 'login' ? 'Login to TalentConsulting.io' : 'Create Account'}
        </h2>

        {/* OAuth Buttons */}
        <div className="mb-6">
          <button
            onClick={handleGoogleAuth}
            disabled={oauthLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white text-gray-900 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {oauthLoading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continue with Google
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-[var(--bg-surface)] text-slate-400">or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm text-slate-400 mb-2">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg px-4 py-3 bg-white/5 border border-white/10 text-white"
                placeholder="John Doe"
                disabled={loading}
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg px-4 py-3 bg-white/5 border border-white/10 text-white"
              placeholder="your@email.com"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full rounded-lg px-4 py-3 bg-white/5 border border-white/10 text-white"
              placeholder={mode === 'signup' ? 'Min 10 characters' : 'Enter password'}
              disabled={loading}
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-sm text-slate-400 mb-2">Confirm Password</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full rounded-lg px-4 py-3 bg-white/5 border border-white/10 text-white"
                placeholder="Re-enter your password"
                disabled={loading}
              />
            </div>
          )}

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-cyan-400 hover:underline"
            >
              Forgot password?
            </button>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium disabled:opacity-50"
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Login' : 'Create Account'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 rounded-lg border border-white/10 text-white/70 hover:text-white hover:border-white/30"
            >
              Cancel
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={onSwitchMode} className="text-cyan-400 hover:underline font-medium">
            {mode === 'login' ? 'Sign up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
}
