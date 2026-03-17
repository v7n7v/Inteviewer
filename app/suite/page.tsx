'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import SlidingTips from '@/components/SlidingTips';

// ═══════════════════════════════════════
// RESUME MORPH ANIMATION
// ═══════════════════════════════════════
const resumeRoles = [
  {
    title: 'Frontend Engineer',
    company: 'Vercel',
    skills: ['React', 'TypeScript', 'Next.js', 'CSS'],
    color: '#00F5FF',
  },
  {
    title: 'Data Scientist',
    company: 'OpenAI',
    skills: ['Python', 'PyTorch', 'SQL', 'MLOps'],
    color: '#22C55E',
  },
  {
    title: 'Product Manager',
    company: 'Stripe',
    skills: ['Strategy', 'Analytics', 'Agile', 'UX'],
    color: '#F59E0B',
  },
];

function ResumeCardAnimation() {
  const [roleIndex, setRoleIndex] = useState(0);
  const [matchScore, setMatchScore] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRoleIndex((prev) => (prev + 1) % resumeRoles.length);
      setMatchScore(0);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Animate match score ticking up
  useEffect(() => {
    const target = 85 + Math.floor(Math.random() * 12);
    let current = 0;
    const tick = setInterval(() => {
      current += 2;
      if (current >= target) {
        current = target;
        clearInterval(tick);
      }
      setMatchScore(current);
    }, 25);
    return () => clearInterval(tick);
  }, [roleIndex]);

  const role = resumeRoles[roleIndex];

  return (
    <div className="relative w-full h-full min-h-[180px] flex items-center justify-center">
      {/* Mini resume document */}
      <div className="w-full max-w-[200px] rounded-lg bg-[#0D0D0D] border border-white/[0.06] overflow-hidden shadow-2xl shadow-black/40">
        {/* Doc header */}
        <div className="px-3 py-2 border-b border-white/[0.04]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-white/20 to-white/5" />
            <div>
              <div className="h-1.5 w-14 rounded-full bg-white/20" />
              <div className="h-1 w-10 rounded-full bg-white/10 mt-0.5" />
            </div>
          </div>
        </div>

        {/* Doc body with morphing content */}
        <div className="px-3 py-2 space-y-1.5">
          {/* Target role label */}
          <AnimatePresence mode="wait">
            <motion.div
              key={role.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-1.5"
            >
              <div className="h-1 w-1 rounded-full" style={{ backgroundColor: role.color }} />
              <span className="text-[9px] font-medium" style={{ color: role.color }}>
                {role.title}
              </span>
            </motion.div>
          </AnimatePresence>

          {/* Fake text lines */}
          <div className="space-y-1">
            <div className="h-1 w-full rounded-full bg-white/[0.06]" />
            <div className="h-1 w-4/5 rounded-full bg-white/[0.06]" />
            <div className="h-1 w-3/5 rounded-full bg-white/[0.04]" />
          </div>

          {/* Morphing skill tags */}
          <AnimatePresence mode="wait">
            <motion.div
              key={role.title}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-wrap gap-1 pt-1"
            >
              {role.skills.map((skill, i) => (
                <motion.span
                  key={skill}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className="px-1.5 py-0.5 rounded text-[7px] font-medium"
                  style={{
                    backgroundColor: `${role.color}12`,
                    color: role.color,
                    border: `1px solid ${role.color}25`,
                  }}
                >
                  {skill}
                </motion.span>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* More fake lines */}
          <div className="space-y-1 pt-1">
            <div className="h-1 w-full rounded-full bg-white/[0.04]" />
            <div className="h-1 w-2/3 rounded-full bg-white/[0.04]" />
          </div>
        </div>

        {/* Match score bar */}
        <div className="px-3 py-2 border-t border-white/[0.04]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] text-slate-500">ATS Match</span>
            <motion.span
              className="text-[10px] font-bold"
              style={{ color: role.color }}
            >
              {matchScore}%
            </motion.span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: role.color }}
              initial={{ width: '0%' }}
              animate={{ width: `${matchScore}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>
      </div>

      {/* Floating target label */}
      <AnimatePresence mode="wait">
        <motion.div
          key={role.company}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="absolute -right-1 top-1/2 -translate-y-1/2"
        >
          <div
            className="px-2 py-1 rounded-md text-[8px] font-medium border"
            style={{
              backgroundColor: `${role.color}08`,
              borderColor: `${role.color}20`,
              color: role.color,
            }}
          >
            → {role.company}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const resumeFeatures = [
  { icon: '📄', label: 'ATS-Safe PDF' },
  { icon: '🔄', label: 'AI Morph' },
  { icon: '📊', label: 'Skill Match' },
  { icon: '⚡', label: 'One-Click' },
];

const tools = [
  {
    id: 'resume',
    name: 'Liquid Resume',
    tagline: 'AI Resume Builder',
    description: 'Morph your resume for any job description. One-click context-aware adaptation.',
    path: '/suite/resume',
    accent: '#00F5FF',
    accentRgb: '0, 245, 255',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    stat: { label: 'Resumes Built', value: '2.4K+' },
    span: 'lg:col-span-2', // wide card
  },
  {
    id: 'flashcards',
    name: 'Flash Cards',
    tagline: 'Interview Prep',
    description: 'AI-generated study cards. Master any topic before your next interview.',
    path: '/suite/flashcards',
    accent: '#F59E0B',
    accentRgb: '245, 158, 11',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
      </svg>
    ),
    stat: { label: 'Cards Studied', value: '12K+' },
    span: '', // normal card
  },
  {
    id: 'market',
    name: 'Market Oracle',
    tagline: 'JD Decoder + Career Intel',
    description: 'Paste any JD → Dual-AI decodes fit score, salary intel, red flags, hidden requirements, and bridge skills.',
    path: '/suite/market-oracle',
    accent: '#22C55E',
    accentRgb: '34, 197, 94',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
    stat: { label: 'Market Signals', value: 'Live' },
    span: 'lg:col-span-2', // wide card — flagship feature
  },
  {
    id: 'search',
    name: 'Smart Job Search',
    tagline: 'AI Discovery',
    description: 'Find the perfect roles with intelligent matching and real-time job aggregation.',
    path: '/suite/job-search',
    accent: '#EC4899',
    accentRgb: '236, 72, 153',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
    stat: { label: 'Jobs Indexed', value: '50K+' },
    span: '', // normal card
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useStore();
  const [greeting, setGreeting] = useState('');
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);

  // Dashboard Insights State
  const [insights, setInsights] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);

  const fetchInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await fetch('/api/dashboard/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'candidate', context: { email: user?.email } })
      });
      const data = await res.json();
      if (!data.error) setInsights(data);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleWidgetClick = (widget: string) => {
    if (widget === 'aiDiscovery') router.push('/suite/job-search');
    else if (widget === 'careerRoadmap') router.push('/suite/market-oracle');
    else if (widget === 'marketPulse') router.push('/suite/market-oracle');
  };

  useEffect(() => { if (user) fetchInsights(); }, [user]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const firstName = user?.displayName || user?.email?.split('@')[0] || 'there';

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pl-12 lg:pl-0"
      >
        <div>
          <p className="text-slate-500 text-sm font-medium tracking-wide">{greeting},</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white mt-1">
            {firstName} <span className="inline-block animate-[wave_2s_ease-in-out_infinite]">👋</span>
          </h1>
        </div>
        <SlidingTips />
      </motion.div>

      {/* ═══════════════════════════════════════════════
          TOOL CARDS — Premium Bento Grid
          ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">

        {/* ═══════ LIQUID RESUME — Custom Rich Card ═══════ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="group relative cursor-pointer lg:col-span-2"
          onMouseEnter={() => setHoveredTool('resume')}
          onMouseLeave={() => setHoveredTool(null)}
          onClick={() => router.push('/suite/resume')}
        >
          <div
            className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
            style={{ background: 'linear-gradient(135deg, rgba(0, 245, 255, 0.15), transparent 60%)' }}
          />
          <div className="relative h-full rounded-2xl bg-[#0A0A0A] border border-white/[0.06] group-hover:border-white/[0.12] transition-all duration-300 overflow-hidden">
            <div
              className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: 'linear-gradient(90deg, transparent, #00F5FF40, transparent)' }}
            />
            <div className="relative p-6 h-full flex flex-col md:flex-row gap-6">
              {/* Left: Info */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 bg-[#00F5FF]/[0.08] border border-[#00F5FF]/[0.15] text-[#00F5FF]">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-white">Liquid Resume</h3>
                      <p className="text-xs font-medium text-[#00F5FF]/70">AI Resume Builder</p>
                    </div>
                  </div>
                  <motion.div
                    className="w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-[#00F5FF]/10"
                    animate={hoveredTool === 'resume' ? { x: [0, 4, 0] } : {}}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="#00F5FF" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </motion.div>
                </div>

                <p className="text-sm text-slate-500 group-hover:text-slate-400 transition-colors leading-relaxed mb-4">
                  Upload any resume, paste a job description, and watch your resume morph to match—skills reordered, keywords injected, formatting optimized. Every export is ATS-parser safe.
                </p>

                {/* Feature pills */}
                <div className="flex flex-wrap gap-2 mb-auto">
                  {resumeFeatures.map((f, i) => (
                    <motion.div
                      key={f.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.07 }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-slate-400"
                    >
                      <span>{f.icon}</span>
                      {f.label}
                    </motion.div>
                  ))}
                </div>

                {/* Bottom stat */}
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.04] group-hover:border-white/[0.08] transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#00F5FF]" />
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Resumes Built</span>
                  </div>
                  <span className="text-sm font-bold text-[#00F5FF]">2.4K+</span>
                </div>
              </div>

              {/* Right: Animated preview */}
              <div className="hidden md:flex items-center justify-center w-[220px] flex-shrink-0">
                <ResumeCardAnimation />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ═══════ OTHER TOOL CARDS — Generic Template ═══════ */}
        {tools.filter(t => t.id !== 'resume').map((tool, index) => (
          <motion.div
            key={tool.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 + index * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={`group relative cursor-pointer ${tool.span}`}
            onMouseEnter={() => setHoveredTool(tool.id)}
            onMouseLeave={() => setHoveredTool(null)}
            onClick={() => router.push(tool.path)}
          >
            <div
              className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
              style={{ background: `linear-gradient(135deg, rgba(${tool.accentRgb}, 0.15), transparent 60%)` }}
            />
            <div className="relative h-full rounded-2xl bg-[#0A0A0A] border border-white/[0.06] group-hover:border-white/[0.12] transition-all duration-300 overflow-hidden">
              <div
                className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(90deg, transparent, ${tool.accent}40, transparent)` }}
              />
              <div className="relative p-6 h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                      style={{
                        backgroundColor: `rgba(${tool.accentRgb}, 0.08)`,
                        border: `1px solid rgba(${tool.accentRgb}, 0.15)`,
                        color: tool.accent,
                      }}
                    >
                      {tool.icon}
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-white group-hover:text-white/95 transition-colors">{tool.name}</h3>
                      <p className="text-xs font-medium transition-colors" style={{ color: `rgba(${tool.accentRgb}, 0.7)` }}>{tool.tagline}</p>
                    </div>
                  </div>
                  <motion.div
                    className="w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                    style={{ backgroundColor: `rgba(${tool.accentRgb}, 0.1)` }}
                    animate={hoveredTool === tool.id ? { x: [0, 4, 0] } : {}}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke={tool.accent} viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </motion.div>
                </div>
                <p className="text-sm text-slate-500 group-hover:text-slate-400 transition-colors leading-relaxed flex-1">{tool.description}</p>
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.04] group-hover:border-white/[0.08] transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: tool.accent }} />
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{tool.stat.label}</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: tool.accent }}>{tool.stat.value}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════
          JOB MARKET INSIGHTS — Bento Grid
          ═══════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-1 h-5 rounded-full bg-[#00F5FF] ${loadingInsights ? 'animate-pulse' : ''}`} />
            <h2 className="text-base font-semibold text-white">Job Market Insights</h2>
          </div>
          <button
            onClick={fetchInsights}
            className="text-xs text-[#00F5FF]/60 hover:text-[#00F5FF] flex items-center gap-1.5 transition-colors"
          >
            <svg className={`w-3 h-3 ${loadingInsights ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Insights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Widget 1: Job Matches */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 }}
            className="rounded-2xl bg-[#0A0A0A] border border-white/[0.06] p-5 hover:border-[#00F5FF]/20 transition-all group cursor-pointer"
            onClick={() => handleWidgetClick('aiDiscovery')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#00F5FF]/[0.06] border border-[#00F5FF]/10 flex items-center justify-center">
                  <span className="text-lg">🎯</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Job Matches</h3>
                  <p className="text-xs text-slate-500">Roles matching your profile</p>
                </div>
              </div>
              {!loadingInsights && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#00F5FF]/[0.06] border border-[#00F5FF]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] animate-pulse" />
                  <span className="text-[10px] font-medium text-[#00F5FF]">Live</span>
                </div>
              )}
            </div>

            {loadingInsights ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-white/[0.02]" />)}
              </div>
            ) : (
              <div className="space-y-2.5">
                {insights?.aiDiscovery?.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] group-hover:border-white/[0.08] transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#22C55E]/10 to-[#00F5FF]/10 flex items-center justify-center text-xs font-bold text-white">
                        {item.name ? item.name.split(' ').map((n: string) => n[0]).join('') : 'JD'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{item.name || item.title}</p>
                        <p className="text-xs text-slate-500">{item.role || item.company}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#00F5FF]">{item.score || item.matchScore}%</p>
                      <p className="text-[10px] text-[#22C55E]">↑ {item.trend}</p>
                    </div>
                  </div>
                )) || <p className="text-sm text-slate-500">No matches found.</p>}
              </div>
            )}

            <button className="w-full mt-4 py-2 rounded-lg border border-[#00F5FF]/15 text-[#00F5FF] text-xs font-medium hover:bg-[#00F5FF]/[0.06] transition-all">
              View All Jobs →
            </button>
          </motion.div>

          {/* Widget 2: Career Roadmap */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
            className="rounded-2xl bg-[#0A0A0A] border border-white/[0.06] p-5 hover:border-[#0070F3]/20 transition-all cursor-pointer"
            onClick={() => handleWidgetClick('careerRoadmap')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#0070F3]/[0.06] border border-[#0070F3]/10 flex items-center justify-center">
                  <span className="text-lg">🚀</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Career Roadmap</h3>
                  <p className="text-xs text-slate-500">Your skill gap analysis</p>
                </div>
              </div>
            </div>

            {loadingInsights ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-1/3 bg-white/[0.03] rounded" />
                    <div className="h-2 w-full bg-white/[0.03] rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {insights?.careerRoadmap?.skills?.map((skill: any, i: number) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-white">{skill.skill}</span>
                      <span className="text-[10px] text-slate-500">{skill.current}% → {skill.target}%</span>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${skill.current}%` }}
                        transition={{ delay: 0.9 + i * 0.1, duration: 0.8 }}
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{ backgroundColor: skill.color }}
                      />
                      <div className="absolute top-0 h-full w-0.5 bg-white/30" style={{ left: `${skill.target}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Time to target</p>
                  <p className="text-lg font-bold text-white">{loadingInsights ? '---' : insights?.careerRoadmap?.timeToTarget}</p>
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-[#0070F3]/40 flex items-center justify-center">
                  <span className="text-xs font-bold text-[#0070F3]">{loadingInsights ? '--' : `${insights?.careerRoadmap?.completion}%`}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Widget 3: Market Pulse */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9 }}
            className="rounded-2xl bg-[#0A0A0A] border border-white/[0.06] p-5 hover:border-[#22C55E]/20 transition-all cursor-pointer"
            onClick={() => handleWidgetClick('marketPulse')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#22C55E]/[0.06] border border-[#22C55E]/10 flex items-center justify-center">
                  <span className="text-lg">📈</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Market Pulse</h3>
                  <p className="text-xs text-slate-500">Real-time hiring trends</p>
                </div>
              </div>
              <span className="text-[10px] text-slate-600">Last 7 days</span>
            </div>

            {/* Mini Chart */}
            <div className="relative h-32 mb-4">
              {loadingInsights ? (
                <div className="w-full h-full bg-white/[0.02] rounded-lg animate-pulse" />
              ) : (
                <svg className="w-full h-full" viewBox="0 0 200 80">
                  {[0, 20, 40, 60].map((y) => (
                    <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  ))}
                  <defs>
                    <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {insights?.marketPulse?.chartData && (
                    <>
                      <motion.path
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ delay: 1.1, duration: 1.5 }}
                        d={`M0,${insights.marketPulse.chartData[0]?.y || 60} ${insights.marketPulse.chartData.map((p: any) => `L${p.x},${p.y}`).join(' ')} L200,80 L0,80 Z`}
                        fill="url(#chartGrad)"
                      />
                      <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: 1.1, duration: 1.5 }}
                        d={`M0,${insights.marketPulse.chartData[0]?.y || 60} ${insights.marketPulse.chartData.map((p: any) => `L${p.x},${p.y}`).join(' ')}`}
                        fill="none"
                        stroke="#22C55E"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      {insights.marketPulse.chartData.map((p: any, i: number) => (
                        <motion.circle
                          key={i}
                          cx={p.x}
                          cy={p.y}
                          r="2.5"
                          fill="#22C55E"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 1.3 + i * 0.1 }}
                        />
                      ))}
                    </>
                  )}
                </svg>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {loadingInsights ? (
                [1, 2, 3].map(i => <div key={i} className="h-14 bg-white/[0.02] rounded-lg animate-pulse" />)
              ) : (
                insights?.marketPulse?.stats?.map((stat: any, i: number) => (
                  <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-center">
                    <p className="text-[10px] text-slate-500 mb-0.5">{stat.label}</p>
                    <p className="text-sm font-bold text-white">{stat.value}</p>
                    <p className={`text-[10px] ${stat.up ? 'text-[#22C55E]' : 'text-red-400'}`}>
                      {stat.up ? '↑' : '↓'} {stat.change}
                    </p>
                  </div>
                ))
              )}
            </div>
          </motion.div>

        </div>
      </motion.div>
    </div>
  );
}
