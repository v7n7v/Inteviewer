'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import PageHelp from '@/components/PageHelp';
import { type ResumeVersion } from '@/lib/database-suite';
import ResumeLibraryPicker from '@/components/ResumeLibraryPicker';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Copied!', 'content_copy');
    setTimeout(() => setCopied(false), 1500);
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
        copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
      }`}
    >
      <span className="material-symbols-rounded text-[12px]">{copied ? 'check' : 'content_copy'}</span>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

interface OptimizeResult {
  headline: { current: string; optimized: string; score: number; tips: string[] };
  about: { current: string; optimized: string; score: number; tips: string[] };
  overallScore: number;
  keywordsMissing: string[];
  profileStrengths: string[];
  quickWins: string[];
}

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const fill = (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#06b6d4' : score >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${fill} ${circumference}` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

export default function LinkedInOptimizerPage() {
  const { user } = useStore();
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [activeSection, setActiveSection] = useState<'headline' | 'about'>('headline');
  const [resumeContext, setResumeContext] = useState<any>(null);
  const [hasResumeContext, setHasResumeContext] = useState(false);

  // Saved Resumes integration
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedResumeName, setSelectedResumeName] = useState('');

  const handleSelectResume = (rv: ResumeVersion) => {
    setResumeContext(rv.content);
    setHasResumeContext(true);
    setSelectedResumeId(rv.id);
    setSelectedResumeName(rv.version_name);
    const c = rv.content as any;
    if (c.title && !targetRole) setTargetRole(c.title);
  };

  // Auto-populate from Resume Studio draft (sessionStorage)
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem('talent-resume-draft');
      if (!draft) return;
      const parsed = JSON.parse(draft);

      if (parsed.morphedResume) {
        setResumeContext(parsed.morphedResume);
        setHasResumeContext(true);

        // Auto-fill target role from resume title
        if (parsed.morphedResume.title && !targetRole) {
          setTargetRole(parsed.morphedResume.title);
        }
      }
    } catch (e) {
      // Silently fail
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOptimize = async () => {
    setLoading(true);
    try {
      const token = (user as any)?.accessToken || (user as any)?.stsTokenManager?.accessToken;
      const res = await fetch('/api/agent/linkedin-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          headline,
          about,
          targetRole,
          // Send morphed resume directly if available
          ...(resumeContext ? { resumeData: resumeContext } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        showToast('Profile analyzed!', 'person');
      } else {
        showToast(data.error || 'Failed', 'cancel');
      }
    } catch {
      showToast('Something went wrong', 'cancel');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="material-symbols-rounded text-white text-2xl">badge</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">LinkedIn Optimizer</h1>
              <p className="text-sm text-[var(--text-tertiary)]">Get found by recruiters — optimize your headline & about</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ResumeLibraryPicker
              onSelect={handleSelectResume}
              selectedId={selectedResumeId}
              selectedName={selectedResumeName}
            />
            <PageHelp toolId="linkedin" />
          </div>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="rounded-2xl p-5 space-y-4" style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}>
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="material-symbols-rounded text-blue-500 text-lg">edit</span>
              {hasResumeContext ? 'Your resume is loaded — paste your current LinkedIn to compare, or leave blank to generate fresh.' : 'Paste Your Current LinkedIn'}
            </h3>

            <div>
              <label className="text-[11px] font-semibold text-[var(--text-tertiary)] block mb-1">
                Headline <span className="opacity-50">(the text under your name)</span>
              </label>
              <input
                value={headline}
                onChange={e => setHeadline(e.target.value)}
                placeholder="e.g. Software Engineer at Acme Corp"
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-blue-500/50"
              />
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{headline.length}/220 characters</p>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--text-tertiary)] block mb-1">
                About Section <span className="opacity-50">(your summary)</span>
              </label>
              <textarea
                value={about}
                onChange={e => setAbout(e.target.value)}
                placeholder="Paste your current About section here... or leave blank to generate fresh from your resume."
                rows={6}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-blue-500/50 resize-none"
              />
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{about.length}/2600 characters</p>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--text-tertiary)] block mb-1">Target Role</label>
              <input
                value={targetRole}
                onChange={e => setTargetRole(e.target.value)}
                placeholder="What role do you want recruiters to find you for?"
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <p className="text-[11px] text-[var(--text-secondary)] flex items-start gap-1.5">
                <span className="material-symbols-rounded text-[14px] text-blue-400 mt-0.5 shrink-0">lightbulb</span>
                {hasResumeContext
                  ? 'Your morphed resume is loaded. Leave fields blank to auto-generate — we\'ll use your latest resume data.'
                  : 'Leave fields blank to auto-generate from your resume in Vault. We\'ll pull your latest version.'}
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.995 }}
              onClick={handleOptimize}
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-white disabled:opacity-40 relative overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                boxShadow: '0 4px 20px rgba(59,130,246,0.2)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-rounded text-lg">auto_fix_high</span>
              )}
              {loading ? 'Analyzing...' : 'Optimize Profile'}
            </motion.button>
          </div>
        </motion.div>

        {/* Results */}
        <div>
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex items-center justify-center min-h-[400px] rounded-2xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <span className="material-symbols-rounded text-3xl text-blue-500">person_search</span>
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Enter Your Profile</h3>
                  <p className="text-sm text-[var(--text-tertiary)] max-w-xs">
                    {hasResumeContext
                      ? 'Your resume is loaded. Paste your headline & about to compare, or let us generate fresh.'
                      : 'Paste your headline & about, or let us generate from your resume.'}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Overall Score */}
                <div className="rounded-2xl p-4 flex items-center justify-between" style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">Profile Score</p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">Based on recruiter visibility, keyword density, and hook strength</p>
                  </div>
                  <ScoreRing score={result.overallScore} />
                </div>

                {/* Section Tabs */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  {(['headline', 'about'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setActiveSection(s)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        activeSection === s
                          ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                          : 'text-[var(--text-tertiary)]'
                      }`}
                    >
                      <ScoreRing score={result[s].score} size={24} />
                      {s === 'headline' ? 'Headline' : 'About Section'}
                    </button>
                  ))}
                </div>

                {/* Section Content */}
                <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <AnimatePresence mode="wait">
                    <motion.div key={activeSection} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {/* Current */}
                      {result[activeSection].current && result[activeSection].current !== 'Not provided' && (
                        <div className="mb-3">
                          <label className="text-[10px] font-bold text-red-400/60 block mb-1">CURRENT</label>
                          <div className="p-3 rounded-xl text-sm text-[var(--text-tertiary)] line-through opacity-60" style={{ background: 'var(--bg-elevated)' }}>
                            {result[activeSection].current}
                          </div>
                        </div>
                      )}

                      {/* Optimized */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-emerald-400">OPTIMIZED</label>
                          <CopyButton text={result[activeSection].optimized} />
                        </div>
                        <div className="p-3 rounded-xl text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap border border-emerald-500/20" style={{ background: 'rgba(16,185,129,0.05)' }}>
                          {result[activeSection].optimized}
                        </div>
                      </div>

                      {/* Tips */}
                      {result[activeSection].tips.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-[var(--text-tertiary)]">TIPS</label>
                          {result[activeSection].tips.map((t, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                              <span className="material-symbols-rounded text-[14px] text-blue-400 mt-0.5 shrink-0">tips_and_updates</span>
                              {t}
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Keywords & Quick Wins */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <h4 className="text-[10px] font-bold text-amber-400 mb-2 flex items-center gap-1">
                      <span className="material-symbols-rounded text-[14px]">key</span> Missing Keywords
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {result.keywordsMissing.map((k, i) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">{k}</span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <h4 className="text-[10px] font-bold text-emerald-400 mb-2 flex items-center gap-1">
                      <span className="material-symbols-rounded text-[14px]">bolt</span> Quick Wins
                    </h4>
                    <div className="space-y-1">
                      {result.quickWins.map((w, i) => (
                        <p key={i} className="text-[11px] text-[var(--text-secondary)] flex items-start gap-1.5">
                          <span className="text-emerald-400 shrink-0">•</span> {w}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
