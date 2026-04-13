'use client';

/**
 * ProGate — Blocks free-tier users from accessing Pro-only pages/features.
 * Shows a premium upgrade wall with benefit highlights and a CTA to /suite/upgrade.
 * Usage: wrap any Pro-only page content with <ProGate feature="Skill Bridge">...</ProGate>
 */
import { useRouter } from 'next/navigation';
import { useUserTier } from '@/hooks/use-user-tier';
import { motion } from 'framer-motion';

interface ProGateProps {
  feature: string;
  description?: string;
  children: React.ReactNode;
}

const GATE_BENEFITS = [
  { icon: 'bolt', color: '#f59e0b', text: '3× AI volume on every tool' },
  { icon: 'all_inclusive', color: '#10b981', text: 'Unlimited uses — no lifetime caps' },
  { icon: 'mic', color: '#a855f7', text: 'Voice features included' },
  { icon: 'trending_up', color: '#3b82f6', text: 'Priority AI queue' },
  { icon: 'verified_user', color: '#06b6d4', text: 'Priority support' },
];

export default function ProGate({ feature, description, children }: ProGateProps) {
  const { isPro, loading } = useUserTier();
  const router = useRouter();

  // Still loading tier — render nothing to avoid flash
  if (loading) return null;

  // Pro/GOD — render children normally
  if (isPro) return <>{children}</>;

  // Free user — show upgrade wall
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full text-center"
      >
        {/* Lock icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 8px 32px rgba(16,185,129,0.3)' }}
        >
          <span className="material-symbols-rounded text-white text-[32px]">lock</span>
        </div>

        {/* Headline */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-4"
          style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
          <span className="material-symbols-rounded text-[12px]">bolt</span>
          PRO FEATURE
        </div>

        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          {feature} is Pro only
        </h2>
        <p className="text-[var(--text-secondary)] text-sm mb-8 leading-relaxed">
          {description || `Upgrade to Talent Pro to unlock ${feature} and every other AI-powered tool with no limits.`}
        </p>

        {/* Benefits */}
        <div className="space-y-3 mb-8 text-left">
          {GATE_BENEFITS.map((b) => (
            <div key={b.text} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${b.color}18`, color: b.color }}>
                <span className="material-symbols-rounded text-[16px]">{b.icon}</span>
              </div>
              <span className="text-sm text-[var(--text-primary)]">{b.text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => router.push('/suite/upgrade')}
          className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}
        >
          <span className="material-symbols-rounded text-[18px]">bolt</span>
          Upgrade to Pro — $4.99/mo
        </button>

        <p className="text-[11px] text-[var(--text-muted)] mt-3">
          Cancel anytime · No hidden fees · Billed via Stripe
        </p>
      </motion.div>
    </div>
  );
}
