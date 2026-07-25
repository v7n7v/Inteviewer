'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';

type AccountAction = 'deactivate' | 'delete';
type PageState = 'checking' | 'ready' | 'submitting' | 'success' | 'error';

function AccountActionContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [state, setState] = useState<PageState>('checking');
  const [action, setAction] = useState<AccountAction | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/account/lifecycle/confirm?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async response => ({ response, payload: await response.json() as { action?: AccountAction } }))
      .then(({ response, payload }) => {
        if (cancelled) return;
        if (!response.ok || !payload.action) throw new Error('invalid');
        setAction(payload.action);
        setState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setError('This confirmation link is invalid, expired, or already used.');
        setState('error');
      });
    return () => { cancelled = true; };
  }, [token]);

  async function confirm() {
    setState('submitting');
    const response = await fetch('/api/account/lifecycle/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    if (!response?.ok) {
      setError('This action could not be confirmed. The link may have expired or already been used.');
      setState('error');
      return;
    }
    setState('success');
  }

  const deleting = action === 'delete';
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-8" aria-labelledby="account-action-title">
        <Link href="/" aria-label="TalentConsulting.io home"><Image src="/brand/talentconsulting-logo-email.png" alt="TalentConsulting.io" width={448} height={88} className="h-auto w-56 max-w-full" priority /></Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">Account security</p>
        <h1 id="account-action-title" className="mt-2 text-2xl font-bold">
          {state === 'success' ? 'Request confirmed' : deleting ? 'Confirm permanent deletion' : 'Confirm account deactivation'}
        </h1>
        {state === 'checking' ? <p className="mt-5 text-sm text-slate-300" role="status">Checking your secure link…</p> : null}
        {state === 'ready' || state === 'submitting' ? (
          <div className="mt-5">
            <p className="text-sm leading-6 text-slate-300">{deleting
              ? 'Confirming records your permanent deletion request for secure processing under the retention policy. Data and access may not be recoverable after completion.'
              : 'Confirming pauses optional email and records your account as deactivated. Your retained data remains subject to the privacy policy.'}</p>
            <button type="button" onClick={confirm} disabled={state === 'submitting'} className={`mt-6 min-h-12 w-full rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-60 ${deleting ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-500 hover:bg-amber-400'}`}>
              {state === 'submitting' ? 'Confirming…' : deleting ? 'Confirm deletion request' : 'Deactivate my account'}
            </button>
          </div>
        ) : null}
        {state === 'success' ? <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100" role="status">{deleting ? 'Your deletion request is confirmed and queued for secure processing.' : 'Your account is deactivated and optional email is paused.'}</div> : null}
        {state === 'error' ? <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100" role="alert">{error}</div> : null}
        <Link href="/" className="mt-6 inline-flex text-sm font-semibold text-indigo-300 underline underline-offset-4">Return to TalentConsulting.io</Link>
      </section>
    </main>
  );
}

export default function AccountActionPage() {
  return <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-slate-950 text-sm text-slate-300">Checking your secure link…</main>}><AccountActionContent /></Suspense>;
}
