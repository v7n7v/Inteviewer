'use client';

import { motion } from 'framer-motion';
import ATSScorePanel from '@/components/ATSScorePanel';
import PageHelp from '@/components/PageHelp';

export default function ATSScorePage() {
  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto relative overflow-hidden rounded-2xl glass-card p-6 mb-8"
      >
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ x: [0, 30, 0], y: [0, -15, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-0 left-0 w-52 h-52 bg-blue-500/15 rounded-full blur-3xl"
          />
        </div>

        <div className="relative z-10 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 flex items-center justify-center shadow-inner">
              <span className="material-symbols-rounded text-2xl text-cyan-400">analytics</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                ATS Match Score
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                See exactly how your resume scores against any job description
              </p>
            </div>
          </div>
          <PageHelp toolId="ats-score" />
        </div>

        {/* Info Cards */}
        <div className="relative z-10 grid grid-cols-3 gap-3 mt-5">
          {[
            { icon: 'key', label: 'Keyword Gap', desc: 'Find missing terms' },
            { icon: 'format_align_left', label: 'Format Check', desc: 'ATS-safe structure' },
            { icon: 'lightbulb', label: 'Smart Tips', desc: 'Actionable fixes' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/5"
            >
              <span className="material-symbols-rounded text-sm text-cyan-400/70">{item.icon}</span>
              <div>
                <p className="text-[11px] font-semibold text-[var(--text-primary)]">{item.label}</p>
                <p className="text-[9px] text-[var(--text-muted)]">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── ATS Score Panel ── */}
      <div className="max-w-4xl mx-auto">
        <ATSScorePanel />
      </div>
    </div>
  );
}
