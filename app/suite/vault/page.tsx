'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/lib/auth-fetch';
import { showToast } from '@/components/Toast';

interface VaultNote {
  id: string;
  type: 'flashcards' | 'interview';
  topic: string;
  summary: string;
  createdAt: string;
}

export default function StudyVaultPage() {
  const [notes, setNotes] = useState<VaultNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeNote, setActiveNote] = useState<VaultNote | null>(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/vault/list');
      if (!res.ok) throw new Error('Failed to fetch notes');
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (error) {
      console.error(error);
      showToast('Could not load your Study Vault', '❌');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMarkdown = (text: string) => {
    let html = text
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-white mt-5 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-cyan-400 mt-6 mb-3 border-b border-white/10 pb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-black text-white mt-6 mb-4">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="text-emerald-400 font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em class="text-slate-300 italic">$1</em>')
      .replace(/^\s*-\s+(.*$)/gim, '<li class="ml-5 list-disc text-slate-300 mb-1.5 marker:text-cyan-500 pl-1">$1</li>')
      .replace(/\n\n/gim, '</p><p class="text-slate-300 leading-relaxed mb-4 mt-2">')
      .replace(/\n(?!\s*<)/gim, '<br/>'); // only line breaks that aren't html tags
      
    // Wrap the whole thing in a P tag for the \n\n replacement to work symmetrically
    html = `<p class="text-slate-300 leading-relaxed mb-4 mt-2">${html}</p>`;
    // Clean up empty paragraphs
    html = html.replace(/<p[^>]*>\s*<\/p>/g, '');
      
    return html;
  };

  return (
    <div className="min-h-screen p-4 md:p-8 relative">
      <div className="max-w-6xl mx-auto z-10 relative">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
            <span className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-400">📚</span>
            Study Vault
          </h1>
          <p className="text-slate-500 text-sm mt-2">Your personalized study guides generated from your Gauntlet sessions.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sidebar List */}
          <div className="lg:col-span-4 space-y-3">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-white/[0.03] animate-pulse border border-white/5" />
              ))
            ) : notes.length === 0 ? (
              <div className="p-8 rounded-2xl border border-white/10 bg-white/5 text-center">
                <div className="text-4xl mb-3 opacity-50">📭</div>
                <h3 className="text-white font-bold mb-1">Your vault is empty</h3>
                <p className="text-slate-500 text-sm">Complete a Gauntlet session to save AI study notes.</p>
              </div>
            ) : (
              notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => setActiveNote(note)}
                  className={`w-full text-left p-5 rounded-2xl transition-all border ${activeNote?.id === note.id ? 'bg-violet-500/[0.08] border-violet-500/30 shadow-[0_4px_20px_rgba(139,92,246,0.15)] ring-1 ring-violet-500/20' : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15]'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${note.type === 'flashcards' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'}`}>
                      {note.type === 'flashcards' ? '📝 Flashcards' : '🎤 Interview'}
                    </span>
                    <span className="text-xs text-slate-500 ml-auto whitespace-nowrap">
                      {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <h4 className="font-bold text-white text-sm leading-snug line-clamp-2">{note.topic || 'General Practice'}</h4>
                </button>
              ))
            )}
          </div>

          {/* Reader Panel */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {activeNote ? (
                <motion.div
                  key={activeNote.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-3xl bg-[var(--theme-bg-elevated)] border border-[var(--theme-border)] p-6 md:p-10 shadow-2xl relative overflow-hidden"
                >
                  {/* Decorative Header Bar */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-cyan-500" />
                  
                  <div className="mb-8 border-b border-white/10 pb-6">
                    <h2 className="text-2xl font-black text-white mb-2">{activeNote.topic}</h2>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-400">{new Date(activeNote.createdAt).toLocaleString()}</span>
                      <span className="text-white/20">•</span>
                      <span className="text-violet-400 font-medium">{activeNote.type === 'flashcards' ? 'Flashcard Mistakes Summarization' : 'Interview Feedback Notes'}</span>
                    </div>
                  </div>

                  <div 
                    className="prose prose-invert prose-cyan max-w-none 
                               prose-p:leading-relaxed prose-li:marker:text-cyan-500 prose-headings:text-white"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(activeNote.summary) }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hidden lg:flex min-h-[400px] rounded-3xl border border-dashed border-white/10 bg-white/[0.02] items-center justify-center flex-col text-center"
                >
                  <div className="w-20 h-20 rounded-2xl bg-white/[0.04] flex items-center justify-center text-4xl mb-4 border border-white/[0.08]">
                    📖
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Select a note</h3>
                  <p className="text-slate-500 max-w-sm">Click a study guide on the left to review your personalized coaching feedback.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
