'use client';

/**
 * Upgrade Page — Full-page Stripe Embedded Checkout
 * Split-screen: left side = plan details & features, right side = checkout form.
 * Replaces the narrow modal with a spacious, premium upgrade experience.
 */
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
  month: { price: '$2.99', period: '/mo', label: 'Monthly', savings: '', effective: '$2.99/mo', tagline: 'Less than a cup of coffee ☕' },
  year: { price: '$24.99', period: '/yr', label: 'Annual', savings: 'Save 30%', effective: '$2.08/mo', tagline: 'Just $0.07/day — less than a penny per feature' },
} as const;

const PRO_FEATURES = [
  { icon: '⚡', title: '3x Rate Limits', desc: 'Triple the speed on all AI tools — morph, interview, and analyze faster.' },
  { icon: '🎯', title: 'Priority AI Queue', desc: 'Skip the line. Your requests are processed before free-tier users.' },
  { icon: '📊', title: 'Advanced Analytics', desc: 'Deep insights into your job search trends, success rates, and patterns.' },
  { icon: '🔓', title: 'Premium Templates', desc: 'Access exclusive, recruiter-approved resume templates that stand out.' },
  { icon: '💬', title: '3x Sona Chat', desc: 'More conversations with your AI career companion — personalized advice.' },
  { icon: '🛡️', title: 'Priority Support', desc: 'Fast-track support when you need help with your career platform.' },
];

const TESTIMONIALS = [
  { name: 'Sarah M.', role: 'Software Engineer', text: 'Landed my dream job at a FAANG company. The AI interview prep was a game-changer.' },
  { name: 'James K.', role: 'Product Manager', text: 'The resume morphing feature alone is worth 10x the price. Every application is now tailored.' },
  { name: 'Priya R.', role: 'Data Scientist', text: 'I went from 2% callback rate to 15% after using the Pro resume templates and Sona\'s advice.' },
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
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: isLight ? '#F8FAFC' : '#050505' }}>

      {/* ───── LEFT PANEL: Plan Details ───── */}
      <div className="w-full lg:w-1/2 px-6 sm:px-10 lg:px-16 py-10 lg:py-16 flex flex-col">

        {/* Back button */}
        <button
          onClick={() => router.push('/suite')}
          className="flex items-center gap-2 text-sm text-[var(--theme-text-secondary)] hover:text-[var(--theme-text)] transition-colors mb-8 w-fit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-lg">
              ⚡
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Upgrade to Pro</h1>
              <p className="text-sm text-[var(--theme-text-secondary)]">Supercharge your career with AI</p>
            </div>
          </div>
        </motion.div>

        {/* Plan Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div
            className="inline-flex p-1.5 rounded-xl"
            style={{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}
          >
            {(['month', 'year'] as BillingInterval[]).map((int) => (
              <button
                key={int}
                onClick={() => handleIntervalChange(int)}
                className={`py-3 px-6 rounded-lg text-sm font-semibold transition-all ${
                  interval === int
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text)]'
                }`}
              >
                {PLANS[int].label} — {PLANS[int].price}{PLANS[int].period}
                {int === 'year' && (
                  <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    interval === 'year'
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-500/15 text-emerald-500'
                  }`}>
                    {PLANS[int].savings}
                  </span>
                )}
              </button>
            ))}
          </div>

          {interval === 'year' && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-emerald-500 mt-2 ml-2"
            >
              💰 That's just $0.07/day — save $10.89 vs monthly
            </motion.p>
          )}
          {interval === 'month' && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-emerald-500 mt-2 ml-2"
            >
              ☕ Less than a single cup of coffee — cancel anytime
            </motion.p>
          )}
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"
        >
          {PRO_FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.05 }}
              className="p-4 rounded-xl"
              style={{
                background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{f.icon}</span>
                <div>
                  <h3 className="text-sm font-semibold mb-0.5">{f.title}</h3>
                  <p className="text-xs text-[var(--theme-text-secondary)] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-3 mt-auto"
        >
          <p className="text-xs font-semibold text-[var(--theme-text-secondary)] uppercase tracking-wider">
            What Pro users say
          </p>
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="p-3 rounded-lg text-xs"
              style={{
                background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
              }}
            >
              <p className="text-[var(--theme-text-secondary)] italic mb-1.5">"{t.text}"</p>
              <p className="font-semibold">{t.name} <span className="font-normal text-[var(--theme-text-tertiary)]">— {t.role}</span></p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ───── RIGHT PANEL: Stripe Checkout ───── */}
      <div
        className="w-full lg:w-1/2 px-6 sm:px-10 lg:px-16 py-10 lg:py-16 flex flex-col justify-center"
        style={{
          background: isLight ? '#FFFFFF' : '#0A0A0A',
          borderLeft: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
        }}
      >
        <div className="max-w-md mx-auto w-full">
          {/* Selected plan summary */}
          <div
            className="p-5 rounded-xl mb-6"
            style={{
              background: isLight ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.15)',
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold">TalentConsulting Pro</span>
              <span className="text-lg font-bold text-emerald-500">
                {PLANS[interval].price}<span className="text-xs font-normal">{PLANS[interval].period}</span>
              </span>
            </div>
            <p className="text-xs text-[var(--theme-text-secondary)]">
              {interval === 'year'
                ? 'Billed annually at $24.99 • Just $0.07/day'
                : `Billed monthly at $2.99 — ${PLANS.month.tagline}`}
            </p>
          </div>

          {/* Checkout form */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
              <p className="text-sm text-[var(--theme-text-secondary)]">Preparing secure checkout...</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
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
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ clientSecret }}
            >
              <EmbeddedCheckout className="stripe-checkout-embed" />
            </EmbeddedCheckoutProvider>
          )}

          <p className="text-[11px] text-center text-[var(--theme-text-tertiary)] mt-6">
            🔒 Secure payment powered by Stripe • Cancel anytime • No hidden fees
          </p>
        </div>
      </div>
    </div>
  );
}
