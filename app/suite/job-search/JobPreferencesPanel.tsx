'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';
import { useStore } from '@/lib/store';
import { analytics } from '@/lib/analytics';

interface JobPreferences {
  targetRoles: string[];
  preferredCities: string[];
  remotePref: 'remote' | 'hybrid' | 'onsite' | 'any';
  salaryMin: number;
  industries: string[];
  emailNotifications: boolean;
}

const INDUSTRIES = [
  { name: 'Technology', icon: 'code' },
  { name: 'Healthcare', icon: 'health_and_safety' },
  { name: 'Finance', icon: 'account_balance' },
  { name: 'Education', icon: 'school' },
  { name: 'Marketing', icon: 'campaign' },
  { name: 'Consulting', icon: 'handshake' },
  { name: 'Government', icon: 'assured_workload' },
  { name: 'Retail', icon: 'storefront' },
  { name: 'Manufacturing', icon: 'precision_manufacturing' },
  { name: 'Media', icon: 'movie' },
  { name: 'Cybersecurity', icon: 'shield' },
  { name: 'Data Science', icon: 'analytics' },
  { name: 'Legal', icon: 'gavel' },
  { name: 'Real Estate', icon: 'apartment' },
  { name: 'Nonprofit', icon: 'volunteer_activism' },
];

const SALARY_STEPS = [
  { value: 0, label: 'Any' },
  { value: 40, label: '$40k' },
  { value: 60, label: '$60k' },
  { value: 80, label: '$80k' },
  { value: 100, label: '$100k' },
  { value: 120, label: '$120k' },
  { value: 150, label: '$150k' },
  { value: 200, label: '$200k+' },
];

const WORK_STYLES = [
  { value: 'any' as const, label: 'Any', icon: 'language', desc: 'All types' },
  { value: 'remote' as const, label: 'Remote', icon: 'home', desc: 'Work from anywhere' },
  { value: 'hybrid' as const, label: 'Hybrid', icon: 'sync_alt', desc: 'Mix of both' },
  { value: 'onsite' as const, label: 'On-site', icon: 'apartment', desc: 'In office' },
];

interface Props {
  onPrefsLoaded: (prefs: JobPreferences | null) => void;
  onClose: () => void;
  visible: boolean;
}

export default function JobPreferencesPanel({ onPrefsLoaded, onClose, visible }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const user = useStore((s) => s.user);

  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState('');
  const [preferredCities, setPreferredCities] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState('');
  const [remotePref, setRemotePref] = useState<'remote' | 'hybrid' | 'onsite' | 'any'>('any');
  const [salaryMin, setSalaryMin] = useState(0);
  const [industries, setIndustries] = useState<string[]>([]);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  const roleRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);

  // Load prefs from Firestore
  useEffect(() => {
    if (!user) return;
    const token = (user as any).accessToken || (user as any).stsTokenManager?.accessToken;
    if (!token) return;

    fetch('/api/jobs/preferences', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.preferences) {
          const p = data.preferences;
          setTargetRoles(p.targetRoles || []);
          setPreferredCities(p.preferredCities || []);
          setRemotePref(p.remotePref || 'any');
          setSalaryMin(p.salaryMin || 0);
          setIndustries(p.industries || []);
          setEmailNotifications(p.emailNotifications !== false);
          setLoaded(true);
          if (!data.isNew) onPrefsLoaded(p);
          else onPrefsLoaded(null);
        }
      })
      .catch(() => setLoaded(true));
  }, [user]);

  const addRole = () => {
    const v = roleInput.trim();
    if (v && !targetRoles.includes(v) && targetRoles.length < 10) {
      setTargetRoles([...targetRoles, v]);
      setRoleInput('');
    }
  };

  const addCity = () => {
    const v = cityInput.trim();
    if (v && !preferredCities.includes(v) && preferredCities.length < 10) {
      setPreferredCities([...preferredCities, v]);
      setCityInput('');
    }
  };

  const toggleIndustry = (ind: string) => {
    setIndustries(prev =>
      prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind].slice(0, 10)
    );
  };

  const savePrefs = async () => {
    if (!user) return;
    const token = (user as any).accessToken || (user as any).stsTokenManager?.accessToken;
    if (!token) return;

    setSaving(true);
    try {
      const prefs: JobPreferences = { targetRoles, preferredCities, remotePref, salaryMin, industries, emailNotifications };
      const res = await fetch('/api/jobs/preferences', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      const data = await res.json();
      if (data.success) {
        onPrefsLoaded(prefs);
        analytics.preferencesSaved(targetRoles.length, preferredCities.length);
        onClose();
      }
    } catch (e) {
      console.error('Failed to save preferences:', e);
    } finally {
      setSaving(false);
    }
  };

  // Completion score
  const completionScore = [
    targetRoles.length > 0,
    preferredCities.length > 0,
    remotePref !== 'any',
    salaryMin > 0,
    industries.length > 0,
  ].filter(Boolean).length;

  if (!visible) return null;

  // Dynamic color based on salary position
  const salaryPct = salaryMin / 200;
  const salaryColor = salaryPct <= 0 ? { main: '#10b981', glow: 'rgba(16,185,129,0.4)', label: 'text-emerald-500', bg: 'bg-emerald-500' }
    : salaryPct <= 0.25 ? { main: '#10b981', glow: 'rgba(16,185,129,0.4)', label: 'text-emerald-500', bg: 'bg-emerald-500' }
    : salaryPct <= 0.40 ? { main: '#06b6d4', glow: 'rgba(6,182,212,0.4)', label: 'text-cyan-500', bg: 'bg-cyan-500' }
    : salaryPct <= 0.60 ? { main: '#3b82f6', glow: 'rgba(59,130,246,0.4)', label: 'text-blue-500', bg: 'bg-blue-500' }
    : salaryPct <= 0.75 ? { main: '#6366f1', glow: 'rgba(99,102,241,0.4)', label: 'text-indigo-500', bg: 'bg-indigo-500' }
    : { main: '#f59e0b', glow: 'rgba(245,158,11,0.4)', label: 'text-amber-500', bg: 'bg-amber-500' };

  const cardBg = isLight
    ? 'rgba(255,255,255,0.8)'
    : 'rgba(15,23,42,0.7)';
  const cardBorder = isLight
    ? 'rgba(6,182,212,0.12)'
    : 'rgba(6,182,212,0.15)';
  const sectionBg = isLight
    ? 'rgba(0,0,0,0.02)'
    : 'rgba(255,255,255,0.025)';
  const sectionBorder = isLight
    ? 'rgba(0,0,0,0.06)'
    : 'rgba(255,255,255,0.06)';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        transition={{ type: 'spring', bounce: 0.1, duration: 0.4 }}
        className="overflow-hidden mb-4"
      >
        <div
          className="rounded-2xl border backdrop-blur-xl overflow-hidden"
          style={{ background: cardBg, borderColor: cardBorder }}
        >
          {/* ── Header ── */}
          <div className="relative px-5 pt-5 pb-4">
            {/* Ambient glow */}
            <div className="absolute top-0 left-1/4 w-1/2 h-24 rounded-full blur-[60px] pointer-events-none" style={{
              background: isLight ? 'rgba(6,182,212,0.06)' : 'rgba(6,182,212,0.08)',
            }} />

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <span className="material-symbols-rounded text-white text-xl">tune</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] leading-tight">Search Profile</h3>
                  <p className="text-[11px] text-[var(--text-tertiary)]">Tell Sona what you're looking for</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Completion ring */}
                <div className="relative flex items-center gap-1.5">
                  <svg width="28" height="28" viewBox="0 0 28 28" className="transform -rotate-90">
                    <circle cx="14" cy="14" r="11" fill="none" stroke={isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'} strokeWidth="2.5" />
                    <circle cx="14" cy="14" r="11" fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round"
                      strokeDasharray={`${(completionScore / 5) * 69.1} 69.1`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <span className="text-[10px] font-bold text-[var(--text-tertiary)]">{completionScore}/5</span>
                </div>

                <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--bg-surface)] transition-colors">
                  <span className="material-symbols-rounded text-[var(--text-tertiary)] text-lg">close</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="px-5 pb-5 space-y-4">

            {/* Row 1: Roles + Cities — 2 column */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {/* Target Roles */}
              <div
                className="rounded-xl p-3 transition-all duration-200"
                style={{
                  background: sectionBg,
                  border: `1px solid ${focusedSection === 'roles' ? 'rgba(6,182,212,0.35)' : sectionBorder}`,
                  boxShadow: focusedSection === 'roles' ? '0 0 0 3px rgba(6,182,212,0.08)' : 'none',
                }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="material-symbols-rounded text-[14px] text-cyan-500">work</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Target Roles</span>
                  {targetRoles.length > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-cyan-500/10 text-cyan-500">{targetRoles.length}</span>
                  )}
                </div>

                {/* Tags inside input area */}
                <div
                  className="min-h-[36px] flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-text"
                  style={{
                    background: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                  onClick={() => roleRef.current?.focus()}
                >
                  <AnimatePresence mode="popLayout">
                    {targetRoles.map(r => (
                      <motion.span
                        key={r}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cyan-500/12 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shrink-0"
                      >
                        {r}
                        <button
                          onClick={(e) => { e.stopPropagation(); setTargetRoles(prev => prev.filter(x => x !== r)); }}
                          className="hover:text-red-400 transition-colors ml-0.5"
                        >
                          <span className="material-symbols-rounded text-[12px]">close</span>
                        </button>
                      </motion.span>
                    ))}
                  </AnimatePresence>
                  <input
                    ref={roleRef}
                    value={roleInput}
                    onChange={e => setRoleInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRole())}
                    onFocus={() => setFocusedSection('roles')}
                    onBlur={() => setFocusedSection(null)}
                    placeholder={targetRoles.length === 0 ? 'Software Engineer, PM...' : 'Add more...'}
                    className="flex-1 min-w-[80px] bg-transparent text-[12px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Preferred Cities */}
              <div
                className="rounded-xl p-3 transition-all duration-200"
                style={{
                  background: sectionBg,
                  border: `1px solid ${focusedSection === 'cities' ? 'rgba(16,185,129,0.35)' : sectionBorder}`,
                  boxShadow: focusedSection === 'cities' ? '0 0 0 3px rgba(16,185,129,0.08)' : 'none',
                }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="material-symbols-rounded text-[14px] text-emerald-500">location_on</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Preferred Cities</span>
                  {preferredCities.length > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/10 text-emerald-500">{preferredCities.length}</span>
                  )}
                </div>

                <div
                  className="min-h-[36px] flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-text"
                  style={{
                    background: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                  onClick={() => cityRef.current?.focus()}
                >
                  <AnimatePresence mode="popLayout">
                    {preferredCities.map(c => (
                      <motion.span
                        key={c}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0"
                      >
                        {c}
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreferredCities(prev => prev.filter(x => x !== c)); }}
                          className="hover:text-red-400 transition-colors ml-0.5"
                        >
                          <span className="material-symbols-rounded text-[12px]">close</span>
                        </button>
                      </motion.span>
                    ))}
                  </AnimatePresence>
                  <input
                    ref={cityRef}
                    value={cityInput}
                    onChange={e => setCityInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCity())}
                    onFocus={() => setFocusedSection('cities')}
                    onBlur={() => setFocusedSection(null)}
                    placeholder={preferredCities.length === 0 ? 'New York, Remote...' : 'Add more...'}
                    className="flex-1 min-w-[80px] bg-transparent text-[12px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Work Style */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="material-symbols-rounded text-[14px] text-cyan-500">laptop_mac</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">Work Style</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {WORK_STYLES.map(ws => {
                  const isActive = remotePref === ws.value;
                  return (
                    <motion.button
                      key={ws.value}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setRemotePref(ws.value)}
                      className="relative flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl text-center transition-all duration-200"
                      style={{
                        background: isActive
                          ? isLight ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.12)'
                          : sectionBg,
                        border: `1.5px solid ${isActive ? 'rgba(6,182,212,0.4)' : sectionBorder}`,
                        boxShadow: isActive ? '0 0 0 3px rgba(6,182,212,0.08), 0 2px 8px rgba(6,182,212,0.1)' : 'none',
                      }}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="workStyleIndicator"
                          className="absolute inset-0 rounded-xl border-2 border-cyan-500/40"
                          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                        />
                      )}
                      <span className={`material-symbols-rounded text-xl ${isActive ? 'text-cyan-500' : 'text-[var(--text-tertiary)]'}`}>
                        {ws.icon}
                      </span>
                      <span className={`text-[11px] font-semibold ${isActive ? 'text-cyan-500' : 'text-[var(--text-secondary)]'}`}>
                        {ws.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Row 3: Salary — Interactive Drag Slider + Money Counter */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="material-symbols-rounded text-[14px] text-emerald-500">payments</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">Minimum Salary</span>
              </div>

              {/* Money Counter Display */}
              <div className="flex items-center justify-center mb-4">
                <AnimatePresence mode="wait">
                  {salaryMin === 0 ? (
                    <motion.div
                      key="zero-state"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-1"
                    >
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-[var(--text-primary)] tabular-nums">$0</span>
                      </div>
                      <motion.p
                        animate={{ opacity: [0.4, 0.8, 0.4] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="text-[11px] text-emerald-500 font-medium flex items-center gap-1"
                      >
                        <span className="material-symbols-rounded text-[14px]">swipe</span>
                        Drag for your minimum salary
                      </motion.p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="value-state"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-0.5"
                    >
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-lg font-medium transition-colors duration-300" style={{ color: salaryColor.main }}>$</span>
                        <div className="flex overflow-hidden">
                          {/* Animated digits */}
                          {String(salaryMin * 1000).split('').map((digit, i) => (
                            <motion.span
                              key={`${i}-${digit}`}
                              initial={{ y: -20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ delay: i * 0.03, type: 'spring', bounce: 0.3 }}
                              className="text-3xl font-black text-[var(--text-primary)] tabular-nums inline-block"
                            >
                              {digit}
                            </motion.span>
                          ))}
                        </div>
                        <motion.span
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-base font-bold ml-0.5 transition-colors duration-300"
                          style={{ color: salaryColor.main }}
                        >
                          +/yr
                        </motion.span>
                      </div>
                      <p className="text-[10px] text-[var(--text-tertiary)]">
                        ${Math.round(salaryMin * 1000 / 12).toLocaleString()}/mo · ${Math.round(salaryMin * 1000 / 26).toLocaleString()}/biweekly
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Slider Track with Visible Handle */}
              <div className="relative mt-1 mb-1">
                {/* Track container */}
                <div className="relative h-[40px] flex items-center">
                  {/* Background track */}
                  <div className="absolute left-0 right-0 h-[6px] rounded-full" style={{
                    background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
                  }} />

                  {/* Fill gradient — color shifts with salary */}
                  <motion.div
                    className="absolute left-0 h-[6px] rounded-full transition-all duration-300"
                    style={{ background: `linear-gradient(90deg, #10b981, ${salaryColor.main})` }}
                    animate={{ width: `${(salaryMin / 200) * 100}%` }}
                    transition={{ type: 'spring', bounce: 0.1, duration: 0.25 }}
                  />

                  {/* Styled range input — thumb color driven by CSS var */}
                  <style jsx>{`
                    .salary-slider {
                      -webkit-appearance: none;
                      appearance: none;
                      width: 100%;
                      height: 40px;
                      background: transparent;
                      cursor: pointer;
                      position: relative;
                      z-index: 10;
                    }
                    .salary-slider::-webkit-slider-runnable-track {
                      height: 6px;
                      background: transparent;
                      border-radius: 999px;
                    }
                    .salary-slider::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      width: 24px;
                      height: 24px;
                      border-radius: 50%;
                      background: var(--salary-color, #10b981);
                      border: 3px solid white;
                      box-shadow: 0 2px 10px var(--salary-glow, rgba(16,185,129,0.4));
                      margin-top: -9px;
                      cursor: grab;
                      transition: background 0.3s, box-shadow 0.3s, transform 0.15s;
                    }
                    .salary-slider::-webkit-slider-thumb:hover {
                      transform: scale(1.15);
                      box-shadow: 0 2px 16px var(--salary-glow, rgba(16,185,129,0.6)), 0 0 0 4px rgba(255,255,255,0.08);
                    }
                    .salary-slider::-webkit-slider-thumb:active {
                      cursor: grabbing;
                      transform: scale(1.1);
                      box-shadow: 0 2px 20px var(--salary-glow, rgba(16,185,129,0.7)), 0 0 0 6px rgba(255,255,255,0.05);
                    }
                    .salary-slider::-moz-range-track {
                      height: 6px;
                      background: transparent;
                      border-radius: 999px;
                    }
                    .salary-slider::-moz-range-thumb {
                      width: 24px;
                      height: 24px;
                      border-radius: 50%;
                      background: var(--salary-color, #10b981);
                      border: 3px solid white;
                      box-shadow: 0 2px 10px var(--salary-glow, rgba(16,185,129,0.4));
                      cursor: grab;
                    }
                    .salary-slider.at-zero::-webkit-slider-thumb {
                      background: #10b981;
                      animation: heartbeat 1.3s ease-in-out infinite;
                    }
                    @keyframes heartbeat {
                      0%, 100% { transform: scale(1); box-shadow: 0 2px 10px rgba(16,185,129,0.4), 0 0 0 0 rgba(16,185,129,0.4); }
                      15% { transform: scale(1.2); box-shadow: 0 2px 16px rgba(16,185,129,0.6), 0 0 0 8px rgba(16,185,129,0.15); }
                      30% { transform: scale(1); box-shadow: 0 2px 10px rgba(16,185,129,0.4), 0 0 0 0 rgba(16,185,129,0.1); }
                      45% { transform: scale(1.15); box-shadow: 0 2px 14px rgba(16,185,129,0.5), 0 0 0 6px rgba(16,185,129,0.12); }
                      60% { transform: scale(1); }
                    }
                  `}</style>
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={5}
                    value={salaryMin}
                    onChange={e => setSalaryMin(parseInt(e.target.value))}
                    className={`salary-slider ${salaryMin === 0 ? 'at-zero' : ''}`}
                    style={{
                      '--salary-color': salaryColor.main,
                      '--salary-glow': salaryColor.glow,
                    } as React.CSSProperties}
                  />
                </div>

                {/* Tick labels */}
                <div className="flex justify-between px-0 -mt-1">
                  {SALARY_STEPS.map(step => {
                    const isAt = salaryMin === step.value;
                    const isPast = salaryMin >= step.value;
                    return (
                      <button
                        key={step.value}
                        onClick={() => setSalaryMin(step.value)}
                        className="relative"
                        style={{ width: 0, display: 'flex', justifyContent: 'center' }}
                      >
                        <span className={`text-[8px] font-bold whitespace-nowrap transition-all duration-200 ${
                          isAt ? 'text-emerald-500 scale-110' : isPast ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'
                        } hover:text-[var(--text-primary)] cursor-pointer`}>
                          {step.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Row 4: Industries */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="material-symbols-rounded text-[14px] text-cyan-500">category</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">Industries</span>
                {industries.length > 0 && (
                  <span className="ml-1 text-[10px] text-[var(--text-tertiary)]">{industries.length} selected</span>
                )}
              </div>

              {/* Dropdown */}
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) toggleIndustry(e.target.value);
                }}
                className="w-full h-9 px-3 rounded-lg text-[12px] text-[var(--text-primary)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
                style={{
                  background: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <option value="" disabled>Select industries...</option>
                {INDUSTRIES.filter(ind => !industries.includes(ind.name)).map(ind => (
                  <option key={ind.name} value={ind.name}>{ind.name}</option>
                ))}
                {INDUSTRIES.filter(ind => !industries.includes(ind.name)).length === 0 && (
                  <option value="" disabled>All industries selected</option>
                )}
              </select>

              {/* Selected Tags */}
              {industries.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <AnimatePresence mode="popLayout">
                    {industries.map(ind => {
                      const icon = INDUSTRIES.find(i => i.name === ind)?.icon || 'category';
                      return (
                        <motion.span
                          key={ind}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border shrink-0"
                          style={{
                            background: isLight ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.12)',
                            borderColor: 'rgba(6,182,212,0.25)',
                            color: '#06b6d4',
                          }}
                        >
                          <span className="material-symbols-rounded text-[12px]">{icon}</span>
                          {ind}
                          <button
                            onClick={() => toggleIndustry(ind)}
                            className="hover:text-red-400 transition-colors ml-0.5"
                          >
                            <span className="material-symbols-rounded text-[12px]">close</span>
                          </button>
                        </motion.span>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Row 5: Email notifications */}
            <div
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: sectionBg, border: `1px solid ${sectionBorder}` }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
                  background: isLight ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.1)',
                }}>
                  <span className="material-symbols-rounded text-cyan-500 text-base">notifications_active</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">Weekly Job Alerts</p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">Get curated picks in your inbox every Monday</p>
                </div>
              </div>
              <button
                onClick={() => setEmailNotifications(!emailNotifications)}
                className="relative w-11 h-6 rounded-full transition-all duration-300 shrink-0"
                style={{
                  background: emailNotifications
                    ? 'linear-gradient(135deg, #06b6d4, #10b981)'
                    : isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
                  boxShadow: emailNotifications ? '0 2px 8px rgba(6,182,212,0.3)' : 'none',
                }}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                  animate={{ left: emailNotifications ? 24 : 4 }}
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.35 }}
                />
              </button>
            </div>

            {/* Save Button */}
            <motion.button
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.995 }}
              onClick={savePrefs}
              disabled={saving || targetRoles.length === 0}
              className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white relative overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #10b981)',
                boxShadow: '0 4px 20px rgba(6,182,212,0.2), 0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              {/* Hover shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />

              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-rounded text-lg">save</span>
              )}
              {saving ? 'Saving...' : targetRoles.length === 0 ? 'Add at least one target role' : 'Save Profile & Get Suggestions'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
