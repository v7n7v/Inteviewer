'use client';

import { motion } from 'framer-motion';
import { useUserTier } from '@/hooks/use-user-tier';

const featureDisplayNames: Record<string, { label: string; icon: string }> = {
  morphs: { label: 'Resume Morphs', icon: 'description' },
  jdGenerations: { label: 'JD Generation', icon: 'work' },
  gauntlets: { label: 'Gauntlet Runs', icon: 'school' },
  resumeChecks: { label: 'Resume Check', icon: 'auto_awesome' }
};

export default function UsageCounter({ compact }: { compact?: boolean }) {
  const { isPro, usage, caps, loading } = useUserTier();

  // Hide the widget completely if the user is a Pro/God or if the data is loading
  if (isPro || loading || !caps) return null;

  const totalUsed = Object.keys(featureDisplayNames).reduce((sum, key) => sum + (usage[key as keyof typeof usage] || 0), 0);
  const totalCap = Object.keys(featureDisplayNames).reduce((sum, key) => sum + (caps[key] || 1), 0);
  const allExhausted = totalUsed >= totalCap;

  if (compact) {
    return (
      <div className="w-full px-3 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Usage</span>
          <span className={`text-[10px] font-mono font-medium ${allExhausted ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
            {totalUsed}/{totalCap}
          </span>
        </div>
        <div className="h-1.5 w-full bg-[var(--bg-hover)] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (totalUsed / totalCap) * 100)}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full rounded-full ${
              allExhausted
                ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                : 'bg-gradient-to-r from-cyan-400 to-blue-500'
            }`}
          />
        </div>
        {allExhausted && (
          <p className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
            <span className="material-symbols-rounded text-[12px]">warning</span>
            Free limit reached
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Free Tier Usage</h4>
      </div>

      <div className="space-y-3">
        {Object.entries(featureDisplayNames).map(([key, { label, icon }]) => {
          const used = usage[key as keyof typeof usage] || 0;
          const cap = caps[key] || 1;
          const percentage = Math.min(100, Math.max(0, (used / cap) * 100));
          
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                  <span className="material-symbols-rounded text-[14px] opacity-70">{icon}</span> {label}
                </span>
                <span className={`font-mono font-medium ${used >= cap ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                  {used}/{cap}
                </span>
              </div>
              <div className="h-1.5 w-full bg-[var(--bg-hover)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    used >= cap 
                      ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' 
                      : 'bg-gradient-to-r from-cyan-400 to-blue-500'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {allExhausted && (
        <p className="text-[10px] text-center text-red-400 mt-1 flex items-center justify-center gap-1">
          <span className="material-symbols-rounded text-[12px]">warning</span>
          Upgrade to Pro for unlimited access
        </p>
      )}
    </div>
  );
}
