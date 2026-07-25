'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { PasswordValidationStatus } from 'firebase/auth';
import { authHelpers } from '@/lib/firebase';

type ActionMode = 'resetPassword' | 'verifyEmail' | 'recoverEmail' | 'verifyAndChangeEmail';
type ViewState = 'checking' | 'ready' | 'submitting' | 'success' | 'error';

function normalizeMode(value: string | null): ActionMode | null {
  return value === 'resetPassword' || value === 'verifyEmail' || value === 'recoverEmail' || value === 'verifyAndChangeEmail' ? value : null;
}

function actionCopy(mode: ActionMode | null) {
  if (mode === 'verifyEmail') {
    return {
      category: 'Email verification',
      title: 'Verify your email address',
      description: 'Confirm this email address for your TalentConsulting.io account.',
      button: 'Verify email address',
      successTitle: 'Email verified',
      successBody: 'Your email address has been verified. You can return to your account.',
    };
  }
  if (mode === 'recoverEmail') {
    return {
      category: 'Email recovery',
      title: 'Restore your email address',
      description: 'Undo the recent email-address change on your TalentConsulting.io account.',
      button: 'Restore email address',
      successTitle: 'Email address restored',
      successBody: 'Your previous email address has been restored. Review your security settings next.',
    };
  }
  if (mode === 'verifyAndChangeEmail') {
    return {
      category: 'Email security',
      title: 'Confirm your new email address',
      description: 'Finish changing the sign-in email for your TalentConsulting.io account.',
      button: 'Confirm email change',
      successTitle: 'Email address changed',
      successBody: 'Your new sign-in email is active. A security notice was sent to both the new and previous addresses.',
    };
  }
  return {
    category: 'Password security',
    title: 'Choose a new password',
    description: 'Create a strong, unique password for your TalentConsulting.io account.',
    button: 'Reset password',
    successTitle: 'Password reset complete',
    successBody: 'Your new password is active. You can now sign in securely.',
  };
}

function policyMessages(status: PasswordValidationStatus): string[] {
  const messages: string[] = [];
  const policy = status.passwordPolicy;
  if (status.meetsMinPasswordLength === false) messages.push(`Use at least ${policy.customStrengthOptions.minPasswordLength || 6} characters.`);
  if (status.meetsMaxPasswordLength === false) messages.push(`Use no more than ${policy.customStrengthOptions.maxPasswordLength || 4096} characters.`);
  if (status.containsLowercaseLetter === false) messages.push('Add a lowercase letter.');
  if (status.containsUppercaseLetter === false) messages.push('Add an uppercase letter.');
  if (status.containsNumericCharacter === false) messages.push('Add a number.');
  if (status.containsNonAlphanumericCharacter === false) messages.push('Add a symbol.');
  return messages;
}

function friendlyActionError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  if (code === 'auth/expired-action-code') return 'This link has expired. Request a new email and try again.';
  if (code === 'auth/invalid-action-code') return 'This link is invalid or has already been used. Request a new email and try again.';
  if (code === 'auth/user-disabled') return 'This account is disabled. Contact support for help.';
  if (code === 'auth/weak-password') return 'This password does not meet the account security policy.';
  return 'This secure action could not be completed. Request a new email and try again.';
}

function ActionCodeForm() {
  const searchParams = useSearchParams();
  const mode = normalizeMode(searchParams.get('mode'));
  const code = searchParams.get('oobCode') || '';
  const actionState = searchParams.get('state') || '';
  const copy = actionCopy(mode);
  const [viewState, setViewState] = useState<ViewState>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [accountHint, setAccountHint] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function validateAction() {
      if (!mode || !code) {
        setError('This secure link is incomplete. Request a new email and try again.');
        setViewState('error');
        return;
      }

      const result = mode === 'resetPassword'
        ? await authHelpers.verifyPasswordResetCode(code)
        : await authHelpers.checkEmailActionCode(code);
      if (cancelled) return;
      if (result.error || !result.data) {
        setError(friendlyActionError(result.error));
        setViewState('error');
        return;
      }

      const email = 'email' in result.data
        ? result.data.email
        : result.data.data.email || result.data.data.previousEmail || '';
      setAccountHint(maskEmail(email));
      setViewState('ready');
    }
    void validateAction();
    return () => { cancelled = true; };
  }, [code, mode]);

  async function handlePasswordReset(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setViewState('submitting');
    const validation = await authHelpers.validateNewPassword(password);
    if (validation.error || !validation.data) {
      setError('The password policy could not be checked. Please try again.');
      setViewState('ready');
      return;
    }
    if (!validation.data.isValid) {
      setError(policyMessages(validation.data).join(' ') || 'Choose a stronger password.');
      setViewState('ready');
      return;
    }

    const result = await authHelpers.confirmPasswordReset(code, password);
    if (result.error) {
      setError(friendlyActionError(result.error));
      setViewState('ready');
      return;
    }
    setPassword('');
    setConfirmPassword('');
    setViewState('success');
  }

  async function handleEmailAction() {
    setError('');
    setViewState('submitting');
    const result = await authHelpers.applyEmailActionCode(code);
    if (result.error) {
      setError(friendlyActionError(result.error));
      setViewState('ready');
      return;
    }
    if (actionState) {
      await fetch('/api/auth/email-change/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: actionState }),
      }).catch(() => null);
    }
    setViewState('success');
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-2xl shadow-indigo-950/40" aria-labelledby="auth-action-title">
        <div className="border-b border-white/10 px-6 py-6 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="TalentConsulting.io home">
            <img src="/brand/talentconsulting-logo-email.png" alt="TalentConsulting.io" className="h-auto w-56 max-w-full" />
          </Link>
        </div>
        <div className="px-6 py-8 sm:px-8 sm:py-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">{copy.category}</p>
          <h1 id="auth-action-title" className="text-2xl font-bold tracking-tight sm:text-3xl">{viewState === 'success' ? copy.successTitle : copy.title}</h1>

          {viewState === 'checking' ? (
            <div className="mt-8" role="status" aria-live="polite">
              <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-indigo-500" />
              </div>
              <p className="text-sm text-slate-300">Checking your secure link…</p>
            </div>
          ) : null}

          {viewState === 'success' ? (
            <div className="mt-6" role="status" aria-live="polite">
              <div className="mb-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">{copy.successBody}</div>
              <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                Continue to sign in
              </Link>
            </div>
          ) : null}

          {viewState === 'error' ? (
            <div className="mt-6">
              <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm leading-6 text-red-100" role="alert">{error}</div>
              <Link href="/" className="mt-5 inline-flex text-sm font-semibold text-indigo-300 underline underline-offset-4">Return to sign in</Link>
            </div>
          ) : null}

          {(viewState === 'ready' || viewState === 'submitting') && mode === 'resetPassword' ? (
            <form className="mt-6 space-y-5" onSubmit={handlePasswordReset}>
              <p className="text-sm leading-6 text-slate-300">{copy.description}{accountHint ? ` Account: ${accountHint}` : ''}</p>
              <div>
                <label htmlFor="new-password" className="mb-2 block text-sm font-semibold text-slate-200">New password</label>
                <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={viewState === 'submitting'} required className="min-h-12 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60" />
              </div>
              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-sm font-semibold text-slate-200">Confirm new password</label>
                <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={viewState === 'submitting'} required className="min-h-12 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60" />
              </div>
              {error ? <p className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-100" role="alert">{error}</p> : null}
              <button type="submit" disabled={viewState === 'submitting'} className="min-h-12 w-full rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-wait disabled:opacity-60">
                {viewState === 'submitting' ? 'Resetting password…' : copy.button}
              </button>
            </form>
          ) : null}

          {(viewState === 'ready' || viewState === 'submitting') && mode && mode !== 'resetPassword' ? (
            <div className="mt-6">
              <p className="text-sm leading-6 text-slate-300">{copy.description}{accountHint ? ` Account: ${accountHint}` : ''}</p>
              {error ? <p className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-100" role="alert">{error}</p> : null}
              <button type="button" onClick={handleEmailAction} disabled={viewState === 'submitting'} className="mt-6 min-h-12 w-full rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-wait disabled:opacity-60">
                {viewState === 'submitting' ? 'Applying secure action…' : copy.button}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function maskEmail(value: string): string {
  const [local, domain] = value.split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 1)}${'*'.repeat(Math.min(5, Math.max(2, local.length - 1)))}@${domain}`;
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-slate-950 text-sm text-slate-300">Checking your secure link…</main>}>
      <ActionCodeForm />
    </Suspense>
  );
}
