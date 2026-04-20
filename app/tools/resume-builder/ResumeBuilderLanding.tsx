'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';

const FEATURES = [
  { icon: 'bolt', title: 'AI-Powered Writing', desc: 'Gemini AI generates professional bullet points from raw job descriptions. Just paste and go.' },
  { icon: 'target', title: 'ATS Score in Real-Time', desc: 'Live scoring against ATS algorithms. See your compatibility percentage before you apply.' },
  { icon: 'description', title: '8+ Premium Templates', desc: 'Executive, Modern, Creative, Tech — all ATS-tested and recruiter-approved designs.' },
  { icon: 'key', title: 'Keyword Optimization', desc: 'AI extracts critical keywords from job postings and weaves them into your resume naturally.' },
  { icon: 'upload_file', title: 'Export Anywhere', desc: 'Download as PDF or DOCX. Perfectly formatted for every ATS and job portal.' },
  { icon: 'lock', title: 'Private & Secure', desc: 'Your resume data never leaves your account. End-to-end encryption on all uploads.' },
];

const STEPS = [
  { num: '01', title: 'Upload or Start Fresh', desc: 'Import your existing resume (PDF/DOCX) or build from scratch with our guided editor.' },
  { num: '02', title: 'AI Enhances Your Content', desc: 'Paste a job description. Our AI rewrites your bullet points to match the role\'s requirements.' },
  { num: '03', title: 'Check Your ATS Score', desc: 'Real-time scoring shows how well your resume matches the job. Fix gaps before applying.' },
  { num: '04', title: 'Export & Apply', desc: 'Download your polished resume in ATS-safe PDF or DOCX. Apply with confidence.' },
];

const COMPARISONS = [
  { feature: 'AI-powered bullet point writing', us: true, others: false },
  { feature: 'Real-time ATS compatibility score', us: true, others: false },
  { feature: 'Job description keyword matching', us: true, others: false },
  { feature: 'Resume parsing (PDF/DOCX upload)', us: true, others: true },
  { feature: 'Multiple export formats', us: true, others: true },
  { feature: 'Free tier available', us: true, others: true },
  { feature: 'No watermarks on free exports', us: true, others: false },
  { feature: 'Integrated AI Humanizer', us: true, others: false },
];

const FAQS = [
  { q: 'Is the AI resume builder free?', a: 'Yes, you can build and export one resume for free. The Pro plan unlocks unlimited resumes, advanced AI features, and all premium templates.' },
  { q: 'Will my resume pass ATS screening?', a: 'Our templates are specifically designed to pass ATS parsing. The real-time ATS score helps you optimize before submitting, targeting 80%+ compatibility.' },
  { q: 'What AI model powers the resume builder?', a: 'We use Google\'s Gemini AI, fine-tuned for career content. It generates professional, industry-specific bullet points that sound human-written.' },
  { q: 'Can I upload my existing resume?', a: 'Yes, upload any PDF or DOCX. Our parser extracts your content into the editor where you can enhance it with AI.' },
  { q: 'Is my data private?', a: 'Absolutely. Your resume data is encrypted and stored in your private vault. We never share, sell, or use your content for training.' },
];

export default function ResumeBuilderLanding() {
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
            <Link href="/templates" className={`text-xs ${isLight ? 'text-gray-500 hover:text-gray-900' : 'text-white/30 hover:text-white/60'} transition-colors`}>Templates</Link>
            <Link href="/tools/ai-detector" className={`text-xs ${isLight ? 'text-gray-500 hover:text-gray-900' : 'text-white/30 hover:text-white/60'} transition-colors`}>AI Detector</Link>
            <Link href="/suite/resume" className="text-xs font-medium text-black bg-gradient-to-r from-emerald-400 to-teal-400 px-4 py-1.5 rounded-lg hover:from-emerald-300 hover:to-teal-300 transition-all">
              Start Building →
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6">
        {/* Hero */}
        <section className="py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className={`inline-block text-xs font-medium px-3 py-1 rounded-full mb-6 ${isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              Powered by Gemini AI
            </div>
            <h1 className={`text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-5 leading-[1.1] ${isLight ? 'text-gray-900' : 'text-white/90'}`}>
              Build a resume that<br />
              <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">actually gets interviews</span>
            </h1>
            <p className={`text-base md:text-lg max-w-2xl mx-auto mb-8 ${isLight ? 'text-gray-500' : 'text-white/30'}`}>
              AI-powered resume builder with real-time ATS scoring. Upload your resume or start from scratch — our AI handles the hard part.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/suite/resume" className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-sm font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20">
                Build Your Resume Free →
              </Link>
              <Link href="/templates" className={`px-6 py-3 text-sm font-medium rounded-xl border ${isLight ? 'border-gray-200 text-gray-700 hover:bg-gray-100' : 'border-white/10 text-white/50 hover:bg-white/[0.04]'} transition-all`}>
                Browse Templates
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section className="pb-20">
          <h2 className={`text-2xl font-bold text-center mb-10 ${isLight ? 'text-gray-900' : 'text-white/80'}`}>
            Everything you need to land the job
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

        {/* How It Works */}
        <section className="pb-20">
          <h2 className={`text-2xl font-bold text-center mb-10 ${isLight ? 'text-gray-900' : 'text-white/80'}`}>
            How it works
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl border p-6 ${isLight ? 'bg-white border-gray-200' : 'bg-white/[0.02] border-white/[0.06]'}`}
              >
                <div className="text-xs font-bold text-emerald-500 mb-3">{s.num}</div>
                <h3 className={`font-semibold text-sm mb-1 ${isLight ? 'text-gray-900' : 'text-white/70'}`}>{s.title}</h3>
                <p className={`text-xs leading-relaxed ${isLight ? 'text-gray-500' : 'text-white/25'}`}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Comparison Table */}
        <section className="pb-20">
          <h2 className={`text-2xl font-bold text-center mb-10 ${isLight ? 'text-gray-900' : 'text-white/80'}`}>
            Why TalentConsulting vs others
          </h2>
          <div className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-white border-gray-200' : 'bg-white/[0.02] border-white/[0.06]'}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isLight ? 'border-gray-100' : 'border-white/[0.04]'}`}>
                  <th className={`text-left p-4 font-medium ${isLight ? 'text-gray-500' : 'text-white/30'}`}>Feature</th>
                  <th className={`p-4 font-medium text-center text-emerald-500`}>TalentConsulting</th>
                  <th className={`p-4 font-medium text-center ${isLight ? 'text-gray-400' : 'text-white/20'}`}>Others</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISONS.map((c, i) => (
                  <tr key={i} className={`border-b last:border-b-0 ${isLight ? 'border-gray-50' : 'border-white/[0.02]'}`}>
                    <td className={`p-4 ${isLight ? 'text-gray-700' : 'text-white/50'}`}>{c.feature}</td>
                    <td className="p-4 text-center text-emerald-500 text-lg">{c.us ? '✓' : '—'}</td>
                    <td className={`p-4 text-center text-lg ${isLight ? 'text-gray-300' : 'text-white/15'}`}>{c.others ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              Ready to build a resume that works?
            </h2>
            <p className={`text-sm mb-6 max-w-lg mx-auto ${isLight ? 'text-gray-500' : 'text-white/30'}`}>
              Join thousands of job seekers who landed interviews with AI-optimized resumes. Free to start, no credit card required.
            </p>
            <Link href="/suite/resume" className="inline-block px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-sm font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20">
              Build Your Resume Free →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
