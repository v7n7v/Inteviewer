'use client';

import { motion } from 'framer-motion';
import type { InterviewTelemetry } from '@/lib/interview-telemetry';

interface TelemetryCardProps {
  telemetry: InterviewTelemetry;
  isLight: boolean;
  accentColor?: string;
}

function MiniGauge({ value, max, label, verdict, color, unit, ideal }: {
  value: number; max: number; label: string; verdict: string; color: string; unit?: string; ideal?: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="text-center flex-1 min-w-[70px]">
      <div className="relative w-14 h-14 mx-auto mb-1.5">
        <svg viewBox="0 0 48 48" className="w-14 h-14 -rotate-90">
          <circle cx="24" cy="24" r="20" fill="none" strokeWidth="4"
            stroke="currentColor" className="text-white/5" />
          <motion.circle
            cx="24" cy="24" r="20" fill="none"
            stroke={color} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={125.6}
            initial={{ strokeDashoffset: 125.6 }}
            animate={{ strokeDashoffset: 125.6 - (pct / 100) * 125.6 }}
            transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold" style={{ color }}>{value}{unit}</span>
        </div>
      </div>
      <p className="text-[10px] font-semibold text-[var(--text-primary)]">{label}</p>
      <p className="text-[9px] font-medium" style={{ color }}>{verdict}</p>
      {ideal && <p className="text-[8px] text-[var(--text-muted)] mt-0.5">{ideal}</p>}
    </div>
  );
}

export default function TelemetryCard({ telemetry, isLight, accentColor = '#06d6a0' }: TelemetryCardProps) {
  const t = telemetry;

  const wpmColor = t.wpmVerdict === 'good' ? '#22c55e' : t.wpmVerdict === 'too_slow' ? '#f59e0b' : '#ef4444';
  const fillerColor = t.fillerVerdict === 'clean' ? '#22c55e' : t.fillerVerdict === 'acceptable' ? '#f59e0b' : '#ef4444';
  const kwColor = t.keywordCoverage >= 60 ? '#22c55e' : t.keywordCoverage >= 30 ? '#f59e0b' : '#ef4444';
  const starColor = t.starVerdict === 'strong' ? '#22c55e' : t.starVerdict === 'moderate' ? '#f59e0b' : '#ef4444';
  const balanceColor = t.responseBalanceVerdict === 'good' ? '#22c55e' : '#f59e0b';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: isLight ? '#fff' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center gap-2.5"
        style={{
          background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
          borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
        }}
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accentColor}15` }}>
          <span className="material-symbols-rounded text-[16px]" style={{ color: accentColor }}>monitoring</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Performance Telemetry</h3>
          <p className="text-[10px] text-[var(--text-muted)]">
            {t.totalUserWords} words · {t.questionCount} questions · {Math.round(t.totalDurationSeconds / 60)}min
          </p>
        </div>
      </div>

      {/* Gauges */}
      <div className="p-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          <MiniGauge
            value={t.wpm} max={200} label="WPM" unit=""
            verdict={t.wpmVerdict === 'good' ? 'Good pace' : t.wpmVerdict === 'too_slow' ? 'Too slow' : 'Too fast'}
            color={wpmColor} ideal={`${t.wpmIdeal.min}-${t.wpmIdeal.max}`}
          />
          <MiniGauge
            value={t.fillerRatio} max={10} label="Fillers" unit="%"
            verdict={t.fillerVerdict === 'clean' ? 'Clean' : t.fillerVerdict === 'acceptable' ? 'OK' : 'High'}
            color={fillerColor} ideal="< 3%"
          />
          <MiniGauge
            value={t.keywordCoverage} max={100} label="Keywords" unit="%"
            verdict={t.keywordCoverage >= 60 ? 'Strong' : t.keywordCoverage >= 30 ? 'Partial' : 'Low'}
            color={kwColor} ideal="> 60%"
          />
          <MiniGauge
            value={t.starScore} max={100} label="STAR" unit="%"
            verdict={t.starVerdict === 'strong' ? 'Structured' : t.starVerdict === 'moderate' ? 'Partial' : 'Unstructured'}
            color={starColor} ideal="> 60%"
          />
          <MiniGauge
            value={t.responseBalance} max={6} label="Balance" unit="x"
            verdict={t.responseBalanceVerdict === 'good' ? 'Good' : t.responseBalanceVerdict === 'too_short' ? 'Short' : 'Long'}
            color={balanceColor} ideal="2-4x"
          />
        </div>
      </div>

      {/* Filler Breakdown */}
      {t.fillers.length > 0 && (
        <div className="px-5 pb-4">
          <h4 className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Filler Words ({t.fillerCount} total)
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {t.fillers.slice(0, 8).map(f => (
              <span
                key={f.word}
                className="text-[10px] px-2 py-1 rounded-full font-medium"
                style={{
                  background: isLight ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  color: '#f59e0b',
                }}
              >
                &ldquo;{f.word}&rdquo; × {f.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Keywords */}
      {(t.keywordsHit.length > 0 || t.keywordsMissed.length > 0) && (
        <div className="px-5 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {t.keywordsHit.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <span className="material-symbols-rounded text-[12px]">check</span>
                  Mentioned ({t.keywordsHit.length})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {t.keywordsHit.slice(0, 8).map(kw => (
                    <span key={kw} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {t.keywordsMissed.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <span className="material-symbols-rounded text-[12px]">close</span>
                  Missed ({t.keywordsMissed.length})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {t.keywordsMissed.slice(0, 8).map(kw => (
                    <span key={kw} className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-[9px] text-[var(--text-muted)] text-center py-2 mx-5" style={{
        borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'}`,
      }}>
        Deterministic NLP analysis · No AI inference · Computed from raw transcript
      </p>
    </motion.div>
  );
}
