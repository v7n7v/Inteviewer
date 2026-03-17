'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { saveResumeVersion, getResumeVersions, createJobApplication, deleteResumeVersion, type ResumeVersion } from '@/lib/database-suite';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { downloadResumePDF } from '@/lib/pdf-templates';
import { useUserTier } from '@/hooks/use-user-tier';
import { useTheme } from '@/components/ThemeProvider';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType, TableBorders } from 'docx';
import { saveAs } from 'file-saver';
import { authFetch } from '@/lib/auth-fetch';
import FileUploadDropzone from '@/components/FileUploadDropzone';

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
  // ── FREE TEMPLATES (4) ──
  { id: 'executive', name: 'Executive', description: 'Clean, professional design for senior roles', preview: '📊', tier: 'free' as const, colors: { primary: '#1a365d', accent: '#2b6cb0', text: '#1a202c' } },
  { id: 'modern', name: 'Modern', description: 'Contemporary style with bold headers', preview: '✨', tier: 'free' as const, colors: { primary: '#0d9488', accent: '#14b8a6', text: '#1e293b' } },
  { id: 'minimal', name: 'Minimal', description: 'Simple and elegant, ATS-friendly', preview: '🎯', tier: 'free' as const, colors: { primary: '#374151', accent: '#6b7280', text: '#111827' } },
  { id: 'compact', name: 'Compact', description: 'Dense, ATS-optimized one-page format', preview: '📋', tier: 'free' as const, colors: { primary: '#15803d', accent: '#16a34a', text: '#14532d' } },
  // ── PRO TEMPLATES (14) ──
  { id: 'creative', name: 'Creative', description: 'Stand out with unique layout', preview: '🎨', tier: 'pro' as const, colors: { primary: '#7c3aed', accent: '#8b5cf6', text: '#1f2937' } },
  { id: 'technical', name: 'Technical', description: 'Optimized for tech roles', preview: '💻', tier: 'pro' as const, colors: { primary: '#0369a1', accent: '#0284c7', text: '#0f172a' } },
  { id: 'harvard', name: 'Harvard', description: 'Traditional achievement-focused format', preview: '🎓', tier: 'pro' as const, colors: { primary: '#991b1b', accent: '#b91c1c', text: '#1c1917' } },
  { id: 'cascade', name: 'Cascade', description: 'Spacious sidebar with skill showcase', preview: '📐', tier: 'pro' as const, colors: { primary: '#1e3a5f', accent: '#3b82f6', text: '#1e293b' } },
  { id: 'elegant', name: 'Elegant', description: 'Serif typography, refined and luxurious', preview: '🖋️', tier: 'pro' as const, colors: { primary: '#44403c', accent: '#78716c', text: '#292524' } },
  { id: 'nordic', name: 'Nordic', description: 'Clean Scandinavian-inspired minimal design', preview: '❄️', tier: 'pro' as const, colors: { primary: '#475569', accent: '#94a3b8', text: '#334155' } },
  { id: 'ats-optimized', name: 'ATS Ultra', description: 'Maximum ATS compatibility, zero formatting risk', preview: '🤖', tier: 'pro' as const, colors: { primary: '#0f766e', accent: '#14b8a6', text: '#134e4a' } },
  { id: 'double-column', name: 'Double Column', description: 'Two-column layout with sidebar skills panel', preview: '📰', tier: 'pro' as const, colors: { primary: '#1e40af', accent: '#3b82f6', text: '#1e293b' } },
  { id: 'infographic', name: 'Infographic', description: 'Visual skill bars, charts, and timeline layout', preview: '📈', tier: 'pro' as const, colors: { primary: '#c026d3', accent: '#e879f9', text: '#1f2937' } },
  { id: 'deloitte', name: 'Deloitte', description: 'Consulting-style format with impact metrics', preview: '🏢', tier: 'pro' as const, colors: { primary: '#86bc25', accent: '#0076a8', text: '#1a1a2e' } },
  { id: 'faang', name: 'FAANG', description: 'Big Tech format with project highlights', preview: '🚀', tier: 'pro' as const, colors: { primary: '#4285f4', accent: '#34a853', text: '#202124' } },
  { id: 'startup', name: 'Startup', description: 'Dynamic layout for fast-paced environments', preview: '⚡', tier: 'pro' as const, colors: { primary: '#f97316', accent: '#fb923c', text: '#1c1917' } },
  { id: 'federal', name: 'Federal', description: 'Government & defense format with clearance section', preview: '🏛️', tier: 'pro' as const, colors: { primary: '#1e3a5f', accent: '#1d4ed8', text: '#111827' } },
  { id: 'academic', name: 'Academic', description: 'Research-focused with publications & grants', preview: '🎓', tier: 'pro' as const, colors: { primary: '#7c2d12', accent: '#c2410c', text: '#1c1917' } },
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
    <div className="rounded-2xl bg-[#0A0A0A] border border-white/[0.06] p-5 md:p-6">
      <div className="flex flex-col md:flex-row gap-6 items-stretch">
        {/* Left: "Original" resume */}
        <div className="flex-1 rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
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
            <span className="text-xs">🧠</span>
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
    <div className="rounded-2xl bg-[#0A0A0A] border border-white/[0.06] p-5 md:p-6 overflow-hidden">
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
      <div className="relative min-h-[160px] rounded-xl bg-white/[0.01] border border-white/[0.04] overflow-hidden">
        <AnimatePresence mode="wait">
          {/* Step 0: Upload */}
          {activeStep === 0 && (
            <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-6 flex flex-col items-center justify-center h-[160px]">
              <motion.div
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="text-4xl mb-3"
              >📄</motion.div>
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
                  📄 PDF
                </button>
                <button className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-medium text-blue-400 flex items-center gap-1">
                  📝 Word
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

  // Resume data
  const [originalResume, setOriginalResume] = useState<ResumeData | null>(null);
  const [morphedResume, setMorphedResume] = useState<ResumeData | null>(null);
  const [buildResume, setBuildResume] = useState<ResumeData>({ ...EMPTY_RESUME });

  // Morph settings
  const [jobDescription, setJobDescription] = useState('');
  const [morphPercentage, setMorphPercentage] = useState(75);
  const [targetPageCount, setTargetPageCount] = useState<number | 'auto'>('auto');
  const [matchScore, setMatchScore] = useState<number | null>(null);

  // Tier awareness
  const { tier, canUse, remaining, refetch: refetchUsage } = useUserTier();

  // UI state
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [buildStep, setBuildStep] = useState(0);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [processingStage, setProcessingStage] = useState<'uploading' | 'extracting' | 'parsing' | null>(null);

  // Enhance step state
  const [enhancePhase, setEnhancePhase] = useState<'idle' | 'checking' | 'fixing' | 'cover-letter' | 'linkedin'>('idle');
  const [enhancePipelineStage, setEnhancePipelineStage] = useState(0); // 0=idle, 1=GPT writing, 2=Gemini checking, 3=refining
  const [autoFixing, setAutoFixing] = useState(false);
  const [preFixScore, setPreFixScore] = useState<number | null>(null);

  // Modals
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveVersionName, setSaveVersionName] = useState('');
  const [saveCompanyName, setSaveCompanyName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [applicationData, setApplicationData] = useState({ companyName: '', jobTitle: '', notes: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  // ===== EFFECTS =====
  useEffect(() => { if (user) loadVersions(); }, [user]);

  // ===== DATA LOADING =====
  const loadVersions = async () => {
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
      throw new Error(err.error || 'Failed to parse resume');
    }
    const data = await res.json();
    return data.resume;
  };

  const morphResumeToJD = async (resume: ResumeData, jd: string, percentage: number, pageCount: number | 'auto'): Promise<{ morphed: ResumeData; score: number }> => {
    const res = await authFetch('/api/resume/morph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume, jobDescription: jd, morphPercentage: percentage, targetPageCount: pageCount }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Morph failed' }));
      throw new Error(err.error || 'Failed to morph resume');
    }
    const data = await res.json();
    return { morphed: data.morphedResume, score: data.matchScore };
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
    setProcessingStage('extracting');
    try {
      // Brief pause so user sees the "extracting" stage
      await new Promise(r => setTimeout(r, 800));
      setProcessingStage('parsing');
      showToast('Parsing resume with AI...', '🧠');
      const parsed = await parseResumeWithAI(text);
      setOriginalResume(parsed);
      showToast('Resume parsed successfully!', '✅');
      setStep('jd');
    } catch (error: any) {
      console.error('AI parsing error:', error);
      showToast(error.message || 'Failed to process resume with AI', '❌');
    } finally {
      setIsLoading(false);
      setProcessingStage(null);
    }
  };

  const handleMorph = async () => {
    if (!originalResume || !jobDescription.trim()) return;
    setIsLoading(true);
    try {
      showToast(`AI is morphing your resume at ${morphPercentage}% intensity...`, '🧠');
      const { morphed, score } = await morphResumeToJD(originalResume, jobDescription, morphPercentage, targetPageCount);

      // CRITICAL: Always ensure we have valid data before proceeding
      const validResume = hasResumeData(morphed) ? morphed : originalResume;

      setMorphedResume(validResume);
      setMatchScore(score);
      setStep(tier === 'pro' ? 'enhance' : 'template');
      showToast(`Resume morphed! ${score}% match`, '✅');

      // Extract company name (non-blocking)
      try {
        if (!applicationData.companyName) {
          const company = await extractCompanyFromJD(jobDescription);
          if (company) setApplicationData(prev => ({ ...prev, companyName: company }));
        }
      } catch { /* non-critical */ }
    } catch (error) {
      console.error('Morph error:', error);
      showToast('Failed to morph resume', '❌');
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
    if (!saveVersionName.trim() || !saveCompanyName.trim()) return;
    const resume = getDisplayResume();
    if (!resume) {
      showToast('No resume data to save', '❌');
      return;
    }
    setIsLoading(true);
    try {
      // 1. Save the resume version
      const result = await saveResumeVersion(
        `${saveVersionName} — ${saveCompanyName}`,
        resume as any,
        { matchScore, template: selectedTemplate.id, morphPercentage },
        'technical'
      );
      if (!result.success) {
        showToast(result.error || 'Save failed', '❌');
        setIsLoading(false);
        return;
      }

      // 2. Auto-create an application entry
      await createJobApplication({
        companyName: saveCompanyName,
        jobTitle: resume.title || saveVersionName,
        jobDescription: jobDescription || undefined,
        resumeVersionId: result.data?.id,
        morphedResumeName: saveVersionName,
        talentDensityScore: matchScore || undefined,
      });

      // 3. Show success state
      setSaveSuccess(true);
      loadVersions();
      showToast(`Saved & tracked for ${saveCompanyName}!`, '✅');

      // Auto-close after brief visual confirmation
      setTimeout(() => {
        setShowSaveModal(false);
        setSaveVersionName('');
        setSaveCompanyName('');
        setSaveSuccess(false);
      }, 1500);
    } catch (error: any) {
      console.error('Save error:', error);
      showToast(`Save failed: ${error.message || 'Unknown error'}`, '❌');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateApplication = async () => {
    if (!applicationData.companyName.trim()) {
      showToast('Please enter a company name', '❌');
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
        showToast('Application tracked! View in Applications tab.', '✅');
        setShowApplicationModal(false);
        setApplicationData({ companyName: '', jobTitle: '', notes: '' });
      } else {
        showToast(result.error || 'Failed to create application', '❌');
      }
    } catch (error: any) {
      console.error('Application error:', error);
      showToast(`Failed: ${error.message || 'Unknown error'}`, '❌');
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
      showToast('Version deleted', '✅');
      loadVersions();
    }
    setDeleteConfirmId(null);
  };

  const loadVersionToMorph = (version: ResumeVersion) => {
    setOriginalResume(version.content as unknown as ResumeData);
    setMode('morph');
    setStep('jd');
    showToast('Resume loaded!', '✅');
  };

  // ===== DOWNLOAD FUNCTIONS =====
  const downloadPDF = async () => {
    const resume = getDisplayResume();
    if (!resume) {
      showToast('No resume data available', '❌');
      return;
    }
    setIsLoading(true);
    try {
      await downloadResumePDF(resume, selectedTemplate.colors);
      showToast('PDF downloaded!', '✅');
    } catch (error: any) {
      console.error('PDF download error:', error);
      showToast(`PDF download failed: ${error.message || 'Unknown error'}`, '❌');
    }
    finally { setIsLoading(false); }
  };

  const downloadWord = async () => {
    const resume = getDisplayResume();
    if (!resume) return;
    setIsLoading(true);
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
      const rows: Paragraph[] = [];
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

    try {
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
          new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: contact.map((c, i) => (i === 0 ? '📧 ' : i === 1 ? '📱 ' : '📍 ') + c).join('    '), size: 18, color: '555555' })] }),
          ...(resume.summary ? [new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: resume.summary, size: 20, color: '555555' })] })] : []),
          ...(resume.experience?.length ? [
            new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: '💼  EXPERIENCE', bold: true, size: 24, color: p })] }),
            ...resume.experience.flatMap(exp => expBlock(exp, { bullet: '▸' })),
          ] : []),
          ...(resume.education?.length ? [
            new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: '🎓  EDUCATION', bold: true, size: 24, color: p })] }),
            ...resume.education.map(edu => eduBlock(edu)),
          ] : []),
          ...(resume.skills?.length ? [
            new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: '⚡  SKILLS', bold: true, size: 24, color: p })] }),
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
        const sidebarContent: Paragraph[] = [
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

        const mainContent: Paragraph[] = [];
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

      const doc = new Document({
        styles: { default: { document: { run: { font: 'Calibri', size: 22, color: '333333' } } } },
        sections: [{ properties: { page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } } }, children }],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${resume.name?.replace(/\s+/g, '_') || 'resume'}.docx`);
      showToast('Word document downloaded!', '✅');
    } catch (e) { console.error('Word download error:', e); showToast('Download failed', '❌'); }
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
    if (!displayResume) return showToast('No resume data available', '❌');
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
      showToast(`Cover letter generated! Score: ${data.score}/100 ${data.refined ? '(Dual-AI refined ✨)' : ''}`, '✅');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate cover letter', '❌');
    } finally { setCoverLetterLoading(false); }
  };

  const checkResume = async () => {
    const displayResume = getDisplayResume();
    if (!displayResume) return showToast('No resume data available', '❌');
    setResumeCheckLoading(true);
    setResumeCheckResult(null);
    setShowResumeCheckPanel(true);
    try {
      const resumeText = [
        displayResume.name, displayResume.title, displayResume.email, displayResume.phone,
        displayResume.summary,
        ...(displayResume.experience || []).map((e: any) => `${e.title} at ${e.company}: ${(e.achievements || []).join('. ')}`),
        ...(displayResume.education || []).map((e: any) => `${e.degree} from ${e.school}`),
        'Skills: ' + (displayResume.skills || []).join(', '),
      ].filter(Boolean).join('\n');

      const res = await authFetch('/api/resume/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, targetJD: jobDescription || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResumeCheckResult(data);
      showToast(`Resume graded: ${data.overallGrade} (ATS: ${data.atsScore}/100)`, '✅');
    } catch (err: any) {
      showToast(err.message || 'Failed to check resume', '❌');
    } finally { setResumeCheckLoading(false); }
  };

  const generateLinkedIn = async () => {
    const displayResume = getDisplayResume();
    if (!displayResume) return showToast('No resume data available', '❌');
    setLinkedinLoading(true);
    setLinkedinResult(null);
    setShowLinkedinPanel(true);
    try {
      const resumeText = [
        displayResume.name, displayResume.title, displayResume.email,
        displayResume.summary,
        ...(displayResume.experience || []).map((e: any) => `${e.title} at ${e.company} (${e.duration || ''}): ${(e.achievements || []).join('. ')}`),
        ...(displayResume.education || []).map((e: any) => `${e.degree} from ${e.school}`),
        'Skills: ' + (displayResume.skills || []).join(', '),
      ].filter(Boolean).join('\n');

      const res = await authFetch('/api/resume/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, targetRole: displayResume.title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLinkedinResult(data);
      showToast(`LinkedIn profile generated! Score: ${data.score}/100 ${data.refined ? '(Dual-AI refined ✨)' : ''}`, '✅');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate LinkedIn profile', '❌');
    } finally { setLinkedinLoading(false); setEnhancePhase('idle'); setEnhancePipelineStage(0); }
  };

  const autoFixResume = async () => {
    if (!resumeCheckResult?.suggestions?.length) return showToast('Run Resume Check first', '❌');
    const currentResume = getDisplayResume();
    if (!currentResume) return;
    setAutoFixing(true);
    setEnhancePhase('fixing');
    setEnhancePipelineStage(1);
    setPreFixScore(resumeCheckResult.atsScore);
    try {
      const resumeText = [
        currentResume.name, currentResume.title, currentResume.email, currentResume.phone,
        currentResume.summary,
        ...(currentResume.experience || []).map((e: any) => `${e.title || e.role} at ${e.company} (${e.duration || ''}): ${(e.achievements || []).join('. ')}`),
        ...(currentResume.education || []).map((e: any) => `${e.degree} from ${e.school}`),
        'Skills: ' + (currentResume.skills || []).join(', '),
      ].filter(Boolean).join('\n');

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
      if (!res.ok) throw new Error(data.error);

      setEnhancePipelineStage(3);
      // Apply improved resume data
      if (data.improvedResume) {
        const improved = {
          ...currentResume,
          ...data.improvedResume,
          // Normalize field names
          title: data.improvedResume.title || currentResume.title,
          experience: (data.improvedResume.experience || []).map((exp: any) => ({
            ...exp,
            role: exp.role || exp.title,
            title: exp.title || exp.role,
          })),
        };
        if (mode === 'morph') setMorphedResume(improved);
        else setBuildResume(improved);
        showToast(`Resume auto-fixed! Score: ${data.score}/100 ${data.refined ? '(Dual-AI refined ✨)' : ''}`, '✅');

        // Save skill gap analysis for Skill Bridge
        try {
          const originalSkills = (currentResume.skills || []).map((s: string) => s.toLowerCase().trim());
          const improvedSkills = (improved.skills || []).map((s: string) => s.toLowerCase().trim());
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
      showToast(err.message || 'Failed to auto-fix resume', '❌');
    } finally { setAutoFixing(false); setEnhancePhase('idle'); setEnhancePipelineStage(0); }
  };

  const generateSummary = async () => {
    if (!buildResume.title) return showToast('Add a job title first', '❌');
    setAiSuggesting(true);
    try {
      const res = await authFetch('/api/resume/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_summary', text: `Role: ${buildResume.title}\nExperience: ${buildResume.experience.map(e => e.role).join(', ') || 'Entry level'}` }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setBuildResume(prev => ({ ...prev, summary: data.summary }));
      showToast('Summary generated!', '✅');
    } catch { showToast('Failed to generate', '❌'); }
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
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const newExp = [...buildResume.experience];
      newExp[expIndex] = { ...exp, achievements: data.achievements };
      setBuildResume(prev => ({ ...prev, experience: newExp }));
      showToast('Achievements generated!', '✅');
    } catch { showToast('Failed to generate', '❌'); }
    finally { setAiSuggesting(false); }
  };

  const suggestSkills = async () => {
    if (!buildResume.title) return showToast('Add a job title first', '❌');
    setAiSuggesting(true);
    try {
      const res = await authFetch('/api/resume/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest_skills', text: `Role: ${buildResume.title}` }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setBuildResume(prev => ({ ...prev, skills: data.skills || [] }));
      showToast('Skills suggested!', '✅');
    } catch { showToast('Failed to suggest', '❌'); }
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
  };

  // ===== RENDER: Auth Check =====
  if (!user) return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-12 text-center max-w-md">
        <span className="text-6xl mb-4 block">🔒</span>
        <h2 className="text-2xl font-bold text-white mb-3">Sign In Required</h2>
        <p className="text-silver mb-6">Please sign in to access Liquid Resume</p>
        <button onClick={() => router.push('/')} className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold">
          Go to Home
        </button>
      </div>
    </div>
  );

  // ===== RENDER: Mode Selection =====
  if (mode === 'choose') {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* ═══ Hero Banner ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="relative rounded-2xl overflow-hidden p-6 md:p-8"
              style={isLight
                ? { background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 40%, #F8F9FC 100%)', border: '1px solid rgba(0,112,243,0.12)' }
                : { background: 'linear-gradient(135deg, #0c1a2e 0%, #0a1628 40%, #091220 100%)', border: '1px solid rgba(0,245,255,0.1)' }
              }
            >
              {/* Animated shimmer */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -inset-full animate-[shimmer_6s_ease-in-out_infinite]"
                  style={{ background: 'linear-gradient(120deg, transparent 30%, rgba(0,245,255,0.03) 50%, transparent 70%)' }}
                />
              </div>
              {/* Corner glow accent */}
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,245,255,0.08) 0%, transparent 70%)' }} />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,112,243,0.06) 0%, transparent 70%)' }} />

              <div className="relative flex flex-col sm:flex-row items-center gap-5 md:gap-6">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, rgba(0,245,255,0.15), rgba(0,112,243,0.1))', border: '1px solid rgba(0,245,255,0.25)', boxShadow: '0 0 24px rgba(0,245,255,0.1)' }}
                >
                  <span className="text-3xl md:text-4xl">📄</span>
                </div>
                <div className="text-center sm:text-left flex-1">
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                    <span className="text-white">Liquid </span>
                    <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Resume</span>
                  </h1>
                  <p className="text-slate-400 text-sm md:text-base mt-1.5 max-w-xl leading-relaxed">
                    Upload once, morph for every job. AI rewrites your resume to match any JD&mdash;keywords injected, skills reordered, ATS-optimized.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    {[
                      { label: 'ATS-Ready', icon: '✓' },
                      { label: '18 Templates', icon: '◆' },
                      { label: '92% Match Avg', icon: '↗' },
                    ].map(s => (
                      <span key={s.label} className="flex items-center gap-1.5 text-[11px] font-medium text-cyan-300/80">
                        <span className="text-cyan-500/60">{s.icon}</span>
                        {s.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ═══ Primary Action Cards ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {/* Morph Existing Resume */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMode('morph')}
              className="relative p-6 md:p-8 rounded-2xl text-left transition-all group overflow-hidden"
              style={isLight
                ? { background: 'linear-gradient(135deg, rgba(0,112,243,0.06) 0%, rgba(99,102,241,0.04) 50%, rgba(255,255,255,1) 100%)', border: '1px solid rgba(0,112,243,0.12)' }
                : { background: 'linear-gradient(135deg, rgba(0,245,255,0.06) 0%, rgba(0,112,243,0.04) 50%, rgba(10,10,10,1) 100%)', border: '1px solid rgba(0,245,255,0.15)' }
              }
            >
              {/* Glow overlay on hover */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ boxShadow: 'inset 0 0 60px rgba(0,245,255,0.06), 0 0 40px rgba(0,245,255,0.05)' }} />
              {/* Top gradient line */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent rounded-t-2xl" />

              <div className="relative">
                <div className="w-14 h-14 rounded-xl bg-cyan-500/[0.12] border border-cyan-500/[0.25] flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <span className="text-2xl">🔄</span>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-white group-hover:text-cyan-300 transition-colors mb-2">
                  Morph Existing Resume
                </h2>
                <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                  Upload your resume, paste any job description, and get an ATS-optimized version in seconds.
                </p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {['Upload & Parse', 'JD Matching', 'ATS Score'].map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-cyan-500/[0.08] text-cyan-400 border border-cyan-500/[0.15]">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-cyan-400 group-hover:gap-3 transition-all">
                  Start Morphing
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </div>
              </div>
            </motion.button>

            {/* Build From Scratch */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMode('create')}
              className="relative p-6 md:p-8 rounded-2xl text-left transition-all group overflow-hidden"
              style={isLight
                ? { background: 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(16,185,129,0.04) 50%, rgba(255,255,255,1) 100%)', border: '1px solid rgba(34,197,94,0.12)' }
                : { background: 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(16,185,129,0.04) 50%, rgba(10,10,10,1) 100%)', border: '1px solid rgba(34,197,94,0.15)' }
              }
            >
              {/* Glow overlay on hover */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ boxShadow: 'inset 0 0 60px rgba(34,197,94,0.06), 0 0 40px rgba(34,197,94,0.05)' }} />
              {/* Top gradient line */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-green-500/60 to-transparent rounded-t-2xl" />

              <div className="relative">
                <div className="w-14 h-14 rounded-xl bg-green-500/[0.12] border border-green-500/[0.25] flex items-center justify-center mb-4 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300">
                  <span className="text-2xl">✨</span>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-white group-hover:text-green-300 transition-colors mb-2">
                  Build From Scratch
                </h2>
                <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                  AI generates summaries, achievements, and skill suggestions — build a polished resume step-by-step.
                </p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {['AI Writer', 'Step-by-Step', '18 Templates'].map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-green-500/[0.08] text-green-400 border border-green-500/[0.15]">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-green-400 group-hover:gap-3 transition-all">
                  Start Building
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </div>
              </div>
            </motion.button>
          </div>


          {/* Capabilities */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mb-10">
            <div className="flex items-center justify-center gap-6 flex-wrap py-4 px-6 rounded-xl bg-[#0A0A0A] border border-white/[0.06]">
              {[
                { icon: '📄', label: 'ATS-Safe Export' },
                { icon: '🔄', label: 'Smart Morph' },
                { icon: '📁', label: 'Multi-Format' },
                { icon: '🎯', label: 'Match Scoring' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-silver text-sm">
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Resume Vault - More Visual Appeal */}
          {versions.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl bg-gradient-to-br from-[#0A0A0A] to-[#111111] border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <span className="text-xl">📁</span>
                </div>
                <h3 className="text-lg font-bold text-white">My Resume Vault</h3>
                <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-silver">{versions.length} saved</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                {versions.map((v, i) => {
                  const morphScore = Math.floor(Math.random() * 30) + 70; // Simulated score 70-100
                  const scoreColor = morphScore >= 90 ? 'green' : morphScore >= 80 ? 'cyan' : 'yellow';
                  return (
                    <motion.button
                      key={v.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      onClick={() => loadVersionToMorph(v)}
                      className="p-4 rounded-xl bg-white/5 border border-white/10 text-left hover:border-cyan-500/50 hover:bg-white/10 transition-all flex flex-col relative group"
                    >
                      <button
                        onClick={(e) => handleDeleteVersion(e, v.id)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500/40 text-sm"
                      >×</button>

                      {/* Icon & Title */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-lg bg-${scoreColor}-500/20 flex items-center justify-center flex-shrink-0`}>
                          <span className="text-lg">📄</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate pr-6 text-sm">{v.version_name}</h4>
                          <p className="text-xs text-silver truncate">{new Date(v.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* Match Score Bar */}
                      <div className="mt-auto">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-silver">Match Score</span>
                          <span className={`text-xs font-bold text-${scoreColor}-400`}>{morphScore}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${morphScore}%` }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className={`h-full rounded-full bg-gradient-to-r from-${scoreColor}-500 to-${scoreColor}-400`}
                          />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirmId && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmId(null)} className="fixed inset-0 bg-black/70 z-50" />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[#0A0A0A] rounded-2xl p-6 max-w-md border border-white/10">
                  <h3 className="text-xl font-bold text-white mb-4">Delete Version?</h3>
                  <p className="text-silver mb-6">This action cannot be undone.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 rounded-xl bg-white/10 text-white">Cancel</button>
                    <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">Delete</button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ===== RENDER: Morph Flow =====
  if (mode === 'morph') {
    const displayResume = getDisplayResume();

    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header with Reset */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8 gap-3 pl-12 lg:pl-0">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Morph Your Resume</h1>
              <p className="text-slate-500 text-sm">AI-powered resume optimization</p>
            </div>
            <button onClick={resetAll} className="px-3 md:px-4 py-2 rounded-xl bg-[#0A0A0A] border border-white/[0.06] text-slate-500 hover:border-white/[0.12] hover:text-white transition-all text-sm">
              ← Start Over
            </button>
          </div>

          {/* Progress Steps */}
          <div className="max-w-5xl mx-auto mb-8">
            <div className="flex items-center justify-between">
              {[
                { id: 'upload', label: 'Upload', icon: '📄' },
                { id: 'jd', label: 'Job Description', icon: '💼' },
                { id: 'enhance', label: 'AI Enhance', icon: '✨', pro: true },
                { id: 'template', label: 'Template', icon: '🎨' },
                { id: 'preview', label: 'Download', icon: '⬇️' },
              ].map((s, i) => {
                const isEnhanceLocked = s.id === 'enhance' && tier !== 'pro';
                const canNavigate = s.id === 'upload'
                  || (s.id === 'jd' && hasResumeData(originalResume))
                  || (s.id === 'enhance' && tier === 'pro' && displayResume)
                  || ((s.id === 'template' || s.id === 'preview') && displayResume);
                return (
                <div key={s.id} className="flex items-center">
                  <button
                    onClick={() => {
                      if (isEnhanceLocked) { showToast('AI Enhancement is a Pro feature — $2.99/mo', 'info'); return; }
                      if (canNavigate) setStep(s.id as any);
                    }}
                    className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 rounded-lg md:rounded-xl transition-all text-xs md:text-sm ${
                      step === s.id ? (s.pro ? 'bg-emerald-500/[0.08] text-emerald-400 border border-emerald-500/[0.15]' : 'bg-cyan-500/[0.08] text-cyan-400 border border-cyan-500/[0.15]') :
                      isEnhanceLocked ? 'bg-[#0A0A0A] border border-white/[0.04] text-slate-600 cursor-not-allowed' :
                      canNavigate ? 'bg-[#0A0A0A] border border-white/[0.06] text-white hover:border-white/[0.12]' :
                      'bg-[#0A0A0A] border border-white/[0.04] text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <span>{isEnhanceLocked ? '🔒' : s.icon}</span>
                    <span className="hidden md:inline">{s.label}</span>
                    {s.pro && <span className={`hidden md:inline text-[8px] px-1 py-0.5 rounded ${tier === 'pro' ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400' : 'bg-white/5 border border-white/10 text-slate-500'} font-bold`}>PRO</span>}
                  </button>
                  {i < 4 && <div className={`w-4 md:w-10 h-px mx-1 ${s.id === 'enhance' || (s.id === 'jd' && tier === 'pro') ? 'bg-emerald-500/20' : 'bg-white/20'}`} />}
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

            {/* Step 2: JD */}
            {step === 'jd' && (
              <motion.div key="jd" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                  {/* Original Resume Preview */}
                  <div className="rounded-2xl bg-[#0A0A0A] border border-white/[0.06] p-4 md:p-6">
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/[0.08] border border-cyan-500/[0.15] flex items-center justify-center text-xl">📄</div>
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
                    <div className="p-4 rounded-xl bg-[#0A0A0A] border border-white/[0.06]">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">💼</span>
                        <label className="text-white font-semibold">Job Description</label>
                      </div>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the full job description here..."
                        className="w-full h-44 px-4 py-3 rounded-xl bg-[#0A0A0A] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none resize-none"
                      />
                    </div>

                    {/* Morph Intensity */}
                    <div className="p-4 rounded-xl bg-[#0A0A0A] border border-white/[0.06]">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-white font-semibold">Morph Intensity</label>
                        <span className={`text-lg font-bold px-3 py-1 rounded-lg ${morphPercentage < 50 ? 'bg-green-500/20 text-green-400' :
                          morphPercentage < 75 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>{morphPercentage}%</span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-0 h-3 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 opacity-30" />
                        <input
                          type="range"
                          min="25"
                          max="100"
                          value={morphPercentage}
                          onChange={(e) => setMorphPercentage(Number(e.target.value))}
                          className="relative w-full h-3 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #22c55e ${0}%, #22c55e ${((morphPercentage - 25) / 75) * 33}%, #eab308 ${((morphPercentage - 25) / 75) * 66}%, #ef4444 ${((morphPercentage - 25) / 75) * 100}%)`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs mt-2">
                        <span className="text-green-400 font-medium">🌱 Light Touch</span>
                        <span className="text-yellow-400 font-medium">⚡ Moderate</span>
                        <span className="text-red-400 font-medium">🔥 Aggressive</span>
                      </div>
                    </div>

                    {/* Page Count */}
                    <div>
                      <label className="block text-white font-semibold mb-2">Target Length</label>
                      <div className="flex gap-2">
                        {(['auto', 1, 2] as const).map((pc) => (
                          <button
                            key={pc}
                            onClick={() => setTargetPageCount(pc)}
                            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${targetPageCount === pc ? 'bg-cyan-500 text-white' : 'bg-white/10 text-silver hover:bg-white/20'
                              }`}
                          >
                            {pc === 'auto' ? 'Auto' : `${pc} Page${pc > 1 ? 's' : ''}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleMorph}
                      disabled={isLoading || !jobDescription.trim()}
                      className="w-full py-3 rounded-xl font-semibold text-sm bg-cyan-500/[0.08] border border-cyan-500/[0.15] text-cyan-400 hover:bg-cyan-500/[0.12] disabled:opacity-50 transition-all"
                    >
                      {isLoading ? '🧠 AI is Rewriting...' : '🧠 Morph Resume to Match JD'}
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
                        <h2 className="text-2xl font-bold text-white">✨ AI Enhancement</h2>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-bold">DUAL-AI: GPT × Gemini</span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">Check, fix, and generate — powered by two AI models</p>
                    </div>
                    <button onClick={() => setStep('template')} className="px-4 py-2 rounded-xl font-medium text-sm bg-cyan-500/[0.08] border border-cyan-500/[0.15] text-cyan-400 hover:bg-cyan-500/[0.12] transition-all">
                      Continue to Template →
                    </button>
                  </div>

                  {/* Animated Pipeline Indicator */}
                  {enhancePipelineStage > 0 && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-xl bg-[#0A0A0A] border border-emerald-500/[0.1] overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.02] via-cyan-500/[0.04] to-emerald-500/[0.02] animate-pulse" />
                      <div className="relative flex items-center gap-4">
                        {[
                          { label: 'GPT Writing', stage: 1 },
                          { label: 'Gemini Checking', stage: 2 },
                          { label: 'Refining', stage: 3 },
                        ].map((p) => (
                          <div key={p.stage} className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                              enhancePipelineStage > p.stage ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]' :
                              enhancePipelineStage === p.stage ? 'bg-cyan-400 animate-pulse shadow-[0_0_12px_rgba(6,182,212,0.8)]' :
                              'bg-white/10'
                            }`} />
                            <span className={`text-xs font-medium ${
                              enhancePipelineStage > p.stage ? 'text-emerald-400' :
                              enhancePipelineStage === p.stage ? 'text-cyan-400' :
                              'text-slate-600'
                            }`}>{p.label}</span>
                            {p.stage < 3 && <div className={`w-8 h-px ${enhancePipelineStage > p.stage ? 'bg-emerald-500/40' : 'bg-white/10'}`} />}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left: Resume Check + Auto-Fix */}
                    <div className="space-y-4">
                      {/* Resume Quality Check */}
                      <div className="rounded-xl bg-[#0A0A0A] border border-amber-500/[0.1] p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">🔍 Resume Quality Check</span>
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono">Gemini Flash</span>
                          </div>
                          <button onClick={() => { setEnhancePhase('checking'); setEnhancePipelineStage(2); checkResume(); }} disabled={resumeCheckLoading} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/15 transition-all disabled:opacity-50">
                            {resumeCheckLoading ? '🔍 Analyzing...' : resumeCheckResult ? '🔄 Re-check' : '▶ Run Check'}
                          </button>
                        </div>

                        {/* Check Loading Animation */}
                        {resumeCheckLoading && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 py-4">
                            {['Parsing resume structure...', 'Analyzing ATS compatibility...', 'Scoring keywords & formatting...', 'Generating suggestions...'].map((text, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.8 }} className="flex items-center gap-2">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full" />
                                <span className="text-xs text-amber-400/70">{text}</span>
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
                                  <span className="text-white/50">ATS Score</span>
                                  <span className="font-bold text-white">{resumeCheckResult.atsScore}/100</span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full mt-1 overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${resumeCheckResult.atsScore}%` }} transition={{ duration: 1, ease: 'easeOut' }} className={`h-full rounded-full ${resumeCheckResult.atsScore >= 80 ? 'bg-green-400' : resumeCheckResult.atsScore >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} />
                                </div>
                              </div>
                            </div>

                            {/* Section Scores */}
                            {resumeCheckResult.sectionScores && (
                              <div className="grid grid-cols-5 gap-1.5">
                                {Object.entries(resumeCheckResult.sectionScores).map(([key, val]: [string, any]) => (
                                  <div key={key} className="text-center p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                    <div className="text-[9px] text-white/40 capitalize">{key}</div>
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className={`text-sm font-bold ${val >= 80 ? 'text-green-400' : val >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{val}</motion.div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Suggestions */}
                            {resumeCheckResult.suggestions?.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-xs font-semibold text-white/50">💡 Suggestions</div>
                                {resumeCheckResult.suggestions.map((s: string, i: number) => (
                                  <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="text-[11px] text-white/60 flex gap-1.5 p-1.5 rounded bg-white/[0.01]">
                                    <span className="text-amber-400 shrink-0">→</span> {s}
                                  </motion.div>
                                ))}
                              </div>
                            )}

                            {/* Auto-Fix Button */}
                            <button
                              onClick={autoFixResume}
                              disabled={autoFixing}
                              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500/[0.1] to-cyan-500/[0.1] border border-emerald-500/[0.2] text-emerald-400 hover:from-emerald-500/[0.15] hover:to-cyan-500/[0.15] transition-all disabled:opacity-50 relative overflow-hidden"
                            >
                              {autoFixing ? (
                                <span className="flex items-center justify-center gap-2">
                                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>🔄</motion.span>
                                  Auto-Fixing with Dual-AI...
                                </span>
                              ) : (
                                <>🔧 Auto-Fix Resume (Apply All Suggestions)</>
                              )}
                              {autoFixing && <motion.div className="absolute bottom-0 left-0 h-0.5 bg-emerald-400" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 15, ease: 'linear' }} />}
                            </button>

                            {/* Skill Bridge CTA */}
                            {resumeCheckResult && !autoFixing && (
                              <button
                                onClick={() => router.push('/suite/skill-bridge')}
                                className="w-full py-2.5 rounded-xl text-[11px] font-semibold bg-gradient-to-r from-cyan-500/[0.06] to-emerald-500/[0.06] border border-cyan-500/[0.12] text-cyan-400 hover:from-cyan-500/[0.1] hover:to-emerald-500/[0.1] transition-all flex items-center justify-center gap-2"
                              >
                                <span>🌉</span> Bridge Your Gaps — Learn the Skills AI Enhanced
                              </button>
                            )}
                          </motion.div>
                        )}
                      </div>

                      {/* LinkedIn Builder */}
                      <div className="rounded-xl bg-[#0A0A0A] border border-blue-500/[0.1] p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">💼 LinkedIn Builder</span>
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono">Dual-AI</span>
                          </div>
                          <button onClick={() => { setEnhancePhase('linkedin'); setEnhancePipelineStage(1); generateLinkedIn(); }} disabled={linkedinLoading} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/15 transition-all disabled:opacity-50">
                            {linkedinLoading ? '💼 Generating...' : linkedinResult ? '🔄 Regenerate' : '▶ Generate'}
                          </button>
                        </div>

                        {linkedinLoading && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 py-4">
                            {['Analyzing career trajectory...', 'Optimizing for LinkedIn algorithm...', 'Crafting headline & summary...'].map((t, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 1 }} className="flex items-center gap-2">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full" />
                                <span className="text-xs text-blue-400/70">{t}</span>
                              </motion.div>
                            ))}
                          </motion.div>
                        )}

                        {linkedinResult && !linkedinLoading && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                            {linkedinResult.headline && (
                              <div>
                                <div className="text-[10px] font-semibold text-white/40 mb-1">Headline</div>
                                <div className="text-xs text-white/80 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">{linkedinResult.headline}</div>
                              </div>
                            )}
                            {linkedinResult.summary && (
                              <div>
                                <div className="text-[10px] font-semibold text-white/40 mb-1">About</div>
                                <div className="text-xs text-white/70 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] max-h-24 overflow-y-auto whitespace-pre-wrap">{linkedinResult.summary}</div>
                              </div>
                            )}
                            {linkedinResult.skills?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {linkedinResult.skills.map((s: string) => (
                                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/15 text-blue-300">{s}</span>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => {
                                const text = `Headline: ${linkedinResult.headline || ''}\n\nAbout:\n${linkedinResult.summary || ''}\n\nSkills: ${(linkedinResult.skills || []).join(', ')}`;
                                navigator.clipboard.writeText(text);
                                showToast('LinkedIn content copied!', '✅');
                              }}
                              className="w-full py-2 rounded-lg text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/15 transition-all"
                            >
                              📋 Copy All to Clipboard
                            </button>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* Right: Cover Letter */}
                    <div className="space-y-4">
                      <div className="rounded-xl bg-[#0A0A0A] border border-emerald-500/[0.1] p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-sm font-bold text-white">✉️ Cover Letter Generator</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">Dual-AI</span>
                        </div>

                        {/* Tone & Company */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {(['professional', 'friendly', 'bold'] as const).map(t => (
                            <button key={t} onClick={() => setCoverLetterTone(t)} className={`py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${coverLetterTone === t ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400' : 'bg-white/[0.02] border border-white/[0.06] text-slate-400 hover:border-white/[0.12]'}`}>
                              {t === 'professional' ? '🏢' : t === 'friendly' ? '😊' : '🔥'} {t}
                            </button>
                          ))}
                        </div>
                        <input type="text" value={coverLetterCompany} onChange={e => setCoverLetterCompany(e.target.value)} placeholder="Company name (optional)" className="w-full mb-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06] text-white text-sm placeholder-slate-500 focus:border-emerald-500/30 focus:outline-none" />

                        <button onClick={() => { setEnhancePhase('cover-letter'); setEnhancePipelineStage(1); generateCoverLetter(); }} disabled={coverLetterLoading} className="w-full py-2.5 rounded-xl font-semibold text-sm bg-emerald-500/[0.08] border border-emerald-500/[0.15] text-emerald-400 hover:bg-emerald-500/[0.12] transition-all disabled:opacity-50">
                          {coverLetterLoading ? '✍️ Generating...' : coverLetterResult ? '🔄 Regenerate' : '▶ Generate Cover Letter'}
                        </button>

                        {/* Cover Letter Loading Animation */}
                        {coverLetterLoading && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 py-4">
                            {['GPT drafting your cover letter...', 'Gemini reviewing quality...', 'Refining for perfection...'].map((t, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 1.5 }} className="flex items-center gap-2">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full" />
                                <span className="text-xs text-emerald-400/70">{t}</span>
                              </motion.div>
                            ))}
                          </motion.div>
                        )}

                        {/* Cover Letter Result */}
                        {coverLetterResult && !coverLetterLoading && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">Score: {coverLetterResult.score}/100</span>
                              {coverLetterResult.refined && <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">Dual-AI Refined ✨</span>}
                            </div>
                            <div className="text-xs text-white/70 whitespace-pre-wrap max-h-48 overflow-y-auto bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
                              {coverLetterResult.coverLetter}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button onClick={() => { navigator.clipboard.writeText(coverLetterResult.coverLetter); showToast('Copied!', '✅'); }} className="py-2 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15 transition-all">
                                📋 Copy
                              </button>
                              <button
                                onClick={() => {
                                  const currentResume = getDisplayResume();
                                  if (!currentResume) return;
                                  const updated = { ...currentResume, coverLetter: coverLetterResult.coverLetter };
                                  if (mode === 'morph') setMorphedResume(updated);
                                  else setBuildResume(updated);
                                  showToast('Cover letter attached to resume! It will appear in your download.', '✅');
                                }}
                                className="py-2 rounded-lg text-xs font-medium bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/15 transition-all"
                              >
                                📎 Attach to Resume
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {/* Quick Stats */}
                      <div className="rounded-xl bg-[#0A0A0A] border border-white/[0.06] p-4">
                        <div className="text-xs font-semibold text-white/40 mb-3">Session Summary</div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="p-2 rounded-lg bg-white/[0.02]">
                            <div className="text-lg font-bold text-white">{resumeCheckResult?.atsScore || '—'}</div>
                            <div className="text-[9px] text-white/40">ATS Score</div>
                          </div>
                          <div className="p-2 rounded-lg bg-white/[0.02]">
                            <div className="text-lg font-bold text-white">{coverLetterResult ? '✅' : '—'}</div>
                            <div className="text-[9px] text-white/40">Cover Letter</div>
                          </div>
                          <div className="p-2 rounded-lg bg-white/[0.02]">
                            <div className="text-lg font-bold text-white">{linkedinResult ? '✅' : '—'}</div>
                            <div className="text-[9px] text-white/40">LinkedIn</div>
                          </div>
                        </div>
                      </div>

                      {/* Navigation */}
                      <div className="flex gap-3">
                        <button onClick={() => setStep('jd')} className="flex-1 py-3 rounded-xl bg-[#0A0A0A] border border-white/[0.06] text-slate-400 hover:border-white/[0.12] text-sm font-medium transition-all">
                          ← Back to JD
                        </button>
                        <button onClick={() => setStep('template')} className="flex-1 py-3 rounded-xl bg-cyan-500/[0.08] border border-cyan-500/[0.15] text-cyan-400 font-bold text-sm hover:bg-cyan-500/[0.12] transition-all">
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
                      <div className="mb-6 p-4 rounded-xl bg-[#0A0A0A] border border-green-500/[0.15]">
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

                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-white">Choose a Professional Template</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/30">{TEMPLATES.filter(t => t.tier === 'free').length} Free</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{TEMPLATES.filter(t => t.tier === 'pro').length} Pro</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                      {TEMPLATES.map((template) => {
                        const isLocked = template.tier === 'pro' && tier !== 'pro';
                        return (
                        <motion.button
                          key={template.id}
                          onClick={() => {
                            if (isLocked) { showToast('Upgrade to Pro to unlock this template — $2.99/mo', 'info'); return; }
                            setSelectedTemplate(template);
                          }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`p-4 rounded-xl border transition-all text-left relative overflow-hidden ${isLocked ? 'border-white/[0.04] bg-[#0A0A0A] opacity-60' : selectedTemplate.id === template.id ? 'border-cyan-500/[0.2] bg-cyan-500/[0.03]' : 'border-white/[0.06] bg-[#0A0A0A] hover:border-white/[0.12]'
                            }`}
                        >
                          {isLocked && (
                            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-[8px] font-bold text-emerald-400 uppercase">PRO</div>
                          )}
                          <div className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center text-2xl" style={{ background: `linear-gradient(135deg, ${template.colors.primary}40, ${template.colors.accent}40)` }}>
                            {isLocked ? '🔒' : template.preview}
                          </div>
                          <h4 className="font-bold text-white">{template.name}</h4>
                          <p className="text-xs text-slate-500">{template.description}</p>
                        </motion.button>
                        );
                      })}
                    </div>

                    {/* Mini Preview */}
                    <div className="rounded-xl bg-[#0A0A0A] border border-white/[0.06] p-5">
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
                      <span className="text-5xl block mb-4">⚠️</span>
                      <h3 className="text-xl font-bold text-white mb-2">Resume Data Missing</h3>
                      <p className="text-silver mb-6">Something went wrong loading your resume.</p>
                      <div className="flex gap-3 justify-center">
                        <button onClick={() => setStep('jd')} className="px-6 py-3 rounded-xl bg-[#111111] text-white font-medium hover:bg-white/10">← Back to JD</button>
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
                      <div className="rounded-xl bg-[#0A0A0A] border border-white/[0.06] p-5">
                        <h3 className="font-semibold text-white mb-4">Actions</h3>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={downloadPDF} disabled={isLoading} className="py-2.5 rounded-xl font-semibold bg-cyan-500/[0.1] border border-cyan-500/[0.2] text-cyan-400 hover:bg-cyan-500/[0.15] transition-all disabled:opacity-50 text-sm">
                              {isLoading ? '⏳...' : '📄 PDF'}
                            </button>
                            <button onClick={downloadWord} disabled={isLoading} className="py-2.5 rounded-xl font-semibold bg-blue-500/[0.08] border border-blue-500/[0.15] text-blue-400 hover:bg-blue-500/[0.12] transition-all disabled:opacity-50 text-sm">
                              {isLoading ? '⏳...' : '📝 Word'}
                            </button>
                          </div>
                          <button onClick={() => setShowApplicationModal(true)} className="w-full py-3 rounded-xl font-semibold text-sm bg-green-500/[0.08] border border-green-500/[0.15] text-green-400 hover:bg-green-500/[0.12] transition-all">
                            🎯 Track Application
                          </button>
                          <button onClick={handleSave} className="w-full py-2.5 rounded-xl font-medium bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-white transition-all text-sm">💾 Save Version</button>
                          <button onClick={() => setStep('template')} className="w-full py-2.5 rounded-xl font-medium bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-slate-500 transition-all text-sm">🎨 Change Template</button>
                        </div>
                      </div>


                      {matchScore && (
                        <div className="rounded-xl bg-[#0A0A0A] border border-green-500/[0.15] p-5">
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

                      <div className="rounded-xl bg-[#0A0A0A] border border-white/[0.06] p-5">
                        <h4 className="font-semibold text-white mb-2">Template: {selectedTemplate.name}</h4>
                        <p className="text-xs text-slate-500">{selectedTemplate.description}</p>
                      </div>
                    </div>

                    <div className="lg:col-span-2">
                      <div className="rounded-xl bg-[#0A0A0A] border border-white/[0.06] p-4">
                        <div ref={resumeRef} className="bg-white rounded-xl overflow-hidden" style={{ minHeight: '800px' }}>
                          <ResumeTemplate resume={displayResume} template={selectedTemplate} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-lg mx-auto text-center py-12">
                    <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-8">
                      <span className="text-5xl block mb-4">⚠️</span>
                      <h3 className="text-xl font-bold text-white mb-2">No Resume Data</h3>
                      <button onClick={() => setStep('upload')} className="px-6 py-3 rounded-xl bg-cyan-500 text-white font-bold">Start Over</button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Application Modal */}
        <AnimatePresence>
          {showApplicationModal && displayResume && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowApplicationModal(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-lg rounded-3xl bg-[#0A0A0A] border border-white/10 overflow-hidden">
                  <div className="relative p-8 text-center border-b border-white/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-cyan-500/10" />
                    <div className="relative">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                        <span className="text-4xl">🎯</span>
                      </motion.div>
                      <h2 className="text-2xl font-bold text-white">Track this Application?</h2>
                      <p className="text-silver mt-2">We'll save this morphed resume with your application</p>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-silver mb-2">Company Name *</label>
                      <input type="text" value={applicationData.companyName} onChange={(e) => setApplicationData(prev => ({ ...prev, companyName: e.target.value }))} placeholder="e.g., Google" className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-green-500/50 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-silver mb-2">Job Title</label>
                      <input type="text" value={applicationData.jobTitle} onChange={(e) => setApplicationData(prev => ({ ...prev, jobTitle: e.target.value }))} placeholder={displayResume.title || 'Position'} className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-green-500/50 focus:outline-none" />
                    </div>
                  </div>
                  <div className="p-6 pt-0 flex gap-3">
                    <button onClick={() => { setShowApplicationModal(false); setStep('preview'); }} className="flex-1 px-4 py-3 rounded-xl bg-[#111111] text-silver hover:bg-white/10 transition-colors font-medium">Skip & Preview Resume</button>
                    <button onClick={handleCreateApplication} disabled={isLoading || !applicationData.companyName.trim()} className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-cyan-500 text-white font-bold disabled:opacity-50">
                      {isLoading ? 'Creating...' : '🎯 Track Application'}
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { if (!isLoading) { setShowSaveModal(false); setSaveVersionName(''); setSaveCompanyName(''); }}} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md rounded-3xl bg-[#0A0A0A] border border-white/10 overflow-hidden">
                  {saveSuccess ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }} className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                        <span className="text-4xl">✅</span>
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
                          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center"><span className="text-2xl">💾</span></div>
                          <div><h3 className="text-xl font-bold text-white">Save & Track</h3><p className="text-sm text-silver">Save this resume and track the application</p></div>
                        </div>
                      </div>
                      <div className="p-6 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">Company Name <span className="text-red-400">*</span></label>
                          <input type="text" value={saveCompanyName} onChange={(e) => setSaveCompanyName(e.target.value)} placeholder="e.g., Google, Meta, Stripe" autoFocus className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">Resume Version Name</label>
                          <input type="text" value={saveVersionName} onChange={(e) => setSaveVersionName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && saveCompanyName.trim() && saveVersionName.trim()) confirmSave(); }} placeholder="e.g., Senior PM Resume" className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                        </div>
                        <div className="rounded-xl bg-cyan-500/[0.06] border border-cyan-500/[0.12] p-3">
                          <p className="text-xs text-cyan-400/80">💡 This will save your resume <strong>and</strong> create an application entry you can track in the Applications tab.</p>
                        </div>
                      </div>
                      <div className="p-6 pt-0 flex gap-3">
                        <button onClick={() => { setShowSaveModal(false); setSaveVersionName(''); setSaveCompanyName(''); }} className="flex-1 px-4 py-3 rounded-xl bg-[#111111] text-silver hover:bg-white/10 transition-colors font-medium">Cancel</button>
                        <button onClick={confirmSave} disabled={!saveVersionName.trim() || !saveCompanyName.trim() || isLoading} className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold disabled:opacity-50 transition-all">
                          {isLoading ? '⏳ Saving...' : '💾 Save & Track'}
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
            <button onClick={resetAll} className="px-4 py-2 rounded-xl bg-[#0A0A0A] border border-white/[0.06] text-slate-500 hover:border-white/[0.12] hover:text-white transition-all text-sm">
              ← Start Over
            </button>
          </div>

          {/* Steps */}
          <AnimatePresence mode="wait">
            {step === 'upload' && (
              <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Personal Info */}
                  <div className="rounded-xl bg-[#0A0A0A] border border-white/[0.06] p-5">
                    <h3 className="text-base font-semibold text-white mb-4">Personal Information</h3>
                    <div className="space-y-4">
                      <input type="text" value={buildResume.name} onChange={(e) => setBuildResume(prev => ({ ...prev, name: e.target.value }))} placeholder="Full Name" className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      <input type="text" value={buildResume.title} onChange={(e) => setBuildResume(prev => ({ ...prev, title: e.target.value }))} placeholder="Job Title (e.g., Senior Software Engineer)" className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      <input type="email" value={buildResume.email} onChange={(e) => setBuildResume(prev => ({ ...prev, email: e.target.value }))} placeholder="Email" className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      <input type="text" value={buildResume.phone} onChange={(e) => setBuildResume(prev => ({ ...prev, phone: e.target.value }))} placeholder="Phone" className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      <input type="text" value={buildResume.location} onChange={(e) => setBuildResume(prev => ({ ...prev, location: e.target.value }))} placeholder="Location (e.g., San Francisco, CA)" className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="rounded-xl bg-[#0A0A0A] border border-white/[0.06] p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-base font-semibold text-white">Professional Summary</h3>
                      <button onClick={generateSummary} disabled={aiSuggesting} className="px-3 py-1 rounded-lg text-sm bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50">
                        {aiSuggesting ? '⏳ Generating...' : '✨ Generate with AI'}
                      </button>
                    </div>
                    <textarea value={buildResume.summary} onChange={(e) => setBuildResume(prev => ({ ...prev, summary: e.target.value }))} placeholder="Write a brief professional summary..." className="w-full h-48 px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none resize-none" />
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
                <div className="rounded-xl bg-[#0A0A0A] border border-white/[0.06] p-5 mb-6">
                  <h3 className="text-base font-semibold text-white mb-4">Work Experience</h3>
                  {buildResume.experience.map((exp, i) => (
                    <div key={i} className="mb-4 p-4 rounded-xl bg-[#111111] border border-white/10">
                      <div className="grid md:grid-cols-3 gap-3 mb-3">
                        <input type="text" value={exp.role} onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].role = e.target.value; setBuildResume(prev => ({ ...prev, experience: newExp })); }} placeholder="Job Title" className="px-3 py-2 rounded-lg bg-[#0A0A0A] border border-white/10 text-white text-sm placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                        <input type="text" value={exp.company} onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].company = e.target.value; setBuildResume(prev => ({ ...prev, experience: newExp })); }} placeholder="Company" className="px-3 py-2 rounded-lg bg-[#0A0A0A] border border-white/10 text-white text-sm placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                        <input type="text" value={exp.duration} onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].duration = e.target.value; setBuildResume(prev => ({ ...prev, experience: newExp })); }} placeholder="Duration (e.g., 2020-Present)" className="px-3 py-2 rounded-lg bg-[#0A0A0A] border border-white/10 text-white text-sm placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-slate-500">Achievements</span>
                        <button onClick={() => generateAchievements(i)} disabled={aiSuggesting} className="px-2 py-1 rounded text-xs bg-cyan-500/20 text-cyan-400">{aiSuggesting ? '⏳...' : '✨ Generate'}</button>
                      </div>
                      {exp.achievements.map((a, j) => (
                        <input key={j} type="text" value={a} onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].achievements[j] = e.target.value; setBuildResume(prev => ({ ...prev, experience: newExp })); }} placeholder={`Achievement ${j + 1}`} className="w-full mb-2 px-3 py-2 rounded-lg bg-[#0A0A0A] border border-white/10 text-white text-sm placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      ))}
                      <button onClick={() => { const newExp = [...buildResume.experience]; newExp[i].achievements.push(''); setBuildResume(prev => ({ ...prev, experience: newExp })); }} className="text-xs text-cyan-400">+ Add Achievement</button>
                    </div>
                  ))}
                  <button onClick={() => setBuildResume(prev => ({ ...prev, experience: [...prev.experience, { role: '', company: '', duration: '', achievements: [''] }] }))} className="w-full py-2.5 rounded-xl border border-dashed border-white/[0.08] text-slate-500 hover:border-cyan-500/20 hover:text-white transition-all text-sm">
                    + Add Experience
                  </button>
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setStep('upload')} className="px-4 py-2 rounded-xl bg-[#0A0A0A] border border-white/[0.06] text-slate-500 hover:border-white/[0.12] text-sm">← Back</button>
                  <button onClick={() => setStep(tier === 'pro' ? 'enhance' : 'template')} className="px-4 py-2 rounded-xl font-medium text-sm bg-cyan-500/[0.08] border border-cyan-500/[0.15] text-cyan-400 hover:bg-cyan-500/[0.12] transition-all">{tier === 'pro' ? '✨ AI Enhance →' : 'Choose Template →'}</button>
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
                            const isLocked = t.tier === 'pro' && tier !== 'pro';
                            return (
                            <button key={t.id} onClick={() => { if (isLocked) { showToast('Upgrade to Pro — $2.99/mo', 'info'); return; } setSelectedTemplate(t); }} className={`p-3 rounded-xl border text-left text-sm relative ${isLocked ? 'border-white/[0.04] bg-[#0A0A0A] opacity-60' : selectedTemplate.id === t.id ? 'border-cyan-500/[0.2] bg-cyan-500/[0.03]' : 'border-white/[0.06] bg-[#0A0A0A] hover:border-white/[0.12]'}`}>
                              {isLocked && <span className="absolute top-1 right-1 text-[8px] px-1 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-bold">PRO</span>}
                              <span className="text-xl block mb-1">{isLocked ? '🔒' : t.preview}</span>
                              <span className="text-white font-medium">{t.name}</span>
                            </button>
                            );
                          })}
                        </div>
                        <button onClick={() => setStep('preview')} className="w-full py-2.5 rounded-xl font-medium text-sm bg-cyan-500/[0.08] border border-cyan-500/[0.15] text-cyan-400 hover:bg-cyan-500/[0.12] transition-all">Preview & Download →</button>
                      </>
                    )}
                    {step === 'preview' && (
                      <div className="rounded-xl bg-[#0A0A0A] border border-white/[0.06] p-5 space-y-3">
                        <h3 className="font-semibold text-white mb-4">Actions</h3>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={downloadPDF} disabled={isLoading} className="py-2.5 rounded-xl font-semibold bg-cyan-500/[0.1] border border-cyan-500/[0.2] text-cyan-400 hover:bg-cyan-500/[0.15] transition-all disabled:opacity-50 text-sm">{isLoading ? '⏳...' : '📄 PDF'}</button>
                          <button onClick={downloadWord} disabled={isLoading} className="py-2.5 rounded-xl font-semibold bg-blue-500/[0.08] border border-blue-500/[0.15] text-blue-400 hover:bg-blue-500/[0.12] transition-all disabled:opacity-50 text-sm">{isLoading ? '⏳...' : '📝 Word'}</button>
                        </div>
                        <button onClick={handleSave} className="w-full py-2.5 rounded-xl font-medium bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-white transition-all text-sm">💾 Save Version</button>
                        <button onClick={() => setStep('template')} className="w-full py-2.5 rounded-xl font-medium bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-slate-500 transition-all text-sm">🎨 Change Template</button>
                      </div>
                    )}
                  </div>
                  <div className="lg:col-span-2">
                    <div className="rounded-xl bg-[#0A0A0A] border border-white/[0.06] p-4">
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { if (!isLoading) { setShowSaveModal(false); setSaveVersionName(''); setSaveCompanyName(''); }}} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md rounded-3xl bg-[#0A0A0A] border border-white/10 overflow-hidden">
                  {saveSuccess ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }} className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                        <span className="text-4xl">✅</span>
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
                          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center"><span className="text-2xl">💾</span></div>
                          <div><h3 className="text-xl font-bold text-white">Save & Track</h3><p className="text-sm text-silver">Save this resume and track the application</p></div>
                        </div>
                      </div>
                      <div className="p-6 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">Company Name <span className="text-red-400">*</span></label>
                          <input type="text" value={saveCompanyName} onChange={(e) => setSaveCompanyName(e.target.value)} placeholder="e.g., Google, Meta, Stripe" autoFocus className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">Resume Version Name</label>
                          <input type="text" value={saveVersionName} onChange={(e) => setSaveVersionName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && saveCompanyName.trim() && saveVersionName.trim()) confirmSave(); }} placeholder="e.g., Senior PM Resume" className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                        </div>
                        <div className="rounded-xl bg-cyan-500/[0.06] border border-cyan-500/[0.12] p-3">
                          <p className="text-xs text-cyan-400/80">💡 This will save your resume <strong>and</strong> create an application entry you can track in the Applications tab.</p>
                        </div>
                      </div>
                      <div className="p-6 pt-0 flex gap-3">
                        <button onClick={() => { setShowSaveModal(false); setSaveVersionName(''); setSaveCompanyName(''); }} className="flex-1 px-4 py-3 rounded-xl bg-[#111111] text-silver hover:bg-white/10 transition-colors font-medium">Cancel</button>
                        <button onClick={confirmSave} disabled={!saveVersionName.trim() || !saveCompanyName.trim() || isLoading} className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold disabled:opacity-50 transition-all">
                          {isLoading ? '⏳ Saving...' : '💾 Save & Track'}
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
function ResumeTemplate({ resume, template }: { resume: ResumeData; template: typeof TEMPLATES[0] }) {
  const { primary, accent, text } = template.colors;

  if (template.id === 'executive') {
    return (
      <div className="p-10 font-serif" style={{ color: text }}>
        <div className="border-b-4 pb-6 mb-6" style={{ borderColor: primary }}>
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: primary }}>{resume.name}</h1>
          <p className="text-xl mt-1" style={{ color: accent }}>{resume.title}</p>
          <div className="flex gap-6 mt-3 text-sm text-gray-600">
            {resume.email && <span>{resume.email}</span>}
            {resume.phone && <span>{resume.phone}</span>}
            {resume.location && <span>{resume.location}</span>}
          </div>
        </div>
        {resume.summary && (
          <div className="mb-6">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-2" style={{ color: primary }}>Professional Summary</h2>
            <p className="text-gray-700 leading-relaxed">{resume.summary}</p>
          </div>
        )}
        {resume.experience?.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3" style={{ color: primary }}>Experience</h2>
            {resume.experience.map((exp, i) => (
              <div key={i} className="mb-4">
                <div className="flex justify-between items-start">
                  <div><h3 className="font-bold text-gray-900">{exp.role}</h3><p className="text-gray-600">{exp.company}</p></div>
                  <span className="text-sm text-gray-500">{exp.duration}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {exp.achievements?.map((a, j) => <li key={j} className="text-sm text-gray-700 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-gray-400">{a}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-6">
          {resume.education?.length > 0 && (
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider mb-2" style={{ color: primary }}>Education</h2>
              {resume.education.map((edu, i) => (
                <div key={i} className="mb-2">
                  <p className="font-semibold text-gray-900">{edu.degree}</p>
                  <p className="text-sm text-gray-600">{edu.institution} • {edu.year}</p>
                </div>
              ))}
            </div>
          )}
          {resume.skills?.length > 0 && (
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider mb-2" style={{ color: primary }}>Skills</h2>
              {resume.skills.map((cat, i) => (
                <div key={i} className="mb-2">
                  <p className="text-sm font-semibold text-gray-700">{cat.category}</p>
                  <p className="text-sm text-gray-600">{cat.items?.join(' • ')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (template.id === 'modern') {
    return (
      <div className="flex min-h-full" style={{ color: text }}>
        <div className="w-1/3 p-6" style={{ backgroundColor: primary }}>
          <h1 className="text-2xl font-bold text-white mb-1">{resume.name}</h1>
          <p className="text-sm text-white/80 mb-6">{resume.title}</p>
          <div className="space-y-4 text-sm text-white/90">
            {resume.email && <div><p className="text-xs uppercase tracking-wider text-white/60 mb-1">Email</p>{resume.email}</div>}
            {resume.phone && <div><p className="text-xs uppercase tracking-wider text-white/60 mb-1">Phone</p>{resume.phone}</div>}
            {resume.location && <div><p className="text-xs uppercase tracking-wider text-white/60 mb-1">Location</p>{resume.location}</div>}
          </div>
          {resume.skills?.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs uppercase tracking-wider text-white/60 mb-3">Skills</h3>
              {resume.skills.map((cat, i) => (
                <div key={i} className="mb-3">
                  <p className="text-sm font-semibold text-white mb-1">{cat.category}</p>
                  <div className="flex flex-wrap gap-1">{cat.items?.map((s, j) => <span key={j} className="px-2 py-1 text-xs bg-white/20 rounded">{s}</span>)}</div>
                </div>
              ))}
            </div>
          )}
          {resume.education?.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs uppercase tracking-wider text-white/60 mb-3">Education</h3>
              {resume.education.map((edu, i) => (
                <div key={i} className="mb-3 text-sm text-white/90">
                  <p className="font-semibold">{edu.degree}</p>
                  <p className="text-white/70">{edu.institution}</p>
                  <p className="text-xs text-white/60">{edu.year}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="w-2/3 p-8">
          {resume.summary && (
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-2" style={{ color: primary }}>About Me</h2>
              <p className="text-gray-700 leading-relaxed">{resume.summary}</p>
            </div>
          )}
          {resume.experience?.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ color: primary }}>Experience</h2>
              {resume.experience.map((exp, i) => (
                <div key={i} className="mb-5 pl-4 border-l-2" style={{ borderColor: accent }}>
                  <div className="flex justify-between"><h3 className="font-bold text-gray-900">{exp.role}</h3><span className="text-sm text-gray-500">{exp.duration}</span></div>
                  <p className="text-sm text-gray-600 mb-2">{exp.company}</p>
                  <ul className="space-y-1">{exp.achievements?.map((a, j) => <li key={j} className="text-sm text-gray-700">• {a}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (template.id === 'minimal') {
    return (
      <div className="p-10" style={{ color: text }}>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light tracking-wide">{resume.name}</h1>
          <p className="text-gray-500 mt-1">{resume.title}</p>
          <div className="flex justify-center gap-4 mt-3 text-sm text-gray-500">
            {resume.email && <span>{resume.email}</span>}
            {resume.phone && <><span>•</span><span>{resume.phone}</span></>}
            {resume.location && <><span>•</span><span>{resume.location}</span></>}
          </div>
        </div>
        {resume.summary && <div className="border-t border-gray-200 pt-6 mb-6"><p className="text-gray-700 text-center max-w-2xl mx-auto">{resume.summary}</p></div>}
        {resume.experience?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm uppercase tracking-widest text-gray-400 mb-4">Experience</h2>
            {resume.experience.map((exp, i) => (
              <div key={i} className="mb-5">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-medium">{exp.role} <span className="font-normal text-gray-500">at {exp.company}</span></h3>
                  <span className="text-sm text-gray-400">{exp.duration}</span>
                </div>
                <ul className="mt-2 space-y-1">{exp.achievements?.map((a, j) => <li key={j} className="text-sm text-gray-600 pl-4 relative before:content-['–'] before:absolute before:left-0 before:text-gray-400">{a}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-8">
          {resume.education?.length > 0 && (
            <div>
              <h2 className="text-sm uppercase tracking-widest text-gray-400 mb-3">Education</h2>
              {resume.education.map((edu, i) => <div key={i} className="mb-2"><p className="font-medium">{edu.degree}</p><p className="text-sm text-gray-500">{edu.institution} • {edu.year}</p></div>)}
            </div>
          )}
          {resume.skills?.length > 0 && (
            <div>
              <h2 className="text-sm uppercase tracking-widest text-gray-400 mb-3">Skills</h2>
              <div className="flex flex-wrap gap-2">{resume.skills.flatMap(s => s.items).map((skill, i, arr) => <span key={i} className="text-sm text-gray-600">{skill}{i < arr.length - 1 ? ',' : ''}</span>)}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (template.id === 'creative') {
    return (
      <div className="p-8" style={{ color: text }}>
        <div className="flex items-start gap-6 mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white" style={{ backgroundColor: primary }}>
            {resume.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: primary }}>{resume.name}</h1>
            <p className="text-xl text-gray-600">{resume.title}</p>
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              {resume.email && <span>📧 {resume.email}</span>}
              {resume.phone && <span>📱 {resume.phone}</span>}
              {resume.location && <span>📍 {resume.location}</span>}
            </div>
          </div>
        </div>
        {resume.summary && <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: `${primary}10` }}><p className="text-gray-700">{resume.summary}</p></div>}
        {resume.experience?.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: primary }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: primary }}>💼</span>Experience
            </h2>
            {resume.experience.map((exp, i) => (
              <div key={i} className="mb-4 p-4 rounded-xl bg-gray-50">
                <div className="flex justify-between"><div><h3 className="font-bold text-gray-900">{exp.role}</h3><p className="text-sm" style={{ color: accent }}>{exp.company}</p></div><span className="text-sm px-3 py-1 rounded-full bg-white text-gray-500">{exp.duration}</span></div>
                <ul className="mt-3 space-y-1">{exp.achievements?.map((a, j) => <li key={j} className="text-sm text-gray-700 flex items-start gap-2"><span style={{ color: accent }}>▸</span>{a}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-6">
          {resume.education?.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: primary }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: primary }}>🎓</span>Education
              </h2>
              {resume.education.map((edu, i) => <div key={i} className="mb-2 p-3 rounded-lg bg-gray-50"><p className="font-semibold">{edu.degree}</p><p className="text-sm text-gray-600">{edu.institution} • {edu.year}</p></div>)}
            </div>
          )}
          {resume.skills?.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: primary }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: primary }}>⚡</span>Skills
              </h2>
              <div className="flex flex-wrap gap-2">{resume.skills.flatMap(s => s.items).map((skill, i) => <span key={i} className="px-3 py-1 rounded-full text-sm text-white" style={{ backgroundColor: accent }}>{skill}</span>)}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (template.id === 'harvard') {
    return (
      <div className="p-10 font-serif" style={{ color: text }}>
        <div className="text-center border-b-2 pb-5 mb-6" style={{ borderColor: primary }}>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: primary }}>{resume.name}</h1>
          <div className="flex justify-center gap-3 mt-2 text-sm text-gray-600">
            {resume.email && <span>{resume.email}</span>}
            {resume.phone && <><span>|</span><span>{resume.phone}</span></>}
            {resume.location && <><span>|</span><span>{resume.location}</span></>}
          </div>
        </div>
        {resume.education?.length > 0 && (
          <div className="mb-5">
            <h2 className="text-sm font-bold uppercase tracking-wider border-b pb-1 mb-3" style={{ color: primary, borderColor: `${primary}40` }}>Education</h2>
            {resume.education.map((edu, i) => (
              <div key={i} className="flex justify-between mb-2">
                <div><p className="font-bold text-gray-900">{edu.institution}</p><p className="text-sm italic text-gray-700">{edu.degree}</p></div>
                <span className="text-sm text-gray-500 text-right">{edu.year}</span>
              </div>
            ))}
          </div>
        )}
        {resume.experience?.length > 0 && (
          <div className="mb-5">
            <h2 className="text-sm font-bold uppercase tracking-wider border-b pb-1 mb-3" style={{ color: primary, borderColor: `${primary}40` }}>Experience</h2>
            {resume.experience.map((exp, i) => (
              <div key={i} className="mb-4">
                <div className="flex justify-between items-baseline">
                  <div><span className="font-bold text-gray-900">{exp.company}</span><span className="text-gray-500">, </span><span className="italic text-gray-700">{exp.role}</span></div>
                  <span className="text-sm text-gray-500">{exp.duration}</span>
                </div>
                <ul className="mt-1.5 space-y-1">{exp.achievements?.map((a, j) => <li key={j} className="text-sm text-gray-700 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-gray-400">{a}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
        {resume.skills?.length > 0 && (
          <div className="mb-5">
            <h2 className="text-sm font-bold uppercase tracking-wider border-b pb-1 mb-3" style={{ color: primary, borderColor: `${primary}40` }}>Skills & Interests</h2>
            {resume.skills.map((cat, i) => (
              <div key={i} className="flex gap-2 mb-1.5 text-sm">
                <span className="font-bold text-gray-700 min-w-[120px]">{cat.category}:</span>
                <span className="text-gray-600">{cat.items?.join(', ')}</span>
              </div>
            ))}
          </div>
        )}
        {resume.summary && (
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider border-b pb-1 mb-3" style={{ color: primary, borderColor: `${primary}40` }}>Summary</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{resume.summary}</p>
          </div>
        )}
      </div>
    );
  }

  if (template.id === 'cascade') {
    return (
      <div className="flex min-h-full" style={{ color: text }}>
        <div className="w-[38%] p-7" style={{ backgroundColor: primary }}>
          <div className="mb-8">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold text-white mb-4">
              {resume.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <h1 className="text-xl font-bold text-white">{resume.name}</h1>
            <p className="text-sm text-white/70 mt-1">{resume.title}</p>
          </div>
          <div className="space-y-5 text-sm">
            <div>
              <h3 className="text-xs uppercase tracking-widest text-white/50 mb-3 font-semibold">Contact</h3>
              <div className="space-y-2 text-white/80">
                {resume.email && <p className="break-all">{resume.email}</p>}
                {resume.phone && <p>{resume.phone}</p>}
                {resume.location && <p>{resume.location}</p>}
              </div>
            </div>
            {resume.skills?.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-widest text-white/50 mb-3 font-semibold">Skills</h3>
                {resume.skills.map((cat, i) => (
                  <div key={i} className="mb-3">
                    <p className="text-white font-semibold text-xs mb-1.5">{cat.category}</p>
                    <div className="space-y-1.5">{cat.items?.map((s, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${70 + Math.random() * 30}%`, backgroundColor: accent }} /></div>
                        <span className="text-xs text-white/70 min-w-0">{s}</span>
                      </div>
                    ))}</div>
                  </div>
                ))}
              </div>
            )}
            {resume.education?.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-widest text-white/50 mb-3 font-semibold">Education</h3>
                {resume.education.map((edu, i) => (
                  <div key={i} className="mb-3 text-white/80">
                    <p className="font-semibold text-white text-sm">{edu.degree}</p>
                    <p className="text-xs">{edu.institution}</p>
                    <p className="text-xs text-white/50">{edu.year}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="w-[62%] p-8">
          {resume.summary && (
            <div className="mb-7">
              <h2 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: primary }}>Profile</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{resume.summary}</p>
            </div>
          )}
          {resume.experience?.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: primary }}>Work Experience</h2>
              {resume.experience.map((exp, i) => (
                <div key={i} className="mb-5 relative pl-5">
                  <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
                  {i < resume.experience.length - 1 && <div className="absolute left-[3px] top-4 bottom-0 w-px bg-gray-200" />}
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-bold text-gray-900">{exp.role}</h3>
                    <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">{exp.duration}</span>
                  </div>
                  <p className="text-sm mb-1.5" style={{ color: accent }}>{exp.company}</p>
                  <ul className="space-y-1">{exp.achievements?.map((a, j) => <li key={j} className="text-sm text-gray-600">• {a}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (template.id === 'elegant') {
    return (
      <div className="p-10 font-serif" style={{ color: text }}>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-light tracking-[0.2em] uppercase" style={{ color: primary }}>{resume.name}</h1>
          <div className="flex justify-center items-center gap-4 mt-3">
            <div className="h-px flex-1 max-w-[80px]" style={{ backgroundColor: accent }} />
            <p className="text-sm tracking-wider uppercase" style={{ color: accent }}>{resume.title}</p>
            <div className="h-px flex-1 max-w-[80px]" style={{ backgroundColor: accent }} />
          </div>
          <div className="flex justify-center gap-6 mt-4 text-xs text-gray-500 tracking-wider">
            {resume.email && <span>{resume.email}</span>}
            {resume.phone && <span>{resume.phone}</span>}
            {resume.location && <span>{resume.location}</span>}
          </div>
        </div>
        {resume.summary && (
          <div className="mb-8 max-w-xl mx-auto text-center">
            <p className="text-sm text-gray-600 leading-relaxed italic">&ldquo;{resume.summary}&rdquo;</p>
          </div>
        )}
        {resume.experience?.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-5">
              <div className="h-px flex-1" style={{ backgroundColor: `${accent}40` }} />
              <h2 className="text-xs uppercase tracking-[0.3em] font-semibold" style={{ color: primary }}>Experience</h2>
              <div className="h-px flex-1" style={{ backgroundColor: `${accent}40` }} />
            </div>
            {resume.experience.map((exp, i) => (
              <div key={i} className="mb-5">
                <div className="flex justify-between items-baseline">
                  <div><h3 className="font-semibold text-gray-900">{exp.role}</h3><p className="text-sm" style={{ color: accent }}>{exp.company}</p></div>
                  <span className="text-xs tracking-wider text-gray-400">{exp.duration}</span>
                </div>
                <ul className="mt-2 space-y-1">{exp.achievements?.map((a, j) => <li key={j} className="text-sm text-gray-600 pl-3 relative before:content-['—'] before:absolute before:left-0 before:text-gray-300 before:text-xs">{a}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-8">
          {resume.education?.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1" style={{ backgroundColor: `${accent}40` }} />
                <h2 className="text-xs uppercase tracking-[0.3em] font-semibold" style={{ color: primary }}>Education</h2>
                <div className="h-px flex-1" style={{ backgroundColor: `${accent}40` }} />
              </div>
              {resume.education.map((edu, i) => <div key={i} className="mb-3 text-center"><p className="font-semibold text-gray-900 text-sm">{edu.degree}</p><p className="text-xs text-gray-500">{edu.institution} — {edu.year}</p></div>)}
            </div>
          )}
          {resume.skills?.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1" style={{ backgroundColor: `${accent}40` }} />
                <h2 className="text-xs uppercase tracking-[0.3em] font-semibold" style={{ color: primary }}>Expertise</h2>
                <div className="h-px flex-1" style={{ backgroundColor: `${accent}40` }} />
              </div>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">{resume.skills.flatMap(s => s.items).map((skill, i) => <span key={i} className="text-xs text-gray-500 tracking-wider">{skill}</span>)}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (template.id === 'compact') {
    return (
      <div className="p-6 text-xs" style={{ color: text }}>
        <div className="flex justify-between items-end border-b-2 pb-3 mb-4" style={{ borderColor: primary }}>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: primary }}>{resume.name}</h1>
            <p className="text-sm text-gray-600 mt-0.5">{resume.title}</p>
          </div>
          <div className="text-right text-gray-500 space-y-0.5">
            {resume.email && <p>{resume.email}</p>}
            {resume.phone && <p>{resume.phone}</p>}
            {resume.location && <p>{resume.location}</p>}
          </div>
        </div>
        {resume.summary && (
          <div className="mb-3 p-2.5 rounded" style={{ backgroundColor: `${primary}08` }}>
            <p className="text-gray-700 leading-relaxed">{resume.summary}</p>
          </div>
        )}
        {resume.skills?.length > 0 && (
          <div className="mb-3">
            <h2 className="font-bold uppercase tracking-wider mb-1.5 text-[10px]" style={{ color: primary }}>Core Competencies</h2>
            <div className="flex flex-wrap gap-1">{resume.skills.flatMap(s => s.items).map((skill, i) => <span key={i} className="px-2 py-0.5 rounded text-[10px] border" style={{ borderColor: `${primary}30`, color: primary }}>{skill}</span>)}</div>
          </div>
        )}
        {resume.experience?.length > 0 && (
          <div className="mb-3">
            <h2 className="font-bold uppercase tracking-wider mb-2 text-[10px]" style={{ color: primary }}>Professional Experience</h2>
            {resume.experience.map((exp, i) => (
              <div key={i} className="mb-3">
                <div className="flex justify-between items-baseline">
                  <div className="flex items-baseline gap-2"><h3 className="font-bold text-gray-900 text-sm">{exp.role}</h3><span className="text-gray-500">@ {exp.company}</span></div>
                  <span className="text-gray-400 whitespace-nowrap ml-2">{exp.duration}</span>
                </div>
                <ul className="mt-1 space-y-0.5 columns-1">{exp.achievements?.map((a, j) => (
                  <li key={j} className="text-gray-600 pl-3 relative">
                    <span className="absolute left-0 top-0.5 w-1 h-1 rounded-full" style={{ backgroundColor: accent }} />
                    {a}
                  </li>
                ))}</ul>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {resume.education?.length > 0 && (
            <div>
              <h2 className="font-bold uppercase tracking-wider mb-1.5 text-[10px]" style={{ color: primary }}>Education</h2>
              {resume.education.map((edu, i) => <div key={i} className="mb-1.5"><p className="font-semibold text-gray-900">{edu.degree}</p><p className="text-gray-500">{edu.institution} • {edu.year}</p></div>)}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (template.id === 'nordic') {
    return (
      <div className="p-12" style={{ color: text }}>
        <div className="mb-10">
          <h1 className="text-3xl font-light tracking-wide">{resume.name}</h1>
          <p className="text-lg mt-1" style={{ color: accent }}>{resume.title}</p>
          <div className="flex gap-6 mt-4 text-sm" style={{ color: accent }}>
            {resume.email && <span>{resume.email}</span>}
            {resume.phone && <span>{resume.phone}</span>}
            {resume.location && <span>{resume.location}</span>}
          </div>
          <div className="mt-6 h-px w-full" style={{ backgroundColor: `${accent}30` }} />
        </div>
        {resume.summary && (
          <div className="mb-10">
            <p className="text-sm leading-7 max-w-[85%]" style={{ color: `${text}cc` }}>{resume.summary}</p>
          </div>
        )}
        {resume.experience?.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[11px] uppercase tracking-[0.25em] font-medium mb-6" style={{ color: accent }}>Experience</h2>
            {resume.experience.map((exp, i) => (
              <div key={i} className="mb-6 grid grid-cols-[140px_1fr] gap-6">
                <div className="text-sm" style={{ color: accent }}>
                  <p>{exp.duration}</p>
                  <p className="text-xs mt-0.5">{exp.company}</p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">{exp.role}</h3>
                  <ul className="space-y-1.5">{exp.achievements?.map((a, j) => <li key={j} className="text-sm text-gray-600 leading-relaxed">{a}</li>)}</ul>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-[140px_1fr] gap-6">
          {resume.education?.length > 0 && (
            <>
              <div><h2 className="text-[11px] uppercase tracking-[0.25em] font-medium" style={{ color: accent }}>Education</h2></div>
              <div className="space-y-3">
                {resume.education.map((edu, i) => <div key={i}><p className="font-medium text-gray-900">{edu.degree}</p><p className="text-sm text-gray-500">{edu.institution} — {edu.year}</p></div>)}
              </div>
            </>
          )}
        </div>
        {resume.skills?.length > 0 && (
          <div className="mt-8 grid grid-cols-[140px_1fr] gap-6">
            <div><h2 className="text-[11px] uppercase tracking-[0.25em] font-medium" style={{ color: accent }}>Skills</h2></div>
            <div className="flex flex-wrap gap-3">
              {resume.skills.flatMap(s => s.items).map((skill, i) => <span key={i} className="text-sm text-gray-600">{skill}</span>)}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Technical (default)
  return (
    <div className="p-8 font-mono text-sm" style={{ color: text }}>
      <div className="border-b-2 pb-4 mb-6" style={{ borderColor: primary }}>
        <h1 className="text-2xl font-bold" style={{ color: primary }}>{resume.name}</h1>
        <p className="text-lg" style={{ color: accent }}>{resume.title}</p>
        <div className="flex gap-4 mt-2 text-gray-600">
          {resume.email && <span>{resume.email}</span>}
          {resume.phone && <><span>|</span><span>{resume.phone}</span></>}
          {resume.location && <><span>|</span><span>{resume.location}</span></>}
        </div>
      </div>
      {resume.summary && (
        <div className="mb-6">
          <h2 className="font-bold uppercase tracking-wider mb-2" style={{ color: primary }}>// Summary</h2>
          <p className="text-gray-700 bg-gray-50 p-3 rounded border-l-4" style={{ borderColor: accent }}>{resume.summary}</p>
        </div>
      )}
      {resume.skills?.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold uppercase tracking-wider mb-3" style={{ color: primary }}>// Technical Skills</h2>
          <div className="grid grid-cols-2 gap-3">
            {resume.skills.map((cat, i) => <div key={i} className="p-3 bg-gray-50 rounded"><p className="font-bold text-gray-700 mb-1">{cat.category}:</p><p className="text-gray-600">{cat.items?.join(', ')}</p></div>)}
          </div>
        </div>
      )}
      {resume.experience?.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold uppercase tracking-wider mb-3" style={{ color: primary }}>// Experience</h2>
          {resume.experience.map((exp, i) => (
            <div key={i} className="mb-4 p-4 bg-gray-50 rounded">
              <div className="flex justify-between items-start mb-2">
                <div><h3 className="font-bold text-gray-900">{exp.role}</h3><p className="text-gray-600">{exp.company}</p></div>
                <code className="px-2 py-1 bg-gray-200 rounded text-xs">{exp.duration}</code>
              </div>
              <ul className="space-y-1">{exp.achievements?.map((a, j) => <li key={j} className="text-gray-700 pl-4 relative before:content-['→'] before:absolute before:left-0">{a}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
      {resume.education?.length > 0 && (
        <div>
          <h2 className="font-bold uppercase tracking-wider mb-3" style={{ color: primary }}>// Education</h2>
          {resume.education.map((edu, i) => <div key={i} className="mb-2"><p className="font-bold">{edu.degree}</p><p className="text-gray-600">{edu.institution} ({edu.year})</p></div>)}
        </div>
      )}
    </div>
  );

  // ── GENERIC PREMIUM TEMPLATES ──
  // Handles: ats-optimized, double-column, infographic, deloitte, faang, startup, federal, academic
  const isSidebar = ['double-column', 'cascade', 'infographic', 'deloitte'].includes(template.id);
  const isTimeline = ['faang', 'startup', 'academic'].includes(template.id);

  if (isSidebar) {
    return (
      <div className="flex min-h-[800px]" style={{ color: text }}>
        {/* Sidebar */}
        <div className="w-[220px] p-6 shrink-0 text-white" style={{ backgroundColor: primary }}>
          <h1 className="text-xl font-bold mb-1">{resume.name}</h1>
          <p className="text-sm opacity-80 mb-4">{resume.title}</p>
          <div className="text-xs space-y-1 opacity-70 mb-6">
            {resume.email && <p>✉ {resume.email}</p>}
            {resume.phone && <p>✆ {resume.phone}</p>}
            {resume.location && <p>📍 {resume.location}</p>}
          </div>
          {resume.skills?.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3 opacity-60">Skills</h2>
              {resume.skills.map((cat, i) => (
                <div key={i} className="mb-3">
                  <p className="text-xs font-semibold opacity-90 mb-1.5">{cat.category}</p>
                  {cat.items?.map((item, j) => (
                    <div key={j} className="mb-1">
                      <p className="text-xs opacity-70">{item}</p>
                      <div className="w-full h-1 rounded-full bg-white/10 mt-0.5">
                        <div className="h-full rounded-full" style={{ width: `${70 + Math.random() * 25}%`, backgroundColor: accent }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {resume.education?.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3 opacity-60">Education</h2>
              {resume.education.map((edu, i) => <div key={i} className="mb-2 text-xs"><p className="font-semibold opacity-90">{edu.degree}</p><p className="opacity-60">{edu.institution} • {edu.year}</p></div>)}
            </div>
          )}
        </div>
        {/* Main Content */}
        <div className="flex-1 p-8">
          {resume.summary && (
            <div className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: primary }}>Profile</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{resume.summary}</p>
            </div>
          )}
          {resume.experience?.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: primary }}>Experience</h2>
              {resume.experience.map((exp, i) => (
                <div key={i} className="mb-5 pl-4 border-l-2" style={{ borderColor: accent }}>
                  <div className="flex justify-between items-baseline"><h3 className="font-bold text-gray-900">{exp.role}</h3><span className="text-xs text-gray-400">{exp.duration}</span></div>
                  <p className="text-sm text-gray-500 mb-1">{exp.company}</p>
                  <ul className="space-y-1">{exp.achievements?.map((a, j) => <li key={j} className="text-sm text-gray-700 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-gray-400">{a}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default: Clean single-column layout for ats-optimized, federal, startup, faang, academic
  return (
    <div className="p-10" style={{ color: text }}>
      <div className="mb-6 pb-4 border-b-2" style={{ borderColor: primary }}>
        <h1 className="text-2xl font-bold" style={{ color: primary }}>{resume.name}</h1>
        <p className="text-sm mt-0.5" style={{ color: accent }}>{resume.title}</p>
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
          {resume.email && <span>{resume.email}</span>}
          {resume.phone && <span>•  {resume.phone}</span>}
          {resume.location && <span>•  {resume.location}</span>}
          {resume.linkedin && <span>•  {resume.linkedin}</span>}
        </div>
      </div>
      {resume.summary && (
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: primary }}>
            {template.id === 'academic' ? 'Research Statement' : template.id === 'federal' ? 'Professional Summary' : 'Summary'}
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">{resume.summary}</p>
        </div>
      )}
      {resume.experience?.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: primary }}>
            {template.id === 'academic' ? 'Academic Positions' : 'Professional Experience'}
          </h2>
          {resume.experience.map((exp, i) => (
            <div key={i} className={`mb-4 ${isTimeline ? 'pl-4 border-l-2' : ''}`} style={isTimeline ? { borderColor: accent } : {}}>
              <div className="flex justify-between items-baseline">
                <h3 className="font-bold text-gray-900">{exp.role}</h3>
                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: `${accent}15`, color: accent }}>{exp.duration}</span>
              </div>
              <p className="text-sm text-gray-500 mb-1">{exp.company}</p>
              <ul className="space-y-1">{exp.achievements?.map((a, j) => <li key={j} className="text-sm text-gray-700 pl-3 relative before:content-['▸'] before:absolute before:left-0" style={{ '--tw-content': `'▸'` } as any}>{a}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
      {resume.skills?.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: primary }}>
            {template.id === 'ats-optimized' ? 'Core Competencies' : 'Skills'}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {resume.skills.map((cat, i) => (
              <div key={i} className="p-3 rounded" style={{ backgroundColor: `${primary}08` }}>
                <p className="text-xs font-bold mb-1" style={{ color: primary }}>{cat.category}</p>
                <p className="text-xs text-gray-600">{cat.items?.join(' • ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {resume.education?.length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: primary }}>Education</h2>
          {resume.education.map((edu, i) => (
            <div key={i} className="mb-2">
              <p className="font-semibold text-gray-900">{edu.degree}</p>
              <p className="text-sm text-gray-500">{edu.institution} • {edu.year}</p>
              {edu.details && <p className="text-xs text-gray-400 mt-0.5">{edu.details}</p>}
            </div>
          ))}
        </div>
      )}
      {template.id === 'federal' && resume.certifications && resume.certifications.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: primary }}>Certifications & Clearances</h2>
          <ul className="space-y-1">{resume.certifications.map((c, i) => <li key={i} className="text-sm text-gray-700">✓ {c}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
