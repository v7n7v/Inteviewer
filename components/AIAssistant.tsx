'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { groqCompletion } from '@/lib/ai/groq-client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI assistant powered by Groq GPT-OSS 120B ⚡. I can help you with interview prep, resume writing, job descriptions, and more. How can I assist you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if API key is available
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
    if (!apiKey || apiKey.includes('your_api_key')) {
      console.warn('⚠️ Groq API key not configured. Please set NEXT_PUBLIC_GROQ_API_KEY in .env.local and restart the dev server.');
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const systemPrompt = `You are TalentConsulting.io Assistant, an expert AI career advisor powered by Groq GPT-OSS 120B. You help users with:
- Interview preparation and practice answers
- Resume writing and optimization
- Job description analysis
- Career advice and guidance
- Technical interview questions
- Behavioral interview strategies

Be concise, helpful, and professional. Provide actionable advice. Keep responses under 150 words unless more detail is specifically requested.`;

      const conversationContext = messages
        .slice(-6) // Last 6 messages for context
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      const response = await groqCompletion(
        systemPrompt,
        `${conversationContext}\n\nUser: ${userMessage.content}\n\nAssistant:`,
        { temperature: 0.7, maxTokens: 512 }
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('AI Assistant error:', error);
      const errorDetails = error?.message || 'Unknown error occurred';
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I'm sorry, I encountered an error: ${errorDetails}. Please check your API key configuration or try again later.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = [
    "Help me prepare for a technical interview",
    "Review my resume summary",
    "How to answer 'Tell me about yourself'",
    "Tips for salary negotiation",
  ];

  return (
    <div className="fixed bottom-0 right-0 z-[9999] pointer-events-none">
      <div className="relative">
        {/* Chat Window */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-[76px] right-6 w-[360px] h-[480px] pointer-events-auto"
              style={{
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
              }}
            >
              <div className="glass-card h-full flex flex-col bg-black/70 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/40">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white">AI Assistant</h3>
                      <p className="text-[10px] text-slate-400">Powered by Groq ⚡</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                        className={`max-w-[85%] rounded-xl px-3 py-2 ${message.role === 'user'
                            ? 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white'
                            : 'bg-white/10 text-slate-200'
                          }`}
                      >
                        <p className="text-xs whitespace-pre-wrap">{message.content}</p>
                        <p className="text-[10px] mt-1 opacity-60">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}

                  {isLoading && (
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
                    <p className="text-[10px] text-slate-400 mb-1.5">Quick prompts:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {quickPrompts.map((prompt, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setInput(prompt);
                            inputRef.current?.focus();
                          }}
                          className="text-[10px] px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 hover:border-cyan-500/30 transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="p-3 border-t border-white/10 bg-black/40">
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask me anything..."
                      disabled={isLoading}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500/50 transition-colors disabled:opacity-50"
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
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-lg hover:shadow-2xl transition-all flex items-center justify-center pointer-events-auto"
          style={{
            boxShadow: '0 0 40px rgba(0, 245, 255, 0.3)',
          }}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.svg
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </motion.svg>
            ) : (
              <motion.div
                key="open"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                {/* Notification dot */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-blue-500 animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}
