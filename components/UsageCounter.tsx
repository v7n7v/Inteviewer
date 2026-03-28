'use client';

import { motion } from 'framer-motion';
import { useUserTier } from '@/hooks/use-user-tier';

const featureDisplayNames: Record<string, { label: string; icon: string }> = {
  morphs: { label: 'Resume Morphs', icon: '📄' },
  jdGenerations: { label: 'JD Generation', icon: '💼' },
  gauntlets: { label: 'Gauntlet Runs', icon: '⚔️' },
  resumeChecks: { label: 'Resume Check', icon: '✨' }
};

export default function UsageCounter({ compact }: { compact?: boolean }) {
  const { isPro, usage, caps, loading } = useUserTier();

  // Hide the widget completely if the user is a Pro/God or if the data is loading
  if (isPro || loading || !caps) return null;

  return (
    <div className="w-full bg-slate-900/50 rounded-xl border border-white/5 p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Free Tier Usage</h4>
      </div>

      <div className="space-y-3">
        {Object.entries(featureDisplayNames).map(([key, { label, icon }]) => {
          const used = usage[key as keyof typeof usage] || 0;
          const cap = caps[key] || 1;
          const percentage = Math.min(100, Math.max(0, (used / cap) * 100));
          
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span className="opacity-80">{icon}</span> {label}
                </span>
                <span className={`font-mono font-medium ${used >= cap ? 'text-red-400' : 'text-slate-400'}`}>
                  {used}/{cap}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
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
    </div>
  );
}
