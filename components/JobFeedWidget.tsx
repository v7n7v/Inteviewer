'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

interface SuggestedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: { min: number | null; max: number | null; currency: string };
  description: string;
  skills: string[];
  url: string;
  postedDate: string;
  acceptanceChance: number;
  acceptanceReason: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return '';
  const fmt = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return '';
}

const WIDGET_CACHE_KEY = 'talent-job-widget-cache';
const WIDGET_TTL = 60 * 60 * 1000; // 1 hour client-side TTL

export default function JobFeedWidget() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const [jobs, setJobs] = useState<SuggestedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState(false);
  const fetchedRef = useRef(false);

  const fetchSuggestions = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const token = (user as any).accessToken || (user as any).stsTokenManager?.accessToken;
    if (!token) { setLoading(false); return; }

    // Client-side TTL: skip fetch if cached data is fresh
    try {
      const cached = localStorage.getItem(WIDGET_CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < WIDGET_TTL && data.length > 0) {
          setJobs(data);
          setLoading(false);
          return;
        }
      }
    } catch {}

    try {
      const res = await fetch('/api/jobs/suggestions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.jobs?.length > 0) {
        setJobs(data.jobs);
        // Cache for TTL
        localStorage.setItem(WIDGET_CACHE_KEY, JSON.stringify({ data: data.jobs, ts: Date.now() }));
        // Dispatch count for sidebar badge
        localStorage.setItem('talent-job-curated-count', data.jobs.length.toString());
        window.dispatchEvent(new Event('job-count-updated'));
      } else if (data.needsSetup) {
        setNeedsSetup(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchSuggestions();
    }
  }, [fetchSuggestions]);

  const handleMorph = (job: SuggestedJob) => {
    sessionStorage.setItem('talent-resume-draft', JSON.stringify({
      jobDescription: job.description,
      jobTitle: job.title,
      company: job.company,
      skills: job.skills,
    }));
    router.push('/suite/resume');
  };

  // Don't render anything for unauthenticated or errored states
  if (!user || error) return null;

  // Setup CTA
  if (!loading && needsSetup) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-6"
      >
        <div
          className="rounded-2xl border p-5 cursor-pointer hover:border-cyan-500/25 transition-all group"
          style={{
            background: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
          onClick={() => router.push('/suite/job-search')}
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/15 shrink-0">
              <span className="material-symbols-rounded text-white text-lg">radar</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-0.5">Set up your Opportunity Radar</h3>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Tell us your target roles and preferred locations to get AI-curated job matches with acceptance scores delivered to your dashboard.
              </p>
            </div>
            <span className="material-symbols-rounded text-[var(--text-muted)] group-hover:text-cyan-500 transition-colors shrink-0">arrow_forward</span>
          </div>
        </div>
      </motion.div>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-5 h-5 rounded-md bg-[var(--bg-elevated)] animate-pulse" />
          <div className="w-28 h-4 rounded bg-[var(--bg-elevated)] animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-xl border border-[var(--border-subtle)] p-4 animate-pulse" style={{ background: 'var(--bg-surface)' }}>
              <div className="w-14 h-4 rounded bg-[var(--bg-elevated)] mb-3" />
              <div className="w-full h-3 rounded bg-[var(--bg-elevated)] mb-2" />
              <div className="w-3/4 h-3 rounded bg-[var(--bg-elevated)] mb-4" />
              <div className="w-1/2 h-3 rounded bg-[var(--bg-elevated)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No jobs found
  if (jobs.length === 0) return null;

  const topJobs = jobs.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mb-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
            <span className="material-symbols-rounded text-white text-[13px]">radar</span>
          </div>
          <h2 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
            Top Opportunities
          </h2>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-500">
            {jobs.length}
          </span>
        </div>
        <button
          onClick={() => router.push('/suite/job-search')}
          className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-cyan-500 transition-colors flex items-center gap-1"
        >
          View all
          <span className="material-symbols-rounded text-[13px]">arrow_forward</span>
        </button>
      </div>

      {/* Job Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <AnimatePresence>
          {topJobs.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="rounded-xl border p-4 transition-all hover:border-cyan-500/25 group relative overflow-hidden"
              style={{
                background: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              {/* Ambient glow */}
              <div
                className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20 pointer-events-none blur-xl"
                style={{ background: getScoreColor(job.acceptanceChance) }}
              />

              {/* Score badge */}
              <div className="flex items-center justify-between mb-2.5 relative">
                <span
                  className="px-2 py-0.5 text-[11px] font-bold rounded-md border"
                  style={{
                    color: getScoreColor(job.acceptanceChance),
                    background: `${getScoreColor(job.acceptanceChance)}12`,
                    borderColor: `${getScoreColor(job.acceptanceChance)}25`,
                  }}
                >
                  {job.acceptanceChance}% match
                </span>
                {(job.salary?.min || job.salary?.max) && (
                  <span className="text-[10px] text-emerald-500 font-medium">
                    {formatSalary(job.salary.min, job.salary.max)}
                  </span>
                )}
              </div>

              {/* Job info */}
              <h4 className="text-[13px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-2 mb-0.5">
                {job.title}
              </h4>
              <p className="text-[11px] text-[var(--text-secondary)] font-medium mb-1">{job.company}</p>
              <p className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1 mb-3">
                <span className="material-symbols-rounded text-[11px]">location_on</span>
                {job.location}
              </p>

              {/* AI reason */}
              <p className="text-[10px] text-[var(--text-tertiary)] italic line-clamp-1 mb-3">
                {job.acceptanceReason}
              </p>

              {/* Actions */}
              <div className="flex gap-2 pt-2.5 border-t border-[var(--border-subtle)]">
                <button
                  onClick={(e) => { e.stopPropagation(); handleMorph(job); }}
                  className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                  style={{
                    background: 'rgba(6,182,212,0.08)',
                    border: '1px solid rgba(6,182,212,0.18)',
                    color: '#06b6d4',
                  }}
                >
                  <span className="material-symbols-rounded text-[12px]">auto_fix_high</span>
                  Morph
                </button>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 text-white"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #10b981)',
                  }}
                >
                  <span className="material-symbols-rounded text-[12px]">open_in_new</span>
                  Apply
                </a>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
