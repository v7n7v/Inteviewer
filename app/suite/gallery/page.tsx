'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import { authFetch } from '@/lib/auth-fetch';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useUserTier } from '@/hooks/use-user-tier';

// ── Tool Registry ──
interface GalleryTool {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
  tier: 'free' | 'pro';
  placeholder: string;
  custom?: boolean; // uses dedicated API, not generic /api/ai
}

const TOOLS: GalleryTool[] = [
  {
    id: 'cover-letter',
    label: 'Cover Letter Generator',
    description: 'Dual-AI powered cover letters tailored to your resume and target job.',
    icon: 'mail',
    color: '#10b981',
    gradient: 'from-emerald-500/20 to-teal-500/20',
    tier: 'pro',
    placeholder: 'Paste your resume text here...',
    custom: true,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn Optimizer',
    description: 'Generate a search-optimized headline, about section, and skills from your resume.',
    icon: 'work',
    color: '#3b82f6',
    gradient: 'from-blue-500/20 to-indigo-500/20',
    tier: 'pro',
    placeholder: 'Paste your resume text here...',
    custom: true,
  },
  {
    id: 'grammar-checker',
    label: 'Grammar Checker',
    description: 'Fix grammar, punctuation, and style issues instantly.',
    icon: 'spellcheck',
    color: '#10b981',
    gradient: 'from-emerald-500/20 to-teal-500/20',
    tier: 'free',
    placeholder: 'Paste your text to check for grammar and style issues...',
  },
  {
    id: 'citation-machine',
    label: 'Citation Machine',
    description: 'Generate APA, MLA, Chicago, and Harvard citations.',
    icon: 'format_quote',
    color: '#3b82f6',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    tier: 'free',
    placeholder: 'Enter source info: Author, Title, Year, Publisher, URL...',
  },
  {
    id: 'word-counter',
    label: 'Word Counter',
    description: 'Get detailed text statistics: words, sentences, reading time.',
    icon: 'calculate',
    color: '#06b6d4',
    gradient: 'from-cyan-500/20 to-sky-500/20',
    tier: 'free',
    placeholder: 'Paste text to get word count, reading time, and more...',
  },
  {
    id: 'summarizer',
    label: 'Summarizer',
    description: 'Condense long text into key points and bullet summaries.',
    icon: 'compress',
    color: '#f59e0b',
    gradient: 'from-amber-500/20 to-yellow-500/20',
    tier: 'free',
    placeholder: 'Paste the article or text you want summarized...',
  },
  {
    id: 'tone-analyzer',
    label: 'Tone Analyzer',
    description: 'Analyze the emotional tone, formality, and sentiment.',
    icon: 'sentiment_satisfied',
    color: '#8b5cf6',
    gradient: 'from-violet-500/20 to-purple-500/20',
    tier: 'free',
    placeholder: 'Paste text to analyze its tone and sentiment...',
  },
  {
    id: 'paraphraser',
    label: 'Paraphraser',
    description: 'Rewrite text in 3 styles: formal, casual, and concise.',
    icon: 'swap_horiz',
    color: '#f43f5e',
    gradient: 'from-rose-500/20 to-pink-500/20',
    tier: 'pro',
    placeholder: 'Paste the text you want paraphrased...',
  },
  {
    id: 'email-composer',
    label: 'Email Composer',
    description: 'Draft polished professional emails from rough notes.',
    icon: 'mail',
    color: '#ec4899',
    gradient: 'from-pink-500/20 to-fuchsia-500/20',
    tier: 'pro',
    placeholder: 'Describe the email: recipient, purpose, key points...',
  },
  {
    id: 'thesis-generator',
    label: 'Thesis Generator',
    description: 'Generate strong, arguable thesis statements for essays.',
    icon: 'school',
    color: '#14b8a6',
    gradient: 'from-teal-500/20 to-emerald-500/20',
    tier: 'pro',
    placeholder: 'Enter your essay topic and position...',
  },
];

// ── Helper: extract resume text from stored resume data ──
function resumeDataToText(resume: any): string {
  if (!resume) return '';
  return [
    resume.name, resume.title, resume.email, resume.phone,
    resume.summary,
    ...(resume.experience || []).map((e: any) =>
      `${e.title || e.role} at ${e.company}${e.duration ? ` (${e.duration})` : ''}: ${(e.achievements || []).join('. ')}`
    ),
    ...(resume.education || []).map((e: any) =>
      `${e.degree} from ${e.institution || e.school}`
    ),
    'Skills: ' + (resume.skills || []).flatMap((s: any) =>
      typeof s === 'string' ? [s] : (s.items || [])
    ).join(', '),
  ].filter(Boolean).join('\n');
}

// ── Main Page ──
export default function GalleryPage() {
  const { user } = useStore();
  const { handleApiError, renderAuthModal } = useAuthGate();
  const { tier } = useUserTier();
  const searchParams = useSearchParams();

  const [selectedTool, setSelectedTool] = useState<GalleryTool | null>(null);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Context-aware state
  const [resumeContext, setResumeContext] = useState<{ resume: any; jd: string } | null>(null);
  const [jdInput, setJdInput] = useState('');
  const [companyInput, setCompanyInput] = useState('');
  const [toneInput, setToneInput] = useState<'professional' | 'friendly' | 'bold'>('professional');
  const [targetRoleInput, setTargetRoleInput] = useState('');

  const isPro = tier === 'pro' || tier === 'studio' || tier === 'god';

  // Load resume context from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('talent-resume-draft');
      if (!saved) return;
      const draft = JSON.parse(saved);
      const resume = draft.morphedResume || draft.originalResume;
      if (resume) {
        setResumeContext({ resume, jd: draft.jobDescription || '' });
      }
    } catch { /* ignore corrupt storage */ }
  }, []);

  // Auto-open tool from URL param (e.g. /suite/gallery?tool=cover-letter)
  useEffect(() => {
    const toolId = searchParams.get('tool');
    if (toolId) {
      const tool = TOOLS.find(t => t.id === toolId);
      if (tool) {
        selectTool(tool);
      }
    }
  }, [searchParams]);

  const selectTool = (tool: GalleryTool) => {
    const isLocked = tool.tier === 'pro' && !isPro;
    if (isLocked) { showToast('Upgrade to Pro for this tool', 'lock'); return; }

    setSelectedTool(tool);
    setResult(null);

    // Auto-populate from context for custom tools
    if (tool.custom && resumeContext) {
      const text = resumeDataToText(resumeContext.resume);
      setInput(text);
      setJdInput(resumeContext.jd || '');
      setTargetRoleInput(resumeContext.resume?.title || '');
    } else {
      setInput('');
      setJdInput('');
    }
  };

  // ── Run Tool ──
  const runTool = useCallback(async () => {
    if (!selectedTool) return;
    if (!input.trim()) {
      showToast('Enter some text first', 'cancel');
      return;
    }

    if (selectedTool.tier === 'pro' && !isPro) {
      showToast('This tool requires Pro or Studio', 'lock');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // ── Cover Letter (custom API) ──
      if (selectedTool.id === 'cover-letter') {
        if (!jdInput.trim()) {
          showToast('Paste a job description for the best results', 'info');
        }
        const res = await authFetch('/api/resume/cover-letter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resumeText: input,
            jobDescription: jdInput || 'General professional position',
            companyName: companyInput || undefined,
            tone: toneInput,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (handleApiError(data)) { setIsLoading(false); return; }
          throw new Error(data.error);
        }
        setResult({ type: 'cover-letter', ...data });
        showToast(`Cover letter generated! Score: ${data.score}/100`, 'check_circle');
        setIsLoading(false);
        return;
      }

      // ── LinkedIn (custom API) ──
      if (selectedTool.id === 'linkedin') {
        const res = await authFetch('/api/resume/linkedin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resumeText: input,
            targetRole: targetRoleInput || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (handleApiError(data)) { setIsLoading(false); return; }
          throw new Error(data.error);
        }
        setResult({ type: 'linkedin', ...data });
        showToast(`LinkedIn profile generated! Score: ${data.score}/100`, 'check_circle');
        setIsLoading(false);
        return;
      }

      // ── Word counter (client-side) ──
      if (selectedTool.id === 'word-counter') {
        const text = input;
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        const chars = text.length;
        const charsNoSpaces = text.replace(/\s/g, '').length;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
        const avgWPS = sentences > 0 ? Math.round(words / sentences) : 0;

        setResult({
          words,
          characters: chars,
          charactersNoSpaces: charsNoSpaces,
          sentences,
          paragraphs,
          avgWordsPerSentence: avgWPS,
          readingTimeMinutes: Math.ceil(words / 250),
          speakingTimeMinutes: Math.ceil(words / 150),
        });
        setIsLoading(false);
        return;
      }

      // ── Generic tools (via /api/ai) ──
      const res = await authFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'json',
          prompt: input,
          systemPrompt: `You are a ${selectedTool.label}. ${selectedTool.description} Respond with a JSON object.`,
          usageFeature: 'galleryTools',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (handleApiError(err)) { setIsLoading(false); return; }
        throw new Error(err.error || 'Tool execution failed');
      }

      const data = await res.json();
      let parsed = data;
      if (typeof data === 'string') {
        try { parsed = JSON.parse(data); } catch { parsed = { result: data }; }
      }
      setResult(parsed);
      showToast(`${selectedTool.label} complete`, selectedTool.icon);
    } catch (error) {
      console.error('Gallery tool error:', error);
      showToast('Tool execution failed', 'cancel');
    } finally {
      setIsLoading(false);
    }
  }, [selectedTool, input, jdInput, companyInput, toneInput, targetRoleInput, isPro, handleApiError]);

  const closeTool = () => {
    setSelectedTool(null);
    setInput('');
    setJdInput('');
    setCompanyInput('');
    setTargetRoleInput('');
    setResult(null);
  };

  // ── Render: Cover Letter Result ──
  const renderCoverLetterResult = (data: any) => (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest">Cover Letter</p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
            Score: {data.score}/100
          </span>
          {data.refined && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}>
              Dual-AI Refined
            </span>
          )}
        </div>
      </div>
      <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap">
        {data.coverLetter}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { navigator.clipboard.writeText(data.coverLetter); showToast('Copied!', 'check_circle'); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border)] hover:text-[var(--text-primary)] transition-all"
        >
          <span className="material-symbols-rounded text-[14px]">content_copy</span> Copy to Clipboard
        </button>
        <button
          onClick={() => {
            const blob = new Blob([data.coverLetter], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'cover-letter.txt'; a.click();
            URL.revokeObjectURL(url);
            showToast('Downloaded!', 'download');
          }}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border)] hover:text-[var(--text-primary)] transition-all"
        >
          <span className="material-symbols-rounded text-[14px]">download</span> .txt
        </button>
      </div>
    </motion.div>
  );

  // ── Render: LinkedIn Result ──
  const renderLinkedInResult = (data: any) => (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest">LinkedIn Profile</p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>
            Score: {data.score}/100
          </span>
          {data.refined && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}>
              Dual-AI Refined
            </span>
          )}
        </div>
      </div>

      {/* Headline */}
      {data.headline && (
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-muted)] mb-1.5 flex items-center gap-1">
            <span className="material-symbols-rounded text-[14px]">badge</span> Headline
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] font-medium">
            {data.headline}
          </div>
        </div>
      )}

      {/* About / Summary */}
      {data.summary && (
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-muted)] mb-1.5 flex items-center gap-1">
            <span className="material-symbols-rounded text-[14px]">person</span> About
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
            {data.summary}
          </div>
        </div>
      )}

      {/* Skills */}
      {data.skills?.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-muted)] mb-1.5 flex items-center gap-1">
            <span className="material-symbols-rounded text-[14px]">star</span> Top Skills
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.skills.map((s: string) => (
              <span key={s} className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] bg-[var(--bg-surface)]">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Hashtags */}
      {data.hashtags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.hashtags.map((h: string) => (
            <span key={h} className="text-[11px] text-[var(--accent)]">{h.startsWith('#') ? h : `#${h}`}</span>
          ))}
        </div>
      )}

      {/* Copy all */}
      <button
        onClick={() => {
          const text = `Headline: ${data.headline || ''}\n\nAbout:\n${data.summary || ''}\n\nSkills: ${(data.skills || []).join(', ')}\n\n${(data.hashtags || []).map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ')}`;
          navigator.clipboard.writeText(text);
          showToast('LinkedIn content copied!', 'check_circle');
        }}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border)] hover:text-[var(--text-primary)] transition-all"
      >
        <span className="material-symbols-rounded text-[14px]">content_copy</span> Copy All to Clipboard
      </button>
    </motion.div>
  );

  // ── Custom Input Panel (Cover Letter / LinkedIn) ──
  const renderCustomInputPanel = () => {
    if (!selectedTool?.custom) return null;

    return (
      <div className="space-y-4">
        {/* Context badge */}
        {resumeContext && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
          >
            <span className="material-symbols-rounded text-[16px]" style={{ color: '#10b981' }}>link</span>
            <span className="text-[12px] text-[var(--text-secondary)] flex-1">
              Context loaded from <strong className="text-[var(--text-primary)]">Resume Studio</strong>
            </span>
            <button
              onClick={() => { setResumeContext(null); setInput(''); setJdInput(''); }}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Clear
            </button>
          </motion.div>
        )}

        {/* Resume Text */}
        <div className="rounded-2xl glass-card p-5">
          <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">
            Resume Text
          </label>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Paste your resume content here..."
            rows={5}
            className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none text-sm focus:outline-none focus:border-[var(--accent)]"
          />
          <div className="text-[11px] text-[var(--text-muted)] mt-1">{input.trim().split(/\s+/).filter(Boolean).length} words</div>
        </div>

        {/* Cover Letter specific: JD + Company + Tone */}
        {selectedTool.id === 'cover-letter' && (
          <div className="rounded-2xl glass-card p-5 space-y-3">
            <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
              Job Description
            </label>
            <textarea
              value={jdInput}
              onChange={e => setJdInput(e.target.value)}
              placeholder="Paste the target job description..."
              rows={4}
              className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">Company (optional)</label>
                <input
                  type="text"
                  value={companyInput}
                  onChange={e => setCompanyInput(e.target.value)}
                  placeholder="e.g. Google"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">Tone</label>
                <div className="flex gap-1.5">
                  {(['professional', 'friendly', 'bold'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setToneInput(t)}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-medium capitalize transition-all border ${
                        toneInput === t
                          ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                          : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border)]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LinkedIn specific: Target Role */}
        {selectedTool.id === 'linkedin' && (
          <div className="rounded-2xl glass-card p-5">
            <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">
              Target Role (optional)
            </label>
            <input
              type="text"
              value={targetRoleInput}
              onChange={e => setTargetRoleInput(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              className="w-full px-3 py-2.5 rounded-lg text-sm"
            />
          </div>
        )}

        {/* Run Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={runTool}
          disabled={isLoading || !input.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 shadow-lg transition-all"
          style={{ background: `linear-gradient(135deg, ${selectedTool.color}, ${selectedTool.color}cc)` }}
        >
          {isLoading ? (
            <>
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <span className="material-symbols-rounded text-sm">progress_activity</span>
              </motion.span>
              {selectedTool.id === 'cover-letter' ? 'Dual-AI crafting your letter...' : 'Optimizing for LinkedIn...'}
            </>
          ) : (
            <><span className="material-symbols-rounded text-sm">{selectedTool.icon}</span> Generate</>
          )}
        </motion.button>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {renderAuthModal()}

      {/* ── HEADER ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto relative overflow-hidden rounded-2xl glass-card p-6 mb-8"
      >
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-0 right-0 w-72 h-72 bg-violet-500/15 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-0 left-0 w-56 h-56 bg-cyan-500/15 rounded-full blur-3xl"
          />
        </div>

        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 mb-4"
          >
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-xs font-medium text-violet-400">Tools Gallery</span>
          </motion.div>
          <h1 className="text-2xl font-semibold mb-2 text-[var(--text-primary)]">Writing Tools Gallery</h1>
          <p className="text-[var(--text-secondary)] text-sm max-w-xl">
            One-click writing utilities. Free tools available to everyone — Pro tools unlock with your subscription.
          </p>
        </div>
      </motion.div>

      <div className="max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {!selectedTool ? (
            /* ── TOOL GRID ── */
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              {TOOLS.map((tool, i) => {
                const isLocked = tool.tier === 'pro' && !isPro;
                return (
                  <motion.button
                    key={tool.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.03, y: -4 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => selectTool(tool)}
                    className={`group relative p-5 rounded-2xl glass-card text-left transition-all overflow-hidden border ${
                      isLocked ? 'border-white/5 opacity-70' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner"
                          style={{ backgroundColor: `${tool.color}15`, borderColor: `${tool.color}30` }}
                        >
                          <span className="material-symbols-rounded text-lg" style={{ color: tool.color }}>{tool.icon}</span>
                        </div>
                        {tool.tier === 'pro' && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            isPro ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {isPro ? '✓ PRO' : 'PRO'}
                          </span>
                        )}
                        {tool.tier === 'free' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/5 text-[var(--text-secondary)] border border-white/10">FREE</span>
                        )}
                      </div>
                      {/* Context badge for custom tools */}
                      {tool.custom && resumeContext && (
                        <div className="flex items-center gap-1 mb-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[9px] text-emerald-500 font-medium">Resume context ready</span>
                        </div>
                      )}
                      <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">{tool.label}</h3>
                      <p className="text-[var(--text-secondary)] text-xs leading-relaxed">{tool.description}</p>
                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl backdrop-blur-[1px]">
                          <span className="material-symbols-rounded text-2xl text-amber-400">lock</span>
                        </div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            /* ── TOOL EXECUTION PANEL ── */
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Toolbar */}
              <div className="flex items-center gap-3">
                <button onClick={closeTool} className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  <span className="material-symbols-rounded text-sm">arrow_back</span> Back to Gallery
                </button>
                <div className="flex-1" />
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                  style={{ borderColor: `${selectedTool.color}30`, backgroundColor: `${selectedTool.color}08` }}
                >
                  <span className="material-symbols-rounded text-sm" style={{ color: selectedTool.color }}>{selectedTool.icon}</span>
                  <span className="text-xs font-medium" style={{ color: selectedTool.color }}>{selectedTool.label}</span>
                </div>
              </div>

              {/* Custom tools get their own input panel */}
              {selectedTool.custom ? renderCustomInputPanel() : (
                <>
                  {/* Generic Input */}
                  <div className="rounded-2xl glass-card p-5">
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder={selectedTool.placeholder}
                      rows={6}
                      className="w-full p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] focus:border-[var(--accent)] text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none transition-all text-sm focus:outline-none"
                    />
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-xs text-[var(--text-secondary)]">{input.trim().split(/\s+/).filter(Boolean).length} words</span>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={runTool}
                        disabled={isLoading || !input.trim()}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium text-sm disabled:opacity-50 shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${selectedTool.color}, ${selectedTool.color}cc)` }}
                      >
                        {isLoading ? (
                          <><span className="material-symbols-rounded animate-spin text-sm">progress_activity</span> Processing...</>
                        ) : (
                          <><span className="material-symbols-rounded text-sm">{selectedTool.icon}</span> Run {selectedTool.label}</>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </>
              )}

              {/* Results */}
              {result && (
                result.type === 'cover-letter' ? renderCoverLetterResult(result) :
                result.type === 'linkedin' ? renderLinkedInResult(result) :
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl glass-card p-5">
                  <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-4">Results</p>
                  <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] font-mono leading-relaxed max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap break-words text-xs">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                        showToast('Copied to clipboard', 'content_copy');
                      }}
                      className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <span className="material-symbols-rounded text-sm">content_copy</span> Copy Result
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
