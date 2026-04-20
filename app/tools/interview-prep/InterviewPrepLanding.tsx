'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';

const FEATURES = [
  { icon: 'target', title: 'Role-Specific Questions', desc: 'AI generates questions tailored to your target job title, company, and industry. No generic "tell me about yourself" fluff.' },
  { icon: 'star', title: 'STAR Method Coaching', desc: 'Real-time feedback on your Situation, Task, Action, Result structure. Learn the framework interviewers expect.' },
  { icon: 'psychology', title: 'Behavioral + Technical', desc: 'Practice both behavioral and technical interview questions. Cover leadership scenarios, conflict resolution, and domain-specific challenges.' },
  { icon: 'monitoring', title: 'Score & Feedback', desc: 'Every answer is graded on structure, specificity, relevance, and impact. Get actionable tips to improve.' },
  { icon: 'mic', title: 'Natural Conversation', desc: 'Our AI interviewer follows up on your answers like a real interviewer would. No scripted Q&A — adaptive dialogue.' },
  { icon: 'summarize', title: 'Session Summaries', desc: 'After each session, get a detailed report: strengths, weaknesses, and exactly what to practice next.' },
];

const QUESTION_TYPES = [
  { type: 'Behavioral', examples: ['Tell me about a time you led a project under pressure', 'Describe a situation where you disagreed with your manager', 'How do you handle competing priorities?'], color: 'emerald' },
  { type: 'Technical', examples: ['Walk me through your system design approach', 'How would you optimize a slow database query?', 'Explain your debugging methodology'], color: 'blue' },
  { type: 'Situational', examples: ['What would you do if a deadline was going to be missed?', 'How would you onboard a new team member remotely?', 'A stakeholder disagrees with your approach — what do you do?'], color: 'amber' },
];

const INDUSTRIES = [
  'Software Engineering', 'Product Management', 'Data Science',
  'Marketing', 'Finance', 'Healthcare',
  'Consulting', 'Sales', 'Operations',
  'Design', 'Human Resources', 'Legal',
];

const FAQS = [
  { q: 'How does AI interview practice work?', a: 'You select a target role and company. Our AI generates realistic interview questions, listens to your answers, and provides structured feedback based on the STAR method, answer specificity, and relevance to the role.' },
  { q: 'Is this like talking to a real interviewer?', a: 'Our AI adapts to your responses with follow-up questions, just like a real interviewer. It\'s not a static Q&A — it\'s a dynamic conversation designed to simulate actual interview pressure.' },
  { q: 'What roles are supported?', a: 'We cover 50+ industries and roles including software engineering, product management, data science, consulting, finance, healthcare, marketing, and more. If your role exists, we have questions for it.' },
  { q: 'Will this actually help me get a job?', a: 'Practice is the #1 predictor of interview performance. Candidates who do 5+ mock interviews are 3x more likely to receive offers. Our AI gives you unlimited, on-demand practice with expert-level feedback.' },
  { q: 'Is there a free version?', a: 'Yes — you get 3 free practice sessions. Pro unlocks unlimited sessions, advanced scoring analytics, session history, and priority question generation.' },
];

export default function InterviewPrepLanding() {
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
            <Link href="/tools/resume-builder" className={`text-xs ${isLight ? 'text-gray-500 hover:text-gray-900' : 'text-white/30 hover:text-white/60'} transition-colors`}>Resume Builder</Link>
            <Link href="/tools/ai-humanizer" className={`text-xs ${isLight ? 'text-gray-500 hover:text-gray-900' : 'text-white/30 hover:text-white/60'} transition-colors`}>AI Humanizer</Link>
            <Link href="/suite/skill-bridge" className="text-xs font-medium text-black bg-gradient-to-r from-emerald-400 to-teal-400 px-4 py-1.5 rounded-lg hover:from-emerald-300 hover:to-teal-300 transition-all">
              Start Practicing →
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6">
        {/* Hero */}
        <section className="py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className={`inline-block text-xs font-medium px-3 py-1 rounded-full mb-6 ${isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              AI-Powered Interview Coaching
            </div>
            <h1 className={`text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-5 leading-[1.1] ${isLight ? 'text-gray-900' : 'text-white/90'}`}>
              Nail your next interview<br />
              <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">before you walk in</span>
            </h1>
            <p className={`text-base md:text-lg max-w-2xl mx-auto mb-8 ${isLight ? 'text-gray-500' : 'text-white/30'}`}>
              Practice with an AI interviewer that adapts to your role, asks real follow-ups, and grades your STAR method answers in real time. Like having a career coach on demand.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/suite/skill-bridge" className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-sm font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20">
                Start Mock Interview →
              </Link>
              <Link href="/blog/ai-interview-prep-star-method" className={`px-6 py-3 text-sm font-medium rounded-xl border ${isLight ? 'border-gray-200 text-gray-700 hover:bg-gray-100' : 'border-white/10 text-white/50 hover:bg-white/[0.04]'} transition-all`}>
                Learn STAR Method
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Question Types */}
        <section className="pb-20">
          <h2 className={`text-2xl font-bold text-center mb-10 ${isLight ? 'text-gray-900' : 'text-white/80'}`}>
            Practice every question type
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {QUESTION_TYPES.map((qt, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl border p-6 ${isLight ? 'bg-white border-gray-200' : 'bg-white/[0.02] border-white/[0.06]'}`}
              >
                <h3 className={`font-semibold text-sm mb-3 ${isLight ? 'text-gray-900' : 'text-white/70'}`}>{qt.type}</h3>
                <ul className="space-y-2">
                  {qt.examples.map((ex, j) => (
                    <li key={j} className={`text-xs leading-relaxed pl-3 border-l-2 ${
                      qt.color === 'emerald' ? 'border-emerald-500/30' :
                      qt.color === 'blue' ? 'border-blue-500/30' :
                      'border-amber-500/30'
                    } ${isLight ? 'text-gray-500' : 'text-white/25'}`}>
                      {ex}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="pb-20">
          <h2 className={`text-2xl font-bold text-center mb-10 ${isLight ? 'text-gray-900' : 'text-white/80'}`}>
            More than flashcards
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

        {/* Industries */}
        <section className="pb-20">
          <h2 className={`text-2xl font-bold text-center mb-3 ${isLight ? 'text-gray-900' : 'text-white/80'}`}>
            Tailored for your industry
          </h2>
          <p className={`text-sm text-center mb-8 ${isLight ? 'text-gray-500' : 'text-white/25'}`}>
            Our AI generates role-specific questions across 50+ industries
          </p>
          <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
            {INDUSTRIES.map((ind, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                className={`text-xs px-3 py-1.5 rounded-full ${isLight ? 'bg-gray-100 text-gray-600' : 'bg-white/[0.04] text-white/30 border border-white/[0.06]'}`}
              >
                {ind}
              </motion.span>
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
              The best interview prep is practice
            </h2>
            <p className={`text-sm mb-6 max-w-lg mx-auto ${isLight ? 'text-gray-500' : 'text-white/30'}`}>
              Candidates who practice 5+ mock interviews are 3x more likely to get offers. Start your first session free — no credit card, no commitment.
            </p>
            <Link href="/suite/skill-bridge" className="inline-block px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-sm font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20">
              Start Mock Interview Free →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
