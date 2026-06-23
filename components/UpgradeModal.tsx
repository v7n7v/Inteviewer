'use client';

/**
 * UpgradeModal - In-app Stripe Embedded Checkout modal
 * Uses Stripe Embedded Checkout (ui_mode: 'embedded') for PCI-compliant payment.
 * Supports Stripe-sourced monthly and annual billing with plan toggle.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { useTheme } from '@/components/ThemeProvider';
import { authFetch } from '@/lib/auth-fetch';
import { useBillingPrices } from '@/hooks/use-billing-prices';
import { getPlanIdentity } from '@/lib/plan-identity';
import { PlanBadge } from '@/components/plan/PlanIdentity';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type BillingInterval = 'month' | 'year';

const PLAN_LABELS = {
  month: 'Monthly',
  year: 'Annual',
} as const;

const PRO_FEATURES = [
  { icon: 'bolt', text: 'Higher AI limits' },
  { icon: 'mic', text: 'Interview practice' },
  { icon: 'search', text: 'AI Detection (4K words/mo)' },
  { icon: 'edit_note', text: 'AI Humanizer (4K words/mo)' },
  { icon: 'speed', text: '3x faster AI processing' },
  { icon: 'download', text: 'Export to .docx' },
];

export default function UpgradeModal({ isOpen, onClose, onSuccess }: UpgradeModalProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { prices } = useBillingPrices();
  const proPlan = getPlanIdentity('pro');

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

      if (!res.ok) {
        throw new Error(data.error || 'Checkout is unavailable right now. Please try again.');
      }

      if (!data.clientSecret) {
        throw new Error('Checkout is unavailable right now. Please try again.');
      }

      setClientSecret(data.clientSecret);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      createCheckoutSession(interval);
    } else {
      setClientSecret(null);
      setError('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleIntervalChange = (newInterval: BillingInterval) => {
    if (newInterval === interval) return;
    setInterval(newInterval);
    createCheckoutSession(newInterval);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="icon-shell-neutral flex h-9 w-9 items-center justify-center rounded-[12px] border">
                  <span className="material-symbols-rounded text-lg">bolt</span>
                </span>
                <h2 className="text-xl font-bold">Upgrade to Pro</h2>
              </div>
              <PlanBadge tier="pro" active className="mb-3 mt-2" />
              <p className="text-sm text-[var(--theme-text-secondary)]">
                Higher limits and the full career writing workflow.
              </p>
            </div>

            {/* Plan toggle */}
            <div className="px-6 pb-4">
              <div
                className="flex p-1 rounded-xl"
                style={{
                  background: 'var(--bg-hover)',
                }}
              >
                {(['month', 'year'] as BillingInterval[]).map((int) => (
                  <button
                    key={int}
                    onClick={() => handleIntervalChange(int)}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all relative ${
                      interval === int
                        ? 'shadow-md'
                        : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text)]'
                    }`}
                    style={interval === int ? { background: proPlan.accent, color: proPlan.buttonText } : undefined}
                  >
                    {PLAN_LABELS[int]} - {prices.plans.pro[int].display}
                    {int === 'year' && prices.plans.pro[int].savingsLabel && (
                      <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        interval === 'year'
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)]'
                      }`}>
                        {prices.plans.pro[int].savingsLabel}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="px-6 pb-4">
              <div
                className="grid grid-cols-2 gap-2 p-3 rounded-xl"
                style={{
                  background: 'var(--bg-hover)',
                }}
              >
                {PRO_FEATURES.map((f) => (
                  <div key={f.text} className="flex items-center gap-2 text-xs text-[var(--theme-text-secondary)]">
                    <span className="material-symbols-rounded text-sm text-[var(--text-muted)]">{f.icon}</span>
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Checkout form */}
            <div className="px-6 pb-6">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div
                    className="w-6 h-6 border-2 rounded-full animate-spin"
                    style={{ borderColor: `color-mix(in srgb, ${proPlan.accent} 30%, transparent)`, borderTopColor: proPlan.accent }}
                  />
                </div>
              )}

              {error && !loading && (
                <div className="text-center py-8">
                  <p className="text-sm text-red-500 mb-3">{error}</p>
                  <button
                    onClick={() => createCheckoutSession(interval)}
                    className="text-sm hover:underline"
                    style={{ color: proPlan.accent }}
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
                  <div style={{ colorScheme: isLight ? 'light' : 'dark' }}>
                    <EmbeddedCheckout />
                  </div>
                </EmbeddedCheckoutProvider>
              )}
            </div>

            <p className="text-[11px] text-center text-[var(--theme-text-tertiary)] pb-4">
              Secure checkout by Stripe. Manage billing from Settings.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
