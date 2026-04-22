'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { detectAI, type DetectionResult, type ParagraphScore } from '@/lib/ai-detection';
import { authFetch } from '@/lib/auth-fetch';
import { showToast } from '@/components/Toast';
import { useAuthGate } from '@/hooks/useAuthGate';

// ── Types ──

interface DeepScanResult {
  predictabilityScore: number;
  humanConfidence: number;
  verdict: 'likely_ai' | 'mixed' | 'likely_human';
  sentenceSamples: Array<{
    original: string;
    masked: string;
    predicted: string;
    overlap: number;
  }>;
}

// ── Gauge Component ──

function SignalGauge({ value, label, subtitle, size = 80 }: {
  value: number; label: string; subtitle: string; size?: number;
}) {
  const radius = (size - 12) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = (value / 100) * circumference;
  const color = value >= 70 ? '#10b981' : value >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="currentColor" strokeWidth="4"
            className="text-white/5"
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg font-bold" style={{ color }}
          >
            {value}
          </motion.span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-semibold text-[var(--text-primary)]">{label}</p>
        <p className="text-[9px] text-[var(--text-muted)]">{subtitle}</p>
      </div>
    </div>
  );
}

// ── Paragraph Heat Map ──

function ParagraphHeatMap({ paragraphs }: { paragraphs: ParagraphScore[] }) {
  if (paragraphs.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-2">
        <span className="material-symbols-rounded text-sm">thermostat</span>
        Paragraph Heat Map
      </h4>
      <div className="space-y-1.5">
        {paragraphs.map((p, i) => {
          const color = p.score >= 70 ? '#10b981' : p.score >= 45 ? '#f59e0b' : '#ef4444';
          const bgColor = p.score >= 70 ? 'rgba(16,185,129,0.08)' : p.score >= 45 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.12)';
          const borderColor = p.score >= 70 ? 'rgba(16,185,129,0.15)' : p.score >= 45 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.2)';

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 p-3 rounded-xl border"
              style={{ backgroundColor: bgColor, borderColor }}
            >
              {/* Score badge */}
              <div
                className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30` }}
              >
                {p.score}
              </div>
              {/* Text preview */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-primary)] line-clamp-2 leading-relaxed">
                  {p.text.slice(0, 200)}{p.text.length > 200 ? '...' : ''}
                </p>
                {p.flags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.flags.slice(0, 2).map((flag, fi) => (
                      <span key={fi} className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 text-[var(--text-muted)]">
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <span className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)]">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30 border border-emerald-500/20" />
          Human-like (70+)
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)]">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/30 border border-amber-500/20" />
          Mixed (45-69)
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)]">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/30 border border-red-500/20" />
          AI-likely (0-44)
        </span>
      </div>
    </div>
  );
}

// ── Flesch-Kincaid Readability Score ──

function computeReadability(text: string): { score: number; gradeLevel: string } {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  if (sentences.length === 0 || words.length === 0) return { score: 50, gradeLevel: 'N/A' };

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  // Flesch Reading Ease
  const flesch = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
  const score = Math.max(0, Math.min(100, Math.round(flesch)));

  // Flesch-Kincaid Grade Level
  const grade = (0.39 * avgWordsPerSentence) + (11.8 * avgSyllablesPerWord) - 15.59;
  const gradeLevel = grade <= 6 ? '6th Grade' :
    grade <= 8 ? '7-8th Grade' :
    grade <= 10 ? '9-10th Grade' :
    grade <= 12 ? '11-12th Grade' :
    grade <= 14 ? 'College' : 'Graduate';

  return { score, gradeLevel };
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

// ══════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════

interface DetectionDashboardProps {
  text: string;
  onHumanize?: () => void;
}

export default function DetectionDashboard({ text, onHumanize }: DetectionDashboardProps) {
  const { handleApiError, renderAuthModal } = useAuthGate();

  const [heuristicResult, setHeuristicResult] = useState<DetectionResult | null>(null);
  const [deepResult, setDeepResult] = useState<DeepScanResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDeepScanning, setIsDeepScanning] = useState(false);
  const [showParagraphs, setShowParagraphs] = useState(false);

  const readability = text.trim().length > 30 ? computeReadability(text) : null;

  // Run heuristic detection (client-side, instant)
  const runHeuristic = useCallback(() => {
    if (!text.trim() || text.trim().length < 30) {
      showToast('Need at least 30 characters', 'cancel');
      return;
    }
    setIsAnalyzing(true);
    // Small delay for UX feel
    setTimeout(() => {
      const result = detectAI(text);
      setHeuristicResult(result);
      setIsAnalyzing(false);
    }, 400);
  }, [text]);

  // Run deep scan (server-side, LLM-assisted)
  const runDeepScan = async () => {
    setIsDeepScanning(true);
    try {
      const res = await authFetch('/api/writing/deep-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (handleApiError(err)) { setIsDeepScanning(false); return; }
        throw new Error(err.error || 'Deep scan failed');
      }

      const data = await res.json();
      setDeepResult(data);
      showToast(`Deep Scan: ${data.humanConfidence}% human confidence`, 'verified');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Deep scan failed', 'cancel');
    } finally {
      setIsDeepScanning(false);
    }
  };

  const hasResults = heuristicResult !== null;

  return (
    <div className="space-y-4">
      {renderAuthModal()}

      {/* Scan Button */}
      {!hasResults && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={runHeuristic}
          disabled={isAnalyzing || text.trim().length < 30}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 text-white font-bold text-sm hover:shadow-lg hover:shadow-rose-500/25 transition-all disabled:opacity-50"
        >
          {isAnalyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <span className="material-symbols-rounded text-lg">radar</span>
              Run Multi-Signal AI Scan
            </>
          )}
        </motion.button>
      )}

      {/* Results Dashboard */}
      <AnimatePresence>
        {hasResults && heuristicResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Overall Verdict Card */}
            <div className="rounded-2xl glass-card p-5 relative overflow-hidden">
              <div
                className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-15 pointer-events-none"
                style={{ backgroundColor: getVerdictColor(heuristicResult.humanScore) }}
              />

              <div className="relative z-10 flex items-center gap-5">
                {/* Main Score */}
                <SignalGauge
                  value={heuristicResult.humanScore}
                  label="Human Score"
                  subtitle="7-signal composite"
                  size={100}
                />

                {/* Verdict */}
                <div className="flex-1">
                  <h3
                    className="text-lg font-bold mb-0.5"
                    style={{ color: getVerdictColor(heuristicResult.humanScore) }}
                  >
                    {heuristicResult.humanScore >= 70 ? 'Likely Human' :
                     heuristicResult.humanScore >= 45 ? 'Mixed Signals' : 'Likely AI-Generated'}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {heuristicResult.flags.length} issue{heuristicResult.flags.length !== 1 ? 's' : ''} flagged
                    {' · '}
                    {heuristicResult.paragraphScores.length} paragraph{heuristicResult.paragraphScores.length !== 1 ? 's' : ''} analyzed
                  </p>
                </div>
              </div>
            </div>

            {/* Signal Gauges Grid */}
            <div className="rounded-2xl glass-card p-5">
              <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                <span className="material-symbols-rounded text-sm">dashboard</span>
                Detection Signals
              </h4>
              <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                <SignalGauge value={heuristicResult.breakdown.perplexity} label="Perplexity" subtitle="Word predictability" size={72} />
                <SignalGauge value={heuristicResult.breakdown.burstiness} label="Burstiness" subtitle="Sentence variance" size={72} />
                <SignalGauge value={heuristicResult.breakdown.vocabulary} label="Vocabulary" subtitle="AI-tell words" size={72} />
                <SignalGauge value={heuristicResult.breakdown.structure} label="Structure" subtitle="Format patterns" size={72} />
                <SignalGauge value={heuristicResult.breakdown.zipf} label="Zipf" subtitle="Word frequency" size={72} />
                <SignalGauge value={heuristicResult.breakdown.ngramRepetition} label="N-gram" subtitle="Phrase repetition" size={72} />
                <SignalGauge value={heuristicResult.breakdown.contractionEntropy} label="Contractions" subtitle="Usage variance" size={72} />
              </div>

              {/* Readability Score */}
              {readability && (
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-4">
                  <SignalGauge value={readability.score} label="Readability" subtitle={readability.gradeLevel} size={72} />
                  <div className="flex-1">
                    <p className="text-xs text-[var(--text-secondary)]">
                      Flesch Reading Ease: <strong className="text-[var(--text-primary)]">{readability.score}</strong>
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      Grade level: {readability.gradeLevel}. Higher readability = more natural writing.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Deep Scan Section */}
            <div className="rounded-2xl glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                  <span className="material-symbols-rounded text-sm text-rose-400">biotech</span>
                  Deep Scan — LLM Predictability
                </h4>
                {!deepResult && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                    PRO
                  </span>
                )}
              </div>

              {deepResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <SignalGauge
                      value={deepResult.humanConfidence}
                      label="Human Confidence"
                      subtitle="LLM-tested"
                      size={80}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: getVerdictColor(deepResult.humanConfidence) }}>
                        {deepResult.verdict === 'likely_human' ? 'Passes Deep Scan' :
                         deepResult.verdict === 'mixed' ? 'Inconclusive' : 'Flagged by Deep Scan'}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {deepResult.sentenceSamples.length} sentences tested via masked completion
                      </p>
                    </div>
                  </div>

                  {/* Sample Predictions */}
                  {deepResult.sentenceSamples.length > 0 && (
                    <div className="space-y-1.5 mt-3">
                      {deepResult.sentenceSamples.slice(0, 3).map((s, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
                          <p className="text-[var(--text-muted)]">{s.masked}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[var(--text-secondary)]">AI predicted: <em className="text-[var(--text-primary)]">{s.predicted}</em></span>
                            <span className={`ml-auto text-[10px] font-bold ${s.overlap >= 0.6 ? 'text-red-400' : s.overlap >= 0.3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {Math.round(s.overlap * 100)}% match
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={runDeepScan}
                  disabled={isDeepScanning}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium hover:bg-rose-500/15 transition-all disabled:opacity-50"
                >
                  {isDeepScanning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin" />
                      Running Deep Scan...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-rounded text-base">biotech</span>
                      Run Deep Scan (LLM-Powered)
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Paragraph Heat Map (collapsible) */}
            {heuristicResult.paragraphScores.length > 0 && (
              <div className="rounded-2xl glass-card p-5">
                <button
                  onClick={() => setShowParagraphs(!showParagraphs)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-rounded text-sm">thermostat</span>
                    Paragraph Heat Map ({heuristicResult.paragraphScores.length})
                  </span>
                  <span className="material-symbols-rounded text-sm transition-transform" style={{ transform: showParagraphs ? 'rotate(180deg)' : '' }}>
                    expand_more
                  </span>
                </button>
                <AnimatePresence>
                  {showParagraphs && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-3"
                    >
                      <ParagraphHeatMap paragraphs={heuristicResult.paragraphScores} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => { setHeuristicResult(null); setDeepResult(null); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass-card text-sm font-medium text-[var(--text-secondary)] hover:bg-white/5 transition-all"
              >
                <span className="material-symbols-rounded text-base">refresh</span>
                Re-scan
              </button>
              {onHumanize && heuristicResult.humanScore < 70 && (
                <button
                  onClick={onHumanize}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-bold hover:shadow-lg hover:shadow-amber-500/25 transition-all"
                >
                  <span className="material-symbols-rounded text-base">brush</span>
                  Humanize Text
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getVerdictColor(score: number): string {
  if (score >= 70) return '#10b981';
  if (score >= 45) return '#f59e0b';
  return '#ef4444';
}
