'use client';

import { motion } from 'framer-motion';
import { useRouter, usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';

interface SuiteSelectorProps {
  fullPage?: boolean;
  showBrandHeader?: boolean;
  onSelect?: () => void;
}

export default function SuiteSelector({ fullPage = false, showBrandHeader = true, onSelect }: SuiteSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useStore();

  const suites = [
    {
      id: 'interview',
      name: 'Interview Suite',
      tagline: 'For Hiring Teams',
      description: 'AI-powered interview preparation, live co-pilot assistance, candidate calibration, and analytics',
      icon: '🎯',
      gradient: 'from-[#22C55E] via-[#22C55E]/80 to-[#22C55E]/60',
      buttonStyle: 'bg-[#22C55E] text-white',
      taglineColor: 'text-[#22C55E]',
      statColor: 'text-[#22C55E]',
      glowColor: 'green',
      bgPattern: 'radial-gradient(circle at 30% 20%, rgba(34, 197, 94, 0.08) 0%, transparent 50%)',
      path: '/dashboard/detective',
      features: [
        { icon: '🔍', name: 'Detective', desc: 'CV Intelligence' },
        { icon: '🎙️', name: 'Co-Pilot', desc: 'Live Interview' },
        { icon: '⚖️', name: 'Calibration', desc: 'Hybrid Grading' },
        { icon: '📊', name: 'Analytics', desc: 'Insights Hub' },
      ],
      stats: { label: 'Interviews Conducted', value: '2.4K+' },
    },
    {
      id: 'talent',
      name: 'Talent Suite',
      tagline: 'For Job Seekers',
      description: 'Build stunning resumes, generate JDs, practice with AI interviewers, and explore market opportunities',
      icon: '✨',
      gradient: 'from-[#0070F3] via-[#0070F3]/80 to-[#0070F3]/60',
      buttonStyle: 'bg-[#0070F3] text-white',
      taglineColor: 'text-[#0070F3]',
      statColor: 'text-[#0070F3]',
      glowColor: 'vercel-blue',
      bgPattern: 'radial-gradient(circle at 70% 80%, rgba(0, 112, 243, 0.08) 0%, transparent 50%)',
      path: '/suite/resume',
      features: [
        { icon: '📄', name: 'Resume Builder', desc: 'Liquid Resume' },
        { icon: '💼', name: 'JD Generator', desc: 'Mission Blueprint' },
        { icon: '🎭', name: 'Practice', desc: 'Shadow Interview' },
        { icon: '🎴', name: 'Flash Cards', desc: 'Study (Soon)' },

        { icon: '🔮', name: 'Market Oracle', desc: 'Career Intelligence' },
      ],
      stats: { label: 'Careers Launched', value: '890+' },
    },
  ];

  const handleSelect = (suite: typeof suites[0]) => {
    router.push(suite.path);
    onSelect?.();
  };

  // Determine active suite
  const activeSuite = pathname?.startsWith('/suite') ? 'talent' : 'interview';

  if (!fullPage) {
    // Compact version for sidebar/header
    return (
      <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
        {suites.map((suite) => (
          <button
            key={suite.id}
            onClick={() => handleSelect(suite)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeSuite === suite.id
              ? `bg-gradient-to-r ${suite.gradient} text-white shadow-lg`
              : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
          >
            <span>{suite.icon}</span>
            <span className="hidden md:inline">{suite.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>
    );
  }

  // Full page suite selector
  return (
    <div className={showBrandHeader ? "p-6 lg:p-8 pb-8" : "px-6 lg:px-8 pb-8 pt-0"}>
      {/* Header */}
      {showBrandHeader && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center gap-3 mb-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-gradient">TalentConsulting.io</h1>
          </motion.div>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Choose your mission. Whether you're hiring exceptional talent or seeking your next opportunity.
          </p>
        </motion.div>
      )}

      {/* Suite Cards */}
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8">
        {suites.map((suite, index) => (
          <motion.div
            key={suite.id}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group relative"
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${suite.gradient} opacity-0 group-hover:opacity-10 blur-3xl transition-opacity duration-500 rounded-3xl`}
            />
            <motion.button
              onClick={() => handleSelect(suite)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative w-full h-full text-left overflow-hidden rounded-3xl border border-white/10 bg-[#0A0A0A] hover:bg-[#1A1A1A] hover:border-white/20 transition-all duration-300 flex flex-col"
            >
              {/* Subtle top highlight */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <div className="relative p-8 flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <motion.span
                      initial={{ scale: 1 }}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="text-6xl block mb-4"
                    >
                      {suite.icon}
                    </motion.span>
                    <h2 className="text-3xl font-bold text-white mb-1">{suite.name}</h2>
                    <p className={`text-sm font-medium ${suite.taglineColor}`}>
                      {suite.tagline}
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${suite.gradient} flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity`}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>

                {/* Description */}
                <p className="text-slate-400 mb-8">{suite.description}</p>

                {/* Features Grid */}
                <div className="grid grid-cols-2 gap-3 mb-8 flex-1">
                  {suite.features.map((feature) => (
                    <div
                      key={feature.name}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[#111111] border border-white/10 hover:bg-[#1A1A1A] transition-colors"
                    >
                      <span className="text-xl">{feature.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{feature.name}</p>
                        <p className="text-xs text-silver">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between pt-6 border-t border-white/10 mt-auto">
                  <div>
                    <p className="text-xs text-silver uppercase tracking-wider">{suite.stats.label}</p>
                    <p className={`text-2xl font-bold ${suite.statColor}`}>
                      {suite.stats.value}
                    </p>
                  </div>
                  <div className={`px-6 py-3 rounded-xl ${suite.buttonStyle} font-semibold opacity-90 group-hover:opacity-100 transition-opacity`}>
                    Enter Suite →
                  </div>
                </div>
              </div>
            </motion.button>
          </motion.div>
        ))}
      </div>

      {/* Bottom text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-slate-500 text-sm mt-12"
      >
        Switch between suites anytime using the navigation header
      </motion.p>
    </div>
  );
}
