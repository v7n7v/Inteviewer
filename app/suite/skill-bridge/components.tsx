'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════
// SHARED TYPES (re-exported from page)
// ═══════════════════════════════════════
export interface SkillGap {
  skill: string;
  confidence: 'ai-added' | 'weak' | 'strong';
  category: 'technical' | 'soft' | 'domain';
  priority?: number;
  reason?: string;
}

export interface SelectedSkillConfig {
  skill: string;
  category: 'technical' | 'soft' | 'domain';
  platforms: string[];
  durationValue: number; // slider value 0-100 mapped to duration
  durationDays: number;  // computed actual days
  durationLabel: string;
}

export type Phase = 'pick' | 'configure' | 'learn';

// ═══════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════
const PRIORITY_TIERS = {
  critical: { label: 'Critical', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20', icon: 'priority_high' },
  recommended: { label: 'Recommended', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20', icon: 'trending_up' },
  optional: { label: 'Nice to Have', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', icon: 'add_circle' },
};

export const PLATFORM_OPTIONS = [
  { name: 'YouTube', icon: 'smart_display', color: 'text-red-500' },
  { name: 'Coursera', icon: 'school', color: 'text-blue-600' },
  { name: 'Official Docs', icon: 'menu_book', color: 'text-emerald-500' },
  { name: 'LinkedIn Learning', icon: 'work', color: 'text-sky-500' },
  { name: 'freeCodeCamp', icon: 'code', color: 'text-emerald-600' },
  { name: 'Udemy', icon: 'play_circle', color: 'text-violet-500' },
  { name: 'Hands-on Labs', icon: 'build', color: 'text-amber-500' },
  { name: 'Kaggle', icon: 'bar_chart', color: 'text-cyan-500' },
];

// Slider maps to these stops
const DURATION_STOPS = [
  { value: 0,   days: 0.08, label: '2-Hour Recap',       shortLabel: '2h' },
  { value: 14,  days: 0.17, label: '4-Hour Sprint',      shortLabel: '4h' },
  { value: 28,  days: 0.33, label: '8-Hour Deep Dive',   shortLabel: '8h' },
  { value: 42,  days: 1,    label: '1-Day Focus',        shortLabel: '1d' },
  { value: 56,  days: 2,    label: '2-Day Sprint',       shortLabel: '2d' },
  { value: 70,  days: 3,    label: '3-Day Focus',        shortLabel: '3d' },
  { value: 85,  days: 5,    label: '5-Day Deep Dive',    shortLabel: '5d' },
  { value: 100, days: 7,    label: '7-Day Mastery',      shortLabel: '7d' },
];

export function sliderToDuration(val: number): { days: number; label: string; shortLabel: string } {
  // Find nearest stop
  let closest = DURATION_STOPS[0];
  for (const stop of DURATION_STOPS) {
    if (Math.abs(val - stop.value) <= Math.abs(val - closest.value)) closest = stop;
  }
  return closest;
}

export function daysToSliderValue(days: number): number {
  let closest = DURATION_STOPS[0];
  for (const stop of DURATION_STOPS) {
    if (Math.abs(days - stop.days) <= Math.abs(days - closest.days)) closest = stop;
  }
  return closest.value;
}

// ═══════════════════════════════════════
// PROGRESS RING (shared)
// ═══════════════════════════════════════
export function ProgressRing({ progress, size = 64, strokeWidth = 5, color, trailColor }: {
  progress: number; size?: number; strokeWidth?: number; color: string; trailColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trailColor} strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold" style={{ color }}>{Math.round(progress)}%</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// PHASE 1: PRIORITY PICKER
// ═══════════════════════════════════════
export function PriorityPicker({ gaps, onContinue, isLight }: {
  gaps: SkillGap[];
  onContinue: (selected: SkillGap[]) => void;
  isLight: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const critical = gaps.slice(0, 3);
  const recommended = gaps.slice(3, 6);
  const optional = gaps.slice(6);

  const toggle = (skill: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill); else next.add(skill);
      return next;
    });
  };

  const handleContinue = () => {
    const selectedGaps = gaps.filter(g => selected.has(g.skill));
    if (selectedGaps.length > 0) onContinue(selectedGaps);
  };

  const renderTier = (skills: SkillGap[], tier: keyof typeof PRIORITY_TIERS) => {
    const t = PRIORITY_TIERS[tier];
    if (skills.length === 0) return null;
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className={`material-symbols-rounded text-sm ${t.color}`}>{t.icon}</span>
          <span className={`text-xs font-bold uppercase tracking-wider ${t.color}`}>{t.label}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${t.bg}`}>{skills.length}</span>
        </div>
        <div className="space-y-2">
          {skills.map(gap => {
            const isSelected = selected.has(gap.skill);
            const catColors = {
              technical: isLight ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-teal-500/10 text-teal-400 border-teal-500/20',
              soft: isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
              domain: isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            }[gap.category];

            return (
              <motion.button
                key={gap.skill}
                onClick={() => toggle(gap.skill)}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                  isSelected
                    ? isLight
                      ? 'bg-emerald-50 border-emerald-300 shadow-sm ring-2 ring-emerald-500/20'
                      : 'bg-emerald-500/[0.08] border-emerald-500/30 ring-2 ring-emerald-500/10'
                    : isLight
                      ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                {/* Checkbox */}
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                  isSelected
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : isLight ? 'border-slate-300' : 'border-white/20'
                }`}>
                  {isSelected && <span className="material-symbols-rounded text-sm">check</span>}
                </div>

                {/* Skill info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white/90'}`}>{gap.skill}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold ${catColors}`}>{gap.category}</span>
                  </div>
                  {gap.reason && (
                    <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-white/30'}`}>{gap.reason}</p>
                  )}
                </div>

                {/* Priority indicator */}
                <span className={`text-[10px] font-bold ${t.color}`}>#{gaps.indexOf(gap) + 1}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="text-center mb-8">
        <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
          isLight ? 'bg-emerald-50' : 'bg-emerald-500/10'
        }`}>
          <span className={`material-symbols-rounded text-3xl ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>target</span>
        </div>
        <h2 className={`text-xl font-bold mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
          Pick Your Focus Skills
        </h2>
        <p className={`text-sm max-w-md mx-auto ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
          AI ranked these by job relevance. Select <strong>3–5 skills</strong> to build your learning plan.
        </p>
      </div>

      {renderTier(critical, 'critical')}
      {renderTier(recommended, 'recommended')}

      {optional.length > 0 && (
        <>
          <button
            onClick={() => setShowAll(!showAll)}
            className={`w-full py-3 rounded-xl text-xs font-semibold mb-4 transition-all flex items-center justify-center gap-2 ${
              isLight ? 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200' : 'bg-white/[0.03] text-white/30 hover:bg-white/[0.06] border border-white/[0.06]'
            }`}
          >
            <span className="material-symbols-rounded text-sm">{showAll ? 'expand_less' : 'expand_more'}</span>
            {showAll ? 'Show Less' : `Show ${optional.length} More Skills`}
          </button>
          <AnimatePresence>
            {showAll && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                {renderTier(optional, 'optional')}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Continue CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: selected.size > 0 ? 1 : 0.4 }}
        className="sticky bottom-6 mt-8"
      >
        <button
          onClick={handleContinue}
          disabled={selected.size === 0}
          className={`w-full py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            selected.size > 0
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600'
              : isLight ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white/5 text-white/20 cursor-not-allowed'
          }`}
        >
          <span className="material-symbols-rounded text-lg">arrow_forward</span>
          {selected.size > 0 ? `Configure ${selected.size} Skill${selected.size > 1 ? 's' : ''}` : 'Select at least 1 skill'}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════
// PHASE 2: PLAN CONFIGURATOR
// ═══════════════════════════════════════
export function PlanConfigurator({ selectedSkills, onGenerate, onBack, isLight, isGenerating }: {
  selectedSkills: SkillGap[];
  onGenerate: (configs: SelectedSkillConfig[]) => void;
  onBack: () => void;
  isLight: boolean;
  isGenerating: boolean;
}) {
  const [configs, setConfigs] = useState<SelectedSkillConfig[]>(
    selectedSkills.map(g => {
      const defaultSlider = 56; // ~2 days default
      const dur = sliderToDuration(defaultSlider);
      return {
        skill: g.skill,
        category: g.category,
        platforms: ['YouTube', 'Official Docs'],
        durationValue: defaultSlider,
        durationDays: dur.days,
        durationLabel: dur.label,
      };
    })
  );

  const updateConfig = (idx: number, field: Partial<SelectedSkillConfig>) => {
    setConfigs(prev => prev.map((c, i) => i === idx ? { ...c, ...field } : c));
  };

  const handleSlider = (idx: number, val: number) => {
    const dur = sliderToDuration(val);
    updateConfig(idx, { durationValue: val, durationDays: dur.days, durationLabel: dur.label });
  };

  const togglePlatform = (idx: number, platform: string) => {
    const c = configs[idx];
    const has = c.platforms.includes(platform);
    if (has && c.platforms.length <= 1) return; // keep at least 1
    updateConfig(idx, {
      platforms: has ? c.platforms.filter(p => p !== platform) : [...c.platforms, platform],
    });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}>
      {/* Back button */}
      <button onClick={onBack} className={`flex items-center gap-1 text-xs font-semibold mb-6 transition-all ${
        isLight ? 'text-slate-500 hover:text-slate-700' : 'text-white/30 hover:text-white/60'
      }`}>
        <span className="material-symbols-rounded text-sm">arrow_back</span> Back to skill selection
      </button>

      <div className="text-center mb-8">
        <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
          isLight ? 'bg-indigo-50' : 'bg-indigo-500/10'
        }`}>
          <span className={`material-symbols-rounded text-3xl ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>tune</span>
        </div>
        <h2 className={`text-xl font-bold mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>Configure Your Plans</h2>
        <p className={`text-sm max-w-md mx-auto ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
          Set duration and platform preferences for each skill.
        </p>
      </div>

      <div className="space-y-4">
        {configs.map((cfg, idx) => (
          <motion.div
            key={cfg.skill}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            className={`p-6 rounded-2xl border transition-all ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.02] border-white/[0.06]'
            }`}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold ${
                  isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.06] text-white/50'
                }`}>{idx + 1}</div>
                <h3 className={`text-base font-bold ${isLight ? 'text-slate-800' : 'text-white/90'}`}>{cfg.skill}</h3>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                isLight ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-500/10 text-indigo-400'
              }`}>{cfg.durationLabel}</span>
            </div>

            {/* Duration Slider */}
            <div className="mb-5">
              <label className={`text-[10px] font-bold uppercase tracking-wider mb-2 block ${isLight ? 'text-slate-400' : 'text-white/25'}`}>
                Duration
              </label>
              <div className="relative">
                <input
                  type="range"
                  min={0} max={100} step={1}
                  value={cfg.durationValue}
                  onChange={(e) => handleSlider(idx, Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-emerald-500"
                  style={{
                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${cfg.durationValue}%, ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'} ${cfg.durationValue}%, ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'} 100%)`,
                  }}
                />
                <div className="flex justify-between mt-1">
                  <span className={`text-[9px] ${isLight ? 'text-slate-300' : 'text-white/15'}`}>2h</span>
                  <span className={`text-[9px] ${isLight ? 'text-slate-300' : 'text-white/15'}`}>7 days</span>
                </div>
              </div>
            </div>

            {/* Platform Chips */}
            <div>
              <label className={`text-[10px] font-bold uppercase tracking-wider mb-2 block ${isLight ? 'text-slate-400' : 'text-white/25'}`}>
                Preferred Platforms
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORM_OPTIONS.map(p => {
                  const isOn = cfg.platforms.includes(p.name);
                  return (
                    <button
                      key={p.name}
                      onClick={() => togglePlatform(idx, p.name)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                        isOn
                          ? isLight ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : isLight ? 'bg-slate-50 text-slate-400 border border-slate-200 hover:border-slate-300' : 'bg-white/[0.02] text-white/25 border border-white/[0.06] hover:border-white/[0.12]'
                      }`}
                    >
                      <span className={`material-symbols-rounded text-xs ${isOn ? '' : 'opacity-40'}`}>{p.icon}</span>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Generate CTA */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-8">
        <button
          onClick={() => onGenerate(configs)}
          disabled={isGenerating}
          className={`w-full py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            isGenerating
              ? isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-white/20'
              : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600'
          }`}
        >
          {isGenerating ? (
            <><span className="material-symbols-rounded text-lg animate-spin">progress_activity</span> Generating Plans...</>
          ) : (
            <><span className="material-symbols-rounded text-lg">auto_awesome</span> Generate {configs.length} Study Plan{configs.length > 1 ? 's' : ''}</>
          )}
        </button>
      </motion.div>
    </motion.div>
  );
}
