'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { getJobApplications, getResumeVersions, getUserProfile } from '@/lib/database-suite';
import { authFetch } from '@/lib/auth-fetch';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIAssistant() {
  const { user } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI career companion. I know about your applications, resumes, and interview prep. Ask me anything.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
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

      if (profileResult.status === 'fulfilled' && profileResult.value.success && profileResult.value.data) {
        const p = profileResult.value.data;
        parts.push(`## User Profile\n- Name: ${p.full_name || 'Unknown'}\n- Email: ${p.email || 'Unknown'}\n- Skills: ${p.skills?.join(', ') || 'Not specified'}`);
      }

      if (appsResult.status === 'fulfilled' && appsResult.value.success && appsResult.value.data) {
        const apps = appsResult.value.data;
        const statusCount: Record<string, number> = {};
        const appLines = apps.slice(0, 15).map(a => {
          statusCount[a.status] = (statusCount[a.status] || 0) + 1;
          return `  - ${a.company_name} — ${a.job_title || 'Unknown'} [${a.status}]${a.notes ? ` | Notes: ${a.notes.substring(0, 80)}` : ''} | Added: ${new Date(a.created_at).toLocaleDateString()}`;
        });
        parts.push(`## Job Applications (${apps.length} total)\nStatus: ${Object.entries(statusCount).map(([k, v]) => `${k}: ${v}`).join(', ')}\n${appLines.join('\n')}`);
      }

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);
  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);

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

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);

    try {
      const conversationHistory = messages
        .filter(m => m.id !== '1')
        .slice(-8)
        .map(m => ({ role: m.role, content: m.content }));

      conversationHistory.push({ role: 'user', content: userMessage.content });

      const userContext = await buildUserContext();

      const response = await authFetch('/api/chat', {
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
        {/* Chat Window */}
        {isOpen && (
          <div className="fixed sm:absolute inset-0 sm:inset-auto sm:bottom-[68px] sm:right-6 w-full sm:w-[400px] h-full sm:h-[520px] pointer-events-auto">
            <div className="h-full flex flex-col rounded-none sm:rounded-xl border border-[#2d2d2f] bg-[#131314] shadow-2xl shadow-black/50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 h-12 border-b border-[#2d2d2f] bg-[#131314]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#81c995]" />
                  <span className="text-sm font-medium text-[#e3e3e3]">AI Assistant</span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-md hover:bg-[#1f1f21] text-[#8e918f] hover:text-[#e3e3e3] transition-colors duration-100"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 ${message.role === 'user'
                        ? 'bg-[rgba(168,199,250,0.15)] text-[#e3e3e3]'
                        : 'bg-[#1a1a1b] text-[#e3e3e3]'
                      }`}
                    >
                      <p className="text-xs whitespace-pre-wrap leading-relaxed">{message.content || '...'}</p>
                      <p className="text-[10px] mt-1 text-[#5f6368]">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}

                {isLoading && !isStreaming && (
                  <div className="flex justify-start">
                    <div className="bg-[#1a1a1b] rounded-lg px-3 py-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#a8c7fa] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#a8c7fa] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#a8c7fa] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts */}
              {messages.length === 1 && !isLoading && (
                <div className="px-3 pb-2">
                  <div className="flex flex-wrap gap-1.5">
                    {quickPrompts.map((prompt, index) => (
                      <button
                        key={index}
                        onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                        className="text-[10px] px-2.5 py-1.5 rounded-full bg-transparent text-[#8e918f] border border-[#2d2d2f] hover:border-[#444746] hover:text-[#e3e3e3] transition-colors duration-100"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="px-3 py-3 border-t border-[#2d2d2f]">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about your applications, interviews..."
                    disabled={isLoading}
                    className="flex-1 rounded-lg px-3 py-2 text-xs outline-none bg-[#1e1e1f] border border-[#2d2d2f] text-[#e3e3e3] placeholder-[#5f6368] focus:border-[#a8c7fa] disabled:opacity-50 transition-colors duration-100"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="px-3 py-2 rounded-lg bg-[#a8c7fa] text-[#0b0b0b] hover:bg-[#c2e7ff] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-100"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toggle Button — flat, minimal */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 w-10 h-10 rounded-full bg-[#131314] border border-[#444746] flex items-center justify-center pointer-events-auto hover:bg-[#1f1f21] hover:border-[#a8c7fa] transition-colors duration-100 shadow-lg shadow-black/40"
        >
          {isOpen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e3e3e3" strokeWidth="1.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8e918f" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
