'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';
import { useStore } from '@/lib/store';
import { analytics } from '@/lib/analytics';

interface SuggestedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: { min: number | null; max: number | null; currency: string; isPredicted?: boolean };
  description: string;
  skills: string[];
  url: string;
  postedDate: string;
  employmentType: string;
  acceptanceChance: number;
  acceptanceReason: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Low';
}

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return '';
  const fmt = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return '';
}

interface Props {
  hasPrefs: boolean;
  onSetupClick: () => void;
}

export default function WeeklyPicksSection({ hasPrefs, onSetupClick }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const user = useStore((s) => s.user);

  const [jobs, setJobs] = useState<SuggestedJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [selectedJob, setSelectedJob] = useState<SuggestedJob | null>(null);
  const [notifSent, setNotifSent] = useState(false);
  const [sendingNotif, setSendingNotif] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    if (!user || !hasPrefs) return;
    const token = (user as any).accessToken || (user as any).stsTokenManager?.accessToken;
    if (!token) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/jobs/suggestions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.jobs) {
        setJobs(data.jobs);
      } else if (data.needsSetup) {
        setJobs([]);
      } else {
        setError(data.error || 'Failed to load suggestions');
      }
    } catch {
      setError('Network error loading suggestions');
    } finally {
      setLoading(false);
    }
  }, [user, hasPrefs]);

  useEffect(() => {
    if (hasPrefs) fetchSuggestions();
  }, [hasPrefs, fetchSuggestions]);

  const sendEmailDigest = async () => {
    if (!user || jobs.length === 0) return;
    const token = (user as any).accessToken || (user as any).stsTokenManager?.accessToken;
    if (!token) return;

    setSendingNotif(true);
    try {
      const res = await fetch('/api/jobs/notify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifSent(true);
        analytics.emailDigestSent(jobs.length);
      }
    } catch {
      console.error('Failed to send email digest');
    } finally {
      setSendingNotif(false);
    }
  };

  const handleTailorResume = (job: SuggestedJob) => {
    sessionStorage.setItem('talent-resume-draft', JSON.stringify({
      jobDescription: job.description,
      jobTitle: job.title,
      company: job.company,
      skills: job.skills,
    }));
    window.location.href = '/suite/resume';
  };

  // Not set up yet — show setup prompt
  if (!hasPrefs) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 p-5 rounded-2xl border cursor-pointer hover:border-cyan-500/30 transition-all"
        style={{
          background: isLight ? 'linear-gradient(135deg, rgba(6,182,212,0.03), rgba(16,185,129,0.03))' : 'linear-gradient(135deg, rgba(6,182,212,0.05), rgba(16,185,129,0.05))',
          borderColor: isLight ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.15)',
        }}
        onClick={onSetupClick}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
            <span className="material-symbols-rounded text-white text-xl">auto_awesome</span>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">Set up Smart Suggestions</h3>
            <p className="text-xs text-[var(--text-secondary)]">Tell us your target roles, preferred cities, and work style to get up to 10 AI-curated job picks every week with acceptance chance scores.</p>
          </div>
          <span className="material-symbols-rounded text-cyan-500 text-xl shrink-0">arrow_forward</span>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mb-5">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 group"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
            <span className="material-symbols-rounded text-white text-sm">auto_awesome</span>
          </div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Weekly Picks</h2>
          {jobs.length > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-500">{jobs.length}</span>
          )}
          <span className={`material-symbols-rounded text-sm text-[var(--text-tertiary)] transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}>
            expand_more
          </span>
        </button>
        <div className="flex items-center gap-2">
          {jobs.length > 0 && !notifSent && (
            <button
              onClick={sendEmailDigest}
              disabled={sendingNotif}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all"
              style={{
                background: isLight ? 'rgba(6,182,212,0.06)' : 'rgba(6,182,212,0.08)',
                border: `1px solid ${isLight ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.15)'}`,
                color: '#06b6d4',
              }}
            >
              <span className="material-symbols-rounded text-sm">{sendingNotif ? 'hourglass_empty' : 'mail'}</span>
              {sendingNotif ? 'Sending...' : 'Email me these'}
            </button>
          )}
          {notifSent && (
            <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
              <span className="material-symbols-rounded text-sm">check_circle</span> Sent!
            </span>
          )}
          <button
            onClick={fetchSuggestions}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all"
            style={{
              background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
              color: 'var(--text-secondary)',
            }}
          >
            <span className={`material-symbols-rounded text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
            Refresh
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-10">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin" />
                    <span className="material-symbols-rounded text-cyan-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-base">auto_awesome</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] animate-pulse">Finding your best matches...</p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/15 text-xs text-red-400">{error}</div>
            )}

            {/* Job Cards */}
            {!loading && jobs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
                {jobs.map((job, i) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                    className={`cursor-pointer rounded-xl p-3 border transition-all hover:scale-[1.01] ${
                      selectedJob?.id === job.id ? 'border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'border-[var(--border-subtle)]'
                    }`}
                    style={{ background: 'var(--bg-surface)' }}
                  >
                    {/* Acceptance Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-md border" style={{
                        color: getScoreColor(job.acceptanceChance),
                        background: `${getScoreColor(job.acceptanceChance)}12`,
                        borderColor: `${getScoreColor(job.acceptanceChance)}25`,
                      }}>
                        <span className="material-symbols-rounded text-[11px] align-middle" style={{ color: getScoreColor(job.acceptanceChance) }}>radar</span> {job.acceptanceChance}%
                      </span>
                      <span className="text-[10px] text-[var(--text-tertiary)]">{getScoreLabel(job.acceptanceChance)}</span>
                    </div>

                    <h4 className="text-[12px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-2 mb-0.5">{job.title}</h4>
                    <p className="text-[11px] text-[var(--text-secondary)] font-medium mb-1">{job.company}</p>
                    <p className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1 mb-1">
                      <span className="material-symbols-rounded text-[11px]">location_on</span>
                      {job.location}
                    </p>
                    {(job.salary?.min || job.salary?.max) && (
                      <p className="text-[10px] text-emerald-500 font-medium">{formatSalary(job.salary.min, job.salary.max)}</p>
                    )}

                    {/* Reason */}
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-2 pt-2 border-t border-[var(--border-subtle)] italic line-clamp-2">
                      {job.acceptanceReason}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Selected Job Detail */}
            <AnimatePresence>
              {selectedJob && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 rounded-xl border p-4 overflow-hidden"
                  style={{
                    background: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{selectedJob.title}</h3>
                      <p className="text-xs text-cyan-500 font-medium">{selectedJob.company} • {selectedJob.location}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 text-xs font-bold rounded-lg" style={{
                        color: getScoreColor(selectedJob.acceptanceChance),
                        background: `${getScoreColor(selectedJob.acceptanceChance)}12`,
                      }}>
                        <span className="material-symbols-rounded text-[13px] align-middle" style={{ color: getScoreColor(selectedJob.acceptanceChance) }}>radar</span> {selectedJob.acceptanceChance}% Chance
                      </span>
                      <button onClick={() => setSelectedJob(null)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)' }}>
                        <span className="material-symbols-rounded text-sm text-[var(--text-tertiary)]">close</span>
                      </button>
                    </div>
                  </div>

                  {selectedJob.description && (
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3 line-clamp-4">{selectedJob.description}</p>
                  )}

                  {selectedJob.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {selectedJob.skills.slice(0, 8).map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{
                          background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                          color: 'var(--text-secondary)',
                        }}>{s}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTailorResume(selectedJob)}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                      style={{
                        background: isLight ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.12)',
                        border: '1px solid rgba(6,182,212,0.2)',
                        color: '#06b6d4',
                      }}
                    >
                      <span className="material-symbols-rounded text-sm">auto_fix_high</span>
                      Tailor Resume
                    </button>
                    <a
                      href={selectedJob.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 text-white"
                      style={{
                        background: 'linear-gradient(135deg, #06b6d4, #10b981)',
                      }}
                    >
                      <span className="material-symbols-rounded text-sm">open_in_new</span>
                      Apply Now
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* No results */}
            {!loading && !error && jobs.length === 0 && hasPrefs && (
              <div className="text-center py-6">
                <p className="text-xs text-[var(--text-tertiary)]">No matches found this week. We'll keep looking!</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
