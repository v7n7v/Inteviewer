'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { useTheme } from '@/components/ThemeProvider';
import { authFetch } from '@/lib/auth-fetch';
import { useRouter } from 'next/navigation';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type BillingInterval = 'month' | 'year';

const PLANS = {
  month: {
    price: '$4.99',
    period: '/mo',
    label: 'Monthly',
    savings: '',
    billed: 'Billed monthly — cancel anytime',
    callout: 'Less than your morning coffee ☕',
  },
  year: {
    price: '$49.99',
    period: '/yr',
    label: 'Annual',
    savings: 'Save 17%',
    billed: 'Billed once a year — $4.17/mo effective',
    callout: '2 months free vs. monthly billing',
  },
} as const;

const PRO_FEATURES = [
  {
    icon: 'bolt',
    color: '#f59e0b',
    title: '3× AI Speed & Volume',
    desc: 'Triple the rate limits across all tools — morph more resumes, run more interviews, analyze more JDs.',
  },
  {
    icon: 'auto_awesome',
    color: '#3b82f6',
    title: 'Resume AI Morphing — Unlimited',
    desc: 'Tailor your resume to any job description with one click. Free users get 2 morphs/min, Pro gets 10.',
  },
  {
    icon: 'mic',
    color: '#a855f7',
    title: 'Full Interview Simulator',
    desc: 'Unlimited AI interview sessions with voice feedback, scoring, and personalized weak-area reports.',
  },
  {
    icon: 'route',
    color: '#10b981',
    title: 'Skill Bridge — Priority Access',
    desc: 'Generate learning paths for any skill gap. Pro members get priority AI queue and more plans per session.',
  },
  {
    icon: 'troubleshoot',
    color: '#a855f7',
    title: 'Market Oracle — Full Intel',
    desc: 'Decode any job description: fit score, salary range, red flags, and bridge skills — no daily cap.',
  },
  {
    icon: 'folder_open',
    color: '#f97316',
    title: 'Unlimited Study Vault',
    desc: 'Save every coaching note, study plan, and interview feedback. Free users get capped vault exports.',
  },
  {
    icon: 'work',
    color: '#22c55e',
    title: 'Applications Tracker',
    desc: 'Track unlimited job applications, interview stages, and follow-up reminders across every company.',
  },
  {
    icon: 'verified_user',
    color: '#06b6d4',
    title: 'Priority Support',
    desc: 'Jump the support queue. Get direct help from the team when you need it most.',
  },
];

const FREE_LIMITS = [
  { label: 'Resume morphs', free: '3 lifetime', pro: 'Unlimited' },
  { label: 'Interview sessions', free: '3 lifetime', pro: 'Unlimited' },
  { label: 'Market Oracle queries', free: '3 lifetime', pro: 'Unlimited' },
  { label: 'JD generations', free: '3 lifetime', pro: 'Unlimited' },
  { label: 'Cover letters', free: '3 lifetime', pro: 'Unlimited' },
  { label: 'Voice features', free: 'Not included', pro: 'Included' },
  { label: 'Study Vault exports', free: '3 lifetime', pro: 'Unlimited' },
  { label: 'Priority AI queue', free: '—', pro: '✓ Included' },
  { label: 'Priority support', free: '—', pro: '✓ Included' },
];

export default function UpgradePage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createCheckoutSession = useCallback(async (selectedInterval: BillingInterval) => {
    setLoading(true);
    setError('');
    setClientSecret(null);
    try {
      const res = await authFetch('/api/stripe/subscribe', {
        method: 'POST',
        body: JSON.stringify({ interval: selectedInterval }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize payment');
      if (!data.clientSecret) throw new Error('No client secret returned');
      setClientSecret(data.clientSecret);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    createCheckoutSession(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleIntervalChange = (newInterval: BillingInterval) => {
    if (newInterval === interval) return;
    setInterval(newInterval);
    createCheckoutSession(newInterval);
  };

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row"
      style={{ background: isLight ? '#F8FAFC' : '#060608' }}
    >

      {/* ───── LEFT PANEL ───── */}
      <div className="w-full lg:w-[55%] px-6 sm:px-10 lg:px-14 py-10 lg:py-14 flex flex-col overflow-y-auto">

        {/* Back */}
        <button
          onClick={() => router.push('/suite')}
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-8 w-fit"
        >
          <span className="material-symbols-rounded text-[16px]">arrow_back</span>
          Back to Dashboard
        </button>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold mb-4"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
            <span className="material-symbols-rounded text-[12px]">bolt</span>
            TALENT STUDIO PRO
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-3 leading-tight">
            Supercharge your<br />career intelligence
          </h1>
          <p className="text-[var(--text-secondary)] text-base max-w-md">
            Every tool. No daily caps. 3× faster AI. Your unfair advantage in the job market — for less than a cup of coffee a week.
          </p>
        </motion.div>

        {/* Billing Toggle */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mb-8">
          <div
            className="inline-flex p-1 rounded-xl gap-1"
            style={{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}
          >
            {(['month', 'year'] as BillingInterval[]).map((int) => (
              <button
                key={int}
                onClick={() => handleIntervalChange(int)}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all relative ${
                  interval === int
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {PLANS[int].label} — {PLANS[int].price}{PLANS[int].period}
                {int === 'year' && (
                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    interval === 'year' ? 'bg-white/25 text-white' : 'bg-emerald-500/15 text-emerald-500'
                  }`}>
                    {PLANS[int].savings}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-emerald-500 mt-2 ml-1 flex items-center gap-1">
            <span className="material-symbols-rounded text-[13px]">
              {interval === 'year' ? 'trending_down' : 'local_cafe'}
            </span>
            {PLANS[interval].callout}
          </p>
        </motion.div>

        {/* Feature Grid */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mb-8">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Everything included in Pro</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRO_FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.04 }}
                className="p-4 rounded-xl flex items-start gap-3"
                style={{
                  background: isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)'}`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${f.color}18`, color: f.color }}
                >
                  <span className="material-symbols-rounded text-[18px]">{f.icon}</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">{f.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Free vs Pro comparison table */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mb-6">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Free vs Pro at a glance</h2>
          <div className="rounded-xl overflow-hidden border"
            style={{ borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)' }}>
                  <th className="text-left px-4 py-2.5 text-[var(--text-muted)] text-xs font-medium">Feature</th>
                  <th className="text-center px-4 py-2.5 text-[var(--text-muted)] text-xs font-medium">Free</th>
                  <th className="text-center px-4 py-2.5 text-emerald-500 text-xs font-bold">Pro</th>
                </tr>
              </thead>
              <tbody>
                {FREE_LIMITS.map((row, i) => (
                  <tr key={row.label} style={{ borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}` }}>
                    <td className="px-4 py-2.5 text-[var(--text-primary)] text-xs">{row.label}</td>
                    <td className="px-4 py-2.5 text-center text-[var(--text-muted)] text-xs">{row.free}</td>
                    <td className="px-4 py-2.5 text-center text-emerald-500 text-xs font-semibold">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

      </div>

      {/* ───── RIGHT PANEL: Stripe Checkout ───── */}
      <div
        className="w-full lg:w-[45%] px-6 sm:px-10 lg:px-12 py-10 lg:py-14 flex flex-col justify-start lg:sticky lg:top-0 lg:h-screen"
        style={{
          background: isLight ? '#FFFFFF' : '#0A0A0C',
          borderLeft: `1px solid ${isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)'}`,
        }}
      >
        <div className="max-w-sm mx-auto w-full">

          {/* Plan summary card */}
          <div
            className="p-5 rounded-2xl mb-6"
            style={{
              background: isLight ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.07)',
              border: '1px solid rgba(16,185,129,0.18)',
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-0.5">You're getting</p>
                <p className="text-base font-bold text-[var(--text-primary)]">Talent Studio Pro</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-emerald-500">{PLANS[interval].price}</p>
                <p className="text-[11px] text-[var(--text-muted)]">{PLANS[interval].period}</p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-2 border-t pt-2"
              style={{ borderColor: 'rgba(16,185,129,0.15)' }}>
              {PLANS[interval].billed}
            </p>
          </div>

          {/* Checkout iframe */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-7 h-7 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
              <p className="text-sm text-[var(--text-secondary)]">Preparing secure checkout...</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-rounded text-red-500">error</span>
              </div>
              <p className="text-sm text-red-500 mb-4">{error}</p>
              <button
                onClick={() => createCheckoutSession(interval)}
                className="text-sm font-medium text-emerald-500 hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {clientSecret && !loading && (
            <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
              <EmbeddedCheckout className="stripe-checkout-embed" />
            </EmbeddedCheckoutProvider>
          )}

          <p className="text-[11px] text-center text-[var(--text-muted)] mt-6 flex justify-center items-center gap-1.5">
            <span className="material-symbols-rounded text-[13px]">lock</span>
            Secure · Powered by Stripe · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}
