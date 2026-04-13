'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/lib/auth-fetch';
import { showToast } from '@/components/Toast';
import { sanitizeHtml } from '@/lib/sanitize';

interface VaultNote {
  id: string;
  type: 'flashcards' | 'interview' | 'skill-bridge';
  topic: string;
  summary: string;
  createdAt: string;
}

type FilterTab = 'all' | 'skill-bridge' | 'interview' | 'flashcards';

const TYPE_CONFIG = {
  'flashcards': {
    label: 'Flashcards',
    icon: 'edit_document',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/30',
    drillPath: '/suite/flashcards',
    drillLabel: 'Re-drill',
  },
  'interview': {
    label: 'Interview',
    icon: 'mic',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
    drillPath: '/suite/flashcards',
    drillLabel: 'Practice again',
  },
  'skill-bridge': {
    label: 'Skill Bridge',
    icon: 'route',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/30',
    drillPath: '/suite/skill-bridge',
    drillLabel: 'Open Skill Bridge',
  },
} as const;

const READER_LABEL = {
  'flashcards': 'Flashcard Mistakes Summarization',
  'interview': 'Interview Feedback Notes',
  'skill-bridge': 'Skill Bridge Training Curriculum',
};

export default function StudyVaultPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<VaultNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeNote, setActiveNote] = useState<VaultNote | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => { fetchNotes(); }, []);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/vault/list');
      if (!res.ok) throw new Error('Failed to fetch notes');
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (error) {
      console.error(error);
      showToast('Could not load your Study Vault', 'cancel');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await authFetch('/api/vault/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      setNotes(prev => prev.filter(n => n.id !== id));
      if (activeNote?.id === id) setActiveNote(null);
      showToast('Note deleted', 'delete');
    } catch {
      showToast('Could not delete note', 'cancel');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchesFilter = filter === 'all' || n.type === filter;
      const matchesSearch = !search || n.topic.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [notes, filter, search]);

  // Counts for filter tabs
  const counts = useMemo(() => ({
    all: notes.length,
    'skill-bridge': notes.filter(n => n.type === 'skill-bridge').length,
    interview: notes.filter(n => n.type === 'interview').length,
    flashcards: notes.filter(n => n.type === 'flashcards').length,
  }), [notes]);

  const renderMarkdown = (text: string) => {
    let html = text
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold text-[var(--text-primary)] mt-5 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-[var(--accent)] mt-6 mb-3 border-b border-[var(--border-subtle)] pb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-black text-[var(--text-primary)] mt-6 mb-4">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="text-emerald-400 font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em class="text-[var(--text-secondary)] italic">$1</em>')
      .replace(/^\s*-\s+(.*$)/gim, '<li class="ml-5 list-disc text-[var(--text-secondary)] mb-1.5 marker:text-[var(--accent)] pl-1">$1</li>')
      .replace(/\[ \]/gim, '<span class="inline-block w-3.5 h-3.5 rounded border border-[var(--border)] mr-1.5 align-middle"></span>')
      .replace(/\[x\]/gim, '<span class="inline-block w-3.5 h-3.5 rounded bg-emerald-500/30 border border-emerald-500/50 mr-1.5 align-middle text-emerald-400 text-[9px] flex items-center justify-center">✓</span>')
      .replace(/\n\n/gim, '</p><p class="text-[var(--text-secondary)] leading-relaxed mb-4 mt-2">')
      .replace(/\n(?!\s*<)/gim, '<br/>');

    html = `<p class="text-[var(--text-secondary)] leading-relaxed mb-4 mt-2">${html}</p>`;
    html = html.replace(/<p[^>]*>\s*<\/p>/g, '');
    return html;
  };

  const TABS: { key: FilterTab; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'folder_open' },
    { key: 'skill-bridge', label: 'Skill Bridge', icon: 'route' },
    { key: 'interview', label: 'Interview', icon: 'mic' },
    { key: 'flashcards', label: 'Flashcards', icon: 'edit_document' },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>
                <span className="material-symbols-rounded text-[20px]">folder_open</span>
              </span>
              Study Vault
            </h1>
            <p className="text-[var(--text-secondary)] text-sm mt-1">
              {notes.length === 0 ? 'Your AI coaching notes will appear here.' : `${notes.length} saved note${notes.length !== 1 ? 's' : ''} across all sessions.`}
            </p>
          </div>

          {/* Search */}
          {notes.length > 0 && (
            <div className="relative">
              <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-[var(--text-muted)]">search</span>
              <input
                type="text"
                placeholder="Search notes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border)] w-48 transition-all"
              />
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        {notes.length > 0 && (
          <div className="flex gap-1.5 mb-6 flex-wrap">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-100 ${
                  filter === tab.key
                    ? 'bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/20'
                    : 'text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border)]'
                }`}
              >
                <span className="material-symbols-rounded text-[14px]">{tab.icon}</span>
                {tab.label}
                <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${filter === tab.key ? 'bg-[var(--accent)]/10' : 'bg-[var(--bg-hover)]'}`}>
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Sidebar List */}
          <div className="lg:col-span-4 space-y-2">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="h-[80px] rounded-xl bg-[var(--bg-elevated)] animate-pulse border border-[var(--border-subtle)]" />
              ))
            ) : filteredNotes.length === 0 ? (
              <div className="p-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center">
                <span className="material-symbols-rounded text-[40px] text-[var(--text-muted)] block mb-3">inventory_2</span>
                <h3 className="text-[var(--text-primary)] font-medium mb-1">
                  {notes.length === 0 ? 'Your vault is empty' : 'No matches found'}
                </h3>
                <p className="text-[var(--text-secondary)] text-sm">
                  {notes.length === 0
                    ? 'Complete a Gauntlet session or save a Skill Bridge plan.'
                    : 'Try a different search or filter.'}
                </p>
              </div>
            ) : (
              filteredNotes.map(note => {
                const cfg = TYPE_CONFIG[note.type];
                const isActive = activeNote?.id === note.id;
                const isConfirming = confirmDeleteId === note.id;

                return (
                  <motion.div
                    key={note.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className={`group relative rounded-xl border transition-all duration-100 cursor-pointer ${
                      isActive
                        ? 'bg-[var(--accent-dim)] border-[var(--accent)]/20'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border)] hover:bg-[var(--bg-elevated)]'
                    }`}
                    onClick={() => { setActiveNote(note); setConfirmDeleteId(null); }}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded font-medium flex items-center gap-1 ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                          <span className="material-symbols-rounded text-[12px]">{cfg.icon}</span>
                          {cfg.label}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] ml-auto">
                          {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>

                        {/* Delete button */}
                        {!isConfirming ? (
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDeleteId(note.id); }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--danger)] transition-all"
                            title="Delete"
                          >
                            <span className="material-symbols-rounded text-[14px]">delete</span>
                          </button>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(note.id); }}
                            disabled={deletingId === note.id}
                            className="text-[11px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                          >
                            {deletingId === note.id ? '...' : 'Confirm'}
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-medium text-[var(--text-primary)] leading-snug line-clamp-2">
                        {note.topic || 'General Practice'}
                      </p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Reader Panel */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {activeNote ? (
                <motion.div
                  key={activeNote.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] relative overflow-hidden"
                >
                  {/* Accent top bar — color matches note type */}
                  <div className={`absolute top-0 left-0 w-full h-[2px] ${
                    activeNote.type === 'skill-bridge' ? 'bg-emerald-500'
                    : activeNote.type === 'flashcards' ? 'bg-cyan-500'
                    : 'bg-purple-500'
                  }`} />

                  {/* Reader Header */}
                  <div className="px-6 pt-7 pb-4 border-b border-[var(--border-subtle)] flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)] leading-snug mb-1">
                        {activeNote.topic}
                      </h2>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span>{READER_LABEL[activeNote.type]}</span>
                        <span>·</span>
                        <span>{new Date(activeNote.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {/* Re-drill CTA */}
                    <button
                      onClick={() => router.push(TYPE_CONFIG[activeNote.type].drillPath)}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/20 hover:bg-[var(--accent-hover)] transition-colors duration-100"
                    >
                      <span className="material-symbols-rounded text-[14px]">
                        {activeNote.type === 'skill-bridge' ? 'route' : 'replay'}
                      </span>
                      {TYPE_CONFIG[activeNote.type].drillLabel}
                    </button>
                  </div>

                  {/* Markdown Content */}
                  <div
                    className="p-6 overflow-y-auto max-h-[60vh] text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(activeNote.summary)) }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hidden lg:flex min-h-[420px] rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 items-center justify-center flex-col text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-[var(--bg-hover)] flex items-center justify-center mb-4 border border-[var(--border-subtle)]">
                    <span className="material-symbols-rounded text-[28px] text-[var(--text-muted)]">menu_book</span>
                  </div>
                  <h3 className="text-base font-medium text-[var(--text-primary)] mb-1">Select a note</h3>
                  <p className="text-[var(--text-secondary)] text-sm max-w-xs">
                    Click any guide on the left to read your AI coaching notes.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
