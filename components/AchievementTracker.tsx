'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

// ═══════════════════════════════════════
// LOTTIE ANIMATION DATA (inline — no external fetches)
// Minimal confetti/celebration particles
// ═══════════════════════════════════════
const CONFETTI_ANIMATION = {
  v: "5.7.4", fr: 30, ip: 0, op: 60, w: 400, h: 400,
  layers: [{
    ty: 4, nm: "confetti", ip: 0, op: 60, ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [200, 200] }, s: { a: 0, k: [100, 100] } },
    shapes: Array.from({ length: 20 }, (_, i) => ({
      ty: "gr",
      it: [
        { ty: "rc", d: 1, s: { a: 0, k: [8 + Math.random() * 6, 8 + Math.random() * 6] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 4 } },
        {
          ty: "fl",
          c: { a: 0, k: [
            [0.06, 0.71, 0.83, 1], [0.95, 0.62, 0.07, 1], [0.2, 0.8, 0.5, 1],
            [0.95, 0.26, 0.21, 1], [0.61, 0.35, 0.71, 1], [0.13, 0.59, 0.95, 1],
          ][i % 6] },
          o: { a: 1, k: [{ t: 0, s: [100] }, { t: 50, s: [80] }, { t: 60, s: [0] }] },
        },
        {
          ty: "tr",
          p: {
            a: 1,
            k: [
              { t: 0, s: [200, 200], e: [200 + (Math.random() - 0.5) * 350, 200 + (Math.random() - 0.5) * 350] },
              { t: 60, s: [200 + (Math.random() - 0.5) * 350, 200 + (Math.random() - 0.5) * 350] },
            ],
          },
          r: { a: 1, k: [{ t: 0, s: [0] }, { t: 60, s: [360 + Math.random() * 360] }] },
          s: { a: 1, k: [{ t: 0, s: [100, 100] }, { t: 60, s: [40 + Math.random() * 60, 40 + Math.random() * 60] }] },
          o: { a: 0, k: 100 },
        },
      ],
    })),
  }],
};

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════
interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  category: 'resume' | 'skills' | 'practice';
  celebrationColor: string;
}

interface AchievementTrackerProps {
  resumeUploaded: boolean;
  jdMatched: boolean;
  resumeMorphed: boolean;
  skillsBridged: number; // number of completed skills
  totalSkills: number;
  gauntletSessions: number;
  morphScore: number; // 0-100 from the morph
  isLight: boolean;
}

// ═══════════════════════════════════════
// GAUGE COMPONENT (avely.me style)
// ═══════════════════════════════════════
function ArcGauge({ value, maxValue, label, isLight }: {
  value: number;
  maxValue: number;
  label: string;
  isLight: boolean;
}) {
  const percent = Math.min(Math.round((value / maxValue) * 100), 100);
  const cx = 140;
  const cy = 130;
  const r = 100;
  const startAngle = 150; // degrees
  const endAngle = 390;
  const totalArc = endAngle - startAngle; // 240 degrees

  // 5 arc segments with gaps
  const segments = [
    { color: isLight ? '#fca5a5' : '#ef4444', from: 0, to: 0.2 },
    { color: isLight ? '#fde68a' : '#f59e0b', from: 0.22, to: 0.4 },
    { color: isLight ? '#86efac' : '#22c55e', from: 0.42, to: 0.6 },
    { color: isLight ? '#6ee7b7' : '#10b981', from: 0.62, to: 0.8 },
    { color: isLight ? '#93c5fd' : '#3b82f6', from: 0.82, to: 1.0 },
  ];

  const degToRad = (deg: number) => (deg * Math.PI) / 180;

  const describeArc = (startPct: number, endPct: number) => {
    const start = startAngle + startPct * totalArc;
    const end = startAngle + endPct * totalArc;
    const startRad = degToRad(start);
    const endRad = degToRad(end);
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Active segment — how far the fill goes
  const fillPct = percent / 100;

  return (
    <div className="relative flex flex-col items-center">
      <svg width="280" height="180" viewBox="0 0 280 180">
        {/* Background segments (muted) */}
        {segments.map((seg, i) => (
          <path
            key={`bg-${i}`}
            d={describeArc(seg.from, seg.to)}
            fill="none"
            stroke={isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)'}
            strokeWidth="22"
            strokeLinecap="round"
          />
        ))}

        {/* Active fill segments */}
        {segments.map((seg, i) => {
          const segEnd = Math.min(fillPct, seg.to);
          if (fillPct < seg.from) return null;
          return (
            <motion.path
              key={`fill-${i}`}
              d={describeArc(seg.from, segEnd)}
              fill="none"
              stroke={seg.color}
              strokeWidth="22"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: i * 0.12, ease: 'easeOut' }}
            />
          );
        })}
      </svg>

      {/* Center number */}
      <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-[30%] text-center">
        <motion.p
          className={`text-4xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
        >
          {percent}%
        </motion.p>
        <p className={`text-[11px] font-medium mt-0.5 ${isLight ? 'text-slate-400' : 'text-white/30'}`}>
          {label}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function AchievementTracker({
  resumeUploaded, jdMatched, resumeMorphed, skillsBridged, totalSkills,
  gauntletSessions, morphScore, isLight,
}: AchievementTrackerProps) {
  const [showCelebration, setShowCelebration] = useState<string | null>(null);
  const [seenAchievements, setSeenAchievements] = useState<string[]>([]);

  // Load seen achievements from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tc_achievements_seen');
      if (stored) setSeenAchievements(JSON.parse(stored));
    } catch {}
  }, []);

  const achievements: Achievement[] = useMemo(() => [
    {
      id: 'resume_uploaded', title: 'Resume Ready', description: 'Upload your resume',
      icon: '📄', unlocked: resumeUploaded, category: 'resume', celebrationColor: 'from-blue-400 to-cyan-500',
    },
    {
      id: 'jd_matched', title: 'Target Acquired', description: 'Match with a job description',
      icon: '🎯', unlocked: jdMatched, category: 'resume', celebrationColor: 'from-amber-400 to-orange-500',
    },
    {
      id: 'resume_morphed', title: 'Shape Shifter', description: 'Morph your resume to a JD',
      icon: '🔄', unlocked: resumeMorphed, category: 'resume', celebrationColor: 'from-violet-400 to-purple-500',
    },
    {
      id: 'skills_started', title: 'Bridge Builder', description: 'Start training on your first skill',
      icon: '🌉', unlocked: skillsBridged > 0, category: 'skills', celebrationColor: 'from-teal-400 to-emerald-500',
    },
    {
      id: 'skills_half', title: 'Halfway Hero', description: `Complete ${Math.ceil(totalSkills / 2)} skill courses`,
      icon: '⚡', unlocked: skillsBridged >= Math.ceil(totalSkills / 2), category: 'skills', celebrationColor: 'from-yellow-400 to-amber-500',
    },
    {
      id: 'gauntlet_warrior', title: 'Gauntlet Warrior', description: 'Complete 3+ practice sessions',
      icon: '⚔️', unlocked: gauntletSessions >= 3, category: 'practice', celebrationColor: 'from-red-400 to-rose-500',
    },
    {
      id: 'perfect_morph', title: 'Perfect Match', description: 'Score 85%+ on a resume morph',
      icon: '💎', unlocked: morphScore >= 85, category: 'resume', celebrationColor: 'from-emerald-400 to-teal-500',
    },
    {
      id: 'all_skills', title: 'Skill Master', description: 'Complete all skill courses',
      icon: '🏆', unlocked: skillsBridged >= totalSkills && totalSkills > 0, category: 'skills', celebrationColor: 'from-amber-500 to-yellow-400',
    },
  ], [resumeUploaded, jdMatched, resumeMorphed, skillsBridged, totalSkills, gauntletSessions, morphScore]);

  // Detect newly unlocked achievements
  useEffect(() => {
    const newlyUnlocked = achievements.find(a => a.unlocked && !seenAchievements.includes(a.id));
    if (newlyUnlocked) {
      setShowCelebration(newlyUnlocked.id);
      const updated = [...seenAchievements, newlyUnlocked.id];
      setSeenAchievements(updated);
      localStorage.setItem('tc_achievements_seen', JSON.stringify(updated));
      // Auto-close celebration after 4 seconds
      setTimeout(() => setShowCelebration(null), 4000);
    }
  }, [achievements, seenAchievements]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const overallProgress = achievements.length > 0 ? (unlockedCount / achievements.length) : 0;

  // Calculate journey progress (weighted)
  const journeyScore = useMemo(() => {
    let score = 0;
    if (resumeUploaded) score += 15;
    if (jdMatched) score += 15;
    if (resumeMorphed) score += 20;
    if (morphScore >= 85) score += 10;
    score += Math.min(30, (skillsBridged / Math.max(1, totalSkills)) * 30);
    score += Math.min(10, gauntletSessions * 3.33);
    return Math.round(score);
  }, [resumeUploaded, jdMatched, resumeMorphed, morphScore, skillsBridged, totalSkills, gauntletSessions]);

  return (
    <>
      {/* Full-Screen Celebration Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
          >
            {/* Lottie confetti */}
            <div className="absolute inset-0">
              <Lottie
                animationData={CONFETTI_ANIMATION}
                loop={false}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            {/* Achievement popup */}
            <motion.div
              initial={{ scale: 0.3, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: -20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`pointer-events-auto p-6 rounded-3xl backdrop-blur-xl shadow-2xl border text-center max-w-xs ${ 
                isLight ? 'bg-white/95 border-slate-200' : 'bg-slate-900/95 border-white/10'
              }`}
              onClick={() => setShowCelebration(null)}
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6 }}
                className="text-5xl mb-3"
              >
                {achievements.find(a => a.id === showCelebration)?.icon}
              </motion.div>
              <p className={`text-lg font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Achievement Unlocked! 🎉
              </p>
              <p className={`text-sm font-bold mt-1 ${isLight ? 'text-slate-700' : 'text-white/70'}`}>
                {achievements.find(a => a.id === showCelebration)?.title}
              </p>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-white/30'}`}>
                {achievements.find(a => a.id === showCelebration)?.description}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Achievement Tracker Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={`p-6 rounded-2xl ${
          isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-white/[0.02] border border-white/[0.06]'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white/70'}`}>
            <span>🏅</span> Achievement Tracker
          </h3>
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
            isLight ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            {unlockedCount}/{achievements.length} Unlocked
          </span>
        </div>

        {/* Gauge */}
        <ArcGauge value={journeyScore} maxValue={100} label="Interview Readiness" isLight={isLight} />

        {/* Achievement Grid */}
        <div className="grid grid-cols-4 gap-2 mt-2">
          {achievements.map((a) => (
            <motion.button
              key={a.id}
              onClick={() => a.unlocked && setShowCelebration(a.id)}
              whileHover={a.unlocked ? { scale: 1.08 } : undefined}
              whileTap={a.unlocked ? { scale: 0.95 } : undefined}
              className={`relative p-2.5 rounded-xl text-center transition-all group ${
                a.unlocked
                  ? isLight
                    ? 'bg-white border border-slate-200 shadow-sm hover:shadow-md cursor-pointer'
                    : 'bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] cursor-pointer'
                  : isLight
                    ? 'bg-slate-50 border border-slate-100 opacity-40'
                    : 'bg-white/[0.01] border border-white/[0.03] opacity-25'
              }`}
              disabled={!a.unlocked}
              title={a.unlocked ? `🎉 ${a.title} — Click to replay!` : `🔒 ${a.description}`}
            >
              {a.unlocked && (
                <motion.div
                  className={`absolute inset-0 rounded-xl bg-gradient-to-br ${a.celebrationColor} opacity-[0.06]`}
                  animate={{ opacity: [0.04, 0.08, 0.04] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              <span className={`text-xl ${!a.unlocked ? 'grayscale' : ''}`}>
                {a.unlocked ? a.icon : '🔒'}
              </span>
              <p className={`text-[8px] font-bold mt-1 leading-tight truncate ${
                a.unlocked
                  ? isLight ? 'text-slate-700' : 'text-white/60'
                  : isLight ? 'text-slate-300' : 'text-white/15'
              }`}>
                {a.title}
              </p>
            </motion.button>
          ))}
        </div>

        {/* Journey Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[10px] font-semibold ${isLight ? 'text-slate-400' : 'text-white/25'}`}>
              Interview Journey
            </span>
            <span className={`text-[10px] font-bold ${isLight ? 'text-slate-600' : 'text-white/50'}`}>
              {journeyScore}%
            </span>
          </div>
          <div className={`w-full h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/[0.04]'}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${journeyScore}%` }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
              className="h-full rounded-full bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-500"
              style={{ boxShadow: '0 0 8px rgba(6, 182, 212, 0.3)' }}
            />
          </div>
          <div className="flex justify-between mt-1">
            {['📄 Resume', '🎯 Match', '🔄 Morph', '🌉 Bridge', '⚔️ Practice'].map((step, i) => {
              const stepThreshold = (i + 1) * 20;
              const active = journeyScore >= stepThreshold;
              return (
                <span key={step} className={`text-[8px] font-medium ${
                  active
                    ? isLight ? 'text-teal-600' : 'text-teal-400'
                    : isLight ? 'text-slate-300' : 'text-white/15'
                }`}>
                  {step}
                </span>
              );
            })}
          </div>
        </div>
      </motion.div>
    </>
  );
}
