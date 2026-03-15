'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';

interface HeroSectionProps {
  onGetStarted: () => void;
  onShowLogin: () => void;
  onShowSignup: () => void;
  isAuthenticated: boolean;
}

// ─── Scroll reveal ───
function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-30px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ═══════════════════════════════════════
// "HOW IT WORKS" WORKFLOW ANIMATION
// Exact port from Liquid Resume — step-specific panels
// ═══════════════════════════════════════
const workflowSteps = [
  { id: 'upload', step: '01', icon: '📤', title: 'Upload Resume', desc: 'PDF, Word, or text' },
  { id: 'paste', step: '02', icon: '📋', title: 'Paste JD', desc: 'Target job description' },
  { id: 'morph', step: '03', icon: '🧠', title: 'AI Morph', desc: 'Smart rewrite engine' },
  { id: 'download', step: '04', icon: '⬇️', title: 'Download', desc: 'ATS-safe export' },
];

function WorkflowAnimation() {
  const [activeStep, setActiveStep] = useState(0);
  const [morphScore, setMorphScore] = useState(0);
  const [morphSkills, setMorphSkills] = useState<string[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % 4);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Reset morph state when entering step 2 (morph)
  useEffect(() => {
    if (activeStep === 2) {
      setMorphScore(0);
      setMorphSkills([]);
      const skills = ['React', 'TypeScript', 'Next.js', 'Node.js', 'GraphQL'];
      skills.forEach((skill, i) => {
        setTimeout(() => setMorphSkills(prev => [...prev, skill]), 400 + i * 350);
      });
      const target = 88 + Math.floor(Math.random() * 9);
      let cur = 0;
      const scoreInterval = setInterval(() => {
        cur += 3;
        if (cur >= target) { cur = target; clearInterval(scoreInterval); }
        setMorphScore(cur);
      }, 40);
      return () => clearInterval(scoreInterval);
    }
  }, [activeStep]);

  return (
    <div className="rounded-xl bg-[#0A0A0A] border border-white/[0.06] p-4 md:p-5 overflow-hidden">
      {/* Step indicators */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {workflowSteps.map((ws, i) => {
          const isActive = activeStep === i;
          const isPast = activeStep > i;
          return (
            <motion.button
              key={ws.id}
              onClick={() => setActiveStep(i)}
              className={`relative p-3 rounded-xl border transition-all duration-500 text-left overflow-hidden ${isActive
                ? 'border-emerald-500/40 bg-emerald-500/[0.05]'
                : isPast
                  ? 'border-emerald-500/10 bg-emerald-500/[0.02]'
                  : 'border-white/[0.06] bg-white/[0.01]'
                }`}
            >
              {/* Active glow */}
              {isActive && (
                <motion.div
                  layoutId="stepGlow"
                  className="absolute inset-0 rounded-xl"
                  style={{ boxShadow: '0 0 30px rgba(16,185,129,0.08), inset 0 0 20px rgba(16,185,129,0.03)' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}

              {/* Progress bar at top */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-white/[0.03]">
                {isActive && (
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3.5, ease: 'linear' }}
                    key={`progress-${activeStep}-${i}`}
                  />
                )}
                {isPast && <div className="h-full w-full bg-emerald-500/30" />}
              </div>

              <div className="relative">
                <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${isActive ? 'text-emerald-400' : isPast ? 'text-emerald-500/30' : 'text-white/20'}`}>{ws.step}</span>
                <motion.div
                  className="text-lg mt-1"
                  animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.6 }}
                >{ws.icon}</motion.div>
                <h3 className={`text-[11px] font-semibold mt-1 transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>{ws.title}</h3>
                <p className={`text-[9px] mt-0.5 transition-colors ${isActive ? 'text-white/40' : 'text-white/15'}`}>{ws.desc}</p>
              </div>

              {/* Checkmark for completed */}
              {isPast && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Animated stage content — UNIQUE per step */}
      <div className="relative min-h-[140px] rounded-xl bg-white/[0.01] border border-white/[0.04] overflow-hidden">
        <AnimatePresence mode="wait">
          {/* Step 0: Upload */}
          {activeStep === 0 && (
            <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-5 flex flex-col items-center justify-center h-[140px]">
              <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }} className="text-3xl mb-2">📄</motion.div>
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5 }}
                className="px-3 py-1.5 rounded-lg border-2 border-dashed border-emerald-500/30 bg-emerald-500/[0.03] text-[11px] text-emerald-400 flex items-center gap-2">
                <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>↑</motion.span>
                resume_v3.pdf uploaded
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-2.5 flex items-center gap-3 text-[10px] text-white/30">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />PDF parsed</span>
                <span>•</span><span>3 pages</span><span>•</span><span>12 skills detected</span>
              </motion.div>
            </motion.div>
          )}

          {/* Step 1: Paste JD */}
          {activeStep === 1 && (
            <motion.div key="paste" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-5 h-[140px]">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[10px] text-white/30">Target:</span>
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-[11px] font-medium text-emerald-400">Senior Frontend Engineer — Vercel</motion.span>
              </div>
              <div className="space-y-1.5 font-mono">
                {[
                  'Looking for a Senior Frontend Engineer...',
                  'Requirements: React, TypeScript, Next.js',
                  'Experience with design systems, A11y...',
                  'Bonus: GraphQL, testing frameworks',
                ].map((line, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.4 }} className="text-[10px] text-white/25 flex items-center gap-2">
                    <span className="text-emerald-500/40">|</span>
                    <motion.span initial={{ width: 0 }} animate={{ width: 'auto' }} transition={{ delay: 0.5 + i * 0.4, duration: 0.3 }} className="overflow-hidden whitespace-nowrap">{line}</motion.span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: AI Morph */}
          {activeStep === 2 && (
            <motion.div key="morph" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-5 h-[140px]">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2.5">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }} className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full" />
                    <span className="text-[11px] text-emerald-400 font-medium">Morphing in progress...</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {morphSkills.map((skill) => (
                      <motion.span key={skill} initial={{ opacity: 0, scale: 0.5, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="px-2 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{skill}</motion.span>
                    ))}
                  </div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: morphScore > 0 ? 1 : 0 }} className="mt-2.5 flex items-center gap-2 text-[9px] text-white/25">
                    <span>Keywords injected</span><span className="text-emerald-500/30">•</span><span>Skills reordered</span><span className="text-emerald-500/30">•</span><span>Format optimized</span>
                  </motion.div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-[9px] text-white/25 mb-0.5">ATS Match</div>
                  <motion.div className="text-2xl font-bold text-emerald-400">{morphScore}%</motion.div>
                  <div className="w-16 h-1.5 rounded-full bg-white/[0.04] mt-1 overflow-hidden">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" animate={{ width: `${morphScore}%` }} transition={{ duration: 0.05 }} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Download */}
          {activeStep === 3 && (
            <motion.div key="download" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-5 flex flex-col items-center justify-center h-[140px]">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2.5">
                <motion.svg initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.4, duration: 0.5 }} className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <motion.path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 0.5 }} />
                </motion.svg>
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-[13px] font-semibold text-white mb-1.5">Resume Ready</motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400 flex items-center gap-1">📄 PDF</span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-medium text-blue-400 flex items-center gap-1">📝 Word</span>
                <span className="text-[10px] text-emerald-400 font-bold">92% Match</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// TALENT CONSTELLATION — Orbital Animation
// ═══════════════════════════════════════
const orbitNodes = [
  { label: 'React', angle: 0, ring: 1, color: '#61DAFB' },
  { label: 'Python', angle: 45, ring: 1, color: '#3776AB' },
  { label: 'AWS', angle: 90, ring: 1, color: '#FF9900' },
  { label: 'SQL', angle: 135, ring: 1, color: '#00758F' },
  { label: 'Next.js', angle: 180, ring: 1, color: '#FFFFFF' },
  { label: 'Docker', angle: 225, ring: 1, color: '#2496ED' },
  { label: 'ML', angle: 30, ring: 2, color: '#22C55E' },
  { label: 'GraphQL', angle: 100, ring: 2, color: '#E535AB' },
  { label: 'K8s', angle: 170, ring: 2, color: '#326CE5' },
  { label: 'Rust', angle: 240, ring: 2, color: '#DEA584' },
  { label: 'TF', angle: 310, ring: 2, color: '#FF6F00' },
  { label: 'Go', angle: 270, ring: 1, color: '#00ADD8' },
];

function TalentConstellation() {
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState(0);
  const [time, setTime] = useState(0);

  // Continuous orbit — requestAnimationFrame loop
  useEffect(() => {
    let raf: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000; // seconds elapsed
      last = now;
      setTime(t => t + dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Density counter — resets every 4s
  useEffect(() => {
    const t = setInterval(() => setPhase(p => p + 1), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const target = 87 + Math.floor(Math.random() * 10);
    let cur = 0;
    const t = setInterval(() => {
      cur += 2;
      if (cur >= target) { cur = target; clearInterval(t); }
      setScore(cur);
    }, 30);
    return () => clearInterval(t);
  }, [phase]);

  return (
    <div className="relative w-full aspect-square max-w-[420px] mx-auto">
      {/* Ambient glow */}
      <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(16,185,129,0.06) 0%, transparent 70%)' }} />

      {/* Orbit rings */}
      {[0.65, 0.88].map((pct, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-white/[0.03]"
          style={{
            width: `${pct * 100}%`,
            height: `${pct * 100}%`,
            top: `${(1 - pct) * 50}%`,
            left: `${(1 - pct) * 50}%`,
          }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 55 + i * 25, repeat: Infinity, ease: 'linear' }}
        />
      ))}

      {/* Orbiting skill nodes — continuous rotation */}
      {orbitNodes.map((node, i) => {
        const radius = node.ring === 1 ? 30 : 42;
        // Inner ring: 12°/sec clockwise, Outer ring: 8°/sec counter-clockwise
        const speed = node.ring === 1 ? 12 : -8;
        const angle = (node.angle + time * speed) * Math.PI / 180;
        const left = 50 + radius * Math.cos(angle);
        const top = 50 + radius * Math.sin(angle);

        return (
          <div
            key={node.label}
            className="absolute flex items-center justify-center"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              opacity: 0.7,
            }}
          >
            <span
              className="px-2 py-0.5 rounded-md text-[9px] font-medium backdrop-blur-sm border whitespace-nowrap"
              style={{
                backgroundColor: `${node.color}10`,
                color: node.color,
                borderColor: `${node.color}25`,
                boxShadow: `0 0 12px ${node.color}15`,
              }}
            >
              {node.label}
            </span>
          </div>
        );
      })}

      {/* Central nucleus */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
        <motion.div
          animate={{
            scale: [1, 1.05, 1], boxShadow: [
              '0 0 30px rgba(16,185,129,0.1), 0 0 60px rgba(16,185,129,0.05)',
              '0 0 40px rgba(16,185,129,0.15), 0 0 80px rgba(16,185,129,0.08)',
              '0 0 30px rgba(16,185,129,0.1), 0 0 60px rgba(16,185,129,0.05)',
            ]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="w-28 h-28 rounded-full bg-[#0A0A0A] border border-emerald-500/20 flex flex-col items-center justify-center"
        >
          <span className="text-[8px] text-white/25 uppercase tracking-widest mb-0.5">Density</span>
          <motion.span className="text-2xl font-bold text-emerald-400" key={phase}>{score}</motion.span>
          <span className="text-[8px] text-white/15">/ 100</span>
        </motion.div>
      </div>

      {/* Pulse rings */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={`pulse-${i}`}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/10"
          initial={{ width: 112, height: 112, opacity: 0.5 }}
          animate={{ width: 280, height: 280, opacity: 0 }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
// LIVE AI TERMINAL — Processing Animation
// ═══════════════════════════════════════
const terminalCycles = [
  [
    { text: '$ scanning resume_v3.pdf', color: '#10B981', delay: 0 },
    { text: '  → 3 pages parsed, 847 tokens extracted', color: '#6B7280', delay: 600 },
    { text: '  → skills: React, TypeScript, Node.js +9', color: '#22C55E', delay: 1200 },
    { text: '$ matching against target JD...', color: '#10B981', delay: 2000 },
    { text: '  → role: Senior Frontend Engineer', color: '#00F5FF', delay: 2600 },
    { text: '  → keyword overlap: 87% ████████░░', color: '#F59E0B', delay: 3200 },
    { text: '  ✓ ATS score: 94/100', color: '#22C55E', delay: 3800 },
  ],
  [
    { text: '$ morphing resume → target role', color: '#10B981', delay: 0 },
    { text: '  → injecting 12 keywords from JD', color: '#6B7280', delay: 600 },
    { text: '  → reordering skills by relevance', color: '#00F5FF', delay: 1200 },
    { text: '  → optimizing bullet points ⟳', color: '#6B7280', delay: 1800 },
    { text: '  → formatting for ATS compliance', color: '#F59E0B', delay: 2400 },
    { text: '  ✓ morphed_resume.pdf ready', color: '#22C55E', delay: 3000 },
    { text: '  ✓ match improved: 67% → 94%', color: '#22C55E', delay: 3600 },
  ],
  [
    { text: '$ analyzing market position', color: '#10B981', delay: 0 },
    { text: '  → benchmarking against 12,847 roles', color: '#6B7280', delay: 700 },
    { text: '  → salary range: $145k – $195k', color: '#00F5FF', delay: 1400 },
    { text: '  → demand trend: ↑ 23% YoY', color: '#22C55E', delay: 2100 },
    { text: '  → top missing skill: Rust', color: '#F59E0B', delay: 2800 },
    { text: '  ✓ career trajectory: optimistic', color: '#22C55E', delay: 3400 },
  ],
];

function LiveTerminal() {
  const [cycle, setCycle] = useState(0);
  const [visibleLines, setVisibleLines] = useState<number>(0);

  useEffect(() => {
    const t = setInterval(() => {
      setCycle(p => (p + 1) % terminalCycles.length);
      setVisibleLines(0);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  const lines = terminalCycles[cycle];

  useEffect(() => {
    setVisibleLines(0);
    const timers = lines.map((line, i) =>
      setTimeout(() => setVisibleLines(v => Math.max(v, i + 1)), line.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [cycle, lines]);

  return (
    <div className="rounded-xl bg-[#0A0A0A] border border-white/[0.06] overflow-hidden">
      {/* Title bar */}
      <div className="px-3 py-2 border-b border-white/[0.04] flex items-center gap-2">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/40" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/30" />
          <div className="w-2 h-2 rounded-full bg-green-500/30" />
        </div>
        <span className="text-[9px] text-white/20 font-mono ml-1">talent-ai — processing</span>
        <motion.div
          className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
      {/* Terminal body */}
      <div className="px-3 py-2.5 font-mono min-h-[120px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={cycle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {lines.slice(0, visibleLines).map((line, i) => (
              <motion.div
                key={`${cycle}-${i}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="text-[10px] leading-[1.7] whitespace-nowrap"
                style={{ color: line.color }}
              >
                {line.text}
              </motion.div>
            ))}
            {/* Blinking cursor */}
            {visibleLines < lines.length && (
              <motion.span
                className="inline-block w-1.5 h-3 bg-emerald-400/60 rounded-sm ml-0.5"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── DATA ───
const suiteTools = [
  {
    icon: '📄', title: 'Liquid Resume', tag: 'AI-Morphing Builder',
    desc: 'One resume, infinite versions. AI morphs it to match any JD — keywords injected, skills reordered, ATS-optimized.',
    color: '#10B981', chips: ['JD Morphing', 'Skill Graph', 'Match Score'],
  },
  {
    icon: '⚔️', title: 'The Gauntlet', tag: 'Interview Simulator',
    desc: 'AI mock interviews that probe your weaknesses. Real-time STAR grading, composure analysis, and voice simulation.',
    color: '#FCA130', chips: ['Quick Drill', 'Voice Mode', 'Stress Test'],
  },
  {
    icon: '💼', title: 'JD Generator', tag: 'Smart Descriptions',
    desc: 'Generate tailored job descriptions with AI. Includes Talent Density Score and role-specific frameworks.',
    color: '#38BDF8', chips: ['Density Score', '90-Day Plan', 'Culture Pulse'],
  },
  {
    icon: '🔮', title: 'Market Oracle', tag: 'Career Intelligence',
    desc: 'Salary predictions, skill gap analysis, and market trend visualization powered by real-time data.',
    color: '#A78BFA', chips: ['Salary Map', 'Opportunity Radar', 'Trends'],
  },
];

const quotes = [
  { text: "Went from zero callbacks to 3 interviews in a week. The resume morphing is genuinely magical.", name: "Sarah K.", title: "Senior → Staff Engineer", co: "FAANG" },
  { text: "The Gauntlet's tough mode made my actual Google interview feel easy. Best $0 I ever spent.", name: "Marcus T.", title: "SDE II → Senior SDE", co: "Amazon" },
  { text: "I was mass-applying with zero results. After one session with Liquid Resume, I got 5 callbacks.", name: "Jamal R.", title: "New Grad → SWE", co: "Meta" },
];

// ─── MAIN ───
export default function HeroSection({ onGetStarted, onShowLogin, onShowSignup, isAuthenticated }: HeroSectionProps) {
  const [activeFeature, setActiveFeature] = useState(0);
  const [activeQuote, setActiveQuote] = useState(0);
  const [navSolid, setNavSolid] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const heroOp = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    const h = () => setNavSolid(window.scrollY > 30);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveQuote(p => (p + 1) % quotes.length), 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative bg-[#09090B]">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(17,24,39,0.8), transparent)' }} />
        <div className="absolute inset-0 opacity-[0.012]" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          backgroundSize: '128px 128px',
        }} />
      </div>

      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${navSolid ? 'bg-[#09090B]/90 backdrop-blur-lg border-b border-white/[0.04]' : ''}`}>
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold text-white/90 tracking-tight">TalentConsulting<span className="text-emerald-400">.io</span></span>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <button onClick={onGetStarted} className="text-[13px] font-medium text-white/70 hover:text-white px-3 py-1 rounded-md hover:bg-white/[0.04] transition-all">Dashboard →</button>
            ) : (
              <>
                <button onClick={onShowLogin} className="text-[13px] text-white/40 hover:text-white/70 px-3 py-1 transition-colors">Sign in</button>
                <button onClick={onShowSignup} className="text-[13px] font-medium text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.08] px-3.5 py-1 rounded-md transition-all">Get Started</button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════ */}
      {/* HERO — 2-Column + Workflow Animation Below        */}
      {/* ════════════════════════════════════════════════ */}
      <motion.section ref={heroRef} style={{ y: heroY, opacity: heroOp }} className="relative pt-20 pb-10">
        <div className="max-w-6xl mx-auto px-6">
          {/* 2-col hero */}
          <div className="grid lg:grid-cols-2 gap-10 items-center mb-10">
            {/* Left */}
            <div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-medium text-emerald-400/90">AI-Powered Career Platform</span>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-3xl md:text-4xl font-bold text-white/95 tracking-tight leading-[1.15] mb-3">
                Talent Density,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Decoded</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="text-[14px] text-white/30 leading-relaxed mb-5 max-w-md">
                Resume morphing, interview simulation, JD generation, and market intelligence — the end-to-end AI career platform.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="flex items-center gap-3 mb-5">
                <button onClick={onGetStarted}
                  className="group text-[13px] font-medium text-black bg-white hover:bg-white/90 px-5 py-2 rounded-lg transition-all flex items-center gap-2">
                  Get Started Free
                  <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button onClick={onShowLogin} className="text-[13px] text-white/30 hover:text-white/60 px-3 py-2 transition-colors">Watch demo</button>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
                className="flex items-center gap-5 text-[11px]">
                {[{ val: '10x', label: 'Faster prep' }, { val: '95%', label: 'Match accuracy' }, { val: '8+', label: 'AI tools' }].map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="font-semibold text-white/60">{s.val}</span>
                    <span className="text-white/15">{s.label}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right — Constellation */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.8 }}
              className="hidden lg:block">
              <TalentConstellation />
            </motion.div>
          </div>

          {/* ── "How It Works" workflow animation ── */}
          <Reveal>
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-0.5 h-4 rounded-full bg-emerald-500" />
                <span className="text-[12px] font-semibold text-white/60">From Upload to Offer in Four Steps</span>
              </div>
            </div>
            <WorkflowAnimation />
          </Reveal>
        </div>
      </motion.section>

      <section className="relative py-14 border-t border-white/[0.03]">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="mb-8">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="h-px flex-1 max-w-[28px] bg-white/10" />
              <span className="text-[10px] font-medium text-white/20 uppercase tracking-[0.2em]">The Suite</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white/85 tracking-tight">
              Every tool for the talent journey
            </h2>
          </Reveal>

          <div className="grid lg:grid-cols-[280px_1fr] gap-8 items-start">
            {/* Left — Tool list */}
            <div className="space-y-1">
              {suiteTools.map((tool, i) => {
                const isActive = activeFeature === i;
                return (
                  <Reveal key={tool.title} delay={i * 0.05}>
                    <button
                      onMouseEnter={() => setActiveFeature(i)}
                      onClick={() => setActiveFeature(i)}
                      className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all duration-300 group ${isActive ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                        }`}
                    >
                      {/* Accent bar */}
                      <motion.div
                        className="w-0.5 h-8 rounded-full shrink-0"
                        animate={{
                          backgroundColor: isActive ? tool.color : 'rgba(255,255,255,0.04)',
                          boxShadow: isActive ? `0 0 8px ${tool.color}40` : 'none',
                        }}
                        transition={{ duration: 0.3 }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{tool.icon}</span>
                          <span className={`text-[13px] font-semibold transition-colors duration-300 ${isActive ? 'text-white/90' : 'text-white/40 group-hover:text-white/60'
                            }`}>{tool.title}</span>
                        </div>
                        <span className={`text-[10px] font-medium ml-6 transition-colors duration-300 ${isActive ? '' : 'opacity-0'
                          }`} style={{ color: isActive ? tool.color : 'transparent' }}>{tool.tag}</span>
                      </div>
                      {/* Arrow */}
                      <motion.svg
                        className="w-3 h-3 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        animate={{
                          opacity: isActive ? 0.5 : 0,
                          x: isActive ? 0 : -4,
                          color: isActive ? tool.color : '#fff',
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </motion.svg>
                    </button>
                  </Reveal>
                );
              })}
            </div>

            {/* Right — Detail panel */}
            <div className="relative min-h-[200px] lg:pl-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeFeature}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="lg:border-l border-white/[0.04] lg:pl-8"
                >
                  {/* Tag */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{suiteTools[activeFeature].icon}</span>
                    <div>
                      <h3 className="text-[15px] font-semibold text-white/85">{suiteTools[activeFeature].title}</h3>
                      <p className="text-[11px] font-medium" style={{ color: suiteTools[activeFeature].color }}>{suiteTools[activeFeature].tag}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[13px] text-white/35 leading-relaxed mb-5 max-w-md">
                    {suiteTools[activeFeature].desc}
                  </p>

                  {/* Feature chips */}
                  <div className="flex flex-wrap gap-2 mb-5">
                    {suiteTools[activeFeature].chips.map((chip, ci) => (
                      <motion.span
                        key={chip}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: ci * 0.06 }}
                        className="text-[10px] px-2.5 py-1 rounded-md font-medium border"
                        style={{
                          backgroundColor: `${suiteTools[activeFeature].color}08`,
                          borderColor: `${suiteTools[activeFeature].color}20`,
                          color: suiteTools[activeFeature].color,
                        }}
                      >
                        {chip}
                      </motion.span>
                    ))}
                  </div>

                  {/* Mini visual bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 rounded-full bg-white/[0.03] overflow-hidden max-w-[180px]">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 2, ease: 'easeOut' }}
                        style={{ backgroundColor: suiteTools[activeFeature].color }}
                      />
                    </div>
                    <span className="text-[9px] text-white/15">Powered by AI</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}
      {/* SOCIAL PROOF — Candidates Only                   */}
      {/* ════════════════════════════════════════════════ */}
      <section className="relative py-10 border-t border-white/[0.03]">
        <div className="max-w-2xl mx-auto px-6">
          <div className="relative min-h-[100px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeQuote}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="text-center"
              >
                <p className="text-[15px] md:text-base text-white/50 leading-relaxed mb-3 font-light">
                  &ldquo;{quotes[activeQuote].text}&rdquo;
                </p>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-[9px] font-semibold text-white/35">
                    {quotes[activeQuote].name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] text-white/45 font-medium">{quotes[activeQuote].name}</p>
                    <p className="text-[9px] text-white/15">{quotes[activeQuote].title} • {quotes[activeQuote].co}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="flex justify-center gap-1.5 mt-4">
              {quotes.map((_, i) => (
                <button key={i} onClick={() => setActiveQuote(i)}
                  className={`rounded-full transition-all duration-300 ${activeQuote === i ? 'w-4 h-1 bg-white/20' : 'w-1 h-1 bg-white/[0.06]'}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}
      {/* CTA                                              */}
      {/* ════════════════════════════════════════════════ */}
      <section className="relative py-10 border-t border-white/[0.03]">
        <div className="max-w-xl mx-auto px-6 text-center">
          <Reveal>
            <h2 className="text-xl font-bold text-white/80 tracking-tight mb-2">Ready to start?</h2>
            <p className="text-[13px] text-white/20 mb-5">Free forever. No credit card needed.</p>
            <button onClick={onGetStarted}
              className="group text-[13px] font-medium text-black bg-white hover:bg-white/90 px-6 py-2 rounded-lg transition-all inline-flex items-center gap-2">
              Launch Dashboard
              <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </Reveal>
          <div className="mt-8 max-w-lg mx-auto">
            <LiveTerminal />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}
      {/* FOOTER — Minimal                                 */}
      {/* ════════════════════════════════════════════════ */}
      <footer className="border-t border-white/[0.03]">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="text-[11px] text-white/25">© {new Date().getFullYear()} TalentConsulting.io</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-white/15">
              {['Privacy', 'Terms', 'Status'].map(link => (
                <button key={link} className="hover:text-white/35 transition-colors">{link}</button>
              ))}
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-400/50 animate-pulse" />
                Operational
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
