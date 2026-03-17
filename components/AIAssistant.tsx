'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useTheme } from '@/components/ThemeProvider';
import { getJobApplications, getResumeVersions, getUserProfile } from '@/lib/database-suite';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIAssistant() {
  const { user } = useStore();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Sona, your AI career companion ✨. I know about your applications, resumes, and interview prep. Ask me anything — I'm personalized to you!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextRef = useRef<string>('');
  const contextLoadedRef = useRef(false);

  // Build user context from Firestore (cached per session)
  const buildUserContext = useCallback(async () => {
    if (contextLoadedRef.current) return contextRef.current;
    try {
      const [appsResult, resumesResult, profileResult] = await Promise.allSettled([
        getJobApplications(),
        getResumeVersions(),
        getUserProfile(),
      ]);

      const parts: string[] = [];

      // Profile
      if (profileResult.status === 'fulfilled' && profileResult.value.success && profileResult.value.data) {
        const p = profileResult.value.data;
        parts.push(`## User Profile\n- Name: ${p.full_name || 'Unknown'}\n- Email: ${p.email || 'Unknown'}\n- Skills: ${p.skills?.join(', ') || 'Not specified'}`);
      }

      // Applications
      if (appsResult.status === 'fulfilled' && appsResult.value.success && appsResult.value.data) {
        const apps = appsResult.value.data;
        const statusCount: Record<string, number> = {};
        const appLines = apps.slice(0, 15).map(a => {
          statusCount[a.status] = (statusCount[a.status] || 0) + 1;
          return `  - ${a.company_name} — ${a.job_title || 'Unknown'} [${a.status}]${a.notes ? ` | Notes: ${a.notes.substring(0, 80)}` : ''} | Added: ${new Date(a.created_at).toLocaleDateString()}`;
        });
        parts.push(`## Job Applications (${apps.length} total)\nStatus: ${Object.entries(statusCount).map(([k, v]) => `${k}: ${v}`).join(', ')}\n${appLines.join('\n')}`);
      }

      // Resumes
      if (resumesResult.status === 'fulfilled' && resumesResult.value.success && resumesResult.value.data) {
        const resumes = resumesResult.value.data;
        parts.push(`## Resumes (${resumes.length} versions)\n${resumes.slice(0, 5).map(r =>
          `  - "${r.version_name || 'Untitled'}" — Mode: ${r.mode || 'General'}`
        ).join('\n')}`);
      }

      contextRef.current = parts.length > 0 ? parts.join('\n\n') : '(New user — no data yet)';
      contextLoadedRef.current = true;
      return contextRef.current;
    } catch (err) {
      console.warn('Context fetch error:', err);
      return '(Context temporarily unavailable)';
    }
  }, []);

  const hintMessages = [
    { text: "Ask Sona anything ✨", emoji: "💬" },
    { text: "How's my job search going?", emoji: "📊" },
    { text: "Help me prep for Amazon", emoji: "🎯" },
    { text: "Which apps need follow-ups?", emoji: "📋" },
    { text: "Review my resume for Google", emoji: "📝" },
    { text: "How to answer 'Why us?'", emoji: "🤔" },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Popup hint every 2 minutes (only when chat is closed)
  useEffect(() => {
    if (isOpen) return;
    const showHintPopup = () => {
      setShowHint(true);
      setHintIndex(prev => (prev + 1) % hintMessages.length);
      setTimeout(() => setShowHint(false), 3000);
    };
    const initialTimer = setTimeout(showHintPopup, 30000);
    const interval = setInterval(showHintPopup, 120000);
    return () => { clearTimeout(initialTimer); clearInterval(interval); };
  }, [isOpen, hintMessages.length]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);

    // Add placeholder assistant message for streaming
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);

    try {
      const conversationHistory = messages
        .filter(m => m.id !== '1') // skip initial greeting
        .slice(-8)
        .map(m => ({ role: m.role, content: m.content }));

      conversationHistory.push({ role: 'user', content: userMessage.content });

      // Fetch user context (cached)
      const userContext = await buildUserContext();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          userContext,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `API error: ${response.status}`);
      }

      // Stream the response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

          for (const line of lines) {
            const data = line.replace('data: ', '');
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                setMessages(prev =>
                  prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)
                );
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      }

      // Final update
      if (!fullContent) {
        const fallbackData = await response.text();
        try {
          const parsed = JSON.parse(fallbackData);
          fullContent = parsed.content || parsed.message || fallbackData;
        } catch {
          fullContent = fallbackData || "I'm sorry, I couldn't generate a response. Please try again.";
        }
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)
        );
      }
    } catch (error: any) {
      console.error('AI Companion error:', error);
      setMessages(prev =>
        prev.map(m => m.id === assistantId
          ? { ...m, content: `Sorry, I encountered an error: ${error.message}. Please try again.` }
          : m
        )
      );
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = [
    "How's my job search going?",
    "Which applications need follow-up?",
    "Help me prep for my next interview",
    "Tips for salary negotiation",
  ];

  return (
    <div className="fixed bottom-0 right-0 z-[9999] pointer-events-none">
      <div className="relative">
        {/* Hint Popup */}
        <AnimatePresence>
          {showHint && !isOpen && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.95 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="absolute bottom-20 right-6 pointer-events-auto"
            >
              <div
                onClick={() => { setShowHint(false); setIsOpen(true); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl cursor-pointer transition-all group ${
                  isLight
                    ? 'bg-white border-gray-200 hover:border-blue-300'
                    : 'bg-[var(--theme-bg-elevated)] border-[var(--theme-border)] hover:border-[var(--theme-border-hover)]'
                }`}
                style={{ boxShadow: isLight ? '0 4px 20px rgba(0, 0, 0, 0.1)' : '0 4px 20px rgba(0, 0, 0, 0.5)' }}
              >
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-cyan-500/50 flex-shrink-0">
                  <img src="/sona-avatar.png" alt="Sona" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className={`font-medium text-sm transition-colors ${isLight ? 'text-gray-800 group-hover:text-blue-600' : 'text-white group-hover:text-cyan-400'}`}>
                    {hintMessages[hintIndex].text}
                  </p>
                  <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>Click to chat with Sona</p>
                </div>
                <span className="text-xl ml-1">{hintMessages[hintIndex].emoji}</span>
              </div>
              <div className={`absolute -bottom-2 right-10 w-4 h-4 rotate-45 ${isLight ? 'bg-white border-r border-b border-gray-200' : 'bg-[var(--theme-bg-elevated)] border-r border-b border-[var(--theme-border)]'}`} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Window */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-[76px] right-6 w-[400px] h-[520px] pointer-events-auto"
              style={{ backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}
            >
              <div className={`glass-card h-full flex flex-col rounded-2xl shadow-2xl overflow-hidden`}>
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-[var(--theme-border)] bg-[var(--theme-bg-input)]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-cyan-500/30">
                      <img src="/sona-avatar.png" alt="Sona" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className={`text-xs font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>Sona</h3>
                      <p className={`text-[10px] ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>Context-Aware Career AI</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] text-green-400 mr-2">Live</span>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 ${message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-[var(--theme-bg-input)] text-[var(--theme-text)]'
                        }`}
                      >
                        <p className="text-xs whitespace-pre-wrap leading-relaxed">{message.content || '...'}</p>
                        <p className="text-[10px] mt-1 opacity-50">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </motion.div>
                  ))}

                  {isLoading && !isStreaming && (
                    <div className="flex justify-start">
                      <div className="bg-white/10 rounded-xl px-3 py-2">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Prompts */}
                {messages.length === 1 && !isLoading && (
                  <div className="px-3 pb-2">
                    <p className="text-[10px] text-slate-400 mb-1.5">Ask me about your job search:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {quickPrompts.map((prompt, index) => (
                        <button
                          key={index}
                          onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                          className={`text-[10px] px-2.5 py-1.5 rounded-full transition-colors ${isLight
                            ? 'bg-gray-100 hover:bg-blue-50 text-gray-700 border border-gray-200 hover:border-blue-300'
                            : 'bg-white/5 hover:bg-cyan-500/10 text-slate-300 border border-white/10 hover:border-cyan-500/30'
                          }`}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="p-3 border-t border-[var(--theme-border)] bg-[var(--theme-bg-input)]">
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask about your applications, interviews..."
                      disabled={isLoading}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs outline-none transition-colors disabled:opacity-50 bg-[var(--theme-bg-card)] border border-[var(--theme-border)] text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:border-blue-500`}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="px-3 py-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle Button */}
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full overflow-hidden shadow-lg hover:shadow-2xl transition-all flex items-center justify-center pointer-events-auto border-2 border-cyan-500/50"
          style={{ boxShadow: '0 0 40px rgba(0, 245, 255, 0.3)' }}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.div>
            ) : (
              <motion.div
                key="open"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative w-full h-full"
              >
                <img src="/sona-avatar.png" alt="Chat with Sona" className="w-full h-full object-cover" />
                <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}
