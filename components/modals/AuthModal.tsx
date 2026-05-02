'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

/* ── Shared modal shell (defined outside component to preserve identity across renders) ── */
function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl overflow-hidden shadow-xl"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {children}
        </motion.div>
      </div>
    </AnimatePresence>
  );
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

  const inputClass = "w-full rounded-xl px-4 py-3 text-sm outline-none transition-all";
  const inputStyle = {
    background: 'var(--bg-input, var(--bg-hover))',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
  };

  // ── MFA VERIFICATION ──
  if (showMFAChallenge) {
    return (
      <ModalShell onClose={onClose}>
        <div className="p-6">
          <div className="text-center mb-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(245,158,11,0.1)' }}
            >
              <span className="material-symbols-rounded text-2xl" style={{ color: 'var(--warning)' }}>lock</span>
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Two-Factor Verification
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Enter the 6-digit code from your <strong style={{ color: 'var(--accent)' }}>authenticator app</strong>
            </p>
          </div>

          <form onSubmit={handleMFAVerify} className="space-y-4">
            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`${inputClass} text-center text-2xl tracking-[0.3em] font-mono`}
              style={inputStyle}
              placeholder="000000"
              maxLength={6}
              disabled={loading}
              autoFocus
            />

            {error && (
              <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || totpCode.length < 6}
              className="w-full py-3 text-sm transition-all disabled:opacity-50 btn-primary"
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>

            <button
              type="button"
              onClick={() => { setShowMFAChallenge(false); setTotpCode(''); setError(''); setMfaResolver(null); }}
              className="w-full text-sm font-medium transition-colors hover:underline"
              style={{ color: 'var(--text-secondary)' }}
            >
              ← Back to Login
            </button>
          </form>
        </div>
      </ModalShell>
    );
  }

  // ── PASSWORD RESET SENT ──
  if (resetEmailSent) {
    return (
      <ModalShell onClose={onClose}>
        <div className="p-6 text-center">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--accent-dim)' }}
          >
            <span className="material-symbols-rounded text-2xl" style={{ color: 'var(--accent)' }}>mail</span>
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Check Your Email!</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            We've sent a password reset link to <strong style={{ color: 'var(--accent)' }}>{formData.email}</strong>
          </p>
          <button
            onClick={() => { setResetEmailSent(false); setShowForgotPassword(false); }}
            className="w-full py-2.5 rounded-xl text-sm font-medium"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            Back to Login
          </button>
        </div>
      </ModalShell>
    );
  }

  // ── FORGOT PASSWORD ──
  if (showForgotPassword) {
    return (
      <ModalShell onClose={onClose}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-dim)' }}
            >
              <span className="material-symbols-rounded text-lg" style={{ color: 'var(--accent)' }}>key</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Reset Password</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Enter your email and we'll send you a reset link.</p>
            </div>
          </div>

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputClass}
                style={inputStyle}
                placeholder="your@email.com"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm disabled:opacity-50 btn-primary"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => setShowForgotPassword(false)}
              className="w-full text-sm font-medium transition-colors hover:underline"
              style={{ color: 'var(--text-secondary)' }}
            >
              ← Back to Login
            </button>
          </form>
        </div>
      </ModalShell>
    );
  }

  // ── MAIN LOGIN/SIGNUP ──
  return (
    <ModalShell onClose={onClose}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent-dim)' }}
          >
            <span className="material-symbols-rounded text-lg" style={{ color: 'var(--accent)' }}>
              {mode === 'login' ? 'lock_open' : 'auto_awesome'}
            </span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {mode === 'login' ? 'Welcome back' : 'Create Account'}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {mode === 'login' ? 'Sign in to your account' : 'Get started with TalentConsulting.io'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span className="material-symbols-rounded text-lg">close</span>
          </button>
        </div>

        {/* OAuth */}
        <button
          onClick={handleGoogleAuth}
          disabled={oauthLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 mb-4"
          style={{
            background: 'var(--bg-input, var(--bg-hover))',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          {oauthLoading ? (
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--text-primary)' }} />
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

        {/* Divider */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full" style={{ borderTop: '1px solid var(--border-subtle)' }} />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>or continue with email</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClass}
                style={inputStyle}
                placeholder="John Doe"
                disabled={loading}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={inputClass}
              style={inputStyle}
              placeholder="your@email.com"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className={inputClass}
              style={inputStyle}
              placeholder={mode === 'signup' ? 'Min 10 characters' : 'Enter password'}
              disabled={loading}
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Confirm Password</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className={inputClass}
                style={inputStyle}
                placeholder="Re-enter your password"
                disabled={loading}
              />
            </div>
          )}

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-xs font-medium hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              Forgot password?
            </button>
          )}

          {error && (
            <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-sm disabled:opacity-50 transition-all btn-primary"
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Login' : 'Create Account'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              Cancel
            </button>
          </div>
        </form>

        <p className="text-center text-xs mt-5" style={{ color: 'var(--text-muted)' }}>
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={onSwitchMode} className="font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            {mode === 'login' ? 'Sign up' : 'Login'}
          </button>
        </p>
      </div>
    </ModalShell>
  );
}
