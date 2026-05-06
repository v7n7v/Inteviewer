'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { saveResumeVersion, getResumeVersions, createJobApplication, deleteResumeVersion, type ResumeVersion } from '@/lib/database-suite';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import PageHelp from '@/components/PageHelp';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { downloadResumePDF } from '@/lib/pdf-templates';
import { normalizeResume, serializeResumeToText } from '@/lib/resume-normalizer';
import { ResumeTemplate as ResumeTemplateComponent } from '@/components/resume-templates';
import { useUserTier } from '@/hooks/use-user-tier';
import { useTheme } from '@/components/ThemeProvider';
// docx is imported dynamically in downloadWord() to avoid naming conflicts with @react-pdf/renderer
import { saveAs } from 'file-saver';
import { authFetch } from '@/lib/auth-fetch';
import { analytics } from '@/lib/analytics';
import FileUploadDropzone from '@/components/FileUploadDropzone';
import SkillGapWarningModal from '@/components/modals/SkillGapWarningModal';
import UpgradeModal from '@/components/UpgradeModal';
import AuthModal from '@/components/modals/AuthModal';
import ProofCard from '@/components/ProofCard';
import type { ProofResult } from '@/lib/tfidf-proof';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

// ============ TYPES ============
interface ResumeData {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  website?: string;
  summary: string;
  experience: { company: string; role: string; duration: string; achievements: string[] }[];
  education: { degree: string; institution: string; year: string; details?: string }[];
  skills: { category: string; items: string[] }[];
  certifications?: string[];
}

// ============ CONSTANTS ============
const EMPTY_RESUME: ResumeData = {
  name: '',
  title: '',
  email: '',
  phone: '',
  location: '',
  summary: '',
  experience: [],
  education: [],
  skills: [],
  certifications: [],
};

const TEMPLATES = [
  // ── FREE TEMPLATES (5) ──
  { id: 'executive', name: 'Executive', description: 'Professional format for senior roles', preview: 'bar_chart', tier: 'free' as const, colors: { primary: '#1a365d', accent: '#2b6cb0', text: '#1a202c' } },
  { id: 'modern', name: 'Modern', description: 'Rich header band with teal accents', preview: 'auto_awesome', tier: 'free' as const, colors: { primary: '#0d9488', accent: '#14b8a6', text: '#1e293b' } },
  { id: 'minimal', name: 'Minimal', description: 'Clean and elegant, maximum readability', preview: 'my_location', tier: 'free' as const, colors: { primary: '#374151', accent: '#6b7280', text: '#111827' } },
  { id: 'compact', name: 'Compact', description: 'Dense one-page, fits more content', preview: 'content_paste', tier: 'free' as const, colors: { primary: '#15803d', accent: '#16a34a', text: '#14532d' } },
  { id: 'technical', name: 'Technical', description: 'Code-style layout for engineering roles', preview: 'computer', tier: 'free' as const, colors: { primary: '#0369a1', accent: '#0284c7', text: '#0f172a' } },
  // ── PRO TEMPLATES (13) ──
  { id: 'creative', name: 'Creative', description: 'Initials badge with colored chips', preview: 'palette', tier: 'pro' as const, colors: { primary: '#7c3aed', accent: '#8b5cf6', text: '#1f2937' } },
  { id: 'harvard', name: 'Harvard', description: 'Traditional education-first format', preview: 'school', tier: 'pro' as const, colors: { primary: '#991b1b', accent: '#b91c1c', text: '#1c1917' } },
  { id: 'cascade', name: 'Cascade', description: 'Timeline dots with visual flow', preview: 'straighten', tier: 'pro' as const, colors: { primary: '#1e3a5f', accent: '#3b82f6', text: '#1e293b' } },
  { id: 'elegant', name: 'Elegant', description: 'Serif typography with decorative dividers', preview: 'edit', tier: 'pro' as const, colors: { primary: '#44403c', accent: '#78716c', text: '#292524' } },
  { id: 'nordic', name: 'Nordic', description: 'Scandinavian-inspired generous whitespace', preview: 'ac_unit', tier: 'pro' as const, colors: { primary: '#475569', accent: '#94a3b8', text: '#334155' } },
  { id: 'ats-optimized', name: 'ATS Ultra', description: 'Maximum ATS compliance, zero risk', preview: 'smart_toy', tier: 'pro' as const, colors: { primary: '#0f766e', accent: '#14b8a6', text: '#134e4a' } },
  { id: 'double-column', name: 'Columnist', description: 'Skills showcase at top, then experience', preview: 'article', tier: 'pro' as const, colors: { primary: '#1e40af', accent: '#3b82f6', text: '#1e293b' } },
  { id: 'infographic', name: 'Metro', description: 'Bold color blocks with accent bars', preview: 'trending_up', tier: 'pro' as const, colors: { primary: '#c026d3', accent: '#e879f9', text: '#1f2937' } },
  { id: 'deloitte', name: 'Consultant', description: 'Impact-first format with expertise grid', preview: 'domain', tier: 'pro' as const, colors: { primary: '#86bc25', accent: '#0076a8', text: '#1a1a2e' } },
  { id: 'faang', name: 'FAANG', description: 'Big Tech format with timeline accents', preview: 'rocket_launch', tier: 'pro' as const, colors: { primary: '#4285f4', accent: '#34a853', text: '#202124' } },
  { id: 'startup', name: 'Startup', description: 'Bold and energetic for fast movers', preview: 'bolt', tier: 'pro' as const, colors: { primary: '#f97316', accent: '#fb923c', text: '#1c1917' } },
  { id: 'federal', name: 'Federal', description: 'Government format with clearance section', preview: 'account_balance', tier: 'pro' as const, colors: { primary: '#1e3a5f', accent: '#1d4ed8', text: '#111827' } },
  { id: 'academic', name: 'Academic', description: 'Research-focused with publications section', preview: 'school', tier: 'pro' as const, colors: { primary: '#7c2d12', accent: '#c2410c', text: '#1c1917' } },
];

const SKILL_CATEGORIES = [
  'Technical', 'Programming Languages', 'Frameworks', 'Tools & Platforms',
  'Soft Skills', 'Leadership', 'Languages', 'Certifications'
];

// ============ HELPER: Check if resume has data ============
function hasResumeData(resume: ResumeData | null): resume is ResumeData {
  if (!resume) return false;
  return !!(resume.name || resume.summary || resume.experience?.length || resume.education?.length);
}

// ============ LIVE DEMO ANIMATION ============
const demoRoles = [
  { title: 'Frontend Engineer', company: 'Vercel', skills: ['React', 'TypeScript', 'Next.js', 'Tailwind', 'GraphQL'], color: '#00F5FF' },
  { title: 'Data Scientist', company: 'OpenAI', skills: ['Python', 'PyTorch', 'TensorFlow', 'SQL', 'MLOps'], color: '#22C55E' },
  { title: 'Product Manager', company: 'Stripe', skills: ['Strategy', 'Analytics', 'Agile', 'Roadmaps', 'UX'], color: '#F59E0B' },
];

function ResumeMorphDemo() {
  const [roleIdx, setRoleIdx] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRoleIdx(prev => (prev + 1) % demoRoles.length);
      setScore(0);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const target = 82 + Math.floor(Math.random() * 15);
    let cur = 0;
    const tick = setInterval(() => {
      cur += 2;
      if (cur >= target) { cur = target; clearInterval(tick); }
      setScore(cur);
    }, 20);
    return () => clearInterval(tick);
  }, [roleIdx]);

  const role = demoRoles[roleIdx];

  return (
    <div className="elevation-1 p-5 md:p-6">
      <div className="flex flex-col md:flex-row gap-6 items-stretch">
        {/* Left: "Original" resume */}
        <div className="flex-1 rounded-xl bg-[var(--theme-bg-input)] border border-[var(--theme-border)] p-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-3">Your Resume</div>
          <div className="space-y-2">
            <div className="h-3 w-3/4 rounded bg-white/10" />
            <div className="h-2 w-1/2 rounded bg-white/[0.06]" />
            <div className="mt-3 space-y-1.5">
              <div className="h-1.5 w-full rounded bg-white/[0.05]" />
              <div className="h-1.5 w-5/6 rounded bg-white/[0.05]" />
              <div className="h-1.5 w-4/5 rounded bg-white/[0.04]" />
            </div>
            <div className="flex flex-wrap gap-1 mt-3">
              {['JavaScript', 'Node.js', 'HTML/CSS', 'Git', 'REST'].map(s => (
                <span key={s} className="px-1.5 py-0.5 rounded text-[8px] bg-white/[0.04] text-slate-500 border border-white/[0.06]">{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Arrow + JD */}
        <div className="flex md:flex-col items-center justify-center gap-2 py-2">
          <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <span className="text-xs"><span className="material-symbols-rounded text-inherit align-middle">psychology</span></span>
          </div>
          <div className="h-px md:h-8 w-8 md:w-px bg-gradient-to-r md:bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent" />
          <AnimatePresence mode="wait">
            <motion.div
              key={role.company}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="px-2 py-1 rounded-md text-[8px] font-medium border whitespace-nowrap"
              style={{ backgroundColor: `${role.color}08`, borderColor: `${role.color}20`, color: role.color }}
            >
              JD: {role.company}
            </motion.div>
          </AnimatePresence>
          <div className="h-px md:h-8 w-8 md:w-px bg-gradient-to-r md:bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent" />
          <svg className="w-5 h-5 text-cyan-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>

        {/* Right: "Morphed" resume */}
        <div className="flex-1 rounded-xl border p-4 transition-all duration-500" style={{ borderColor: `${role.color}20`, backgroundColor: `${role.color}03` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: role.color }}>Morphed</div>
            <motion.div className="text-[10px] font-bold" style={{ color: role.color }}>{score}%</motion.div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-3/4 rounded" style={{ backgroundColor: `${role.color}15` }} />
            <AnimatePresence mode="wait">
              <motion.div
                key={role.title}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-[9px] font-medium" style={{ color: role.color }}
              >{role.title}</motion.div>
            </AnimatePresence>
            <div className="mt-2 space-y-1.5">
              <div className="h-1.5 w-full rounded" style={{ backgroundColor: `${role.color}08` }} />
              <div className="h-1.5 w-5/6 rounded" style={{ backgroundColor: `${role.color}08` }} />
              <div className="h-1.5 w-4/5 rounded" style={{ backgroundColor: `${role.color}06` }} />
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={role.title}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-wrap gap-1 mt-3"
              >
                {role.skills.map((s, i) => (
                  <motion.span
                    key={s}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06 }}
                    className="px-1.5 py-0.5 rounded text-[8px] font-medium"
                    style={{ backgroundColor: `${role.color}12`, color: role.color, border: `1px solid ${role.color}25` }}
                  >{s}</motion.span>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
          {/* ATS bar */}
          <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${role.color}10` }}>
            <motion.div className="h-full rounded-full" style={{ backgroundColor: role.color }} animate={{ width: `${score}%` }} transition={{ duration: 0.1 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
// ============ WORKFLOW ANIMATION ============
const workflowSteps = [
  { id: 'upload', step: '01', icon: 'outbox', title: 'Upload Resume', desc: 'PDF, Word, or text' },
  { id: 'paste', step: '02', icon: 'content_paste', title: 'Paste JD', desc: 'Target job description' },
  { id: 'morph', step: '03', icon: 'psychology', title: 'AI Morph', desc: 'Smart rewrite engine' },
  { id: 'download', step: '04', icon: 'arrow_downward', title: 'Download', desc: 'ATS-safe export' },
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
    <div className="elevation-1 p-5 md:p-6 overflow-hidden">
      {/* Step indicators */}
      <div className="grid grid-cols-4 gap-2 md:gap-3 mb-6">
        {workflowSteps.map((ws, i) => {
          const isActive = activeStep === i;
          const isPast = activeStep > i;
          return (
            <motion.button
              key={ws.id}
              onClick={() => setActiveStep(i)}
              className={`relative p-3 md:p-4 rounded-xl border transition-all duration-500 text-left overflow-hidden ${
                isActive
                  ? 'border-cyan-500/40 bg-cyan-500/[0.05]'
                  : isPast
                    ? 'border-cyan-500/10 bg-cyan-500/[0.02]'
                    : 'border-white/[0.06] bg-white/[0.01]'
              }`}
            >
              {/* Active glow */}
              {isActive && (
                <motion.div
                  layoutId="stepGlow"
                  className="absolute inset-0 rounded-xl"
                  style={{ boxShadow: '0 0 30px rgba(0,245,255,0.08), inset 0 0 20px rgba(0,245,255,0.03)' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}

              {/* Progress bar at top */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-white/[0.03]">
                {isActive && (
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3.5, ease: 'linear' }}
                    key={`progress-${activeStep}-${i}`}
                  />
                )}
                {isPast && <div className="h-full w-full bg-cyan-500/30" />}
              </div>

              <div className="relative">
                <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${isActive ? 'text-cyan-400' : isPast ? 'text-cyan-500/30' : 'text-white/20'}`}>{ws.step}</span>
                <motion.div
                  className="text-xl md:text-2xl mt-1"
                  animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.6 }}
                >{ws.icon}</motion.div>
                <h3 className={`text-xs md:text-sm font-semibold mt-1 transition-colors ${isActive ? 'text-white' : 'text-slate-500'}`}>{ws.title}</h3>
                <p className={`text-[10px] md:text-xs mt-0.5 transition-colors hidden md:block ${isActive ? 'text-slate-400' : 'text-slate-600'}`}>{ws.desc}</p>
              </div>

              {/* Checkmark for completed */}
              {isPast && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Animated stage content */}
      <div className="relative min-h-[160px] rounded-xl bg-[var(--theme-bg-input)] border border-[var(--theme-border)] overflow-hidden">
        <AnimatePresence mode="wait">
          {/* Step 0: Upload */}
          {activeStep === 0 && (
            <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-6 flex flex-col items-center justify-center h-[160px]">
              <motion.div
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="text-4xl mb-3"
              ><span className="material-symbols-rounded text-inherit align-middle">description</span></motion.div>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="px-4 py-2 rounded-xl border-2 border-dashed border-cyan-500/30 bg-cyan-500/[0.03] text-xs text-cyan-400 flex items-center gap-2"
              >
                <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>↑</motion.span>
                resume_v3.pdf uploaded
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="mt-3 flex items-center gap-3 text-[10px] text-slate-500"
              >
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />PDF parsed</span>
                <span>•</span>
                <span>3 pages</span>
                <span>•</span>
                <span>12 skills detected</span>
              </motion.div>
            </motion.div>
          )}

          {/* Step 1: Paste JD */}
          {activeStep === 1 && (
            <motion.div key="paste" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-6 h-[160px]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-500">Target:</span>
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-xs font-medium text-cyan-400">Senior Frontend Engineer — Vercel</motion.span>
              </div>
              <div className="space-y-2 font-mono">
                {[
                  'Looking for a Senior Frontend Engineer...',
                  'Requirements: React, TypeScript, Next.js',
                  'Experience with design systems, A11y...',
                  'Bonus: GraphQL, testing frameworks',
                ].map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.4 }}
                    className="text-[11px] text-slate-500 flex items-center gap-2"
                  >
                    <span className="text-cyan-500/40">|</span>
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: 'auto' }}
                      transition={{ delay: 0.5 + i * 0.4, duration: 0.3 }}
                      className="overflow-hidden whitespace-nowrap"
                    >{line}</motion.span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: AI Morph */}
          {activeStep === 2 && (
            <motion.div key="morph" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-6 h-[160px]">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full"
                    />
                    <span className="text-xs text-cyan-400 font-medium">Morphing in progress...</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {morphSkills.map((skill, i) => (
                      <motion.span
                        key={skill}
                        initial={{ opacity: 0, scale: 0.5, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      >{skill}</motion.span>
                    ))}
                  </div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: morphScore > 0 ? 1 : 0 }}
                    className="mt-3 flex items-center gap-2 text-[10px] text-slate-500"
                  >
                    <span>Keywords injected</span>
                    <span className="text-cyan-500/40">•</span>
                    <span>Skills reordered</span>
                    <span className="text-cyan-500/40">•</span>
                    <span>Format optimized</span>
                  </motion.div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-[10px] text-slate-500 mb-1">ATS Match</div>
                  <motion.div className="text-2xl font-bold text-cyan-400">{morphScore}%</motion.div>
                  <div className="w-20 h-1.5 rounded-full bg-white/[0.04] mt-1 overflow-hidden">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" animate={{ width: `${morphScore}%` }} transition={{ duration: 0.05 }} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Download */}
          {activeStep === 3 && (
            <motion.div key="download" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-6 flex flex-col items-center justify-center h-[160px]">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-3"
              >
                <motion.svg initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.4, duration: 0.5 }} className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <motion.path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 0.5 }} />
                </motion.svg>
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-sm font-semibold text-white mb-1">Resume Ready</motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex items-center gap-3">
                <button className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-medium text-cyan-400 flex items-center gap-1">
                  <span className="material-symbols-rounded align-middle mr-1">description</span> PDF
                </button>
                <button className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-medium text-blue-400 flex items-center gap-1">
                  <span className="material-symbols-rounded align-middle mr-1">edit_document</span> Word
                </button>
                <span className="text-[10px] text-green-400 font-bold">92% Match</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============ MAIN COMPONENT ============
export default function LiquidResumePage() {
  const { user } = useStore();
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLDivElement>(null);

  // ===== STATE =====
  const [mode, setMode] = useState<'choose' | 'morph' | 'create'>('choose');
  const [step, setStep] = useState<'upload' | 'jd' | 'enhance' | 'template' | 'preview'>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [invalidDocumentError, setInvalidDocumentError] = useState(false);

  // Resume data
  const [originalResume, setOriginalResume] = useState<ResumeData | null>(null);
  const [morphedResume, setMorphedResume] = useState<ResumeData | null>(null);
  const [buildResume, setBuildResume] = useState<ResumeData>({ ...EMPTY_RESUME });

  // Morph settings
  const [jobDescription, setJobDescription] = useState('');
  const [morphPercentage, setMorphPercentage] = useState(75);
  const [targetPageCount, setTargetPageCount] = useState<number | 'auto'>('auto');
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [proofData, setProofData] = useState<ProofResult | null>(null);
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [flashWarning, setFlashWarning] = useState(false);

  // Day-Zero Blueprint
  const [blueprintContent, setBlueprintContent] = useState<string | null>(null);
  const [isBlueprintLoading, setIsBlueprintLoading] = useState(false);
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);

  // Tier awareness
  const { tier, isPro, canUse, remaining, caps, refetch: refetchUsage } = useUserTier();

  // UI state
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [buildStep, setBuildStep] = useState(0);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [processingStage, setProcessingStage] = useState<'uploading' | 'extracting' | 'parsing' | null>(null);

  // Enhance step state
  const [enhancePhase, setEnhancePhase] = useState<'idle' | 'checking' | 'fixing' | 'cover-letter' | 'linkedin'>('idle');
  const [enhancePipelineStage, setEnhancePipelineStage] = useState(0); // 0=idle, 1=AI writing, 2=AI checking, 3=refining
  const [autoFixing, setAutoFixing] = useState(false);
  const [preFixScore, setPreFixScore] = useState<number | null>(null);

  // Modals
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [saveVersionName, setSaveVersionName] = useState('');
  const [saveCompanyName, setSaveCompanyName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [applicationData, setApplicationData] = useState({ companyName: '', jobTitle: '', notes: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Skill gap detection
  const [showSkillGapModal, setShowSkillGapModal] = useState(false);
  const [detectedNewSkills, setDetectedNewSkills] = useState<{ skill: string; category: 'technical' | 'soft' | 'domain' }[]>([]);
  const [lastMatchScore, setLastMatchScore] = useState<number | undefined>(undefined);

  // No-navigate sent state for Cover Letter / LinkedIn
  const [coverLetterSent, setCoverLetterSent] = useState(false);
  const [linkedInSent, setLinkedInSent] = useState(false);

  // Saved blueprints from localStorage
  const [savedBlueprints, setSavedBlueprints] = useState<{ id: string; content: string; targetRole: string; createdAt: string }[]>([]);
  const [showSavedBlueprints, setShowSavedBlueprints] = useState(false);

  // Load saved blueprints on mount
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('tc_blueprints') || '[]');
      setSavedBlueprints(stored);
    } catch {}
  }, []);

  // ===== DERIVED STATE =====
  // This is the KEY fix - always compute which resume to display
  const getDisplayResume = (): ResumeData | null => {
    if (mode === 'morph') {
      // For morph mode: prefer morphed, fallback to original
      if (hasResumeData(morphedResume)) return morphedResume;
      if (hasResumeData(originalResume)) return originalResume;
      return null;
    }
    if (mode === 'create') {
      // For create mode: use build resume
      if (hasResumeData(buildResume)) return buildResume;
      return null;
    }
    return null;
  };

  // ===== SESSION PERSISTENCE =====
  // Persist in-progress work so navigating away doesn't lose progress
  const SESSION_KEY = 'talent-resume-draft';

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (!saved) return;
      const draft = JSON.parse(saved);
      if (draft.originalResume) setOriginalResume(draft.originalResume);
      if (draft.morphedResume) setMorphedResume(draft.morphedResume);
      if (draft.jobDescription) setJobDescription(draft.jobDescription);
      if (draft.morphPercentage) setMorphPercentage(draft.morphPercentage);
      if (draft.matchScore) setMatchScore(draft.matchScore);
      if (draft.selectedTemplateId) {
        const tmpl = TEMPLATES.find(t => t.id === draft.selectedTemplateId);
        if (tmpl) setSelectedTemplate(tmpl);
      }
      if (draft.mode && draft.mode !== 'choose') setMode(draft.mode);
      if (draft.step) setStep(draft.step);
      if (draft.buildResume) setBuildResume(draft.buildResume);
    } catch { /* ignore corrupt storage */ }
  }, []);

  // Auto-save draft when key state changes
  useEffect(() => {
    // Don't save if user hasn't started anything
    if (mode === 'choose' && !originalResume && !buildResume?.name) return;
    try {
      const draft = {
        originalResume,
        morphedResume,
        jobDescription,
        morphPercentage,
        matchScore,
        selectedTemplateId: selectedTemplate.id,
        mode,
        step,
        buildResume: mode === 'create' ? buildResume : undefined,
        savedAt: Date.now(),
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(draft));
    } catch { /* quota exceeded — ignore */ }
  }, [originalResume, morphedResume, jobDescription, morphPercentage, matchScore, selectedTemplate, mode, step, buildResume]);

  // Clear draft when workflow completes (save/download)
  const clearDraft = () => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  };

  // ===== EFFECTS =====
  useEffect(() => { if (user) loadVersions(); }, [user]);

  useEffect(() => {
    if (morphPercentage >= 80) {
      setFlashWarning(true);
      const timer = setTimeout(() => setFlashWarning(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [morphPercentage]);

  // ===== DATA LOADING =====
  const loadVersions = async () => {
    // Guard: don't hit Firestore without authentication
    if (!user) return;
    const result = await getResumeVersions();
    if (result.success && result.data) setVersions(result.data);
  };

  // ===== FILE EXTRACTION =====
  const extractFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }
    return text;
  };

  const extractFromWord = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  // ===== AI FUNCTIONS =====
  const parseResumeWithAI = async (text: string): Promise<ResumeData> => {
    const res = await authFetch('/api/resume/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Parse failed' }));
      if (err.requiresAuth) { setShowDownloadAuth('signup'); throw new Error('Sign in to continue'); }
      throw new Error(err.error || 'Failed to parse resume');
    }
    const data = await res.json();
    return data.resume;
  };

  const morphResumeToJD = async (resume: ResumeData, jd: string, percentage: number, pageCount: number | 'auto'): Promise<{ morphed: ResumeData; score: number; proof?: ProofResult }> => {
    const res = await authFetch('/api/resume/morph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume, jobDescription: jd, morphPercentage: percentage, targetPageCount: pageCount }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Morph failed' }));
      if (err.requiresAuth) { setShowDownloadAuth('signup'); throw new Error('Sign in to continue'); }
      if (err.limitReached) { setShowDownloadAuth('signup'); throw new Error(err.error || 'Free tier limit reached'); }
      throw new Error(err.error || 'Failed to morph resume');
    }
    const data = await res.json();
    return { morphed: data.morphedResume, score: data.matchScore, proof: data.proof };
  };

  const extractCompanyFromJD = async (jd: string): Promise<string> => {
    try {
      const res = await authFetch('/api/resume/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract_company', jobDescription: jd }),
      });
      if (!res.ok) return '';
      const data = await res.json();
      return data.company || '';
    } catch { return ''; }
  };

  // ===== HANDLERS =====
  const handleFileExtracted = async (text: string) => {
    setIsLoading(true);
    setInvalidDocumentError(false);
    setProcessingStage('extracting');
    try {
      // Brief pause so user sees the "extracting" stage
      await new Promise(r => setTimeout(r, 800));
      setProcessingStage('parsing');
      showToast('Parsing resume with AI...', 'psychology');
      const parsed = await parseResumeWithAI(text);
      setOriginalResume(parsed);
      showToast('Resume parsed successfully!', 'check_circle');
      setStep('jd');
    } catch (error: any) {
      console.error('AI parsing error:', error);
      if (error.message?.includes('INVALID_DOCUMENT') || error.message?.includes('look like a resume')) {
        setInvalidDocumentError(true);
      } else {
        showToast(error.message || 'Failed to process resume with AI', 'cancel');
      }
    } finally {
      setIsLoading(false);
      setProcessingStage(null);
    }
  };

  // ── Day-Zero Blueprint ──
  const handleBlueprint = async () => {
    if (!originalResume || !jobDescription.trim()) return;
    setIsBlueprintLoading(true);
    try {
      showToast('Generating your Day-Zero Blueprint...', 'content_paste');
      const res = await authFetch('/api/resume/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume: originalResume, jobDescription }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Blueprint generation failed' }));
        if (err.upgrade) {
          showToast('Day-Zero Blueprint is a Pro feature <span className="material-symbols-rounded align-middle mr-1">auto_awesome</span>', 'lock');
          return;
        }
        throw new Error(err.error || 'Failed to generate blueprint');
      }
      const data = await res.json();
      setBlueprintContent(data.blueprint);
      setShowBlueprintModal(true);
      // Persist blueprint so it can be re-opened from Applications tracker
      try {
        const companyName = originalResume.experience?.[0]?.company || 'Unknown';
        const stored = JSON.parse(localStorage.getItem('tc_blueprints') || '[]');
        stored.unshift({
          id: `bp_${Date.now()}`,
          content: data.blueprint,
          targetRole: originalResume.title || '',
          createdAt: new Date().toISOString(),
        });
        const trimmed = stored.slice(0, 10);
        localStorage.setItem('tc_blueprints', JSON.stringify(trimmed));
        setSavedBlueprints(trimmed);
      } catch {}
      showToast('Day-Zero Blueprint ready!', 'check_circle');
    } catch (error) {
      console.error('Blueprint error:', error);
      showToast('Failed to generate blueprint', 'cancel');
    } finally {
      setIsBlueprintLoading(false);
    }
  };

  const handleMorph = async () => {
    if (!originalResume || !jobDescription.trim()) return;
    setIsLoading(true);
    try {
      showToast(`AI is morphing your resume at ${morphPercentage}% intensity...`, 'psychology');
      const { morphed, score, proof } = await morphResumeToJD(originalResume, jobDescription, morphPercentage, targetPageCount);

      // CRITICAL: Always ensure we have valid data before proceeding
      const validResume = hasResumeData(morphed) ? morphed : originalResume;

      setMorphedResume(normalizeResume(validResume, originalResume) as any);
      setMatchScore(score);
      setProofData(proof || null);
      // Clear stale enhance results from previous resume version
      setResumeCheckResult(null);
      setPreFixScore(null);
      setStep(isPro ? 'enhance' : 'template');
      showToast(`Resume morphed! ${score}% match`, 'check_circle');
      analytics.toolUse('resume_morph');

      // ── Skill Gap Detection ──
      try {
        const originalSkills = (originalResume.skills || []).flatMap(s => s.items || []).map(s => s.toLowerCase().trim()).filter(Boolean);
        const morphedSkills = (validResume.skills || []).flatMap(s => s.items || []).map(s => s.toLowerCase().trim()).filter(Boolean);
        const originalSet = new Set(originalSkills);
        const newSkills = [...new Set(morphedSkills.filter(s => !originalSet.has(s)))];

        if (newSkills.length > 0) {
          // Classify skills (simple heuristic)
          const softSkills = new Set(['leadership', 'communication', 'teamwork', 'problem-solving', 'time management', 'adaptability', 'collaboration', 'critical thinking', 'mentoring', 'negotiation', 'presentation', 'conflict resolution', 'decision making', 'emotional intelligence']);
          const classified = newSkills.map(skill => ({
            skill: morphedSkills.find(ms => ms === skill) ? (validResume.skills || []).flatMap(s => s.items || []).find(item => item.toLowerCase().trim() === skill) || skill : skill,
            category: (softSkills.has(skill) ? 'soft' : 'technical') as 'technical' | 'soft' | 'domain',
          }));

          setDetectedNewSkills(classified);
          setLastMatchScore(score);

          // Save to localStorage for Skill Bridge
          localStorage.setItem('tc_skill_gaps', JSON.stringify({
            gaps: classified.map(c => ({ skill: c.skill, confidence: 'ai-added', category: c.category })),
            jdTitle: applicationData.jobTitle || 'Target Role',
            companyName: applicationData.companyName || '',
            timestamp: Date.now(),
          }));

          // Show warning modal after a brief delay
          setTimeout(() => setShowSkillGapModal(true), 800);
        }
      } catch (diffErr) {
        console.warn('Skill diff error (non-critical):', diffErr);
      }

      // Extract company name (non-blocking)
      try {
        if (!applicationData.companyName) {
          const company = await extractCompanyFromJD(jobDescription);
          if (company) setApplicationData(prev => ({ ...prev, companyName: company }));
        }
      } catch { /* non-critical */ }
    } catch (error) {
      console.error('Morph error:', error);
      showToast('Failed to morph resume', 'cancel');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    const resume = getDisplayResume();
    if (!resume) return;
    setSaveVersionName(resume.title || 'My Resume');
    setSaveCompanyName(applicationData.companyName || '');
    setSaveSuccess(false);
    setShowSaveModal(true);
  };

  const confirmSave = async () => {
    if (!saveCompanyName.trim()) {
      showToast('Enter a company name to track this application', 'cancel');
      return;
    }
    // Use a local variable for version name since setState is async
    const versionName = saveVersionName.trim() || getDisplayResume()?.title || 'My Resume';
    if (!saveVersionName.trim()) {
      setSaveVersionName(versionName);
    }
    const resume = getDisplayResume();
    if (!resume) {
      showToast('No resume data to save — generate or upload a resume first', 'cancel');
      return;
    }
    setIsSaving(true);
    try {
      // 1. Save the resume version
      console.log('[Save & Track] Saving resume version:', versionName, 'for', saveCompanyName);
      const result = await saveResumeVersion(
        `${versionName} — ${saveCompanyName}`,
        resume as any,
        { matchScore, template: selectedTemplate.id, morphPercentage },
        'technical'
      );
      if (!result.success) {
        console.error('[Save & Track] Save failed:', result.error);
        showToast(result.error || 'Save failed — check your connection', 'cancel');
        setIsSaving(false);
        return;
      }
      console.log('[Save & Track] Resume saved, creating application entry...');

      // 2. Auto-create an application entry
      const appResult = await createJobApplication({
        companyName: saveCompanyName,
        jobTitle: resume.title || versionName,
        jobDescription: jobDescription || undefined,
        resumeVersionId: result.data?.id,
        morphedResumeName: versionName,
        talentDensityScore: matchScore || undefined,
      });
      
      if (!appResult.success) {
        console.warn('[Save & Track] Application creation failed:', appResult.error);
        // Resume was saved, just the application entry failed — still proceed
        showToast(`Resume saved for ${saveCompanyName}! (Application tracking may need retry)`, 'check_circle');
      } else {
        console.log('[Save & Track] Application created successfully');
        showToast(`Saved & tracked for ${saveCompanyName}!`, 'check_circle');
      }

      // 3. Show success state & clear draft
      clearDraft();
      setSaveSuccess(true);
      loadVersions();

      // Auto-close after brief visual confirmation
      setTimeout(() => {
        setShowSaveModal(false);
        setSaveVersionName('');
        setSaveCompanyName('');
        setSaveSuccess(false);
      }, 1500);
    } catch (error: any) {
      console.error('[Save & Track] Unexpected error:', error);
      showToast(`Save failed: ${error.message || 'Unknown error — check console'}`, 'cancel');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateApplication = async () => {
    if (!applicationData.companyName.trim()) {
      showToast('Please enter a company name', 'cancel');
      return;
    }
    setIsLoading(true);
    try {
      const resume = getDisplayResume();
      const result = await createJobApplication({
        companyName: applicationData.companyName,
        jobTitle: applicationData.jobTitle || resume?.title || 'Position',
        jobDescription: jobDescription || undefined,
        morphedResumeName: saveVersionName || resume?.name || 'Resume',
      });
      if (result.success) {
        showToast('Application tracked! View in Applications tab.', 'check_circle');
        setShowApplicationModal(false);
        setApplicationData({ companyName: '', jobTitle: '', notes: '' });
      } else {
        showToast(result.error || 'Failed to create application', 'cancel');
      }
    } catch (error: any) {
      console.error('Application error:', error);
      showToast(`Failed: ${error.message || 'Unknown error'}`, 'cancel');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteVersion = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const result = await deleteResumeVersion(deleteConfirmId);
    if (result.success) {
      showToast('Version deleted', 'check_circle');
      loadVersions();
    }
    setDeleteConfirmId(null);
  };

  const loadVersionToMorph = (version: ResumeVersion) => {
    setOriginalResume(version.content as unknown as ResumeData);
    setMode('morph');
    setStep('jd');
    showToast('Resume loaded!', 'check_circle');
  };

  // ===== AUTH GATE FOR DOWNLOADS =====
  const [showDownloadAuth, setShowDownloadAuth] = useState<'login' | 'signup' | null>(null);

  // ===== DOWNLOAD FUNCTIONS =====
  const downloadPDF = async () => {
    // Gate: require sign-in before download
    if (!user) {
      setShowDownloadAuth('signup');
      return;
    }
    const resume = getDisplayResume();
    if (!resume) {
      showToast('No resume data available', 'cancel');
      return;
    }
    setIsLoading(true);
    try {
      await downloadResumePDF(resume, selectedTemplate.colors, undefined, selectedTemplate.id);
      showToast('PDF downloaded!', 'check_circle');
      analytics.resumeDownload('pdf');
      clearDraft();
    } catch (error: any) {
      console.error('PDF download error:', error);
      showToast(`PDF download failed: ${error.message || 'Unknown error'}`, 'cancel');
    }
    finally { setIsLoading(false); }
  };

  const downloadWord = async () => {
    // Gate: require sign-in before download
    if (!user) {
      setShowDownloadAuth('signup');
      return;
    }
    const resume = getDisplayResume();
    if (!resume) return;
    setIsLoading(true);
    try {
    // Dynamic import to avoid naming conflicts with @react-pdf/renderer
    const { Document: DocxDocument, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType, TableBorders } = await import('docx');
    const tc = selectedTemplate.colors;
    const p = tc.primary.replace('#', '');
    const a = tc.accent.replace('#', '');
    const t = tc.text.replace('#', '');
    const contact = [resume.email, resume.phone, resume.location, resume.linkedin, resume.website].filter(Boolean);
    const noBorders = { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } } as any;

    // ── Shared helpers ──
    const sectionHead = (label: string, opts?: { font?: string; borderColor?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] }) => new Paragraph({
      spacing: { before: 200, after: 80 },
      alignment: opts?.align,
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: opts?.borderColor || 'E0E0E0' } },
      children: [new TextRun({ text: label, bold: true, size: 24, color: p, font: opts?.font || 'Calibri', allCaps: true })],
    });

    const expBlock = (exp: any, opts?: { font?: string; bullet?: string; companyFirst?: boolean }) => {
      const f = opts?.font || 'Calibri';
      const bul = opts?.bullet || '•';
      const rows: any[] = [];
      if (opts?.companyFirst) {
        rows.push(new Paragraph({
          spacing: { before: 100, after: 20 },
          tabStops: [{ type: 'right' as any, position: 9000 }],
          children: [
            new TextRun({ text: exp.company, bold: true, size: 22, color: t, font: f }),
            new TextRun({ text: ', ', size: 20, color: '555555', font: f }),
            new TextRun({ text: exp.role, italics: true, size: 20, color: '555555', font: f }),
            new TextRun({ text: `\t${exp.duration}`, size: 18, color: '666666', font: f }),
          ],
        }));
      } else {
        rows.push(new Paragraph({
          spacing: { before: 100, after: 20 },
          tabStops: [{ type: 'right' as any, position: 9000 }],
          children: [
            new TextRun({ text: exp.role, bold: true, size: 22, color: t, font: f }),
            new TextRun({ text: `\t${exp.duration}`, italics: true, size: 18, color: '666666', font: f }),
          ],
        }));
        rows.push(new Paragraph({
          spacing: { after: 50 },
          children: [new TextRun({ text: exp.company, size: 20, color: a, font: f })],
        }));
      }
      exp.achievements?.forEach((ach: string) => {
        rows.push(new Paragraph({
          spacing: { after: 25 },
          indent: { left: 360 },
          children: [new TextRun({ text: `${bul}  ${ach}`, size: 19, color: '333333', font: f })],
        }));
      });
      rows.push(new Paragraph({ spacing: { after: 60 }, text: '' }));
      return rows;
    };

    const eduBlock = (edu: any, opts?: { font?: string }) => new Paragraph({
      spacing: { after: 50 },
      children: [
        new TextRun({ text: edu.degree, bold: true, size: 21, color: t, font: opts?.font || 'Calibri' }),
        new TextRun({ text: `  —  ${edu.institution}`, size: 20, color: '555555', font: opts?.font || 'Calibri' }),
        new TextRun({ text: `  (${edu.year})`, size: 18, color: '777777', font: opts?.font || 'Calibri' }),
      ],
    });

    const skillBlock = (cat: any, opts?: { font?: string }) => new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: `${cat.category}: `, bold: true, size: 20, color: p, font: opts?.font || 'Calibri' }),
        new TextRun({ text: cat.items.join(', '), size: 20, color: '444444', font: opts?.font || 'Calibri' }),
      ],
    });

    const certBlocks = () => resume.certifications?.length ? [
      sectionHead('CERTIFICATIONS'),
      ...resume.certifications.map(c => new Paragraph({ spacing: { after: 25 }, indent: { left: 360 }, children: [new TextRun({ text: `•  ${c}`, size: 19, color: '333333' })] })),
    ] : [];

      let children: any[] = [];
      const tmpl = selectedTemplate.id;

      if (tmpl === 'minimal') {
        // ── MINIMAL: centered, light, dash bullets ──
        children = [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 30 }, children: [new TextRun({ text: resume.name, size: 52, color: t, font: 'Calibri' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: resume.title, size: 22, color: '999999', font: 'Calibri' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' } }, children: [new TextRun({ text: contact.join('  •  '), size: 18, color: '999999' })] }),
          ...(resume.summary ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: resume.summary, size: 20, color: '555555' })] })] : []),
          ...(resume.experience?.length ? [
            new Paragraph({ spacing: { before: 160, after: 80 }, children: [new TextRun({ text: 'EXPERIENCE', size: 18, color: '999999', allCaps: true, font: 'Calibri' })] }),
            ...resume.experience.flatMap(exp => expBlock(exp, { bullet: '–' })),
          ] : []),
          ...(resume.education?.length ? [
            new Paragraph({ spacing: { before: 160, after: 80 }, children: [new TextRun({ text: 'EDUCATION', size: 18, color: '999999', allCaps: true })] }),
            ...resume.education.map(edu => eduBlock(edu)),
          ] : []),
          ...(resume.skills?.length ? [
            new Paragraph({ spacing: { before: 160, after: 80 }, children: [new TextRun({ text: 'SKILLS', size: 18, color: '999999', allCaps: true })] }),
            new Paragraph({ children: [new TextRun({ text: resume.skills.flatMap(s => s.items).join(',  '), size: 20, color: '555555' })] }),
          ] : []),
        ];
      } else if (tmpl === 'creative') {
        // ── CREATIVE: initials prefix, emoji heading icons, triangle bullets ──
        const initials = resume.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '';
        children = [
          new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: `[${initials}]  `, bold: true, size: 28, color: 'FFFFFF', highlight: 'blue' as any }), new TextRun({ text: resume.name, bold: true, size: 52, color: p })] }),
          new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: resume.title, size: 28, color: '666666' })] }),
          new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: contact.map((c, i) => (i === 0 ? 'E: ' : i === 1 ? 'P: ' : 'L: ') + c).join('    '), size: 18, color: '555555' })] }),
          ...(resume.summary ? [new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: resume.summary, size: 20, color: '555555' })] })] : []),
          ...(resume.experience?.length ? [
            new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: 'EXPERIENCE', bold: true, size: 24, color: p })] }),
            ...resume.experience.flatMap(exp => expBlock(exp, { bullet: 'arrow_right' })),
          ] : []),
          ...(resume.education?.length ? [
            new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: 'EDUCATION', bold: true, size: 24, color: p })] }),
            ...resume.education.map(edu => eduBlock(edu)),
          ] : []),
          ...(resume.skills?.length ? [
            new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: 'SKILLS', bold: true, size: 24, color: p })] }),
            ...resume.skills.map(cat => skillBlock(cat)),
          ] : []),
        ];
      } else if (tmpl === 'harvard') {
        // ── HARVARD: centered name, education FIRST, company-first experience ──
        children = [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 50 }, children: [new TextRun({ text: resume.name, bold: true, size: 48, color: p, font: 'Georgia' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: p } }, children: [new TextRun({ text: contact.join('  |  '), size: 18, color: '555555', font: 'Georgia' })] }),
          ...(resume.education?.length ? [
            sectionHead('EDUCATION', { font: 'Georgia', borderColor: `${p}66` }),
            ...resume.education.flatMap(edu => [
              new Paragraph({ spacing: { after: 20 }, tabStops: [{ type: 'right' as any, position: 9000 }], children: [new TextRun({ text: edu.institution, bold: true, size: 22, color: t, font: 'Georgia' }), new TextRun({ text: `\t${edu.year}`, size: 18, color: '666666', font: 'Georgia' })] }),
              new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: edu.degree, italics: true, size: 20, color: '555555', font: 'Georgia' })] }),
            ]),
          ] : []),
          ...(resume.experience?.length ? [
            sectionHead('EXPERIENCE', { font: 'Georgia', borderColor: `${p}66` }),
            ...resume.experience.flatMap(exp => expBlock(exp, { font: 'Georgia', companyFirst: true })),
          ] : []),
          ...(resume.skills?.length ? [
            sectionHead('SKILLS & INTERESTS', { font: 'Georgia', borderColor: `${p}66` }),
            ...resume.skills.map(cat => skillBlock(cat, { font: 'Georgia' })),
          ] : []),
          ...(resume.summary ? [
            sectionHead('SUMMARY', { font: 'Georgia', borderColor: `${p}66` }),
            new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: resume.summary, size: 20, color: '555555', font: 'Georgia' })] }),
          ] : []),
        ];
      } else if (tmpl === 'elegant') {
        // ── ELEGANT: centered name, wide tracking, italic quoted summary, em-dash bullets ──
        children = [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 30 }, children: [new TextRun({ text: resume.name.toUpperCase(), size: 52, color: p, font: 'Georgia' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: `—  ${resume.title.toUpperCase()}  —`, size: 20, color: a, font: 'Georgia' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: contact.join('    '), size: 16, color: '888888', font: 'Georgia' })] }),
          ...(resume.summary ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 250 }, children: [new TextRun({ text: `\u201C${resume.summary}\u201D`, italics: true, size: 20, color: '666666', font: 'Georgia' })] })] : []),
          ...(resume.experience?.length ? [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: '—  EXPERIENCE  —', size: 20, color: p, font: 'Georgia', allCaps: true })] }),
            ...resume.experience.flatMap(exp => expBlock(exp, { font: 'Georgia', bullet: '—' })),
          ] : []),
          ...(resume.education?.length ? [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: '—  EDUCATION  —', size: 20, color: p, font: 'Georgia', allCaps: true })] }),
            ...resume.education.map(edu => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 50 }, children: [new TextRun({ text: `${edu.degree}  —  ${edu.institution}  —  ${edu.year}`, size: 20, color: '555555', font: 'Georgia' })] })),
          ] : []),
          ...(resume.skills?.length ? [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: '—  EXPERTISE  —', size: 20, color: p, font: 'Georgia', allCaps: true })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: resume.skills.flatMap(s => s.items).join('    '), size: 18, color: '666666', font: 'Georgia' })] }),
          ] : []),
        ];
      } else if (tmpl === 'compact') {
        // ── COMPACT: dense small fonts, skills before experience, tight spacing ──
        children = [
          new Paragraph({ spacing: { after: 20 }, tabStops: [{ type: 'right' as any, position: 9000 }], children: [new TextRun({ text: resume.name, bold: true, size: 40, color: p }), new TextRun({ text: `\t${resume.email || ''}`, size: 16, color: '666666' })] }),
          new Paragraph({ spacing: { after: 100 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: p } }, tabStops: [{ type: 'right' as any, position: 9000 }], children: [new TextRun({ text: resume.title, size: 20, color: '666666' }), new TextRun({ text: `\t${[resume.phone, resume.location].filter(Boolean).join(' | ')}`, size: 16, color: '666666' })] }),
          ...(resume.summary ? [new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: resume.summary, size: 18, color: '555555' })] })] : []),
          ...(resume.skills?.length ? [
            new Paragraph({ spacing: { before: 100, after: 50 }, children: [new TextRun({ text: 'CORE COMPETENCIES', bold: true, size: 18, color: p, allCaps: true })] }),
            new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: resume.skills.flatMap(s => s.items).join('  |  '), size: 17, color: p })] }),
          ] : []),
          ...(resume.experience?.length ? [
            new Paragraph({ spacing: { before: 100, after: 50 }, children: [new TextRun({ text: 'PROFESSIONAL EXPERIENCE', bold: true, size: 18, color: p, allCaps: true })] }),
            ...resume.experience.flatMap(exp => [
              new Paragraph({ spacing: { before: 60, after: 15 }, tabStops: [{ type: 'right' as any, position: 9000 }], children: [new TextRun({ text: `${exp.role}`, bold: true, size: 20, color: t }), new TextRun({ text: ` @ ${exp.company}`, size: 18, color: '666666' }), new TextRun({ text: `\t${exp.duration}`, size: 16, color: '999999' })] }),
              ...exp.achievements.map((ach: string) => new Paragraph({ spacing: { after: 15 }, indent: { left: 240 }, children: [new TextRun({ text: `•  ${ach}`, size: 17, color: '444444' })] })),
            ]),
          ] : []),
          ...(resume.education?.length ? [
            new Paragraph({ spacing: { before: 100, after: 50 }, children: [new TextRun({ text: 'EDUCATION', bold: true, size: 18, color: p, allCaps: true })] }),
            ...resume.education.map(edu => new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: `${edu.degree}`, bold: true, size: 18, color: t }), new TextRun({ text: `  •  ${edu.institution}  •  ${edu.year}`, size: 17, color: '666666' })] })),
          ] : []),
        ];
      } else if (tmpl === 'nordic') {
        // ── NORDIC: duration/company left column via tabs, airy spacing ──
        children = [
          new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: resume.name, size: 48, color: t, font: 'Calibri' })] }),
          new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: resume.title, size: 24, color: a })] }),
          new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: contact.join('    '), size: 18, color: a })] }),
          new Paragraph({ spacing: { after: 250 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: `${a}50` } }, text: '' }),
          ...(resume.summary ? [new Paragraph({ spacing: { after: 250 }, children: [new TextRun({ text: resume.summary, size: 20, color: `${t}cc` })] })] : []),
          ...(resume.experience?.length ? [
            new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text: 'EXPERIENCE', size: 18, color: a, allCaps: true })] }),
            ...resume.experience.flatMap(exp => [
              new Paragraph({ spacing: { before: 80 }, tabStops: [{ type: 'left' as any, position: 2800 }], children: [new TextRun({ text: exp.duration, size: 18, color: a }), new TextRun({ text: `\t${exp.role}`, bold: true, size: 22, color: t })] }),
              new Paragraph({ spacing: { after: 50 }, tabStops: [{ type: 'left' as any, position: 2800 }], children: [new TextRun({ text: exp.company, size: 16, color: a }), new TextRun({ text: '\t' })] }),
              ...exp.achievements.map((ach: string) => new Paragraph({ spacing: { after: 30 }, indent: { left: 2800 }, children: [new TextRun({ text: ach, size: 19, color: '555555' })] })),
              new Paragraph({ spacing: { after: 80 }, text: '' }),
            ]),
          ] : []),
          ...(resume.education?.length ? [
            new Paragraph({ spacing: { before: 200, after: 80 }, tabStops: [{ type: 'left' as any, position: 2800 }], children: [new TextRun({ text: 'EDUCATION', size: 18, color: a, allCaps: true })] }),
            ...resume.education.map(edu => new Paragraph({ spacing: { after: 50 }, tabStops: [{ type: 'left' as any, position: 2800 }], children: [new TextRun({ text: edu.year, size: 18, color: a }), new TextRun({ text: `\t${edu.degree}  —  ${edu.institution}`, size: 20, color: t })] })),
          ] : []),
          ...(resume.skills?.length ? [
            new Paragraph({ spacing: { before: 200, after: 80 }, tabStops: [{ type: 'left' as any, position: 2800 }], children: [new TextRun({ text: 'SKILLS', size: 18, color: a, allCaps: true })] }),
            new Paragraph({ spacing: { after: 80 }, tabStops: [{ type: 'left' as any, position: 2800 }], children: [new TextRun({ text: '\t' }), new TextRun({ text: resume.skills.flatMap(s => s.items).join('    '), size: 18, color: '555555' })] }),
          ] : []),
        ];
      } else if (tmpl === 'technical') {
        // ── TECHNICAL: Courier monospace, // prefixed headings, → bullets, skills first ──
        const f = 'Courier New';
        children = [
          new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: resume.name, bold: true, size: 40, color: p, font: f })] }),
          new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: resume.title, size: 24, color: a, font: f })] }),
          new Paragraph({ spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: p } }, children: [new TextRun({ text: contact.join('  |  '), size: 16, color: '666666', font: f })] }),
          ...(resume.summary ? [
            new Paragraph({ spacing: { before: 200, after: 60 }, children: [new TextRun({ text: '// SUMMARY', bold: true, size: 22, color: p, font: f, allCaps: true })] }),
            new Paragraph({ spacing: { after: 160 }, border: { left: { style: BorderStyle.SINGLE, size: 8, color: a } }, indent: { left: 200 }, children: [new TextRun({ text: resume.summary, size: 19, color: '555555', font: f })] }),
          ] : []),
          ...(resume.skills?.length ? [
            new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: '// TECHNICAL SKILLS', bold: true, size: 22, color: p, font: f, allCaps: true })] }),
            ...resume.skills.map(cat => new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `${cat.category}: `, bold: true, size: 19, color: t, font: f }), new TextRun({ text: cat.items.join(', '), size: 19, color: '555555', font: f })] })),
          ] : []),
          ...(resume.experience?.length ? [
            new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: '// EXPERIENCE', bold: true, size: 22, color: p, font: f, allCaps: true })] }),
            ...resume.experience.flatMap(exp => expBlock(exp, { font: f, bullet: '→' })),
          ] : []),
          ...(resume.education?.length ? [
            new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: '// EDUCATION', bold: true, size: 22, color: p, font: f, allCaps: true })] }),
            ...resume.education.map(edu => eduBlock(edu, { font: f })),
          ] : []),
        ];
      } else if (tmpl === 'modern' || tmpl === 'cascade' || tmpl === 'double-column') {
        // ── MODERN / CASCADE / DOUBLE-COLUMN: sidebar table layout ──
        const sidebarContent: any[] = [
          new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: resume.name, bold: true, size: 36, color: 'FFFFFF' })] }),
          new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: resume.title, size: 20, color: 'DDDDDD' })] }),
          // Contact
          new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'CONTACT', bold: true, size: 16, color: 'AAAAAA', allCaps: true })] }),
          ...contact.map(c => new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: c, size: 18, color: 'CCCCCC' })] })),
        ];
        // Sidebar skills
        if (resume.skills?.length) {
          sidebarContent.push(new Paragraph({ spacing: { before: 200, after: 60 }, children: [new TextRun({ text: 'SKILLS', bold: true, size: 16, color: 'AAAAAA', allCaps: true })] }));
          resume.skills.forEach(cat => {
            sidebarContent.push(new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: cat.category, bold: true, size: 18, color: 'FFFFFF' })] }));
            sidebarContent.push(new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: cat.items.join(', '), size: 17, color: 'BBBBBB' })] }));
          });
        }
        // Sidebar education
        if (resume.education?.length) {
          sidebarContent.push(new Paragraph({ spacing: { before: 200, after: 60 }, children: [new TextRun({ text: 'EDUCATION', bold: true, size: 16, color: 'AAAAAA', allCaps: true })] }));
          resume.education.forEach(edu => {
            sidebarContent.push(new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: edu.degree, bold: true, size: 18, color: 'FFFFFF' })] }));
            sidebarContent.push(new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: edu.institution, size: 17, color: 'CCCCCC' })] }));
            sidebarContent.push(new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: edu.year, size: 16, color: 'AAAAAA' })] }));
          });
        }

        const mainContent: any[] = [];
        if (resume.summary) {
          mainContent.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: tmpl === 'cascade' ? 'PROFILE' : 'ABOUT ME', bold: true, size: 22, color: p, allCaps: true })] }));
          mainContent.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: resume.summary, size: 20, color: '555555' })] }));
        }
        if (resume.experience?.length) {
          mainContent.push(new Paragraph({ spacing: { before: 100, after: 80 }, children: [new TextRun({ text: tmpl === 'cascade' ? 'WORK EXPERIENCE' : 'EXPERIENCE', bold: true, size: 22, color: p, allCaps: true })] }));
          resume.experience.forEach(exp => mainContent.push(...expBlock(exp)));
        }

        const sidebarCell = new TableCell({
          width: { size: 3200, type: WidthType.DXA },
          shading: { type: ShadingType.SOLID, color: tc.primary },
          borders: noBorders,
          children: sidebarContent,
        });
        const mainCell = new TableCell({
          width: { size: 6800, type: WidthType.DXA },
          borders: noBorders,
          children: mainContent.length > 0 ? mainContent : [new Paragraph('')],
        });

        children = [new Table({
          rows: [new TableRow({ children: [sidebarCell, mainCell] })],
          width: { size: 10000, type: WidthType.DXA },
          borders: noBorders as any,
        })];
      } else {
        // ── EXECUTIVE (default) — classic professional layout ──
        children = [
          new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: resume.name, bold: true, size: 56, color: p, font: 'Calibri' })] }),
          new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: resume.title, size: 28, color: a, font: 'Calibri' })] }),
          new Paragraph({ spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: p } }, children: [new TextRun({ text: contact.join('  •  '), size: 18, color: '555555' })] }),
          ...(resume.summary ? [sectionHead('PROFESSIONAL SUMMARY'), new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: resume.summary, size: 21, color: '444444' })] })] : []),
          ...(resume.experience?.length ? [sectionHead('EXPERIENCE'), ...resume.experience.flatMap(exp => expBlock(exp))] : []),
          ...(resume.education?.length ? [sectionHead('EDUCATION'), ...resume.education.map(edu => eduBlock(edu))] : []),
          ...(resume.skills?.length ? [sectionHead('SKILLS'), ...resume.skills.map(cat => skillBlock(cat))] : []),
          ...certBlocks(),
        ];
      }

      const doc = new DocxDocument({
        styles: { default: { document: { run: { font: 'Calibri', size: 22, color: '333333' } } } },
        sections: [{ properties: { page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } } }, children }],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${resume.name?.replace(/\s+/g, '_') || 'resume'}.docx`);
      showToast('Word document downloaded!', 'check_circle');
      analytics.resumeDownload('word');
      clearDraft();
    } catch (e) { console.error('Word download error:', e); showToast('Download failed', 'cancel'); }
    finally { setIsLoading(false); }
  };

  // ===== DUAL-AI TOOLS STATE =====
  const [coverLetterResult, setCoverLetterResult] = useState<{ coverLetter: string; score: number; refined: boolean; modelAgreement: string } | null>(null);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetterTone, setCoverLetterTone] = useState<'professional' | 'friendly' | 'bold'>('professional');
  const [coverLetterCompany, setCoverLetterCompany] = useState('');
  const [showCoverLetterPanel, setShowCoverLetterPanel] = useState(false);

  const [resumeCheckResult, setResumeCheckResult] = useState<any>(null);
  const [resumeCheckLoading, setResumeCheckLoading] = useState(false);
  const [showResumeCheckPanel, setShowResumeCheckPanel] = useState(false);

  const [linkedinResult, setLinkedinResult] = useState<any>(null);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [showLinkedinPanel, setShowLinkedinPanel] = useState(false);

  // ===== DUAL-AI HANDLERS =====
  const generateCoverLetter = async () => {
    const displayResume = getDisplayResume();
    if (!displayResume) return showToast('No resume data available', 'cancel');
    setCoverLetterLoading(true);
    setCoverLetterResult(null);
    setShowCoverLetterPanel(true);
    try {
      const resumeText = [
        displayResume.name, displayResume.title, displayResume.email, displayResume.phone,
        displayResume.summary,
        ...(displayResume.experience || []).map((e: any) => `${e.title} at ${e.company}: ${(e.achievements || []).join('. ')}`),
        ...(displayResume.skills || []),
      ].filter(Boolean).join('\n');

      const res = await authFetch('/api/resume/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText,
          jobDescription: jobDescription || 'General professional position',
          companyName: coverLetterCompany,
          tone: coverLetterTone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCoverLetterResult(data);
      showToast(`Cover letter generated! Score: ${data.score}/100 ${data.refined ? '(Dual-AI refined <span className="material-symbols-rounded align-middle mr-1">auto_awesome</span>)' : ''}`, 'check_circle');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate cover letter', 'cancel');
    } finally { setCoverLetterLoading(false); }
  };

  // Skills serialization and normalization are handled by lib/resume-normalizer.ts
  // Use normalizeResume() for data, serializeResumeToText() for AI prompts

  const checkResume = async () => {
    const displayResume = getDisplayResume();
    if (!displayResume) return showToast('No resume data available', 'cancel');
    setResumeCheckLoading(true);
    setResumeCheckResult(null);
    setShowResumeCheckPanel(true);
    try {
      const resumeText = serializeResumeToText(normalizeResume(displayResume));

      const res = await authFetch('/api/resume/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, targetJD: jobDescription || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResumeCheckResult(data);
      showToast(`Resume graded: ${data.overallGrade} (ATS: ${data.atsScore}/100)`, 'check_circle');
    } catch (err: any) {
      showToast(err.message || 'Failed to check resume', 'cancel');
    } finally { setResumeCheckLoading(false); }
  };

  const generateLinkedIn = async () => {
    const displayResume = getDisplayResume();
    if (!displayResume) return showToast('No resume data available', 'cancel');
    setLinkedinLoading(true);
    setLinkedinResult(null);
    setShowLinkedinPanel(true);
    try {
      const resumeText = serializeResumeToText(normalizeResume(displayResume));

      const res = await authFetch('/api/resume/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, targetRole: displayResume.title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLinkedinResult(data);
      showToast(`LinkedIn profile generated! Score: ${data.score}/100 ${data.refined ? '(Dual-AI refined <span className="material-symbols-rounded align-middle mr-1">auto_awesome</span>)' : ''}`, 'check_circle');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate LinkedIn profile', 'cancel');
    } finally { setLinkedinLoading(false); setEnhancePhase('idle'); setEnhancePipelineStage(0); }
  };

  const autoFixResume = async () => {
    if (!resumeCheckResult?.suggestions?.length) return showToast('Run Resume Check first', 'cancel');
    const currentResume = getDisplayResume();
    if (!currentResume) return;
    setAutoFixing(true);
    setEnhancePhase('fixing');
    setEnhancePipelineStage(1);
    setPreFixScore(resumeCheckResult.atsScore);
    try {
      const resumeText = serializeResumeToText(normalizeResume(currentResume));

      setEnhancePipelineStage(2);
      const res = await authFetch('/api/resume/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText,
          suggestions: [...(resumeCheckResult.suggestions || []), ...(resumeCheckResult.issues || [])],
          targetJD: jobDescription || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.upgrade || res.status === 403) setShowUpgradeModal(true);
        throw new Error(data.error || 'Failed to auto-fix resume');
      }

      setEnhancePipelineStage(3);
      // Apply improved resume data
      if (data.improvedResume) {
        // Use centralized normalizer — handles skills format, field names, etc.
        const improved = normalizeResume({
          ...currentResume,
          ...data.improvedResume,
        }, currentResume) as any;
        if (mode === 'morph') setMorphedResume(improved);
        else setBuildResume(improved);
        showToast(`Resume auto-fixed! Score: ${data.score}/100 ${data.refined ? '(Dual-AI refined <span className="material-symbols-rounded align-middle mr-1">auto_awesome</span>)' : ''}`, 'check_circle');

        // Save skill gap analysis for Skill Bridge
        try {
          const originalSkills = (currentResume.skills || []).flatMap((s: any) => s.items || []).map((s: string) => s.toLowerCase().trim());
          const improvedSkills = (improved.skills || []).flatMap((s: any) => s.items || []).map((s: string) => s.toLowerCase().trim());
          const aiAddedSkills = improvedSkills.filter((s: string) => !originalSkills.includes(s));
          const existingSkills = improvedSkills.filter((s: string) => originalSkills.includes(s));
          const gaps = [
            ...aiAddedSkills.map((s: string) => ({ skill: s.charAt(0).toUpperCase() + s.slice(1), confidence: 'ai-added', category: 'technical' })),
            ...existingSkills.slice(0, 2).map((s: string) => ({ skill: s.charAt(0).toUpperCase() + s.slice(1), confidence: 'weak', category: 'technical' })),
          ];
          if (gaps.length > 0) {
            localStorage.setItem('tc_skill_gaps', JSON.stringify({ gaps, timestamp: Date.now() }));
          }
        } catch {}

        // Re-run check for before/after comparison
        setTimeout(() => checkResume(), 500);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to auto-fix resume', 'cancel');
    } finally { setAutoFixing(false); setEnhancePhase('idle'); setEnhancePipelineStage(0); }
  };

  const generateSummary = async () => {
    if (!buildResume.title) return showToast('Add a job title first', 'cancel');
    setAiSuggesting(true);
    try {
      const res = await authFetch('/api/resume/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_summary', text: `Role: ${buildResume.title}\nExperience: ${buildResume.experience.map(e => e.role).join(', ') || 'Entry level'}` }),
      });
      if (!res.ok) {
        const errData = await res.json();
        if (errData.upgrade || res.status === 403) setShowUpgradeModal(true);
        throw new Error(errData.error || 'Failed');
      }
      const data = await res.json();
      setBuildResume(prev => ({ ...prev, summary: data.summary }));
      showToast('Summary generated!', 'check_circle');
    } catch { showToast('Failed to generate', 'cancel'); }
    finally { setAiSuggesting(false); }
  };

  const generateAchievements = async (expIndex: number) => {
    const exp = buildResume.experience[expIndex];
    if (!exp?.role) return;
    setAiSuggesting(true);
    try {
      const res = await authFetch('/api/resume/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_achievements', text: `Role: ${exp.role}\nCompany: ${exp.company}` }),
      });
      if (!res.ok) {
        const errData = await res.json();
        if (errData.upgrade || res.status === 403) setShowUpgradeModal(true);
        throw new Error(errData.error || 'Failed');
      }
      const data = await res.json();
      const newExp = [...buildResume.experience];
      newExp[expIndex] = { ...exp, achievements: data.achievements };
      setBuildResume(prev => ({ ...prev, experience: newExp }));
      showToast('Achievements generated!', 'check_circle');
    } catch { showToast('Failed to generate', 'cancel'); }
    finally { setAiSuggesting(false); }
  };

  const suggestSkills = async () => {
    if (!buildResume.title) return showToast('Add a job title first', 'cancel');
    setAiSuggesting(true);
    try {
      const res = await authFetch('/api/resume/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest_skills', text: `Role: ${buildResume.title}` }),
      });
      if (!res.ok) {
        const errData = await res.json();
        if (errData.upgrade || res.status === 403) setShowUpgradeModal(true);
        throw new Error(errData.error || 'Failed');
      }
      const data = await res.json();
      setBuildResume(prev => ({ ...prev, skills: data.skills || [] }));
      showToast('Skills suggested!', 'check_circle');
    } catch { showToast('Failed to suggest', 'cancel'); }
    finally { setAiSuggesting(false); }
  };

  const resetAll = () => {
    setMode('choose');
    setStep('upload');
    setOriginalResume(null);
    setMorphedResume(null);
    setBuildResume({ ...EMPTY_RESUME });
    setJobDescription('');
    setMatchScore(null);
    setMorphPercentage(75);
    setBuildStep(0);
    clearDraft();
  };


  // ===== RENDER: Mode Selection =====
  if (mode === 'choose') {
    return (
      <div className="min-h-screen pt-10 md:pt-16 p-4 md:p-8 flex flex-col items-center">
        <div className="w-full max-w-xl">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10 pl-10 lg:pl-0 relative">
            <div className="absolute top-0 right-0">
              <PageHelp toolId="resume" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide mb-4"
              style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(251,146,60,0.08) 100%)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
              <span className="material-symbols-rounded text-[14px]">auto_awesome</span>
              AI-Powered Engine
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] tracking-tight">
              Resume Morph Studio
            </h1>
            <p className="text-[14px] text-[var(--text-secondary)] mt-2 max-w-md mx-auto leading-relaxed">
              Upload your resume — our dual-AI rewrites every bullet point to match any job description. One resume, infinite morphs.
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              {[
                { icon: 'psychology', label: 'Dual-AI Rewrite' },
                { icon: 'target', label: 'ATS Optimized' },
                { icon: 'download', label: '1-Click Export' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                  <span className="material-symbols-rounded text-[14px]" style={{ color: '#f59e0b' }}>{f.icon}</span>
                  {f.label}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Primary: Dropzone */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden"
          >
            <FileUploadDropzone
              onUploadSuccess={(text) => {
                setMode('morph');
                handleFileExtracted(text);
              }}
              isUploading={isLoading}
              setIsUploading={setIsLoading}
              processingStage={processingStage}
              variant="large"
            />
          </motion.div>

          {/* Secondary: Build from scratch — Premium Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-5"
          >
            <button
              onClick={() => setMode('create')}
              className="group shimmer-border w-full flex items-center gap-4 px-6 py-5 rounded-2xl bg-[var(--bg-card)] transition-all duration-200 hover:scale-[1.01]"
              style={{
                '--shimmer-color-1': 'rgba(168,85,247,0.45)',
                '--shimmer-color-2': 'rgba(236,72,153,0.3)',
                '--shimmer-color-3': 'rgba(99,102,241,0.35)',
              } as React.CSSProperties}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-150 group-hover:scale-110"
                style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(236,72,153,0.1) 100%)', border: '1px solid rgba(168,85,247,0.25)' }}
              >
                <span className="material-symbols-rounded text-[22px]" style={{ color: '#a855f7' }}>draw</span>
              </div>
              <div className="text-left flex-1">
                <p className="text-[14px] font-semibold text-[var(--text-primary)] leading-tight">
                  Start from Scratch
                </p>
                <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                  Build a professional resume step-by-step with AI suggestions
                </p>
              </div>
              <div className="flex items-center gap-1 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
                <span className="material-symbols-rounded text-[20px]">arrow_forward</span>
              </div>
            </button>
          </motion.div>

          {/* Resume Vault - Subdued */}
          {versions.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-12">
              <h3 className="text-[12px] font-medium text-[var(--text-muted)] mb-3 px-1 uppercase tracking-wider">Recent Resumes</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {versions.slice(0, 4).map((v) => (
                  <div
                    key={v.id}
                    onClick={() => loadVersionToMorph(v)}
                    className="p-3 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)] transition-all cursor-pointer relative group flex items-start gap-3"
                  >
                    <button
                      onClick={(e) => handleDeleteVersion(e, v.id)}
                      className="absolute top-1 right-1 p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-rounded text-[14px]">close</span>
                    </button>
                    <div 
                      className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: 'var(--tag-blue-bg)',
                        color: 'var(--tag-blue-text)'
                      }}
                    >
                      <span className="material-symbols-rounded text-[16px]">description</span>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <h4 className="font-medium text-[12px] text-[var(--text-primary)] truncate">{v.version_name}</h4>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{new Date(v.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Delete Confirmation Modal */}
          <AnimatePresence>
            {deleteConfirmId && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmId(null)} className="fixed inset-0 bg-[var(--bg-elevated)]/50 backdrop-blur-sm z-50 transition-all" />
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-sm rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl">
                    <h3 className="text-[14px] font-medium text-[var(--text-primary)] mb-2">Delete Resume?</h3>
                    <p className="text-[12px] text-[var(--text-secondary)] mb-6">This action cannot be undone.</p>
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 rounded-[6px] text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">Cancel</button>
                      <button onClick={confirmDelete} className="px-4 py-2 rounded-[6px] text-[12px] font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all">Delete</button>
                    </div>
                  </motion.div>
                </div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }
  // ===== RENDER: Morph Flow =====
  if (mode === 'morph') {
    const displayResume = getDisplayResume();

    return (
      <div className="min-h-screen p-4 md:p-8 relative">
        <div className="max-w-6xl mx-auto z-10 relative">
          {/* Header with Reset */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8 gap-3 pl-12 lg:pl-0">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Morph Your Resume</h1>
              <p className="text-slate-500 text-sm">AI-powered resume optimization</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={resetAll} className="px-3 md:px-4 py-2 rounded-xl bg-[var(--theme-bg-elevated)] border border-[var(--theme-border)] text-[var(--theme-text-secondary)] hover:border-[var(--theme-border-hover)] hover:text-[var(--theme-text)] transition-all text-sm">
                ← Start Over
              </button>
              <PageHelp toolId="resume" />
            </div>
          </div>

          {/* Progress Steps */}
          <div className="max-w-5xl mx-auto mb-8">
            <div className="flex items-center justify-between">
              {[
                { id: 'upload', label: 'Upload', icon: 'description' },
                { id: 'jd', label: 'Job Description', icon: 'work' },
                { id: 'enhance', label: 'AI Enhance', icon: 'auto_awesome', pro: true },
                { id: 'template', label: 'Template', icon: 'palette' },
                { id: 'preview', label: 'Download', icon: 'arrow_downward' },
              ].map((s, i) => {
                const isEnhanceLocked = s.id === 'enhance' && tier !== 'pro';
                const canNavigate = s.id === 'upload'
                  || (s.id === 'jd' && hasResumeData(originalResume))
                  || (s.id === 'enhance' && isPro && displayResume)
                  || ((s.id === 'template' || s.id === 'preview') && displayResume);
                return (
                <div key={s.id} className="flex items-center">
                  <button
                    onClick={() => {
                      if (isEnhanceLocked) { showToast('AI Enhancement is a Pro feature — $2.99/mo', 'info'); return; }
                      if (canNavigate) setStep(s.id as any);
                    }}
                    className={`flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2.5 rounded-xl transition-all text-xs md:text-sm whitespace-nowrap shadow-sm ${
                      step === s.id ? (s.pro ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20') :
                      isEnhanceLocked ? 'bg-[var(--bg-surface)] opacity-60 border border-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed' :
                      canNavigate ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--text-secondary)] border border-[var(--border-subtle)]' :
                      'bg-[var(--bg-surface)] opacity-60 border border-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed'
                    }`}
                  >
                    <span className="material-symbols-rounded text-[18px] md:text-[20px]">{isEnhanceLocked ? 'lock' : s.icon}</span>
                    <span className="hidden md:inline font-medium whitespace-nowrap">{s.label}</span>
                    {s.pro && <span className={`hidden md:inline text-[8px] px-1.5 py-0.5 rounded-md ${isPro ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : 'bg-[var(--border-subtle)] border border-[var(--text-muted)] text-[var(--text-secondary)]'} font-black tracking-widest`}>PRO</span>}
                  </button>
                  {i < 4 && <div className={`w-4 md:w-10 h-px mx-1 hidden sm:block ${s.id === 'enhance' || (s.id === 'jd' && isPro) ? 'bg-emerald-500/30' : 'bg-[var(--border-subtle)]'}`} />}
                </div>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {/* Step 1: Upload */}
            {step === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                  <AnimatePresence mode="wait">
                    {invalidDocumentError ? (
                      <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl mx-auto p-8 rounded-2xl bg-red-500/[0.05] border border-red-500/20 text-center space-y-5 backdrop-blur-md">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-3xl mx-auto border border-red-500/20"><span className="material-symbols-rounded align-middle mr-1">description</span><span className="material-symbols-rounded align-middle mr-1">cancel</span></div>
                        <div>
                          <h3 className="text-xl font-bold text-white mb-2">This doesn't look like a resume</h3>
                          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                            Our AI parser couldn't detect standard structural elements like Work Experience, Education, or Skills in the uploaded file.
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-4">
                          <button onClick={() => setInvalidDocumentError(false)} className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/5 transition-all font-medium text-slate-300 border border-white/10">
                            Try Another File
                          </button>
                          <button onClick={() => { setInvalidDocumentError(false); setMode('create'); }} className="w-full sm:w-auto px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 transition-all font-bold text-white shadow-[0_4px_15px_rgba(6,182,212,0.3)]">
                            Build from the ground up <span className="material-symbols-rounded align-middle mr-1">auto_awesome</span>
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="dropzone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <FileUploadDropzone 
                          onUploadSuccess={(text) => handleFileExtracted(text)}
                          isUploading={isLoading}
                          setIsUploading={(state) => {
                            setIsLoading(state);
                            if (state) setProcessingStage('uploading');
                          }}
                          processingStage={processingStage}
                          variant="large"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
              </motion.div>
            )}

            {/* Step 2: JD */}
            {step === 'jd' && (
              <motion.div key="jd" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                  {/* Original Resume Preview */}
                  <div className="elevation-1 p-4 md:p-6">
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/[0.08] border border-cyan-500/[0.15] flex items-center justify-center text-xl"><span className="material-symbols-rounded text-inherit align-middle">description</span></div>
                        <div>
                          <h3 className="text-base font-semibold text-white">Your Resume</h3>
                          <p className="text-xs text-slate-500">Ready for optimization</p>
                        </div>
                      </div>
                      {originalResume && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                            <p className="text-xs text-slate-500 mb-1">Name</p>
                            <p className="text-white font-semibold">{originalResume.name}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                            <p className="text-xs text-slate-500 mb-1">Target Role</p>
                            <p className="text-white font-semibold">{originalResume.title}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                              <p className="text-2xl font-bold text-cyan-400">{originalResume.experience?.length || 0}</p>
                              <p className="text-xs text-slate-500">Positions</p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                              <p className="text-2xl font-bold text-cyan-400">{originalResume.skills?.flatMap((s: { items: string[] }) => s.items).length || 0}</p>
                              <p className="text-xs text-slate-500">Skills</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* JD Input */}
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl border ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl"><span className="material-symbols-rounded text-inherit align-middle">work</span></span>
                        <label className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Job Description</label>
                      </div>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the full job description here..."
                        className={`w-full h-44 px-4 py-3 rounded-xl border focus:outline-none resize-none ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-300' : 'bg-white/[0.02] border-white/[0.06] text-white placeholder-slate-500 focus:border-indigo-500/50'}`}
                      />
                    </div>

                    {/* Morph Intensity */}
                    <div className={`p-4 rounded-xl border ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                      <div className="flex justify-between items-center mb-3">
                        <label className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Morph Intensity</label>
                        <span className={`text-lg font-bold px-3 py-1 rounded-lg ${
                          morphPercentage < 50 
                            ? (isLight ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20')
                            : morphPercentage < 75 
                              ? (isLight ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-white/5 text-white/70 border border-white/10')
                              : (isLight ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-red-500/10 text-red-400 border border-red-500/20')
                          }`}>{morphPercentage}%</span>
                      </div>
                      <div className="relative">
                        <div className={`absolute inset-0 h-3 rounded-full opacity-20 ${isLight ? 'bg-gradient-to-r from-emerald-400 via-slate-300 to-red-400' : 'bg-gradient-to-r from-emerald-500 via-slate-500 to-red-500'}`} />
                        <input
                          type="range"
                          min="25"
                          max="100"
                          value={morphPercentage}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setMorphPercentage(val);
                            if (val < 80) setAcceptedRisk(false);
                          }}
                          className="relative w-full h-3 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #10b981 ${0}%, #10b981 ${((morphPercentage - 25) / 75) * 33}%, #64748b ${((morphPercentage - 25) / 75) * 66}%, #ef4444 ${((morphPercentage - 25) / 75) * 100}%)`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs mt-2">
                        <span className={`font-medium ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}><span className="material-symbols-rounded text-inherit align-middle">psychiatry</span> Light Touch</span>
                        <span className={`font-medium ${isLight ? 'text-slate-500' : 'text-white/50'}`}><span className="material-symbols-rounded text-inherit align-middle">bolt</span> Moderate</span>
                        <span className={`font-medium ${isLight ? 'text-red-600' : 'text-red-400'}`}><span className="material-symbols-rounded text-inherit align-middle">local_fire_department</span> Aggressive</span>
                      </div>

                      {/* AI Detection Warning at 80%+ */}
                      <AnimatePresence>
                        {morphPercentage >= 80 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, y: -5 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -5 }}
                            transition={{ duration: 0.2 }}
                            className="mt-3"
                          >
                            <style>{`
                              @keyframes flash-warning-box {
                                0%, 100% { box-shadow: 0 0 0px rgba(220, 38, 38, 0); }
                                50% { box-shadow: 0 0 40px rgba(239, 68, 68, 0.8); background-color: rgba(220, 38, 38, 0.4); }
                              }
                              @keyframes persistent-red-glow {
                                0%, 100% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.3), 0 0 20px rgba(239, 68, 68, 0.15); }
                                50% { box-shadow: 0 0 16px rgba(239, 68, 68, 0.5), 0 0 35px rgba(239, 68, 68, 0.25); }
                              }
                              .flashing-warning {
                                animation: flash-warning-box 1s ease-in-out 3;
                              }
                              .persistent-glow {
                                animation: persistent-red-glow 2s ease-in-out infinite;
                              }
                            `}</style>
                            <div 
                              className={`p-3 rounded-xl border transition-colors duration-300 ${flashWarning ? 'flashing-warning' : ''} ${!acceptedRisk ? 'persistent-glow' : ''}`}
                              style={
                                isLight ? { 
                                  backgroundColor: `rgba(254, 226, 226, ${0.4 + ((morphPercentage - 80) / 20) * 0.6})`,
                                  borderColor: `rgba(220, 38, 38, ${0.5 + ((morphPercentage - 80) / 20) * 0.5})`,
                                  boxShadow: !acceptedRisk ? undefined : (morphPercentage >= 95 ? `0 4px 14px 0 rgba(220,38,38,0.2)` : 'none')
                                } : { 
                                  backgroundColor: `rgba(239, 68, 68, ${0.1 + ((morphPercentage - 80) / 20) * 0.4})`,
                                  borderColor: `rgba(220, 38, 38, ${0.5 + ((morphPercentage - 80) / 20) * 0.5})`,
                                  boxShadow: !acceptedRisk ? undefined : (morphPercentage >= 95 ? `0 0 ${((morphPercentage - 90) / 10) * 15}px rgba(239,68,68,0.5)` : 'none')
                                }
                              }
                            >
                              <div className="flex items-start gap-2.5">
                                <span className="text-lg mt-0.5"><span className="material-symbols-rounded text-inherit align-middle">warning</span></span>
                                <div>
                                  <p className={`text-xs font-bold transition-colors ${
                                    isLight ? (morphPercentage >= 95 ? 'text-red-800' : 'text-red-700') : (morphPercentage >= 95 ? 'text-white' : 'text-red-400')
                                  }`}>AI Detection Risk — High Intensity</p>
                                  <p className={`text-[11px] mt-1 leading-relaxed transition-colors ${
                                    isLight ? 'text-red-900/80' : (morphPercentage >= 95 ? 'text-red-50' : 'text-red-300/80')
                                  }`}>
                                    At {morphPercentage}% morph, your resume may trigger AI-detection systems used by recruiters. 
                                    Many companies now flag heavily AI-rewritten applications. We recommend <strong className="text-amber-400">60–75%</strong> for the best balance of keyword alignment and authentic voice.
                                  </p>
                                  {morphPercentage >= 90 && (
                                    <p className={`text-[10px] mt-1.5 font-bold transition-colors ${
                                      isLight ? 'text-red-800' : (morphPercentage >= 95 ? 'text-white' : 'text-red-400/90')
                                    }`}>
                                      <span className="material-symbols-rounded align-middle mr-1">emergency</span> Above 90% — Your original voice will be almost entirely replaced. Proceed only if you understand the risk.
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className={`mt-4 flex items-center gap-2 p-2.5 rounded-lg border ${
                                isLight ? 'bg-red-200/50 border-red-300 shadow-sm' : 'bg-red-900/40 border-red-500/50 shadow-inner'
                              }`}>
                                <input 
                                  type="checkbox" 
                                  id="acceptRisk" 
                                  checked={acceptedRisk} 
                                  onChange={e => setAcceptedRisk(e.target.checked)} 
                                  className={`w-4 h-4 rounded cursor-pointer ${
                                    isLight ? 'accent-red-600' : 'accent-red-500 bg-red-500/10 border-red-500/50 focus:ring-red-500'
                                  }`} 
                                />
                                <label htmlFor="acceptRisk" className={`text-xs font-bold cursor-pointer leading-snug transition-colors ${
                                  isLight ? 'text-red-900' : 'text-white'
                                }`}>
                                  I accept to proceed
                                </label>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Page Count */}
                    <div>
                      <label className={`block font-semibold mb-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>Target Length</label>
                      <div className="flex gap-2">
                        {(['auto', 1, 2] as const).map((pc) => (
                          <button
                            key={pc}
                            onClick={() => setTargetPageCount(pc)}
                            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${targetPageCount === pc 
                              ? (isLight ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-500 text-white shadow-md') 
                              : (isLight ? 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200' : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10')
                              }`}
                          >
                            {pc === 'auto' ? 'Auto' : `${pc} Page${pc > 1 ? 's' : ''}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleMorph}
                      disabled={isLoading || !jobDescription.trim() || (morphPercentage >= 80 && !acceptedRisk)}
                      className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all text-center ${
                        !jobDescription.trim()
                          ? (isLight 
                              ? 'bg-slate-200 border border-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                              : 'bg-slate-800/50 border border-slate-700 text-slate-500 cursor-not-allowed shadow-none')
                          : morphPercentage >= 80 && !acceptedRisk
                          ? (isLight 
                              ? 'bg-red-600 border-2 border-red-700 text-white shadow-[0_2px_10px_rgba(220,38,38,0.3)] cursor-not-allowed'
                              : 'bg-red-600 border-2 border-red-500 text-white shadow-[0_2px_15px_rgba(239,68,68,0.4)] cursor-not-allowed')
                          : (isLight
                              ? 'bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 shadow-[0_2px_8px_rgba(99,102,241,0.3)] disabled:opacity-50'
                              : 'bg-indigo-600 border border-indigo-500 text-white hover:bg-indigo-500 shadow-[0_2px_12px_rgba(99,102,241,0.3)] disabled:opacity-50')
                      }`}
                    >
                      {isLoading ? <><span className="material-symbols-rounded align-middle mr-1">psychology</span> AI is Rewriting...</> : !jobDescription.trim() ? <><span className="material-symbols-rounded align-middle mr-1">warning</span> Paste Job Description First</> : (morphPercentage >= 80 && !acceptedRisk) ? <><span className="material-symbols-rounded align-middle mr-1">emergency</span> Check &quot;I accept&quot; to Proceed</> : <><span className="material-symbols-rounded align-middle mr-1">psychology</span> Morph Resume to Match JD</>}
                    </button>

                    {/* Day-Zero Blueprint */}
                    <button
                      onClick={handleBlueprint}
                      disabled={isBlueprintLoading || !jobDescription.trim() || isLoading}
                      className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                        !jobDescription.trim()
                          ? (isLight 
                              ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                              : 'bg-slate-800/50 border border-slate-700 text-slate-500 cursor-not-allowed shadow-none')
                          : isLight
                          ? 'bg-slate-50 border border-slate-300 text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-400 disabled:opacity-50'
                          : 'bg-white/[0.04] border border-white/[0.1] text-white/80 hover:bg-white/[0.08] disabled:opacity-50'
                      }`}
                    >
                      {!jobDescription.trim() ? (
                        <><span><span className="material-symbols-rounded text-inherit align-middle">warning</span></span> Paste JD for Blueprint{tier !== 'pro' && <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-slate-400/20 border border-slate-400/30 font-bold opacity-50">PRO</span>}</>
                      ) : isBlueprintLoading ? (
                        <><span className="animate-spin"><span className="material-symbols-rounded text-inherit align-middle">hourglass_top</span></span> Generating Blueprint...</>
                      ) : (
                        <><span><span className="material-symbols-rounded text-inherit align-middle">content_paste</span></span> Generate Day-Zero Blueprint{tier !== 'pro' && <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-white/20 border border-white/30 font-bold">PRO</span>}</>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: AI Enhancement (Pro Only) */}
            {step === 'enhance' && (
              <motion.div key="enhance" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="max-w-5xl mx-auto">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white"><span className="material-symbols-rounded text-inherit align-middle">auto_awesome</span> AI Enhancement</h2>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-bold">DUAL-AI: Advanced Engine</span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">Check, fix, and generate — powered by two AI models</p>
                    </div>
                    <button onClick={() => setStep('template')} className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${isLight ? 'bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100' : 'bg-indigo-500/[0.08] border border-indigo-500/[0.15] text-indigo-400 hover:bg-indigo-500/[0.12]'}`}>
                      Continue to Template →
                    </button>
                  </div>

                  {/* Animated Pipeline Indicator */}
                  {enhancePipelineStage > 0 && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`mb-6 p-4 rounded-xl border overflow-hidden relative ${
                      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.02] border-white/[0.06]'
                    }`}>
                      <div className={`absolute inset-0 ${isLight ? 'bg-gradient-to-r from-slate-50/50 via-indigo-50/30 to-slate-50/50' : 'bg-gradient-to-r from-white/[0.01] via-indigo-500/[0.02] to-white/[0.01]'}`} />
                      <div className="relative flex items-center gap-4">
                        {[
                          { label: 'AI Writing', stage: 1 },
                          { label: 'AI Checking', stage: 2 },
                          { label: 'Refining', stage: 3 },
                        ].map((p) => (
                          <div key={p.stage} className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                              enhancePipelineStage > p.stage ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' :
                              enhancePipelineStage === p.stage ? (isLight ? 'bg-cyan-500 animate-pulse shadow-[0_0_12px_rgba(6,182,212,0.5)]' : 'bg-cyan-400 animate-pulse shadow-[0_0_12px_rgba(6,182,212,0.8)]') :
                              isLight ? 'bg-slate-200' : 'bg-white/10'
                            }`} />
                            <span className={`text-xs font-medium ${
                              enhancePipelineStage > p.stage ? (isLight ? 'text-emerald-600' : 'text-emerald-400') :
                              enhancePipelineStage === p.stage ? (isLight ? 'text-cyan-600' : 'text-cyan-400') :
                              isLight ? 'text-slate-400' : 'text-slate-600'
                            }`}>{p.label}</span>
                            {p.stage < 3 && <div className={`w-8 h-px ${enhancePipelineStage > p.stage ? (isLight ? 'bg-emerald-300' : 'bg-emerald-500/40') : (isLight ? 'bg-slate-200' : 'bg-white/10')}`} />}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left: Resume Check + Auto-Fix */}
                    <div className="space-y-4">
                      {/* Resume Quality Check */}
                      <div className={`rounded-xl p-5 border ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}><span className="material-symbols-rounded text-inherit align-middle">search</span> Resume Quality Check</span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono ${isLight ? 'bg-slate-100 border border-slate-200 text-slate-500' : 'bg-white/5 border border-white/10 text-white/40'}`}>AI Flash</span>
                          </div>
                          <button onClick={() => { setEnhancePhase('checking'); setEnhancePipelineStage(2); checkResume(); }} disabled={resumeCheckLoading} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${isLight ? 'bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100' : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/15'}`}>
                            {resumeCheckLoading ? <><span className="material-symbols-rounded text-[14px] align-middle mr-1">search</span> Analyzing...</> : resumeCheckResult ? <><span className="material-symbols-rounded text-[14px] align-middle mr-1">sync</span> Re-check</> : <><span className="material-symbols-rounded text-[14px] align-middle mr-1">play_arrow</span> Run Check</>}
                          </button>
                        </div>

                        {/* Check Loading Animation */}
                        {resumeCheckLoading && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 py-4">
                            {['Parsing resume structure...', 'Analyzing ATS compatibility...', 'Scoring keywords & formatting...', 'Generating suggestions...'].map((text, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.8 }} className="flex items-center gap-2">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className={`w-3 h-3 border-2 rounded-full ${isLight ? 'border-indigo-200 border-t-indigo-500' : 'border-indigo-500/30 border-t-indigo-400'}`} />
                                <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/40'}`}>{text}</span>
                              </motion.div>
                            ))}
                          </motion.div>
                        )}

                        {/* Check Results */}
                        {resumeCheckResult && !resumeCheckLoading && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                            {/* Score Header */}
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                <div className={`text-4xl font-black ${resumeCheckResult.atsScore >= 80 ? 'text-green-400' : resumeCheckResult.atsScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                                  {resumeCheckResult.overallGrade}
                                </div>
                                {preFixScore && preFixScore < resumeCheckResult.atsScore && (
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1 -right-3 text-[9px] px-1 py-0.5 rounded bg-green-500/20 border border-green-500/30 text-green-400 font-bold">
                                    +{resumeCheckResult.atsScore - preFixScore}
                                  </motion.div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className={isLight ? 'text-slate-500' : 'text-white/50'}>ATS Score</span>
                                  <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{resumeCheckResult.atsScore}/100</span>
                                </div>
                                <div className={`h-2 rounded-full mt-1 overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${resumeCheckResult.atsScore}%` }} transition={{ duration: 1, ease: 'easeOut' }} className={`h-full rounded-full ${resumeCheckResult.atsScore >= 80 ? 'bg-green-500' : resumeCheckResult.atsScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} />
                                </div>
                              </div>
                            </div>

                            {/* Section Scores */}
                            {resumeCheckResult.sectionScores && (
                              <div className="grid grid-cols-5 gap-1.5">
                                {Object.entries(resumeCheckResult.sectionScores).map(([key, val]: [string, any]) => (
                                  <div key={key} className={`text-center p-2 rounded-lg border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                                    <div className={`text-[9px] capitalize ${isLight ? 'text-slate-500' : 'text-white/40'}`}>{key}</div>
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className={`text-sm font-bold ${val >= 80 ? (isLight ? 'text-green-600' : 'text-green-400') : val >= 60 ? (isLight ? 'text-amber-600' : 'text-amber-400') : (isLight ? 'text-red-600' : 'text-red-400')}`}>{val}</motion.div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Suggestions */}
                            {resumeCheckResult.suggestions?.length > 0 && (
                              <div className="space-y-1.5">
                                <div className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-white/50'}`}><span className="material-symbols-rounded text-inherit align-middle">lightbulb</span> Suggestions</div>
                                {resumeCheckResult.suggestions.map((s: string, i: number) => (
                                  <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className={`text-[11px] flex gap-1.5 p-2.5 rounded-lg ${isLight ? 'text-slate-700 bg-slate-50 border border-slate-200' : 'text-white/60 bg-white/[0.02] border border-white/[0.05]'}`}>
                                    <span className={`shrink-0 ${isLight ? 'text-indigo-500' : 'text-indigo-400'}`}>→</span> {s}
                                  </motion.div>
                                ))}
                              </div>
                            )}

                            {/* Auto-Fix Button */}
                            <button
                              onClick={autoFixResume}
                              disabled={autoFixing}
                              className={`w-full py-3 rounded-xl font-bold text-sm border transition-all disabled:opacity-50 relative overflow-hidden ${
                                isLight
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-gradient-to-r from-emerald-500/[0.1] to-cyan-500/[0.1] border-emerald-500/[0.2] text-emerald-400 hover:from-emerald-500/[0.15] hover:to-cyan-500/[0.15]'
                              }`}
                            >
                              {autoFixing ? (
                                <span className="flex items-center justify-center gap-2">
                                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><span className="material-symbols-rounded text-inherit align-middle">sync</span></motion.span>
                                  Auto-Fixing with Dual-AI...
                                </span>
                              ) : (
                                <><span className="material-symbols-rounded text-inherit align-middle">build</span> Auto-Fix Resume (Apply All Suggestions)</>
                              )}
                              {autoFixing && <motion.div className={`absolute bottom-0 left-0 h-0.5 ${isLight ? 'bg-emerald-500' : 'bg-emerald-400'}`} initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 15, ease: 'linear' }} />}
                            </button>

                            {/* Skill Bridge CTA */}
                            {resumeCheckResult && !autoFixing && (
                              <button
                                onClick={() => router.push(`/suite/skill-bridge`)}
                                className={`w-full py-2.5 rounded-xl text-[11px] font-semibold border transition-all flex items-center justify-center gap-2 ${
                                  isLight
                                    ? 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100'
                                    : 'bg-gradient-to-r from-cyan-500/[0.06] to-emerald-500/[0.06] border-cyan-500/[0.12] text-cyan-400 hover:from-cyan-500/[0.1] hover:to-emerald-500/[0.1]'
                                }`}
                              >
                                <span className="material-symbols-rounded text-[16px]">bridge</span> Bridge Your Gaps — Learn the Skills AI Enhanced
                              </button>
                            )}
                          </motion.div>
                        )}
                      </div>

                      {/* ── Next Steps: Cover Letter & LinkedIn ── */}
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                        <div className="text-xs font-semibold text-[var(--text-muted)] mb-3 uppercase tracking-wider">Continue With Your Resume</div>
                        <div className="space-y-2.5">
                          {/* Cover Letter — No-Navigate */}
                          <button
                            onClick={() => {
                              const displayResume = getDisplayResume();
                              if (displayResume) {
                                sessionStorage.setItem('talent-resume-draft', JSON.stringify({
                                  morphedResume: displayResume,
                                  originalResume: originalResume,
                                  jobDescription: jobDescription,
                                  companyName: applicationData.companyName || '',
                                  jobTitle: displayResume.title || applicationData.jobTitle || '',
                                }));
                              }
                              setCoverLetterSent(true);
                              showToast('Resume & JD sent to Cover Letter tool. Open it anytime from the sidebar.', 'check_circle');
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group text-left ${
                              coverLetterSent
                                ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border)]'
                            }`}
                          >
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: coverLetterSent ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                              <span className="material-symbols-rounded text-[18px]" style={{ color: '#10b981' }}>{coverLetterSent ? 'check_circle' : 'mail'}</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-[13px] font-semibold text-[var(--text-primary)]">{coverLetterSent ? '✓ Sent to Cover Letter' : 'Generate Cover Letter'}</p>
                              <p className="text-[11px] text-[var(--text-muted)]">{coverLetterSent ? 'Resume & JD ready — open from sidebar when you\'re done here' : 'Dual-AI powered, auto-filled with your resume + JD'}</p>
                            </div>
                            {coverLetterSent ? (
                              <span
                                onClick={(e) => { e.stopPropagation(); router.push('/suite/cover-letter'); }}
                                className="text-[11px] font-medium text-emerald-500 hover:text-emerald-400 transition-colors cursor-pointer whitespace-nowrap"
                              >Open →</span>
                            ) : (
                              <span className="material-symbols-rounded text-[16px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">send</span>
                            )}
                          </button>

                          {/* LinkedIn — No-Navigate */}
                          <button
                            onClick={() => {
                              const displayResume = getDisplayResume();
                              if (displayResume) {
                                sessionStorage.setItem('talent-resume-draft', JSON.stringify({
                                  morphedResume: displayResume,
                                  originalResume: originalResume,
                                  jobDescription: jobDescription,
                                  companyName: applicationData.companyName || '',
                                  jobTitle: displayResume.title || applicationData.jobTitle || '',
                                }));
                              }
                              setLinkedInSent(true);
                              showToast('Resume & JD sent to LinkedIn Optimizer. Open it anytime from the sidebar.', 'check_circle');
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group text-left ${
                              linkedInSent
                                ? 'border-blue-500/30 bg-blue-500/[0.04]'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border)]'
                            }`}
                          >
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: linkedInSent ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                              <span className="material-symbols-rounded text-[18px]" style={{ color: '#3b82f6' }}>{linkedInSent ? 'check_circle' : 'work'}</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-[13px] font-semibold text-[var(--text-primary)]">{linkedInSent ? '✓ Sent to LinkedIn Optimizer' : 'Optimize LinkedIn Profile'}</p>
                              <p className="text-[11px] text-[var(--text-muted)]">{linkedInSent ? 'Resume & JD ready — open from sidebar when you\'re done here' : 'Headline, about, skills — optimized for recruiter search'}</p>
                            </div>
                            {linkedInSent ? (
                              <span
                                onClick={(e) => { e.stopPropagation(); router.push('/suite/linkedin'); }}
                                className="text-[11px] font-medium text-blue-500 hover:text-blue-400 transition-colors cursor-pointer whitespace-nowrap"
                              >Open →</span>
                            ) : (
                              <span className="material-symbols-rounded text-[16px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">send</span>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              const displayResume = getDisplayResume();
                              if (displayResume) {
                                // Format resume to text for interview sim
                                const parts: string[] = [];
                                if (displayResume.name) parts.push(displayResume.name);
                                if (displayResume.title) parts.push(displayResume.title);
                                if (displayResume.summary) parts.push(displayResume.summary);
                                if (displayResume.skills?.length) parts.push(`Skills: ${displayResume.skills.join(', ')}`);
                                if (displayResume.experience?.length) {
                                  parts.push('Experience:');
                                  displayResume.experience.forEach((e: any) => {
                                    parts.push(`${e.role || e.title} at ${e.company} (${e.duration || e.date || ''})`);
                                    if (e.achievements?.length) e.achievements.forEach((a: string) => parts.push(`• ${a}`));
                                    if (e.description) parts.push(e.description);
                                  });
                                }
                                sessionStorage.setItem('tc_morphed_resume', parts.join('\n\n'));
                              }
                              if (jobDescription) {
                                sessionStorage.setItem('tc_morphed_jd', jobDescription);
                              }
                              router.push('/suite/flashcards');
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border)] transition-all group text-left"
                          >
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                              <span className="material-symbols-rounded text-[18px]" style={{ color: '#ef4444' }}>swords</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-[13px] font-semibold text-[var(--text-primary)]">Practice Interview</p>
                              <p className="text-[11px] text-[var(--text-muted)]">Mock interview with this JD + resume — AI graded</p>
                            </div>
                            <span className="material-symbols-rounded text-[16px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">arrow_forward</span>
                          </button>
                        </div>
                      </div>

                      {/* ── Saved Blueprints ── */}
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                        <button
                          onClick={() => {
                            setShowSavedBlueprints(!showSavedBlueprints);
                            // Refresh from localStorage
                            try { setSavedBlueprints(JSON.parse(localStorage.getItem('tc_blueprints') || '[]')); } catch {}
                          }}
                          className="w-full flex items-center justify-between text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-rounded text-[16px]" style={{ color: '#f59e0b' }}>content_paste</span>
                            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Saved Blueprints</span>
                            {savedBlueprints.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold">{savedBlueprints.length}</span>
                            )}
                          </div>
                          <span className={`material-symbols-rounded text-[16px] text-[var(--text-muted)] transition-transform duration-200 ${showSavedBlueprints ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>

                        <AnimatePresence>
                          {showSavedBlueprints && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 space-y-2">
                                {savedBlueprints.length === 0 ? (
                                  <p className="text-[11px] text-[var(--text-muted)] text-center py-3">No blueprints yet. Generate one from the JD step.</p>
                                ) : (
                                  savedBlueprints.map((bp) => (
                                    <div
                                      key={bp.id}
                                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border)] transition-all group cursor-pointer"
                                      onClick={() => {
                                        setBlueprintContent(bp.content);
                                        setShowBlueprintModal(true);
                                      }}
                                    >
                                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                        <span className="material-symbols-rounded text-[16px]" style={{ color: '#f59e0b' }}>description</span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{bp.targetRole || 'Day-Zero Blueprint'}</p>
                                        <p className="text-[10px] text-[var(--text-muted)]">{new Date(bp.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const updated = savedBlueprints.filter(b => b.id !== bp.id);
                                          setSavedBlueprints(updated);
                                          localStorage.setItem('tc_blueprints', JSON.stringify(updated));
                                          showToast('Blueprint deleted', 'delete');
                                        }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-500/10"
                                        title="Delete blueprint"
                                      >
                                        <span className="material-symbols-rounded text-[14px] text-red-400">close</span>
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Quick Stats */}
                      <div className={`rounded-xl p-4 border ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                        <div className={`text-xs font-semibold mb-3 ${isLight ? 'text-slate-400' : 'text-white/40'}`}>Session Summary</div>
                        <div className="grid grid-cols-1 gap-3 text-center">
                          <div className={`p-3 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}`}>
                            <div className={`text-2xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{resumeCheckResult?.atsScore || '—'}</div>
                            <div className={`text-[9px] mt-1 ${isLight ? 'text-slate-400' : 'text-white/40'}`}>ATS Score</div>
                          </div>
                        </div>
                      </div>

                      {/* Navigation */}
                      <div className="flex gap-3">
                        <button onClick={() => setStep('jd')} className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${isLight ? 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50' : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/[0.12]'}`}>
                          ← Back to JD
                        </button>
                        <button onClick={() => setStep('template')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${isLight ? 'bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100' : 'bg-indigo-500/[0.08] border border-indigo-500/[0.15] text-indigo-400 hover:bg-indigo-500/[0.12]'}`}>
                          Choose Template →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Template Selection */}
            {step === 'template' && (
              <motion.div key="template" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                {displayResume ? (
                  <>
                    {matchScore && (
                      <div className="mb-6 p-4 rounded-xl bg-[var(--theme-bg-card)] border border-green-500/[0.15]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-green-500/[0.08] border border-green-500/[0.15] flex items-center justify-center">
                              <span className="text-lg font-bold text-green-400">{matchScore}%</span>
                            </div>
                            <div>
                              <h3 className="font-semibold text-white">Resume Morphed!</h3>
                              <p className="text-xs text-slate-500">Matches {matchScore}% of job requirements</p>
                            </div>
                          </div>
                          <button onClick={() => setStep('preview')} className="px-4 py-2 rounded-xl font-medium text-sm bg-cyan-500/[0.08] border border-cyan-500/[0.15] text-cyan-400 hover:bg-cyan-500/[0.12] transition-all">
                            Preview & Download →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ATS Proof Engine — Deterministic Before/After */}
                    {proofData && (
                      <div className="mb-6">
                        <ProofCard proof={proofData} isLight={isLight} />
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-[var(--text-primary)]">Choose a Professional Template</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2.5 py-0.5 rounded-md font-semibold bg-[var(--border-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">{TEMPLATES.filter(t => t.tier === 'free').length} Free</span>
                        <span className="text-[10px] px-2.5 py-0.5 rounded-md font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 tracking-wide">{TEMPLATES.filter(t => t.tier === 'pro').length} Pro</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
                      {TEMPLATES.map((template) => {
                        const isLocked = template.tier === 'pro' && !isPro;
                        return (
                        <motion.button
                          key={template.id}
                          onClick={() => {
                            if (isLocked) { showToast('Upgrade to Pro to unlock this template — $2.99/mo', 'info'); return; }
                            setSelectedTemplate(template);
                          }}
                          whileHover={!isLocked ? { scale: 1.02, y: -2 } : {}}
                          whileTap={!isLocked ? { scale: 0.98 } : {}}
                          className={`p-4 rounded-xl border transition-all text-left relative overflow-hidden flex flex-col group ${
                            isLocked 
                              ? 'border-[var(--border-subtle)] bg-[var(--bg-surface)] opacity-70 cursor-not-allowed' 
                              : selectedTemplate.id === template.id 
                                ? 'border-cyan-500/40 bg-cyan-500/5 shadow-md shadow-cyan-500/10' 
                                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-secondary)] hover:shadow-lg cursor-pointer'
                          }`}
                        >
                          {isLocked && (
                            <div className="absolute top-3 right-3 px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/25 text-[8px] font-black text-emerald-700 dark:text-emerald-400 tracking-widest uppercase">PRO</div>
                          )}
                          <div 
                            className={`w-[46px] h-[46px] rounded-[14px] mb-3 flex items-center justify-center shadow-inner transition-colors duration-300 ${isLocked ? 'bg-[var(--border-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]' : ''}`}
                            style={!isLocked ? { backgroundColor: `${template.colors.primary}1A`, color: template.colors.primary, border: `1px solid ${template.colors.primary}33` } : {}}
                          >
                            <span className="material-symbols-rounded text-[26px]">
                              {isLocked ? 'lock' : template.preview}
                            </span>
                          </div>
                          <h4 className="font-bold text-[14px] text-[var(--text-primary)] leading-tight mb-1">{template.name}</h4>
                          <p className="text-[11px] text-[var(--text-muted)] leading-snug">{template.description}</p>
                        </motion.button>
                        );
                      })}
                    </div>

                    {/* Mini Preview */}
                    <div className="rounded-xl glass-card p-5">
                      <div className="flex justify-between mb-4">
                        <h4 className="font-bold text-white">Preview</h4>
                        <button onClick={() => setStep('preview')} className="text-sm text-cyan-400">Full Size →</button>
                      </div>
                      <div className="bg-white rounded-xl p-6 text-slate-900 max-h-64 overflow-hidden relative">
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
                        <h2 className="text-xl font-bold" style={{ color: selectedTemplate.colors.primary }}>{displayResume.name}</h2>
                        <p className="text-sm" style={{ color: selectedTemplate.colors.accent }}>{displayResume.title}</p>
                        <p className="text-xs text-gray-500 mb-3">{[displayResume.email, displayResume.phone, displayResume.location].filter(Boolean).join(' • ')}</p>
                        <p className="text-xs text-gray-700">{displayResume.summary}</p>
                      </div>
                    </div>

                    {!matchScore && (
                      <div className="mt-6 flex justify-end">
                        <button onClick={() => setStep('preview')} className="px-4 py-2 rounded-xl font-medium text-sm bg-cyan-500/[0.08] border border-cyan-500/[0.15] text-cyan-400 hover:bg-cyan-500/[0.12] transition-all">
                          Preview & Download →
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="max-w-lg mx-auto text-center py-12">
                    <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-8">
                      <span className="text-5xl block mb-4"><span className="material-symbols-rounded text-inherit align-middle">warning</span></span>
                      <h3 className="text-xl font-bold text-white mb-2">Resume Data Missing</h3>
                      <p className="text-silver mb-6">Something went wrong loading your resume.</p>
                      <div className="flex gap-3 justify-center">
                        <button onClick={() => setStep('jd')} className="px-6 py-3 rounded-xl bg-[var(--theme-bg-elevated)] text-white font-medium hover:bg-white/10"><span className="material-symbols-rounded text-[14px] align-middle mr-1">arrow_back</span> Back to JD</button>
                        <button onClick={() => { if (originalResume) setMorphedResume(originalResume); }} className="px-6 py-3 rounded-xl bg-cyan-500 text-white font-bold">Use Original Resume</button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 4: Preview */}
            {step === 'preview' && (
              <motion.div key="preview" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                {displayResume ? (
                  <div className="grid lg:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <div className="rounded-xl glass-card p-5">
                        <h3 className="font-semibold text-white mb-4">Actions</h3>

                        {/* Free-tier usage counter */}
                        {!isPro && user && (
                          <div className={`mb-3 px-3 py-2 rounded-lg flex items-center gap-2 ${isLight ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/[0.08] border border-amber-500/[0.15]'}`}>
                            <span className={`material-symbols-rounded text-[16px] ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>token</span>
                            <span className={`text-xs ${isLight ? 'text-slate-700' : 'text-amber-300'}`}>{remaining('morphs')} of {caps?.morphs || 3} free uses left</span>
                          </div>
                        )}
                        {!user && (
                          <div className={`mb-3 px-3 py-2 rounded-lg flex items-center gap-2 ${isLight ? 'bg-cyan-50 border border-cyan-200' : 'bg-cyan-500/[0.06] border border-cyan-500/[0.12]'}`}>
                            <span className={`material-symbols-rounded text-[16px] ${isLight ? 'text-cyan-600' : 'text-cyan-400'}`}>lock_open</span>
                            <span className={`text-xs ${isLight ? 'text-slate-700' : 'text-cyan-300'}`}>Sign in to download your resume</span>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={downloadPDF} disabled={isLoading} className="py-2.5 rounded-xl font-semibold bg-cyan-500/[0.1] border border-cyan-500/[0.2] text-cyan-400 hover:bg-cyan-500/[0.15] transition-all disabled:opacity-50 text-sm">
                              {isLoading ? <><span className="material-symbols-rounded text-[14px] align-middle mr-1">hourglass_top</span>...</> : <><span className="material-symbols-rounded text-[14px] align-middle mr-1">description</span> PDF</>}
                            </button>
                            <button onClick={downloadWord} disabled={isLoading} className="py-2.5 rounded-xl font-semibold bg-blue-500/[0.08] border border-blue-500/[0.15] text-blue-400 hover:bg-blue-500/[0.12] transition-all disabled:opacity-50 text-sm">
                              {isLoading ? <><span className="material-symbols-rounded text-[14px] align-middle mr-1">hourglass_top</span>...</> : <><span className="material-symbols-rounded text-[14px] align-middle mr-1">edit_document</span> Word</>}
                            </button>
                          </div>
                          <button onClick={() => setShowApplicationModal(true)} className="w-full py-3 rounded-xl font-semibold text-sm bg-green-500/[0.08] border border-green-500/[0.15] text-green-400 hover:bg-green-500/[0.12] transition-all">
                            <span className="material-symbols-rounded align-middle mr-1">my_location</span> Track Application
                          </button>
                          <button onClick={handleSave} className="w-full py-2.5 rounded-xl font-medium bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-white transition-all text-sm"><span className="material-symbols-rounded text-inherit align-middle">save</span> Save Version</button>
                          <button onClick={() => setStep('template')} className="w-full py-2.5 rounded-xl font-medium bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-slate-500 transition-all text-sm"><span className="material-symbols-rounded text-inherit align-middle">palette</span> Change Template</button>
                        </div>
                      </div>


                      {matchScore && (
                        <div className="rounded-xl bg-[var(--theme-bg-card)] border border-green-500/[0.15] p-5">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-green-500/[0.08] border border-green-500/[0.15] flex items-center justify-center">
                              <span className="text-lg font-bold text-green-400">{matchScore}%</span>
                            </div>
                            <div>
                              <h4 className="font-bold text-white">Match Score</h4>
                              <div className="h-2 w-32 bg-white/10 rounded-full overflow-hidden mt-1">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${matchScore}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="rounded-xl glass-card p-5">
                        <h4 className="font-semibold text-white mb-2">Template: {selectedTemplate.name}</h4>
                        <p className="text-xs text-slate-500">{selectedTemplate.description}</p>
                      </div>
                    </div>

                    <div className="lg:col-span-2">
                      <div className="rounded-xl glass-card p-4">
                        <div ref={resumeRef} className="bg-white rounded-xl" style={{ minHeight: '800px' }}>
                          <ResumeTemplate resume={displayResume} template={selectedTemplate} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-lg mx-auto text-center py-12">
                    <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-8">
                      <span className="text-5xl block mb-4"><span className="material-symbols-rounded text-inherit align-middle">warning</span></span>
                      <h3 className="text-xl font-bold text-white mb-2">No Resume Data</h3>
                      <button onClick={() => setStep('upload')} className="px-6 py-3 rounded-xl bg-cyan-500 text-white font-bold">Start Over</button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Upgrade Modal */}
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          onSuccess={() => {
            setShowUpgradeModal(false);
            showToast('Upgrade successful! Features unlocked.', 'celebration');
            // Hard reload to refresh user tier
            window.location.reload();
          }}
        />

        {/* Auth Gate Modal — appears when anonymous user tries to download */}
        {showDownloadAuth && (
          <AuthModal
            mode={showDownloadAuth}
            onClose={() => setShowDownloadAuth(null)}
            onSwitchMode={() => setShowDownloadAuth(showDownloadAuth === 'login' ? 'signup' : 'login')}
          />
        )}

        {/* Skill Gap Warning Modal */}
        <SkillGapWarningModal
          isOpen={showSkillGapModal}
          onClose={() => setShowSkillGapModal(false)}
          newSkills={detectedNewSkills}
          matchScore={lastMatchScore}
        />

        {/* Day-Zero Blueprint Modal */}
        <AnimatePresence>
          {showBlueprintModal && blueprintContent && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBlueprintModal(false)} className={`fixed inset-0 backdrop-blur-sm z-50 ${isLight ? 'bg-black/40' : 'bg-black/80'}`} />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className={`relative w-full max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden border ${
                  isLight ? 'bg-white border-amber-200 shadow-2xl' : 'border-amber-500/15'
                }`} style={isLight ? {} : { background: 'var(--theme-bg-card, #111827)' }}>
                  {/* Header */}
                  <div className={`relative p-6 border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                    <div className={`absolute inset-0 ${isLight ? 'bg-gradient-to-br from-amber-50 to-orange-50' : 'bg-gradient-to-br from-amber-500/10 to-orange-500/10'}`} />
                    <div className="relative flex items-center justify-between">
                      <div>
                        <h2 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}><span className="material-symbols-rounded text-inherit align-middle">content_paste</span> Day-Zero Blueprint</h2>
                        <p className={`text-sm mt-1 ${isLight ? 'text-amber-700' : 'text-amber-400/80'}`}>Your strategic &quot;First 90 Days&quot; proposal</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(blueprintContent);
                            showToast('Blueprint copied to clipboard!', 'content_paste');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isLight ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200' : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                          }`}
                        >
                          Copy
                        </button>
                        <button onClick={() => setShowBlueprintModal(false)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          isLight ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700' : 'bg-white/10 text-silver hover:text-white hover:bg-white/20'
                        }`}><span className="material-symbols-rounded">close</span></button>
                      </div>
                    </div>
                  </div>
                  {/* Content */}
                  <div className="p-6 overflow-y-auto max-h-[65vh]">
                    <div className={`prose prose-sm max-w-none ${isLight ? 'prose-slate' : 'prose-invert'}`}>
                      {blueprintContent.split('\n').map((line, i) => {
                        if (line.startsWith('# ')) return <h1 key={i} className={`text-xl font-bold mt-2 mb-3 ${isLight ? 'text-slate-800' : 'text-white'}`}>{line.slice(2)}</h1>;
                        if (line.startsWith('## ')) return <h2 key={i} className={`text-lg font-semibold mt-4 mb-2 ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>{line.slice(3)}</h2>;
                        if (line.startsWith('### ')) return <h3 key={i} className={`text-base font-semibold mt-4 mb-2 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>{line.slice(4)}</h3>;
                        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className={`font-semibold mt-2 ${isLight ? 'text-slate-700' : 'text-white/90'}`}>{line.slice(2, -2)}</p>;
                        if (line.startsWith('- ')) return <li key={i} className={`ml-4 mb-1 list-disc ${isLight ? 'text-slate-600' : 'text-silver'}`}>{line.slice(2)}</li>;
                        if (line.trim() === '') return <div key={i} className="h-2" />;
                        return <p key={i} className={`mb-1 ${isLight ? 'text-slate-600' : 'text-silver'}`}>{line}</p>;
                      })}
                    </div>
                  </div>
                  {/* Footer */}
                  <div className={`p-4 border-t flex justify-between items-center ${
                    isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/20'
                  }`}>
                    <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-silver/50'}`}>Generated by TalentConsulting.io</span>
                    <button onClick={() => setShowBlueprintModal(false)} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      isLight ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200' : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                    }`}>
                      Done
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showApplicationModal && displayResume && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowApplicationModal(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-lg rounded-3xl glass-card overflow-hidden">
                  <div className="relative p-8 text-center border-b border-white/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-cyan-500/10" />
                    <div className="relative">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                        <span className="text-4xl"><span className="material-symbols-rounded text-inherit align-middle">my_location</span></span>
                      </motion.div>
                      <h2 className="text-2xl font-bold text-white">Track this Application?</h2>
                      <p className="text-silver mt-2">We'll save this morphed resume with your application</p>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-silver mb-2">Company Name *</label>
                      <input type="text" value={applicationData.companyName} onChange={(e) => setApplicationData(prev => ({ ...prev, companyName: e.target.value }))} placeholder="e.g., Google" className="w-full px-4 py-3 rounded-xl glass-card text-white placeholder-slate-500 focus:border-green-500/50 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-silver mb-2">Job Title</label>
                      <input type="text" value={applicationData.jobTitle} onChange={(e) => setApplicationData(prev => ({ ...prev, jobTitle: e.target.value }))} placeholder={displayResume.title || 'Position'} className="w-full px-4 py-3 rounded-xl glass-card text-white placeholder-slate-500 focus:border-green-500/50 focus:outline-none" />
                    </div>
                  </div>
                  <div className="p-6 pt-0 flex gap-3">
                    <button onClick={() => { setShowApplicationModal(false); setStep('preview'); }} className="flex-1 px-4 py-3 rounded-xl bg-[var(--theme-bg-elevated)] text-silver hover:bg-white/10 transition-colors font-medium">Skip & Preview Resume</button>
                    <button onClick={handleCreateApplication} disabled={isLoading || !applicationData.companyName.trim()} className="flex-1 px-4 py-3 rounded-xl bg-[var(--theme-bg-elevated)] border border-[var(--theme-border)] text-[var(--theme-fg)] font-bold disabled:opacity-50 hover:bg-white/[0.05] transition-all">
                      {isLoading ? 'Creating...' : <><span className="material-symbols-rounded text-[14px] align-middle mr-1">my_location</span> Track Application</>}
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>

        {/* Save Modal */}
        <AnimatePresence>
          {showSaveModal && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { if (!isSaving) { setShowSaveModal(false); setSaveVersionName(''); setSaveCompanyName(''); }}} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md rounded-3xl glass-card overflow-hidden">
                  {saveSuccess ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }} className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                        <span className="text-4xl"><span className="material-symbols-rounded text-inherit align-middle">check_circle</span></span>
                      </motion.div>
                      <h3 className="text-xl font-bold text-white">Saved & Tracked!</h3>
                      <p className="text-sm text-silver mt-2">Resume saved for <span className="text-cyan-400 font-semibold">{saveCompanyName}</span></p>
                      <p className="text-xs text-silver/60 mt-1">View in Applications tab →</p>
                    </motion.div>
                  ) : (
                    <>
                      <div className="relative p-6 border-b border-white/10">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10" />
                        <div className="relative flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center"><span className="text-2xl"><span className="material-symbols-rounded text-inherit align-middle">save</span></span></div>
                          <div><h3 className="text-xl font-bold text-white">Save & Track</h3><p className="text-sm text-silver">Save this resume and track the application</p></div>
                        </div>
                      </div>
                      <div className="p-6 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">Company Name <span className="text-red-400">*</span></label>
                          <input type="text" value={saveCompanyName} onChange={(e) => setSaveCompanyName(e.target.value)} placeholder="e.g., Google, Meta, Stripe" autoFocus className="w-full px-4 py-3 rounded-xl glass-card text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">Resume Version Name</label>
                          <input type="text" value={saveVersionName} onChange={(e) => setSaveVersionName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && saveCompanyName.trim() && saveVersionName.trim()) confirmSave(); }} placeholder="e.g., Senior PM Resume" className="w-full px-4 py-3 rounded-xl glass-card text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                        </div>
                        <div className="rounded-xl bg-cyan-500/[0.06] border border-cyan-500/[0.12] p-3">
                          <p className="text-xs text-cyan-400/80"><span className="material-symbols-rounded text-inherit align-middle">lightbulb</span> This will save your resume <strong>and</strong> create an application entry you can track in the Applications tab.</p>
                        </div>
                      </div>
                      <div className="p-6 pt-0 flex gap-3">
                        <button onClick={() => { setShowSaveModal(false); setSaveVersionName(''); setSaveCompanyName(''); }} disabled={isSaving} className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>Cancel</button>
                        <button onClick={confirmSave} disabled={!saveCompanyName.trim() || isSaving} className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all disabled:opacity-50 ${isLight ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md'}`}>
                          {isSaving ? <><span className="material-symbols-rounded text-[14px] align-middle mr-1 animate-spin">hourglass_top</span> Saving...</> : <><span className="material-symbols-rounded text-[14px] align-middle mr-1">save</span> Save & Track</>}
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ===== RENDER: Create Flow =====
  if (mode === 'create') {
    const displayResume = buildResume;

    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 pl-12 lg:pl-0">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Build From Scratch</h1>
              <p className="text-slate-500 text-sm">Create a professional resume with AI assistance</p>
            </div>
            <button onClick={resetAll} className="px-4 py-2 rounded-xl glass-card text-slate-500 hover:border-white/[0.12] hover:text-white transition-all text-sm">
              ← Start Over
            </button>
          </div>

          {/* Steps */}
          <AnimatePresence mode="wait">
            {step === 'upload' && (
              <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Personal Info */}
                  <div className="rounded-xl glass-card p-5">
                    <h3 className="text-base font-semibold text-white mb-4">Personal Information</h3>
                    <div className="space-y-4">
                      <input type="text" value={buildResume.name} onChange={(e) => setBuildResume(prev => ({ ...prev, name: e.target.value }))} placeholder="Full Name" className="w-full px-4 py-3 rounded-xl glass-card text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      <input type="text" value={buildResume.title} onChange={(e) => setBuildResume(prev => ({ ...prev, title: e.target.value }))} placeholder="Job Title (e.g., Senior Software Engineer)" className="w-full px-4 py-3 rounded-xl glass-card text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      <input type="email" value={buildResume.email} onChange={(e) => setBuildResume(prev => ({ ...prev, email: e.target.value }))} placeholder="Email" className="w-full px-4 py-3 rounded-xl glass-card text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      <input type="text" value={buildResume.phone} onChange={(e) => setBuildResume(prev => ({ ...prev, phone: e.target.value }))} placeholder="Phone" className="w-full px-4 py-3 rounded-xl glass-card text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      <input type="text" value={buildResume.location} onChange={(e) => setBuildResume(prev => ({ ...prev, location: e.target.value }))} placeholder="Location (e.g., San Francisco, CA)" className="w-full px-4 py-3 rounded-xl glass-card text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="rounded-xl glass-card p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-base font-semibold text-white">Professional Summary</h3>
                      <button onClick={generateSummary} disabled={aiSuggesting} className="px-3 py-1 rounded-lg text-sm bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50">
                        {aiSuggesting ? <><span className="material-symbols-rounded text-[14px] align-middle mr-1">hourglass_top</span> Generating...</> : <><span className="material-symbols-rounded text-[14px] align-middle mr-1">auto_awesome</span> Generate with AI</>}
                      </button>
                    </div>
                    <textarea value={buildResume.summary} onChange={(e) => setBuildResume(prev => ({ ...prev, summary: e.target.value }))} placeholder="Write a brief professional summary..." className="w-full h-48 px-4 py-3 rounded-xl glass-card text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none resize-none" />
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button onClick={() => setStep('jd')} disabled={!buildResume.name || !buildResume.title} className="px-4 py-2 rounded-xl font-medium text-sm bg-cyan-500/[0.08] border border-cyan-500/[0.15] text-cyan-400 hover:bg-cyan-500/[0.12] disabled:opacity-50 transition-all">
                    Add Experience →
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'jd' && (
              <motion.div key="exp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="rounded-xl glass-card p-5 mb-6">
                  <h3 className="text-base font-semibold text-white mb-4">Work Experience</h3>
                  {buildResume.experience.map((exp, i) => (
                    <div key={i} className="mb-4 p-4 rounded-xl glass-card">
                      <div className="grid md:grid-cols-3 gap-3 mb-3">
                        <input type="text" value={exp.role} onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].role = e.target.value; setBuildResume(prev => ({ ...prev, experience: newExp })); }} placeholder="Job Title" className="px-3 py-2 rounded-lg glass-card text-white text-sm placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                        <input type="text" value={exp.company} onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].company = e.target.value; setBuildResume(prev => ({ ...prev, experience: newExp })); }} placeholder="Company" className="px-3 py-2 rounded-lg glass-card text-white text-sm placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                        <input type="text" value={exp.duration} onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].duration = e.target.value; setBuildResume(prev => ({ ...prev, experience: newExp })); }} placeholder="Duration (e.g., 2020-Present)" className="px-3 py-2 rounded-lg glass-card text-white text-sm placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-slate-500">Achievements</span>
                        <button onClick={() => generateAchievements(i)} disabled={aiSuggesting} className="px-2 py-1 rounded text-xs bg-cyan-500/20 text-cyan-400">{aiSuggesting ? <><span className="material-symbols-rounded text-[14px] align-middle mr-1">hourglass_top</span>...</> : <><span className="material-symbols-rounded text-[14px] align-middle mr-1">auto_awesome</span> Generate</>}</button>
                      </div>
                      {exp.achievements.map((a, j) => (
                        <input key={j} type="text" value={a} onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].achievements[j] = e.target.value; setBuildResume(prev => ({ ...prev, experience: newExp })); }} placeholder={`Achievement ${j + 1}`} className="w-full mb-2 px-3 py-2 rounded-lg glass-card text-white text-sm placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      ))}
                      <button onClick={() => { const newExp = [...buildResume.experience]; newExp[i].achievements.push(''); setBuildResume(prev => ({ ...prev, experience: newExp })); }} className="text-xs text-cyan-400">+ Add Achievement</button>
                    </div>
                  ))}
                  <button onClick={() => setBuildResume(prev => ({ ...prev, experience: [...prev.experience, { role: '', company: '', duration: '', achievements: [''] }] }))} className="w-full py-2.5 rounded-xl border border-dashed border-white/[0.08] text-slate-500 hover:border-cyan-500/20 hover:text-white transition-all text-sm">
                    + Add Experience
                  </button>
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setStep('upload')} className="px-4 py-2 rounded-xl glass-card text-slate-500 hover:border-white/[0.12] text-sm"><span className="material-symbols-rounded text-[14px] align-middle mr-1">arrow_back</span> Back</button>
                  <button onClick={() => setStep(isPro ? 'enhance' : 'template')} className="px-4 py-2 rounded-xl font-medium text-sm bg-cyan-500/[0.08] border border-cyan-500/[0.15] text-cyan-400 hover:bg-cyan-500/[0.12] transition-all">{isPro ? <><span className="material-symbols-rounded text-[14px] align-middle mr-1">auto_awesome</span> AI Enhance &rarr;</> : 'Choose Template →'}</button>
                </div>
              </motion.div>
            )}

            {(step === 'template' || step === 'preview') && hasResumeData(displayResume) && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    {step === 'template' && (
                      <>
                        <h3 className="text-xl font-bold text-white">Choose Template</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {TEMPLATES.map((t) => {
                            const isLocked = t.tier === 'pro' && !isPro;
                            return (
                            <button key={t.id} onClick={() => { if (isLocked) { showToast('Upgrade to Pro — $2.99/mo', 'info'); return; } setSelectedTemplate(t); }} className={`p-3 rounded-xl border text-left text-sm relative ${isLocked ? 'border-white/[0.04] bg-[var(--theme-bg-card)] opacity-60' : selectedTemplate.id === t.id ? 'border-cyan-500/[0.2] bg-cyan-500/[0.03]' : 'border-white/[0.06] bg-[var(--theme-bg-card)] hover:border-white/[0.12]'}`}>
                              {isLocked && <span className="absolute top-1 right-1 text-[8px] px-1 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-bold">PRO</span>}
                              <span className="text-xl block mb-1">{isLocked ? 'lock' : t.preview}</span>
                              <span className="text-white font-medium">{t.name}</span>
                            </button>
                            );
                          })}
                        </div>
                        <button onClick={() => setStep('preview')} className="w-full py-2.5 rounded-xl font-medium text-sm bg-cyan-500/[0.08] border border-cyan-500/[0.15] text-cyan-400 hover:bg-cyan-500/[0.12] transition-all">Preview & Download →</button>
                      </>
                    )}
                    {step === 'preview' && (
                      <div className="rounded-xl glass-card p-5 space-y-3">
                        <h3 className="font-semibold text-white mb-4">Actions</h3>

                        {/* Free-tier usage counter */}
                        {!isPro && user && (
                          <div className={`mb-1 px-3 py-2 rounded-lg flex items-center gap-2 ${isLight ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/[0.08] border border-amber-500/[0.15]'}`}>
                            <span className={`material-symbols-rounded text-[16px] ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>token</span>
                            <span className={`text-xs ${isLight ? 'text-slate-700' : 'text-amber-300'}`}>{remaining('morphs')} of {caps?.morphs || 3} free uses left</span>
                          </div>
                        )}
                        {!user && (
                          <div className={`mb-1 px-3 py-2 rounded-lg flex items-center gap-2 ${isLight ? 'bg-cyan-50 border border-cyan-200' : 'bg-cyan-500/[0.06] border border-cyan-500/[0.12]'}`}>
                            <span className={`material-symbols-rounded text-[16px] ${isLight ? 'text-cyan-600' : 'text-cyan-400'}`}>lock_open</span>
                            <span className={`text-xs ${isLight ? 'text-slate-700' : 'text-cyan-300'}`}>Sign in to download your resume</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={downloadPDF} disabled={isLoading} className="py-2.5 rounded-xl font-semibold bg-cyan-500/[0.1] border border-cyan-500/[0.2] text-cyan-400 hover:bg-cyan-500/[0.15] transition-all disabled:opacity-50 text-sm">{isLoading ? <><span className="material-symbols-rounded text-[14px] align-middle mr-1">hourglass_top</span>...</> : <><span className="material-symbols-rounded text-[14px] align-middle mr-1">description</span> PDF</>}</button>
                          <button onClick={downloadWord} disabled={isLoading} className="py-2.5 rounded-xl font-semibold bg-blue-500/[0.08] border border-blue-500/[0.15] text-blue-400 hover:bg-blue-500/[0.12] transition-all disabled:opacity-50 text-sm">{isLoading ? <><span className="material-symbols-rounded text-[14px] align-middle mr-1">hourglass_top</span>...</> : <><span className="material-symbols-rounded text-[14px] align-middle mr-1">edit_document</span> Word</>}</button>
                        </div>
                        <button onClick={handleSave} className="w-full py-2.5 rounded-xl font-medium bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-white transition-all text-sm"><span className="material-symbols-rounded text-inherit align-middle">save</span> Save Version</button>
                        <button onClick={() => setStep('template')} className="w-full py-2.5 rounded-xl font-medium bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-slate-500 transition-all text-sm"><span className="material-symbols-rounded text-inherit align-middle">palette</span> Change Template</button>
                      </div>
                    )}
                  </div>
                  <div className="lg:col-span-2">
                    <div className="rounded-xl glass-card p-4">
                      <div ref={resumeRef} className="bg-white rounded-xl overflow-hidden" style={{ minHeight: '800px' }}>
                        <ResumeTemplate resume={displayResume} template={selectedTemplate} />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Save Modal (reused) */}
        <AnimatePresence>
          {showSaveModal && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { if (!isSaving) { setShowSaveModal(false); setSaveVersionName(''); setSaveCompanyName(''); }}} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md rounded-3xl glass-card overflow-hidden">
                  {saveSuccess ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }} className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                        <span className="text-4xl"><span className="material-symbols-rounded text-inherit align-middle">check_circle</span></span>
                      </motion.div>
                      <h3 className="text-xl font-bold text-white">Saved & Tracked!</h3>
                      <p className="text-sm text-silver mt-2">Resume saved for <span className="text-cyan-400 font-semibold">{saveCompanyName}</span></p>
                      <p className="text-xs text-silver/60 mt-1">View in Applications tab →</p>
                    </motion.div>
                  ) : (
                    <>
                      <div className="relative p-6 border-b border-white/10">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10" />
                        <div className="relative flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center"><span className="text-2xl"><span className="material-symbols-rounded text-inherit align-middle">save</span></span></div>
                          <div><h3 className="text-xl font-bold text-white">Save & Track</h3><p className="text-sm text-silver">Save this resume and track the application</p></div>
                        </div>
                      </div>
                      <div className="p-6 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">Company Name <span className="text-red-400">*</span></label>
                          <input type="text" value={saveCompanyName} onChange={(e) => setSaveCompanyName(e.target.value)} placeholder="e.g., Google, Meta, Stripe" autoFocus className="w-full px-4 py-3 rounded-xl glass-card text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">Resume Version Name</label>
                          <input type="text" value={saveVersionName} onChange={(e) => setSaveVersionName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && saveCompanyName.trim() && saveVersionName.trim()) confirmSave(); }} placeholder="e.g., Senior PM Resume" className="w-full px-4 py-3 rounded-xl glass-card text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                        </div>
                        <div className="rounded-xl bg-cyan-500/[0.06] border border-cyan-500/[0.12] p-3">
                          <p className="text-xs text-cyan-400/80"><span className="material-symbols-rounded text-inherit align-middle">lightbulb</span> This will save your resume <strong>and</strong> create an application entry you can track in the Applications tab.</p>
                        </div>
                      </div>
                      <div className="p-6 pt-0 flex gap-3">
                        <button onClick={() => { setShowSaveModal(false); setSaveVersionName(''); setSaveCompanyName(''); }} disabled={isSaving} className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>Cancel</button>
                        <button onClick={confirmSave} disabled={!saveCompanyName.trim() || isSaving} className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all disabled:opacity-50 ${isLight ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md'}`}>
                          {isSaving ? <><span className="material-symbols-rounded text-[14px] align-middle mr-1 animate-spin">hourglass_top</span> Saving...</> : <><span className="material-symbols-rounded text-[14px] align-middle mr-1">save</span> Save & Track</>}
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Fallback
  return null;
}

// ============ RESUME TEMPLATE COMPONENT ============
// Delegates to the extracted ATS-safe templates in components/resume-templates/
function ResumeTemplate({ resume, template }: { resume: ResumeData; template: typeof TEMPLATES[0] }) {
  // Normalize to canonical format before rendering — guarantees {category, items} skills etc.
  const normalized = normalizeResume(resume);
  return (
    <ResumeTemplateComponent
      resume={normalized}
      templateId={template.id}
      colors={template.colors}
    />
  );
}
