'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';

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
      <div className="grid grid-cols-4 gap-2 mb-4">
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
                <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${isActive ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : isPast ? (isLight ? 'text-emerald-600/50' : 'text-emerald-500/30') : (isLight ? 'text-gray-400' : 'text-white/20')}`}>{ws.step}</span>
                <motion.div
                  className="text-lg mt-1"
                  animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.6 }}
                >{ws.icon}</motion.div>
                <h3 className={`text-[11px] font-semibold mt-1 transition-colors ${isActive ? (isLight ? 'text-gray-900' : 'text-white') : (isLight ? 'text-gray-500' : 'text-white/40')}`}>{ws.title}</h3>
                <p className={`text-[9px] mt-0.5 transition-colors ${isActive ? (isLight ? 'font-bold text-gray-500' : 'text-white/40') : (isLight ? 'text-gray-400' : 'text-white/15')}`}>{ws.desc}</p>
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
              <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }} className="text-3xl mb-2">📄</motion.div>
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5 }}
                className="px-3 py-1.5 rounded-lg border-2 border-dashed border-emerald-500/30 bg-emerald-500/[0.03] text-[11px] text-emerald-400 flex items-center gap-2">
                <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>↑</motion.span>
                resume_v3.pdf uploaded
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className={`mt-2.5 flex items-center gap-3 text-[10px] ${isLight ? 'font-bold text-gray-500' : 'text-white/30'}`}>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />PDF parsed</span>
                <span>•</span><span>3 pages</span><span>•</span><span>12 skills detected</span>
              </motion.div>
            </motion.div>
          )}

          {/* Step 1: Paste JD */}
          {activeStep === 1 && (
            <motion.div key="paste" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-5 h-[140px]">
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`text-[10px] ${isLight ? 'font-bold text-gray-500' : 'text-white/30'}`}>Target:</span>
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className={`text-[11px] font-medium ${isLight ? 'font-bold text-emerald-700' : 'text-emerald-400'}`}>Senior Frontend Engineer — Vercel</motion.span>
              </div>
              <div className="space-y-1.5 font-mono">
                {[
                  'Looking for a Senior Frontend Engineer...',
                  'Requirements: React, TypeScript, Next.js',
                  'Experience with design systems, A11y...',
                  'Bonus: GraphQL, testing frameworks',
                ].map((line, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.4 }} className={`text-[10px] flex items-center gap-2 ${isLight ? 'font-bold text-gray-500' : 'text-white/25'}`}>
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
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: morphScore > 0 ? 1 : 0 }} className={`mt-2.5 flex items-center gap-2 text-[9px] ${isLight ? 'font-bold text-gray-500' : 'text-white/25'}`}>
                    <span>Keywords injected</span><span className="text-emerald-500/30">•</span><span>Skills reordered</span><span className="text-emerald-500/30">•</span><span>Format optimized</span>
                  </motion.div>
                </div>
                <div className="text-right ml-4">
                  <div className={`text-[9px] mb-0.5 ${isLight ? 'font-bold text-gray-500' : 'text-white/25'}`}>ATS Match</div>
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
                <span className={`px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1 ${isLight ? 'font-bold text-emerald-700' : 'text-emerald-400'}`}>📄 PDF</span>
                <span className={`px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-medium flex items-center gap-1 ${isLight ? 'font-bold text-blue-700' : 'text-blue-400'}`}>📝 Word</span>
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
    { label: 'Check', icon: '🔍', color: '#f59e0b' },
    { label: 'GPT Write', icon: '🧠', color: '#f59e0b' },
    { label: 'Gemini Val', icon: '✨', color: '#22c55e' },
    { label: 'Auto-Fix', icon: '🔧', color: '#8b5cf6' },
    { label: 'Cover Letter', icon: '📝', color: '#3b82f6' },
    { label: 'Complete', icon: '🚀', color: '#06b6d4' },
  ];

  return (
    <div className="elevation-1 overflow-hidden">
      {/* Title bar */}
      <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">✨</span>
          <span className={`text-[11px] font-semibold ${isLight ? 'text-gray-500' : 'text-white/50'}`}>Dual-AI Enhance Pipeline</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${isLight ? 'font-bold bg-cyan-50 border-cyan-200 text-cyan-600' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'}`}>PRO</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-mono ${isLight ? 'text-gray-400' : 'text-white/20'}`}>{stage + 1}/{totalStages}</span>
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
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] transition-all duration-400 ${
                  stage > i ? (isLight ? 'font-bold bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-emerald-500/20 border border-emerald-500/30') :
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
            <span key={p.label} className={`text-[7px] font-medium transition-colors ${
              stage === i ? (isLight ? 'font-bold text-gray-900' : 'text-white/60') : stage > i ? (isLight ? 'font-bold text-emerald-600' : 'text-emerald-500/40') : (isLight ? 'text-gray-400' : 'text-white/15')
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
                  { text: '⚠️ Missing quantified achievements in 3 roles', delay: 0.2 },
                  { text: '⚠️ Weak action verbs: "responsible for", "helped"', delay: 0.7 },
                  { text: '✅ Skills section well-structured', delay: 1.2 },
                  { text: '⚠️ No ATS-friendly keywords from target JD', delay: 1.7 },
                ].map((item, i) => (
                  <motion.div key={item.text} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: item.delay }}
                    className={`text-[9px] flex items-center gap-1.5 ${isLight ? 'font-bold text-gray-600' : 'text-white/30'}`}>
                    <span>{item.text}</span>
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
                    className={`text-[9px] line-through mt-0.5 ${isLight ? 'font-bold text-gray-500' : 'text-white/20'}`}>Responsible for managing team projects</motion.p>
                </div>
                <div className="p-2 rounded bg-emerald-500/[0.03] border border-emerald-500/10">
                  <span className={`text-[8px] font-medium ${isLight ? 'font-bold text-emerald-600' : 'text-emerald-400/60'}`}>AFTER</span>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                    className={`text-[9px] mt-0.5 ${isLight ? 'font-bold text-gray-700' : 'text-white/40'}`}>Led cross-functional team of 8, delivering 3 products on schedule, reducing time-to-market by 40%</motion.p>
                </div>
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}
                className={`mt-2 flex items-center gap-2 text-[8px] ${isLight ? 'font-bold text-gray-500' : 'text-white/20'}`}>
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
                  { text: 'Injecting 12 ATS keywords from target JD', icon: '🔑' },
                  { text: 'Optimizing section ordering for impact', icon: '📊' },
                  { text: 'Checking tone consistency & professionalism', icon: '✍️' },
                ].map((item, i) => (
                  <motion.div key={item.text} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.5 }}
                    className={`text-[9px] flex items-center gap-1.5 ${isLight ? 'font-bold text-gray-600' : 'text-white/25'}`}>
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
                    className={`text-[9px] flex items-center gap-1.5 ${isLight ? 'font-bold text-gray-600' : 'text-white/25'}`}>
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
                  className={`text-[8px] leading-relaxed ${isLight ? 'font-bold text-gray-500' : 'text-white/20'}`}>Dear Hiring Manager,</motion.p>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                  className={`text-[8px] leading-relaxed mt-1 ${isLight ? 'font-bold text-gray-500' : 'text-white/20'}`}>I&apos;m excited to apply for the Senior Frontend Engineer role. With 5+ years building scalable React applications...</motion.p>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: 1.5 }}
                  className="inline-block w-1.5 h-3 bg-blue-400/60 mt-1" />
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}
                className={`mt-1.5 text-[8px] ${isLight ? 'text-gray-400' : 'text-white/15'}`}>Also generating LinkedIn summary...</motion.div>
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
              <div className="grid grid-cols-4 gap-2 mt-3">
                {[
                  { label: 'ATS Score', value: '94%', color: isLight ? 'text-cyan-700' : 'text-cyan-400' },
                  { label: 'Keywords', value: '+12', color: isLight ? 'text-emerald-700' : 'text-emerald-400' },
                  { label: 'Bullets', value: '8 fixed', color: isLight ? 'text-amber-700' : 'text-amber-400' },
                  { label: 'Docs', value: '3 ready', color: isLight ? 'text-blue-700' : 'text-blue-400' },
                ].map((stat) => (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }} className="text-center">
                    <p className={`text-[11px] font-bold ${stat.color}`}>{stat.value}</p>
                    <p className={`text-[7px] ${isLight ? 'font-bold text-gray-500' : 'text-white/20'}`}>{stat.label}</p>
                  </motion.div>
                ))}
              </div>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                className={`text-[8px] mt-2 ${isLight ? 'text-gray-400' : 'text-white/15'}`}>Resume + Cover Letter + LinkedIn ready for download</motion.p>
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
    { label: 'Liquid Resume', icon: '📄', color: isLight ? '#059669' : '#10B981', duration: 15000 },
    { label: 'Dual-AI Enhance', icon: '✨', color: isLight ? '#0891B2' : '#06B6D4', duration: 18000 },
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
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              activeSlide === i
                ? isLight 
                    ? 'text-gray-900 bg-black/5 border border-black/10'
                    : 'text-white bg-white/[0.08] border border-white/[0.12]'
                : isLight
                    ? 'text-gray-500 hover:text-gray-800'
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
          className="w-28 h-28 rounded-full bg-[var(--theme-bg-elevated)] border border-emerald-500/20 flex flex-col items-center justify-center"
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
          <span className={`text-[11px] font-semibold ${isLight ? 'text-gray-500' : 'text-white/50'}`}>The Gauntlet</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium border" style={{ backgroundColor: `${typeColor}${isLight ? '20' : '15'}`, borderColor: `${typeColor}${isLight ? '40' : '30'}`, color: isLight ? '#C2410C' : typeColor }}>{q.type}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${isLight ? 'font-bold bg-black/5 text-gray-500 border-black/10' : 'bg-white/[0.04] text-white/25 border-white/[0.06]'}`}>{q.difficulty}</span>
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
                  <span className="text-sm">🤖</span>
                </motion.div>
                <div>
                  <span className={`text-[9px] font-medium uppercase tracking-wider ${isLight ? 'font-bold text-amber-700' : 'text-amber-400/60'}`}>AI Interviewer</span>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className={`text-[13px] leading-relaxed mt-1 ${isLight ? 'font-bold text-gray-900' : 'text-white/70'}`}>{q.question}</motion.p>
                </div>
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className={`mt-4 flex items-center gap-2 text-[9px] ${isLight ? 'text-gray-400' : 'text-white/15'}`}>
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
                  <span className="text-sm">👤</span>
                </div>
                <div className="flex-1">
                  <span className={`text-[9px] font-medium uppercase tracking-wider ${isLight ? 'font-bold text-emerald-700' : 'text-emerald-400/60'}`}>Your Answer</span>
                  <div className={`mt-1 p-3 rounded-lg border ${isLight ? 'bg-black/5 border-black/10' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                    <p className={`text-[12px] leading-relaxed font-mono ${isLight ? 'font-bold text-gray-700' : 'text-white/50'}`}>
                      {q.answer.substring(0, typedChars)}
                      <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.6, repeat: Infinity }} className="inline-block w-[2px] h-3 bg-amber-400/60 ml-0.5 align-middle" />
                    </p>
                  </div>
                </div>
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className={`mt-3 flex items-center justify-between text-[9px] ${isLight ? 'text-gray-400' : 'text-white/15'}`}>
                <span>{Math.min(typedChars, q.answer.length)} / {q.answer.length} chars</span>
                <span className="flex items-center gap-1"><kbd className={`px-1 py-0.5 rounded border text-[8px] ${isLight ? 'font-bold bg-black/5 border-black/10 text-gray-500' : 'bg-white/[0.04] border-white/[0.08] text-white/70'}`}>⏎</kbd> Submit</span>
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
                      <span className={`text-[10px] font-semibold uppercase tracking-wider w-16 ${isLight ? 'text-gray-500' : 'text-white/30'}`}>{key[0].toUpperCase()}</span>
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
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className={`text-[11px] text-center max-w-xs ${isLight ? 'font-bold text-gray-600' : 'text-white/30'}`}>{q.feedback}</motion.p>
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
const suiteTools = [
  {
    icon: '📄', title: 'Liquid Resume', tag: 'AI-Morphing Builder',
    desc: 'One resume, infinite versions. Choose from 18+ professional templates, then AI morphs it to match any JD — keywords injected, skills reordered, ATS-optimized.',
    color: '#10B981', chips: ['18+ Templates', 'JD Morphing', 'Skill Graph', 'Match Score'],
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

// ═══════════════════════════════════════
// PRO FEATURE LIST — Cycling Scanner Wave
// ═══════════════════════════════════════
const proFeatures = [
  { text: 'Unlimited Morphs', highlight: true },
  { text: 'Unlimited Gauntlet', highlight: true },
  { text: 'Unlimited Flashcards', highlight: true },
  { text: 'Unlimited JD Analysis', highlight: true },
  { text: 'Voice Interview Mode', highlight: true },
  { text: 'Skill Bridge — Learning Paths', highlight: true },
  { text: 'Market Oracle — Career Intel', highlight: true },
  { text: 'Dual-AI Enhance Pipeline', highlight: true },
  { text: 'Auto Cover Letter + LinkedIn', highlight: false },
  { text: 'All 18 Premium Templates', highlight: false },
  { text: 'Priority AI processing', highlight: false },
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
                className={`relative w-4 h-4 rounded-full flex items-center justify-center ${
                  item.highlight ? 'border' : ''
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
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
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
    <div className="relative theme-base-bg transition-colors duration-500">
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
          ? 'bg-white/90 backdrop-blur-lg border-b border-gray-200 shadow-sm'
          : 'bg-[var(--theme-bg)]/90 backdrop-blur-lg border-b border-[var(--theme-border)]'
        : ''}`}>
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <svg className={`w-3 h-3 ${isLight ? 'text-gray-900' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className={`text-[13px] font-semibold tracking-tight ${isLight ? 'text-gray-900' : 'text-white/90'}`}>TalentConsulting<span className="text-emerald-400">.io</span></span>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isLight
                ? 'hover:bg-black/[0.06] text-gray-600'
                : 'hover:bg-white/[0.06] text-white/50 hover:text-white/80'
              }`}
              title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
            >
              <AnimatePresence mode="wait">
                {isLight ? (
                  <motion.svg key="moon" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }} className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </motion.svg>
                ) : (
                  <motion.svg key="sun" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }} className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </motion.svg>
                )}
              </AnimatePresence>
            </button>

            {isAuthenticated ? (
              <button onClick={onGetStarted} className={`text-[13px] font-medium px-3 py-1 rounded-md transition-all ${isLight ? 'font-bold text-gray-700 hover:text-gray-900 hover:bg-black/[0.04]' : 'text-white/70 hover:text-white hover:bg-white/[0.04]'}`}>Dashboard →</button>
            ) : (
              <>
                <button onClick={onShowLogin} className={`text-[13px] px-3 py-1 transition-colors ${isLight ? 'font-bold text-gray-500 hover:text-gray-800' : 'text-white/40 hover:text-white/70'}`}>Sign in</button>
                <button onClick={onShowSignup} className={`text-[13px] font-medium px-3.5 py-1 rounded-md transition-all ${isLight ? 'font-bold text-gray-800 bg-black/[0.05] hover:bg-black/[0.08] border border-black/[0.1]' : 'text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.08]'}`}>Get Started</button>
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
                <span className={`text-[10px] font-medium ${isLight ? 'font-bold text-emerald-700' : 'text-emerald-400/90'}`}>AI-Powered Career Platform</span>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-3xl md:text-4xl font-bold text-[var(--theme-text)] tracking-tight leading-[1.15] mb-3">
                Talent Density,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Decoded</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="text-[14px] text-[var(--theme-text-secondary)] leading-relaxed mb-5 max-w-md">
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
                <button onClick={onShowLogin} className="text-[13px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] px-3 py-2 transition-colors">Watch demo</button>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
                className="flex items-center gap-5 text-[11px]">
                {[{ val: '10x', label: 'Faster prep' }, { val: '95%', label: 'Match accuracy' }, { val: '18+', label: 'Resume templates' }, { val: '8+', label: 'AI tools' }].map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="font-semibold text-[var(--theme-text-secondary)]">{s.val}</span>
                    <span className="text-[var(--theme-text-muted)]">{s.label}</span>
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

          {/* ── Mission Statement Callout ── */}
          <Reveal delay={0.3}>
            <div className="relative my-12 py-8 px-6 rounded-2xl overflow-hidden">
              {/* Gradient border glow */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-emerald-500/5 to-blue-500/10" />
              <div className="absolute inset-[1px] rounded-2xl bg-[var(--theme-bg-card)] transition-colors" />
              <div className="relative text-center">
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="text-lg md:text-xl font-light text-[var(--theme-text-secondary)] italic leading-relaxed max-w-2xl mx-auto"
                >
                  &ldquo;We don&apos;t just dress up your resume.{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 font-medium not-italic">
                    We make you the candidate it says you are.
                  </span>&rdquo;
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 }}
                  className="mt-3 text-[11px] text-[var(--theme-text-muted)] font-medium tracking-widest uppercase"
                >
                  Your AI Career Co-Pilot
                </motion.p>
              </div>
            </div>
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
      {/* THE GAUNTLET — Interview Simulation Showcase     */}
      {/* ════════════════════════════════════════════════ */}
      <section className="relative py-14 border-t border-white/[0.03]">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="mb-8">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              {/* Left — Copy */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-0.5 h-4 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-medium text-amber-400/80 uppercase tracking-[0.2em]">Interview Simulator</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white/90 tracking-tight leading-tight mb-3">
                  Train like you{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-400">fight</span>
                </h2>
                <p className={`text-[14px] leading-relaxed mb-5 max-w-md ${isLight ? 'font-bold text-gray-600' : 'text-white/30'}` }>
                  The Gauntlet throws AI-generated behavioral questions tailored to your target JD, then grades your answers
                  using STAR methodology in real-time. Know exactly where you&apos;re strong — and where to sharpen.
                </p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { icon: '🎯', label: 'JD-Targeted Questions' },
                    { icon: '⭐', label: 'STAR Grading' },
                    { icon: '🎙️', label: 'Voice Mode' },
                  ].map((f) => (
                    <span key={f.label} className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border ${isLight ? 'font-bold text-gray-500 bg-black/5 border-black/10' : 'text-white/30 bg-white/[0.03] border-white/[0.05]'}` }>
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

      <section className="relative py-14 border-t border-white/[0.03]">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="mb-8">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="h-px flex-1 max-w-[28px] bg-white/10" />
              <span className={`text-[10px] font-medium uppercase tracking-[0.2em] ${isLight ? 'font-bold text-gray-500' : 'text-white/20'}` }>The Suite</span>
            </div>
            <h2 className={`text-xl md:text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-white/85'}` }>
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
                          <span className={`text-[13px] font-semibold transition-colors duration-300 ${isActive ? (isLight ? 'text-gray-900' : 'text-white/90') : (isLight ? 'text-gray-400 group-hover:text-gray-600' : 'text-white/40 group-hover:text-white/60')
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
                      <h3 className={`text-[15px] font-semibold ${isLight ? 'text-gray-900' : 'text-white/85'}` }>{suiteTools[activeFeature].title}</h3>
                      <p className="text-[11px] font-medium" style={{ color: suiteTools[activeFeature].color }}>{suiteTools[activeFeature].tag}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className={`text-[13px] leading-relaxed mb-5 max-w-md ${isLight ? 'font-bold text-gray-600' : 'text-white/35'}` }>
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
                    <span className={`text-[9px] ${isLight ? 'text-gray-400' : 'text-white/15'}` }>Powered by AI</span>
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
                <p className={`text-[15px] md:text-base leading-relaxed mb-3 font-light ${isLight ? 'text-gray-600' : 'text-white/50'}` }>
                  &ldquo;{quotes[activeQuote].text}&rdquo;
                </p>
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[9px] font-semibold ${isLight ? 'bg-black/5 border-black/10 text-gray-500' : 'bg-white/[0.04] border-white/[0.06] text-white/35'}` }>
                    {quotes[activeQuote].name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="text-left">
                    <p className={`text-[11px] font-medium ${isLight ? 'font-bold text-gray-700' : 'text-white/45'}` }>{quotes[activeQuote].name}</p>
                    <p className={`text-[9px] ${isLight ? 'text-gray-400' : 'text-white/15'}` }>{quotes[activeQuote].title} • {quotes[activeQuote].co}</p>
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
      {/* PRICING                                         */}
      {/* ════════════════════════════════════════════════ */}
      <section className="relative py-16 border-t border-white/[0.03]">
        {/* Ambient background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)' }} />
        </div>

        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <Reveal className="text-center mb-10">
            <div className="flex items-center justify-center gap-2.5 mb-2">
              <div className="h-px w-6 bg-white/10" />
              <span className={`text-[10px] font-medium uppercase tracking-[0.2em] ${isLight ? 'font-bold text-gray-500' : 'text-white/20'}` }>Pricing</span>
              <div className="h-px w-6 bg-white/10" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white/90 tracking-tight mb-2">
              Start free. Upgrade when you&apos;re{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">hooked</span>
            </h2>
            <p className={`text-[14px] max-w-md mx-auto ${isLight ? 'font-bold text-gray-500' : 'text-white/25'}` }>Less than a coffee. Cancel anytime.</p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">

              {/* ── FREE TIER ── */}
              <div className="elevation-1 relative p-6 flex flex-col">
                <div className="mb-5">
                  <h3 className={`text-[15px] font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-white/70'}` }>Free</h3>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold ${isLight ? 'text-gray-900' : 'text-white/80'}` }>$0</span>
                    <span className={`text-[12px] ${isLight ? 'text-gray-400' : 'text-white/20'}` }>forever</span>
                  </div>
                  <p className={`text-[12px] mt-2 ${isLight ? 'font-bold text-gray-500' : 'text-white/25'}` }>Try every tool. No credit card needed.</p>
                </div>

                <div className="space-y-2.5 mb-6 flex-1">
                  {[
                    { text: '3 Resume Morphs', sub: 'lifetime' },
                    { text: '3 Gauntlet Sessions', sub: 'lifetime' },
                    { text: '2 Flashcard Decks', sub: 'lifetime' },
                    { text: '3 JD Analyses', sub: 'lifetime' },
                    { text: '4 Resume Templates', sub: 'free' },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-white/[0.04] flex items-center justify-center shrink-0">
                        <svg className={`w-2.5 h-2.5 ${isLight ? 'text-gray-400' : 'text-white/25'}` } fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <span className={`text-[12px] ${isLight ? 'font-bold text-gray-600' : 'text-white/40'}` }>{item.text}</span>
                      {item.sub && <span className={`text-[9px] ml-auto ${isLight ? 'text-gray-400' : 'text-white/15'}` }>{item.sub}</span>}
                    </div>
                  ))}
                </div>

                <button onClick={onGetStarted}
                  className={`w-full text-[13px] font-medium py-2.5 rounded-xl transition-all ${isLight ? 'font-bold text-gray-600 bg-black/5 hover:bg-black/10 border border-black/10' : 'text-white/60 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]'}` }>
                  Get Started Free
                </button>
              </div>

              {/* ── PRO TIER ── */}
              <div className="elevation-1 relative !border-emerald-500/20 p-6 flex flex-col overflow-hidden">
                {/* Glow effect */}
                <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 1px 0 rgba(16,185,129,0.1), 0 0 40px rgba(16,185,129,0.04)' }} />

                {/* Popular badge */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={`absolute top-4 right-4 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-[9px] font-semibold uppercase tracking-wider ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}
                >
                  Popular
                </motion.div>

                <div className="relative mb-5">
                  <h3 className={`text-[15px] font-semibold mb-1 ${isLight ? 'text-gray-900' : 'text-white/90'}` }>Pro</h3>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}` }>$2.99</span>
                    <span className={`text-[12px] ${isLight ? 'font-bold text-gray-500' : 'text-white/30'}` }>/ month</span>
                  </div>
                  <p className="text-[12px] text-emerald-400/60 mt-2 flex items-center gap-1.5">
                    <span className={`line-through ${isLight ? 'text-gray-400' : 'text-white/15'}` }>$35.88/yr</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400">$24.99/yr — SAVE 30%</span>
                  </p>
                </div>

                <ProFeatureList />

                <button onClick={onGetStarted}
                  className="relative w-full text-[13px] font-semibold text-black bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/10">
                  Upgrade to Pro
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}
      {/* CTA                                              */}
      {/* ════════════════════════════════════════════════ */}
      <section className="relative py-10 border-t border-white/[0.03]">
        <div className="max-w-xl mx-auto px-6 text-center">
          <Reveal>
            <h2 className={`text-xl font-bold tracking-tight mb-2 ${isLight ? 'text-gray-800' : 'text-white/80'}` }>Ready to start?</h2>
            <p className={`text-[13px] mb-5 ${isLight ? 'font-bold text-gray-500' : 'text-white/20'}` }>Free forever. No credit card needed.</p>
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
                <svg className={`w-2.5 h-2.5 ${isLight ? 'text-gray-900' : 'text-white'}` } fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className={`text-[11px] ${isLight ? 'text-gray-400' : 'text-white/25'}` }>© {new Date().getFullYear()} TalentConsulting.io</span>
            </div>
            <div className={`flex items-center gap-4 text-[11px] ${isLight ? 'text-gray-400' : 'text-white/15'}` }>
              {['Privacy', 'Terms', 'Status'].map(link => (
                <button key={link} className={`transition-colors ${isLight ? 'font-bold hover:text-gray-600' : 'hover:text-white/35'}` }>{link}</button>
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
