'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/lib/auth-fetch';
import { showToast } from '@/components/Toast';
import { useAuthGate } from '@/hooks/useAuthGate';

// ── Types ──

interface KeywordMatch {
  keyword: string;
  category: 'hard_skill' | 'soft_skill' | 'tool' | 'certification' | 'domain' | 'action_verb';
  status: 'matched' | 'partial' | 'missing';
  resumeContext?: string;
}

interface ATSScoreResult {
  overallScore: number;
  breakdown: {
    hardSkillsScore: number;
    softSkillsScore: number;
    toolsScore: number;
    formattingScore: number;
    experienceRelevance: number;
  };
  keywords: KeywordMatch[];
  suggestions: string[];
  stats: {
    totalKeywords: number;
    matched: number;
    partial: number;
    missing: number;
  };
}

// ── Helpers ──

function getScoreColor(score: number) {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function getScoreLabel(score: number) {
  if (score >= 80) return 'Excellent Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Needs Work';
  return 'Poor Match';
}

function getCategoryIcon(cat: KeywordMatch['category']) {
  switch (cat) {
    case 'hard_skill': return 'code';
    case 'soft_skill': return 'psychology';
    case 'tool': return 'build';
    case 'certification': return 'verified';
    case 'domain': return 'domain';
    case 'action_verb': return 'bolt';
  }
}

function getCategoryLabel(cat: KeywordMatch['category']) {
  switch (cat) {
    case 'hard_skill': return 'Hard Skill';
    case 'soft_skill': return 'Soft Skill';
    case 'tool': return 'Tool/Tech';
    case 'certification': return 'Certification';
    case 'domain': return 'Domain';
    case 'action_verb': return 'Action Verb';
  }
}

// ── Score Ring ──

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor" strokeWidth="8"
          className="text-white/5"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="text-4xl font-black" style={{ color }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">
          ATS Score
        </span>
      </div>
    </div>
  );
}

// ── Mini Bar Chart ──

function BreakdownBar({ label, score, icon, delay = 0 }: { label: string; score: number; icon: string; delay?: number }) {
  const color = getScoreColor(score);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center gap-3"
    >
      <span className="material-symbols-rounded text-sm" style={{ color }}>
        {icon}
      </span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--text-secondary)]">{label}</span>
          <span className="text-xs font-bold" style={{ color }}>{score}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, delay: delay + 0.3, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ── Keyword Pill ──

function KeywordPill({ kw }: { kw: KeywordMatch }) {
  const statusConfig = {
    matched: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: 'check_circle' },
    partial: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: 'radio_button_partial' },
    missing: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', icon: 'cancel' },
  };

  const config = statusConfig[kw.status];

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all hover:scale-105 cursor-default ${config.bg} ${config.border} ${config.text}`}
      title={kw.resumeContext || `${kw.keyword} (${getCategoryLabel(kw.category)})`}
    >
      <span className="material-symbols-rounded text-[12px]">{config.icon}</span>
      <span>{kw.keyword}</span>
      <span className="opacity-50 text-[9px]">{getCategoryLabel(kw.category)}</span>
    </div>
  );
}

// ══════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════

interface ATSScorePanelProps {
  resumeText?: string;
  onClose?: () => void;
}

export default function ATSScorePanel({ resumeText: initialResumeText, onClose }: ATSScorePanelProps) {
  const { handleApiError, renderAuthModal } = useAuthGate();

  const [resumeText, setResumeText] = useState(initialResumeText || '');
  const [jdText, setJdText] = useState('');
  const [result, setResult] = useState<ATSScoreResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'matched' | 'partial' | 'missing'>('all');

  const filteredKeywords = useMemo(() => {
    if (!result) return [];
    if (activeFilter === 'all') return result.keywords;
    return result.keywords.filter(k => k.status === activeFilter);
  }, [result, activeFilter]);

  const runAnalysis = async () => {
    if (!resumeText.trim() || !jdText.trim()) {
      showToast('Paste both your resume and the job description', 'cancel');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authFetch('/api/resume/ats-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, jobDescription: jdText }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (handleApiError(err)) { setIsLoading(false); return; }
        throw new Error(err.error || 'Analysis failed');
      }

      const data: ATSScoreResult = await res.json();
      setResult(data);
      showToast(`ATS Score: ${data.overallScore}/100`, 'analytics');
    } catch (error) {
      console.error('ATS Score error:', error);
      showToast(error instanceof Error ? error.message : 'Analysis failed', 'cancel');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {renderAuthModal()}

      {/* Input Section */}
      {!result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Resume Input */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] mb-2">
              <span className="material-symbols-rounded text-sm">description</span>
              Your Resume Text
            </label>
            <textarea
              value={resumeText}
              onChange={e => setResumeText(e.target.value)}
              placeholder="Paste your resume text here..."
              rows={6}
              className="w-full px-4 py-3 rounded-xl glass-card text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 resize-none font-mono"
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              {resumeText.split(/\s+/).filter(Boolean).length} words
            </p>
          </div>

          {/* JD Input */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] mb-2">
              <span className="material-symbols-rounded text-sm">work</span>
              Job Description
            </label>
            <textarea
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              placeholder="Paste the target job description here..."
              rows={6}
              className="w-full px-4 py-3 rounded-xl glass-card text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 resize-none font-mono"
            />
          </div>

          {/* Analyze Button */}
          <button
            onClick={runAnalysis}
            disabled={isLoading || !resumeText.trim() || !jdText.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-sm hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <span className="material-symbols-rounded text-lg">analytics</span>
                Calculate ATS Match Score
              </>
            )}
          </button>
        </motion.div>
      )}

      {/* Results Section */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-5"
          >
            {/* Score + Breakdown Header */}
            <div className="rounded-2xl glass-card p-6 relative overflow-hidden">
              {/* Background glow */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                  className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl opacity-20"
                  style={{ backgroundColor: getScoreColor(result.overallScore) }}
                />
              </div>

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                {/* Score Ring */}
                <ScoreRing score={result.overallScore} />

                {/* Verdict + Stats */}
                <div className="flex-1 text-center md:text-left">
                  <h3
                    className="text-xl font-bold mb-1"
                    style={{ color: getScoreColor(result.overallScore) }}
                  >
                    {getScoreLabel(result.overallScore)}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mb-4">
                    {result.stats.totalKeywords} keywords analyzed
                  </p>

                  {/* Quick Stats */}
                  <div className="flex items-center justify-center md:justify-start gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs text-emerald-400 font-medium">{result.stats.matched} matched</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-xs text-amber-400 font-medium">{result.stats.partial} partial</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-xs text-red-400 font-medium">{result.stats.missing} missing</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Breakdown Bars */}
              <div className="relative z-10 mt-6 pt-5 border-t border-white/5 space-y-3">
                <BreakdownBar label="Hard Skills" score={result.breakdown.hardSkillsScore} icon="code" delay={0.1} />
                <BreakdownBar label="Soft Skills" score={result.breakdown.softSkillsScore} icon="psychology" delay={0.2} />
                <BreakdownBar label="Tools & Tech" score={result.breakdown.toolsScore} icon="build" delay={0.3} />
                <BreakdownBar label="Formatting" score={result.breakdown.formattingScore} icon="format_align_left" delay={0.4} />
                <BreakdownBar label="Experience Relevance" score={result.breakdown.experienceRelevance} icon="trending_up" delay={0.5} />
              </div>
            </div>

            {/* Keyword Gap Analysis */}
            <div className="rounded-2xl glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span className="material-symbols-rounded text-base">key</span>
                  Keyword Gap Analysis
                </h4>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] mb-4">
                {([
                  { key: 'all', label: `All (${result.keywords.length})` },
                  { key: 'matched', label: `Matched (${result.stats.matched})` },
                  { key: 'partial', label: `Partial (${result.stats.partial})` },
                  { key: 'missing', label: `Missing (${result.stats.missing})` },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFilter(tab.key)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeFilter === tab.key
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20'
                        : 'text-[var(--text-secondary)] hover:bg-white/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Keyword Pills */}
              <div className="flex flex-wrap gap-2">
                {filteredKeywords.map((kw, i) => (
                  <motion.div
                    key={`${kw.keyword}-${i}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <KeywordPill kw={kw} />
                  </motion.div>
                ))}
                {filteredKeywords.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] py-4 w-full text-center">
                    No keywords in this category
                  </p>
                )}
              </div>
            </div>

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
              <div className="rounded-2xl glass-card p-5">
                <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-3">
                  <span className="material-symbols-rounded text-base text-amber-400">lightbulb</span>
                  Suggestions
                </h4>
                <ul className="space-y-2">
                  {result.suggestions.map((s, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-2 text-xs text-[var(--text-secondary)]"
                    >
                      <span className="material-symbols-rounded text-xs text-amber-400/60 mt-0.5 shrink-0">
                        arrow_right
                      </span>
                      {s}
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => { setResult(null); setActiveFilter('all'); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass-card text-sm font-medium text-[var(--text-secondary)] hover:bg-white/5 transition-all"
              >
                <span className="material-symbols-rounded text-base">refresh</span>
                Re-analyze
              </button>
              <a
                href="/suite/resume"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-bold hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
              >
                <span className="material-symbols-rounded text-base">transform</span>
                Morph Resume
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
