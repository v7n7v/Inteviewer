'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';
import { useStore } from '@/lib/store';
import { useUserTier } from '@/hooks/use-user-tier';
import { authFetch } from '@/lib/auth-fetch';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import AuthModal from '@/components/modals/AuthModal';
import PageHelp from '@/components/PageHelp';

type Personality = 'professional' | 'coach' | 'direct';
type Message = { role: 'user' | 'assistant' | 'system'; content: string };
type ConversationMeta = { id: string; title: string; personality: string; lastMessageAt: string };

const PERSONALITY_CONFIG: Record<Personality, { label: string; icon: string; desc: string; color: string }> = {
  professional: { label: 'Professional', icon: 'business_center', desc: 'Formal & data-driven', color: '#3b82f6' },
  coach: { label: 'Coach', icon: 'fitness_center', desc: 'Warm & encouraging', color: '#10b981' },
  direct: { label: 'Direct', icon: 'bolt', desc: 'No-fluff, results only', color: '#f59e0b' },
};

const SUGGESTED_PROMPTS = [
  { icon: 'radar', text: 'Find jobs that match my resume and score them', color: '#06b6d4' },
  { icon: 'work', text: 'Review my application pipeline — any follow-ups needed?', color: '#22c55e' },
  { icon: 'description', text: 'Prep a tailored resume and cover letter for a role', color: '#f59e0b' },
  { icon: 'auto_awesome', text: 'Analyze my skill gaps and suggest what to learn', color: '#a855f7' },
];

export default function SonaAgentPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { user } = useStore();
  const { tier, isPro } = useUserTier();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [personality, setPersonality] = useState<Personality>('coach');
  const [showPersonalityPicker, setShowPersonalityPicker] = useState(false);
  const [gated, setGated] = useState<{ message: string; used: number; cap: number } | null>(null);
  const [showAuth, setShowAuth] = useState<'login' | 'signup' | null>(null);

  // Conversation persistence
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Voice: Deepgram STT + DashScope CosyVoice TTS (same stack as Interview Prep)
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const { isRecording, startRecording, stopRecording, getVisualizerData } = useAudioRecorder();
  const { isPlaying, playAudio, stopAudio } = useAudioPlayer();
  const [visualizerData, setVisualizerData] = useState<number[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // STT: Record → Deepgram transcribe → populate input
  const handleVoiceInput = useCallback(async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (!blob) return;
      setIsTranscribing(true);
      try {
        const formData = new FormData();
        formData.append('file', blob, 'sona-voice.webm');
        const res = await authFetch('/api/voice/transcribe', { method: 'POST', body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (err.upgrade) {
            // Voice is a Pro feature
            setInput('(Voice mode requires Pro — try typing instead)');
          }
          return;
        }
        const { text } = await res.json();
        if (text) setInput(prev => prev ? prev + ' ' + text : text);
      } catch (e) {
        console.error('STT error:', e);
      } finally {
        setIsTranscribing(false);
      }
    } else {
      startRecording();
      // Start visualizer animation
      const updateVisualizer = () => {
        setVisualizerData(getVisualizerData());
        animFrameRef.current = requestAnimationFrame(updateVisualizer);
      };
      animFrameRef.current = requestAnimationFrame(updateVisualizer);
    }
  }, [isRecording, stopRecording, startRecording, getVisualizerData]);

  // TTS: Send text → DashScope CosyVoice → play MP3
  const speakMessage = useCallback(async (text: string, idx: number) => {
    if (speakingIdx === idx) {
      stopAudio();
      setSpeakingIdx(null);
      return;
    }
    stopAudio();
    setSpeakingIdx(idx);
    try {
      const res = await authFetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 1000) }), // Cap at 1K chars
      });
      if (!res.ok) {
        setSpeakingIdx(null);
        return;
      }
      const audioBlob = await res.blob();
      await playAudio(audioBlob, () => setSpeakingIdx(null));
    } catch {
      setSpeakingIdx(null);
    }
  }, [speakingIdx, stopAudio, playAudio]);

  // Load personality from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sona-personality');
    if (saved && saved in PERSONALITY_CONFIG) setPersonality(saved as Personality);
    else setShowPersonalityPicker(true); // First visit
  }, []);

  // Load conversation list on mount
  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const loadConversations = async () => {
    try {
      const res = await authFetch('/api/agent/chat');
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch { /* silent */ }
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setGated(null);
    setShowSidebar(false);
    inputRef.current?.focus();
  };

  const loadConversation = async (convId: string) => {
    setLoadingHistory(true);
    setShowSidebar(false);
    setConversationId(convId);
    setMessages([]);
    setGated(null);

    try {
      // We don't have a dedicated "load messages" endpoint — the history loads server-side
      // Just set the conversation ID so the next message uses it
      // Show a brief placeholder to indicate the conversation is active
      const conv = conversations.find(c => c.id === convId);
      if (conv) {
        setPersonality((conv.personality as Personality) || 'coach');
      }
    } finally {
      setLoadingHistory(false);
      inputRef.current?.focus();
    }
  };

  const selectPersonality = (p: Personality) => {
    setPersonality(p);
    localStorage.setItem('sona-personality', p);
    setShowPersonalityPicker(false);
  };

  const sendMessage = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    if (!user) {
      setShowAuth('signup');
      return;
    }

    const userMsg: Message = { role: 'user', content: msg };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);
    setGated(null);

    try {
      const res = await authFetch('/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: updated,
          personality,
          conversationId,
        }),
      });

      const data = await res.json();

      if (data.gated) {
        setGated({ message: data.error, used: data.used, cap: data.cap });
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Failed');

      // Track conversation ID from response
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);

      // Refresh conversation list (new conversation may have been created)
      loadConversations();
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Something went wrong: ${err.message}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, messages, loading, user, personality, conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const pConfig = PERSONALITY_CONFIG[personality];

  const formatTimeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="h-screen flex" style={{ background: isLight ? '#F8FAFC' : '#060608' }}>

      {/* ═══ CONVERSATION SIDEBAR (mobile overlay + desktop panel) ═══ */}
      <AnimatePresence>
        {showSidebar && (
          <>
            {/* Backdrop (mobile) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              onClick={() => setShowSidebar(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed lg:relative z-50 w-[280px] h-full flex flex-col border-r shrink-0"
              style={{
                background: isLight ? '#fff' : '#0c0c10',
                borderColor: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)',
              }}
            >
              {/* Sidebar header */}
              <div
                className="flex items-center justify-between px-4 py-3 border-b shrink-0"
                style={{ borderColor: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)' }}
              >
                <span className="text-sm font-semibold text-[var(--text-primary)]">History</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={startNewConversation}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors"
                    title="New conversation"
                  >
                    <span className="material-symbols-rounded text-[18px] text-[var(--text-secondary)]">add</span>
                  </button>
                  <button
                    onClick={() => setShowSidebar(false)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors lg:hidden"
                  >
                    <span className="material-symbols-rounded text-[18px] text-[var(--text-secondary)]">close</span>
                  </button>
                </div>
              </div>

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {conversations.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] text-center py-8">No conversations yet</p>
                )}
                {conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => loadConversation(conv.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                      conv.id === conversationId ? '' : 'hover:bg-[var(--bg-hover)]'
                    }`}
                    style={conv.id === conversationId ? {
                      background: `${pConfig.color}10`,
                      border: `1px solid ${pConfig.color}20`,
                    } : {}}
                  >
                    <p className="text-sm text-[var(--text-primary)] truncate">{conv.title}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{formatTimeAgo(conv.lastMessageAt)}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ MAIN CHAT AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ═══ HEADER ═══ */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-3 border-b shrink-0"
          style={{ borderColor: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span className="material-symbols-rounded text-[20px] text-[var(--text-secondary)]">menu</span>
            </button>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${pConfig.color}15`, border: `1px solid ${pConfig.color}25` }}
            >
              <span className="material-symbols-rounded text-[20px]" style={{ color: pConfig.color }}>auto_awesome</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                Sona
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: `${pConfig.color}15`, color: pConfig.color }}
                >
                  {pConfig.label}
                </span>
                {tier !== 'studio' && tier !== 'god' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    {tier === 'pro' ? '1/week' : '2 demos'}
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-[var(--text-muted)]">Career Intelligence Agent</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {conversationId && (
              <button
                onClick={startNewConversation}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <span className="material-symbols-rounded text-[14px]">add</span>
                New
              </button>
            )}
            <a
              href="/suite/agent/quality"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span className="material-symbols-rounded text-[14px]" style={{ color: '#f43f5e' }}>monitoring</span>
              Quality
            </a>
            <a
              href="/suite/agent/stories"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span className="material-symbols-rounded text-[14px]" style={{ color: '#f59e0b' }}>auto_stories</span>
              Stories
            </a>
            <button
              onClick={() => setShowPersonalityPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span className="material-symbols-rounded text-[16px]" style={{ color: pConfig.color }}>{pConfig.icon}</span>
              {pConfig.label}
              <span className="material-symbols-rounded text-[14px] opacity-50">expand_more</span>
            </button>
            <PageHelp toolId="agent" />
          </div>
        </div>

        {/* ═══ CHAT AREA ═══ */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-2xl mx-auto space-y-4">

            {/* Empty state */}
            {messages.length === 0 && !gated && !loadingHistory && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{ background: `${pConfig.color}10`, border: `1px solid ${pConfig.color}20` }}
                >
                  <span className="material-symbols-rounded text-[32px]" style={{ color: pConfig.color }}>auto_awesome</span>
                </div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  {conversationId
                    ? 'Continue this conversation'
                    : personality === 'coach' ? "Hey! I'm Sona, your career co-pilot."
                    : personality === 'professional' ? "Sona Career Intelligence Agent — Ready."
                    : "Sona. What do you need?"}
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
                  {conversationId
                    ? 'Send a message to pick up where you left off. Your previous context is loaded.'
                    : 'I can analyze your resume, search for jobs, track applications, draft follow-ups, and help you strategize your next move.'}
                </p>

                {!conversationId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                    {SUGGESTED_PROMPTS.map((p) => (
                      <button
                        key={p.text}
                        onClick={() => sendMessage(p.text)}
                        className="flex items-center gap-3 p-3.5 rounded-xl text-left text-sm transition-all hover:scale-[1.02]"
                        style={{
                          background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)'}`,
                        }}
                      >
                        <span
                          className="material-symbols-rounded text-[18px] flex-shrink-0"
                          style={{ color: p.color }}
                        >{p.icon}</span>
                        <span className="text-[var(--text-secondary)]">{p.text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Messages */}
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'text-white'
                        : 'text-[var(--text-primary)]'
                    }`}
                    style={
                      msg.role === 'user'
                        ? { background: pConfig.color }
                        : { background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)' }
                    }
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="material-symbols-rounded text-[14px]" style={{ color: pConfig.color }}>auto_awesome</span>
                        <span className="text-[11px] font-medium" style={{ color: pConfig.color }}>Sona</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); speakMessage(msg.content, i); }}
                          className="ml-auto w-6 h-6 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors"
                          title={speakingIdx === i ? 'Stop speaking' : 'Read aloud'}
                        >
                          <span
                            className={`material-symbols-rounded text-[14px] ${speakingIdx === i ? 'text-rose-400' : 'text-[var(--text-muted)]'}`}
                          >
                            {speakingIdx === i ? 'stop_circle' : 'volume_up'}
                          </span>
                        </button>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading indicator */}
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div
                  className="rounded-2xl px-4 py-3 flex items-center gap-2"
                  style={{ background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)' }}
                >
                  <span className="material-symbols-rounded text-[14px] animate-spin" style={{ color: pConfig.color }}>progress_activity</span>
                  <span className="text-xs text-[var(--text-muted)]">Sona is thinking...</span>
                </div>
              </motion.div>
            )}

            {/* Gating wall */}
            {gated && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl text-center"
                style={{
                  background: isLight ? 'rgba(244,63,94,0.05)' : 'rgba(244,63,94,0.08)',
                  border: '1px solid rgba(244,63,94,0.2)',
                }}
              >
                <span className="material-symbols-rounded text-[32px] text-rose-400 mb-2 block">lock</span>
                <p className="text-sm text-[var(--text-primary)] font-medium mb-1">Sona is Resting</p>
                <p className="text-xs text-[var(--text-secondary)] mb-4">{gated.message}</p>
                <a
                  href="/suite/upgrade"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' }}
                >
                  <span className="material-symbols-rounded text-[16px]">bolt</span>
                  Unlock Sona
                </a>
              </motion.div>
            )}
          </div>
        </div>

        {/* ═══ INPUT ═══ */}
        <div
          className="shrink-0 px-4 sm:px-6 py-4 border-t"
          style={{ borderColor: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)' }}
        >
          <div className="max-w-2xl mx-auto">
            <div
              className="flex items-end gap-2 rounded-2xl p-2"
              style={{
                background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? 'Recording...' : isTranscribing ? 'Transcribing...' : gated ? 'Upgrade to continue...' : 'Ask Sona anything about your career...'}
                disabled={loading || !!gated}
                rows={1}
                className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] py-2 px-2 max-h-32"
                style={{ minHeight: '36px' }}
              />
              {/* Microphone button (Deepgram STT) */}
              <button
                onClick={handleVoiceInput}
                disabled={loading || !!gated || isTranscribing}
                className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 ${isRecording ? 'animate-pulse' : ''}`}
                style={{
                  background: isRecording ? '#f43f5e' : isTranscribing ? '#f59e0b' : 'transparent',
                  color: isRecording || isTranscribing ? '#fff' : 'var(--text-muted)',
                }}
                title={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Voice input'}
              >
                <span className="material-symbols-rounded text-[18px]">
                  {isTranscribing ? 'progress_activity' : isRecording ? 'stop_circle' : 'mic'}
                </span>
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading || !!gated}
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
                style={{
                  background: input.trim() ? pConfig.color : 'transparent',
                  color: input.trim() ? '#fff' : 'var(--text-muted)',
                }}
              >
                <span className="material-symbols-rounded text-[18px]">arrow_upward</span>
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-2 text-center">
              Sona can make mistakes. Always verify important career decisions.
            </p>
          </div>
        </div>
      </div>

      {/* ═══ PERSONALITY PICKER MODAL ═══ */}
      <AnimatePresence>
        {showPersonalityPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              className="w-full max-w-md rounded-2xl p-6"
              style={{
                background: isLight ? '#fff' : '#111114',
                border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Choose Sona&apos;s Personality</h2>
              <p className="text-xs text-[var(--text-secondary)] mb-5">You can change this anytime from the header.</p>

              <div className="space-y-3">
                {(Object.entries(PERSONALITY_CONFIG) as [Personality, typeof PERSONALITY_CONFIG[Personality]][]).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => selectPersonality(key)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.01]"
                    style={{
                      background: personality === key ? `${config.color}10` : isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                      border: `2px solid ${personality === key ? config.color : isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${config.color}15`, color: config.color }}
                    >
                      <span className="material-symbols-rounded text-[22px]">{config.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{config.label}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{config.desc}</p>
                    </div>
                    {personality === key && (
                      <span className="material-symbols-rounded text-[20px] ml-auto" style={{ color: config.color }}>check_circle</span>
                    )}
                  </button>
                ))}
              </div>

              {messages.length > 0 && (
                <button
                  onClick={() => setShowPersonalityPicker(false)}
                  className="w-full mt-4 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Cancel
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      {showAuth && (
        <AuthModal
          mode={showAuth}
          onClose={() => setShowAuth(null)}
          onSwitchMode={() => setShowAuth(showAuth === 'login' ? 'signup' : 'login')}
        />
      )}
    </div>
  );
}
