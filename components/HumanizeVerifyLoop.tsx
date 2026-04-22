'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { detectAI, splitSentences, type DetectionResult, type ParagraphScore } from '@/lib/ai-detection';
import { authFetch } from '@/lib/auth-fetch';
import { showToast } from '@/components/Toast';
import { useAuthGate } from '@/hooks/useAuthGate';
import type { WritingDomain, HumanizeTone } from '@/lib/writing-prompts';

// ── Types ──

interface HumanizeResult {
  rewritten: string;
  changes: Array<{ original: string; rewritten: string; reason: string }>;
  stats: { sentenceLengthStdDev: number; bannedWordsRemoved: number; burstinessRange: number };
  wordUsage: { inputWords: number; outputWords: number; remaining: number; cap: number };
  recheck?: { humanScore: number; verdict: string; flaggedCount: number };
}

// ── Score Bar (mini) ──

function MiniScoreBar({ label, before, after }: { label: string; before: number; after: number }) {
  const diff = after - before;
  const color = after >= 70 ? '#10b981' : after >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-[var(--text-muted)] shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${after}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="font-bold tabular-nums w-7 text-right" style={{ color }}>{after}</span>
      {diff !== 0 && (
        <span className={`text-[10px] font-medium ${diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {diff > 0 ? '+' : ''}{diff}
        </span>
      )}
    </div>
  );
}

// ── Paragraph Comparison Row ──

function ParagraphRow({ index, before, after }: {
  index: number;
  before: ParagraphScore;
  after?: ParagraphScore;
}) {
  const beforeColor = before.score >= 70 ? '#10b981' : before.score >= 45 ? '#f59e0b' : '#ef4444';
  const afterColor = after ? (after.score >= 70 ? '#10b981' : after.score >= 45 ? '#f59e0b' : '#ef4444') : beforeColor;
  const improved = after && after.score > before.score;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 p-2.5 rounded-xl border border-white/5 bg-white/[0.02]"
    >
      <span className="text-[10px] text-[var(--text-muted)] w-5 text-center shrink-0">§{index + 1}</span>

      {/* Before score */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
        style={{ backgroundColor: `${beforeColor}12`, color: beforeColor, border: `1px solid ${beforeColor}25` }}
      >
        {before.score}
      </div>

      {/* Arrow */}
      {after && (
        <>
          <span className="material-symbols-rounded text-xs text-[var(--text-muted)]">arrow_forward</span>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
            style={{ backgroundColor: `${afterColor}12`, color: afterColor, border: `1px solid ${afterColor}25` }}
          >
            {after.score}
          </div>
          {improved && (
            <span className="text-[10px] text-emerald-400 font-bold">+{after.score - before.score}</span>
          )}
        </>
      )}

      {/* Flag indicators */}
      <div className="flex-1 min-w-0">
        {before.flags.length > 0 && !after && (
          <p className="text-[9px] text-[var(--text-muted)] truncate">{before.flags[0]}</p>
        )}
        {after && after.score >= 70 && (
          <span className="text-[9px] text-emerald-400">✓ Cleared</span>
        )}
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════

interface HumanizeVerifyLoopProps {
  initialText: string;
  domain?: WritingDomain;
  tone?: HumanizeTone;
  onTextChange?: (text: string) => void;
}

export default function HumanizeVerifyLoop({
  initialText,
  domain = 'general',
  tone = 'professional',
  onTextChange,
}: HumanizeVerifyLoopProps) {
  const { handleApiError, renderAuthModal } = useAuthGate();

  // State
  const [originalText] = useState(initialText);
  const [currentText, setCurrentText] = useState(initialText);
  const [isHumanizing, setIsHumanizing] = useState(false);
  const [iterations, setIterations] = useState(0);

  // Detection results
  const [originalDetection, setOriginalDetection] = useState<DetectionResult | null>(null);
  const [currentDetection, setCurrentDetection] = useState<DetectionResult | null>(null);
  const [humanizeResult, setHumanizeResult] = useState<HumanizeResult | null>(null);

  // UI state
  const [showSideBySide, setShowSideBySide] = useState(true);
  const [showChanges, setShowChanges] = useState(false);

  // Run initial detection on mount
  const initDetection = useCallback(() => {
    if (initialText.trim().length < 30) return;
    const result = detectAI(initialText);
    setOriginalDetection(result);
    setCurrentDetection(result);
  }, [initialText]);

  // Initialize on first render
  useState(() => { initDetection(); });

  // Run humanization
  const runHumanize = async (targetParagraphs?: number[]) => {
    setIsHumanizing(true);
    try {
      const lowParagraphs = targetParagraphs ||
        currentDetection?.paragraphScores
          .filter(p => p.score < 60)
          .map(p => p.index) || [];

      const res = await authFetch('/api/writing/humanize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentText,
          domain,
          tone,
          paragraphIndices: lowParagraphs.length > 0 ? lowParagraphs : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (handleApiError(err)) { setIsHumanizing(false); return; }
        if (res.status === 429 && err.usedWords !== undefined) {
          showToast(`Word limit reached (${err.usedWords}/${err.capWords})`, 'lock');
          setIsHumanizing(false);
          return;
        }
        throw new Error(err.error || 'Humanization failed');
      }

      const result: HumanizeResult = await res.json();
      setHumanizeResult(result);
      setCurrentText(result.rewritten);
      onTextChange?.(result.rewritten);

      // Re-detect
      const newDetection = detectAI(result.rewritten);
      setCurrentDetection(newDetection);
      setIterations(prev => prev + 1);

      showToast(`Humanized! Score: ${newDetection.humanScore}/100 (+${newDetection.humanScore - (currentDetection?.humanScore || 0)})`, 'brush');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Humanization failed', 'cancel');
    } finally {
      setIsHumanizing(false);
    }
  };

  if (!originalDetection || !currentDetection) return null;

  const improved = currentDetection.humanScore > originalDetection.humanScore;
  const weakParagraphs = currentDetection.paragraphScores.filter(p => p.score < 60);
  const passesThreshold = currentDetection.humanScore >= 70;

  return (
    <div className="space-y-4">
      {renderAuthModal()}

      {/* Score Improvement Header */}
      <div className="rounded-2xl glass-card p-5 relative overflow-hidden">
        <div
          className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ backgroundColor: passesThreshold ? '#10b981' : '#f59e0b' }}
        />

        <div className="relative z-10">
          {/* Score comparison */}
          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="text-center">
              <p className="text-3xl font-black text-red-400">{originalDetection.humanScore}</p>
              <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Original</p>
            </div>

            {iterations > 0 && (
              <>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: 48 }}
                  className="flex items-center justify-center"
                >
                  <span className="material-symbols-rounded text-[var(--text-muted)]">arrow_forward</span>
                </motion.div>
                <div className="text-center">
                  <motion.p
                    key={currentDetection.humanScore}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-3xl font-black"
                    style={{ color: passesThreshold ? '#10b981' : '#f59e0b' }}
                  >
                    {currentDetection.humanScore}
                  </motion.p>
                  <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
                    After {iterations} pass{iterations > 1 ? 'es' : ''}
                  </p>
                </div>
                {improved && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-sm font-bold text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10"
                  >
                    +{currentDetection.humanScore - originalDetection.humanScore}
                  </motion.span>
                )}
              </>
            )}
          </div>

          {/* Verdict */}
          {passesThreshold ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-medium"
            >
              <span className="material-symbols-rounded text-base">verified</span>
              Passes human detection threshold
            </motion.div>
          ) : (
            <p className="text-center text-xs text-[var(--text-secondary)]">
              {weakParagraphs.length} paragraph{weakParagraphs.length !== 1 ? 's' : ''} still flagged below 60
            </p>
          )}
        </div>
      </div>

      {/* Signal Breakdown Comparison */}
      {iterations > 0 && (
        <div className="rounded-2xl glass-card p-5">
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            <span className="material-symbols-rounded text-sm">compare</span>
            Signal Improvement
          </h4>
          <div className="space-y-2">
            <MiniScoreBar label="Perplexity" before={originalDetection.breakdown.perplexity} after={currentDetection.breakdown.perplexity} />
            <MiniScoreBar label="Burstiness" before={originalDetection.breakdown.burstiness} after={currentDetection.breakdown.burstiness} />
            <MiniScoreBar label="Vocabulary" before={originalDetection.breakdown.vocabulary} after={currentDetection.breakdown.vocabulary} />
            <MiniScoreBar label="Structure" before={originalDetection.breakdown.structure} after={currentDetection.breakdown.structure} />
            <MiniScoreBar label="Zipf" before={originalDetection.breakdown.zipf} after={currentDetection.breakdown.zipf} />
            <MiniScoreBar label="N-gram" before={originalDetection.breakdown.ngramRepetition} after={currentDetection.breakdown.ngramRepetition} />
            <MiniScoreBar label="Contractions" before={originalDetection.breakdown.contractionEntropy} after={currentDetection.breakdown.contractionEntropy} />
          </div>
        </div>
      )}

      {/* Paragraph Heat Map Comparison */}
      {currentDetection.paragraphScores.length > 0 && (
        <div className="rounded-2xl glass-card p-5">
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            <span className="material-symbols-rounded text-sm">thermostat</span>
            Paragraph Scores
          </h4>
          <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
            {currentDetection.paragraphScores.map((p, i) => (
              <ParagraphRow
                key={i}
                index={i}
                before={iterations > 0 && originalDetection.paragraphScores[i]
                  ? originalDetection.paragraphScores[i]
                  : p}
                after={iterations > 0 ? p : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Changes List (from humanizer) */}
      {humanizeResult && humanizeResult.changes.length > 0 && (
        <div className="rounded-2xl glass-card p-5">
          <button
            onClick={() => setShowChanges(!showChanges)}
            className="w-full flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-rounded text-sm text-amber-400">compare_arrows</span>
              Changes Made ({humanizeResult.changes.length})
            </span>
            <span className="material-symbols-rounded text-sm transition-transform" style={{ transform: showChanges ? 'rotate(180deg)' : '' }}>
              expand_more
            </span>
          </button>
          <AnimatePresence>
            {showChanges && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-3 space-y-2"
              >
                {humanizeResult.changes.map((c, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
                    <p className="text-red-400/70 line-through">{c.original}</p>
                    <p className="text-emerald-400 mt-1">{c.rewritten}</p>
                    <p className="text-[9px] text-[var(--text-muted)] mt-1 italic">{c.reason}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!passesThreshold && (
          <button
            onClick={() => runHumanize()}
            disabled={isHumanizing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-bold hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50"
          >
            {isHumanizing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Humanizing...
              </>
            ) : (
              <>
                <span className="material-symbols-rounded text-base">brush</span>
                {iterations === 0 ? 'Humanize Text' : 'Re-Humanize Weak Sections'}
              </>
            )}
          </button>
        )}

        {weakParagraphs.length > 0 && weakParagraphs.length < currentDetection.paragraphScores.length && (
          <button
            onClick={() => runHumanize(weakParagraphs.map(p => p.index))}
            disabled={isHumanizing}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass-card text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-50"
            title={`Target ${weakParagraphs.length} weak paragraph${weakParagraphs.length > 1 ? 's' : ''}`}
          >
            <span className="material-symbols-rounded text-base">target</span>
            Fix {weakParagraphs.length} Weak
          </button>
        )}

        {passesThreshold && (
          <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
            <span className="material-symbols-rounded text-base">check_circle</span>
            Ready to use — passes detection
          </div>
        )}
      </div>

      {/* Stats Footer */}
      {humanizeResult && (
        <div className="flex items-center justify-center gap-4 text-[10px] text-[var(--text-muted)]">
          <span>Words: {humanizeResult.wordUsage.outputWords}</span>
          <span>·</span>
          <span>Banned words removed: {humanizeResult.stats.bannedWordsRemoved}</span>
          <span>·</span>
          <span>Remaining: {humanizeResult.wordUsage.remaining.toLocaleString()}/{humanizeResult.wordUsage.cap.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
