'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { authFetch } from '@/lib/auth-fetch';
import { motion } from 'framer-motion';

// Each tool has a vivid icon color + its accent used for the subtle card wash
const tools = [
  {
    id: 'resume',
    name: 'Resume Studio',
    description: 'AI-powered resume builder. Morph your resume for any job description with one click.',
    path: '/suite/resume',
    iconName: 'auto_awesome',
    iconColor: '#f59e0b',   // amber
    accentRgb: '245,158,11',
  },
  {
    id: 'flashcards',
    name: 'Interview Simulator',
    description: 'AI interview simulator. Master any topic with generated study cards and practice rounds.',
    path: '/suite/flashcards',
    iconName: 'chat',
    iconColor: '#3b82f6',   // blue
    accentRgb: '59,130,246',
  },
  {
    id: 'oracle',
    name: 'Market Oracle',
    description: 'Paste any JD — dual-AI decodes fit score, salary intel, red flags, and bridge skills.',
    path: '/suite/market-oracle',
    iconName: 'troubleshoot',
    iconColor: '#a855f7',   // purple
    accentRgb: '168,85,247',
  },
  {
    id: 'applications',
    name: 'Applications',
    description: 'Track your job applications, interview stages, and follow-up reminders.',
    path: '/suite/applications',
    iconName: 'work',
    iconColor: '#22c55e',   // green
    accentRgb: '34,197,94',
  },
  {
    id: 'vault',
    name: 'Study Vault',
    description: 'Your saved practice notes, bookmarks, and interview preparation materials.',
    path: '/suite/vault',
    iconName: 'folder_open',
    iconColor: '#f97316',   // orange
    accentRgb: '249,115,22',
  },
  {
    id: 'skill-bridge',
    name: 'Skill Bridge',
    description: 'AI-generated learning paths. From resume gaps to interview-ready skills.',
    path: '/suite/skill-bridge',
    badge: 'PRO',
    iconName: 'route',
    iconColor: '#10b981',   // emerald
    accentRgb: '16,185,129',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useStore();
  const [greeting, setGreeting] = useState('');
  const [vaultStats, setVaultStats] = useState<{ total: number; bridge: number; interview: number; flashcards: number } | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  useEffect(() => {
    authFetch('/api/vault/list')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.notes) return;
        const notes = data.notes as { type: string }[];
        setVaultStats({
          total: notes.length,
          bridge: notes.filter(n => n.type === 'skill-bridge').length,
          interview: notes.filter(n => n.type === 'interview').length,
          flashcards: notes.filter(n => n.type === 'flashcards').length,
        });
      })
      .catch(() => {});
  }, []);

  const firstName = user?.displayName || user?.email?.split('@')[0] || 'there';

  return (
    <div className="px-4 py-8 lg:px-8 lg:py-10 max-w-[1000px] mx-auto">

      {/* ── Hero Dashboard Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative mb-8 pl-10 lg:pl-0"
      >
        {/* Accent glow behind icon */}
        <div className="flex items-start gap-4">
          <div
            className="hidden lg:flex w-12 h-12 rounded-2xl items-center justify-center flex-shrink-0 mt-0.5"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0.08) 100%)',
              boxShadow: '0 0 0 1px rgba(99,102,241,0.2), 0 4px 16px rgba(99,102,241,0.15)',
            }}
          >
            <span className="material-symbols-rounded text-[24px]" style={{ color: '#6366f1' }}>home</span>
          </div>
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text-primary)]">
              {greeting}, {firstName} 👋
            </h1>
            <p className="text-[14px] text-[var(--text-secondary)] mt-1">
              Your career intelligence hub. Every tool, one place.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Tool Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5">
        {tools.map((tool, i) => (
          <motion.button
            key={tool.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
            onClick={() => router.push(tool.path)}
            className="group flex flex-col text-left p-5 rounded-2xl border transition-all duration-150 min-h-[140px] relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, rgba(${tool.accentRgb},0.055) 0%, var(--bg-card) 55%)`,
              borderColor: `rgba(${tool.accentRgb},0.18)`,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = `rgba(${tool.accentRgb},0.4)`;
              (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, rgba(${tool.accentRgb},0.09) 0%, var(--bg-card) 55%)`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = `rgba(${tool.accentRgb},0.18)`;
              (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, rgba(${tool.accentRgb},0.055) 0%, var(--bg-card) 55%)`;
            }}
          >
            {/* Faint accent circle in top-right corner for depth */}
            <div
              className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-20 pointer-events-none"
              style={{ background: `radial-gradient(circle, rgba(${tool.accentRgb},0.6) 0%, transparent 70%)` }}
            />

            <div className="flex items-center gap-3.5 mb-3">
              {/* Icon with high-contrast color */}
              <div
                className="w-10 h-10 rounded-xl flex shrink-0 items-center justify-center transition-transform duration-150 group-hover:scale-105"
                style={{
                  background: `rgba(${tool.accentRgb},0.12)`,
                  boxShadow: `0 0 0 1px rgba(${tool.accentRgb},0.2)`,
                }}
              >
                <span
                  className="material-symbols-rounded text-[20px]"
                  style={{ color: tool.iconColor }}
                >
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

            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
              {tool.description}
            </p>
          </motion.button>
        ))}
      </div>

      {/* ── Quick Start ── */}
      <div className="mt-6">
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
              onClick={() => router.push('/suite/market-oracle')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] hover:border-[var(--border)] hover:text-[var(--text-primary)] transition-colors duration-100"
            >
              <span className="text-[var(--accent)] text-xs">→</span>
              Decode a JD
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
