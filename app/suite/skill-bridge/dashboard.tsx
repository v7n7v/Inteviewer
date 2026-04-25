'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressRing } from './components';

// ═══════════════════════════════════════
// CATEGORY COLORS
// ═══════════════════════════════════════
const CAT_COLORS: Record<string, { accent: string; ring: string; trail: (l: boolean) => string; badge: (l: boolean) => string }> = {
  technical: {
    accent: 'from-teal-400 to-cyan-500',
    ring: '#06b6d4',
    trail: (l) => l ? 'rgba(6,182,212,0.22)' : 'rgba(6,182,212,0.12)',
    badge: (l) => l ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  },
  soft: {
    accent: 'from-amber-400 to-orange-500',
    ring: '#f59e0b',
    trail: (l) => l ? 'rgba(245,158,11,0.22)' : 'rgba(245,158,11,0.12)',
    badge: (l) => l ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  domain: {
    accent: 'from-blue-400 to-indigo-500',
    ring: '#3b82f6',
    trail: (l) => l ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.12)',
    badge: (l) => l ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
};

// ═══════════════════════════════════════
// LEARNING TRACK CARD
// ═══════════════════════════════════════
function LearningTrack({ skill, category, completedDays, totalDays, planData, onDayToggle, onMarkComplete, isLight, onGeneratePlan, loadingPlan, onPractice }: {
  skill: string;
  category: string;
  completedDays: number[];
  totalDays: number;
  planData: any;
  onDayToggle: (skill: string, day: number, done: boolean) => void;
  onMarkComplete: (skill: string, complete: boolean) => void;
  isLight: boolean;
  onGeneratePlan: (skill: string) => void;
  loadingPlan: boolean;
  onPractice: (skill: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const c = CAT_COLORS[category] || CAT_COLORS.technical;
  const progress = totalDays > 0 ? Math.round((completedDays.length / totalDays) * 100) : 0;
  const isDone = completedDays.length >= totalDays;
  const schedule = planData?.schedule || [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border overflow-hidden transition-all ${
        isDone
          ? isLight ? 'bg-emerald-50/50 border-emerald-200 opacity-80' : 'bg-emerald-500/[0.03] border-emerald-500/15 opacity-70'
          : isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.02] border-white/[0.06]'
      }`}
    >
      {/* Track Header */}
      <button onClick={() => setExpanded(!expanded)} className="w-full p-5 text-left">
        <div className="flex items-center gap-4">
          <ProgressRing progress={progress} size={52} strokeWidth={4} color={isDone ? '#10b981' : c.ring} trailColor={c.trail(isLight)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white/90'}`}>{skill}</h3>
              <span className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold ${c.badge(isLight)}`}>{category}</span>
              {isDone && <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${isLight ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>✓ Done</span>}
            </div>
            {/* Mini progress bar */}
            <div className="flex items-center gap-2">
              <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`}>
                <motion.div
                  className={`h-full rounded-full bg-gradient-to-r ${isDone ? 'from-emerald-400 to-emerald-500' : c.accent}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
              <span className={`text-[10px] font-bold flex-shrink-0 ${isLight ? 'text-slate-400' : 'text-white/30'}`}>
                {completedDays.length}/{totalDays}
              </span>
            </div>
          </div>
          <span className={`material-symbols-rounded text-lg transition-transform ${expanded ? 'rotate-180' : ''} ${isLight ? 'text-slate-300' : 'text-white/20'}`}>
            expand_more
          </span>
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`px-5 pb-5 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
              {schedule.length > 0 ? (
                <div className="space-y-2 pt-4">
                  {schedule.map((day: any) => {
                    const dayNum = day.day;
                    const dayDone = completedDays.includes(dayNum);
                    return (
                      <div key={dayNum} className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                        dayDone
                          ? isLight ? 'bg-emerald-50/60' : 'bg-emerald-500/[0.04]'
                          : isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'
                      }`}>
                        <button
                          onClick={() => onDayToggle(skill, dayNum, dayDone)}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-all ${
                            dayDone
                              ? `bg-gradient-to-br ${c.accent} border-transparent text-white`
                              : isLight ? 'border-slate-200 hover:border-slate-400' : 'border-white/10 hover:border-white/25'
                          }`}
                        >
                          {dayDone && <span className="material-symbols-rounded text-xs">check</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] font-semibold ${dayDone ? (isLight ? 'text-emerald-600 line-through opacity-60' : 'text-emerald-400 line-through opacity-50') : isLight ? 'text-slate-700' : 'text-white/70'}`}>
                            Day {dayNum}: {day.focus}
                          </p>
                          {day.resources?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {day.resources.map((r: any, ri: number) => (
                                <a key={ri} href={r.url} target="_blank" rel="noopener noreferrer"
                                  className={`text-[9px] px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                                    isLight ? 'bg-slate-50 text-slate-500 hover:text-slate-700 border border-slate-200' : 'bg-white/[0.03] text-white/30 hover:text-white/50 border border-white/[0.05]'
                                  }`}
                                >
                                  {r.title}
                                </a>
                              ))}
                            </div>
                          )}
                          {/* Curated plan fallback */}
                          {!day.resources && day.resource && (
                            <a href={day.url} target="_blank" rel="noopener noreferrer"
                              className={`text-[10px] mt-1 inline-flex items-center gap-1 transition-all ${
                                isLight ? 'text-slate-400 hover:text-slate-600' : 'text-white/25 hover:text-white/50'
                              }`}
                            >
                              <span className="material-symbols-rounded text-xs">{day.platformIcon || 'link'}</span>
                              {day.platform}: {day.resource}
                            </a>
                          )}
                        </div>
                        <span className={`text-[9px] font-bold flex-shrink-0 ${isLight ? 'text-slate-300' : 'text-white/15'}`}>
                          {day.timeEstimate || (day.hours ? `${day.hours}h` : '')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="pt-4 text-center">
                  <p className={`text-xs mb-3 ${isLight ? 'text-slate-400' : 'text-white/30'}`}>No study plan yet</p>
                  <button
                    onClick={() => onGeneratePlan(skill)}
                    disabled={loadingPlan}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 mx-auto ${
                      isLight ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/15'
                    }`}
                  >
                    <span className="material-symbols-rounded text-sm">{loadingPlan ? 'progress_activity' : 'auto_awesome'}</span>
                    {loadingPlan ? 'Generating...' : 'Generate AI Plan'}
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className={`flex items-center gap-2 mt-4 pt-3 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
                <button
                  onClick={() => onMarkComplete(skill, !isDone)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    isDone
                      ? isLight ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : isLight ? 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100' : 'bg-white/[0.04] text-white/30 border border-white/[0.06] hover:bg-white/[0.08]'
                  }`}
                >
                  <span className="material-symbols-rounded text-xs">{isDone ? 'check_circle' : 'radio_button_unchecked'}</span>
                  {isDone ? 'Completed' : 'Mark Complete'}
                </button>
                <button
                  onClick={() => onPractice(skill)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    isLight ? 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/15'
                  }`}
                >
                  <span className="material-symbols-rounded text-xs">exercise</span> Practice
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════
// LEARNING DASHBOARD (Phase 3)
// ═══════════════════════════════════════
export function LearningDashboard({ allProgress, gaps, onDayToggle, onMarkComplete, onAddMore, onGeneratePlan, loadingPlans, onPractice, isLight, getExpectedDays }: {
  allProgress: any[];
  gaps: any[];
  onDayToggle: (skill: string, day: number, done: boolean) => void;
  onMarkComplete: (skill: string, complete: boolean) => void;
  onAddMore: () => void;
  onGeneratePlan: (skill: string) => void;
  loadingPlans: Record<string, boolean>;
  onPractice: (skill: string) => void;
  isLight: boolean;
  getExpectedDays: (p: any) => number;
}) {
  const activeSkills = allProgress.filter(p => p.completed_days.length < getExpectedDays(p));
  const completedSkills = allProgress.filter(p => p.completed_days.length >= getExpectedDays(p));
  const totalDone = allProgress.reduce((s, p) => s + p.completed_days.length, 0);
  const totalPossible = allProgress.reduce((s, p) => s + getExpectedDays(p), 0);
  const overallPct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

  // Calculate streak (consecutive days with activity based on last_activity_at)
  const streak = (() => {
    const dates = allProgress.map(p => p.last_activity_at).filter(Boolean).map(d => new Date(d).toDateString());
    const unique = [...new Set(dates)].sort().reverse();
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const check = new Date(today);
      check.setDate(check.getDate() - i);
      if (unique.includes(check.toDateString())) count++;
      else if (i > 0) break;
    }
    return count;
  })();

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Stats Bar */}
      <div className={`flex items-center gap-4 p-4 rounded-2xl mb-6 ${
        isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-white/[0.02] border border-white/[0.06]'
      }`}>
        <ProgressRing progress={overallPct} size={56} strokeWidth={4} color="#10b981" trailColor={isLight ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)'} />
        <div className="flex-1 flex items-center gap-5 flex-wrap">
          {[
            { label: 'Active', value: activeSkills.length, icon: 'play_circle', color: isLight ? 'text-blue-600' : 'text-blue-400' },
            { label: 'Done', value: completedSkills.length, icon: 'check_circle', color: isLight ? 'text-emerald-600' : 'text-emerald-400' },
            { label: 'Days', value: totalDone, icon: 'calendar_today', color: isLight ? 'text-slate-600' : 'text-white/60' },
            { label: 'Streak', value: `🔥 ${streak}d`, icon: '', color: isLight ? 'text-amber-600' : 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
              <p className={`text-[9px] font-medium ${isLight ? 'text-slate-400' : 'text-white/25'}`}>{s.label}</p>
            </div>
          ))}
        </div>
        <button
          onClick={onAddMore}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            isLight ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15'
          }`}
        >
          <span className="material-symbols-rounded text-sm">add</span> Add Skills
        </button>
      </div>

      {/* Active Tracks */}
      {activeSkills.length > 0 && (
        <div className="mb-6">
          <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${isLight ? 'text-slate-400' : 'text-white/25'}`}>
            <span className="material-symbols-rounded text-sm">play_circle</span> In Progress
          </h3>
          <div className="space-y-3">
            {activeSkills.map(p => (
              <LearningTrack
                key={p.skill}
                skill={p.skill}
                category={p.category}
                completedDays={p.completed_days}
                totalDays={getExpectedDays(p)}
                planData={p.plan_data}
                onDayToggle={onDayToggle}
                onMarkComplete={onMarkComplete}
                isLight={isLight}
                onGeneratePlan={onGeneratePlan}
                loadingPlan={!!loadingPlans[p.skill]}
                onPractice={onPractice}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Tracks */}
      {completedSkills.length > 0 && (
        <div className="mb-6">
          <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${isLight ? 'text-slate-400' : 'text-white/25'}`}>
            <span className="material-symbols-rounded text-sm">emoji_events</span> Completed
          </h3>
          <div className="space-y-3">
            {completedSkills.map(p => (
              <LearningTrack
                key={p.skill}
                skill={p.skill}
                category={p.category}
                completedDays={p.completed_days}
                totalDays={getExpectedDays(p)}
                planData={p.plan_data}
                onDayToggle={onDayToggle}
                onMarkComplete={onMarkComplete}
                isLight={isLight}
                onGeneratePlan={onGeneratePlan}
                loadingPlan={!!loadingPlans[p.skill]}
                onPractice={onPractice}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {allProgress.length === 0 && (
        <div className="text-center py-16">
          <div className={`w-20 h-20 rounded-3xl mx-auto mb-4 flex items-center justify-center ${isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}`}>
            <span className={`material-symbols-rounded text-4xl ${isLight ? 'text-slate-300' : 'text-white/15'}`}>school</span>
          </div>
          <p className={`text-sm font-semibold mb-1 ${isLight ? 'text-slate-600' : 'text-white/50'}`}>No learning plans yet</p>
          <p className={`text-xs mb-4 ${isLight ? 'text-slate-400' : 'text-white/25'}`}>Pick your focus skills to get started</p>
          <button
            onClick={onAddMore}
            className="px-6 py-3 rounded-xl text-sm font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
          >
            <span className="material-symbols-rounded text-sm align-middle mr-1">add</span> Pick Skills
          </button>
        </div>
      )}

      {/* Gauntlet CTA */}
      {activeSkills.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={`p-5 rounded-2xl text-center mt-6 ${
            isLight ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200' : 'bg-gradient-to-r from-amber-500/[0.04] to-orange-500/[0.04] border border-amber-500/[0.1]'
          }`}
        >
          <p className={`text-sm font-bold mb-2 ${isLight ? 'text-slate-700' : 'text-white/60'}`}>Ready to test your skills?</p>
          <button
            onClick={() => onPractice(activeSkills[0].skill)}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              isLight ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md hover:shadow-lg' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/15'
            }`}
          >
            <span className="material-symbols-rounded text-xs align-middle mr-1">exercise</span> Enter The Gauntlet
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
