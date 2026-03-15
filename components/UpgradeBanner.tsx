'use client';

/**
 * UpgradeBanner — Pro plan upgrade prompt
 * Shows current plan, upgrade button, and manage subscription link.
 * Place in suite sidebar or settings page.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuth } from 'firebase/auth';

interface UpgradeBannerProps {
  currentTier?: 'free' | 'pro';
  compact?: boolean;
}

export default function UpgradeBanner({ currentTier = 'free', compact = false }: UpgradeBannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpgrade = async () => {
    setLoading(true);
    setError('');

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setError('Please sign in first');
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to start checkout');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
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
  if (currentTier === 'pro') {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-emerald-400">Pro Plan Active</span>
        </div>
        <p className="text-[11px] text-white/30 mb-2">3x rate limits • Priority support</p>
        <button
          onClick={handleManage}
          disabled={loading}
          className="text-[11px] text-white/40 hover:text-white/60 transition-colors underline underline-offset-2"
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
        disabled={loading}
        className="w-full text-[11px] font-medium text-black bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
      >
        {loading ? 'Loading...' : '⚡ Upgrade to Pro — $2.99/mo'}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">⚡</span>
        <span className="text-xs font-semibold text-white/80">Upgrade to Pro</span>
      </div>

      <ul className="space-y-1 mb-3">
        {['3x rate limits on all tools', 'Priority AI processing', 'Advanced analytics'].map(f => (
          <li key={f} className="flex items-center gap-1.5 text-[11px] text-white/40">
            <svg className="w-3 h-3 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="w-full text-xs font-medium text-black bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 px-4 py-2 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-1"
      >
        {loading ? (
          <span className="animate-spin">⏳</span>
        ) : (
          <>Get Pro — $2.99/mo</>
        )}
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

      <p className="text-[10px] text-white/15 text-center mt-2">
        Cancel anytime • Powered by Stripe
      </p>
    </div>
  );
}
