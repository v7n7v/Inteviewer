'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/lib/auth-fetch';
import { showToast } from '@/components/Toast';
import PageHelp from '@/components/PageHelp';
import { sanitizeHtml } from '@/lib/sanitize';
import { getResumeVersions, getAllStudyProgress, getJobApplications, type ResumeVersion, type StudyProgress, type JobApplication } from '@/lib/database-suite';

interface VaultNote {
  id: string;
  type: 'flashcards' | 'interview' | 'skill-bridge';
  topic: string;
  summary: string;
  createdAt: string;
}

type FilterTab = 'all' | 'skill-bridge' | 'interview' | 'flashcards' | 'resumes';

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

  // Resume library state
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);
  const [studyProgress, setStudyProgress] = useState<StudyProgress[]>([]);
  const [jobApps, setJobApps] = useState<JobApplication[]>([]);
  const [activeResume, setActiveResume] = useState<ResumeVersion | null>(null);

  useEffect(() => { fetchNotes(); fetchResumeData(); }, []);

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

  const fetchResumeData = async () => {
    try {
      const [rRes, spRes, jaRes] = await Promise.all([
        getResumeVersions(),
        getAllStudyProgress(),
        getJobApplications(),
      ]);
      if (rRes.success && rRes.data) setResumes(rRes.data);
      if (spRes.success && spRes.data) setStudyProgress(spRes.data);
      if (jaRes.success && jaRes.data) setJobApps(jaRes.data);
    } catch (e) { console.error('Resume data load error:', e); }
  };

  // Get study progress linked to a resume
  const getLinkedProgress = (resume: ResumeVersion): StudyProgress[] => {
    // Find applications that used this resume
    const linkedAppIds = jobApps
      .filter(a => a.resume_version_id === resume.id)
      .map(a => a.id);
    // Find study progress with matching application_ids
    const byApp = studyProgress.filter(sp =>
      sp.application_ids?.some(aid => linkedAppIds.includes(aid))
    );
    if (byApp.length > 0) return byApp;
    // Fallback: match by skill name from resume content
    // skills can be [{items: string[], category: string}] or string[]
    const rawSkills = (resume.content as any)?.skills || [];
    const resumeSkills: string[] = rawSkills.flatMap((s: any) => typeof s === 'string' ? [s.toLowerCase()] : (s.items || []).map((i: string) => i.toLowerCase()));
    if (resumeSkills.length === 0) return [];
    return studyProgress.filter(sp => resumeSkills.some((rs: string) => sp.skill.toLowerCase().includes(rs) || rs.includes(sp.skill.toLowerCase())));
  };

  const filteredNotes = useMemo(() => {
    if (filter === 'resumes') return [];
    return notes.filter(n => {
      const matchesFilter = filter === 'all' || n.type === filter;
      const matchesSearch = !search || n.topic.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [notes, filter, search]);

  const filteredResumes = useMemo(() => {
    if (filter !== 'resumes') return [];
    if (!search) return resumes;
    return resumes.filter(r => r.version_name.toLowerCase().includes(search.toLowerCase()));
  }, [resumes, filter, search]);

  const counts = useMemo(() => ({
    all: notes.length,
    'skill-bridge': notes.filter(n => n.type === 'skill-bridge').length,
    interview: notes.filter(n => n.type === 'interview').length,
    flashcards: notes.filter(n => n.type === 'flashcards').length,
    resumes: resumes.length,
  }), [notes, resumes]);

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
    { key: 'resumes', label: 'Resumes', icon: 'description' },
    { key: 'skill-bridge', label: 'Skill Bridge', icon: 'route' },
    { key: 'interview', label: 'Interview', icon: 'mic' },
    { key: 'flashcards', label: 'Flashcards', icon: 'edit_document' },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="material-symbols-rounded text-white text-2xl">folder_open</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Study Vault</h1>
              <p className="text-sm text-[var(--text-tertiary)]">
                {notes.length === 0 ? 'Your AI coaching notes will appear here' : `${notes.length} saved note${notes.length !== 1 ? 's' : ''} across all sessions`}
              </p>
            </div>
          </div>

          {/* Search */}
          {(notes.length > 0 || resumes.length > 0) && (
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
          <PageHelp toolId="vault" />
        </motion.div>

        {/* Filter Tabs */}
        {(notes.length > 0 || resumes.length > 0) && (
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
            ) : filter === 'resumes' ? (
              filteredResumes.length === 0 ? (
                <div className="p-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center">
                  <span className="material-symbols-rounded text-[40px] text-[var(--text-muted)] block mb-3">description</span>
                  <h3 className="text-[var(--text-primary)] font-medium mb-1">No resumes yet</h3>
                  <p className="text-[var(--text-secondary)] text-sm">Save a resume in Resume Studio to see it here.</p>
                </div>
              ) : filteredResumes.map(r => {
                const isActive = activeResume?.id === r.id;
                const linked = getLinkedProgress(r);
                const content = r.content as any;
                return (
                  <motion.div key={r.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className={`group relative rounded-xl border transition-all duration-100 cursor-pointer ${isActive ? 'bg-[var(--accent-dim)] border-[var(--accent)]/20' : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border)] hover:bg-[var(--bg-elevated)]'}`}
                    onClick={() => { setActiveResume(r); setActiveNote(null); }}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] px-2 py-0.5 rounded font-medium flex items-center gap-1 bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          <span className="material-symbols-rounded text-[12px]">description</span>{r.mode}
                        </span>
                        {r.matchScore && <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">{r.matchScore}%</span>}
                        <span className="text-[11px] text-[var(--text-muted)] ml-auto">{new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <p className="text-sm font-medium text-[var(--text-primary)] leading-snug line-clamp-1">{r.version_name || content?.name || 'Resume'}</p>
                      {linked.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-[var(--text-muted)]">
                          <span className="material-symbols-rounded text-[11px]">school</span>
                          {linked.length} skill{linked.length !== 1 ? 's' : ''} in training
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })
            ) : filteredNotes.length === 0 ? (
              <div className="p-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center">
                <span className="material-symbols-rounded text-[40px] text-[var(--text-muted)] block mb-3">inventory_2</span>
                <h3 className="text-[var(--text-primary)] font-medium mb-1">{notes.length === 0 ? 'Your vault is empty' : 'No matches found'}</h3>
                <p className="text-[var(--text-secondary)] text-sm">{notes.length === 0 ? 'Complete a Gauntlet session or save a Skill Bridge plan.' : 'Try a different search or filter.'}</p>
              </div>
            ) : (
              filteredNotes.map(note => {
                const cfg = TYPE_CONFIG[note.type];
                const isActive = activeNote?.id === note.id;
                const isConfirming = confirmDeleteId === note.id;
                return (
                  <motion.div key={note.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                    className={`group relative rounded-xl border transition-all duration-100 cursor-pointer ${isActive ? 'bg-[var(--accent-dim)] border-[var(--accent)]/20' : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border)] hover:bg-[var(--bg-elevated)]'}`}
                    onClick={() => { setActiveNote(note); setActiveResume(null); setConfirmDeleteId(null); }}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded font-medium flex items-center gap-1 ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                          <span className="material-symbols-rounded text-[12px]">{cfg.icon}</span>{cfg.label}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] ml-auto">{new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        {!isConfirming ? (
                          <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(note.id); }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--danger)] transition-all" title="Delete">
                            <span className="material-symbols-rounded text-[14px]">delete</span>
                          </button>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); handleDelete(note.id); }} disabled={deletingId === note.id} className="text-[11px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors">
                            {deletingId === note.id ? '...' : 'Confirm'}
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-medium text-[var(--text-primary)] leading-snug line-clamp-2">{note.topic || 'General Practice'}</p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Reader Panel */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {activeResume ? (
                <ResumeReaderPanel resume={activeResume} linked={getLinkedProgress(activeResume)} jobApps={jobApps} router={router} />
              ) : activeNote ? (
                <motion.div key={activeNote.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.15 }}
                  className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-full h-[2px] ${activeNote.type === 'skill-bridge' ? 'bg-emerald-500' : activeNote.type === 'flashcards' ? 'bg-cyan-500' : 'bg-purple-500'}`} />
                  <div className="px-6 pt-7 pb-4 border-b border-[var(--border-subtle)] flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)] leading-snug mb-1">{activeNote.topic}</h2>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span>{READER_LABEL[activeNote.type]}</span><span>·</span>
                        <span>{new Date(activeNote.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <button onClick={() => router.push(TYPE_CONFIG[activeNote.type].drillPath)} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/20 hover:bg-[var(--accent-hover)] transition-colors duration-100">
                      <span className="material-symbols-rounded text-[14px]">{activeNote.type === 'skill-bridge' ? 'route' : 'replay'}</span>
                      {TYPE_CONFIG[activeNote.type].drillLabel}
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto max-h-[60vh] text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(activeNote.summary)) }} />
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hidden lg:flex min-h-[420px] rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 items-center justify-center flex-col text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--bg-hover)] flex items-center justify-center mb-4 border border-[var(--border-subtle)]">
                    <span className="material-symbols-rounded text-[28px] text-[var(--text-muted)]">menu_book</span>
                  </div>
                  <h3 className="text-base font-medium text-[var(--text-primary)] mb-1">Select an item</h3>
                  <p className="text-[var(--text-secondary)] text-sm max-w-xs">Click any note or resume on the left to view details.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// Extracted to keep main component readable
function ResumeReaderPanel({ resume, linked, jobApps, router }: { resume: ResumeVersion; linked: StudyProgress[]; jobApps: JobApplication[]; router: any }) {
  const content = resume.content as any;
  // skills can be [{items: string[], category: string}] or string[]
  const rawSkills = content?.skills || [];
  const skills: string[] = rawSkills.flatMap((s: any) => typeof s === 'string' ? [s] : (s.items || []));
  const linkedApps = jobApps.filter(a => a.resume_version_id === resume.id);

  return (
    <motion.div key={`resume-${resume.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.15 }}
      className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500" />
      <div className="px-6 pt-7 pb-4 border-b border-[var(--border-subtle)] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] leading-snug mb-1">{resume.version_name}</h2>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>{resume.mode} resume</span><span>·</span>
            <span>{new Date(resume.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {resume.matchScore && <><span>·</span><span className="text-emerald-400 font-medium">{resume.matchScore}% match</span></>}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => router.push('/suite/skill-bridge')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
            <span className="material-symbols-rounded text-[14px]">route</span>Study Skills
          </button>
          <button onClick={() => router.push('/suite/resume')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/20 hover:bg-[var(--accent-hover)] transition-colors">
            <span className="material-symbols-rounded text-[14px]">edit</span>Open Studio
          </button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
        {skills.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <span className="material-symbols-rounded text-[16px] text-blue-400">psychology</span>Resume Skills ({skills.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s, i) => <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">{s}</span>)}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <span className="material-symbols-rounded text-[16px] text-emerald-400">school</span>Study Progress {linked.length > 0 && `(${linked.length})`}
          </h3>
          {linked.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-hover)]/50 text-center">
              <p className="text-sm text-[var(--text-muted)]">No training plans yet for this resume&apos;s skills.</p>
              <button onClick={() => router.push('/suite/skill-bridge')} className="mt-2 text-xs text-[var(--accent)] hover:underline">→ Start Skill Bridge</button>
            </div>
          ) : (
            <div className="space-y-2">
              {linked.map(sp => {
                const pct = sp.total_days > 0 ? Math.round((sp.completed_days.length / sp.total_days) * 100) : 0;
                const isDone = pct >= 100;
                return (
                  <div key={sp.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-subtle)]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{sp.skill}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${sp.category === 'technical' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : sp.category === 'soft' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>{sp.category}</span>
                        {isDone && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">✓ Done</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-[var(--bg-surface)]">
                          <motion.div className={`h-full rounded-full ${isDone ? 'bg-emerald-500' : 'bg-blue-500'}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--text-muted)] flex-shrink-0">{sp.completed_days.length}/{sp.total_days}d</span>
                      </div>
                    </div>
                    <span className={`text-lg font-black ${isDone ? 'text-emerald-400' : pct > 50 ? 'text-blue-400' : 'text-[var(--text-muted)]'}`}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {linkedApps.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <span className="material-symbols-rounded text-[16px] text-amber-400">work</span>Applied To ({linkedApps.length})
            </h3>
            <div className="space-y-1.5">
              {linkedApps.map(app => (
                <div key={app.id} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="material-symbols-rounded text-[14px] text-[var(--text-muted)]">business</span>
                  {app.job_title || 'Position'} @ {app.company_name}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ml-auto ${app.status === 'offer' || app.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400' : app.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'}`}>{app.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

