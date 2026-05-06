'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { authFetch } from '@/lib/auth-fetch';
import { motion } from 'framer-motion';
import { useUserTier } from '@/hooks/use-user-tier';
import { getTierTheme } from '@/lib/tier-theme';
import JobFeedWidget from '@/components/JobFeedWidget';

// Typewriter effect — types text, holds, then replays
function TypewriterText({ text, delay = 0, interval = 30000 }: { text: string; delay?: number; interval?: number }) {
  const [displayed, setDisplayed] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charRef = useRef(0);

  const startTyping = useCallback(() => {
    charRef.current = 0;
    setDisplayed('');
    setIsTyping(true);
  }, []);

  useEffect(() => {
    // Initial delay stagger
    const initTimeout = setTimeout(startTyping, delay);
    return () => clearTimeout(initTimeout);
  }, [delay, startTyping]);

  useEffect(() => {
    if (!isTyping) return;

    if (charRef.current < text.length) {
      timeoutRef.current = setTimeout(() => {
        charRef.current += 1;
        setDisplayed(text.slice(0, charRef.current));
      }, 25 + Math.random() * 20); // Slight randomness for natural feel
    } else {
      setIsTyping(false);
      // Schedule replay after interval
      timeoutRef.current = setTimeout(startTyping, interval);
    }

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [isTyping, displayed, text, interval, startTyping]);

  return (
    <span>
      {displayed}
      {isTyping && (
        <span
          className="inline-block w-[2px] h-[13px] ml-[1px] align-middle rounded-sm"
          style={{
            background: 'var(--text-muted)',
            animation: 'cursor-blink 0.7s steps(2) infinite',
          }}
        />
      )}
    </span>
  );
}

// Tool groups matching sidebar organization
const toolGroups = [
  {
    label: 'Intelligence',
    tools: [
      {
        id: 'intelligence', name: 'Career Health', description: 'Health score, skill gaps, pipeline metrics, and AI-powered recommendations.',
        path: '/suite/intelligence', badge: '2.5', iconName: 'neurology', iconColor: '#8b5cf6', accentRgb: '139,92,246',
      },
      {
        id: 'pulse', name: 'Career Pulse', description: 'Pipeline health, velocity, stale alerts, and morale tracking.',
        path: '/suite/pulse', iconName: 'monitor_heart', iconColor: '#ec4899', accentRgb: '236,72,153',
      },
      {
        id: 'analytics', name: 'Analytics', description: 'Pipeline insights, response rates, and conversion funnels.',
        path: '/suite/analytics', iconName: 'analytics', iconColor: '#0ea5e9', accentRgb: '14,165,233',
      },
    ],
  },
  {
    label: 'Build & Apply',
    tools: [
      {
        id: 'resume', name: 'Resume Studio', description: 'AI-powered resume builder. Morph your resume for any JD.',
        path: '/suite/resume', iconName: 'auto_awesome', iconColor: '#f59e0b', accentRgb: '245,158,11',
      },
      {
        id: 'cover-letter', name: 'Cover Letter', description: 'Generate tailored cover letters with humanization guard.',
        path: '/suite/cover-letter', badge: 'PRO', iconName: 'edit_document', iconColor: '#f43f5e', accentRgb: '244,63,94',
      },
      {
        id: 'ats-preview', name: 'ATS Preview', description: 'See what Greenhouse, Lever, and Workday recruiters see.',
        path: '/suite/ats-preview', iconName: 'scanner', iconColor: '#06b6d4', accentRgb: '6,182,212',
      },
      {
        id: 'job-search', name: 'Job Search', description: 'Opportunity radar with ghost job detection and fit scoring.',
        path: '/suite/job-search', badge: 'PRO', iconName: 'radar', iconColor: '#06b6d4', accentRgb: '6,182,212',
      },
      {
        id: 'applications', name: 'Applications', description: 'Track applications, interview stages, and follow-ups.',
        path: '/suite/applications', iconName: 'work', iconColor: '#22c55e', accentRgb: '34,197,94',
      },
    ],
  },
  {
    label: 'Prepare',
    tools: [
      {
        id: 'flashcards', name: 'Interview Sim', description: 'AI interview simulator. Master any topic with practice rounds.',
        path: '/suite/flashcards', iconName: 'chat', iconColor: '#3b82f6', accentRgb: '59,130,246',
      },
      {
        id: 'interview-sim', name: 'Avatar Interview', description: 'Live 3D AI recruiter face-to-face mock interview.',
        path: '/suite/interview-sim', badge: 'NEW', iconName: 'videocam', iconColor: '#f43f5e', accentRgb: '244,63,94',
      },
      {
        id: 'debrief', name: 'Interview Debrief', description: 'Log every interview. Track patterns and build confidence.',
        path: '/suite/interview-debrief', iconName: 'rate_review', iconColor: '#8b5cf6', accentRgb: '139,92,246',
      },
      {
        id: 'stories', name: 'Story Bank', description: 'Your STAR stories. Auto-answers behavioral screening questions.',
        path: '/suite/agent/stories', iconName: 'auto_stories', iconColor: '#10b981', accentRgb: '16,185,129',
      },
      {
        id: 'skill-bridge', name: 'Skill Bridge', description: 'AI-generated learning paths. From resume gaps to ready.',
        path: '/suite/skill-bridge', badge: 'PRO', iconName: 'route', iconColor: '#10b981', accentRgb: '16,185,129',
      },
      {
        id: 'vault', name: 'Study Vault', description: 'Saved practice notes, bookmarks, and prep materials.',
        path: '/suite/vault', iconName: 'folder_open', iconColor: '#f97316', accentRgb: '249,115,22',
      },
    ],
  },
  {
    label: 'Tools',
    tools: [
      {
        id: 'oracle', name: 'Market Oracle', description: 'Dual-AI JD decoder: fit score, salary intel, red flags, bridge skills.',
        path: '/suite/market-oracle', iconName: 'troubleshoot', iconColor: '#a855f7', accentRgb: '168,85,247',
      },
      {
        id: 'writing', name: 'AI Detector', description: 'Detect AI patterns, humanize text, and verify uniqueness.',
        path: '/suite/writing-tools', badge: 'PRO', iconName: 'ink_pen', iconColor: '#f43f5e', accentRgb: '244,63,94',
      },
      {
        id: 'negotiate', name: 'Salary Coach', description: 'Negotiation strategy, market data, and counter-offer prep.',
        path: '/suite/negotiate', badge: 'PRO', iconName: 'payments', iconColor: '#10b981', accentRgb: '16,185,129',
      },
      {
        id: 'linkedin', name: 'LinkedIn', description: 'Profile optimizer. Align your profile with target roles.',
        path: '/suite/linkedin', badge: 'PRO', iconName: 'badge', iconColor: '#3b82f6', accentRgb: '59,130,246',
      },
    ],
  },
];

// Dynamic greeting based on Twin intelligence
function getSmartGreeting(firstName: string, twinData: any): { greeting: string; subtitle: string } {
  const hour = new Date().getHours();
  const timeGreet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (!twinData) {
    return { greeting: `${timeGreet}, ${firstName}`, subtitle: 'Your career intelligence hub. Every tool, one place.' };
  }

  const { completeness, behavioralBank, background } = twinData;
  const score = twinData.profile?.healthScore || 0;

  if (completeness?.score < 40) {
    const next = completeness.missing?.[0] || 'Resume uploaded';
    return { greeting: `${timeGreet}, ${firstName}`, subtitle: `Profile ${completeness.score}% complete. Next: ${next}.` };
  }
  if (behavioralBank?.coverageScore < 25 && behavioralBank?.totalStories < 3) {
    return { greeting: `${timeGreet}, ${firstName}`, subtitle: `Add STAR stories to cover ${behavioralBank.uncoveredCategories?.slice(0, 2).join(' & ') || 'key areas'}.` };
  }
  if (score >= 70) {
    return { greeting: `${timeGreet}, ${firstName}`, subtitle: `You're in strong shape. Keep the momentum going.` };
  }
  if (score >= 45) {
    return { greeting: `${timeGreet}, ${firstName}`, subtitle: `${background?.targetRoles?.[0] ? `Progressing toward ${background.targetRoles[0]}.` : 'Room to grow. Keep pushing.'}` };
  }
  return { greeting: `${timeGreet}, ${firstName}`, subtitle: `Let's build your pipeline. Start with a resume upload.` };
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');
}

// getTierTheme is now imported from lib/tier-theme.ts

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useStore();
  const { tier, isPro } = useUserTier();
  const [vaultStats, setVaultStats] = useState<{ total: number; bridge: number; interview: number; flashcards: number } | null>(null);
  const [healthData, setHealthData] = useState<{
    score: number; velocity: number; responseRate: number;
    debriefs: number; topRec: { title: string; actionPath: string; color: string; icon: string } | null;
  } | null>(null);
  const [twinData, setTwinData] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<{ icon: string; color: string; text: string; time: string; path: string }[]>([]);

  useEffect(() => {
    authFetch('/api/vault/list')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.notes) return;
        const notes = data.notes as { type: string; topic?: string; createdAt?: string }[];
        setVaultStats({
          total: notes.length,
          bridge: notes.filter(n => n.type === 'skill-bridge').length,
          interview: notes.filter(n => n.type === 'interview').length,
          flashcards: notes.filter(n => n.type === 'flashcards').length,
        });
        // Build recent vault activity
        const typeMap: Record<string, { icon: string; color: string; label: string; path: string }> = {
          'skill-bridge': { icon: 'route', color: '#10b981', label: 'Skill Bridge plan saved', path: '/suite/vault' },
          'interview': { icon: 'mic', color: '#8b5cf6', label: 'Interview notes saved', path: '/suite/vault' },
          'flashcards': { icon: 'edit_document', color: '#06b6d4', label: 'Flashcard session saved', path: '/suite/vault' },
        };
        const vaultActivity = notes.slice(0, 3).map(n => {
          const cfg = typeMap[n.type] || { icon: 'note', color: '#64748b', label: 'Note saved', path: '/suite/vault' };
          return {
            icon: cfg.icon, color: cfg.color,
            text: n.topic ? `${cfg.label}: ${n.topic}` : cfg.label,
            time: n.createdAt ? new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
            path: cfg.path,
          };
        });
        setRecentActivity(prev => [...prev, ...vaultActivity].slice(0, 5));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    authFetch('/api/agent/intelligence')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.profile) return;
        const p = data.profile;
        const topRec = data.recommendations?.[0] || null;
        setHealthData({
          score: p.healthScore || 0,
          velocity: p.pipeline?.velocity || 0,
          responseRate: p.pipeline?.responseRate || 0,
          debriefs: p.interviews?.totalDebriefs || 0,
          topRec: topRec ? { title: topRec.title, actionPath: topRec.actionPath, color: topRec.color, icon: topRec.icon } : null,
        });
        if (data.twin) {
          setTwinData({ ...data.twin, profile: p });
        }
      })
      .catch(() => {});
  }, []);

  // Fetch recent debriefs for activity feed
  useEffect(() => {
    authFetch('/api/agent/debriefs')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.debriefs) return;
        const debriefActivity = (data.debriefs as { company?: string; role?: string; created_at?: any }[]).slice(0, 2).map(d => ({
          icon: 'rate_review', color: '#8b5cf6',
          text: `Interview debrief${d.company ? `: ${d.company}` : ''}${d.role ? ` - ${d.role}` : ''}`,
          time: d.created_at ? new Date(typeof d.created_at === 'object' && d.created_at.seconds ? d.created_at.seconds * 1000 : d.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
          path: '/suite/interview-debrief',
        }));
        setRecentActivity(prev => [...debriefActivity, ...prev].slice(0, 5));
      })
      .catch(() => {});
  }, []);

  const firstName = user?.displayName || user?.email?.split('@')[0] || 'there';
  const fullName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const initials = getInitials(fullName);
  const { greeting, subtitle } = getSmartGreeting(firstName, twinData);
  const score = healthData?.score || 0;
  const scoreColor = score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444';
  const completeness = twinData?.completeness?.score ?? null;
  const theme = getTierTheme(tier);
  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;
  const currentTitle = twinData?.background?.currentTitle || null;
  const targetRoles = twinData?.background?.targetRoles || [];
  const confirmedSkills: string[] = (twinData?.profile?.skills?.confirmed || []).slice(0, 8);
  const nextMissing = twinData?.completeness?.missing?.[0] || null;

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8 max-w-[1000px] mx-auto">

      {/* ── Premium Profile Card ── */}
      {(() => {
        const orbOpacity = Math.round(10 + theme.intensity * 10);
        const borderGlow = Math.round(12 + theme.intensity * 5);
        const shadowSpread = Math.round(4 + theme.intensity * 3);
        return (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="sticky top-0 z-30 mb-8 pl-10 lg:pl-0"
          >
            <div
              className="relative rounded-3xl overflow-hidden cursor-pointer group"
              onClick={() => router.push('/suite/intelligence')}
              style={{
                backdropFilter: 'blur(28px) saturate(1.7)',
                WebkitBackdropFilter: 'blur(28px) saturate(1.7)',
                background: `linear-gradient(145deg, color-mix(in srgb, ${theme.accent} 8%, var(--card-bg)), color-mix(in srgb, ${theme.accentAlt} 3%, var(--card-bg)))`,
                border: `1px solid color-mix(in srgb, ${theme.accent} ${borderGlow}%, var(--border-subtle))`,
                boxShadow: `0 8px 32px color-mix(in srgb, ${theme.accent} ${shadowSpread}%, transparent), 0 0 0 1px color-mix(in srgb, ${theme.accent} 5%, transparent) inset`,
              }}
            >
              {/* ── Animated Mesh Gradient Orbs ── */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                  className="absolute -top-10 -right-10 w-52 h-52 rounded-full blur-3xl"
                  style={{
                    opacity: orbOpacity / 100,
                    background: `radial-gradient(circle, color-mix(in srgb, ${theme.accent} 60%, transparent), transparent 70%)`,
                    animation: 'profileOrb1 8s ease-in-out infinite',
                  }}
                />
                <div
                  className="absolute -bottom-8 -left-8 w-44 h-44 rounded-full blur-3xl"
                  style={{
                    opacity: (orbOpacity - 5) / 100,
                    background: `radial-gradient(circle, color-mix(in srgb, ${theme.accentAlt} 50%, transparent), transparent 70%)`,
                    animation: 'profileOrb2 10s ease-in-out infinite',
                  }}
                />
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 rounded-full blur-3xl"
                  style={{
                    opacity: (orbOpacity - 8) / 100,
                    background: `radial-gradient(ellipse, color-mix(in srgb, ${scoreColor} 30%, transparent), transparent 70%)`,
                    animation: 'profileOrb3 12s ease-in-out infinite',
                  }}
                />
              </div>

              <div className="relative z-10 p-5 lg:p-7">
                {/* ── Row 1: Avatar + Identity + Health Ring ── */}
                <div className="flex items-start gap-4 lg:gap-5">
                  {/* Avatar Column: 3D Initials + Tier Badge */}
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    {/* 3D Gradient Avatar */}
                    <div
                      className="w-16 h-16 lg:w-[72px] lg:h-[72px] rounded-2xl flex items-center justify-center text-[20px] lg:text-[22px] font-bold tracking-tight text-white transition-transform duration-200 group-hover:scale-105"
                      style={{
                        background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentAlt})`,
                        textShadow: [
                          '-1px -1px 0 rgba(255,255,255,0.25)',
                          '1px 1px 0 rgba(0,0,0,0.25)',
                          '2px 2px 0 rgba(0,0,0,0.12)',
                          `0 0 ${12 + theme.intensity * 6}px color-mix(in srgb, ${theme.accent} ${Math.round(30 + theme.intensity * 15)}%, transparent)`,
                          `0 0 ${theme.intensity * 20}px color-mix(in srgb, ${theme.accent} ${Math.round(theme.intensity * 12)}%, transparent)`,
                        ].join(', '),
                        boxShadow: [
                          `0 ${Math.round(4 + theme.intensity * 2)}px ${Math.round(16 + theme.intensity * 6)}px color-mix(in srgb, ${theme.accent} ${Math.round(25 + theme.intensity * 8)}%, transparent)`,
                          `0 0 0 2px color-mix(in srgb, ${theme.accent} ${Math.round(10 + theme.intensity * 5)}%, transparent)`,
                          `0 0 ${Math.round(theme.intensity * 20)}px color-mix(in srgb, ${theme.accent} ${Math.round(theme.intensity * 8)}%, transparent)`,
                        ].join(', '),
                      }}
                    >
                      {initials}
                    </div>
                    {/* Tier Badge */}
                    <span
                      className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${theme.shimmer ? 'tier-badge-shimmer' : ''}`}
                      style={{
                        background: `color-mix(in srgb, ${theme.accent} 12%, var(--bg-elevated))`,
                        color: theme.accentText,
                        border: `1px solid color-mix(in srgb, ${theme.accent} 25%, transparent)`,
                        boxShadow: theme.shimmer
                          ? `0 0 ${Math.round(theme.intensity * 8)}px color-mix(in srgb, ${theme.accent} ${Math.round(theme.intensity * 12)}%, transparent)`
                          : 'none',
                      }}
                    >
                      {theme.label}
                    </span>
                  </div>

                  {/* Identity block */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h1 className="text-[22px] lg:text-[28px] font-bold tracking-tight text-[var(--text-primary)] leading-tight truncate">
                      {greeting}
                    </h1>

                    {/* Career trajectory */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {currentTitle && (
                        <span className="text-[13px] text-[var(--text-secondary)] leading-snug">
                          {currentTitle}
                        </span>
                      )}
                      {currentTitle && targetRoles.length > 0 && (
                        <span className="text-[11px] text-[var(--text-muted)]">→</span>
                      )}
                      {targetRoles.length > 0 && (
                        <span className="text-[13px] font-medium leading-snug" style={{ color: `var(--tier-accent-text, ${theme.accentText})` }}>
                          {targetRoles[0]}
                        </span>
                      )}
                      {!currentTitle && !targetRoles.length && (
                        <span className="text-[13px] text-[var(--text-secondary)] leading-snug line-clamp-1">
                          {subtitle}
                        </span>
                      )}
                    </div>

                    {/* Member since */}
                    {memberSince && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                          <span className="material-symbols-rounded text-[11px]">calendar_month</span>
                          Since {memberSince}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Health Score Ring */}
                  {healthData && (
                    <div className="relative w-[68px] h-[68px] lg:w-[76px] lg:h-[76px] flex-shrink-0">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="14.5" fill="none" strokeWidth="2" stroke="var(--border-subtle)" />
                        <circle
                          cx="18" cy="18" r="14.5" fill="none" strokeWidth="2.5" strokeLinecap="round"
                          stroke={scoreColor}
                          strokeDasharray={`${score * 0.91} ${91 - score * 0.91}`}
                          className="transition-all duration-1000 ease-out"
                          style={{ filter: `drop-shadow(0 0 6px color-mix(in srgb, ${scoreColor} 50%, transparent))` }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[20px] lg:text-[22px] font-black leading-none" style={{ color: scoreColor }}>{score}</span>
                        <span className="text-[7px] lg:text-[8px] text-[var(--text-muted)] font-semibold uppercase tracking-widest mt-0.5">health</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Row 2: Metric Chips ── */}
                {healthData && (
                  <div className="mt-5 flex items-center gap-2 flex-wrap">
                    {[
                      { icon: 'speed', color: '#06b6d4', label: `${healthData.velocity} apps/wk` },
                      { icon: 'mark_email_read', color: '#10b981', label: `${healthData.responseRate}% response` },
                      { icon: 'rate_review', color: '#8b5cf6', label: `${healthData.debriefs} debriefs` },
                    ].map((chip) => (
                      <span
                        key={chip.icon}
                        className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-xl font-medium text-[var(--text-secondary)]"
                        style={{
                          background: `color-mix(in srgb, ${chip.color} 8%, var(--card-bg))`,
                          border: `1px solid color-mix(in srgb, ${chip.color} 15%, transparent)`,
                        }}
                      >
                        <span className="material-symbols-rounded text-[13px]" style={{ color: chip.color }}>{chip.icon}</span>
                        {chip.label}
                      </span>
                    ))}
                    {healthData.topRec && (
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-xl font-medium"
                        style={{
                          background: `color-mix(in srgb, ${healthData.topRec.color} 10%, var(--card-bg))`,
                          border: `1px solid color-mix(in srgb, ${healthData.topRec.color} 20%, transparent)`,
                          color: healthData.topRec.color,
                        }}
                      >
                        <span className="material-symbols-rounded text-[13px]">{healthData.topRec.icon}</span>
                        <span className="truncate max-w-[140px]">{healthData.topRec.title}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* ── Row 3: Twin Completeness + Skills ── */}
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Twin completeness bar */}
                  {completeness !== null && completeness < 100 && (
                    <div className="flex items-center gap-2.5 min-w-0 sm:min-w-[200px]">
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="material-symbols-rounded text-[13px]" style={{ color: theme.accentText }}>person</span>
                        <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Twin</span>
                      </div>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden min-w-[60px] twin-progress-track">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${completeness}%`,
                            background: `linear-gradient(90deg, ${theme.accent}, ${theme.accentAlt})`,
                            boxShadow: `0 0 10px color-mix(in srgb, ${theme.accent} 40%, transparent)`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-bold tabular-nums flex-shrink-0" style={{ color: theme.accentText }}>{completeness}%</span>
                      {nextMissing && (
                        <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[120px] hidden sm:inline">
                          Next: {nextMissing}
                        </span>
                      )}
                      {twinData?.exportable && (
                        <button
                          onClick={(e) => { e.stopPropagation(); window.open('/api/agent/intelligence?export=true', '_blank'); }}
                          className="text-[10px] p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex-shrink-0"
                          title="Export Digital Twin"
                        >
                          <span className="material-symbols-rounded text-[12px]">download</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Confirmed skills chips */}
                  {confirmedSkills.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      {confirmedSkills.map((skill) => (
                        <span
                          key={skill}
                          className="text-[10px] px-2 py-0.5 rounded-md font-medium whitespace-nowrap flex-shrink-0 text-[var(--text-secondary)]"
                          style={{
                            background: `color-mix(in srgb, ${theme.accentAlt} 10%, var(--card-bg))`,
                            border: `1px solid color-mix(in srgb, ${theme.accentAlt} 15%, transparent)`,
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                      {(twinData?.profile?.skills?.confirmed?.length || 0) > 8 && (
                        <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap flex-shrink-0">
                          +{(twinData?.profile?.skills?.confirmed?.length || 0) - 8}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Arrow hint on hover */}
                <div className="absolute top-1/2 -translate-y-1/2 right-5 opacity-0 group-hover:opacity-60 transition-opacity duration-300">
                  <span className="material-symbols-rounded text-[20px] text-[var(--text-muted)]">arrow_forward</span>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* ── Opportunity Radar Widget ── */}
      {user && <JobFeedWidget />}

      {/* ── Grouped Tool Grid ── */}
      {toolGroups.map((group, groupIdx) => (
        <div key={group.label} className="mb-6">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: groupIdx * 0.1 }}
            className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3 px-1"
          >
            {group.label}
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5">
            {group.tools.map((tool, i) => (
              <motion.button
                key={tool.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: groupIdx * 0.08 + i * 0.04 }}
                onClick={() => router.push(tool.path)}
                className="group shimmer-border flex flex-col text-left p-5 rounded-2xl transition-all duration-150 min-h-[130px] relative overflow-hidden"
                style={{
                  '--shimmer-color-1': `rgba(${tool.accentRgb},0.5)`,
                  '--shimmer-color-2': `rgba(${tool.accentRgb},0.3)`,
                  '--shimmer-color-3': `rgba(${tool.accentRgb},0.4)`,
                  animationDelay: `${(groupIdx * 3 + i) * -0.6}s`,
                } as React.CSSProperties}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, rgba(${tool.accentRgb},0.09) 0%, var(--bg-card) 55%)`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = '';
                }}
              >
                <div
                  className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-20 pointer-events-none"
                  style={{ background: `radial-gradient(circle, rgba(${tool.accentRgb},0.6) 0%, transparent 70%)` }}
                />

                <div className="flex items-center gap-3.5 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex shrink-0 items-center justify-center transition-transform duration-150 group-hover:scale-105"
                    style={{
                      background: `rgba(${tool.accentRgb},0.12)`,
                      boxShadow: `0 0 0 1px rgba(${tool.accentRgb},0.2)`,
                    }}
                  >
                    <span className="material-symbols-rounded text-[20px]" style={{ color: tool.iconColor }}>
                      {tool.iconName}
                    </span>
                  </div>

                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)] flex-1 leading-tight">
                    {tool.name}
                  </h3>

                  {tool.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide"
                      style={{
                        background: `rgba(${tool.accentRgb},0.12)`,
                        color: tool.iconColor,
                        border: `1px solid rgba(${tool.accentRgb},0.25)`,
                      }}>
                      {tool.badge}
                    </span>
                  )}
                </div>

                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed min-h-[40px]">
                  <TypewriterText
                    text={tool.description}
                    delay={(groupIdx * 5 + i) * 300}
                    interval={30000}
                  />
                </p>
              </motion.button>
            ))}
          </div>
        </div>
      ))}

      {/* ── Recent Activity ── */}
      {recentActivity.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 mb-2"
        >
          <div className="rounded-xl border border-[var(--border-subtle)] p-4">
            <h2 className="text-xs font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
              <span className="material-symbols-rounded text-[14px]" style={{ color: '#6366f1' }}>history</span>
              Recent Activity
            </h2>
            <div className="space-y-1">
              {recentActivity.map((activity, i) => (
                <button
                  key={i}
                  onClick={() => router.push(activity.path)}
                  className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left hover:bg-[var(--bg-hover)] transition-colors duration-100 group"
                >
                  <span className="material-symbols-rounded text-[14px]" style={{ color: activity.color }}>{activity.icon}</span>
                  <span className="flex-1 text-[12px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] truncate transition-colors">{activity.text}</span>
                  {activity.time && <span className="text-[10px] text-[var(--text-muted)] tabular-nums shrink-0">{activity.time}</span>}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Quick Start ── */}
      <div className="mt-2">
        <div className="rounded-xl border border-[var(--border-subtle)] p-4">
          <h2 className="text-xs font-medium text-[var(--text-secondary)] mb-3">Quick Start</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => router.push('/suite/resume')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] hover:border-[var(--border)] hover:text-[var(--text-primary)] transition-colors duration-100"
            >
              <span className="text-[var(--accent)] text-xs">→</span>
              Upload a resume
            </button>
            <button
              onClick={() => router.push('/suite/flashcards')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] hover:border-[var(--border)] hover:text-[var(--text-primary)] transition-colors duration-100"
            >
              <span className="text-[var(--accent)] text-xs">→</span>
              Practice interviews
            </button>
            <button
              onClick={() => router.push('/suite/agent')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] hover:border-[var(--border)] hover:text-[var(--text-primary)] transition-colors duration-100"
            >
              <span className="text-[var(--accent)] text-xs">→</span>
              Ask Sona anything
            </button>
          </div>
        </div>
      </div>

      {/* ── Vault Memory Strip ── */}
      {vaultStats && vaultStats.total > 0 && (
        <div className="mt-3">
          <div
            onClick={() => router.push('/suite/vault')}
            className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] px-4 py-3 cursor-pointer hover:border-[var(--border)] transition-colors duration-100 group"
          >
            <span className="material-symbols-rounded text-[18px]" style={{ color: '#f97316' }}>folder_open</span>
            <div className="flex items-center gap-1.5 flex-1 flex-wrap">
              <span className="text-xs text-[var(--text-secondary)]">
                <span className="font-medium text-[var(--text-primary)]">{vaultStats.total}</span> saved note{vaultStats.total !== 1 ? 's' : ''} in your vault
              </span>
              {vaultStats.bridge > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  {vaultStats.bridge} Skill Bridge
                </span>
              )}
              {vaultStats.interview > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  {vaultStats.interview} Interview
                </span>
              )}
              {vaultStats.flashcards > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                  {vaultStats.flashcards} Flashcards
                </span>
              )}
            </div>
            <span className="material-symbols-rounded text-[14px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">arrow_forward</span>
          </div>
        </div>
      )}
    </div>
  );
}
