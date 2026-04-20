'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';

const FEATURES = [
  { icon: 'shield', title: 'Bypass AI Detection', desc: 'Rewrite AI-generated text to pass GPTZero, Turnitin, Originality.ai, and corporate ATS detectors.' },
  { icon: 'theater_comedy', title: 'Preserve Your Voice', desc: 'Our engine doesn\'t just spin words — it restructures sentences to match natural human writing patterns.' },
  { icon: 'monitoring', title: 'Perplexity & Burstiness', desc: 'Real-time metrics show exactly how "human" your text reads. Target optimal ranges for each use case.' },
  { icon: 'work', title: 'Career-Specific Modes', desc: 'Resume, cover letter, and LinkedIn profile modes understand industry jargon and recruiter expectations.' },
  { icon: 'tune', title: 'Tone Control', desc: 'Adjust formality, confidence, and personality. From executive-level to conversational — you set the dial.' },
  { icon: 'bolt', title: 'Instant Results', desc: 'Humanize up to 2,000 words at once. Results in seconds, not minutes. No queuing or wait times.' },
];

const BEFORE_AFTER = [
  {
    label: 'Resume Bullet Point',
    before: 'Leveraged cross-functional collaboration to drive strategic initiatives that resulted in significant improvements to operational efficiency and stakeholder satisfaction.',
    after: 'Led a 5-person team across sales and engineering to cut onboarding time from 3 weeks to 4 days — saving $120K/year in training costs.',
  },
  {
    label: 'Cover Letter Opening',
    before: 'I am writing to express my sincere interest in the Software Engineer position at your esteemed organization. With my comprehensive background in software development, I am confident that my skills align perfectly with your requirements.',
    after: 'Your job post mentioned you need someone who can ship production React code fast. I\'ve done exactly that — 14 features deployed at Stripe in my last 6 months, zero rollbacks.',
  },
];

const DETECTORS = [
  { name: 'GPTZero', bypass: '97%' },
  { name: 'Turnitin AI', bypass: '94%' },
  { name: 'Originality.ai', bypass: '92%' },
  { name: 'Copyleaks', bypass: '96%' },
  { name: 'ZeroGPT', bypass: '98%' },
  { name: 'Sapling AI', bypass: '95%' },
];

const FAQS = [
  { q: 'How does the AI humanizer work?', a: 'Our engine analyzes your text for patterns that AI detectors flag — uniform sentence length, cliché phrases, predictable transitions. It then restructures your writing with varied syntax, natural idioms, and human-like imperfections while keeping your original meaning intact.' },
  { q: 'Is using an AI humanizer ethical?', a: 'We believe AI is a writing tool, like spellcheck or Grammarly. Our humanizer helps you sound like yourself — not like ChatGPT. It\'s designed for professionals who use AI as a starting point and want their final output to reflect their authentic voice.' },
  { q: 'What makes this different from Quillbot or Undetectable.ai?', a: 'Most humanizers just swap synonyms and rearrange words. Ours understands career content — it knows what recruiters look for in resumes, what ATS systems parse, and how hiring managers read cover letters. Domain-specific humanization, not generic word-spinning.' },
  { q: 'Can I humanize my resume with this?', a: 'Yes — we have a dedicated resume mode that humanizes while preserving ATS-compatible formatting, action verbs, and quantified achievements. It won\'t destroy the structure recruiters expect.' },
  { q: 'Is there a free version?', a: 'You can try the humanizer free with limited usage. Pro unlocks unlimited humanization, all tone modes, and bulk processing for up to 2,000 words per request.' },
];

export default function AIHumanizerLanding() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div className={`min-h-screen ${isLight ? 'bg-gray-50' : 'bg-[#0a0a0b]'}`}>
      {/* Nav */}
      <nav className={`sticky top-0 z-50 backdrop-blur-xl border-b ${isLight ? 'bg-white/80 border-gray-200' : 'bg-[#0a0a0b]/80 border-white/[0.04]'}`}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className={`text-sm font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-white/90'}`}>
            TalentConsulting<span className={isLight ? 'text-gray-400' : 'text-white/30'}>.io</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/tools/ai-detector" className={`text-xs ${isLight ? 'text-gray-500 hover:text-gray-900' : 'text-white/30 hover:text-white/60'} transition-colors`}>AI Detector</Link>
            <Link href="/tools/resume-builder" className={`text-xs ${isLight ? 'text-gray-500 hover:text-gray-900' : 'text-white/30 hover:text-white/60'} transition-colors`}>Resume Builder</Link>
            <Link href="/suite/writing-tools" className="text-xs font-medium text-black bg-gradient-to-r from-emerald-400 to-teal-400 px-4 py-1.5 rounded-lg hover:from-emerald-300 hover:to-teal-300 transition-all">
              Try Humanizer →
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6">
        {/* Hero */}
        <section className="py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className={`inline-block text-xs font-medium px-3 py-1 rounded-full mb-6 ${isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              Career-Grade AI Humanization
            </div>
            <h1 className={`text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-5 leading-[1.1] ${isLight ? 'text-gray-900' : 'text-white/90'}`}>
              Make AI text<br />
              <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">sound like you wrote it</span>
            </h1>
            <p className={`text-base md:text-lg max-w-2xl mx-auto mb-8 ${isLight ? 'text-gray-500' : 'text-white/30'}`}>
              Transform ChatGPT, Claude, and Gemini output into natural, authentic writing that passes every AI detector. Built specifically for resumes, cover letters, and career content.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/suite/writing-tools" className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-sm font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20">
                Humanize Your Text Free →
              </Link>
              <Link href="/tools/ai-detector" className={`px-6 py-3 text-sm font-medium rounded-xl border ${isLight ? 'border-gray-200 text-gray-700 hover:bg-gray-100' : 'border-white/10 text-white/50 hover:bg-white/[0.04]'} transition-all`}>
                Check AI Score First
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Detector Bypass Stats */}
        <section className="pb-20">
          <h2 className={`text-2xl font-bold text-center mb-10 ${isLight ? 'text-gray-900' : 'text-white/80'}`}>
            Tested against leading AI detectors
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {DETECTORS.map((d, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-2xl border p-4 text-center ${isLight ? 'bg-white border-gray-200' : 'bg-white/[0.02] border-white/[0.06]'}`}
              >
                <div className="text-xl font-bold text-emerald-500">{d.bypass}</div>
                <div className={`text-[10px] mt-1 ${isLight ? 'text-gray-400' : 'text-white/20'}`}>{d.name}</div>
              </motion.div>
            ))}
          </div>
          <p className={`text-center text-xs mt-4 ${isLight ? 'text-gray-400' : 'text-white/15'}`}>
            Bypass rates based on internal testing of humanized career content. Results may vary.
          </p>
        </section>

        {/* Features */}
        <section className="pb-20">
          <h2 className={`text-2xl font-bold text-center mb-10 ${isLight ? 'text-gray-900' : 'text-white/80'}`}>
            Not just synonym swapping
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`rounded-2xl border p-6 ${isLight ? 'bg-white border-gray-200' : 'bg-white/[0.02] border-white/[0.06]'}`}
              >
                <span className="material-symbols-rounded text-2xl mb-3 block text-emerald-500">{f.icon}</span>
                <h3 className={`font-semibold text-sm mb-1 ${isLight ? 'text-gray-900' : 'text-white/70'}`}>{f.title}</h3>
                <p className={`text-xs leading-relaxed ${isLight ? 'text-gray-500' : 'text-white/25'}`}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Before / After */}
        <section className="pb-20">
          <h2 className={`text-2xl font-bold text-center mb-10 ${isLight ? 'text-gray-900' : 'text-white/80'}`}>
            See the difference
          </h2>
          <div className="space-y-6">
            {BEFORE_AFTER.map((ex, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-white border-gray-200' : 'bg-white/[0.02] border-white/[0.06]'}`}
              >
                <div className={`px-5 py-2 text-xs font-medium ${isLight ? 'bg-gray-50 text-gray-500 border-b border-gray-100' : 'bg-white/[0.02] text-white/30 border-b border-white/[0.04]'}`}>
                  {ex.label}
                </div>
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-inherit">
                  <div className="p-5">
                    <div className="text-[10px] uppercase tracking-wider text-red-400 font-semibold mb-2">❌ AI-Generated</div>
                    <p className={`text-sm leading-relaxed ${isLight ? 'text-gray-500' : 'text-white/30'}`}>{ex.before}</p>
                  </div>
                  <div className="p-5">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-2">✓ Humanized</div>
                    <p className={`text-sm leading-relaxed ${isLight ? 'text-gray-700' : 'text-white/60'}`}>{ex.after}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="pb-20">
          <h2 className={`text-2xl font-bold text-center mb-8 ${isLight ? 'text-gray-900' : 'text-white/80'}`}>
            Frequently Asked Questions
          </h2>
          <div className="max-w-2xl mx-auto space-y-2">
            {FAQS.map((faq, i) => (
              <details key={i} className={`rounded-xl border p-4 ${isLight ? 'bg-white border-gray-200' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                <summary className={`font-medium cursor-pointer text-sm ${isLight ? 'text-gray-900' : 'text-white/60'}`}>{faq.q}</summary>
                <p className={`mt-2 text-sm leading-relaxed ${isLight ? 'text-gray-500' : 'text-white/25'}`}>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="pb-20">
          <div className={`rounded-2xl border p-10 text-center ${isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/[0.04] border-emerald-500/20'}`}>
            <h2 className={`text-2xl font-bold mb-3 ${isLight ? 'text-gray-900' : 'text-white/80'}`}>
              Stop sounding like ChatGPT
            </h2>
            <p className={`text-sm mb-6 max-w-lg mx-auto ${isLight ? 'text-gray-500' : 'text-white/30'}`}>
              Your career is too important for generic AI output. Humanize your resumes and cover letters so they sound like you — not a language model.
            </p>
            <Link href="/suite/writing-tools" className="inline-block px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-sm font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20">
              Humanize Your Text Free →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
