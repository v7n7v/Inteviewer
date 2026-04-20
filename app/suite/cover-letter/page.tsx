'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import PageHelp from '@/components/PageHelp';

function CopyButton({ text, label = 'Copy', className: cn }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Copied!', 'content_copy');
    setTimeout(() => setCopied(false), 1500);
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className={cn || `flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
        copied ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20'
      }`}
    >
      <span className="material-symbols-rounded text-[14px]">{copied ? 'check' : 'content_copy'}</span>
      {copied ? 'Copied!' : label}
    </button>
  );
}

interface CoverLetterResult {
  coverLetter: string;
  subject: string;
  keyHighlights: string[];
  wordCount: number;
  toneScore: number;
}

const TONES = [
  { id: 'conversational', icon: 'chat', label: 'Conversational', desc: 'Warm & natural' },
  { id: 'professional', icon: 'business_center', label: 'Professional', desc: 'Formal & polished' },
  { id: 'confident', icon: 'bolt', label: 'Confident', desc: 'Bold & assertive' },
  { id: 'storytelling', icon: 'auto_stories', label: 'Storytelling', desc: 'Personal anecdote' },
];

const TEMPLATES = [
  { id: 'classic', icon: 'article', label: 'Classic', desc: '3 paragraphs' },
  { id: 'modern', icon: 'view_list', label: 'Modern', desc: 'Bullet-point style' },
  { id: 'impact', icon: 'trending_up', label: 'Impact-Led', desc: 'Lead with achievements' },
  { id: 'pain_point', icon: 'psychology', label: 'Pain Point', desc: 'Solve their problem' },
];

export default function CoverLetterPage() {
  const { user } = useStore();
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [tone, setTone] = useState('conversational');
  const [template, setTemplate] = useState('classic');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoverLetterResult | null>(null);

  const handleGenerate = async () => {
    if (!company || !jobTitle) {
      showToast('Company and job title are required', 'warning');
      return;
    }
    setLoading(true);
    try {
      const token = (user as any)?.accessToken || (user as any)?.stsTokenManager?.accessToken;
      const res = await fetch('/api/agent/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ company, jobTitle, jobDescription, tone, template }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        showToast('Cover letter generated!', 'edit_document');
      } else {
        showToast(data.error || 'Failed', 'cancel');
      }
    } catch {
      showToast('Something went wrong', 'cancel');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <span className="material-symbols-rounded text-white text-2xl">edit_document</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Cover Letter Studio</h1>
              <p className="text-sm text-[var(--text-tertiary)]">AI-crafted cover letters from your resume</p>
            </div>
          </div>
          <PageHelp toolId="cover-letter" />
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="rounded-2xl p-5 space-y-4" style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          }}>
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="material-symbols-rounded text-rose-500 text-lg">work</span>
              Target Position
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-tertiary)] block mb-1">Company *</label>
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Stripe"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-rose-500/50" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-tertiary)] block mb-1">Job Title *</label>
                <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Senior PM"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-rose-500/50" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--text-tertiary)] block mb-1">Job Description <span className="opacity-50">(optional but recommended)</span></label>
              <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)}
                placeholder="Paste the job description here for the best results..."
                rows={5}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-rose-500/50 resize-none" />
            </div>
          </div>

          {/* Tone Picker */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <h4 className="text-xs font-bold text-[var(--text-primary)] mb-2.5 flex items-center gap-1.5">
              <span className="material-symbols-rounded text-[14px] text-rose-500">tune</span> Tone
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map(t => (
                <button key={t.id} onClick={() => setTone(t.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-left transition-all ${
                    tone === t.id ? 'border-2 border-rose-500/40' : 'border border-[var(--border-subtle)]'
                  }`}
                  style={{ background: tone === t.id ? 'rgba(244,63,94,0.06)' : 'var(--bg-elevated)' }}
                >
                  <span className={`material-symbols-rounded text-lg ${tone === t.id ? 'text-rose-500' : 'text-[var(--text-tertiary)]'}`}>{t.icon}</span>
                  <div>
                    <p className={`text-[11px] font-bold ${tone === t.id ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>{t.label}</p>
                    <p className="text-[9px] text-[var(--text-tertiary)]">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Template Picker */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <h4 className="text-xs font-bold text-[var(--text-primary)] mb-2.5 flex items-center gap-1.5">
              <span className="material-symbols-rounded text-[14px] text-rose-500">dashboard</span> Template
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTemplate(t.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-left transition-all ${
                    template === t.id ? 'border-2 border-rose-500/40' : 'border border-[var(--border-subtle)]'
                  }`}
                  style={{ background: template === t.id ? 'rgba(244,63,94,0.06)' : 'var(--bg-elevated)' }}
                >
                  <span className={`material-symbols-rounded text-lg ${template === t.id ? 'text-rose-500' : 'text-[var(--text-tertiary)]'}`}>{t.icon}</span>
                  <div>
                    <p className={`text-[11px] font-bold ${template === t.id ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>{t.label}</p>
                    <p className="text-[9px] text-[var(--text-tertiary)]">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.005 }}
            whileTap={{ scale: 0.995 }}
            onClick={handleGenerate}
            disabled={loading || !company || !jobTitle}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-white disabled:opacity-40 relative overflow-hidden group"
            style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', boxShadow: '0 4px 20px rgba(244,63,94,0.2)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <span className="material-symbols-rounded text-lg">auto_fix_high</span>}
            {loading ? 'Writing...' : 'Generate Cover Letter'}
          </motion.button>
        </motion.div>

        {/* Results Panel */}
        <div>
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full flex items-center justify-center min-h-[500px] rounded-2xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                    <span className="material-symbols-rounded text-3xl text-rose-500">draw</span>
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Your Cover Letter</h3>
                  <p className="text-sm text-[var(--text-tertiary)] max-w-xs">Choose your tone and template, then generate. We'll pull from your resume automatically.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {/* Meta bar */}
                <div className="rounded-2xl p-4 flex items-center justify-between" style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                }}>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-lg font-black text-[var(--text-primary)]">{result.wordCount}</p>
                      <p className="text-[9px] text-[var(--text-tertiary)]">words</p>
                    </div>
                    <div className="w-px h-8" style={{ background: 'var(--border-subtle)' }} />
                    <div className="text-center">
                      <p className="text-lg font-black text-rose-500">{result.toneScore}</p>
                      <p className="text-[9px] text-[var(--text-tertiary)]">tone score</p>
                    </div>
                  </div>
                  <CopyButton text={result.coverLetter} label="Copy All" />
                </div>

                {/* Subject line */}
                <div className="rounded-xl p-3 flex items-center justify-between" style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                }}>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-tertiary)] mb-0.5">EMAIL SUBJECT</p>
                    <p className="text-sm text-[var(--text-primary)]">{result.subject}</p>
                  </div>
                  <CopyButton text={result.subject} label="" className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-rose-500 hover:bg-rose-500/10 transition-all" />
                </div>

                {/* Cover Letter */}
                <div className="rounded-2xl p-5" style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                }}>
                  <div className="prose prose-sm max-w-none text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap text-sm">
                    {result.coverLetter}
                  </div>
                </div>

                {/* Key Highlights */}
                {result.keyHighlights.length > 0 && (
                  <div className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <h4 className="text-[10px] font-bold text-rose-500 mb-2 flex items-center gap-1">
                      <span className="material-symbols-rounded text-[14px]">star</span> KEY HIGHLIGHTS USED
                    </h4>
                    <div className="space-y-1.5">
                      {result.keyHighlights.map((h, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                          <span className="material-symbols-rounded text-[14px] text-rose-400 mt-0.5 shrink-0">check_circle</span>
                          {h}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Regenerate */}
                <button onClick={handleGenerate} disabled={loading}
                  className="w-full py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 text-[var(--text-secondary)] border transition-all hover:border-rose-500/30"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
                >
                  <span className="material-symbols-rounded text-[14px]">refresh</span> Regenerate with same settings
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
