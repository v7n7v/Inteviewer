'use client';

/**
 * UpgradeBanner — Pro plan upgrade prompt
 * Shows current plan, upgrade button, and manage subscription link.
 * Navigates to full-page /suite/upgrade instead of opening a modal.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuth } from 'firebase/auth';
import { useRouter } from 'next/navigation';

interface UpgradeBannerProps {
  currentTier?: 'free' | 'pro' | 'god';
  compact?: boolean;
}

export default function UpgradeBanner({ currentTier = 'free', compact = false }: UpgradeBannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleUpgrade = () => {
    router.push('/suite/upgrade');
  };

  const handleManage = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Failed to open subscription portal');
    } finally {
      setLoading(false);
    }
  };

  // Pro user — show status + manage link
  if (currentTier === 'pro' || currentTier === 'god') {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-emerald-400">Pro Plan Active</span>
        </div>
        <p className="text-[11px] text-[var(--theme-text-tertiary)] mb-2">3x rate limits • Priority support</p>
        <button
          onClick={handleManage}
          disabled={loading}
          className="text-[11px] text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-secondary)] transition-colors underline underline-offset-2"
        >
          {loading ? 'Opening...' : 'Manage Subscription'}
        </button>
      </div>
    );
  }

  // Free user — show upgrade CTA
  if (compact) {
    return (
      <button
        onClick={handleUpgrade}
        className="w-full text-[11px] font-medium text-black bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 px-3 py-1.5 rounded-lg transition-all"
      >
        <span className="material-symbols-rounded align-middle mr-1">bolt</span> Upgrade to Pro — $2.99/mo
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-card)] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm"><span className="material-symbols-rounded">bolt</span></span>
        <span className="text-xs font-semibold">Upgrade to Pro</span>
      </div>

      <ul className="space-y-1 mb-3">
        {['3x rate limits on all tools', 'Priority AI processing', 'Advanced analytics'].map(f => (
          <li key={f} className="flex items-center gap-1.5 text-[11px] text-[var(--theme-text-tertiary)]">
            <svg className="w-3 h-3 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={handleUpgrade}
        className="w-full text-xs font-medium text-black bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1"
      >
        Get Pro — $2.99/mo
      </button>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[10px] text-red-400 mt-2 text-center"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <p className="text-[10px] text-[var(--theme-text-tertiary)] text-center mt-2">
        Cancel anytime • Powered by Stripe
      </p>
    </div>
  );
}
