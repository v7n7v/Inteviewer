'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';
import { useStore } from '@/lib/store';
import { useUserTier } from '@/hooks/use-user-tier';
import { useGeminiLiveAvatar } from '@/hooks/useGeminiLiveAvatar';
import { authFetch } from '@/lib/auth-fetch';
import AuthModal from '@/components/modals/AuthModal';
import dynamic from 'next/dynamic';

// Lazy-load the 3D avatar component (keeps main bundle clean)
const AvatarCanvas = dynamic(() => import('@/components/interview/AvatarCanvas'), { ssr: false });

type InterviewPhase = 'setup' | 'room' | 'debrief';

interface Persona {
  id: string;
  label: string;
  desc: string;
  icon: string;
  color: string;
  voice: string;
}

const PERSONAS: Persona[] = [
  { id: 'FAANG Tech Lead', label: 'FAANG Lead', desc: 'Precise, analytical, system-design focus', icon: 'engineering', color: '#3b82f6', voice: 'Charon' },
  { id: 'Friendly HR', label: 'Friendly HR', desc: 'Warm, encouraging, helps you shine', icon: 'favorite', color: '#f43f5e', voice: 'Kore' },
  { id: 'Startup CTO', label: 'Startup CTO', desc: 'Fast-paced, ship-it mentality', icon: 'rocket_launch', color: '#f59e0b', voice: 'Fenrir' },
  { id: 'VP of Engineering', label: 'VP Engineering', desc: 'Strategic, leadership-focused', icon: 'military_tech', color: '#8b5cf6', voice: 'Puck' },
  { id: 'Consulting Partner', label: 'Consultant', desc: 'MECE frameworks, case-style', icon: 'handshake', color: '#06b6d4', voice: 'Aoede' },
  { id: 'STAR Specialist', label: 'STAR Specialist', desc: 'Deep behavioral deep-dives', icon: 'psychology', color: '#10b981', voice: 'Kore' },
];

const STYLES = [
  { id: 'behavioral', label: 'Behavioral', icon: 'psychology' },
  { id: 'technical', label: 'Technical', icon: 'code' },
  { id: 'system-design', label: 'System Design', icon: 'schema' },
  { id: 'mixed', label: 'Mixed', icon: 'shuffle' },
];

interface DebriefData {
  score: number;
  strengths: string[];
  improvements: string[];
  recommendation: string;
  summary: string;
}

export default function InterviewSimPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { user } = useStore();
  const { isPro } = useUserTier();

  const [phase, setPhase] = useState<InterviewPhase>('setup');
  const [persona, setPersona] = useState<Persona>(PERSONAS[1]);
  const [style, setStyle] = useState('behavioral');
  const [jobDesc, setJobDesc] = useState('');
  const [showAuth, setShowAuth] = useState<'login' | 'signup' | null>(null);
  const [debrief, setDebrief] = useState<DebriefData | null>(null);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);

  const gemini = useGeminiLiveAvatar();
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [gemini.fullTranscript]);

  const startInterview = useCallback(async () => {
    if (!user) { setShowAuth('signup'); return; }
    setPhase('room');
    // Connect after a brief delay to let 3D scene mount
    setTimeout(() => {
      gemini.connect({
        persona: persona.id,
        jobDescription: jobDesc,
        interviewStyle: style,
        avatarMode: true,
      });
    }, 1000);
  }, [user, persona, jobDesc, style, gemini]);

  const endInterview = useCallback(async () => {
    const transcript = gemini.getTranscript();
    gemini.disconnect();
    setPhase('debrief');
    setDebriefLoading(true);

    try {
      const formatted = transcript.map(t => `${t.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${t.text}`).join('\n');
      const res = await authFetch('/api/gauntlet/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: formatted,
          persona: persona.id,
          interviewStyle: style,
          jobDescription: jobDesc,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDebrief(data);
      }
    } catch (e) {
      console.error('Debrief error:', e);
    } finally {
      setDebriefLoading(false);
    }
  }, [gemini, persona, style, jobDesc]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const pColor = persona.color;

  // ─── SETUP PHASE ───
  if (phase === 'setup') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-8" style={{ background: isLight ? '#F8FAFC' : '#060608' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: `${pColor}12`, border: `1px solid ${pColor}25` }}
            >
              <span className="material-symbols-rounded text-[32px]" style={{ color: pColor }}>videocam</span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">AI Avatar Interview</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Face-to-face mock interview with a 3D AI interviewer. Real voice, real-time feedback.
            </p>
          </div>

          {/* Persona Selection */}
          <div className="mb-6">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 block">
              Choose Your Interviewer
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PERSONAS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPersona(p)}
                  className="p-4 rounded-xl text-left transition-all hover:scale-[1.02]"
                  style={{
                    background: persona.id === p.id ? `${p.color}10` : isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${persona.id === p.id ? p.color : isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <span className="material-symbols-rounded text-[24px] mb-2 block" style={{ color: p.color }}>{p.icon}</span>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{p.label}</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Interview Style */}
          <div className="mb-6">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 block">
              Interview Type
            </label>
            <div className="flex gap-2">
              {STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm transition-all"
                  style={{
                    background: style === s.id ? `${pColor}10` : isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${style === s.id ? pColor : 'transparent'}`,
                    color: style === s.id ? pColor : 'var(--text-secondary)',
                  }}
                >
                  <span className="material-symbols-rounded text-[16px]">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Job Description */}
          <div className="mb-8">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 block">
              Job Description <span className="text-[var(--text-muted)] font-normal">(optional — makes questions specific)</span>
            </label>
            <textarea
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              placeholder="Paste the job description here for targeted questions..."
              rows={4}
              className="w-full rounded-xl p-4 text-sm bg-transparent border outline-none resize-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              style={{ borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}
            />
          </div>

          {/* Start Button */}
          <button
            onClick={startInterview}
            className="w-full py-4 rounded-2xl text-white font-semibold text-base flex items-center justify-center gap-3 transition-all hover:opacity-90 hover:scale-[1.01]"
            style={{
              background: `linear-gradient(135deg, ${pColor} 0%, ${pColor}cc 100%)`,
              boxShadow: `0 4px 20px ${pColor}40`,
            }}
          >
            <span className="material-symbols-rounded text-[22px]">videocam</span>
            Start Interview
          </button>
        </motion.div>

        {showAuth && (
          <AuthModal mode={showAuth} onClose={() => setShowAuth(null)} onSwitchMode={() => setShowAuth(showAuth === 'login' ? 'signup' : 'login')} />
        )}
      </div>
    );
  }

  // ─── ROOM PHASE ───
  if (phase === 'room') {
    return (
      <div className="h-screen flex flex-col" style={{ background: isLight ? '#F8FAFC' : '#060608' }}>
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-3 border-b shrink-0"
          style={{ borderColor: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${pColor}15` }}>
              <span className="material-symbols-rounded text-[18px]" style={{ color: pColor }}>{persona.icon}</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{persona.label}</h2>
              <p className="text-[11px] text-[var(--text-muted)]">{style} interview</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timer */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)' }}>
              <span className="material-symbols-rounded text-[14px] text-[var(--text-muted)]">timer</span>
              <span className="text-xs font-mono text-[var(--text-secondary)] tabular-nums">{formatTime(gemini.elapsedSeconds)}</span>
            </div>

            {/* Status indicators */}
            {gemini.isConnecting && (
              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                <span className="material-symbols-rounded text-[14px] animate-spin">progress_activity</span>
                Connecting...
              </span>
            )}
            {gemini.isListening && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}

            {/* Transcript toggle */}
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors"
              title="Toggle transcript"
            >
              <span className="material-symbols-rounded text-[18px] text-[var(--text-muted)]">
                {showTranscript ? 'subtitles' : 'subtitles_off'}
              </span>
            </button>

            {/* End Interview */}
            <button
              onClick={endInterview}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 transition-colors"
            >
              <span className="material-symbols-rounded text-[16px]">call_end</span>
              End
            </button>
          </div>
        </div>

        {/* Main content: Avatar + Transcript */}
        <div className="flex-1 flex overflow-hidden">
          {/* Avatar panel */}
          <div className="flex-1 relative flex items-center justify-center" style={{ background: isLight ? '#f0f4f8' : '#0a0a0e' }}>
            {/* 3D Avatar */}
            <div className="w-full h-full">
              <AvatarCanvas
                isSpeaking={gemini.isSpeaking}
                isConnected={gemini.isConnected}
                onLoaded={() => setAvatarLoaded(true)}
                personaColor={pColor}
              />
            </div>

            {/* Mic active indicator */}
            {gemini.isListening && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
                <div className="flex items-center gap-1">
                  {[0,1,2,3,4].map(i => (
                    <motion.div
                      key={i}
                      animate={{ scaleY: gemini.isSpeaking ? [0.3, 1, 0.3] : [0.5, 0.8, 0.5] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                      className="w-[3px] rounded-full"
                      style={{ height: 16, background: gemini.isSpeaking ? pColor : '#10b981', transformOrigin: 'bottom' }}
                    />
                  ))}
                </div>
                <span className="text-xs text-white/80">
                  {gemini.isSpeaking ? 'AI Speaking...' : 'Listening...'}
                </span>
              </div>
            )}

            {/* Error overlay */}
            {gemini.error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="bg-rose-500/20 border border-rose-500/30 rounded-2xl p-6 max-w-sm text-center">
                  <span className="material-symbols-rounded text-[32px] text-rose-400 mb-2 block">error</span>
                  <p className="text-sm text-white">{gemini.error}</p>
                  <button onClick={() => setPhase('setup')} className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors">
                    Back to Setup
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Transcript sidebar */}
          <AnimatePresence>
            {showTranscript && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 340, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="shrink-0 border-l flex flex-col overflow-hidden"
                style={{
                  background: isLight ? '#fff' : '#0c0c10',
                  borderColor: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)',
                }}
              >
                <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)' }}>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Live Transcript</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Q{gemini.questionCount} · {formatTime(gemini.elapsedSeconds)}</p>
                </div>
                <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {gemini.fullTranscript.map((t, i) => (
                    <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="max-w-[90%] rounded-2xl px-3 py-2 text-xs leading-relaxed"
                        style={t.role === 'user'
                          ? { background: `${pColor}15`, color: 'var(--text-primary)' }
                          : { background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }
                        }
                      >
                        {t.role === 'ai' && (
                          <span className="text-[10px] font-medium block mb-1" style={{ color: pColor }}>{persona.label}</span>
                        )}
                        {t.text}
                      </div>
                    </div>
                  ))}
                  {gemini.fullTranscript.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] text-center py-8">
                      {gemini.isConnected ? 'Waiting for interviewer to speak...' : 'Connecting to interviewer...'}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ─── DEBRIEF PHASE ───
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8" style={{ background: isLight ? '#F8FAFC' : '#060608' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
        {debriefLoading ? (
          <div className="text-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 rounded-full border-2 border-t-transparent mx-auto mb-4"
              style={{ borderColor: `${pColor}30`, borderTopColor: 'transparent' }}
            />
            <p className="text-sm text-[var(--text-secondary)]">Analyzing your interview...</p>
          </div>
        ) : debrief ? (
          <>
            {/* Score */}
            <div className="text-center mb-8">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: `${pColor}10`, border: `3px solid ${pColor}` }}
              >
                <span className="text-3xl font-bold" style={{ color: pColor }}>{debrief.score}</span>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Interview Complete</h2>
              <p className="text-sm text-[var(--text-secondary)]">{debrief.recommendation}</p>
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <h3 className="text-sm font-semibold text-emerald-500 mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-rounded text-[16px]">thumb_up</span> Strengths
                </h3>
                <ul className="space-y-2">
                  {debrief.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">•</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <h3 className="text-sm font-semibold text-amber-500 mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-rounded text-[16px]">trending_up</span> Improve
                </h3>
                <ul className="space-y-2">
                  {debrief.improvements.map((s, i) => (
                    <li key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">•</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl p-4 mb-8" style={{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Summary</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{debrief.summary}</p>
            </div>

            <button
              onClick={() => { setPhase('setup'); setDebrief(null); }}
              className="w-full py-3 rounded-xl font-medium text-sm transition-all hover:opacity-90"
              style={{ background: `${pColor}10`, color: pColor, border: `1px solid ${pColor}30` }}
            >
              Start Another Interview
            </button>
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-sm text-[var(--text-muted)]">No debrief data available.</p>
            <button onClick={() => setPhase('setup')} className="mt-4 text-sm underline" style={{ color: pColor }}>
              Back to setup
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
