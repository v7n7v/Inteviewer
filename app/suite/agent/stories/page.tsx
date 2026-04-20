'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';
import { useStore } from '@/lib/store';
import { authFetch } from '@/lib/auth-fetch';
import PageHelp from '@/components/PageHelp';

interface StarStory {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
  tags: string[];
  createdAt: string;
  source: string;
}

const TAG_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#06b6d4',
  '#f43f5e', '#8b5cf6', '#14b8a6', '#e11d48', '#0ea5e9',
];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export default function StoryBankPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { user } = useStore();

  const [stories, setStories] = useState<StarStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // Question Matcher
  const [matchQuestion, setMatchQuestion] = useState('');
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<any | null>(null);

  // Coverage Map
  const [coverage, setCoverage] = useState<{ covered: { category: string; storyCount: number }[]; uncovered: string[]; totalStories: number; coveragePercent: number } | null>(null);
  const [loadingCoverage, setLoadingCoverage] = useState(false);

  // Manual Story Form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', situation: '', task: '', action: '', result: '', reflection: '', tags: '' });
  const [savingStory, setSavingStory] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadStories();
  }, [user]);

  const loadStories = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/agent/stories');
      if (res.ok) {
        const data = await res.json();
        setStories(data.stories || []);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  const allTags = [...new Set(stories.flatMap(s => s.tags))].sort();
  const filtered = filterTag
    ? stories.filter(s => s.tags.some(t => t.toLowerCase() === filterTag.toLowerCase()))
    : stories;

  const runMatch = async () => {
    if (!matchQuestion.trim()) return;
    setMatching(true);
    setMatchResult(null);
    try {
      const res = await authFetch('/api/agent/stories/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: matchQuestion }),
      });
      if (res.ok) setMatchResult(await res.json());
    } catch { /* silent */ }
    finally { setMatching(false); }
  };

  const loadCoverage = async () => {
    setLoadingCoverage(true);
    try {
      const res = await authFetch('/api/agent/stories/coverage');
      if (res.ok) setCoverage(await res.json());
    } catch { /* silent */ }
    finally { setLoadingCoverage(false); }
  };

  const saveManualStory = async () => {
    if (!formData.title.trim() || !formData.situation.trim()) return;
    setSavingStory(true);
    try {
      const res = await authFetch('/api/agent/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ title: '', situation: '', task: '', action: '', result: '', reflection: '', tags: '' });
        loadStories();
      }
    } catch { /* silent */ }
    finally { setSavingStory(false); }
  };

  useEffect(() => {
    if (user && stories.length > 0) loadCoverage();
  }, [stories.length]);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const cardBg = isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)';
  const cardBorder = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="material-symbols-rounded text-white text-2xl">auto_stories</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Story Bank</h1>
              <p className="text-sm text-[var(--text-tertiary)]">STAR stories for interview prep — built from Sona conversations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/suite/agent"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] transition-colors"
            >
              <span className="material-symbols-rounded text-[14px]">arrow_back</span>
              Back to Sona
            </a>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              <span className="material-symbols-rounded text-sm">{showForm ? 'close' : 'add'}</span>
              {showForm ? 'Cancel' : 'New Story'}
            </motion.button>
            <button
              onClick={loadStories}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] transition-colors"
            >
              <span className="material-symbols-rounded text-[14px]">refresh</span>
              Refresh
            </button>
            <PageHelp toolId="stories" />
          </div>
        </div>
      </motion.div>

      {/* ── Manual Story Form ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-xl p-5 space-y-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span className="material-symbols-rounded text-base" style={{ color: '#f59e0b' }}>edit_note</span>
                Add STAR Story
              </h3>
              <input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="Story title (e.g. 'Cut deploy time 80%')" className="w-full px-3 py-2 rounded-lg text-sm text-[var(--text-primary)] outline-none" style={{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)', border: `1px solid ${cardBorder}` }} />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'situation', label: 'Situation', placeholder: 'What was happening?', color: '#3b82f6' },
                  { key: 'task', label: 'Task', placeholder: 'What were you responsible for?', color: '#10b981' },
                  { key: 'action', label: 'Action', placeholder: 'What did you do?', color: '#f59e0b' },
                  { key: 'result', label: 'Result', placeholder: 'Measurable outcome', color: '#a855f7' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: field.color }}>{field.label}</label>
                    <textarea value={formData[field.key as keyof typeof formData]} onChange={e => setFormData(p => ({ ...p, [field.key]: e.target.value }))} placeholder={field.placeholder} rows={2} className="w-full px-3 py-2 rounded-lg text-xs text-[var(--text-primary)] outline-none resize-none" style={{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)', border: `1px solid ${cardBorder}` }} />
                  </div>
                ))}
              </div>
              <textarea value={formData.reflection} onChange={e => setFormData(p => ({ ...p, reflection: e.target.value }))} placeholder="Reflection — what did you learn? (optional)" rows={2} className="w-full px-3 py-2 rounded-lg text-xs text-[var(--text-primary)] outline-none resize-none" style={{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)', border: `1px solid ${cardBorder}` }} />
              <input value={formData.tags} onChange={e => setFormData(p => ({ ...p, tags: e.target.value }))} placeholder="Tags (comma-separated: leadership, python, optimization)" className="w-full px-3 py-2 rounded-lg text-xs text-[var(--text-primary)] outline-none" style={{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)', border: `1px solid ${cardBorder}` }} />
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={saveManualStory} disabled={savingStory || !formData.title.trim() || !formData.situation.trim()} className="w-full py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                {savingStory ? <span className="material-symbols-rounded animate-spin text-sm">progress_activity</span> : <span className="material-symbols-rounded text-sm">save</span>}
                {savingStory ? 'Saving...' : 'Save Story'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Question Matcher ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
      >
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-3">
          <span className="material-symbols-rounded text-base" style={{ color: '#3b82f6' }}>psychology</span>
          Question Matcher
        </h3>
        <p className="text-[11px] text-[var(--text-muted)] mb-3">
          Paste a behavioral interview question and find which STAR stories match.
        </p>
        <div className="flex gap-2">
          <input
            value={matchQuestion}
            onChange={e => setMatchQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runMatch()}
            placeholder='e.g. "Tell me about a time you led a team through a difficult project"'
            className="flex-1 px-3 py-2.5 rounded-lg text-sm text-[var(--text-primary)] outline-none"
            style={{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)', border: `1px solid ${cardBorder}` }}
          />
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={runMatch}
            disabled={matching || !matchQuestion.trim()}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
          >
            {matching ? <span className="material-symbols-rounded text-sm animate-spin">progress_activity</span> : <span className="material-symbols-rounded text-sm">search</span>}
            {matching ? 'Matching...' : 'Match'}
          </motion.button>
        </div>

        {/* Match Result */}
        <AnimatePresence>
          {matchResult && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-4 space-y-3">
                {/* Categories */}
                <div className="flex flex-wrap gap-1.5">
                  {matchResult.categories?.map((c: any) => (
                    <span key={c.category} className="text-[10px] px-2 py-1 rounded-full font-medium capitalize"
                      style={{ background: `${c.confidence >= 80 ? '#22c55e' : c.confidence >= 50 ? '#f59e0b' : '#6b7280'}12`, color: c.confidence >= 80 ? '#22c55e' : c.confidence >= 50 ? '#f59e0b' : '#6b7280', border: `1px solid ${c.confidence >= 80 ? '#22c55e' : c.confidence >= 50 ? '#f59e0b' : '#6b7280'}25` }}>
                      {c.category} ({c.confidence}%)
                    </span>
                  ))}
                </div>

                {/* Matched story */}
                {matchResult.story ? (
                  <div className="rounded-lg p-4" style={{ background: isLight ? 'rgba(59,130,246,0.04)' : 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-rounded text-sm" style={{ color: '#22c55e' }}>check_circle</span>
                      <span className="text-xs font-bold text-[var(--text-primary)]">Matched: {matchResult.story.title}</span>
                      {matchResult.alternateStories > 0 && (
                        <span className="text-[10px] text-[var(--text-muted)]">+{matchResult.alternateStories} alternates</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {[{ l: 'S', v: matchResult.story.situation }, { l: 'T', v: matchResult.story.task }, { l: 'A', v: matchResult.story.action }, { l: 'R', v: matchResult.story.result }].map(p => p.v && (
                        <p key={p.l} className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          <span className="font-bold text-[var(--text-primary)]">{p.l}:</span> {p.v}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg p-4 text-center" style={{ background: '#ef444408', border: '1px solid #ef444418' }}>
                    <span className="material-symbols-rounded text-[24px] block mb-1" style={{ color: '#ef4444' }}>warning</span>
                    <p className="text-xs text-[var(--text-secondary)]">No matching story found. This is a gap in your prep.</p>
                    <a href="/suite/agent" className="text-[10px] font-medium mt-1 inline-block" style={{ color: '#3b82f6' }}>Tell Sona about a relevant experience →</a>
                  </div>
                )}

                {/* Drafted answer */}
                {matchResult.answer && matchResult.story && (
                  <div className="rounded-lg p-3" style={{ background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', border: `1px solid ${cardBorder}` }}>
                    <span className="text-[10px] font-bold text-[var(--text-muted)] block mb-1">DRAFTED ANSWER</span>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">{matchResult.answer}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Coverage Map ── */}
      {coverage && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="material-symbols-rounded text-base" style={{ color: '#10b981' }}>grid_view</span>
              Interview Prep Coverage
            </h3>
            <span className="text-xs font-bold" style={{ color: coverage.coveragePercent >= 70 ? '#22c55e' : coverage.coveragePercent >= 40 ? '#f59e0b' : '#ef4444' }}>
              {coverage.coveragePercent}% covered
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {[...coverage.covered.map(c => ({ ...c, status: 'covered' as const })), ...coverage.uncovered.map(u => ({ category: u, storyCount: 0, status: 'gap' as const }))]
              .sort((a, b) => a.category.localeCompare(b.category))
              .map(item => (
                <div key={item.category} className="rounded-lg p-2.5 text-center transition-all cursor-default" style={{
                  background: item.status === 'covered' ? (isLight ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.08)') : (isLight ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.06)'),
                  border: `1px solid ${item.status === 'covered' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)'}`,
                }}>
                  <span className="material-symbols-rounded text-[14px] block mb-0.5" style={{ color: item.status === 'covered' ? '#22c55e' : '#ef4444' }}>
                    {item.status === 'covered' ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <p className="text-[10px] font-medium capitalize text-[var(--text-primary)]">{item.category}</p>
                  {item.storyCount > 0 && <p className="text-[9px] text-[var(--text-muted)]">{item.storyCount} {item.storyCount === 1 ? 'story' : 'stories'}</p>}
                </div>
              ))}
          </div>
          {coverage.uncovered.length > 0 && (
            <p className="text-[10px] text-[var(--text-muted)] mt-3">
              <span className="material-symbols-rounded text-[12px] align-middle mr-0.5" style={{ color: '#f59e0b' }}>lightbulb</span> Gap areas: Chat with Sona about experiences related to <span className="font-bold">{coverage.uncovered.slice(0, 3).join(', ')}</span>{coverage.uncovered.length > 3 ? ` and ${coverage.uncovered.length - 3} more` : ''} to strengthen your prep.
            </p>
          )}
        </motion.div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Stories', value: stories.length, icon: 'library_books', color: '#3b82f6' },
          { label: 'Unique Skills', value: allTags.length, icon: 'sell', color: '#10b981' },
          { label: 'Interview Ready', value: stories.filter(s => s.situation && s.result).length, icon: 'verified', color: '#f59e0b' },
          { label: 'Coverage', value: coverage ? `${coverage.coveragePercent}%` : '—', icon: 'grid_view', color: '#8b5cf6' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-xl p-4"
            style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-rounded text-[16px]" style={{ color: stat.color }}>{stat.icon}</span>
              <span className="text-[11px] text-[var(--text-muted)]">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap gap-2"
        >
          <button
            onClick={() => setFilterTag(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              !filterTag ? 'text-white' : 'text-[var(--text-secondary)]'
            }`}
            style={{
              background: !filterTag
                ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                : isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${!filterTag ? '#3b82f6' : cardBorder}`,
            }}
          >
            All ({stories.length})
          </button>
          {allTags.map(tag => {
            const isActive = filterTag === tag;
            const color = getTagColor(tag);
            return (
              <button
                key={tag}
                onClick={() => setFilterTag(isActive ? null : tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive ? 'text-white' : 'text-[var(--text-secondary)]'
                }`}
                style={{
                  background: isActive ? color : isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isActive ? color : cardBorder}`,
                }}
              >
                {tag}
              </button>
            );
          })}
        </motion.div>
      )}

      {/* Stories */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-[var(--bg-elevated)]" />
                  <div className="h-3 w-32 rounded bg-[var(--bg-elevated)]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
          <div className="max-w-sm mx-auto rounded-2xl p-8 relative overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-yellow-500/5" />
            <div className="relative">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <span className="material-symbols-rounded text-3xl text-amber-500">auto_stories</span>
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                {stories.length > 0 ? 'No Matching Stories' : 'Your Story Bank is Empty'}
              </h3>
              <p className="text-sm text-[var(--text-tertiary)] mb-5">
                {stories.length > 0
                  ? 'Try a different tag or view all stories.'
                  : 'Chat with Sona about achievements and she\'ll auto-save them as STAR stories.'}
              </p>
              {stories.length === 0 && (
                <a href="/suite/agent"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 16px rgba(245,158,11,0.3)' }}>
                  <span className="material-symbols-rounded text-sm">chat</span>
                  Start a Conversation
                </a>
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((story, i) => {
              const isExpanded = expandedId === story.id;
              return (
                <motion.div
                  key={story.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl overflow-hidden cursor-pointer transition-all"
                  style={{
                    background: cardBg,
                    border: `1px solid ${isExpanded ? '#f59e0b30' : cardBorder}`,
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : story.id)}
                >
                  {/* Story header */}
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: '#f59e0b15', border: '1px solid #f59e0b20' }}
                      >
                        <span className="material-symbols-rounded text-[20px]" style={{ color: '#f59e0b' }}>auto_stories</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{story.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[var(--text-muted)]">{formatDate(story.createdAt)}</span>
                          {story.source === 'chat' && (
                            <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5">
                              <span className="material-symbols-rounded text-[10px]">auto_awesome</span>
                              Auto-saved
                            </span>
                          )}
                          {story.source === 'fit_analysis' && (
                            <span className="text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-full" style={{
                              background: '#3b82f610', color: '#3b82f6', border: '1px solid #3b82f620',
                            }}>
                              <span className="material-symbols-rounded text-[10px]">target</span>
                              From fit analysis
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {story.tags.slice(0, 2).map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: `${getTagColor(tag)}15`,
                            color: getTagColor(tag),
                            border: `1px solid ${getTagColor(tag)}25`,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                      <span
                        className="material-symbols-rounded text-[18px] text-[var(--text-muted)] transition-transform"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}
                      >
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Expanded STAR content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div
                          className="px-5 pb-5 pt-2 space-y-4 border-t"
                          style={{ borderColor: cardBorder }}
                        >
                          {[
                            { label: 'Situation', value: story.situation, icon: 'location_on', color: '#3b82f6' },
                            { label: 'Task', value: story.task, icon: 'task_alt', color: '#10b981' },
                            { label: 'Action', value: story.action, icon: 'bolt', color: '#f59e0b' },
                            { label: 'Result', value: story.result, icon: 'emoji_events', color: '#a855f7' },
                          ].map(section => (
                            <div key={section.label}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="material-symbols-rounded text-[14px]" style={{ color: section.color }}>{section.icon}</span>
                                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: section.color }}>
                                  {section.label}
                                </span>
                              </div>
                              <p className="text-sm text-[var(--text-secondary)] leading-relaxed pl-6">
                                {section.value || '—'}
                              </p>
                            </div>
                          ))}

                          {story.reflection && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="material-symbols-rounded text-[14px]" style={{ color: '#06b6d4' }}>lightbulb</span>
                                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#06b6d4' }}>
                                  Reflection
                                </span>
                              </div>
                              <p className="text-sm text-[var(--text-secondary)] leading-relaxed pl-6 italic">
                                {story.reflection}
                              </p>
                            </div>
                          )}

                          {/* Tags */}
                          {story.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-2">
                              {story.tags.map(tag => (
                                <span
                                  key={tag}
                                  className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                                  style={{
                                    background: `${getTagColor(tag)}10`,
                                    color: getTagColor(tag),
                                    border: `1px solid ${getTagColor(tag)}20`,
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Tip footer */}
      {stories.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{ background: '#f59e0b08', border: '1px solid #f59e0b15' }}
        >
          <span className="material-symbols-rounded text-[18px] mt-0.5" style={{ color: '#f59e0b' }}>tips_and_updates</span>
          <div>
            <p className="text-xs font-medium text-[var(--text-primary)]">Tip: Your stories grow automatically</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Every time you share an achievement with Sona, she saves it here. The more you chat, the stronger your interview prep becomes.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
