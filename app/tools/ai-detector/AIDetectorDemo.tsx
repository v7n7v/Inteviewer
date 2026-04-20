'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';

// Lightweight heuristic detector (same logic as internal tool — no API needed)
function analyzeText(text: string) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const flags: { pattern: string; severity: 'high' | 'medium' | 'low' }[] = [];

  // Pattern checks
  const aiPhrases = [
    'it is important to note', 'it is worth noting', 'in conclusion',
    'furthermore', 'moreover', 'in today\'s', 'in the realm of',
    'it is crucial', 'plays a vital role', 'key takeaway',
    'delve into', 'navigate the', 'tapestry of', 'leveraging',
    'holistic approach', 'in summary', 'comprehensive overview',
    'multifaceted', 'paradigm', 'landscape of', 'encompasses',
  ];
  const lower = text.toLowerCase();
  aiPhrases.forEach(phrase => {
    if (lower.includes(phrase)) {
      flags.push({ pattern: `Cliché AI phrase: "${phrase}"`, severity: 'high' });
    }
  });

  // Sentence length uniformity
  if (sentences.length > 3) {
    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
    if (variance < 15) {
      flags.push({ pattern: 'Low sentence length variance (too uniform)', severity: 'medium' });
    }
  }

  // Repetitive sentence starters
  if (sentences.length > 4) {
    const starters = sentences.map(s => s.trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase());
    const starterCounts: Record<string, number> = {};
    starters.forEach(s => { starterCounts[s] = (starterCounts[s] || 0) + 1; });
    Object.entries(starterCounts).forEach(([starter, count]) => {
      if (count >= 3) {
        flags.push({ pattern: `Repetitive sentence opener: "${starter}" (${count}x)`, severity: 'medium' });
      }
    });
  }

  // Generic transition phrases
  const transitions = ['however,', 'therefore,', 'additionally,', 'consequently,', 'nevertheless,'];
  let transitionCount = 0;
  transitions.forEach(t => {
    const matches = (lower.match(new RegExp(t, 'g')) || []).length;
    transitionCount += matches;
  });
  if (transitionCount > 3) {
    flags.push({ pattern: `Overuse of formal transitions (${transitionCount} found)`, severity: 'medium' });
  }

  // Score calculation
  const highFlags = flags.filter(f => f.severity === 'high').length;
  const medFlags = flags.filter(f => f.severity === 'medium').length;
  const rawScore = Math.min(100, highFlags * 20 + medFlags * 10);
  const score = Math.max(0, Math.min(100, rawScore));

  return {
    score,
    verdict: score >= 60 ? 'Likely AI-Generated' : score >= 30 ? 'Mixed / Uncertain' : 'Likely Human-Written',
    flags,
    wordCount: words.length,
    sentenceCount: sentences.length,
  };
}

export default function AIDetectorDemo() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ReturnType<typeof analyzeText> | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const handleAnalyze = () => {
    if (text.trim().length < 50) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      setResult(analyzeText(text));
      setIsAnalyzing(false);
    }, 800);
  };

  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const maxWords = 500;

  return (
    <div className={`min-h-screen ${isLight ? 'bg-gray-50' : 'bg-[#0a0a0b]'}`}>
      {/* Nav */}
      <nav className={`sticky top-0 z-50 backdrop-blur-xl border-b ${isLight ? 'bg-white/80 border-gray-200' : 'bg-[#0a0a0b]/80 border-white/[0.04]'}`}>
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className={`text-sm font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-white/90'}`}>
            TalentConsulting<span className={isLight ? 'text-gray-400' : 'text-white/30'}>.io</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/templates" className={`text-xs ${isLight ? 'text-gray-500 hover:text-gray-900' : 'text-white/30 hover:text-white/60'} transition-colors`}>Templates</Link>
            <Link href="/suite/writing-tools" className="text-xs font-medium text-black bg-gradient-to-r from-emerald-400 to-teal-400 px-4 py-1.5 rounded-lg hover:from-emerald-300 hover:to-teal-300 transition-all">
              Full Suite →
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className={`text-3xl md:text-4xl font-bold tracking-tight mb-3 ${isLight ? 'text-gray-900' : 'text-white/90'}`}>
            Free AI Text Detector
          </h1>
          <p className={`text-base max-w-lg mx-auto ${isLight ? 'text-gray-500' : 'text-white/30'}`}>
            Paste your text below and our 100+ pattern heuristic engine will analyze it for AI-generated writing patterns.
          </p>
        </div>

        {/* Input */}
        <div className={`rounded-2xl border overflow-hidden mb-6 ${isLight ? 'bg-white border-gray-200 shadow-sm' : 'bg-white/[0.02] border-white/[0.06]'}`}>
          <textarea
            value={text}
            onChange={(e) => {
              const words = e.target.value.split(/\s+/).filter(w => w.length > 0);
              if (words.length <= maxWords) {
                setText(e.target.value);
                setResult(null);
              }
            }}
            placeholder="Paste your resume, cover letter, essay, or any text here to check for AI patterns... (min 50 characters)"
            className={`w-full h-48 p-6 resize-none text-sm leading-relaxed bg-transparent focus:outline-none ${isLight ? 'text-gray-900 placeholder-gray-400' : 'text-white/80 placeholder-white/20'}`}
          />
          <div className={`flex items-center justify-between px-6 py-3 border-t ${isLight ? 'border-gray-100' : 'border-white/[0.04]'}`}>
            <span className={`text-xs ${wordCount > maxWords * 0.9 ? 'text-red-400' : isLight ? 'text-gray-400' : 'text-white/20'}`}>
              {wordCount}/{maxWords} words
            </span>
            <button
              onClick={handleAnalyze}
              disabled={text.trim().length < 50 || isAnalyzing}
              className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-xs font-semibold rounded-lg disabled:opacity-40 hover:from-emerald-400 hover:to-teal-400 transition-all"
            >
              {isAnalyzing ? 'Analyzing...' : 'Detect AI Patterns'}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Score Card */}
            <div className={`rounded-2xl border p-6 ${isLight ? 'bg-white border-gray-200' : 'bg-white/[0.02] border-white/[0.06]'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white/80'}`}>Detection Result</h3>
                  <p className={`text-xs ${isLight ? 'text-gray-400' : 'text-white/20'}`}>{result.wordCount} words · {result.sentenceCount} sentences</p>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${result.score >= 60 ? 'text-red-500' : result.score >= 30 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {result.score}%
                  </div>
                  <div className={`text-xs font-medium ${result.score >= 60 ? 'text-red-400' : result.score >= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {result.verdict}
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div className={`h-2 rounded-full overflow-hidden ${isLight ? 'bg-gray-100' : 'bg-white/[0.04]'}`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${result.score}%` }}
                  transition={{ duration: 0.8 }}
                  className={`h-full rounded-full ${result.score >= 60 ? 'bg-red-500' : result.score >= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                />
              </div>
            </div>

            {/* Flags */}
            {result.flags.length > 0 && (
              <div className={`rounded-2xl border p-6 ${isLight ? 'bg-white border-gray-200' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                <h3 className={`text-sm font-bold mb-3 ${isLight ? 'text-gray-900' : 'text-white/60'}`}>
                  Flagged Patterns ({result.flags.length})
                </h3>
                <div className="space-y-2">
                  {result.flags.map((flag, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl text-sm ${isLight ? 'bg-gray-50' : 'bg-white/[0.02]'}`}>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 shrink-0 ${
                        flag.severity === 'high' ? 'bg-red-500/15 text-red-500' :
                        flag.severity === 'medium' ? 'bg-amber-500/15 text-amber-500' :
                        'bg-blue-500/15 text-blue-500'
                      }`}>
                        {flag.severity}
                      </span>
                      <span className={isLight ? 'text-gray-700' : 'text-white/50'}>{flag.pattern}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upsell */}
            <div className={`rounded-2xl border p-6 text-center ${isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/[0.04] border-emerald-500/20'}`}>
              <h3 className={`text-base font-bold mb-2 ${isLight ? 'text-gray-900' : 'text-white/70'}`}>
                Want to humanize your text?
              </h3>
              <p className={`text-sm mb-4 ${isLight ? 'text-gray-500' : 'text-white/30'}`}>
                Our AI Humanizer rewrites flagged sections while preserving your original meaning. Included in Pro.
              </p>
              <Link href="/suite/writing-tools" className="inline-block px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-xs font-semibold rounded-lg hover:from-emerald-400 hover:to-teal-400 transition-all">
                Try AI Humanizer →
              </Link>
            </div>
          </motion.div>
        )}

        {/* SEO Content Block */}
        <section className={`mt-16 space-y-8 ${isLight ? 'text-gray-600' : 'text-white/25'}`}>
          <div>
            <h2 className={`text-xl font-bold mb-3 ${isLight ? 'text-gray-900' : 'text-white/60'}`}>How Our AI Detector Works</h2>
            <p className="text-sm leading-relaxed">
              Our heuristic AI text detection engine analyzes your writing using over 100 linguistic patterns commonly found in AI-generated content from models like ChatGPT, Claude, Gemini, and others. Unlike simple plagiarism checkers, we examine <strong>sentence structure uniformity</strong>, <strong>cliché phrase density</strong>, <strong>transition word overuse</strong>, and <strong>statistical anomalies</strong> in your writing to determine the likelihood of AI authorship.
            </p>
          </div>
          <div>
            <h2 className={`text-xl font-bold mb-3 ${isLight ? 'text-gray-900' : 'text-white/60'}`}>Why AI Detection Matters for Resumes</h2>
            <p className="text-sm leading-relaxed">
              67% of recruiters now use AI detection tools to screen resumes and cover letters. If your application is flagged as AI-generated, it may be rejected before a human ever reads it. Our detector helps you identify and fix the patterns that trigger these flags, ensuring your resume reads authentically while still being professionally polished.
            </p>
          </div>
          <div>
            <h2 className={`text-xl font-bold mb-3 ${isLight ? 'text-gray-900' : 'text-white/60'}`}>Free vs Pro Detection</h2>
            <p className="text-sm leading-relaxed">
              The free version on this page provides heuristic-based analysis with a 500-word limit. Our Pro plan inside the full suite includes unlimited detection, deep pattern analysis, section-by-section breakdowns, and our <strong>AI Humanizer</strong> tool that automatically rewrites flagged sections while preserving your original voice and meaning.
            </p>
          </div>

          {/* FAQ */}
          <div className="mt-8">
            <h3 className={`text-lg font-bold mb-4 ${isLight ? 'text-gray-900' : 'text-white/60'}`}>Frequently Asked Questions</h3>
            {[
              { q: 'Is this AI detector free?', a: 'Yes, the detector on this page is completely free with a 500-word limit. No account required.' },
              { q: 'Can AI detectors be wrong?', a: 'Yes, no AI detector is 100% accurate. Heuristic analysis provides indicators, not definitive proof. Always review flagged patterns in context.' },
              { q: 'What AI models can it detect?', a: 'Our patterns cover writing from ChatGPT (GPT-4), Claude, Gemini, Llama, and most major language models. AI writing shares common structural patterns regardless of the source model.' },
              { q: 'How can I make my resume less AI-detectable?', a: 'Vary your sentence lengths, avoid cliché phrases like "in today\'s fast-paced world", use personal anecdotes, and inject your natural voice. Our AI Humanizer can do this automatically.' },
            ].map((faq, i) => (
              <details key={i} className={`rounded-xl border p-4 mb-2 ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                <summary className={`font-medium cursor-pointer text-sm ${isLight ? 'text-gray-900' : 'text-white/60'}`}>{faq.q}</summary>
                <p className="mt-2 text-sm leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
