'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import { authFetch } from '@/lib/auth-fetch';
import { useAuthGate } from '@/hooks/useAuthGate';
import PageHelp from '@/components/PageHelp';
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
}

const TOOLS: GalleryTool[] = [
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

// ── Tool-Specific Result Renderers ──
function ToolResult({ toolId, result, color }: { toolId: string; result: any; color: string }) {
  // Word Counter — stats dashboard
  if (toolId === 'word-counter') {
    const stats = [
      { label: 'Words', value: result.words, icon: 'text_fields' },
      { label: 'Characters', value: result.characters, icon: 'abc' },
      { label: 'No Spaces', value: result.charactersNoSpaces, icon: 'space_bar' },
      { label: 'Sentences', value: result.sentences, icon: 'short_text' },
      { label: 'Paragraphs', value: result.paragraphs, icon: 'view_headline' },
      { label: 'Words/Sentence', value: result.avgWordsPerSentence, icon: 'functions' },
    ];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {stats.map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              <span className="material-symbols-rounded text-lg block mb-1" style={{ color }}>{s.icon}</span>
              <p className="text-xl font-black text-[var(--text-primary)] tabular-nums">{s.value}</p>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl p-3 flex items-center gap-3" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
            <span className="material-symbols-rounded text-lg" style={{ color }}>schedule</span>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">{result.readingTimeMinutes} min</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">Reading time</p>
            </div>
          </div>
          <div className="flex-1 rounded-xl p-3 flex items-center gap-3" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
            <span className="material-symbols-rounded text-lg" style={{ color }}>mic</span>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">{result.speakingTimeMinutes} min</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">Speaking time</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grammar Checker — corrections list
  if (toolId === 'grammar-checker') {
    const corrections = result.corrections || result.issues || [];
    const correctedText = result.correctedText || result.corrected || result.text || '';
    return (
      <div className="space-y-4">
        {correctedText && (
          <div className="p-4 rounded-xl text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            {correctedText}
          </div>
        )}
        {Array.isArray(corrections) && corrections.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Corrections Found</p>
            {corrections.map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <span className="material-symbols-rounded text-sm mt-0.5 shrink-0" style={{ color }}>edit</span>
                <div className="flex-1 min-w-0">
                  {c.original && <span className="text-xs text-red-400 line-through mr-2">{c.original}</span>}
                  {(c.corrected || c.suggestion) && <span className="text-xs text-emerald-400 font-medium">{c.corrected || c.suggestion}</span>}
                  {(c.explanation || c.reason) && <p className="text-[11px] text-[var(--text-tertiary)] mt-1">{c.explanation || c.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {!correctedText && (!Array.isArray(corrections) || corrections.length === 0) && <GenericResult result={result} />}
      </div>
    );
  }

  // Citation Machine — formatted cards
  if (toolId === 'citation-machine') {
    const citations = result.citations || [];
    if (Array.isArray(citations) && citations.length > 0) {
      return (
        <div className="space-y-3">
          {citations.map((c: any, i: number) => (
            <div key={i} className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider" style={{ background: `${color}15`, color }}>{c.format || c.style || 'Citation'}</span>
                <button onClick={() => { navigator.clipboard.writeText(c.formatted || c.citation || ''); showToast('Copied!', 'content_copy'); }}
                  className="text-[10px] flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                  <span className="material-symbols-rounded text-xs">content_copy</span>
                </button>
              </div>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{c.formatted || c.citation || JSON.stringify(c)}</p>
            </div>
          ))}
        </div>
      );
    }
    return <GenericResult result={result} />;
  }

  // Summarizer — bullet points
  if (toolId === 'summarizer') {
    const summary = result.summary || result.text || '';
    const keyPoints = result.keyPoints || result.bullets || result.points || [];
    return (
      <div className="space-y-4">
        {summary && (
          <div className="p-4 rounded-xl text-sm leading-relaxed text-[var(--text-primary)]" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            {summary}
          </div>
        )}
        {Array.isArray(keyPoints) && keyPoints.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Key Points</p>
            <div className="space-y-1.5">
              {keyPoints.map((p: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="material-symbols-rounded text-sm mt-0.5 shrink-0" style={{ color }}>arrow_right</span>
                  {typeof p === 'string' ? p : JSON.stringify(p)}
                </div>
              ))}
            </div>
          </div>
        )}
        {!summary && (!Array.isArray(keyPoints) || keyPoints.length === 0) && <GenericResult result={result} />}
      </div>
    );
  }

  // Tone Analyzer — visual bars
  if (toolId === 'tone-analyzer') {
    const tones = result.tones || result.emotions || [];
    const formality = result.formality ?? result.formalityScore;
    const sentiment = result.sentiment || result.overallSentiment || '';
    const sentimentColors: Record<string, string> = { positive: '#10b981', negative: '#ef4444', neutral: '#64748b', mixed: '#f59e0b' };
    return (
      <div className="space-y-4">
        {sentiment && (
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <span className="material-symbols-rounded text-xl" style={{ color: sentimentColors[sentiment.toLowerCase()] || color }}>
              {sentiment.toLowerCase() === 'positive' ? 'sentiment_satisfied' : sentiment.toLowerCase() === 'negative' ? 'sentiment_dissatisfied' : 'sentiment_neutral'}
            </span>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)] capitalize">{sentiment}</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">Overall sentiment</p>
            </div>
          </div>
        )}
        {formality !== undefined && (
          <div className="p-3 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Formality</span>
              <span className="text-xs font-bold tabular-nums" style={{ color }}>{typeof formality === 'number' ? `${formality}%` : formality}</span>
            </div>
            {typeof formality === 'number' && (
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${formality}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }} />
              </div>
            )}
          </div>
        )}
        {Array.isArray(tones) && tones.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Detected Tones</p>
            {tones.map((t: any, i: number) => {
              const name = typeof t === 'string' ? t : t.tone || t.name || '';
              const score = typeof t === 'object' ? (t.score || t.confidence || 0) : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[var(--text-secondary)] w-24 truncate capitalize">{name}</span>
                  {score > 0 && (
                    <>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(score * 100, 100)}%`, background: color }} />
                      </div>
                      <span className="text-[10px] font-bold tabular-nums text-[var(--text-tertiary)] w-8 text-right">{Math.round(score * 100)}%</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!sentiment && !formality && (!Array.isArray(tones) || tones.length === 0) && <GenericResult result={result} />}
      </div>
    );
  }

  // Paraphraser — side-by-side styles
  if (toolId === 'paraphraser') {
    const styles = result.paraphrased || result.versions || result;
    const styleEntries = typeof styles === 'object' && !Array.isArray(styles)
      ? Object.entries(styles).filter(([, v]) => typeof v === 'string')
      : [];
    if (styleEntries.length > 0) {
      const styleIcons: Record<string, string> = { formal: 'business_center', casual: 'chat', concise: 'compress', creative: 'palette' };
      return (
        <div className="space-y-3">
          {styleEntries.map(([style, text]) => (
            <div key={style} className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-sm" style={{ color }}>{styleIcons[style] || 'swap_horiz'}</span>
                  <span className="text-xs font-bold text-[var(--text-primary)] capitalize">{style}</span>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(text as string); showToast('Copied!', 'content_copy'); }}
                  className="text-[10px] flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                  <span className="material-symbols-rounded text-xs">content_copy</span>
                </button>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{text as string}</p>
            </div>
          ))}
        </div>
      );
    }
    return <GenericResult result={result} />;
  }

  // Email Composer — subject + body
  if (toolId === 'email-composer') {
    const subject = result.subject || result.subjectLine || '';
    const body = result.email || result.body || result.content || '';
    return (
      <div className="space-y-3">
        {subject && (
          <div className="p-3 rounded-xl flex items-center justify-between" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <div>
              <p className="text-[10px] font-bold text-[var(--text-tertiary)] mb-0.5">SUBJECT</p>
              <p className="text-sm text-[var(--text-primary)]">{subject}</p>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(subject); showToast('Copied!', 'content_copy'); }}
              className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
              <span className="material-symbols-rounded text-sm">content_copy</span>
            </button>
          </div>
        )}
        {body && (
          <div className="p-4 rounded-xl text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            {body}
          </div>
        )}
        {!subject && !body && <GenericResult result={result} />}
      </div>
    );
  }

  // Thesis Generator — statement + reasoning
  if (toolId === 'thesis-generator') {
    const thesis = result.thesis || result.statement || result.thesisStatement || '';
    const reasoning = result.reasoning || result.explanation || '';
    const alternatives = result.alternatives || result.variations || [];
    return (
      <div className="space-y-4">
        {thesis && (
          <div className="p-4 rounded-xl border-l-2" style={{ background: 'var(--bg-elevated)', borderColor: color, borderRight: '1px solid var(--border-subtle)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color }}>Thesis Statement</p>
            <p className="text-base font-medium text-[var(--text-primary)] leading-relaxed italic">"{thesis}"</p>
          </div>
        )}
        {reasoning && (
          <div className="p-3 rounded-xl text-sm text-[var(--text-secondary)] leading-relaxed" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-bold text-[var(--text-tertiary)] mb-1">WHY THIS WORKS</p>
            {reasoning}
          </div>
        )}
        {Array.isArray(alternatives) && alternatives.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Alternatives</p>
            <div className="space-y-2">
              {alternatives.map((alt: string, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl text-sm text-[var(--text-secondary)]" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <span className="text-[10px] font-bold tabular-nums mt-0.5 w-4 shrink-0" style={{ color }}>{i + 1}</span>
                  {typeof alt === 'string' ? alt : JSON.stringify(alt)}
                </div>
              ))}
            </div>
          </div>
        )}
        {!thesis && !reasoning && <GenericResult result={result} />}
      </div>
    );
  }

  // Fallback — structured display instead of raw JSON
  return <GenericResult result={result} />;
}

// Generic fallback — renders object keys as labeled cards instead of raw JSON
function GenericResult({ result }: { result: any }) {
  if (typeof result === 'string') {
    return (
      <div className="p-4 rounded-xl text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
        {result}
      </div>
    );
  }
  if (typeof result !== 'object' || result === null) {
    return <p className="text-sm text-[var(--text-secondary)]">{String(result)}</p>;
  }
  const entries = Object.entries(result).filter(([, v]) => v !== null && v !== undefined);
  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="p-3 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
            {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
          </p>
          {typeof value === 'string' ? (
            <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{value}</p>
          ) : Array.isArray(value) ? (
            <div className="space-y-1">
              {value.map((item, i) => (
                <p key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-1.5">
                  <span className="text-[var(--text-muted)] shrink-0">-</span>
                  {typeof item === 'string' ? item : JSON.stringify(item)}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-primary)] tabular-nums font-medium">{JSON.stringify(value)}</p>
          )}
        </div>
      ))}
    </div>
  );
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

  const isPro = tier === 'pro' || tier === 'studio' || tier === 'god';

  // Auto-open tool from URL param (e.g. /suite/gallery?tool=grammar-checker)
  useEffect(() => {
    const toolId = searchParams.get('tool');
    if (toolId) {
      const tool = TOOLS.find(t => t.id === toolId);
      if (tool) selectTool(tool);
    }
  }, [searchParams]);

  const selectTool = (tool: GalleryTool) => {
    const isLocked = tool.tier === 'pro' && !isPro;
    if (isLocked) { showToast('Upgrade to Pro for this tool', 'lock'); return; }
    setSelectedTool(tool);
    setResult(null);
    setInput('');
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
      // ── Word counter (client-side, no API) ──
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
  }, [selectedTool, input, isPro, handleApiError]);

  const closeTool = () => {
    setSelectedTool(null);
    setInput('');
    setResult(null);
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

        <div className="relative z-10 flex items-start justify-between">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 mb-4"
            >
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2 h-2 rounded-full bg-violet-500" />
              <span className="text-xs font-medium text-violet-400">Writing Tools</span>
            </motion.div>
            <h1 className="text-2xl font-semibold mb-2 text-[var(--text-primary)]">Writing Tools Gallery</h1>
            <p className="text-[var(--text-secondary)] text-sm max-w-xl">
              One-click writing utilities. Free tools available to everyone — Pro tools unlock with your subscription.
            </p>
          </div>
          <PageHelp toolId="gallery" />
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

              {/* Input */}
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

              {/* Results */}
              {result && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl glass-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest">Results</p>
                    <button
                      onClick={() => {
                        const text = selectedTool?.id === 'word-counter'
                          ? Object.entries(result).map(([k, v]) => `${k}: ${v}`).join('\n')
                          : typeof result === 'string' ? result
                          : result?.correctedText || result?.summary || result?.citations?.map((c: any) => c.formatted).join('\n') || result?.paraphrased?.formal || result?.email || result?.thesis || JSON.stringify(result, null, 2);
                        navigator.clipboard.writeText(text);
                        showToast('Copied to clipboard', 'content_copy');
                      }}
                      className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--border)]"
                    >
                      <span className="material-symbols-rounded text-sm">content_copy</span> Copy
                    </button>
                  </div>
                  <ToolResult toolId={selectedTool!.id} result={result} color={selectedTool!.color} />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
