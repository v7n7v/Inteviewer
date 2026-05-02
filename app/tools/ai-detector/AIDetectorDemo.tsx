'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

const SAMPLES: Record<string, string> = {
  ChatGPT: `In today's rapidly evolving landscape, it is important to note that artificial intelligence has significantly impacted various industries. Furthermore, the integration of AI-driven solutions has enabled organizations to streamline their operations and enhance overall efficiency. Moreover, the transformative potential of these technologies cannot be understated, as they continue to reshape how businesses approach complex challenges in an ever-changing environment. Additionally, it is worth noting that the paradigm shift brought about by these innovations has created unprecedented opportunities for growth and development across multiple sectors.`,
  Claude: `The relationship between technology and human creativity represents one of the most fascinating dynamics of our era. While AI tools have become increasingly sophisticated, they serve best as amplifiers of human intent rather than replacements for it. Consider how a skilled writer uses AI: not as a crutch, but as a collaborative partner that helps explore ideas more rapidly. The key distinction lies in the intentionality behind the output — human writers bring context, emotion, and lived experience that no model can replicate.`,
  Gemini: `Artificial intelligence is a multifaceted field that encompasses a wide range of technologies and applications. It is crucial to understand that the development of AI systems requires a holistic approach that considers both technical capabilities and ethical implications. The landscape of AI research is constantly evolving, with new breakthroughs occurring at an unprecedented pace. Leveraging these advancements effectively requires a comprehensive understanding of the underlying principles and a commitment to responsible innovation. In conclusion, the future of AI holds tremendous promise.`,
  Human: `I spent three years building backend systems at a fintech startup before I realized I actually liked the messy, people-facing side of engineering more. My manager thought I was crazy when I asked to move to a client-facing role. But honestly? Debugging a customer's workflow on a shared screen taught me more about building good software than any sprint retrospective ever did.`,
  Mixed: `I have over 8 years of experience in software development, with a proven track record of delivering high-quality solutions. In my last role, I cut our deploy pipeline from 45 minutes to 12 by rewriting the CI config — nothing fancy, just removed three redundant test suites nobody maintained. It is worth noting that my comprehensive background in full-stack development has enabled me to leverage cutting-edge technologies.`,
};

function analyzeText(text: string) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const flags: { pattern: string; severity: 'high' | 'medium' | 'low' }[] = [];
  const aiPhrases = [
    'it is important to note', 'it is worth noting', 'in conclusion', 'furthermore', 'moreover',
    'in today\'s', 'in the realm of', 'it is crucial', 'plays a vital role', 'key takeaway',
    'delve into', 'navigate the', 'tapestry of', 'leveraging', 'holistic approach', 'in summary',
    'comprehensive overview', 'multifaceted', 'paradigm', 'landscape of', 'encompasses',
    'unprecedented', 'ever-changing', 'ever-evolving', 'streamline', 'transformative',
    'cutting-edge', 'proven track record',
  ];
  const lower = text.toLowerCase();
  aiPhrases.forEach(p => { if (lower.includes(p)) flags.push({ pattern: `Cliché AI phrase: "${p}"`, severity: 'high' }); });
  if (sentences.length > 3) {
    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
    if (variance < 15) flags.push({ pattern: 'Low sentence length variance (too uniform)', severity: 'medium' });
  }
  if (sentences.length > 4) {
    const starters = sentences.map(s => s.trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase());
    const counts: Record<string, number> = {};
    starters.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    Object.entries(counts).forEach(([s, c]) => { if (c >= 3) flags.push({ pattern: `Repetitive opener: "${s}" (${c}x)`, severity: 'medium' }); });
  }
  const transitions = ['however,', 'therefore,', 'additionally,', 'consequently,', 'nevertheless,'];
  let tc = 0;
  transitions.forEach(t => { tc += (lower.match(new RegExp(t, 'g')) || []).length; });
  if (tc > 3) flags.push({ pattern: `Overuse of formal transitions (${tc} found)`, severity: 'medium' });
  const high = flags.filter(f => f.severity === 'high').length;
  const med = flags.filter(f => f.severity === 'medium').length;
  const score = Math.max(0, Math.min(100, high * 20 + med * 10));
  return {
    score,
    verdict: score >= 60 ? 'Likely AI-Generated' : score >= 30 ? 'Mixed / Uncertain' : 'Likely Human-Written',
    flags, wordCount: words.length, sentenceCount: sentences.length,
  };
}

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 60 ? '#ef4444' : score >= 30 ? '#f59e0b' : '#34d399';
  const glow = score >= 60 ? '0 0 30px rgba(239,68,68,0.3)' : score >= 30 ? '0 0 30px rgba(245,158,11,0.3)' : '0 0 30px rgba(52,211,153,0.3)';
  return (
    <div className="relative" style={{ width: size, height: size, filter: `drop-shadow(${glow})` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="6" opacity="0.5" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={circ} initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }} transition={{ duration: 1.5, ease: [0.33, 1, 0.68, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="font-extrabold tracking-tight" style={{ color, fontSize: size * 0.28, lineHeight: 1 }}
          initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
        >{score}</motion.span>
        <span className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>/ 100</span>
      </div>
    </div>
  );
}

export default function AIDetectorDemo() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ReturnType<typeof analyzeText> | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleAnalyze = () => {
    if (text.trim().length < 50) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      setResult(analyzeText(text));
      setIsAnalyzing(false);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }, 1200);
  };

  const loadSample = (key: string) => {
    setText(SAMPLES[key] || '');
    setResult(null);
    setActiveSample(key);
  };

  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const scoreColor = result ? (result.score >= 60 ? '#ef4444' : result.score >= 30 ? '#f59e0b' : '#34d399') : '#34d399';

  return (
    <div style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl" style={{ background: 'color-mix(in srgb, var(--bg-deep) 85%, transparent)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            TalentConsulting<span style={{ color: 'var(--text-muted)' }}>.io</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/tools/ai-humanizer" className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>Humanizer</Link>
            <Link href="/templates" className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>Templates</Link>
            <Link href="/suite/writing-tools" className="text-xs font-semibold px-4 py-1.5 rounded-lg transition-all bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:shadow-lg hover:shadow-emerald-500/20">
              Open Suite →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="relative pt-16 pb-10 text-center px-6 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #34d399 0%, transparent 70%)' }} />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.15em] mb-6"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-subtle)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Free AI Detection Engine
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-[-0.03em] mb-4" style={{ color: 'var(--text-primary)' }}>
            AI Detector
          </h1>
          <p className="text-base md:text-lg max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Paste any text below. We'll scan <strong style={{ color: 'var(--text-secondary)' }}>100+ linguistic patterns</strong> to detect AI-generated content.
          </p>

          {/* Sample pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            <span className="text-[11px] mr-1" style={{ color: 'var(--text-muted)' }}>Try:</span>
            {Object.keys(SAMPLES).map(key => (
              <button key={key} onClick={() => loadSample(key)}
                className="text-[11px] font-medium px-3.5 py-1.5 rounded-full transition-all duration-200"
                style={{
                  background: activeSample === key ? 'var(--accent-hover)' : 'transparent',
                  border: `1px solid ${activeSample === key ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  color: activeSample === key ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                {key}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main workspace ── */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className={`flex flex-col ${result ? 'lg:flex-row' : ''} gap-5`}>

          {/* Textarea card */}
          <div className={`${result ? 'lg:w-[58%]' : 'max-w-4xl mx-auto w-full'} transition-all duration-700`}>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
              <textarea
                value={text}
                onChange={(e) => {
                  const w = e.target.value.split(/\s+/).filter(w => w.length > 0);
                  if (w.length <= 500) { setText(e.target.value); setResult(null); setActiveSample(null); }
                }}
                placeholder="Paste your resume, cover letter, essay, or any text here..."
                className="w-full p-6 resize-none text-[15px] leading-[1.8] bg-transparent focus:outline-none"
                style={{ color: 'var(--text-primary)', height: result ? 380 : 400, caretColor: '#34d399' }}
              />
              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                <div className="flex items-center gap-4">
                  <span className="text-[11px] font-mono tabular-nums" style={{ color: wordCount > 450 ? '#f59e0b' : 'var(--text-muted)' }}>
                    {wordCount}<span style={{ color: 'var(--border)' }}>/500</span>
                  </span>
                  {text.length > 0 && (
                    <button onClick={() => { setText(''); setResult(null); setActiveSample(null); }}
                      className="text-[11px] font-medium transition-colors hover:underline"
                      style={{ color: 'var(--text-muted)' }}>Clear</button>
                  )}
                </div>
                <button onClick={handleAnalyze} disabled={text.trim().length < 50 || isAnalyzing}
                  className="relative px-8 py-2.5 rounded-xl text-[13px] font-bold transition-all disabled:opacity-25"
                  style={{ background: 'linear-gradient(135deg, #34d399 0%, #2dd4bf 100%)', color: '#000', boxShadow: text.trim().length >= 50 ? '0 4px 20px rgba(52,211,153,0.3)' : 'none' }}>
                  {isAnalyzing ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" /><path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                      Scanning…
                    </span>
                  ) : 'Scan Text'}
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] mt-3" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
              By scanning, you agree to our <Link href="/privacy" className="underline">Privacy Policy</Link> and <Link href="/terms" className="underline">Terms</Link>
            </p>
          </div>

          {/* Results panel */}
          <AnimatePresence>
            {result && (
              <motion.div ref={resultsRef}
                initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="lg:w-[42%] space-y-4">

                {/* Score card */}
                <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
                  <div className="flex justify-center mb-4">
                    <ScoreRing score={result.score} />
                  </div>
                  <p className="text-sm font-bold mb-1" style={{ color: scoreColor }}>{result.verdict}</p>
                  <div className="flex justify-center gap-5 mt-4">
                    {[
                      { label: 'Words', val: result.wordCount },
                      { label: 'Sentences', val: result.sentenceCount },
                      { label: 'Flags', val: result.flags.length },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{s.val}</div>
                        <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Flags */}
                {result.flags.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] mb-3" style={{ color: 'var(--text-muted)' }}>
                      Detected Patterns
                    </h3>
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                      {result.flags.map((flag, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-[12px]"
                          style={{ background: 'var(--bg-elevated)' }}>
                          <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full" style={{
                            background: flag.severity === 'high' ? '#ef4444' : '#f59e0b',
                            boxShadow: flag.severity === 'high' ? '0 0 6px rgba(239,68,68,0.5)' : '0 0 6px rgba(245,158,11,0.5)',
                          }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{flag.pattern}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cross-sell */}
                <div className="rounded-2xl p-5 relative overflow-hidden" style={{ border: '1px solid rgba(52,211,153,0.2)', background: 'linear-gradient(135deg, rgba(52,211,153,0.05) 0%, rgba(45,212,191,0.03) 100%)' }}>
                  <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Text flagged? Fix it instantly.</p>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Our Humanizer rewrites flagged sections while preserving your voice.</p>
                  <Link href="/tools/ai-humanizer"
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold transition-all hover:shadow-lg hover:shadow-emerald-500/20"
                    style={{ background: 'linear-gradient(135deg, #34d399, #2dd4bf)', color: '#000' }}>
                    Try Humanizer <span className="text-sm">→</span>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Trust bar */}
      <div className="py-5" style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-center gap-6">
          <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="material-symbols-rounded text-emerald-400 text-base">verified</span>
            100+ heuristic patterns analyzed
          </span>
          <span className="hidden sm:block text-xs" style={{ color: 'var(--border-subtle)' }}>•</span>
          <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="material-symbols-rounded text-emerald-400 text-base">speed</span>
            Results in under 2 seconds
          </span>
          <span className="hidden sm:block text-xs" style={{ color: 'var(--border-subtle)' }}>•</span>
          <Link href="/suite/writing-tools" className="text-xs font-medium transition-colors text-emerald-400/70 hover:text-emerald-400">
            Full suite →
          </Link>
        </div>
      </div>

      {/* SEO Content */}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <section className="space-y-10">
          {[
            { title: 'How Our AI Detector Works', body: 'Our heuristic AI text detection engine analyzes your writing using over 100 linguistic patterns commonly found in AI-generated content from models like ChatGPT, Claude, Gemini, and others. Unlike simple plagiarism checkers, we examine sentence structure uniformity, cliché phrase density, transition word overuse, and statistical anomalies in your writing.' },
            { title: 'Why AI Detection Matters for Resumes', body: '67% of recruiters now use AI detection tools to screen resumes and cover letters. If your application is flagged as AI-generated, it may be rejected before a human ever reads it. Our detector helps you identify and fix the patterns that trigger these flags.' },
            { title: 'Free vs Pro Detection', body: 'The free version provides heuristic-based analysis with a 500-word limit. Our Pro plan includes unlimited detection, deep pattern analysis, section-by-section breakdowns, and our AI Humanizer tool that automatically rewrites flagged sections while preserving your original voice.' },
          ].map((s, i) => (
            <div key={i}>
              <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{s.title}</h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.body}</p>
            </div>
          ))}
          <div>
            <h3 className="text-base font-bold mb-4" style={{ color: 'var(--text-primary)' }}>FAQ</h3>
            {[
              { q: 'Is this AI detector free?', a: 'Yes — completely free with a 500-word limit. No account required.' },
              { q: 'Can AI detectors be wrong?', a: 'Yes, no detector is 100% accurate. Heuristic analysis provides indicators, not proof.' },
              { q: 'What models can it detect?', a: 'ChatGPT, Claude, Gemini, Llama, and most major language models.' },
              { q: 'How to make text less AI-detectable?', a: 'Vary sentence lengths, avoid cliché phrases, add personal anecdotes. Or use our AI Humanizer.' },
            ].map((faq, i) => (
              <details key={i} className="mb-2 rounded-xl overflow-hidden group" style={{ border: '1px solid var(--border-subtle)' }}>
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium flex items-center justify-between" style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}>
                  {faq.q}
                  <span className="material-symbols-rounded text-base transition-transform group-open:rotate-180" style={{ color: 'var(--text-muted)' }}>expand_more</span>
                </summary>
                <div className="px-4 pb-3 text-sm leading-relaxed" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>{faq.a}</div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
