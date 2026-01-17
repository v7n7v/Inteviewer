'use client';

import { useState } from 'react';
import { authHelpers } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';

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
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

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
        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }

        const { data, error } = await authHelpers.signUp(
          formData.email,
          formData.password,
          formData.name
        );

        if (error) throw error;

        // Show OTP verification screen
        setShowOTPVerification(true);
        showToast('Verification code sent to your email!', '📧');
      } else {
        if (!formData.email || !formData.password) {
          setError('Please fill in all fields');
          setLoading(false);
          return;
        }

        const { data, error } = await authHelpers.signIn(
          formData.email,
          formData.password
        );

        if (error) {
          if (error.message.includes('Email not confirmed')) {
            throw new Error('Please verify your email first.');
          } else if (error.message.includes('Invalid login credentials')) {
            throw new Error('Invalid email or password.');
          } else {
            throw error;
          }
        }

        setUser(data.user);
        showToast('Welcome back!', '👋');
        onClose();
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await authHelpers.verifyOTP(formData.email, otpCode);
      if (error) throw error;

      if (data.user) {
        setUser(data.user);
        showToast('Email verified! Welcome!', '✅');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setError('');

    try {
      const { error } = await authHelpers.resendOTP(formData.email);
      if (error) throw error;
      showToast('New code sent!', '📧');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setOauthLoading(true);
    setError('');

    try {
      const { error } = await authHelpers.signInWithGoogle();
      if (error) throw error;
    } catch (err: any) {
      console.error('OAuth error:', err);
      setError(err.message || 'Failed to sign in with Google');
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
      showToast('Password reset email sent!', '📧');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  // OTP Verification Screen
  if (showOTPVerification) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📧</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Verify Your Email</h2>
            <p className="text-slate-400">
              We sent a verification code to <strong className="text-cyan-400">{formData.email}</strong>
            </p>
          </div>

          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Verification Code</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full rounded-xl px-4 py-4 bg-white/5 border border-white/10 text-white text-center text-2xl tracking-[0.3em] font-mono focus:outline-none focus:border-cyan-500/50"
                placeholder="00000000"
                maxLength={8}
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={loading}
                className="text-sm text-cyan-400 hover:underline"
              >
                Didn't receive code? Resend
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setShowOTPVerification(false); setOtpCode(''); setError(''); }}
              className="w-full text-sm text-slate-400 hover:text-white"
            >
              ← Back to Sign Up
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
              <span className="text-4xl">📧</span>
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
            <span>🔑</span> Reset Password
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
          <span>{mode === 'login' ? '🔐' : '✨'}</span>
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
            <span className="px-4 bg-slate-900 text-slate-400">or continue with email</span>
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
              placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter password'}
              disabled={loading}
            />
          </div>

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
