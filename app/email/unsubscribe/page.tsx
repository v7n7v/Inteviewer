'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type State = 'checking' | 'ready' | 'saving' | 'success' | 'error';

function UnsubscribeForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [state, setState] = useState<State>('checking');
  const [category, setCategory] = useState('this category');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const response = await fetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { preference?: string; error?: string };
      if (cancelled) return;
      if (!response.ok) {
        setError(payload.error || 'This unsubscribe link is invalid or expired.');
        setState('error');
        return;
      }
      setCategory(preferenceLabel(payload.preference));
      setState('ready');
    }
    if (token) void check();
    else { setError('This unsubscribe link is incomplete.'); setState('error'); }
    return () => { cancelled = true; };
  }, [token]);

  async function unsubscribe() {
    setState('saving');
    const response = await fetch('/api/email/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(payload.error || 'Your preference could not be updated.');
      setState('error');
      return;
    }
    setState('success');
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-7 shadow-2xl sm:p-9" aria-labelledby="unsubscribe-title">
        <img src="/brand/talentconsulting-logo-email.png" alt="TalentConsulting.io" className="mb-8 h-auto w-56 max-w-full" />
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">Email preferences</p>
        <h1 id="unsubscribe-title" className="text-2xl font-bold">Unsubscribe from {category}</h1>
        {state === 'checking' ? <p className="mt-5 text-sm text-slate-300" role="status">Checking your secure link…</p> : null}
        {state === 'ready' || state === 'saving' ? (
          <div className="mt-5">
            <p className="text-sm leading-6 text-slate-300">You will stop receiving {category}. Required account, security, billing, and service messages are not affected.</p>
            <button type="button" onClick={unsubscribe} disabled={state === 'saving'} className="mt-6 min-h-12 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold hover:bg-indigo-400 disabled:opacity-60">
              {state === 'saving' ? 'Updating preference…' : 'Confirm unsubscribe'}
            </button>
          </div>
        ) : null}
        {state === 'success' ? <p className="mt-5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100" role="status">Your preference was updated successfully.</p> : null}
        {state === 'error' ? <p className="mt-5 rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100" role="alert">{error}</p> : null}
        <Link href="/suite/settings?tab=notifications" className="mt-7 inline-flex text-sm font-semibold text-indigo-300 underline underline-offset-4">Review all email preferences</Link>
      </section>
    </main>
  );
}

function preferenceLabel(value?: string): string {
  return ({
    jobDigest: 'Career Picks by Taco', studyReminders: 'study reminders', applicationUpdates: 'application updates',
    interviewReminders: 'interview reminders', offerUpdates: 'offer updates', weeklyRecap: 'weekly recaps', marketing: 'marketing email',
  } as Record<string, string>)[value || ''] || 'this email category';
}

export default function UnsubscribePage() {
  return <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-300">Checking your secure link…</main>}><UnsubscribeForm /></Suspense>;
}
