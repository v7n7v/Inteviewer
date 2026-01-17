'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { authHelpers } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import SuiteSelector from '@/components/SuiteSelector';
import SlidingTips from '@/components/SlidingTips';

export default function HubPage() {
  const router = useRouter();
  const { user, setUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  /* View Mode State (Interviewer vs Candidate) */
  const [viewMode, setViewMode] = useState<'interviewer' | 'candidate'>('interviewer');

  /* Dashboard Insights State */
  const [insights, setInsights] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);

  // Fetch AI Insights
  const fetchInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await fetch('/api/dashboard/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: viewMode, // Pass the selected mode to API
          context: { email: user?.email }
        })
      });
      const data = await res.json();
      if (!data.error) {
        setInsights(data);
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setLoadingInsights(false);
    }
  };

  // Navigate to specific tools
  const handleWidgetClick = (widget: string) => {
    if (widget === 'aiDiscovery') {
      router.push(viewMode === 'interviewer' ? '/dashboard/detective' : '/suite/job-search');
    } else if (widget === 'careerRoadmap') {
      router.push('/suite/market-oracle');
    } else if (widget === 'marketPulse') {
      router.push('/suite/market-oracle');
    }
  };

  // Re-fetch when viewMode changes
  useEffect(() => {
    if (user) {
      fetchInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, viewMode]);

  useEffect(() => {
    authHelpers.getSession().then(({ session }) => {
      if (!session) {
        router.push('/');
      } else {
        setUser(session.user);
      }
      setLoading(false);
    });

    // Set greeting based on time
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, [router, setUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </motion.div>
          <p className="text-silver">Loading Hirely.ai...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const firstName = user.email?.split('@')[0] || 'there';

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Ambient background effects - Vercel/Linear Style */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Subtle radial glow at top */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, #111111, #000000)' }}
        />
        {/* Dot grid */}
        <div className="mesh-gradient" />
      </div>

      {/* Top Bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex items-center justify-between p-6"
      >
        {/* Welcome */}
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-sm"
          >
            {greeting},
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold text-white mb-2"
          >
            {firstName} 👋
          </motion.h1>

          {/* View Mode Toggle - Animated */}
          <div className="inline-flex items-center gap-3">
            <div className="relative inline-flex p-1 rounded-lg bg-[#111111] border border-white/10">
              {/* Sliding Indicator */}
              <motion.div
                layout
                className={`absolute top-1 bottom-1 rounded-md ${viewMode === 'interviewer' ? 'bg-gradient-to-r from-[#22C55E] to-[#22C55E]/80' : 'bg-gradient-to-r from-[#0070F3] to-[#0070F3]/80'}`}
                initial={false}
                animate={{
                  left: viewMode === 'interviewer' ? 4 : '50%',
                  width: '48%',
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
              <button
                onClick={() => setViewMode('interviewer')}
                className={`relative z-10 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'interviewer' ? 'text-white' : 'text-silver hover:text-white'}`}
              >
                Hiring Team
              </button>
              <button
                onClick={() => setViewMode('candidate')}
                className={`relative z-10 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'candidate' ? 'text-white' : 'text-silver hover:text-white'}`}
              >
                Job Seeker
              </button>
            </div>

            {/* Home Button */}
            <button
              onClick={() => router.push('/')}
              className="p-2 rounded-lg bg-[#111111] border border-white/10 hover:bg-[#1A1A1A] hover:border-white/20 transition-colors"
              title="Back to Home"
            >
              <svg className="w-4 h-4 text-silver" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Actions & Tips */}
        <div className="relative flex items-center gap-3">
          {/* Sliding Tips - positioned relative to this container */}
          <SlidingTips />

          {/* Settings Dropdown */}
          <div className="relative">
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="relative z-20 p-2.5 rounded-xl bg-[#111111] border border-white/10 hover:bg-[#1A1A1A] transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5 text-silver" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </motion.button>

            <AnimatePresence>
              {showSettingsMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-48 p-2 rounded-xl bg-[#0A0A0A] border border-white/10 shadow-xl z-50"
                >
                  <button
                    onClick={() => { router.push('/settings'); setShowSettingsMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1A1A1A] text-silver hover:text-white text-left text-sm transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </button>
                  <div className="my-1 border-t border-white/10" />
                  <button
                    onClick={async () => {
                      await authHelpers.signOut();
                      setUser(null);
                      router.push('/');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 text-silver hover:text-red-400 text-left text-sm transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <SuiteSelector fullPage showBrandHeader={false} />

      {/* Bento Grid Dashboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="relative z-10 px-6 pb-12"
      >
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-1.5 h-6 bg-gradient-to-b from-[#00F5FF] to-[#00F5FF]/30 rounded-full ${loadingInsights ? 'animate-pulse' : ''}`} />
              <h2 className="text-lg font-semibold text-white">
                {viewMode === 'interviewer' ? 'Hiring Insights' : 'Job Market Insights'}
              </h2>
            </div>

            <button
              onClick={fetchInsights}
              className="text-xs text-[#00F5FF] hover:text-[#00F5FF]/80 flex items-center gap-1 transition-colors"
            >
              <svg className={`w-3 h-3 ${loadingInsights ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Widget 1: AI Discovery Spotlight */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="lg:col-span-1 rounded-2xl bg-[#0A0A0A] border border-white/10 p-5 hover:border-[#00F5FF]/30 transition-all group cursor-pointer"
              onClick={() => handleWidgetClick('aiDiscovery')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#111111] border border-white/10 flex items-center justify-center">
                    <span className="text-lg">🎯</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {viewMode === 'interviewer' ? 'Candidate Matches' : 'Job Matches'}
                    </h3>
                    <p className="text-xs text-silver">
                      {viewMode === 'interviewer' ? 'Top talent for your roles' : 'Roles matching your profile'}
                    </p>
                  </div>
                </div>
                {!loadingInsights && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] animate-pulse" />
                    <span className="text-[10px] font-medium text-[#00F5FF]">Live</span>
                  </div>
                )}
              </div>

              {loadingInsights ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 rounded-xl bg-white/5" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {insights?.aiDiscovery?.map((item: any, i: number) => (
                    <div
                      key={i}
                      onClick={(e) => {
                        if (item.id) {
                          e.stopPropagation(); // Prevent parent handleWidgetClick
                          router.push(`/dashboard/detective?candidateId=${item.id}`);
                        }
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl bg-[#111111] border border-white/5 group-hover:border-white/10 transition-all ${item.id ? 'cursor-pointer hover:bg-white/5' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#22C55E]/20 to-[#00F5FF]/20 flex items-center justify-center text-xs font-bold text-white">
                          {item.name ? item.name.split(' ').map((n: string) => n[0]).join('') : 'JD'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{item.name || item.title}</p>
                          <p className="text-xs text-silver">{item.role || item.company}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#00F5FF]">{item.score || item.matchScore}%</p>
                        <p className="text-[10px] text-[#22C55E]">↑ {item.trend}</p>
                      </div>
                    </div>
                  )) || (
                      <p className="text-sm text-silver">No matches found.</p>
                    )}
                </div>
              )}

              <button className="w-full mt-4 py-2 rounded-lg border border-[#00F5FF]/30 text-[#00F5FF] text-xs font-medium hover:bg-[#00F5FF]/10 transition-all">
                View All {viewMode === 'interviewer' ? 'Candidates' : 'Jobs'} →
              </button>
            </motion.div>

            {/* Widget 2: Career Growth Roadmap */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 }}
              className="lg:col-span-1 rounded-2xl bg-[#0A0A0A] border border-white/10 p-5 hover:border-[#0070F3]/30 transition-all cursor-pointer"
              onClick={() => handleWidgetClick('careerRoadmap')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#111111] border border-white/10 flex items-center justify-center">
                    <span className="text-lg">🚀</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {viewMode === 'interviewer' ? 'Team Skills' : 'Career Roadmap'}
                    </h3>
                    <p className="text-xs text-silver">
                      {viewMode === 'interviewer' ? 'Skill gaps in your team' : 'Your skill gap analysis'}
                    </p>
                  </div>
                </div>
              </div>

              {loadingInsights ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="space-y-2">
                      <div className="h-3 w-1/3 bg-white/5 rounded" />
                      <div className="h-2 w-full bg-white/5 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {insights?.careerRoadmap?.skills?.map((skill: any, i: number) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-white">{skill.skill}</span>
                        <span className="text-[10px] text-silver">{skill.current}% → {skill.target}%</span>
                      </div>
                      <div className="relative h-2 rounded-full bg-[#111111] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${skill.current}%` }}
                          transition={{ delay: 0.8 + i * 0.1, duration: 0.8 }}
                          className="absolute left-0 top-0 h-full rounded-full"
                          style={{ backgroundColor: skill.color }}
                        />
                        <div
                          className="absolute top-0 h-full w-0.5 bg-white/40"
                          style={{ left: `${skill.target}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 p-3 rounded-xl bg-[#111111] border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-silver">Estimated time to target</p>
                    <p className="text-lg font-bold text-white">
                      {loadingInsights ? '---' : insights?.careerRoadmap?.timeToTarget}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-[#0070F3] flex items-center justify-center">
                    <span className="text-xs font-bold text-[#0070F3]">
                      {loadingInsights ? '--' : `${insights?.careerRoadmap?.completion}%`}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Widget 3: Market Pulse */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
              className="lg:col-span-1 rounded-2xl bg-[#0A0A0A] border border-white/10 p-5 hover:border-[#22C55E]/30 transition-all cursor-pointer"
              onClick={() => handleWidgetClick('marketPulse')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#111111] border border-white/10 flex items-center justify-center">
                    <span className="text-lg">📈</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Market Pulse</h3>
                    <p className="text-xs text-silver">Real-time hiring trends</p>
                  </div>
                </div>
                <span className="text-[10px] text-silver">Last 7 days</span>
              </div>

              {/* Mini Chart Visualization */}
              <div className="relative h-32 mb-4">
                {loadingInsights ? (
                  <div className="w-full h-full bg-white/5 rounded-lg animate-pulse" />
                ) : (
                  <svg className="w-full h-full" viewBox="0 0 200 80">
                    {/* Grid lines */}
                    {[0, 20, 40, 60].map((y) => (
                      <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    ))}
                    {/* Area fill */}
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {insights?.marketPulse?.chartData && (
                      <>
                        <motion.path
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ delay: 1, duration: 1.5 }}
                          d={`M0,${insights.marketPulse.chartData[0]?.y || 60} ${insights.marketPulse.chartData.map((p: any) => `L${p.x},${p.y}`).join(' ')} L200,80 L0,80 Z`}
                          fill="url(#chartGradient)"
                        />
                        <motion.path
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ delay: 1, duration: 1.5 }}
                          d={`M0,${insights.marketPulse.chartData[0]?.y || 60} ${insights.marketPulse.chartData.map((p: any) => `L${p.x},${p.y}`).join(' ')}`}
                          fill="none"
                          stroke="#22C55E"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        {/* Data points */}
                        {insights.marketPulse.chartData.map((p: any, i: number) => (
                          <motion.circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r="3"
                            fill="#22C55E"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 1.2 + i * 0.1 }}
                          />
                        ))}
                      </>
                    )}
                  </svg>
                )}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2">
                {loadingInsights ? (
                  [1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
                  ))
                ) : (
                  insights?.marketPulse?.stats?.map((stat: any, i: number) => (
                    <div key={i} className="p-2 rounded-lg bg-[#111111] border border-white/5 text-center">
                      <p className="text-[10px] text-silver mb-0.5">{stat.label}</p>
                      <p className="text-sm font-bold text-white">{stat.value}</p>
                      <p className={`text-[10px] ${stat.up ? 'text-[#22C55E]' : 'text-red-400'}`}>
                        {stat.up ? '↑' : '↓'} {stat.change}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}
