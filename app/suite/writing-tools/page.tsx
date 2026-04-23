'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import { authFetch } from '@/lib/auth-fetch';
import PageHelp from '@/components/PageHelp';
import { useAuthGate } from '@/hooks/useAuthGate';
import {
  detectAI,
  splitSentences,
  CRITICAL_WORDS,
  HIGH_WORDS,
  AI_PHRASES,
  type DetectionResult,
} from '@/lib/ai-detection';
import { exportDocument, downloadBlob, type ExportFormat } from '@/lib/doc-export';
import mammoth from 'mammoth';
import type { WritingDomain, HumanizeTone } from '@/lib/writing-prompts';

// ── Types ──
type PipelineStep = 'detect' | 'humanize' | 'check' | 'export';

interface HumanizeResult {
  rewritten: string;
  changes: Array<{ original: string; rewritten: string; reason: string }>;
  stats: { sentenceLengthStdDev: number; bannedWordsRemoved: number; burstinessRange: number };
  wordUsage: { inputWords: number; outputWords: number; remaining: number; cap: number };
  recheck?: { humanScore: number; verdict: string; flaggedCount: number };
}

interface UniquenessResult {
  uniquenessScore: number;
  verdict: 'highly_unique' | 'mostly_unique' | 'some_overlap' | 'needs_revision';
  analysis: Array<{ paragraphIndex: number; score: number; concern: string | null; suggestion: string | null }>;
  summary: string;
}

interface AnalyzedSentence {
  text: string;
  score: number;
  aiWords: string[];
  isAI: boolean;
}

const STEPS: { key: PipelineStep; label: string; icon: string }[] = [
  { key: 'detect', label: 'Detect', icon: 'radar' },
  { key: 'humanize', label: 'Humanize', icon: 'brush' },
  { key: 'check', label: 'Check', icon: 'verified' },
  { key: 'export', label: 'Export', icon: 'download' },
];

const DOMAIN_OPTIONS: { value: WritingDomain; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: 'article' },
  { value: 'academic', label: 'Academic', icon: 'school' },
  { value: 'resume', label: 'Resume/CV', icon: 'description' },
  { value: 'marketing', label: 'Marketing', icon: 'campaign' },
  { value: 'creative', label: 'Creative', icon: 'palette' },
];

const AI_WORD_SET = new Set([...CRITICAL_WORDS, ...HIGH_WORDS].map(w => w.toLowerCase()));
const AI_PHRASE_LIST = AI_PHRASES.map(p => p.toLowerCase());

// ── Helpers ──
function getScoreColor(score: number) {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 45) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreLabel(score: number) {
  if (score >= 70) return 'Likely Human';
  if (score >= 45) return 'Mixed Signals';
  return 'Likely AI';
}

function getScoreBg(score: number) {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 45) return 'bg-amber-500';
  return 'bg-red-500';
}

function analyzeSentences(text: string): AnalyzedSentence[] {
  const sentences = splitSentences(text);
  return sentences.map(sentence => {
    const lower = sentence.toLowerCase();
    const aiWords: string[] = [];
    const words = lower.split(/\s+/);

    for (const word of words) {
      const clean = word.replace(/[^a-z'-]/g, '');
      if (AI_WORD_SET.has(clean)) aiWords.push(clean);
    }

    for (const phrase of AI_PHRASE_LIST) {
      if (lower.includes(phrase)) aiWords.push(phrase);
    }

    const penalty = aiWords.length * 20;
    const score = Math.max(0, 100 - penalty);
    return { text: sentence, score, aiWords, isAI: aiWords.length > 0 };
  });
}

// ── Score Gauge Component ──
function ScoreGauge({ score, size = 140, label }: { score: number; size?: number; label?: string }) {
  const radius = (size - 16) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/5" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="text-3xl font-bold" style={{ color }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">{label || 'Human'}</span>
      </div>
    </div>
  );
}

// ── Step Indicator ──
function StepIndicator({ steps, currentStep, onStepClick }: {
  steps: typeof STEPS; currentStep: PipelineStep; onStepClick: (step: PipelineStep) => void;
}) {
  const currentIdx = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {steps.map((step, i) => {
        const isActive = step.key === currentStep;
        const isCompleted = i < currentIdx;
        const isClickable = isCompleted || isActive;

        return (
          <div key={step.key} className="flex items-center">
            <button
              onClick={() => isClickable && onStepClick(step.key)}
              disabled={!isClickable}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-xs font-medium ${
                isActive
                  ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30'
                  : isCompleted
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20'
                  : 'text-[var(--text-secondary)] border border-white/5 opacity-50 cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-rounded text-sm">
                {isCompleted ? 'check_circle' : step.icon}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div className={`w-4 sm:w-8 h-px mx-1 ${i < currentIdx ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Highlighted Text Component ──
function HighlightedText({ sentences, showLegend = true }: { sentences: AnalyzedSentence[]; showLegend?: boolean }) {
  if (sentences.length === 0) return null;

  const aiCount = sentences.filter(s => s.isAI).length;

  function renderSentence(s: AnalyzedSentence, i: number) {
    if (!s.isAI || s.aiWords.length === 0) {
      return <span key={i}>{s.text}{' '}</span>;
    }

    // Build regex to highlight AI words within the sentence
    const escaped = s.aiWords
      .filter(w => w.length > 3) // skip very short matches
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (escaped.length === 0) {
      return (
        <motion.span
          key={i}
          initial={{ backgroundColor: 'rgba(251,191,36,0)' }}
          animate={{ backgroundColor: 'rgba(251,191,36,0.15)' }}
          transition={{ delay: i * 0.03, duration: 0.4 }}
          className="rounded-sm"
        >
          {s.text}{' '}
        </motion.span>
      );
    }

    const pattern = new RegExp(`(\\b(?:${escaped.join('|')})\\b)`, 'gi');
    const parts = s.text.split(pattern);

    return (
      <motion.span
        key={i}
        initial={{ backgroundColor: 'rgba(251,191,36,0)' }}
        animate={{ backgroundColor: 'rgba(251,191,36,0.15)' }}
        transition={{ delay: i * 0.03, duration: 0.4 }}
        className="rounded-sm"
      >
        {parts.map((part, pi) => {
          const isAIWord = escaped.some(e => new RegExp(`^${e}$`, 'i').test(part));
          if (isAIWord) {
            return (
              <mark key={pi} className="bg-red-400/25 text-red-300 rounded-sm px-0.5 underline decoration-red-400/60 decoration-wavy underline-offset-2">
                {part}
              </mark>
            );
          }
          return <span key={pi}>{part}</span>;
        })}
        {' '}
      </motion.span>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] p-4"
    >
      {showLegend && (
        <div className="flex items-center gap-4 mb-3 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-sm text-amber-400">visibility</span>
            <span className="text-xs font-medium text-[var(--text-secondary)]">AI Pattern Preview</span>
          </div>
          <div className="flex items-center gap-3 ml-auto text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-amber-400/20 border border-amber-400/30" />
              AI Sentence
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-red-400/25 border border-red-400/30" />
              AI Word
            </span>
          </div>
          {aiCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
              {aiCount} flagged
            </span>
          )}
        </div>
      )}
      <div className="text-sm leading-relaxed text-[var(--text-primary)] font-mono whitespace-pre-wrap">
        {sentences.map((s, i) => renderSentence(s, i))}
      </div>
    </motion.div>
  );
}

// ── Humanize Animation ──
function HumanizeAnimation() {
  const [phase, setPhase] = useState(0);
  const phases = [
    { label: 'Scanning AI patterns…', icon: 'radar', desc: 'Identifying flagged sentences and banned vocabulary' },
    { label: 'Rewriting with AI Engine…', icon: 'edit_note', desc: 'Humanizing sentence structure and word choices' },
    { label: 'Polishing & verifying…', icon: 'auto_fix_high', desc: 'Adjusting burstiness and sentence variance' },
  ];

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 2500);
    const t2 = setTimeout(() => setPhase(2), 7000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl glass-card p-8 relative overflow-hidden"
    >
      {/* Animated gradient orb */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: ['-20%', '120%'],
            opacity: [0, 0.6, 0],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 left-0 w-40 h-full bg-gradient-to-r from-transparent via-amber-500/10 to-transparent"
          style={{ filter: 'blur(20px)' }}
        />
      </div>

      <div className="relative z-10 text-center">
        {/* Phase progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {phases.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === phase ? 32 : 8,
                backgroundColor: i <= phase ? '#f59e0b' : 'rgba(255,255,255,0.1)',
              }}
              transition={{ duration: 0.4 }}
              className="h-2 rounded-full"
            />
          ))}
        </div>

        {/* Spinning icon */}
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              animate={{ rotate: phase === 0 ? [0, 360] : 0 }}
              transition={{ duration: 2, repeat: phase === 0 ? Infinity : 0, ease: 'linear' }}
              className="inline-block"
            >
              <span className="material-symbols-rounded text-5xl text-amber-400">{phases[phase].icon}</span>
            </motion.div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mt-4">{phases[phase].label}</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{phases[phase].desc}</p>
          </motion.div>
        </AnimatePresence>

        {/* Progress bar */}
        <div className="mt-6 h-1 rounded-full bg-white/5 overflow-hidden max-w-xs mx-auto">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: phase === 0 ? '30%' : phase === 1 ? '70%' : '95%' }}
            transition={{ duration: 2, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
          />
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: '100%', x: `${15 + i * 14}%`, opacity: 0 }}
              animate={{
                y: ['-10%', '-100%'],
                opacity: [0, 0.6, 0],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                delay: i * 0.7,
                ease: 'easeOut',
              }}
              className="absolute w-1.5 h-1.5 rounded-full bg-amber-400/40"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Side-by-Side Comparison ──
function SideBySideView({ originalText, humanizedText, changes, originalDetection }: {
  originalText: string;
  humanizedText: string;
  changes: HumanizeResult['changes'];
  originalDetection: DetectionResult | null;
}) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const syncScroll = (source: 'left' | 'right') => {
    if (syncing.current) return;
    syncing.current = true;
    const src = source === 'left' ? leftRef.current : rightRef.current;
    const dst = source === 'left' ? rightRef.current : leftRef.current;
    if (src && dst) dst.scrollTop = src.scrollTop;
    requestAnimationFrame(() => { syncing.current = false; });
  };

  const changedOriginals = new Set(changes.map(c => c.original.toLowerCase().trim()));

  const originalSentences = splitSentences(originalText);
  const humanizedSentences = splitSentences(humanizedText);

  function isAISentence(sentence: string): boolean {
    const lower = sentence.toLowerCase();
    for (const word of [...CRITICAL_WORDS, ...HIGH_WORDS]) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) return true;
    }
    return false;
  }

  function isChangedSentence(sentence: string): boolean {
    const lower = sentence.toLowerCase().trim();
    // Check if this sentence doesn't appear in original (meaning it's new/changed)
    return !originalSentences.some(os => os.toLowerCase().trim() === lower);
  }

  return (
    <div className="rounded-2xl glass-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-2 border-b border-white/5">
        <div className="px-4 py-3 flex items-center gap-2 border-r border-white/5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="text-xs font-medium text-amber-400">Original</span>
          <span className="text-[10px] text-[var(--text-muted)] ml-auto">{originalSentences.length} sentences</span>
        </div>
        <div className="px-4 py-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="text-xs font-medium text-emerald-400">Humanized</span>
          <span className="text-[10px] text-[var(--text-muted)] ml-auto">{humanizedSentences.length} sentences</span>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-2 divide-x divide-white/5">
        <div
          ref={leftRef}
          onScroll={() => syncScroll('left')}
          className="p-4 max-h-80 overflow-y-auto text-sm font-mono leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap"
        >
          {originalSentences.map((s, i) => {
            const flagged = isAISentence(s);
            return (
              <motion.span
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className={flagged ? 'bg-amber-400/15 rounded-sm' : ''}
              >
                {s}{' '}
              </motion.span>
            );
          })}
        </div>

        <div
          ref={rightRef}
          onScroll={() => syncScroll('right')}
          className="p-4 max-h-80 overflow-y-auto text-sm font-mono leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap"
        >
          {humanizedSentences.map((s, i) => {
            const changed = isChangedSentence(s);
            return (
              <motion.span
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className={changed ? 'bg-emerald-400/15 rounded-sm' : ''}
              >
                {s}{' '}
              </motion.span>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 p-3 border-t border-white/5 bg-white/[0.02]">
        <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
          <span className="w-3 h-3 rounded-sm bg-amber-400/20 border border-amber-400/30" /> AI-Flagged
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
          <span className="w-3 h-3 rounded-sm bg-emerald-400/20 border border-emerald-400/30" /> Rewritten
        </span>
      </div>
    </div>
  );
}

// ── Score Improvement Badge ──
function ScoreImprovement({ before, after }: { before: number; after: number }) {
  const diff = after - before;
  const positive = diff > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-[var(--card-bg)] border border-white/5"
    >
      <div className="text-center">
        <span className="text-lg font-bold text-red-400">{before}</span>
        <p className="text-[9px] text-[var(--text-muted)] uppercase">Before</p>
      </div>
      <motion.span
        initial={{ width: 0 }}
        animate={{ width: 32 }}
        className="flex items-center justify-center"
      >
        <span className="material-symbols-rounded text-[var(--text-secondary)]">arrow_forward</span>
      </motion.span>
      <div className="text-center">
        <span className={`text-lg font-bold ${getScoreColor(after)}`}>{after}</span>
        <p className="text-[9px] text-[var(--text-muted)] uppercase">After</p>
      </div>
      {positive && (
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
          className="text-xs font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10"
        >
          +{diff}
        </motion.span>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════
//  MAIN PAGE COMPONENT
// ══════════════════════════════════════════════
export default function WritingToolsPage() {
  const { user } = useStore();
  const { handleApiError, renderAuthModal } = useAuthGate();

  // Pipeline state
  const [currentStep, setCurrentStep] = useState<PipelineStep>('detect');
  const [inputText, setInputText] = useState('');
  const [domain, setDomain] = useState<WritingDomain>('general');
  const [tone, setTone] = useState<HumanizeTone>('professional');

  // Results
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [originalDetection, setOriginalDetection] = useState<DetectionResult | null>(null);
  const [humanizeResult, setHumanizeResult] = useState<HumanizeResult | null>(null);
  const [uniqueness, setUniqueness] = useState<UniquenessResult | null>(null);

  // Loading states
  const [isDetecting, setIsDetecting] = useState(false);
  const [isHumanizing, setIsHumanizing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // File upload
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live sentence analysis (auto-highlights)
  const [sentenceAnalysis, setSentenceAnalysis] = useState<AnalyzedSentence[]>([]);

  // Active text = original or humanized
  const activeText = humanizeResult?.rewritten || inputText;

  // Word count
  const wordCount = useMemo(() => inputText.trim().split(/\s+/).filter(Boolean).length, [inputText]);

  // ── Auto-analyze on text change (debounced) ──
  useEffect(() => {
    if (!inputText.trim() || inputText.trim().length < 30) {
      setSentenceAnalysis([]);
      return;
    }
    const timer = setTimeout(() => {
      setSentenceAnalysis(analyzeSentences(inputText));
    }, 800);
    return () => clearTimeout(timer);
  }, [inputText]);

  // ── File Upload Handler ──
  const processFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['txt', 'docx', 'doc'].includes(ext)) {
      showToast('Only .txt and .docx files are supported', 'cancel');
      return;
    }

    setIsReadingFile(true);
    setUploadedFileName(file.name);

    try {
      if (ext === 'txt') {
        const text = await file.text();
        setInputText(text);
        showToast(`Loaded ${file.name}`, 'upload_file');
      } else if (ext === 'docx' || ext === 'doc') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setInputText(result.value);
        showToast(`Loaded ${file.name} (${result.value.split(/\s+/).length} words)`, 'upload_file');
      }
    } catch (error) {
      console.error('File read error:', error);
      showToast('Failed to read file. Try pasting text instead.', 'cancel');
      setUploadedFileName(null);
    } finally {
      setIsReadingFile(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  // ── Step 1: Detect ──
  const runDetection = useCallback(() => {
    if (!inputText.trim() || inputText.trim().length < 30) {
      showToast('Paste at least 30 characters to analyze', 'cancel');
      return;
    }
    setIsDetecting(true);
    setTimeout(() => {
      const result = detectAI(inputText);
      setDetection(result);
      setOriginalDetection(result);
      setIsDetecting(false);
      showToast(`Human Score: ${result.humanScore}/100`, 'radar');
      // Auto-advance to humanize step if AI detected
      if (result.humanScore < 70) {
        setCurrentStep('humanize');
      }
    }, 500);
  }, [inputText]);

  // ── Step 2: Humanize ──
  const runHumanize = async () => {
    if (!detection) {
      showToast('Run detection first', 'cancel');
      return;
    }

    setIsHumanizing(true);
    try {
      const lowParagraphs = detection.paragraphScores
        .filter(p => p.score < 60)
        .map(p => p.index);

      const res = await authFetch('/api/writing/humanize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          domain,
          tone,
          paragraphIndices: lowParagraphs.length > 0 ? lowParagraphs : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (handleApiError(err)) { setIsHumanizing(false); return; }
        if (res.status === 429 && err.usedWords !== undefined) {
          showToast(`Word limit reached (${err.usedWords}/${err.capWords}). Upgrade for more.`, 'lock');
          setIsHumanizing(false);
          return;
        }
        if (err.upgrade) {
          showToast(err.error || 'Upgrade to Pro for more words', 'lock');
          setIsHumanizing(false);
          return;
        }
        throw new Error(err.error || 'Humanization failed');
      }

      const result: HumanizeResult = await res.json();
      setHumanizeResult(result);

      const newDetection = detectAI(result.rewritten);
      setDetection(newDetection);

      setCurrentStep('check');
      showToast(`Humanized! Score: ${newDetection.humanScore}/100`, 'brush');
    } catch (error) {
      console.error('Humanize error:', error);
      const msg = error instanceof Error ? error.message : 'Humanization failed. Try again.';
      showToast(msg, 'cancel');
    } finally {
      setIsHumanizing(false);
    }
  };

  // ── Step 3: Uniqueness Check ──
  const runUniquenessCheck = async () => {
    setIsChecking(true);
    try {
      const res = await authFetch('/api/writing/uniqueness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: activeText }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (handleApiError(err)) { setIsChecking(false); return; }
        if (err.upgrade) {
          showToast(err.error || 'Upgrade to Pro for uniqueness checks', 'lock');
          setIsChecking(false);
          return;
        }
        throw new Error(err.error || 'Uniqueness check failed');
      }

      const result: UniquenessResult = await res.json();
      setUniqueness(result);
      setCurrentStep('export');
      showToast(`Uniqueness: ${result.uniquenessScore}/100`, 'verified');
    } catch (error) {
      console.error('Uniqueness error:', error);
      const msg = error instanceof Error ? error.message : 'Uniqueness check failed';
      showToast(msg, 'cancel');
    } finally {
      setIsChecking(false);
    }
  };

  // ── Step 4: Export ──
  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    try {
      const { blob, filename } = await exportDocument(activeText, {
        format,
        title: 'Humanized Document',
        author: user?.displayName || undefined,
      });
      downloadBlob(blob, filename);
      showToast(`Downloaded ${filename}`, 'download');
    } catch (error) {
      console.error('Export error:', error);
      showToast('Export failed', 'cancel');
    } finally {
      setIsExporting(false);
    }
  };

  // ── Reset ──
  const resetPipeline = () => {
    setCurrentStep('detect');
    setInputText('');
    setDetection(null);
    setOriginalDetection(null);
    setHumanizeResult(null);
    setUniqueness(null);
    setUploadedFileName(null);
    setSentenceAnalysis([]);
    setTone('professional');
  };

  // ── Verdict info ──
  const verdictInfo: Record<string, { icon: string; color: string; label: string; desc: string }> = {
    highly_unique: { icon: 'verified_user', color: 'text-emerald-400', label: 'Highly Unique', desc: 'Your text uses distinctive phrasing and structure. This will pass originality checks.' },
    mostly_unique: { icon: 'shield', color: 'text-emerald-400', label: 'Mostly Unique', desc: 'Strong originality with minor common phrasing. Should pass most detectors.' },
    some_overlap: { icon: 'warning', color: 'text-amber-400', label: 'Some Overlap', desc: 'Parts of your text follow common templates. Consider revising flagged sections.' },
    needs_revision: { icon: 'gpp_bad', color: 'text-red-400', label: 'Needs Revision', desc: 'Significant template overlap detected. Re-humanize with creative domain for best results.' },
  };

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {renderAuthModal()}

      {/* ── HEADER ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto relative overflow-hidden rounded-2xl glass-card p-6 mb-6"
      >
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ x: [0, 40, 0], y: [0, -20, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-0 right-0 w-80 h-80 bg-rose-500/15 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ x: [0, -25, 0], y: [0, 40, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-0 left-0 w-60 h-60 bg-amber-500/15 rounded-full blur-3xl"
          />
        </div>

        <div className="relative z-10 flex items-start justify-between">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 mb-4"
            >
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-xs font-medium text-rose-400">AI Detector</span>
            </motion.div>
            <h1 className="text-2xl font-semibold mb-2 text-[var(--text-primary)]">
              AI Detection & Humanization Pipeline
            </h1>
            <p className="text-[var(--text-secondary)] text-sm max-w-xl">
              Scan your writing for AI patterns, humanize flagged sections with our AI Engine, verify uniqueness, and export submission-ready documents — all in one pipeline.
            </p>
          </div>
          <PageHelp toolId="writing-tools" />
        </div>
      </motion.div>

      {/* ── STEP INDICATOR ── */}
      <div className="max-w-5xl mx-auto mb-6">
        <StepIndicator steps={STEPS} currentStep={currentStep} onStepClick={setCurrentStep} />
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-5xl mx-auto">
        <AnimatePresence mode="wait">

          {/* ═══ STEP 1: DETECT ═══ */}
          {currentStep === 'detect' && (
            <motion.div key="detect" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {/* Domain selector */}
              <div className="flex flex-wrap gap-2">
                {DOMAIN_OPTIONS.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setDomain(d.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                      domain === d.value
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'text-[var(--text-secondary)] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className="material-symbols-rounded text-sm">{d.icon}</span>
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Text input + File Upload */}
              <div
                className={`rounded-2xl glass-card p-5 transition-all ${isDragging ? 'ring-2 ring-rose-500/50 bg-rose-500/5' : ''}`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-[var(--text-primary)]">Paste your text</label>
                    <span className="text-xs text-[var(--text-muted)]">or</span>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isReadingFile}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-50"
                    >
                      <span className="material-symbols-rounded text-[14px]">upload_file</span>
                      {isReadingFile ? 'Reading...' : 'Upload .txt / .docx'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.docx,.doc"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">{wordCount.toLocaleString()} words</span>
                </div>

                {/* Upload indicator */}
                {uploadedFileName && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-rose-500/5 border border-rose-500/15">
                    <span className="material-symbols-rounded text-rose-400 text-sm">description</span>
                    <span className="text-xs text-rose-400 font-medium">{uploadedFileName}</span>
                    <button
                      onClick={() => { setUploadedFileName(null); setInputText(''); }}
                      className="ml-auto text-[var(--text-muted)] hover:text-red-400 transition-colors"
                    >
                      <span className="material-symbols-rounded text-sm">close</span>
                    </button>
                  </div>
                )}

                {/* Drag overlay */}
                {isDragging && (
                  <div className="flex flex-col items-center justify-center py-12 mb-3 rounded-xl border-2 border-dashed border-rose-500/40 bg-rose-500/5">
                    <span className="material-symbols-rounded text-3xl text-rose-400 mb-2">upload_file</span>
                    <p className="text-sm text-rose-400 font-medium">Drop your file here</p>
                    <p className="text-xs text-[var(--text-muted)]">.txt or .docx</p>
                  </div>
                )}

                {!isDragging && (
                  <textarea
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder="Paste your essay, resume, cover letter, or any text you want to analyze and humanize..."
                    rows={10}
                    className="w-full p-4 rounded-xl bg-[var(--input-bg)] border border-[var(--border-color)] focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/20 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 resize-none transition-all text-sm font-mono leading-relaxed"
                  />
                )}

                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={() => { setInputText(''); setUploadedFileName(null); setSentenceAnalysis([]); setDetection(null); }}
                    className="text-xs text-[var(--text-secondary)] hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={runDetection}
                    disabled={isDetecting || wordCount < 5}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rose-500/20"
                  >
                    {isDetecting ? (
                      <><span className="material-symbols-rounded animate-spin text-sm">progress_activity</span> Analyzing...</>
                    ) : (
                      <><span className="material-symbols-rounded text-sm">radar</span> Detect AI Patterns</>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* ── Live AI Highlight Preview (auto, before full detect) ── */}
              {sentenceAnalysis.length > 0 && !detection && (
                <HighlightedText sentences={sentenceAnalysis} />
              )}

              {/* ── Full Detection Results ── */}
              {detection && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  {/* Score + Breakdown + Flags */}
                  <div className="grid md:grid-cols-3 gap-6">
                    {/* Score Panel */}
                    <div className="rounded-2xl glass-card p-6 flex flex-col items-center justify-center">
                      <ScoreGauge score={detection.humanScore} />
                      <p className={`mt-3 text-sm font-bold ${getScoreColor(detection.humanScore)}`}>{getScoreLabel(detection.humanScore)}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                        {detection.flags.filter(f => f.type === 'critical').length} critical · {detection.flags.filter(f => f.type === 'high').length} high flags
                      </p>
                    </div>

                    {/* Breakdown */}
                    <div className="rounded-2xl glass-card p-5 space-y-4">
                      <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest">Score Breakdown</p>
                      {(['perplexity', 'burstiness', 'vocabulary', 'structure'] as const).map(key => (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--text-secondary)] capitalize">{key}</span>
                            <span className={getScoreColor(detection.breakdown[key])}>{detection.breakdown[key]}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${detection.breakdown[key]}%` }}
                              transition={{ duration: 0.8, delay: 0.2 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: detection.breakdown[key] >= 70 ? '#10b981' : detection.breakdown[key] >= 45 ? '#f59e0b' : '#ef4444' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Flags */}
                    <div className="rounded-2xl glass-card p-5 max-h-80 overflow-y-auto">
                      <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-3">Flags ({detection.flags.length})</p>
                      <div className="space-y-2">
                        {detection.flags.slice(0, 15).map((flag, i) => (
                          <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded-lg ${
                            flag.type === 'critical' ? 'bg-red-500/10 text-red-400' :
                            flag.type === 'high' ? 'bg-orange-500/10 text-orange-400' :
                            flag.type === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-white/5 text-[var(--text-secondary)]'
                          }`}>
                            <span className="material-symbols-rounded text-xs mt-0.5">
                              {flag.type === 'critical' ? 'error' : flag.type === 'high' ? 'warning' : 'info'}
                            </span>
                            <span>{flag.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Highlighted text with AI sentences shown */}
                  <div className="rounded-2xl glass-card p-5">
                    <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-3">Sentence-Level Analysis</p>
                    <HighlightedText sentences={sentenceAnalysis.length > 0 ? sentenceAnalysis : analyzeSentences(inputText)} showLegend={false} />
                  </div>

                  {/* Action button */}
                  <div className="flex justify-center">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setCurrentStep('humanize'); }}
                      className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-medium text-sm shadow-lg shadow-rose-500/20"
                    >
                      <span className="material-symbols-rounded text-sm">brush</span>
                      Proceed to Humanize
                      <span className="material-symbols-rounded text-sm">arrow_forward</span>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══ STEP 2: HUMANIZE ═══ */}
          {currentStep === 'humanize' && (
            <motion.div key="humanize" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {!isHumanizing && !humanizeResult && (
                <div className="rounded-2xl glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-[var(--text-primary)]">Humanize Your Text</h2>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        Our AI Engine will rewrite flagged paragraphs while preserving meaning.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-bold text-[var(--text-primary)]">{wordCount}</span>
                        <p className="text-[9px] text-[var(--text-muted)]">words</p>
                      </div>
                      {originalDetection && (
                        <div className="text-right">
                          <span className={`text-2xl font-bold ${getScoreColor(originalDetection.humanScore)}`}>{originalDetection.humanScore}</span>
                          <p className="text-[10px] text-[var(--text-secondary)]">Current Score</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tone Picker */}
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Humanization Tone</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'professional' as HumanizeTone, label: 'Professional', icon: 'business_center', desc: '~same length' },
                        { value: 'creative' as HumanizeTone, label: 'Creative', icon: 'palette', desc: '~+5% words' },
                        { value: 'casual' as HumanizeTone, label: 'Casual', icon: 'emoji_people', desc: '~-5% words' },
                        { value: 'academic' as HumanizeTone, label: 'Academic', icon: 'school', desc: '~same length' },
                        { value: 'confident' as HumanizeTone, label: 'Confident', icon: 'bolt', desc: '~-10% words' },
                      ].map(t => (
                        <button
                          key={t.value}
                          onClick={() => setTone(t.value)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            tone === t.value
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-white/[0.03] text-[var(--text-secondary)] border border-white/5 hover:border-white/10'
                          }`}
                        >
                          <span className="material-symbols-rounded text-sm">{t.icon}</span>
                          {t.label}
                          <span className="text-[9px] opacity-60">{t.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Paraphrase estimate */}
                  <div className="mb-4 flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="material-symbols-rounded text-sm text-amber-400">info</span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      Estimated output: ~{Math.round(wordCount * (tone === 'creative' ? 1.05 : tone === 'casual' ? 0.95 : tone === 'confident' ? 0.9 : 1.0))} words
                      {' '}• Domain: <span className="text-rose-400 capitalize">{domain}</span>
                      {' '}• Tone: <span className="text-rose-400 capitalize">{tone}</span>
                    </span>
                  </div>

                  {/* Preview of flagged paragraphs */}
                  {originalDetection && originalDetection.paragraphScores.filter(p => p.score < 60).length > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <p className="text-xs text-red-400 font-medium mb-2">
                        {originalDetection.paragraphScores.filter(p => p.score < 60).length} paragraphs flagged for rewriting
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {originalDetection.paragraphScores.filter(p => p.score < 60).map(p => (
                          <span key={p.index} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-300">
                            ¶{p.index + 1}: {p.score}pts
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={runHumanize}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-medium text-sm shadow-lg shadow-rose-500/20"
                  >
                    <span className="material-symbols-rounded">brush</span> Humanize Now — {tone.charAt(0).toUpperCase() + tone.slice(1)} Tone
                  </motion.button>
                </div>
              )}

              {/* Humanization Animation */}
              {isHumanizing && <HumanizeAnimation />}

              {/* Post-humanize results */}
              {humanizeResult && !isHumanizing && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  {/* Score improvement */}
                  <div className="flex justify-center">
                    <ScoreImprovement
                      before={originalDetection?.humanScore ?? 0}
                      after={detection?.humanScore ?? 0}
                    />
                  </div>

                  {/* Recheck badge */}
                  {humanizeResult.recheck && (
                    <div className="flex justify-center">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold ${
                        humanizeResult.recheck.humanScore >= 70
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        <span className="material-symbols-rounded text-sm">
                          {humanizeResult.recheck.humanScore >= 70 ? 'verified' : 'warning'}
                        </span>
                        Auto-recheck: {humanizeResult.recheck.humanScore}/100
                        {humanizeResult.recheck.flaggedCount > 0 && ` • ${humanizeResult.recheck.flaggedCount} paragraphs still flagged`}
                      </div>
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="rounded-xl glass-card p-3 text-center">
                      <span className="text-lg font-bold text-blue-400">{humanizeResult.wordUsage.inputWords}</span>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Input Words</p>
                    </div>
                    <div className="rounded-xl glass-card p-3 text-center">
                      <span className="text-lg font-bold text-emerald-400">{humanizeResult.wordUsage.outputWords}</span>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Output Words</p>
                    </div>
                    <div className="rounded-xl glass-card p-3 text-center">
                      <span className="text-lg font-bold text-emerald-400">{humanizeResult.stats.bannedWordsRemoved}</span>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">AI Words Removed</p>
                    </div>
                    <div className="rounded-xl glass-card p-3 text-center">
                      <span className="text-lg font-bold text-emerald-400">{humanizeResult.stats.burstinessRange}</span>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Burstiness Range</p>
                    </div>
                    <div className="rounded-xl glass-card p-3 text-center">
                      <span className="text-lg font-bold text-amber-400">{humanizeResult.wordUsage.remaining.toLocaleString()}</span>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Words Left</p>
                    </div>
                  </div>

                  {/* Changes breakdown */}
                  {humanizeResult.changes.length > 0 && (
                    <div className="rounded-2xl glass-card p-5 space-y-3">
                      <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest">
                        Changes Made ({humanizeResult.changes.length})
                      </p>
                      {humanizeResult.changes.slice(0, 8).map((change, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="p-3 rounded-lg border border-white/5 bg-[var(--card-bg)]"
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <span className="material-symbols-rounded text-red-400 text-sm mt-0.5 shrink-0">remove</span>
                            <p className="text-xs text-red-300/70 line-through">{change.original.slice(0, 150)}</p>
                          </div>
                          <div className="flex items-start gap-2 mb-2">
                            <span className="material-symbols-rounded text-emerald-400 text-sm mt-0.5 shrink-0">add</span>
                            <p className="text-xs text-emerald-300">{change.rewritten.slice(0, 150)}</p>
                          </div>
                          <p className="text-[10px] text-[var(--text-secondary)] italic pl-6">{change.reason}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══ STEP 3: CHECK ═══ */}
          {currentStep === 'check' && (
            <motion.div key="check" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {/* Score improvement banner */}
              {originalDetection && detection && (
                <div className="flex justify-center">
                  <ScoreImprovement before={originalDetection.humanScore} after={detection.humanScore} />
                </div>
              )}

              {!uniqueness && (
                <div className="rounded-2xl glass-card p-6 text-center">
                  <span className="material-symbols-rounded text-4xl text-emerald-400 mb-3">verified</span>
                  <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Uniqueness Verification</h2>
                  <p className="text-xs text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
                    The AI Engine will analyze your humanized text for originality and flag any phrasing that mirrors common AI templates.
                  </p>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={runUniquenessCheck}
                    disabled={isChecking}
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                  >
                    {isChecking ? (
                      <><span className="material-symbols-rounded animate-spin">progress_activity</span> Checking Uniqueness...</>
                    ) : (
                      <><span className="material-symbols-rounded">verified</span> Run Uniqueness Check</>
                    )}
                  </motion.button>
                </div>
              )}

              {/* ── Rich Uniqueness Report ── */}
              {uniqueness && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  {/* Verdict + Score */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="rounded-2xl glass-card p-6 flex flex-col items-center justify-center">
                      <ScoreGauge score={uniqueness.uniquenessScore} label="Unique" />
                      <div className="mt-4 text-center">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${
                          uniqueness.verdict === 'highly_unique' || uniqueness.verdict === 'mostly_unique'
                            ? 'bg-emerald-500/10 border border-emerald-500/20'
                            : uniqueness.verdict === 'some_overlap'
                            ? 'bg-amber-500/10 border border-amber-500/20'
                            : 'bg-red-500/10 border border-red-500/20'
                        }`}>
                          <span className={`material-symbols-rounded text-sm ${verdictInfo[uniqueness.verdict]?.color}`}>
                            {verdictInfo[uniqueness.verdict]?.icon}
                          </span>
                          <span className={`text-xs font-bold ${verdictInfo[uniqueness.verdict]?.color}`}>
                            {verdictInfo[uniqueness.verdict]?.label}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-2 max-w-xs">
                          {verdictInfo[uniqueness.verdict]?.desc}
                        </p>
                      </div>
                    </div>

                    {/* Summary + Analysis */}
                    <div className="rounded-2xl glass-card p-5 space-y-4">
                      <div>
                        <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-2">Summary</p>
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{uniqueness.summary}</p>
                      </div>

                      <hr className="border-white/5" />

                      <div>
                        <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-3">
                          Per-Paragraph Analysis
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {uniqueness.analysis.map((a, i) => (
                            <div
                              key={i}
                              className={`p-3 rounded-lg border ${
                                a.score >= 70
                                  ? 'border-emerald-500/20 bg-emerald-500/5'
                                  : a.score >= 50
                                  ? 'border-amber-500/20 bg-amber-500/5'
                                  : 'border-red-500/20 bg-red-500/5'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-[var(--text-secondary)]">¶ {a.paragraphIndex + 1}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${a.score}%` }}
                                      transition={{ duration: 0.6, delay: i * 0.1 }}
                                      className={`h-full rounded-full ${getScoreBg(a.score)}`}
                                    />
                                  </div>
                                  <span className={`text-xs font-bold ${getScoreColor(a.score)}`}>{a.score}</span>
                                </div>
                              </div>
                              {a.concern && (
                                <p className="text-[10px] text-amber-400 flex items-start gap-1 mt-1">
                                  <span className="material-symbols-rounded text-[10px] mt-px">warning</span>
                                  {a.concern}
                                </p>
                              )}
                              {a.suggestion && (
                                <p className="text-[10px] text-emerald-400 flex items-start gap-1 mt-1">
                                  <span className="material-symbols-rounded text-[10px] mt-px">lightbulb</span>
                                  {a.suggestion}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══ STEP 4: EXPORT ═══ */}
          {currentStep === 'export' && (
            <motion.div key="export" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">

              {/* Summary bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {originalDetection && (
                  <div className="rounded-xl glass-card p-3 text-center">
                    <span className="text-lg font-bold text-red-400">{originalDetection.humanScore}</span>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Original Score</p>
                  </div>
                )}
                {detection && (
                  <div className="rounded-xl glass-card p-3 text-center">
                    <span className={`text-lg font-bold ${getScoreColor(detection.humanScore)}`}>{detection.humanScore}</span>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Humanized Score</p>
                  </div>
                )}
                {uniqueness && (
                  <div className="rounded-xl glass-card p-3 text-center">
                    <span className={`text-lg font-bold ${getScoreColor(uniqueness.uniquenessScore)}`}>{uniqueness.uniquenessScore}</span>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Uniqueness</p>
                  </div>
                )}
                <div className="rounded-xl glass-card p-3 text-center">
                  <span className="text-lg font-bold text-[var(--text-primary)]">{activeText.trim().split(/\s+/).filter(Boolean).length.toLocaleString()}</span>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Final Words</p>
                </div>
              </div>

              {/* Side-by-Side Comparison */}
              {humanizeResult && (
                <SideBySideView
                  originalText={inputText}
                  humanizedText={humanizeResult.rewritten}
                  changes={humanizeResult.changes}
                  originalDetection={originalDetection}
                />
              )}

              {/* Download buttons */}
              <div className="rounded-2xl glass-card p-6 text-center">
                <span className="material-symbols-rounded text-4xl text-amber-400 mb-3">download</span>
                <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Export Your Document</h2>
                <p className="text-xs text-[var(--text-secondary)] mb-6">
                  Your text is humanized and verified. Downloads go to your Downloads folder.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <motion.button
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleExport('docx')}
                    disabled={isExporting}
                    className="flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium shadow-lg shadow-blue-500/20"
                  >
                    <span className="material-symbols-rounded">description</span>
                    <div className="text-left">
                      <p className="text-sm font-bold">Word (.docx)</p>
                      <p className="text-[10px] opacity-80">Formatted for submissions</p>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleExport('txt')}
                    disabled={isExporting}
                    className="flex items-center gap-3 px-8 py-4 rounded-xl border border-white/10 hover:border-white/20 text-[var(--text-primary)] font-medium bg-[var(--card-bg)]"
                  >
                    <span className="material-symbols-rounded">text_snippet</span>
                    <div className="text-left">
                      <p className="text-sm font-bold">Plain Text (.txt)</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">Raw text file</p>
                    </div>
                  </motion.button>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeText);
                    showToast('Copied to clipboard', 'content_copy');
                  }}
                  className="mt-4 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <span className="material-symbols-rounded text-xs align-middle mr-1">content_copy</span>
                  Copy to clipboard instead
                </button>
              </div>

              {/* New session */}
              <div className="flex justify-center">
                <button
                  onClick={resetPipeline}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition-all"
                >
                  <span className="material-symbols-rounded text-sm">replay</span>
                  Start New Session
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
