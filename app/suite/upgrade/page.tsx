'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { useTheme } from '@/components/ThemeProvider';
import { authFetch } from '@/lib/auth-fetch';
import { analytics } from '@/lib/analytics';
import { useRouter } from 'next/navigation';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type BillingInterval = 'month' | 'year';
type PlanOption = 'pro' | 'studio';

const PLAN_CONFIG = {
  pro: {
    month: {
      price: '$9.99', period: '/mo', label: 'Monthly',
      billed: 'Billed monthly — cancel anytime',
    },
    year: {
      price: '$99.99', period: '/yr', label: 'Annual', savings: 'Save 17%',
      billed: 'Billed annually — $8.33/mo effective',
    },
  },
  studio: {
    month: {
      price: '$19.99', period: '/mo', label: 'Monthly',
      billed: 'Billed monthly — cancel anytime',
    },
    year: {
      price: '$179.99', period: '/yr', label: 'Annual', savings: 'Save 25%',
      billed: 'Billed annually — $15.00/mo effective',
    },
  },
} as const;

const PRO_FEATURES = [
  { icon: 'bolt', color: '#f59e0b', title: '3× AI Speed & Volume', desc: 'Triple rate limits across all tools.' },
  { icon: 'auto_awesome', color: '#3b82f6', title: 'Resume AI Morphing — Unlimited', desc: 'Tailor your resume to any job description.' },
  { icon: 'mic', color: '#a855f7', title: 'Full Interview Simulator', desc: 'Unlimited AI interview sessions with voice.' },
  { icon: 'route', color: '#10b981', title: 'Skill Bridge — Priority Access', desc: 'Generate learning paths for any skill gap.' },
  { icon: 'troubleshoot', color: '#a855f7', title: 'Market Oracle — Full Intel', desc: 'Decode any JD: fit score, salary, red flags.' },
  { icon: 'folder_open', color: '#f97316', title: 'Unlimited Study Vault', desc: 'Save every coaching note and interview feedback.' },
  { icon: 'build', color: '#8b5cf6', title: 'Tools Gallery — Pro Tools', desc: 'Paraphraser, Email Composer, Thesis Generator.' },
  { icon: 'verified_user', color: '#06b6d4', title: 'Priority Support', desc: 'Jump the queue — direct help when you need it.' },
];

const STUDIO_EXTRAS = [
  { icon: 'auto_awesome', color: '#f43f5e', title: 'Sona AI Agent', desc: 'Context-aware career strategist — unlimited conversations.' },
  { icon: 'ink_pen', color: '#f43f5e', title: 'AI Humanizer', desc: '50,000 words/mo of AI-to-human rewriting with Gemini 3.' },
  { icon: 'verified', color: '#10b981', title: 'Uniqueness Verification', desc: 'AI-powered plagiarism pattern detection per document.' },
  { icon: 'download', color: '#3b82f6', title: 'Export to Word (.docx)', desc: 'Download formatted, submission-ready documents.' },
  { icon: 'radar', color: '#f59e0b', title: 'AI Detection Engine', desc: '100+ pattern heuristic analysis — instant, zero-cost.' },
];

const COMPARISON = [
  { label: 'Resume morphs', free: '3 lifetime', pro: 'Unlimited', studio: 'Unlimited' },
  { label: 'Interview sessions', free: '3 lifetime', pro: 'Unlimited', studio: 'Unlimited' },
  { label: 'Market Oracle', free: '3 lifetime', pro: 'Unlimited', studio: 'Unlimited' },
  { label: 'Gallery — Pro tools', free: '—', pro: '✓', studio: '✓' },
  { label: 'AI Detection', free: '—', pro: '4,000 words/mo', studio: '◆ Unlimited' },
  { label: 'AI Humanizer', free: '—', pro: '4,000 words/mo', studio: '◆ 50,000 words/mo' },
  { label: 'Uniqueness Check', free: '—', pro: '✓', studio: '✓' },
  { label: 'Export to .docx', free: '—', pro: '✓', studio: '✓' },
  { label: 'Priority support', free: '—', pro: '✓', studio: '✓ Priority+' },
];

export default function UpgradePage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [selectedPlan, setSelectedPlan] = useState<PlanOption>('studio');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createCheckoutSession = useCallback(async (plan: PlanOption, int: BillingInterval) => {
    setLoading(true);
    setError('');
    setClientSecret(null);
    try {
      const res = await authFetch('/api/stripe/subscribe', {
        method: 'POST',
        body: JSON.stringify({ interval: int, plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize payment');
      if (!data.clientSecret) throw new Error('No client secret returned');
      setClientSecret(data.clientSecret);
      const price = parseFloat(PLAN_CONFIG[plan][int].price.replace('$', ''));
      analytics.beginCheckout(plan, price);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    createCheckoutSession(selectedPlan, interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlanChange = (plan: PlanOption) => {
    if (plan === selectedPlan) return;
    setSelectedPlan(plan);
    createCheckoutSession(plan, interval);
  };

  const handleIntervalChange = (newInterval: BillingInterval) => {
    if (newInterval === interval) return;
    setInterval(newInterval);
    createCheckoutSession(selectedPlan, newInterval);
  };

  const planCfg = PLAN_CONFIG[selectedPlan][interval];
  const isStudio = selectedPlan === 'studio';

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
            style={{
              background: isStudio ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
              color: isStudio ? '#f43f5e' : '#10b981',
              border: `1px solid ${isStudio ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)'}`,
            }}>
            <span className="material-symbols-rounded text-[12px]">{isStudio ? 'ink_pen' : 'bolt'}</span>
            {isStudio ? 'TALENT MAX' : 'TALENT PRO'}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-3 leading-tight">
            {isStudio ? <>AI Writing +<br />Career Intelligence</> : <>Supercharge your<br />career intelligence</>}
          </h1>
          <p className="text-[var(--text-secondary)] text-base max-w-md">
            {isStudio
              ? 'Everything in Pro plus the AI Humanizer pipeline — 50K words/month of AI-to-human rewriting.'
              : 'Every tool. No daily caps. 3× faster AI. Your unfair advantage in the job market.'}
          </p>
        </motion.div>

        {/* Plan Selector */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="mb-6">
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {(['pro', 'studio'] as PlanOption[]).map(plan => {
              const active = selectedPlan === plan;
              const accent = plan === 'studio' ? '#f43f5e' : '#10b981';
              return (
                <motion.button
                  key={plan}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handlePlanChange(plan)}
                  className="p-4 rounded-xl text-left transition-all relative overflow-hidden"
                  style={{
                    background: active ? `${accent}12` : isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${active ? accent : isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: active ? `0 4px 20px ${accent}20` : 'none',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>
                      {plan === 'studio' ? 'Max' : 'Pro'}
                    </span>
                    {plan === 'studio' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <p className="text-xl font-black text-[var(--text-primary)]">
                    {PLAN_CONFIG[plan][interval].price}
                    <span className="text-sm font-normal text-[var(--text-secondary)]">{PLAN_CONFIG[plan][interval].period}</span>
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {plan === 'studio' ? 'Everything + 50K AI words/mo' : 'All career tools unlocked'}
                  </p>
                  {active && (
                    <motion.div
                      layoutId="plan-check"
                      className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: accent }}
                    >
                      <span className="text-white text-xs">✓</span>
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Billing Toggle */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <div
            className="inline-flex p-1 rounded-xl gap-1"
            style={{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}
          >
            {(['month', 'year'] as BillingInterval[]).map(int => {
              const accent = isStudio ? '#f43f5e' : '#10b981';
              return (
                <button
                  key={int}
                  onClick={() => handleIntervalChange(int)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all relative ${
                    interval === int
                      ? 'text-white shadow-lg'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  style={interval === int ? { backgroundColor: accent, boxShadow: `0 4px 14px ${accent}30` } : {}}
                >
                  {PLAN_CONFIG[selectedPlan][int].label} — {PLAN_CONFIG[selectedPlan][int].price}{PLAN_CONFIG[selectedPlan][int].period}
                  {int === 'year' && (
                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      interval === 'year' ? 'bg-white/25 text-white' : `text-[${accent}]`
                    }`}
                      style={interval !== 'year' ? { background: `${accent}18`, color: accent } : {}}
                    >
                      {(PLAN_CONFIG[selectedPlan][int] as any).savings}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs mt-2 ml-1 flex items-center gap-1"
            style={{ color: isStudio ? '#f43f5e' : '#10b981' }}>
            <span className="material-symbols-rounded text-[13px]">
              {interval === 'year' ? 'trending_down' : 'local_cafe'}
            </span>
            {planCfg.billed}
          </p>
        </motion.div>

        {/* Features */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mb-8">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            {isStudio ? 'Everything in Pro, plus:' : 'Everything included in Pro'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(isStudio ? STUDIO_EXTRAS : PRO_FEATURES).map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 + i * 0.04 }}
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

        {/* Comparison Table */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mb-6">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Plan comparison</h2>
          <div className="rounded-xl overflow-hidden border"
            style={{ borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)' }}>
                  <th className="text-left px-4 py-2.5 text-[var(--text-muted)] text-xs font-medium">Feature</th>
                  <th className="text-center px-3 py-2.5 text-[var(--text-muted)] text-xs font-medium">Free</th>
                  <th className="text-center px-3 py-2.5 text-emerald-500 text-xs font-bold">Pro</th>
                  <th className="text-center px-3 py-2.5 text-rose-400 text-xs font-bold">Max</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(row => (
                  <tr key={row.label} style={{ borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}` }}>
                    <td className="px-4 py-2.5 text-[var(--text-primary)] text-xs">{row.label}</td>
                    <td className="px-3 py-2.5 text-center text-[var(--text-muted)] text-xs">{row.free}</td>
                    <td className="px-3 py-2.5 text-center text-emerald-500 text-xs font-semibold">{row.pro}</td>
                    <td className="px-3 py-2.5 text-center text-rose-400 text-xs font-semibold">{row.studio}</td>
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
              background: isStudio ? 'rgba(244,63,94,0.05)' : 'rgba(16,185,129,0.05)',
              border: `1px solid ${isStudio ? 'rgba(244,63,94,0.18)' : 'rgba(16,185,129,0.18)'}`,
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-0.5">You're getting</p>
                <p className="text-base font-bold text-[var(--text-primary)]">
                  Talent {isStudio ? 'Max' : 'Pro'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black" style={{ color: isStudio ? '#f43f5e' : '#10b981' }}>
                  {planCfg.price}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">{planCfg.period}</p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-2 border-t pt-2"
              style={{ borderColor: isStudio ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)' }}>
              {planCfg.billed}
            </p>
          </div>

          {/* Checkout iframe */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-7 h-7 border-2 rounded-full animate-spin mb-4"
                style={{
                  borderColor: `${isStudio ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)'}`,
                  borderTopColor: isStudio ? '#f43f5e' : '#10b981',
                }}
              />
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
                onClick={() => createCheckoutSession(selectedPlan, interval)}
                className="text-sm font-medium hover:underline"
                style={{ color: isStudio ? '#f43f5e' : '#10b981' }}
              >
                Try again
              </button>
            </div>
          )}

          {clientSecret && !loading && (
            <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
              <div style={{ colorScheme: isStudio ? 'dark' : (theme === 'light' ? 'light' : 'dark') }}>
                <EmbeddedCheckout className="stripe-checkout-embed" />
              </div>
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
