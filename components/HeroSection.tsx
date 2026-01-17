'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface HeroSectionProps {
  onGetStarted: () => void;
  onShowLogin: () => void;
  onShowSignup: () => void;
  isAuthenticated: boolean;
}

const talentSuiteFeatures = [
  {
    id: 'resume',
    icon: '📄',
    title: 'Liquid Resume',
    subtitle: 'AI-Morphing Builder',
    description: 'Create reactive resumes that adapt to any job description. One-click context toggle between Technical and Leadership modes.',
    gradient: 'from-white/10 to-cyan-500/10',
    borderGradient: 'from-white/30 to-cyan-500/30',
    accentColor: '#ffffff',
    features: ['JD Morphing', 'Skill Graph', 'Match Score', 'Multi-Version'],
  },
  {
    id: 'jd',
    icon: '💼',
    title: 'Persona-JD Engine',
    subtitle: 'Smart Job Descriptions',
    description: 'Generate compelling job descriptions with AI. Includes Talent Density Score and real-time bias detection.',
    gradient: 'from-blue-500/10 to-cyan-500/10',
    borderGradient: 'from-blue-500/30 to-cyan-500/30',
    accentColor: '#0099ff',
    features: ['90-Day Roadmap', 'Bias Shield', 'Density Score', 'Culture Pulse'],
  },
  {
    id: 'shadow',
    icon: '🎭',
    title: 'Shadow Interviewer',
    subtitle: '24/7 Mock Practice',
    description: 'Practice with AI personas that adapt and challenge. Real-time feedback with stress testing and composure analysis.',
    gradient: 'from-indigo-500/10 to-blue-500/10',
    borderGradient: 'from-indigo-500/30 to-blue-500/30',
    accentColor: '#6366f1',
    features: ['Neural Sphere', 'Voice Analysis', 'Stress Mode', 'AI Personas'],
  },
  {
    id: 'oracle',
    icon: '🔮',
    title: 'Market Oracle',
    subtitle: 'Career Intelligence',
    description: '3D job starfield visualization. AI-powered salary predictions and skill recommendations based on market data.',
    gradient: 'from-green-500/10 to-emerald-500/10',
    borderGradient: 'from-green-500/30 to-emerald-500/30',
    accentColor: '#00ff88',
    features: ['Salary Heatmap', 'Opportunity Radar', 'Skill Roadmap', 'Market Trends'],
  },
];

export default function HeroSection({ onGetStarted, onShowLogin, onShowSignup, isAuthenticated }: HeroSectionProps) {
  const [activeFeature, setActiveFeature] = useState(0);
  const chartRef = useRef<any>(null);

  // Auto-rotate features
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % talentSuiteFeatures.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Animated data for the demo radar chart
  const radarData = {
    labels: ['Tech Skill', 'Culture Fit', 'Communication', 'Reliability', 'Experience', 'Soft Skills'],
    datasets: [
      {
        label: 'Human Intuition',
        data: [7.5, 8.2, 6.8, 7.0, 8.5, 7.8],
        backgroundColor: 'rgba(0, 245, 255, 0.15)',
        borderColor: 'rgba(0, 245, 255, 0.8)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(0, 245, 255, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(0, 245, 255, 1)',
        pointRadius: 5,
        pointHoverRadius: 7,
      },
      {
        label: 'AI Logic',
        data: [8.5, 7.0, 8.0, 8.8, 7.5, 6.5],
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.8)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(16, 185, 129, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(16, 185, 129, 1)',
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: 0,
        max: 10,
        ticks: {
          stepSize: 2,
          color: 'rgba(255, 255, 255, 0.4)',
          backdropColor: 'transparent',
          font: { size: 11 },
        },
        grid: {
          color: 'rgba(0, 245, 255, 0.1)',
        },
        angleLines: {
          color: 'rgba(0, 245, 255, 0.1)',
        },
        pointLabels: {
          color: 'rgba(255, 255, 255, 0.8)',
          font: {
            size: 12,
            weight: '600',
          },
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.8)',
          padding: 20,
          font: {
            size: 13,
            weight: '600',
          },
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(0, 245, 255, 0.3)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
      },
    },
    animation: {
      duration: 2000,
      easing: 'easeInOutQuart' as const,
    },
  };

  return (
    <div className="min-h-screen flex flex-col bg-black relative overflow-hidden">
      {/* Black background with dots */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Subtle radial glow at top */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, #0A0A0A, #000000)' }}
        />
        {/* Dot grid overlay */}
        <div className="mesh-gradient" />
      </div>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center pulse-glow">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gradient">TalentConsulting.io</h1>
              <p className="text-xs text-slate-500">Talent Density Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button onClick={onGetStarted} className="glass-button">
                Open Dashboard
              </button>
            ) : (
              <>
                <button onClick={onShowLogin} className="px-6 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors">
                  Sign In
                </button>
                <button onClick={onShowSignup} className="glass-button">
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex-1 flex items-center pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-6 py-12 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Content */}
            <div className="fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/30 mb-6">
                <div className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse"></div>
                <span className="text-sm font-medium text-cyber-cyan">AI powered Talent Consulting</span>
              </div>

              <h1 className="premium-headline text-gradient mb-6">
                Talent Density,<br />Decoded
              </h1>

              <p className="sub-headline mb-8 max-w-xl">
                The world's first end-to-end AI Talent Intelligence Platform. From interview co-pilot to career intelligence, make data-driven decisions with unprecedented confidence.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <button
                  onClick={onGetStarted}
                  className="glass-button text-lg px-8 py-4"
                >
                  <span className="flex items-center gap-2">
                    Get Started Free
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <div className="text-3xl font-bold text-gradient mb-1">10x</div>
                  <div className="text-sm text-slate-500">Faster AI</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gradient mb-1">95%</div>
                  <div className="text-sm text-slate-500">Accuracy</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gradient mb-1">8+</div>
                  <div className="text-sm text-slate-500">AI Tools</div>
                </div>
              </div>
            </div>

            {/* Right: Interactive Demo - Enhanced Animated Card */}
            <div className="slide-in lg:pl-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative"
              >
                {/* Outer glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-[#22C55E]/20 via-transparent to-[#00F5FF]/20 rounded-3xl blur-xl opacity-50" />

                {/* Floating particles */}
                <motion.div
                  animate={{
                    y: [-5, 5, -5],
                    x: [-3, 3, -3],
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-4 -right-4 w-8 h-8 rounded-full bg-[#22C55E]/30 blur-lg"
                />
                <motion.div
                  animate={{
                    y: [5, -5, 5],
                    x: [3, -3, 3],
                  }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -bottom-4 -left-4 w-12 h-12 rounded-full bg-[#00F5FF]/20 blur-lg"
                />

                {/* Main Card */}
                <div className="relative rounded-2xl bg-[#0A0A0A] border border-white/10 p-8 overflow-hidden">
                  {/* Top border glow */}
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#22C55E]/50 to-transparent" />

                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <h3 className="text-lg font-semibold text-white">Interview Co-Pilot</h3>
                      <p className="text-sm text-silver mt-1">AI vs Human Assessment</p>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-2 h-2 rounded-full bg-[#22C55E]"
                      />
                      <span className="text-sm font-medium text-[#22C55E]">Live</span>
                    </motion.div>
                  </div>

                  {/* Radar Chart */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                    className="relative h-[350px] mb-6"
                  >
                    <Radar data={radarData} options={radarOptions} />
                  </motion.div>

                  {/* Talent Density Score Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="rounded-xl bg-[#111111] border border-white/10 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-silver mb-1">Talent Density Score</p>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1 }}
                          className="text-3xl font-bold text-white"
                        >
                          8.2<span className="text-silver">/10</span>
                        </motion.p>
                      </div>
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 1.2, type: "spring", stiffness: 200 }}
                        className="w-16 h-16 rounded-full border-2 border-[#00F5FF] flex items-center justify-center"
                      >
                        <svg className="w-8 h-8 text-[#00F5FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    </div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.3 }}
                      className="mt-3 flex items-center gap-2 text-sm"
                    >
                      <span className="text-[#22C55E]">↑ 15% above average</span>
                      <span className="text-silver/50">•</span>
                      <span className="text-silver">Top 25% candidate</span>
                    </motion.div>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Talent Suite Showcase */}
      <div className="border-t border-white/5 py-16 bg-gradient-to-b from-transparent to-black/30">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-3">
              <span className="text-xs font-medium text-cyan-400">✨ Talent Intelligence Suite</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gradient mb-3">
              Beyond Interviews
            </h2>
            <p className="text-base text-slate-400 max-w-2xl mx-auto">
              A complete ecosystem of AI-powered tools for every stage of the talent journey
            </p>
          </motion.div>

          {/* Feature Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {talentSuiteFeatures.map((feature, index) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                onHoverStart={() => setActiveFeature(index)}
                className={`
                  glass-card p-4 cursor-pointer transition-all duration-300 group
                  bg-gradient-to-br ${feature.gradient}
                  border border-white/10
                  hover:border-white/30 hover:scale-102 hover:shadow-lg
                  ${activeFeature === index ? 'ring-1 ring-white/30 scale-102' : ''}
                `}
              >
                {/* Icon */}
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-white mb-1">
                  {feature.title}
                </h3>
                <p className="text-xs font-medium mb-2" style={{ color: feature.accentColor }}>
                  {feature.subtitle}
                </p>

                {/* Description */}
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">
                  {feature.description}
                </p>

                {/* Feature Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {feature.features.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="text-[10px] px-2 py-0.5 rounded-full text-slate-500">
                    +{feature.features.length - 2}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Active Feature Showcase - Compact */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFeature}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className={`
                glass-card p-4 bg-gradient-to-br ${talentSuiteFeatures[activeFeature].gradient}
                border ${talentSuiteFeatures[activeFeature].borderGradient}
              `}
            >
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-xl glass-card bg-black/20 flex items-center justify-center">
                    <span className="text-3xl">{talentSuiteFeatures[activeFeature].icon}</span>
                  </div>
                </div>

                {/* Feature Info */}
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">
                    {talentSuiteFeatures[activeFeature].title}
                  </h3>
                  <p className="text-xs font-medium mb-2" style={{ color: talentSuiteFeatures[activeFeature].accentColor }}>
                    {talentSuiteFeatures[activeFeature].subtitle}
                  </p>

                  {/* Feature Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {talentSuiteFeatures[activeFeature].features.map((feat) => (
                      <span
                        key={feat}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Indicator Dots */}
                <div className="flex flex-col gap-2">
                  {talentSuiteFeatures.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveFeature(index)}
                      className={`
                        w-1.5 h-1.5 rounded-full transition-all
                        ${activeFeature === index ? 'w-6 h-1.5 bg-white' : 'bg-white/30'}
                      `}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Interview Suite Features */}
      <div className="border-t border-white/5 py-10 bg-black/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-white mb-2">Interview Intelligence Suite</h3>
            <p className="text-sm text-slate-400">Complete interview workflow from prep to analytics</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 hover:scale-102 transition-transform cursor-pointer group">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🔍</div>
              <div className="text-base font-semibold text-white mb-1">Detective</div>
              <div className="text-xs text-cyan-400 mb-2">CV Intelligence</div>
              <div className="text-xs text-slate-400 line-clamp-2">Deep-dive into candidate profiles with AI-generated battle plans and interview strategies.</div>
            </div>
            <div className="glass-card p-4 hover:scale-102 transition-transform cursor-pointer group">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🎙️</div>
              <div className="text-base font-semibold text-white mb-1">Co-Pilot</div>
              <div className="text-xs text-indigo-400 mb-2">Live Assistant</div>
              <div className="text-xs text-slate-400 line-clamp-2">Real-time interview guidance with suggested questions and instant candidate analysis.</div>
            </div>
            <div className="glass-card p-4 hover:scale-102 transition-transform cursor-pointer group">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">⚖️</div>
              <div className="text-base font-semibold text-white mb-1">Calibration</div>
              <div className="text-xs text-emerald-400 mb-2">Hybrid Grading</div>
              <div className="text-xs text-slate-400 line-clamp-2">Combine human intuition with AI logic for fair, consistent candidate evaluation.</div>
            </div>
            <div className="glass-card p-4 hover:scale-102 transition-transform cursor-pointer group">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📊</div>
              <div className="text-base font-semibold text-white mb-1">Analytics</div>
              <div className="text-xs text-orange-400 mb-2">Insights Hub</div>
              <div className="text-xs text-slate-400 line-clamp-2">Track hiring metrics, identify bottlenecks, and optimize your interview process.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="border-t border-white/5 py-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gradient mb-3">
              Ready to Transform Your Hiring?
            </h2>
            <p className="text-base text-slate-400 mb-6">
              Join innovative teams using AI to make better talent decisions
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={onGetStarted} className="glass-button px-6 py-3">
                Get Started Free
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              100% Free Forever • Privacy First • No Credit Card Required
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
