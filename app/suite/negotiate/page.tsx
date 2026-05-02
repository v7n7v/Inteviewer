'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import PageHelp from '@/components/PageHelp';

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
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
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
        copied
          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
      }`}
    >
      <span className="material-symbols-rounded text-[14px]">{copied ? 'check' : 'content_copy'}</span>
      {copied ? 'Copied!' : label}
    </button>
  );
}

interface NegotiationResult {
  marketRange: { low: number; mid: number; high: number };
  verdict: 'below_market' | 'at_market' | 'above_market';
  verdictMessage: string;
  counterStrategy: string;
  emailScript: string;
  phoneScript: string;
  batna: string;
  leveragePoints: string[];
  nonSalaryAsks: string[];
  redFlags: string[];
}

export default function NegotiationPage() {
  const { user } = useStore();
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [offerBase, setOfferBase] = useState('');
  const [offerTotal, setOfferTotal] = useState('');
  const [desiredBase, setDesiredBase] = useState('');
  const [hasCompeting, setHasCompeting] = useState(false);
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NegotiationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'email' | 'phone' | 'strategy'>('strategy');

  const handleAnalyze = async () => {
    if (!company || !role || !offerBase) {
      showToast('Fill in company, role, and offer base.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const token = (user as any)?.accessToken || (user as any)?.stsTokenManager?.accessToken;
      const res = await fetch('/api/agent/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          company,
          role,
          offerBase: parseInt(offerBase),
          offerTotal: offerTotal ? parseInt(offerTotal) : undefined,
          desiredBase: desiredBase ? parseInt(desiredBase) : undefined,
          hasCompetingOffer: hasCompeting,
          context,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        showToast('Strategy generated!', 'psychology');
      } else {
        showToast(data.error || 'Failed to analyze', 'cancel');
      }
    } catch {
      showToast('Something went wrong', 'cancel');
    }
    setLoading(false);
  };

  const verdictConfig = {
    below_market: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'trending_down', label: 'Below Market' },
    at_market: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'trending_flat', label: 'At Market' },
    above_market: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: 'trending_up', label: 'Above Market' },
  };

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="material-symbols-rounded text-white text-2xl">payments</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Salary Negotiation Coach</h1>
              <p className="text-sm text-[var(--text-tertiary)]">Get counter-offer scripts backed by market data</p>
            </div>
          </div>
          <PageHelp toolId="negotiate" />
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Input Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 space-y-4"
        >
          <div className="rounded-2xl p-5 space-y-4" style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}>
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="material-symbols-rounded text-emerald-500 text-lg">edit_note</span>
              Offer Details
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-tertiary)] block mb-1">Company *</label>
                <input
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="e.g. Google, Meta, Stripe..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--text-tertiary)] block mb-1">Role *</label>
                <input
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-tertiary)] block mb-1">Base Offer ($k) *</label>
                  <input
                    type="number"
                    value={offerBase}
                    onChange={e => setOfferBase(e.target.value)}
                    placeholder="120"
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-tertiary)] block mb-1">Total Comp ($k)</label>
                  <input
                    type="number"
                    value={offerTotal}
                    onChange={e => setOfferTotal(e.target.value)}
                    placeholder="180"
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--text-tertiary)] block mb-1">I'd like to make ($k)</label>
                <input
                  type="number"
                  value={desiredBase}
                  onChange={e => setDesiredBase(e.target.value)}
                  placeholder="140"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl" style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">Competing Offer?</p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">Having another offer is your strongest leverage</p>
                </div>
                <button
                  onClick={() => setHasCompeting(!hasCompeting)}
                  className="relative w-11 h-6 rounded-full transition-all"
                  style={{
                    background: hasCompeting ? 'linear-gradient(135deg, #10b981, #06b6d4)' : 'var(--border-subtle)',
                  }}
                >
                  <motion.div
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                    animate={{ left: hasCompeting ? 24 : 4 }}
                    transition={{ type: 'spring', bounce: 0.25, duration: 0.35 }}
                  />
                </button>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--text-tertiary)] block mb-1">Additional Context</label>
                <textarea
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  placeholder="e.g. They seem eager, the hiring manager mentioned fast-tracking..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-emerald-500/50 resize-none"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.995 }}
              onClick={handleAnalyze}
              disabled={loading || !company || !role || !offerBase}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-white disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                boxShadow: '0 4px 20px rgba(16,185,129,0.2)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-rounded text-lg">psychology</span>
              )}
              {loading ? 'Analyzing...' : 'Generate Strategy'}
            </motion.button>
          </div>
        </motion.div>

        {/* Results Panel */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex items-center justify-center min-h-[400px] rounded-2xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <span className="material-symbols-rounded text-3xl text-emerald-500">handshake</span>
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Enter Your Offer</h3>
                  <p className="text-sm text-[var(--text-tertiary)] max-w-xs">Fill in the details and get a custom negotiation strategy with email and phone scripts.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Verdict Banner */}
                <div className={`rounded-2xl p-4 ${verdictConfig[result.verdict].bg} ${verdictConfig[result.verdict].border} border`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`material-symbols-rounded text-2xl ${verdictConfig[result.verdict].color}`}>
                      {verdictConfig[result.verdict].icon}
                    </span>
                    <div>
                      <span className={`text-sm font-bold ${verdictConfig[result.verdict].color}`}>{verdictConfig[result.verdict].label}</span>
                      <p className="text-xs text-[var(--text-secondary)]">{result.verdictMessage}</p>
                    </div>
                  </div>

                  {/* Market Range Bar */}
                  <div className="mt-3 px-2">
                    <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <div
                        className="absolute inset-y-0 rounded-full bg-gradient-to-r from-red-500 via-emerald-500 to-cyan-500 opacity-60"
                        style={{ left: '0%', width: '100%' }}
                      />
                      {/* Your offer marker */}
                      <motion.div
                        initial={{ left: '0%' }}
                        animate={{ left: `${Math.min(((parseInt(offerBase) - result.marketRange.low) / (result.marketRange.high - result.marketRange.low)) * 100, 100)}%` }}
                        className="absolute top-[-2px] w-4 h-4 rounded-full bg-white border-2 border-emerald-500 shadow-lg"
                        style={{ transform: 'translateX(-50%)' }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-[var(--text-tertiary)]">
                      <span>${result.marketRange.low}k</span>
                      <span className="font-semibold text-emerald-500">${result.marketRange.mid}k median</span>
                      <span>${result.marketRange.high}k</span>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  {[
                    { key: 'strategy' as const, icon: 'lightbulb', label: 'Strategy' },
                    { key: 'email' as const, icon: 'mail', label: 'Email Script' },
                    { key: 'phone' as const, icon: 'phone_in_talk', label: 'Phone Script' },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        activeTab === t.key
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span className="material-symbols-rounded text-[14px]">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <AnimatePresence mode="wait">
                    {activeTab === 'strategy' && (
                      <motion.div key="strat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{result.counterStrategy}</p>

                        {result.leveragePoints.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-emerald-500 mb-2 flex items-center gap-1">
                              <span className="material-symbols-rounded text-[14px]">bolt</span> Your Leverage Points
                            </h4>
                            <div className="space-y-1.5">
                              {result.leveragePoints.map((p, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                                  <span className="material-symbols-rounded text-[14px] text-emerald-500 mt-0.5 shrink-0">arrow_right</span>
                                  {p}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.nonSalaryAsks.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-cyan-500 mb-2 flex items-center gap-1">
                              <span className="material-symbols-rounded text-[14px]">add_circle</span> Non-Salary Asks
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                              {result.nonSalaryAsks.map((a, i) => (
                                <span key={i} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">{a}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.redFlags.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-red-400 mb-2 flex items-center gap-1">
                              <span className="material-symbols-rounded text-[14px]">flag</span> Red Flags
                            </h4>
                            <div className="space-y-1.5">
                              {result.redFlags.map((f, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-red-300/80">
                                  <span className="material-symbols-rounded text-[14px] text-red-400 mt-0.5 shrink-0">warning</span>
                                  {f}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                          <h4 className="text-xs font-bold text-amber-400 mb-1 flex items-center gap-1">
                            <span className="material-symbols-rounded text-[14px]">shield</span> BATNA (Your Backup Plan)
                          </h4>
                          <p className="text-xs text-[var(--text-secondary)]">{result.batna}</p>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'email' && (
                      <motion.div key="email" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold text-[var(--text-primary)]">Counter-Offer Email</h4>
                          <CopyButton text={result.emailScript} />
                        </div>
                        <div className="p-4 rounded-xl text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap" style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                        }}>
                          {result.emailScript}
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'phone' && (
                      <motion.div key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold text-[var(--text-primary)]">Phone Talking Points</h4>
                          <CopyButton text={result.phoneScript} />
                        </div>
                        <div className="p-4 rounded-xl text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap" style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                        }}>
                          {result.phoneScript}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
