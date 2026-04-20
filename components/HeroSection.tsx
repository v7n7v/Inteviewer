'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';
import { AnimatedShimmerBackground } from './AnimatedShimmerBackground';
import ThemeToggle from '@/components/ThemeToggle';

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
  { id: 'upload', step: '01', icon: 'outbox', title: 'Upload Resume', desc: 'PDF, Word, or text' },
  { id: 'paste', step: '02', icon: 'content_paste', title: 'Paste JD', desc: 'Target job description' },
  { id: 'morph', step: '03', icon: 'psychology', title: 'AI Morph', desc: 'Smart rewrite engine' },
  { id: 'download', step: '04', icon: 'arrow_downward', title: 'Download', desc: 'ATS-safe export' },
];

function WorkflowAnimation() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
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
    <div className="elevation-1 p-4 md:p-5 overflow-hidden">
      {/* Step indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {workflowSteps.map((ws, i) => {
          const isActive = activeStep === i;
          const isPast = activeStep > i;
          return (
            <motion.button
              key={ws.id}
              onClick={() => setActiveStep(i)}
              className={`relative p-3 rounded-xl border transition-all duration-500 text-left overflow-hidden ${isActive
                ? isLight ? 'border-emerald-500/40 bg-emerald-500/[0.08]' : 'border-emerald-500/40 bg-emerald-500/[0.05]'
                : isPast
                  ? isLight ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-emerald-500/10 bg-emerald-500/[0.02]'
                  : isLight ? 'border-black/[0.06] bg-black/[0.02]' : 'border-white/[0.06] bg-white/[0.01]'
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
                <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${isActive ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : isPast ? (isLight ? 'text-emerald-600/50' : 'text-emerald-500/30') : (isLight ? 'text-gray-900' : 'text-white/20')}`}>{ws.step}</span>
                <motion.div
                  className="text-lg mt-1"
                  animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.6 }}
                >{ws.icon}</motion.div>
                <h3 className={`text-[11px] font-semibold mt-1 transition-colors ${isActive ? (isLight ? 'text-gray-900' : 'text-white') : (isLight ? 'text-gray-900' : 'text-white/40')}`}>{ws.title}</h3>
                <p className={`text-[9px] mt-0.5 transition-colors ${isActive ? (isLight ? 'font-bold text-gray-900' : 'text-white/40') : (isLight ? 'text-gray-900' : 'text-white/15')}`}>{ws.desc}</p>
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
      <div className={`relative min-h-[140px] rounded-xl overflow-hidden border ${isLight ? 'bg-black/[0.02] border-black/[0.06]' : 'bg-white/[0.01] border-white/[0.04]'}`}>
        <AnimatePresence mode="wait">
          {/* Step 0: Upload */}
          {activeStep === 0 && (
            <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-5 flex flex-col items-center justify-center h-[140px]">
              <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }} className="text-3xl mb-2"><span className="material-symbols-rounded align-middle">description</span></motion.div>
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5 }}
                className="px-3 py-1.5 rounded-lg border-2 border-dashed border-emerald-500/30 bg-emerald-500/[0.03] text-[11px] text-emerald-400 flex items-center gap-2">
                <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>↑</motion.span>
                resume_v3.pdf uploaded
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className={`mt-2.5 flex items-center gap-3 text-[10px] ${isLight ? 'font-bold text-gray-900' : 'text-white/30'}`}>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />PDF parsed</span>
                <span>•</span><span>3 pages</span><span>•</span><span>12 skills detected</span>
              </motion.div>
            </motion.div>
          )}

          {/* Step 1: Paste JD */}
          {activeStep === 1 && (
            <motion.div key="paste" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-5 h-[140px]">
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`text-[10px] ${isLight ? 'font-bold text-gray-900' : 'text-white/30'}`}>Target:</span>
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className={`text-[11px] font-medium ${isLight ? 'font-bold text-emerald-700' : 'text-emerald-400'}`}>Senior Frontend Engineer — Vercel</motion.span>
              </div>
              <div className="space-y-1.5 font-mono">
                {[
                  'Looking for a Senior Frontend Engineer...',
                  'Requirements: React, TypeScript, Next.js',
                  'Experience with design systems, A11y...',
                  'Bonus: GraphQL, testing frameworks',
                ].map((line, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.4 }} className={`text-[10px] flex items-center gap-2 ${isLight ? 'font-bold text-gray-900' : 'text-white/25'}`}>
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
                    <span className={`text-[11px] font-medium ${isLight ? 'font-bold text-emerald-700' : 'text-emerald-400'}`}>Morphing in progress...</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {morphSkills.map((skill) => (
                      <motion.span key={skill} initial={{ opacity: 0, scale: 0.5, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="px-2 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{skill}</motion.span>
                    ))}
                  </div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: morphScore > 0 ? 1 : 0 }} className={`mt-2.5 flex items-center gap-2 text-[9px] ${isLight ? 'font-bold text-gray-900' : 'text-white/25'}`}>
                    <span>Keywords injected</span><span className="text-emerald-500/30">•</span><span>Skills reordered</span><span className="text-emerald-500/30">•</span><span>Format optimized</span>
                  </motion.div>
                </div>
                <div className="text-right ml-4">
                  <div className={`text-[9px] mb-0.5 ${isLight ? 'font-bold text-gray-900' : 'text-white/25'}`}>ATS Match</div>
                  <motion.div className={`text-2xl font-bold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>{morphScore}%</motion.div>
                  <div className={`w-16 h-1.5 rounded-full mt-1 overflow-hidden ${isLight ? 'bg-black/5' : 'bg-white/[0.04]'}`}>
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className={`text-[13px] font-semibold mb-1.5 ${isLight ? 'text-gray-900' : 'text-white'}`}>Resume Ready</motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex items-center gap-2.5">
                <span className={`px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1 ${isLight ? 'font-bold text-emerald-700' : 'text-emerald-400'}`}><span className="material-symbols-rounded align-middle mr-1">description</span> PDF</span>
                <span className={`px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-medium flex items-center gap-1 ${isLight ? 'font-bold text-blue-700' : 'text-blue-400'}`}><span className="material-symbols-rounded align-middle mr-1">edit_document</span> Word</span>
                <span className={`text-[10px] font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>92% Match</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// DUAL-AI ENHANCE ANIMATION — Expanded PRO Workflow
// Shows the full enhance pipeline: Check → GPT → Gemini → Fix → Cover Letter → Done
// ═══════════════════════════════════════
function DualAIAnimation() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [stage, setStage] = useState(0);
  // 0: resume check, 1: GPT rewriting, 2: gemini validating, 3: auto-fix, 4: cover letter, 5: done
  const totalStages = 6;

  useEffect(() => {
    const timings = [2800, 3000, 3000, 2800, 3000, 3000];
    const timer = setTimeout(() => {
      setStage(prev => (prev + 1) % totalStages);
    }, timings[stage]);
    return () => clearTimeout(timer);
  }, [stage]);

  const pipelineSteps = [
    { label: 'Check', icon: 'search', color: '#f59e0b' },
    { label: 'GPT Write', icon: 'psychology', color: '#f59e0b' },
    { label: 'Gemini Val', icon: 'auto_awesome', color: '#22c55e' },
    { label: 'Auto-Fix', icon: 'build', color: '#8b5cf6' },
    { label: 'Cover Letter', icon: 'edit_document', color: '#3b82f6' },
    { label: 'Complete', icon: 'rocket_launch', color: '#06b6d4' },
  ];

  return (
    <div className="elevation-1 overflow-hidden">
      {/* Title bar */}
      <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm"><span className="material-symbols-rounded">auto_awesome</span></span>
          <span className={`text-[11px] font-semibold ${isLight ? 'text-gray-900' : 'text-white/50'}`}>Dual-AI Enhance Pipeline</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${isLight ? 'font-bold bg-cyan-50 border-cyan-200 text-cyan-600' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'}`}>PRO</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-mono ${isLight ? 'text-gray-900' : 'text-white/20'}`}>{stage + 1}/{totalStages}</span>
          <motion.div className="w-1.5 h-1.5 rounded-full bg-cyan-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
        </div>
      </div>

      <div className="p-4">
        {/* Mini pipeline progress dots */}
        <div className="flex items-center gap-1 mb-4">
          {pipelineSteps.map((p, i) => (
            <div key={p.label} className="flex items-center gap-1 flex-1">
              <motion.div
                animate={stage === i ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.6, repeat: stage === i ? Infinity : 0 }}
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] transition-all duration-400 ${stage > i ? (isLight ? 'font-bold bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-emerald-500/20 border border-emerald-500/30') :
                    stage === i ? 'border-2 shadow-lg' : (isLight ? 'bg-gray-50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]')
                  }`}
                style={stage === i ? { borderColor: `${p.color}60`, boxShadow: `0 0 10px ${p.color}30` } : {}}
              >
                {stage > i ? <span className="text-[7px]">✓</span> : <span className="text-[7px]">{p.icon}</span>}
              </motion.div>
              {i < 5 && <div className={`flex-1 h-px ${stage > i ? (isLight ? 'bg-emerald-300' : 'bg-emerald-500/30') : (isLight ? 'bg-gray-200' : 'bg-white/[0.04]')}`} />}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          {pipelineSteps.map((p, i) => (
            <span key={p.label} className={`text-[7px] font-medium transition-colors ${stage === i ? (isLight ? 'font-bold text-gray-900' : 'text-white/60') : stage > i ? (isLight ? 'font-bold text-emerald-600' : 'text-emerald-500/40') : (isLight ? 'text-gray-900' : 'text-white/15')
              }`}>{p.label}</span>
          ))}
        </div>

        {/* Stage content — each stage shows actual workflow details */}
        <div className="min-h-[160px]">
          {stage === 0 && (
            <motion.div key="check" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-amber-500/[0.03] border border-amber-500/10">
              <div className="flex items-center gap-2 mb-2.5">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full" />
                <span className={`text-[10px] font-medium ${isLight ? 'font-bold text-amber-600' : 'text-amber-400'}`}>Scanning resume for issues...</span>
              </div>
              <div className="space-y-1.5">
                {[
                  { icon: 'warning', text: 'Missing quantified achievements in 3 roles', delay: 0.2 },
                  { icon: 'warning', text: 'Weak action verbs: "responsible for", "helped"', delay: 0.7 },
                  { icon: 'check_circle', text: 'Skills section well-structured', delay: 1.2 },
                  { icon: 'warning', text: 'No ATS-friendly keywords from target JD', delay: 1.7 },
                ].map((item, i) => (
                  <motion.div key={item.text} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: item.delay }}
                    className={`text-[9px] flex items-center gap-1.5 ${isLight ? 'font-bold text-gray-900' : 'text-white/30'}`}>
                    <span><span className="material-symbols-rounded align-middle mr-1">{item.icon}</span>{item.text}</span>
                  </motion.div>
                ))}
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }}
                className={`mt-2 text-[9px] font-medium ${isLight ? 'font-bold text-amber-700' : 'text-amber-400/60'}`}>Found 3 issues → sending to GPT...</motion.div>
            </motion.div>
          )}

          {stage === 1 && (
            <motion.div key="gpt" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-amber-500/[0.03] border border-amber-500/10">
              <div className="flex items-center gap-2 mb-2.5">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full" />
                <span className={`text-[10px] font-medium ${isLight ? 'font-bold text-amber-600' : 'text-amber-400'}`}>GPT-OSS 120B rewriting bullets...</span>
              </div>
              {/* Before/after comparison */}
              <div className="space-y-2">
                <div className="p-2 rounded bg-red-500/[0.03] border border-red-500/10">
                  <span className={`text-[8px] font-medium ${isLight ? 'font-bold text-red-500' : 'text-red-400/60'}`}>BEFORE</span>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    className={`text-[9px] line-through mt-0.5 ${isLight ? 'font-bold text-gray-900' : 'text-white/20'}`}>Responsible for managing team projects</motion.p>
                </div>
                <div className="p-2 rounded bg-emerald-500/[0.03] border border-emerald-500/10">
                  <span className={`text-[8px] font-medium ${isLight ? 'font-bold text-emerald-600' : 'text-emerald-400/60'}`}>AFTER</span>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                    className={`text-[9px] mt-0.5 ${isLight ? 'font-bold text-gray-900' : 'text-white/40'}`}>Led cross-functional team of 8, delivering 3 products on schedule, reducing time-to-market by 40%</motion.p>
                </div>
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}
                className={`mt-2 flex items-center gap-2 text-[8px] ${isLight ? 'font-bold text-gray-900' : 'text-white/20'}`}>
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }}
                  className="w-1 h-1 rounded-full bg-amber-500/60" />
                Rewriting 8 more bullets...
              </motion.div>
            </motion.div>
          )}

          {stage === 2 && (
            <motion.div key="gemini" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-emerald-500/[0.03] border border-emerald-500/10">
              <div className="flex items-center gap-2 mb-2.5">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="w-3.5 h-3.5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full" />
                <span className={`text-[10px] font-medium ${isLight ? 'font-bold text-emerald-700' : 'text-emerald-400'}`}>Gemini 3 Flash cross-validating...</span>
              </div>
              <div className="space-y-1.5">
                {[
                  { text: 'Verifying factual consistency across roles', icon: '🔎' },
                  { text: 'Injecting 12 ATS keywords from target JD', icon: 'key' },
                  { text: 'Optimizing section ordering for impact', icon: 'bar_chart' },
                  { text: 'Checking tone consistency & professionalism', icon: '✍️' },
                ].map((item, i) => (
                  <motion.div key={item.text} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.5 }}
                    className={`text-[9px] flex items-center gap-1.5 ${isLight ? 'font-bold text-gray-900' : 'text-white/25'}`}>
                    <span className="text-[8px]">{item.icon}</span>
                    <span>{item.text}</span>
                    {i < 2 && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 + i * 0.5 }}
                      className="text-emerald-400/40 text-[7px] ml-auto">done</motion.span>}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {stage === 3 && (
            <motion.div key="fix" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-violet-500/[0.03] border border-violet-500/10">
              <div className="flex items-center gap-2 mb-2.5">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="w-3.5 h-3.5 border-2 border-violet-500/30 border-t-violet-500 rounded-full" />
                <span className={`text-[10px] font-medium ${isLight ? 'font-bold text-violet-700' : 'text-violet-400'}`}>Auto-applying fixes to resume...</span>
              </div>
              <div className="space-y-1">
                {[
                  'Replaced 5 weak action verbs → power verbs',
                  'Added metrics to 3 achievement bullets',
                  'Reordered skills by JD relevance',
                  'Inserted target role keywords',
                ].map((t, i) => (
                  <motion.div key={t} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.4 }}
                    className={`text-[9px] flex items-center gap-1.5 ${isLight ? 'font-bold text-gray-900' : 'text-white/25'}`}>
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.4 }}
                      className="text-emerald-400 text-[8px]">✓</motion.span>
                    {t}
                  </motion.div>
                ))}
              </div>
              <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2, delay: 0.5 }}
                className="h-1 rounded-full bg-gradient-to-r from-violet-500/30 to-emerald-500/30 mt-2.5" />
            </motion.div>
          )}

          {stage === 4 && (
            <motion.div key="cover" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-blue-500/[0.03] border border-blue-500/10">
              <div className="flex items-center gap-2 mb-2.5">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="w-3.5 h-3.5 border-2 border-blue-500/30 border-t-blue-500 rounded-full" />
                <span className={`text-[10px] font-medium ${isLight ? 'font-bold text-blue-700' : 'text-blue-400'}`}>Generating tailored cover letter...</span>
              </div>
              <div className={`p-2 rounded font-mono border ${isLight ? 'bg-black/[0.02] border-black/[0.04]' : 'bg-white/[0.01] border-white/[0.04]'}`}>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  className={`text-[8px] leading-relaxed ${isLight ? 'font-bold text-gray-900' : 'text-white/20'}`}>Dear Hiring Manager,</motion.p>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                  className={`text-[8px] leading-relaxed mt-1 ${isLight ? 'font-bold text-gray-900' : 'text-white/20'}`}>I&apos;m excited to apply for the Senior Frontend Engineer role. With 5+ years building scalable React applications...</motion.p>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: 1.5 }}
                  className="inline-block w-1.5 h-3 bg-blue-400/60 mt-1" />
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}
                className={`mt-1.5 text-[8px] ${isLight ? 'text-gray-900' : 'text-white/15'}`}>Also generating LinkedIn summary...</motion.div>
            </motion.div>
          )}

          {stage === 5 && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="p-3 rounded-lg bg-cyan-500/[0.03] border border-cyan-500/10 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
              <p className={`text-[11px] font-semibold ${isLight ? 'text-gray-900' : 'text-white/70'}`}>Full Enhancement Complete</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                {[
                  { label: 'ATS Score', value: '94%', color: isLight ? 'text-cyan-700' : 'text-cyan-400' },
                  { label: 'Keywords', value: '+12', color: isLight ? 'text-emerald-700' : 'text-emerald-400' },
                  { label: 'Bullets', value: '8 fixed', color: isLight ? 'text-amber-700' : 'text-amber-400' },
                  { label: 'Docs', value: '3 ready', color: isLight ? 'text-blue-700' : 'text-blue-400' },
                ].map((stat) => (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }} className="text-center">
                    <p className={`text-[11px] font-bold ${stat.color}`}>{stat.value}</p>
                    <p className={`text-[7px] ${isLight ? 'font-bold text-gray-900' : 'text-white/20'}`}>{stat.label}</p>
                  </motion.div>
                ))}
              </div>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                className={`text-[8px] mt-2 ${isLight ? 'text-gray-900' : 'text-white/15'}`}>Resume + Cover Letter + LinkedIn ready for download</motion.p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// PROCESS CAROUSEL — Auto-cycling horizontal showcase
// Wraps WorkflowAnimation, DualAIAnimation, GauntletAnimation
// ═══════════════════════════════════════
function ProcessCarousel() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [activeSlide, setActiveSlide] = useState(0);
  const slides = [
    { label: 'Resume Studio', icon: 'auto_awesome', color: isLight ? '#B45309' : '#F59E0B', duration: 15000 },
    { label: 'Dual-AI Enhance', icon: 'auto_fix_high', color: isLight ? '#0891B2' : '#06B6D4', duration: 18000 },
  ];

  // Auto-advance after each animation's full cycle
  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveSlide(prev => (prev + 1) % slides.length);
    }, slides[activeSlide].duration);
    return () => clearTimeout(timer);
  }, [activeSlide]);

  return (
    <div className="rounded-xl overflow-hidden">
      {/* Slide tabs */}
      <div className="flex items-center gap-2 mb-3">
        {slides.map((s, i) => (
          <button
            key={s.label}
            onClick={() => setActiveSlide(i)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${activeSlide === i
                ? isLight
                  ? 'text-gray-900 bg-black/5 border border-black/10'
                  : 'text-white bg-white/[0.08] border border-white/[0.12]'
                : isLight
                  ? 'text-gray-900 hover:text-gray-900'
                  : 'text-white/30 hover:text-white/50'
              }`}
          >
            <span>{s.icon}</span> {s.label}
            {/* Progress bar under active tab */}
            {activeSlide === i && (
              <motion.div
                className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r rounded-full"
                style={{ backgroundImage: `linear-gradient(to right, ${s.color}, ${s.color}80)` }}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: slides[activeSlide].duration / 1000, ease: 'linear' }}
                key={`progress-${activeSlide}`}
              />
            )}
          </button>
        ))}
      </div>

      {/* Slides container — simple conditional render */}
      <div className="relative">
        {activeSlide === 0 && (
          <motion.div key="s0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <WorkflowAnimation />
          </motion.div>
        )}
        {activeSlide === 1 && (
          <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <DualAIAnimation />
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// HERO HUMANIZER — Free AI Humanizer Widget
// ═══════════════════════════════════════
function HeroHumanizer({ onShowSignup }: { onShowSignup: () => void }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<{
    rewritten: string;
    before: { humanScore: number; verdict: string };
    after: { humanScore: number; verdict: string };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [limitReached, setLimitReached] = useState(false);

  const wordCount = inputText.trim().split(/\s+/).filter(Boolean).length;
  const overLimit = wordCount > 300;

  const handleHumanize = async () => {
    if (!inputText.trim() || overLimit || loading) return;

    // Check localStorage daily limit
    const lastUse = localStorage.getItem('tc_humanize_last');
    const today = new Date().toDateString();
    if (lastUse === today) {
      setLimitReached(true);
      setError('Daily free limit reached. Create an account for more.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/writing/humanize-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, domain: 'general', tone: 'professional' }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.requiresAuth || data.limitReached) {
          setLimitReached(true);
          setError(data.error);
        } else {
          setError(data.error || 'Something went wrong');
        }
        return;
      }

      localStorage.setItem('tc_humanize_last', today);
      setResult({
        rewritten: data.rewritten,
        before: data.before,
        after: data.after,
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) => score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative">
      {/* Animated gradient glow border */}
      <motion.div
        className="absolute -inset-[1px] rounded-2xl z-0"
        style={{
          background: isLight
            ? 'linear-gradient(135deg, #10b981, #06b6d4, #10b981)'
            : 'linear-gradient(135deg, #10b981, #06b6d4, #3b82f6, #10b981)',
          backgroundSize: '200% 200%',
        }}
        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />
      <div className={`relative z-10 rounded-2xl overflow-hidden ${isLight ? 'bg-white shadow-xl shadow-emerald-500/10' : 'bg-zinc-950 shadow-2xl shadow-emerald-500/10'}`}>
      {/* Header */}
      <div className={`px-5 py-3.5 border-b flex items-center justify-between ${isLight ? 'border-black/[0.06]' : 'border-white/[0.06]'}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="material-symbols-rounded text-[14px] text-white">auto_fix_high</span>
          </div>
          <div>
            <span className={`text-[14px] font-bold block leading-tight ${isLight ? 'text-gray-900' : 'text-white/90'}`}>AI Humanizer</span>
            <span className={`text-[9px] ${isLight ? 'text-gray-400' : 'text-white/20'}`}>Bypass AI detection instantly</span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border animate-pulse ${isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>FREE</span>
        </div>
        <span className={`text-[10px] font-mono ${overLimit ? 'text-red-400' : isLight ? 'text-gray-400' : 'text-white/20'}`}>
          {wordCount}/300 words
        </span>
      </div>

      <div className="p-4">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Input */}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your AI-generated text here and watch it transform into natural, human-sounding writing..."
                className={`w-full h-[120px] sm:h-[160px] resize-none rounded-xl p-3 sm:p-3.5 text-[12px] sm:text-[13px] leading-relaxed border outline-none transition-colors ${isLight
                    ? 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/70 placeholder:text-white/15 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20'
                  }`}
              />

              {/* Error / limit */}
              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className={`mt-2 text-[11px] p-2 rounded-lg flex items-center gap-2 ${isLight ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-red-500/[0.06] text-red-400 border border-red-500/10'}`}>
                  <span className="material-symbols-rounded text-[12px]">warning</span>
                  {error}
                </motion.div>
              )}

              {/* Action row */}
              <div className="mt-3 flex items-center justify-between">
                <div className={`flex items-center gap-3 text-[10px] ${isLight ? 'text-gray-400' : 'text-white/15'}`}>
                  <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-500" />Powered by Gemini</span>
                  <span>•</span>
                  <span>1 free/day</span>
                </div>
                {limitReached ? (
                  <button onClick={onShowSignup}
                    className="text-[12px] font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all">
                    Sign Up Free →
                  </button>
                ) : (
                  <button onClick={handleHumanize} disabled={!inputText.trim() || overLimit || loading}
                    className={`text-[12px] font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${!inputText.trim() || overLimit
                        ? isLight ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white/[0.04] text-white/15 cursor-not-allowed'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30'
                      }`}>
                    {loading && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />}
                    {loading ? 'Humanizing...' : 'Humanize ✨'}
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {/* Score comparison */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className={`p-2.5 rounded-lg text-center border ${isLight ? 'bg-red-50/50 border-red-100' : 'bg-red-500/[0.04] border-red-500/10'}`}>
                  <p className={`text-[9px] font-medium mb-0.5 ${isLight ? 'text-gray-500' : 'text-white/25'}`}>BEFORE</p>
                  <p className="text-[18px] font-bold" style={{ color: scoreColor(result.before.humanScore) }}>{result.before.humanScore}%</p>
                  <p className={`text-[9px] ${isLight ? 'text-gray-400' : 'text-white/15'}`}>Human Score</p>
                </div>
                <div className={`p-2.5 rounded-lg text-center border ${isLight ? 'bg-emerald-50/50 border-emerald-100' : 'bg-emerald-500/[0.04] border-emerald-500/10'}`}>
                  <p className={`text-[9px] font-medium mb-0.5 ${isLight ? 'text-gray-500' : 'text-white/25'}`}>AFTER</p>
                  <p className="text-[18px] font-bold" style={{ color: scoreColor(result.after.humanScore) }}>{result.after.humanScore}%</p>
                  <p className={`text-[9px] ${isLight ? 'text-gray-400' : 'text-white/15'}`}>Human Score</p>
                </div>
              </div>

              {/* Humanized text preview */}
              <div className={`rounded-lg p-3 border max-h-[100px] overflow-y-auto ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                <p className={`text-[11px] leading-relaxed ${isLight ? 'text-gray-700' : 'text-white/50'}`}>
                  {result.rewritten.substring(0, 300)}{result.rewritten.length > 300 && '...'}
                </p>
              </div>

              {/* Actions */}
              <div className="mt-3 flex items-center justify-between">
                <button onClick={() => { setResult(null); setInputText(''); }}
                  className={`text-[11px] px-3 py-1.5 rounded-lg transition-colors ${isLight ? 'text-gray-500 hover:bg-gray-100' : 'text-white/30 hover:bg-white/[0.04]'}`}>
                  ← Try another
                </button>
                <button onClick={onShowSignup}
                  className="text-[12px] font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20">
                  Get Unlimited Free →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// TESTIMONIAL MARQUEE — Auto-scrolling social proof
// ═══════════════════════════════════════
function TestimonialMarquee() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const doubled = [...quotes, ...quotes];

  return (
    <div className="relative overflow-hidden py-6">
      {/* Fade edges */}
      <div className={`absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none ${isLight ? 'bg-gradient-to-r from-[var(--theme-bg)] to-transparent' : 'bg-gradient-to-r from-[var(--theme-bg)] to-transparent'}`} />
      <div className={`absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none ${isLight ? 'bg-gradient-to-l from-[var(--theme-bg)] to-transparent' : 'bg-gradient-to-l from-[var(--theme-bg)] to-transparent'}`} />

      <motion.div
        className="flex gap-6"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      >
        {doubled.map((q, i) => (
          <div key={i} className={`flex-shrink-0 w-[320px] p-4 rounded-xl border ${isLight ? 'bg-white/60 border-black/[0.06]' : 'bg-white/[0.02] border-white/[0.04]'}`}>
            <p className={`text-[12px] leading-relaxed mb-3 ${isLight ? 'text-gray-700' : 'text-white/40'}`}>&ldquo;{q.text}&rdquo;</p>
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold ${isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {q.name[0]}
              </div>
              <div>
                <p className={`text-[11px] font-semibold ${isLight ? 'text-gray-900' : 'text-white/60'}`}>{q.name}</p>
                <p className={`text-[9px] ${isLight ? 'text-gray-400' : 'text-white/15'}`}>{q.title} · {q.co}</p>
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════
// BENTO FEATURE GRID — Expanded tool showcase
// ═══════════════════════════════════════
const bentoTools = [
  { icon: 'auto_awesome', title: 'Resume Studio', desc: 'AI morphs your resume to match any JD. Keywords injected, ATS-optimized.', color: '#F59E0B', big: true },
  { icon: 'chat', title: 'Interview Simulator', desc: 'AI mock interviews with STAR grading, voice mode, and adaptive difficulty.', color: '#3B82F6', big: true },
  { icon: 'ink_pen', title: 'AI Detector & Humanizer', desc: '100+ pattern analysis. Detect AI, then humanize while keeping your voice.', color: '#F43F5E', big: true },
  { icon: 'troubleshoot', title: 'Market Oracle', desc: 'Dual-AI JD decoder with fit score, salary intel, and red flags.', color: '#A855F7' },
  { icon: 'radar', title: 'Job Search', desc: 'Smart job discovery with ghost detection and fit scoring.', color: '#06B6D4' },
  { icon: 'work', title: 'Applications', desc: 'Track every application from saved to offer.', color: '#22C55E' },
  { icon: 'route', title: 'Skill Bridge', desc: 'AI-generated learning paths to close skill gaps fast.', color: '#10B981' },
  { icon: 'edit_document', title: 'Cover Letter', desc: 'Tailored cover letters with humanization guard.', color: '#F43F5E' },
  { icon: 'scanner', title: 'ATS Preview', desc: 'See what recruiters see in Greenhouse, Lever, Workday.', color: '#06B6D4' },
  { icon: 'payments', title: 'Salary Coach', desc: 'Negotiation strategy with market data and counter-offer prep.', color: '#10B981' },
  { icon: 'badge', title: 'LinkedIn Optimizer', desc: 'Align your profile with target roles automatically.', color: '#3B82F6' },
  { icon: 'neurology', title: 'Career Intelligence', desc: 'Health score, skill gaps, pipeline metrics, AI recommendations.', color: '#8B5CF6' },
  { icon: 'rate_review', title: 'Interview Debrief', desc: 'Log every interview. Track patterns and build confidence.', color: '#8B5CF6' },
  { icon: 'build', title: 'Tools Gallery', desc: 'Paraphraser, Email Writer, Thesis Gen, and more one-click tools.', color: '#8B5CF6' },
];

function BentoFeatureGrid() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {bentoTools.map((tool, i) => (
        <Reveal key={tool.title} delay={i * 0.03}>
          <div
            className={`group relative p-4 rounded-xl border transition-all duration-300 overflow-hidden cursor-default ${tool.big ? 'md:col-span-1 lg:col-span-2 row-span-1' : ''
              } ${isLight
                ? 'bg-white/50 border-black/[0.06] hover:border-black/[0.12] hover:shadow-lg hover:shadow-black/5'
                : 'bg-white/[0.02] border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.04]'
              }`}
          >
            {/* Accent glow on hover */}
            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-500 pointer-events-none"
              style={{ background: `radial-gradient(circle, ${tool.color}, transparent 70%)` }} />

            <div className="relative">
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? '' : ''}`}
                  style={{ backgroundColor: `${tool.color}12`, boxShadow: `0 0 0 1px ${tool.color}20` }}>
                  <span className="material-symbols-rounded text-[16px]" style={{ color: tool.color }}>{tool.icon}</span>
                </div>
                <h3 className={`text-[13px] font-semibold ${isLight ? 'text-gray-900' : 'text-white/80'}`}>{tool.title}</h3>
              </div>
              <p className={`text-[11px] leading-relaxed ${isLight ? 'text-gray-500' : 'text-white/25'}`}>{tool.desc}</p>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
// SONA AGENT SHOWCASE — AI Career Agent Preview
// ═══════════════════════════════════════
const sonaChatMessages = [
  { role: 'user', text: 'Should I apply to this Senior Frontend role at Stripe?' },
  { role: 'assistant', text: 'Based on your profile: 87% fit score. Your React + TypeScript experience is a strong match. Gap: their require GraphQL — I\'d add it to your Skill Bridge queue. Salary range looks $165k-$195k for your level.' },
  { role: 'user', text: 'Draft a cover letter for it' },
  { role: 'assistant', text: 'Done — tailored to Stripe\'s engineering culture. I highlighted your fintech experience and included 3 ATS keywords from their JD. Check your Cover Letter tool.' },
];

function SonaShowcase() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [visibleMsgs, setVisibleMsgs] = useState(0);

  useEffect(() => {
    const timers = sonaChatMessages.map((_, i) =>
      setTimeout(() => setVisibleMsgs(v => Math.max(v, i + 1)), 800 + i * 1800)
    );
    // Reset cycle
    const reset = setTimeout(() => setVisibleMsgs(0), 800 + sonaChatMessages.length * 1800 + 3000);
    return () => { timers.forEach(clearTimeout); clearTimeout(reset); };
  }, [visibleMsgs === 0 ? 'reset' : 'running']);

  return (
    <div className={`rounded-xl overflow-hidden border ${isLight ? 'bg-white/60 border-black/[0.06]' : 'bg-white/[0.02] border-white/[0.06]'}`}>
      {/* Chat header */}
      <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${isLight ? 'border-black/[0.06]' : 'border-white/[0.04]'}`}>
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">S</span>
        </div>
        <span className={`text-[12px] font-semibold ${isLight ? 'text-gray-900' : 'text-white/70'}`}>Sona</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'}`}>AI Agent</span>
        <motion.div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
      </div>

      {/* Chat messages */}
      <div className="p-4 space-y-3 min-h-[200px]">
        {sonaChatMessages.slice(0, visibleMsgs).map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] p-2.5 rounded-xl text-[11px] leading-relaxed ${msg.role === 'user'
                ? isLight ? 'bg-gray-900 text-white' : 'bg-white/[0.08] text-white/70'
                : isLight ? 'bg-emerald-50 text-gray-800 border border-emerald-100' : 'bg-emerald-500/[0.06] text-white/50 border border-emerald-500/10'
              }`}>
              {msg.text}
            </div>
          </motion.div>
        ))}

        {/* Typing indicator */}
        {visibleMsgs > 0 && visibleMsgs < sonaChatMessages.length && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-1 px-3 py-2">
            {[0, 1, 2].map(i => (
              <motion.div key={i} className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-gray-300' : 'bg-white/10'}`}
                animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }} />
            ))}
          </motion.div>
        )}
      </div>
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
  [
    { text: '$ scanning document for AI patterns', color: '#F43F5E', delay: 0 },
    { text: '  → analyzing 847 words, 42 sentences', color: '#6B7280', delay: 600 },
    { text: '  → perplexity: LOW ⚠ (too predictable)', color: '#F59E0B', delay: 1200 },
    { text: '  → 5 patterns flagged across 3 sections', color: '#EF4444', delay: 1800 },
    { text: '$ humanizing flagged sections...', color: '#10B981', delay: 2600 },
    { text: '  → rewriting with voice preservation', color: '#6B7280', delay: 3200 },
    { text: '  ✓ AI score: 78% → 12% — safe to submit', color: '#22C55E', delay: 3800 },
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
    <div className="elevation-1 overflow-hidden">
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

// ═══════════════════════════════════════
// THE GAUNTLET — Interview Simulation
// Cycles: Question → Answer → STAR Grade → Score
// ═══════════════════════════════════════
const gauntletQuestions = [
  {
    question: 'Tell me about a time you had to lead a project with conflicting stakeholder priorities.',
    type: 'Behavioral',
    difficulty: 'Advanced',
    answer: 'At my previous role, our product and engineering leads disagreed on Q3 priorities. I organized a stakeholder alignment workshop where we mapped each request to OKRs...',
    star: { situation: 92, task: 88, action: 95, result: 78 },
    overall: 88,
    feedback: 'Strong STAR structure. Result could be more quantitative.',
  },
  {
    question: 'Describe a situation where you had to quickly learn a new technology to deliver on a deadline.',
    type: 'Technical',
    difficulty: 'Standard',
    answer: 'When our team adopted GraphQL mid-sprint, I spent the weekend building a proof-of-concept, then led a knowledge transfer session for the team on Monday...',
    star: { situation: 95, task: 90, action: 92, result: 85 },
    overall: 91,
    feedback: 'Excellent initiative shown. Quantify the timeline impact.',
  },
  {
    question: 'How do you handle a situation where a team member is consistently underperforming?',
    type: 'Leadership',
    difficulty: 'Killer',
    answer: 'I scheduled a 1-on-1 to understand their blockers. Turns out they were struggling with our legacy codebase. I paired with them for a week and created onboarding docs...',
    star: { situation: 90, task: 85, action: 94, result: 88 },
    overall: 89,
    feedback: 'Great empathy and action. Add measurable outcome.',
  },
];

function GauntletAnimation() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [qIndex, setQIndex] = useState(0);
  const [phase, setPhase] = useState<'question' | 'answer' | 'grading' | 'score'>('question');
  const [typedChars, setTypedChars] = useState(0);
  const [starScores, setStarScores] = useState({ situation: 0, task: 0, action: 0, result: 0 });
  const [overallScore, setOverallScore] = useState(0);

  const q = gauntletQuestions[qIndex];

  // Phase cycle
  useEffect(() => {
    const timings = { question: 2500, answer: 3000, grading: 3000, score: 2500 };
    const timer = setTimeout(() => {
      if (phase === 'question') setPhase('answer');
      else if (phase === 'answer') setPhase('grading');
      else if (phase === 'grading') setPhase('score');
      else {
        setPhase('question');
        setQIndex((p) => (p + 1) % gauntletQuestions.length);
      }
    }, timings[phase]);
    return () => clearTimeout(timer);
  }, [phase, qIndex]);

  // Typing effect during 'answer' phase
  useEffect(() => {
    if (phase === 'answer') {
      setTypedChars(0);
      const maxChars = q.answer.length;
      const interval = setInterval(() => {
        setTypedChars((prev) => {
          if (prev >= maxChars) { clearInterval(interval); return maxChars; }
          return prev + 2;
        });
      }, 30);
      return () => clearInterval(interval);
    }
  }, [phase, q.answer.length]);

  // STAR score animation during 'grading' phase
  useEffect(() => {
    if (phase === 'grading') {
      setStarScores({ situation: 0, task: 0, action: 0, result: 0 });
      setOverallScore(0);
      const keys: (keyof typeof q.star)[] = ['situation', 'task', 'action', 'result'];
      keys.forEach((key, i) => {
        const target = q.star[key];
        setTimeout(() => {
          let cur = 0;
          const interval = setInterval(() => {
            cur += 4;
            if (cur >= target) { cur = target; clearInterval(interval); }
            setStarScores((prev) => ({ ...prev, [key]: cur }));
          }, 25);
        }, i * 400);
      });
      // Overall score with delay
      setTimeout(() => {
        let cur = 0;
        const interval = setInterval(() => {
          cur += 3;
          if (cur >= q.overall) { cur = q.overall; clearInterval(interval); }
          setOverallScore(cur);
        }, 30);
      }, 1600);
    }
  }, [phase, q.star, q.overall]);

  const typeColor = q.type === 'Behavioral' ? '#FCA130' : q.type === 'Technical' ? '#38BDF8' : '#F87171';

  return (
    <div className="elevation-1 overflow-hidden">
      {/* Title bar */}
      <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">⚔️</span>
          <span className={`text-[11px] font-semibold ${isLight ? 'text-gray-900' : 'text-white/50'}`}>The Gauntlet</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium border" style={{ backgroundColor: `${typeColor}${isLight ? '20' : '15'}`, borderColor: `${typeColor}${isLight ? '40' : '30'}`, color: isLight ? '#C2410C' : typeColor }}>{q.type}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${isLight ? 'font-bold bg-black/5 text-gray-900 border-black/10' : 'bg-white/[0.04] text-white/25 border-white/[0.06]'}`}>{q.difficulty}</span>
          <motion.div className="w-1.5 h-1.5 rounded-full bg-amber-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
        </div>
      </div>

      {/* Content area */}
      <div className="relative min-h-[210px]">
        <AnimatePresence mode="wait">
          {/* Phase 1: Question appears */}
          {phase === 'question' && (
            <motion.div key={`q-${qIndex}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-5">
              <div className="flex items-start gap-3">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                  className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm"><span className="material-symbols-rounded">smart_toy</span></span>
                </motion.div>
                <div>
                  <span className={`text-[9px] font-medium uppercase tracking-wider ${isLight ? 'font-bold text-amber-700' : 'text-amber-400/60'}`}>AI Interviewer</span>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className={`text-[13px] leading-relaxed mt-1 ${isLight ? 'font-bold text-gray-900' : 'text-white/70'}`}>{q.question}</motion.p>
                </div>
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className={`mt-4 flex items-center gap-2 text-[9px] ${isLight ? 'text-gray-900' : 'text-white/15'}`}>
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-amber-500/50" /> Waiting for response...
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {/* Phase 2: User typing answer */}
          {phase === 'answer' && (
            <motion.div key="answer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm"><span className="material-symbols-rounded align-middle">person</span></span>
                </div>
                <div className="flex-1">
                  <span className={`text-[9px] font-medium uppercase tracking-wider ${isLight ? 'font-bold text-emerald-700' : 'text-emerald-400/60'}`}>Your Answer</span>
                  <div className={`mt-1 p-3 rounded-lg border ${isLight ? 'bg-black/5 border-black/10' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                    <p className={`text-[12px] leading-relaxed font-mono ${isLight ? 'font-bold text-gray-900' : 'text-white/50'}`}>
                      {q.answer.substring(0, typedChars)}
                      <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.6, repeat: Infinity }} className="inline-block w-[2px] h-3 bg-amber-400/60 ml-0.5 align-middle" />
                    </p>
                  </div>
                </div>
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className={`mt-3 flex items-center justify-between text-[9px] ${isLight ? 'text-gray-900' : 'text-white/15'}`}>
                <span>{Math.min(typedChars, q.answer.length)} / {q.answer.length} chars</span>
                <span className="flex items-center gap-1"><kbd className={`px-1 py-0.5 rounded border text-[8px] ${isLight ? 'font-bold bg-black/5 border-black/10 text-gray-900' : 'bg-white/[0.04] border-white/[0.08] text-white/70'}`}>⏎</kbd> Submit</span>
              </motion.div>
            </motion.div>
          )}

          {/* Phase 3: STAR Grading */}
          {phase === 'grading' && (
            <motion.div key="grading" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }} className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full" />
                <span className={`text-[11px] font-medium ${isLight ? 'font-bold text-amber-600' : 'text-amber-400'}`}>AI grading with STAR methodology...</span>
              </div>
              <div className="space-y-2.5">
                {(['situation', 'task', 'action', 'result'] as const).map((key) => {
                  const score = starScores[key];
                  const color = score >= 90 ? '#22C55E' : score >= 80 ? '#F59E0B' : '#EF4444';
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider w-16 ${isLight ? 'text-gray-900' : 'text-white/30'}`}>{key[0].toUpperCase()}</span>
                      <div className={`flex-1 h-2 rounded-full overflow-hidden ${isLight ? 'bg-black/10' : 'bg-white/[0.04]'}`}>
                        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }} animate={{ width: `${score}%` }} transition={{ duration: 0.05 }} />
                      </div>
                      <span className="text-[11px] font-bold w-8 text-right" style={{ color: score > 0 ? color : (isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)') }}>{score > 0 ? score : '—'}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Phase 4: Score Card */}
          {phase === 'score' && (
            <motion.div key="score" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }} className="p-5 flex flex-col items-center justify-center h-[210px]">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="w-16 h-16 rounded-full border-2 flex items-center justify-center mb-3"
                style={{ borderColor: overallScore >= 85 ? '#22C55E40' : '#F59E0B40', backgroundColor: overallScore >= 85 ? '#22C55E08' : '#F59E0B08' }}>
                <span className="text-2xl font-bold" style={{ color: overallScore >= 85 ? '#22C55E' : '#F59E0B' }}>{overallScore}</span>
              </motion.div>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className={`text-[13px] font-semibold mb-1 ${isLight ? 'text-gray-900' : 'text-white/80'}`}>
                {overallScore >= 90 ? 'Excellent Answer' : overallScore >= 85 ? 'Strong Answer' : 'Good — Room to Improve'}
              </motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className={`text-[11px] text-center max-w-xs ${isLight ? 'font-bold text-gray-900' : 'text-white/30'}`}>{q.feedback}</motion.p>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-3 flex items-center gap-2">
                <span className={`text-[9px] px-2 py-1 rounded-lg font-medium border ${isLight ? 'font-bold bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>Next Question →</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase indicator dots */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {['question', 'answer', 'grading', 'score'].map((p) => (
            <div key={p} className={`rounded-full transition-all duration-300 ${phase === p ? 'w-3 h-1 bg-amber-500/50' : 'w-1 h-1 bg-white/[0.06]'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// AI DETECTOR ANIMATION — Shows scanning + humanizing
// ═══════════════════════════════════════
function AIDetectorAnimation() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [phase, setPhase] = useState<'scanning' | 'results' | 'humanizing' | 'done'>('scanning');
  const [scanProgress, setScanProgress] = useState(0);
  const [detectedPatterns, setDetectedPatterns] = useState<string[]>([]);

  useEffect(() => {
    const timings = { scanning: 3500, results: 3000, humanizing: 3000, done: 2500 };
    const timer = setTimeout(() => {
      if (phase === 'scanning') setPhase('results');
      else if (phase === 'results') setPhase('humanizing');
      else if (phase === 'humanizing') setPhase('done');
      else { setPhase('scanning'); setScanProgress(0); setDetectedPatterns([]); }
    }, timings[phase]);
    return () => clearTimeout(timer);
  }, [phase]);

  // Scanning progress
  useEffect(() => {
    if (phase === 'scanning') {
      setScanProgress(0);
      setDetectedPatterns([]);
      const patterns = ['Repetitive sentence openers', 'Low perplexity (too predictable)', 'Statistical uniformity', 'Generic transition phrases', 'Formulaic conclusions'];
      let cur = 0;
      const interval = setInterval(() => {
        cur += 2;
        if (cur >= 100) { cur = 100; clearInterval(interval); }
        setScanProgress(cur);
      }, 50);
      patterns.forEach((p, i) => {
        setTimeout(() => setDetectedPatterns(prev => [...prev, p]), 800 + i * 500);
      });
      return () => clearInterval(interval);
    }
  }, [phase]);

  return (
    <div className="elevation-1 overflow-hidden">
      {/* Title bar */}
      <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-sm" style={{ color: '#f43f5e' }}>ink_pen</span>
          <span className={`text-[11px] font-semibold ${isLight ? 'text-gray-900' : 'text-white/50'}`}>AI Detector</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${isLight ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>PRO</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-mono ${isLight ? 'text-gray-400' : 'text-white/20'}`}>847 words</span>
          <motion.div className="w-1.5 h-1.5 rounded-full bg-rose-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
        </div>
      </div>

      <div className="relative min-h-[220px]">
        <AnimatePresence mode="wait">
          {/* Phase 1: Scanning */}
          {phase === 'scanning' && (
            <motion.div key="scan" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="w-3.5 h-3.5 border-2 border-rose-500/30 border-t-rose-500 rounded-full" />
                <span className={`text-[10px] font-medium ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>Scanning for AI patterns...</span>
                <span className={`text-[10px] ml-auto font-mono ${isLight ? 'text-gray-400' : 'text-white/20'}`}>{scanProgress}%</span>
              </div>

              {/* Progress bar */}
              <div className={`h-1.5 rounded-full overflow-hidden mb-3 ${isLight ? 'bg-black/5' : 'bg-white/[0.04]'}`}>
                <motion.div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500"
                  animate={{ width: `${scanProgress}%` }} transition={{ duration: 0.05 }} />
              </div>

              {/* Detected patterns appearing */}
              <div className="space-y-1.5">
                {detectedPatterns.map((p, i) => (
                  <motion.div key={p} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    className={`text-[9px] flex items-center gap-1.5 ${isLight ? 'text-gray-600' : 'text-white/25'}`}>
                    <span className="material-symbols-rounded text-[10px] text-rose-400">warning</span>
                    {p}
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                      className="ml-auto text-rose-400/50 text-[8px]">flagged</motion.span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Phase 2: Results */}
          {phase === 'results' && (
            <motion.div key="results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className={`text-[11px] font-semibold ${isLight ? 'text-gray-900' : 'text-white/60'}`}>Detection Results</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${isLight ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  78% AI Probability
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                {[
                  { label: 'Perplexity', value: 'Low', color: '#ef4444' },
                  { label: 'Burstiness', value: 'Low', color: '#f59e0b' },
                  { label: 'Patterns', value: '5 found', color: '#ef4444' },
                ].map(m => (
                  <motion.div key={m.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className={`text-center p-2 rounded-lg border ${isLight ? 'bg-black/[0.02] border-black/[0.06]' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                    <p className="text-[10px] font-bold" style={{ color: m.color }}>{m.value}</p>
                    <p className={`text-[8px] ${isLight ? 'text-gray-400' : 'text-white/15'}`}>{m.label}</p>
                  </motion.div>
                ))}
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                className={`text-[10px] p-2 rounded-lg flex items-center gap-2 border ${isLight ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-emerald-500/[0.04] border-emerald-500/10 text-emerald-400/70'}`}>
                <span className="material-symbols-rounded text-[12px]">auto_fix_high</span>
                Recommendation: Humanize flagged sections →
              </motion.div>
            </motion.div>
          )}

          {/* Phase 3: Humanizing */}
          {phase === 'humanizing' && (
            <motion.div key="humanize" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="w-3.5 h-3.5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full" />
                <span className={`text-[10px] font-medium ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>Gemini humanizing flagged sections...</span>
              </div>
              <div className="space-y-2">
                <div className={`p-2 rounded border ${isLight ? 'bg-red-50/50 border-red-100' : 'bg-red-500/[0.03] border-red-500/10'}`}>
                  <span className={`text-[8px] font-medium ${isLight ? 'text-red-500' : 'text-red-400/60'}`}>AI-FLAGGED</span>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                    className={`text-[9px] line-through mt-0.5 ${isLight ? 'text-gray-400' : 'text-white/15'}`}>
                    Furthermore, it is important to note that the implementation of these strategies resulted in significant improvements across all key metrics.
                  </motion.p>
                </div>
                <div className={`p-2 rounded border ${isLight ? 'bg-emerald-50/50 border-emerald-100' : 'bg-emerald-500/[0.03] border-emerald-500/10'}`}>
                  <span className={`text-[8px] font-medium ${isLight ? 'text-emerald-600' : 'text-emerald-400/60'}`}>HUMANIZED</span>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                    className={`text-[9px] mt-0.5 ${isLight ? 'text-gray-700' : 'text-white/40'}`}>
                    These changes moved the needle — we saw a 40% jump in response rates and cut our time-to-hire by nearly three weeks.
                  </motion.p>
                </div>
              </div>
              <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2.5, delay: 0.3 }}
                className="h-1 rounded-full bg-gradient-to-r from-rose-500/30 to-emerald-500/30 mt-3" />
            </motion.div>
          )}

          {/* Phase 4: Done */}
          {phase === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="p-4 flex flex-col items-center justify-center h-[220px] text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
              <p className={`text-[13px] font-semibold mb-1 ${isLight ? 'text-gray-900' : 'text-white/80'}`}>Text Humanized</p>
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-2 w-full max-w-[280px]">
                {[
                  { label: 'AI Score', before: '78%', after: '12%', color: 'text-emerald-400' },
                  { label: 'Perplexity', before: 'Low', after: 'High', color: 'text-emerald-400' },
                  { label: 'Patterns', before: '5', after: '0', color: 'text-emerald-400' },
                ].map(s => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <p className={`text-[8px] ${isLight ? 'text-gray-400' : 'text-white/15'}`}>{s.label}</p>
                    <p className={`text-[9px] line-through ${isLight ? 'text-red-400' : 'text-red-400/40'}`}>{s.before}</p>
                    <p className={`text-[11px] font-bold ${s.color}`}>{s.after}</p>
                  </motion.div>
                ))}
              </div>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                className={`text-[9px] mt-3 ${isLight ? 'text-gray-400' : 'text-white/15'}`}>
                Passed detection ✓ — safe to submit
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase dots */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {['scanning', 'results', 'humanizing', 'done'].map((p) => (
            <div key={p} className={`rounded-full transition-all duration-300 ${phase === p ? 'w-3 h-1 bg-rose-500/50' : 'w-1 h-1 bg-white/[0.06]'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// FREE TOOLS HUB — 5 free tools, tabbed UI
// ═══════════════════════════════════════
const FREE_TOOLS = [
  { id: 'detect', label: 'AI Detector', icon: 'search', color: '#f43f5e', limit: '5/hr', wordCap: '1,500 words', desc: 'Scan text for AI patterns' },
  { id: 'word-counter', label: 'Word Counter', icon: 'tag', color: '#06b6d4', limit: '∞', wordCap: 'Unlimited', desc: 'Full text statistics' },
  { id: 'grammar', label: 'Grammar Check', icon: 'spellcheck', color: '#f59e0b', limit: '2/day', wordCap: '300 words', desc: 'Fix grammar & style' },
  { id: 'paraphrase', label: 'Paraphraser', icon: 'autorenew', color: '#8b5cf6', limit: '2/day', wordCap: '200 words', desc: 'Rewrite in 3 styles' },
  { id: 'ats-score', label: 'ATS Score', icon: 'assignment_turned_in', color: '#22c55e', limit: '2/day', wordCap: '500 words', desc: 'Resume ATS check' },
] as const;

function FreeToolsHub({ onShowSignup }: { onShowSignup: () => void }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [activeTool, setActiveTool] = useState(0);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const tool = FREE_TOOLS[activeTool];

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;

  // Client-side word counter
  const getWordCountResult = (text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const chars = text.length;
    const charsNoSpaces = text.replace(/\s/g, '').length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    const avgWPS = sentences > 0 ? Math.round(words.length / sentences) : 0;
    const readingTime = Math.max(1, Math.round(words.length / 238));
    const speakingTime = Math.max(1, Math.round(words.length / 150));
    return { words: words.length, characters: chars, charactersNoSpaces: charsNoSpaces, sentences, paragraphs, avgWordsPerSentence: avgWPS, readingTimeMinutes: readingTime, speakingTimeMinutes: speakingTime };
  };

  const handleSubmit = async () => {
    if (!inputText.trim()) return;
    setError('');
    setResult(null);

    // Word counter is purely client-side
    if (tool.id === 'word-counter') {
      setResult(getWordCountResult(inputText));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/tools/free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: tool.id, text: inputText }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.limitType === 'rate') {
          setError(`Daily limit reached. Sign up for unlimited access.`);
        } else {
          setError(data.error || 'Something went wrong.');
        }
        return;
      }
      setResult(data);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) => score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div>
      {/* Tool Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {FREE_TOOLS.map((t, i) => {
          const active = activeTool === i;
          return (
            <button
              key={t.id}
              onClick={() => { setActiveTool(i); setResult(null); setError(''); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all duration-200 border ${active
                ? (isLight
                  ? 'bg-white shadow-lg border-black/[0.08] text-gray-900'
                  : 'bg-white/[0.06] border-white/[0.12] text-white')
                : (isLight
                  ? 'bg-transparent border-transparent text-gray-500 hover:bg-black/[0.03]'
                  : 'bg-transparent border-transparent text-white/30 hover:text-white/50')
              }`}
            >
              <span className="material-symbols-rounded text-[16px]" style={{ color: active ? t.color : undefined }}>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
              {active && (
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ml-1 ${isLight ? 'bg-gray-100 text-gray-500' : 'bg-white/[0.06] text-white/30'}`}>
                  {t.limit}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Input Area */}
      <div className={`rounded-xl overflow-hidden border ${isLight ? 'bg-white border-black/[0.08] shadow-lg shadow-black/5' : 'bg-white/[0.02] border-white/[0.06]'}`}>
        <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isLight ? 'border-black/[0.06]' : 'border-white/[0.06]'}`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-[16px]" style={{ color: tool.color }}>{tool.icon}</span>
            <span className={`text-[13px] font-bold ${isLight ? 'text-gray-900' : 'text-white/80'}`}>{tool.label}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>FREE</span>
          </div>
          <span className={`text-[10px] font-mono ${isLight ? 'text-gray-400' : 'text-white/20'}`}>{tool.wordCap}</span>
        </div>

        <div className="p-4">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              tool.id === 'ats-score'
                ? 'Paste your resume text here to check ATS compatibility...'
                : tool.id === 'detect'
                ? 'Paste text to scan for AI-generated patterns...'
                : tool.id === 'grammar'
                ? 'Enter text to check for grammar and style issues...'
                : tool.id === 'paraphrase'
                ? 'Enter text to get 3 paraphrase variations...'
                : 'Type or paste your text here...'
            }
            className={`w-full h-[100px] sm:h-[120px] resize-none rounded-lg p-3 text-[12px] sm:text-[13px] leading-relaxed border outline-none transition-colors ${isLight
              ? 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30'
              : 'bg-white/[0.02] border-white/[0.06] text-white/70 placeholder:text-white/15 focus:border-white/[0.12]'
            }`}
          />

          <div className="flex items-center justify-between mt-3">
            <span className={`text-[11px] ${isLight ? 'text-gray-400' : 'text-white/20'}`}>
              {wordCount} words
            </span>
            <button
              onClick={handleSubmit}
              disabled={loading || !inputText.trim()}
              className={`text-[12px] font-semibold px-5 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-40 ${isLight
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-white text-black hover:bg-white/90'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <span className="material-symbols-rounded text-[14px]">{tool.icon}</span>
                  {tool.id === 'detect' ? 'Scan for AI' : tool.id === 'word-counter' ? 'Analyze' : tool.id === 'grammar' ? 'Check Grammar' : tool.id === 'paraphrase' ? 'Paraphrase' : 'Check ATS Score'}
                </>
              )}
            </button>
          </div>

          {error && (
            <div className={`mt-3 text-[12px] p-3 rounded-lg border ${isLight ? 'bg-red-50 border-red-100 text-red-700' : 'bg-red-500/[0.06] border-red-500/10 text-red-400'}`}>
              {error}{' '}
              <button onClick={onShowSignup} className="underline font-semibold">Sign up free →</button>
            </div>
          )}
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`border-t ${isLight ? 'border-black/[0.06]' : 'border-white/[0.06]'}`}
            >
              <div className="p-4">
                {/* AI Detector Results */}
                {tool.id === 'detect' && result.humanScore !== undefined && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-black" style={{ color: scoreColor(result.humanScore) }}>{result.humanScore}%</div>
                        <div className={`text-[10px] font-semibold ${isLight ? 'text-gray-500' : 'text-white/30'}`}>Human Score</div>
                      </div>
                      <div className="flex-1">
                        <div className={`h-2.5 rounded-full overflow-hidden ${isLight ? 'bg-gray-100' : 'bg-white/[0.04]'}`}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${result.humanScore}%` }} transition={{ duration: 1 }} className="h-full rounded-full" style={{ backgroundColor: scoreColor(result.humanScore) }} />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[9px] text-red-400">AI</span>
                          <span className={`text-[9px] font-semibold px-1.5 rounded ${result.verdict === 'likely_ai' ? 'text-red-400' : result.verdict === 'mixed' ? 'text-amber-400' : 'text-green-400'}`}>
                            {result.verdict === 'likely_ai' ? '⚠ Likely AI' : result.verdict === 'mixed' ? '⚡ Mixed' : '✓ Likely Human'}
                          </span>
                          <span className="text-[9px] text-green-400">Human</span>
                        </div>
                      </div>
                    </div>
                    {result.topIssues?.length > 0 && (
                      <div className={`rounded-lg p-2.5 space-y-1 ${isLight ? 'bg-amber-50' : 'bg-amber-500/[0.04]'}`}>
                        {result.topIssues.slice(0, 3).map((issue: string, i: number) => (
                          <div key={i} className={`text-[11px] flex items-start gap-1.5 ${isLight ? 'text-amber-800' : 'text-amber-400/70'}`}>
                            <span className="text-[10px] mt-0.5">⚠</span> {issue}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Word Counter Results */}
                {tool.id === 'word-counter' && result.words !== undefined && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {[
                      { label: 'Words', value: result.words, icon: 'text_fields' },
                      { label: 'Characters', value: result.characters, icon: 'abc' },
                      { label: 'Sentences', value: result.sentences, icon: 'format_list_numbered' },
                      { label: 'Paragraphs', value: result.paragraphs, icon: 'subject' },
                      { label: 'Reading Time', value: `${result.readingTimeMinutes}m`, icon: 'schedule' },
                      { label: 'Avg Words/Sent', value: result.avgWordsPerSentence, icon: 'analytics' },
                    ].map((s) => (
                      <div key={s.label} className={`p-2.5 rounded-lg text-center border ${isLight ? 'bg-gray-50 border-gray-100' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                        <div className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white/80'}`}>{s.value}</div>
                        <div className={`text-[9px] ${isLight ? 'text-gray-400' : 'text-white/20'}`}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Grammar Results */}
                {tool.id === 'grammar' && result.overallScore !== undefined && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-black" style={{ color: scoreColor(result.overallScore) }}>{result.overallScore}/100</div>
                      <div className={`text-[12px] ${isLight ? 'text-gray-600' : 'text-white/40'}`}>{result.summary}</div>
                    </div>
                    {result.corrections?.length > 0 && (
                      <div className="space-y-2 max-h-[150px] overflow-y-auto">
                        {result.corrections.slice(0, 5).map((c: any, i: number) => (
                          <div key={i} className={`text-[11px] p-2 rounded-lg border ${isLight ? 'bg-gray-50 border-gray-100' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                            <span className="text-red-400 line-through">{c.original}</span>{' → '}
                            <span className="text-green-400 font-semibold">{c.corrected}</span>
                            <div className={`text-[10px] mt-1 ${isLight ? 'text-gray-400' : 'text-white/20'}`}>{c.rule}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Paraphraser Results */}
                {tool.id === 'paraphrase' && result.variations && (
                  <div className="space-y-2">
                    {result.variations.map((v: any, i: number) => (
                      <div key={i} className={`p-3 rounded-lg border ${isLight ? 'bg-gray-50 border-gray-100' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${isLight ? 'bg-violet-100 text-violet-700' : 'bg-violet-500/10 text-violet-400'}`}>{v.style}</span>
                        </div>
                        <p className={`text-[12px] leading-relaxed ${isLight ? 'text-gray-700' : 'text-white/50'}`}>{v.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ATS Score Results */}
                {tool.id === 'ats-score' && result.atsScore !== undefined && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-black" style={{ color: scoreColor(result.atsScore) }}>{result.atsScore}</div>
                        <div className={`text-[10px] font-semibold ${isLight ? 'text-gray-500' : 'text-white/30'}`}>ATS Score</div>
                      </div>
                      <div className="flex-1">
                        <div className={`h-2.5 rounded-full overflow-hidden ${isLight ? 'bg-gray-100' : 'bg-white/[0.04]'}`}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${result.atsScore}%` }} transition={{ duration: 1 }} className="h-full rounded-full" style={{ backgroundColor: scoreColor(result.atsScore) }} />
                        </div>
                      </div>
                    </div>
                    {result.issues?.length > 0 && (
                      <div className={`rounded-lg p-2.5 space-y-1 ${isLight ? 'bg-red-50' : 'bg-red-500/[0.04]'}`}>
                        <div className={`text-[10px] font-bold mb-1 ${isLight ? 'text-red-800' : 'text-red-400'}`}>Issues Found:</div>
                        {result.issues.slice(0, 4).map((issue: string, i: number) => (
                          <div key={i} className={`text-[11px] flex items-start gap-1.5 ${isLight ? 'text-red-700' : 'text-red-400/70'}`}>
                            <span className="text-[10px] mt-0.5">✗</span> {issue}
                          </div>
                        ))}
                      </div>
                    )}
                    {result.strengths?.length > 0 && (
                      <div className={`rounded-lg p-2.5 space-y-1 ${isLight ? 'bg-green-50' : 'bg-green-500/[0.04]'}`}>
                        <div className={`text-[10px] font-bold mb-1 ${isLight ? 'text-green-800' : 'text-green-400'}`}>Strengths:</div>
                        {result.strengths.slice(0, 3).map((s: string, i: number) => (
                          <div key={i} className={`text-[11px] flex items-start gap-1.5 ${isLight ? 'text-green-700' : 'text-green-400/70'}`}>
                            <span className="text-[10px] mt-0.5">✓</span> {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Conversion CTA */}
                <div className={`mt-4 flex items-center justify-between p-3 rounded-lg border ${isLight ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100' : 'bg-gradient-to-r from-emerald-500/[0.04] to-teal-500/[0.04] border-emerald-500/10'}`}>
                  <span className={`text-[11px] ${isLight ? 'text-emerald-800' : 'text-emerald-400/70'}`}>
                    Want unlimited access to all tools?
                  </span>
                  <button onClick={onShowSignup}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-shadow">
                    Sign Up Free →
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const quotes = [
  { text: "Went from zero callbacks to 3 interviews in a week. The resume morphing is genuinely magical.", name: "Sarah K.", title: "Senior → Staff Engineer", co: "FAANG" },
  { text: "The Interview Simulator's killer mode made my actual Google interview feel easy.", name: "Marcus T.", title: "SDE II → Senior SDE", co: "Amazon" },
  { text: "The AI Detector saved my thesis. Found patterns I never would have caught manually.", name: "Priya N.", title: "PhD Candidate", co: "Stanford" },
  { text: "I was mass-applying with zero results. After one session with Resume Studio, I got 5 callbacks.", name: "Jamal R.", title: "New Grad → SWE", co: "Meta" },
];

// ═══════════════════════════════════════
// PRO FEATURE LIST — Cycling Scanner Wave
// ═══════════════════════════════════════
const proFeatures = [
  { text: 'Unlimited Resume Morphs', highlight: true },
  { text: 'Unlimited Interview Sessions', highlight: true },
  { text: 'Unlimited Market Oracle', highlight: true },
  { text: '3× AI Speed & Volume', highlight: true },
  { text: 'Voice Interview Mode', highlight: true },
  { text: 'Skill Bridge — Learning Paths', highlight: true },
  { text: 'AI Detection — 4,000 words/mo', highlight: true },
  { text: 'AI Humanizer — 4,000 words/mo', highlight: true },
  { text: 'Tools Gallery — Pro Tools', highlight: false },
  { text: 'Export to Word (.docx)', highlight: false },
  { text: 'Priority Support', highlight: false },
];

const studioExtras = [
  { text: 'AI Humanizer — 50,000 words/mo', highlight: true },
  { text: 'Unlimited AI Detection', highlight: true },
  { text: 'Uniqueness Verification', highlight: true },
  { text: 'Priority+ Support', highlight: false },
];

function ProFeatureList() {
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let cancelled = false;

    function runCycle(idx: number) {
      if (cancelled) return;
      setActiveIdx(idx);
      if (idx < proFeatures.length - 1) {
        // Move to next item
        timeout = setTimeout(() => runCycle(idx + 1), 500);
      } else {
        // Reached bottom — pause, then restart
        timeout = setTimeout(() => {
          setActiveIdx(-1);
          timeout = setTimeout(() => runCycle(0), 800);
        }, 1500);
      }
    }

    timeout = setTimeout(() => runCycle(0), 600);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="space-y-2 mb-6 flex-1 relative overflow-hidden">
      {proFeatures.map((item, idx) => {
        const isActive = activeIdx === idx;
        const wasRecent = activeIdx === idx + 1 || (activeIdx === 0 && idx === proFeatures.length - 1);

        return (
          <div
            key={item.text}
            className="relative flex items-center gap-2.5 py-0.5 transition-all duration-500"
          >
            {/* Horizontal light streak — sweeps across when active */}
            <motion.div
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.08) 30%, rgba(16,185,129,0.15) 50%, rgba(16,185,129,0.08) 70%, transparent)',
              }}
              animate={{
                opacity: isActive ? 1 : 0,
                x: isActive ? ['-100%', '0%'] : '0%',
              }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />

            <div className="relative shrink-0">
              {/* Expanding glow burst when active */}
              <motion.div
                className="absolute rounded-full"
                style={{
                  inset: '-6px',
                  background: 'radial-gradient(circle, rgba(16,185,129,0.5) 0%, rgba(16,185,129,0.15) 50%, transparent 70%)',
                }}
                animate={{
                  opacity: isActive ? [0, 1, 0.6] : wasRecent ? 0.2 : 0,
                  scale: isActive ? [0.3, 1.2, 1] : wasRecent ? 0.8 : 0.3,
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />

              {/* Checkmark circle */}
              <motion.div
                className={`relative w-4 h-4 rounded-full flex items-center justify-center ${item.highlight ? 'border' : ''
                  }`}
                animate={{
                  scale: isActive ? [1, 1.3, 1.1] : 1,
                  backgroundColor: isActive
                    ? 'rgba(16,185,129,0.25)'
                    : item.highlight
                      ? 'rgba(16,185,129,0.12)'
                      : 'var(--theme-border)',
                  borderColor: isActive
                    ? 'rgba(16,185,129,0.8)'
                    : item.highlight
                      ? 'rgba(16,185,129,0.25)'
                      : 'transparent',
                  boxShadow: isActive
                    ? '0 0 12px rgba(16,185,129,0.5), 0 0 4px rgba(16,185,129,0.3)'
                    : wasRecent
                      ? '0 0 6px rgba(16,185,129,0.2)'
                      : '0 0 0px transparent',
                }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <motion.svg
                  className="w-2.5 h-2.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={3}
                  animate={{
                    color: isActive
                      ? '#34d399'
                      : item.highlight
                        ? 'rgba(52,211,153,0.7)'
                        : 'var(--theme-text-muted)',
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </motion.svg>
              </motion.div>
            </div>

            {/* Label text — brightens when active */}
            <motion.span
              className="text-[12px] relative z-10"
              animate={{
                color: isActive
                  ? 'var(--theme-text)'
                  : item.highlight
                    ? 'var(--theme-text-secondary)'
                    : 'var(--theme-text-muted)',
                fontWeight: isActive ? 600 : item.highlight ? 500 : 400,
              }}
              transition={{ duration: 0.3 }}
            >
              {item.text}
            </motion.span>

            {/* Infinity symbol — flashes when active */}
            {item.highlight && (
              <motion.span
                className="text-[9px] ml-auto font-mono relative z-10"
                animate={{
                  color: isActive ? 'rgba(52,211,153,0.9)' : 'rgba(52,211,153,0.25)',
                  scale: isActive ? [1, 1.4, 1.1] : 1,
                  textShadow: isActive
                    ? '0 0 8px rgba(16,185,129,0.6)'
                    : '0 0 0px transparent',
                }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                ∞
              </motion.span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN ───
export default function HeroSection({ onGetStarted, onShowLogin, onShowSignup, isAuthenticated }: HeroSectionProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
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

  return (
    <div className="relative theme-base-bg transition-colors duration-500">
      <AnimatedShimmerBackground />
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 theme-radial-glow transition-all duration-500" />
        <div className="absolute inset-0 opacity-[0.012]" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          backgroundSize: '128px 128px',
        }} />
      </div>

      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${navSolid
        ? isLight
          ? 'bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
          : 'bg-zinc-950/70 backdrop-blur-xl border-b border-white/[0.04] shadow-[0_1px_20px_rgba(0,0,0,0.3)]'
        : ''}`}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className={`text-[14px] font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-white/90'}`}>TalentConsulting<span className="text-emerald-400">.io</span></span>
          </div>

          {/* Center — Section Nav Links */}
          <div className={`hidden md:flex items-center gap-1 px-1.5 py-1 rounded-full ${isLight ? 'bg-black/[0.03]' : 'bg-white/[0.03]'}`}>
            {[
              { label: 'Features', target: 'features-section' },
              { label: 'Free Tools', target: 'free-tools' },
              { label: 'AI Humanizer', target: 'humanizer-hero' },
              { label: 'Pricing', target: 'pricing-section' },
            ].map((link) => (
              <button
                key={link.label}
                onClick={() => document.getElementById(link.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={`text-[12px] font-medium px-3.5 py-1.5 rounded-full transition-all duration-200 ${
                  isLight
                    ? 'text-gray-600 hover:text-gray-900 hover:bg-black/[0.05]'
                    : 'text-white/35 hover:text-white/70 hover:bg-white/[0.06]'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Right — Auth */}
          <div className="flex items-center gap-2">
            <ThemeToggle size="sm" />

            {isAuthenticated ? (
              <button onClick={onGetStarted} className={`text-[12px] font-semibold px-4 py-1.5 rounded-full transition-all ${isLight ? 'text-gray-900 hover:bg-black/[0.04] border border-black/[0.08]' : 'text-white/80 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]'}`}>Dashboard →</button>
            ) : (
              <>
                <button onClick={onShowLogin} className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-all ${isLight ? 'text-gray-500 hover:text-gray-900' : 'text-white/35 hover:text-white/60'}`}>Sign in</button>
                <button onClick={onShowSignup}
                  className="text-[12px] font-semibold px-4 py-1.5 rounded-full transition-all bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30">
                  Get Started
                </button>
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
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-center mb-10">
            {/* Left */}
            <div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className={`text-[10px] font-medium ${isLight ? 'font-bold text-emerald-700' : 'text-emerald-400/90'}`}>AI-Powered Career Platform</span>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--theme-text)] tracking-tight leading-[1.15] mb-3 relative inline-block group"
              >
                <div className="relative inline-block">
                  <span className="relative z-10">Talent Density,</span>
                  <motion.div
                    animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.05, 1] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -inset-4 bg-emerald-500/10 blur-xl z-0 rounded-full"
                  />
                </div>
                {' '}
                <span
                  className="relative inline-block overflow-hidden"
                  style={{ color: isLight ? '#059669' : '#34d399' }}
                >
                  Decoded
                  <motion.span
                    initial={{ left: '-50%' }}
                    animate={{ left: '150%' }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
                    className="absolute top-0 bottom-0 w-[8px] bg-white opacity-60 blur-[3px] -skew-x-[20deg]"
                  />
                </span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className={`text-[14px] leading-relaxed mb-5 max-w-md ${isLight ? 'font-bold text-gray-900' : 'text-[var(--theme-text-secondary)]'}`}>
                Free AI humanizer, resume morphing, interview simulator, AI detection, and market intelligence — the end-to-end career platform that writes like you, not a machine.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
                <button onClick={onGetStarted}
                  className="group text-[13px] font-medium text-black bg-white hover:bg-white/90 px-5 py-2 rounded-lg transition-all flex items-center gap-2">
                  Get Started Free
                  <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button onClick={onShowLogin} className="text-[13px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] px-3 py-2 transition-colors">Watch demo</button>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
                className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-5 text-[10px] sm:text-[11px]">
                {[{ val: '10x', label: 'Faster prep' }, { val: '95%', label: 'Match accuracy' }, { val: '100+', label: 'Detection patterns' }, { val: '22+', label: 'AI tools' }].map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="font-semibold text-[var(--theme-text-secondary)]">{s.val}</span>
                    <span className="text-[var(--theme-text-muted)]">{s.label}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right — Free AI Humanizer Widget */}
            <motion.div id="humanizer-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }}
              className="w-full max-w-[480px] mx-auto lg:mx-0">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.15em] mb-3 flex items-center gap-2 ${isLight ? 'text-emerald-700' : 'text-emerald-400/60'}`}>
                <span className="material-symbols-rounded text-[14px]">arrow_downward</span>
                Try it free — no sign-up required
              </p>
              <HeroHumanizer onShowSignup={onShowSignup} />
            </motion.div>
          </div>

          {/* ── Social Proof Marquee ── */}
          <Reveal delay={0.2}>
            <TestimonialMarquee />
          </Reveal>

          {/* ── Process Showcase Carousel ── */}
          <Reveal>
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-0.5 h-4 rounded-full bg-emerald-500" />
                <span className="text-[12px] font-semibold text-[var(--theme-text-secondary)]">See How Each Tool Works</span>
              </div>
            </div>
            <ProcessCarousel />
          </Reveal>
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════ */}
      {/* SONA AGENT SHOWCASE                              */}
      {/* ════════════════════════════════════════════════ */}
      <section className="relative py-14 border-t border-black/[0.06] dark:border-white/[0.03]">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="mb-8">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">
              {/* Left — Copy */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-0.5 h-4 rounded-full bg-indigo-500" />
                  <span className="text-[10px] font-medium text-indigo-400/80 uppercase tracking-[0.2em]">AI Career Agent</span>
                </div>
                <h2 className={`text-2xl md:text-3xl font-bold tracking-tight leading-tight mb-3 ${isLight ? 'text-gray-900' : 'text-white/90'}`}>
                  Meet{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400">Sona</span>
                </h2>
                <p className={`text-[14px] leading-relaxed mb-5 max-w-md ${isLight ? 'text-gray-600' : 'text-white/30'}`}>
                  Your AI career co-pilot that knows your resume, your goals, and your pipeline. Ask anything — from "should I apply?" to "draft a counter-offer" — and get actionable advice in seconds.
                </p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { icon: 'psychology', label: 'Knows Your Profile' },
                    { icon: 'auto_stories', label: 'STAR Stories' },
                    { icon: 'hub', label: 'Cross-Tool Actions' },
                  ].map((f) => (
                    <span key={f.label} className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border ${isLight ? 'text-gray-700 bg-indigo-50/50 border-indigo-100' : 'text-white/30 bg-white/[0.03] border-white/[0.05]'}`}>
                      <span className="material-symbols-rounded text-[14px]" style={{ color: '#8b5cf6' }}>{f.icon}</span> {f.label}
                    </span>
                  ))}
                </div>
              </div>
              {/* Right — Sona Chat Preview */}
              <div>
                <SonaShowcase />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}
      {/* FREE TOOLS HUB — 5 free tools                  */}
      {/* ════════════════════════════════════════════════ */}
      <section id="free-tools" className="relative py-16 border-t border-black/[0.06] dark:border-white/[0.03]">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)' }} />
        </div>
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <Reveal className="mb-8">
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`h-px flex-1 max-w-[28px] ${isLight ? 'bg-black/10' : 'bg-white/10'}`} />
              <span className={`text-[10px] font-medium uppercase tracking-[0.2em] ${isLight ? 'text-gray-500' : 'text-white/20'}`}>Free Forever</span>
            </div>
            <h2 className={`text-xl md:text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-white/85'}`}>
              Free AI Tools — No Sign-Up Required
            </h2>
            <p className={`text-[13px] mt-2 max-w-lg ${isLight ? 'text-gray-500' : 'text-white/25'}`}>
              AI detector, word counter, grammar checker, paraphraser, and ATS resume scorer. Use them right now, completely free.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <FreeToolsHub onShowSignup={onShowSignup} />
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}
      {/* INTERVIEW SIMULATOR — Showcase Section           */}
      {/* ════════════════════════════════════════════════ */}
      <section className="relative py-14 border-t border-black/[0.06] dark:border-white/[0.03]">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="mb-8">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">
              {/* Left — Copy */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-0.5 h-4 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-medium text-amber-400/80 uppercase tracking-[0.2em]">Interview Simulator</span>
                </div>
                <h2 className={`text-2xl md:text-3xl font-bold tracking-tight leading-tight mb-3 ${isLight ? 'text-gray-900' : 'text-white/90'}`}>
                  Train like you{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-400">fight</span>
                </h2>
                <p className={`text-[13px] sm:text-[14px] leading-relaxed mb-5 max-w-md ${isLight ? 'font-bold text-gray-900' : 'text-white/30'}`}>
                  The Interview Simulator throws AI-generated behavioral questions tailored to your target JD, then grades your answers
                  using STAR methodology in real-time. Know exactly where you&apos;re strong — and where to sharpen.
                </p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { icon: 'my_location', label: 'JD-Targeted Questions' },
                    { icon: 'star', label: 'STAR Grading' },
                    { icon: '🎙️', label: 'Voice Mode' },
                  ].map((f) => (
                    <span key={f.label} className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border ${isLight ? 'font-bold text-gray-900 bg-black/5 border-black/10' : 'text-white/30 bg-white/[0.03] border-white/[0.05]'}`}>
                      <span>{f.icon}</span> {f.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right — Live Interview Animation */}
              <div>
                <GauntletAnimation />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}
      {/* AI DETECTOR & HUMANIZER — Showcase Section      */}
      {/* ════════════════════════════════════════════════ */}
      <section id="ai-detector-section" className="relative py-14 border-t border-black/[0.06] dark:border-white/[0.03]">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="mb-8">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">
              {/* Left — Live Detection Animation */}
              <div className="order-2 lg:order-1">
                <AIDetectorAnimation />
              </div>

              {/* Right — Copy */}
              <div className="order-1 lg:order-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-0.5 h-4 rounded-full bg-rose-500" />
                  <span className="text-[10px] font-medium text-rose-400/80 uppercase tracking-[0.2em]">AI Detector & Humanizer</span>
                </div>
                <h2 className={`text-2xl md:text-3xl font-bold tracking-tight leading-tight mb-3 ${isLight ? 'text-gray-900' : 'text-white/90'}`}>
                  Write like a{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-400 to-fuchsia-400">human</span>
                </h2>
                <p className={`text-[14px] leading-relaxed mb-5 max-w-md ${isLight ? 'font-bold text-gray-900' : 'text-white/30'}`}>
                  Our 100+ pattern heuristic engine scans your text for AI fingerprints — repetitive structures,
                  predictable transitions, and statistical anomalies. Then our Gemini-powered humanizer rewrites
                  flagged sections while preserving your original voice and meaning.
                </p>
                <div className="flex flex-wrap gap-3 mb-5">
                  {[
                    { icon: 'search', label: '100+ Pattern Analysis' },
                    { icon: 'edit_note', label: 'Smart Humanizer' },
                    { icon: 'verified', label: 'Uniqueness Check' },
                  ].map((f) => (
                    <span key={f.label} className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border ${isLight ? 'font-bold text-gray-900 bg-black/5 border-black/10' : 'text-white/30 bg-white/[0.03] border-white/[0.05]'}`}>
                      <span className="material-symbols-rounded text-[14px]">{f.icon}</span> {f.label}
                    </span>
                  ))}
                </div>
                <div className={`text-[12px] p-3 rounded-lg border ${isLight ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-rose-500/[0.04] border-rose-500/10 text-rose-400/70'}`}>
                  <span className="font-semibold">Why it matters:</span> 67% of recruiters now use AI detection tools.
                  Resumes and cover letters flagged as AI-generated are rejected before a human ever reads them.
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="features-section" className="relative py-14 border-t border-black/[0.06] dark:border-white/[0.03]">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="mb-8">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className={`h-px flex-1 max-w-[28px] ${isLight ? 'bg-black/10' : 'bg-white/10'}`} />
              <span className={`text-[10px] font-medium uppercase tracking-[0.2em] ${isLight ? 'text-gray-500' : 'text-white/20'}`}>The Suite</span>
            </div>
            <h2 className={`text-xl md:text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-white/85'}`}>
              22+ tools for every stage of your career
            </h2>
            <p className={`text-[13px] mt-2 max-w-lg ${isLight ? 'text-gray-500' : 'text-white/25'}`}>
              From resume crafting to salary negotiation — everything connects through your AI-powered career intelligence.
            </p>
          </Reveal>

          <BentoFeatureGrid />
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}


      {/* ════════════════════════════════════════════════ */}
      {/* PRICING                                         */}
      {/* ════════════════════════════════════════════════ */}
      <section id="pricing-section" className="relative py-16 border-t border-black/[0.06] dark:border-white/[0.03]">
        {/* Ambient background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)' }} />
        </div>

        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <Reveal className="text-center mb-10">
            <div className="flex items-center justify-center gap-2.5 mb-2">
              <div className="h-px w-6 bg-black/10 dark:bg-white/10" />
              <span className={`text-[10px] font-medium uppercase tracking-[0.2em] ${isLight ? 'font-bold text-gray-900' : 'text-white/20'}`}>Pricing</span>
              <div className="h-px w-6 bg-black/10 dark:bg-white/10" />
            </div>
            <h2 className={`text-2xl md:text-3xl font-bold tracking-tight mb-2 ${isLight ? 'text-gray-900' : 'text-white/90'}`}>
              Start free. Upgrade when you&apos;re{' '}
              <span style={{ color: isLight ? '#059669' : '#34d399' }}>hooked</span>
            </h2>
            <p className={`text-[14px] max-w-md mx-auto ${isLight ? 'text-gray-600' : 'text-white/25'}`}>Less than a coffee. Cancel anytime.</p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">

              {/* ── FREE TIER ── */}
              <div className="elevation-1 relative p-6 flex flex-col">
                <div className="mb-5">
                  <h3 className={`text-[15px] font-semibold mb-1 ${isLight ? 'text-gray-900' : 'text-white/70'}`}>Free</h3>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold ${isLight ? 'text-gray-900' : 'text-white/80'}`}>$0</span>
                    <span className={`text-[12px] ${isLight ? 'text-gray-900' : 'text-white/20'}`}>forever</span>
                  </div>
                  <p className={`text-[12px] mt-2 ${isLight ? 'font-bold text-gray-900' : 'text-white/25'}`}>Try every tool. No credit card.</p>
                </div>

                <div className="space-y-2.5 mb-6 flex-1">
                  {[
                    { text: '3 Resume Morphs', sub: 'lifetime' },
                    { text: '3 Interview Sessions', sub: 'lifetime' },
                    { text: '3 Market Oracle Queries', sub: 'lifetime' },
                    { text: 'Application Tracker', sub: 'unlimited' },
                    { text: 'Study Vault', sub: 'basic' },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isLight ? 'bg-emerald-500/10' : 'bg-white/[0.04]'}`}>
                        <svg className={`w-2.5 h-2.5 ${isLight ? 'text-gray-900' : 'text-white/25'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <span className={`text-[12px] ${isLight ? 'font-bold text-gray-900' : 'text-white/40'}`}>{item.text}</span>
                      {item.sub && <span className={`text-[9px] ml-auto ${isLight ? 'text-gray-900' : 'text-white/15'}`}>{item.sub}</span>}
                    </div>
                  ))}
                </div>

                <button onClick={onGetStarted}
                  className={`w-full text-[13px] font-medium py-2.5 rounded-xl transition-all ${isLight ? 'font-bold text-gray-900 bg-black/5 hover:bg-black/10 border border-black/10' : 'text-white/60 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]'}`}>
                  Get Started Free
                </button>
              </div>

              {/* ── PRO TIER ── */}
              <div className="elevation-1 relative !border-emerald-500/20 p-6 flex flex-col overflow-hidden">
                <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 1px 0 rgba(16,185,129,0.1), 0 0 40px rgba(16,185,129,0.04)' }} />

                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={`absolute top-4 right-4 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-[9px] font-semibold uppercase tracking-wider ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}
                >
                  Popular
                </motion.div>

                <div className="relative mb-5">
                  <h3 className={`text-[15px] font-semibold mb-1 ${isLight ? 'text-gray-900' : 'text-white/90'}`}>Pro</h3>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>$9.99</span>
                    <span className={`text-[12px] ${isLight ? 'font-bold text-gray-900' : 'text-white/30'}`}>/ month</span>
                  </div>
                  <p className="text-[12px] text-emerald-400/60 mt-2 flex items-center gap-1.5">
                    <span className={`line-through ${isLight ? 'text-gray-900' : 'text-white/15'}`}>$119.88/yr</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400">$99.99/yr — SAVE 17%</span>
                  </p>
                </div>

                <ProFeatureList />

                <button onClick={onGetStarted}
                  className="relative w-full text-[13px] font-semibold text-black bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/10">
                  Upgrade to Pro
                </button>
              </div>

              {/* ── STUDIO TIER ── */}
              <div className="elevation-1 relative !border-blue-500/20 p-6 flex flex-col overflow-hidden">
                <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 1px 0 rgba(59,130,246,0.1), 0 0 40px rgba(59,130,246,0.04)' }} />

                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className={`absolute top-4 right-4 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-[9px] font-semibold uppercase tracking-wider ${isLight ? 'text-blue-700' : 'text-blue-400'}`}
                >
                  Max
                </motion.div>

                <div className="relative mb-5">
                  <h3 className={`text-[15px] font-semibold mb-1 ${isLight ? 'text-gray-900' : 'text-white/90'}`}>Max</h3>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>$19.99</span>
                    <span className={`text-[12px] ${isLight ? 'font-bold text-gray-900' : 'text-white/30'}`}>/ month</span>
                  </div>
                  <p className="text-[12px] text-blue-400/60 mt-2 flex items-center gap-1.5">
                    <span className={`line-through ${isLight ? 'text-gray-900' : 'text-white/15'}`}>$239.88/yr</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400">$179.99/yr — SAVE 25%</span>
                  </p>
                </div>

                <div className="space-y-2.5 mb-6 flex-1">
                  <p className={`text-[10px] font-medium mb-2 ${isLight ? 'text-gray-500' : 'text-white/25'}`}>Everything in Pro, plus:</p>
                  {[
                    { text: 'Sona AI Career Agent' },
                    { text: 'AI Humanizer — 50K words/mo' },
                    { text: 'Unlimited AI Detection' },
                    { text: 'Uniqueness Verification' },
                    { text: 'Export to Word (.docx)' },
                    { text: 'Priority+ Support' },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-blue-500/[0.08] flex items-center justify-center shrink-0">
                        <svg className={`w-2.5 h-2.5 ${isLight ? 'text-blue-600' : 'text-blue-400/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <span className={`text-[12px] ${isLight ? 'font-bold text-gray-900' : 'text-white/50'}`}>{item.text}</span>
                    </div>
                  ))}
                </div>

                <button onClick={onGetStarted}
                  className="relative w-full text-[13px] font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/10">
                  Upgrade to Max
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}
      {/* CTA                                              */}
      {/* ════════════════════════════════════════════════ */}
      <section className="relative py-10 border-t border-black/[0.06] dark:border-white/[0.03]">
        <div className="max-w-xl mx-auto px-6 text-center">
          <Reveal>
            <h2 className={`text-xl font-bold tracking-tight mb-2 ${isLight ? 'text-gray-900' : 'text-white/80'}`}>Ready to start?</h2>
            <p className={`text-[13px] mb-5 ${isLight ? 'text-gray-500' : 'text-white/20'}`}>Free forever. No credit card needed.</p>
            <button onClick={onGetStarted}
              className={`group text-[13px] font-medium px-6 py-2 rounded-lg transition-all inline-flex items-center gap-2 ${isLight ? 'text-white bg-gray-900 hover:bg-gray-800' : 'text-black bg-white hover:bg-white/90'}`}>
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
      <footer className="border-t border-black/[0.06] dark:border-white/[0.03]">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <svg className={`w-2.5 h-2.5 ${isLight ? 'text-gray-900' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className={`text-[11px] ${isLight ? 'text-gray-900' : 'text-white/25'}`}>© {new Date().getFullYear()} TalentConsulting.io</span>
            </div>
            <div className={`flex items-center gap-4 text-[11px] ${isLight ? 'text-gray-500' : 'text-white/15'}`}>
              {['Privacy', 'Terms'].map(link => (
                <button key={link} className={`transition-colors ${isLight ? 'hover:text-gray-900' : 'hover:text-white/35'}`}>{link}</button>
              ))}
              <a href="mailto:support@talentconsulting.io" className={`transition-colors ${isLight ? 'hover:text-gray-900' : 'hover:text-white/35'}`}>Contact</a>
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
