'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { authHelpers } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import LogoutModal from './modals/LogoutModal';

interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  description: string;
  path: string;
  badge?: string;
}

const interviewSuiteItems: NavigationItem[] = [
  { id: 'detective', label: 'Detective', icon: '🔍', description: 'CV Intelligence', path: '/dashboard/detective' },
  { id: 'copilot', label: 'Co-Pilot', icon: '🎙️', description: 'Live Interview', path: '/dashboard/copilot' },
  { id: 'calibration', label: 'Calibration', icon: '⚖️', description: 'Hybrid Grading', path: '/dashboard/calibration' },
  { id: 'jd-generator', label: 'JD Generator', icon: '💼', description: 'Job Descriptions', path: '/suite/jd-generator' },
  { id: 'analytics', label: 'Analytics', icon: '📊', description: 'Insights Hub', path: '/dashboard/analytics' },
];

const talentSuiteItems: NavigationItem[] = [
  { id: 'resume', label: 'Liquid Resume', icon: '📄', description: 'Resume Builder', path: '/suite/resume' },
  { id: 'applications', label: 'Applications', icon: '📊', description: 'Track Jobs', path: '/suite/applications' },
  { id: 'shadow', label: 'Practice', icon: '🎭', description: 'Shadow Interview', path: '/suite/shadow-interview' },
  { id: 'oracle', label: 'Market Oracle', icon: '🔮', description: 'Career Intelligence', path: '/suite/market-oracle' },
  { id: 'flashcards', label: 'Study Cards', icon: '🎴', description: 'Flash Cards', path: '/suite/flashcards', badge: 'Soon' },
  { id: 'job-search', label: 'Job Search', icon: '🔍', description: 'Find Jobs', path: '/suite/job-search', badge: 'Soon' },
  { id: 'avatar', label: 'Video Interview', icon: '🎥', description: 'AI Mock Interview', path: '/suite/avatar-interview', badge: 'Soon' },
];

const suiteConfig = {
  interview: {
    name: 'Interview Suite',
    tagline: 'For Hiring Teams',
    icon: '🎯',
    gradient: 'from-[#22C55E] to-[#22C55E]/60',
    accentColor: 'green',
    bgGlow: 'bg-[#22C55E]/10',
    items: interviewSuiteItems,
    otherSuite: { name: 'Talent Suite', icon: '✨', path: '/suite/resume' },
  },
  talent: {
    name: 'Talent Suite',
    tagline: 'For Job Seekers',
    icon: '✨',
    gradient: 'from-[#0070F3] to-[#0070F3]/60',
    accentColor: 'blue',
    bgGlow: 'bg-[#0070F3]/10',
    items: talentSuiteItems,
    otherSuite: { name: 'Interview Suite', icon: '🎯', path: '/dashboard/detective' },
  },
};

interface SuiteSidebarProps {
  onNavigate?: () => void;
}

export default function SuiteSidebar({ onNavigate }: SuiteSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser } = useStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Check for mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Determine which suite we're in
  // JD Generator is in Interview Suite even though it's under /suite/ path
  const isInterviewSuitePage = pathname?.startsWith('/dashboard') || pathname?.startsWith('/suite/jd-generator');
  const activeSuiteId = isInterviewSuitePage ? 'interview' : 'talent';
  const suite = suiteConfig[activeSuiteId];

  const handleNavigation = (path: string) => {
    router.push(path);
    onNavigate?.();
  };

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
    setShowUserMenu(false);
  };

  const confirmLogout = async () => {
    await authHelpers.signOut();
    setUser(null);
    router.push('/');
    setShowLogoutModal(false);
  };

  const isActive = (path: string) => {
    if (path === '/dashboard/detective' && (pathname === '/dashboard' || pathname === '/')) return true;
    return pathname?.startsWith(path);
  };

  const switchToOtherSuite = () => {
    router.push(suite.otherSuite.path);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className={`fixed top-4 left-4 z-[60] p-3 rounded-xl border transition-all ${isMobileOpen
            ? 'bg-slate-800 border-white/20'
            : `bg-gradient-to-r ${suite.gradient} border-transparent`
            }`}
        >
          <motion.div
            animate={isMobileOpen ? 'open' : 'closed'}
          >
            {isMobileOpen ? (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </motion.div>
        </button>
      )}

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobile && isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      <motion.aside
        layout
        initial={false}
        animate={{
          width: isMobile ? 280 : (isCollapsed ? 80 : 280),
          x: isMobile ? (isMobileOpen ? 0 : -300) : 0
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`fixed left-0 top-0 h-screen z-50 flex flex-col overflow-hidden ${isMobile ? '' : ''}`}
        style={{
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {/* Subtle top glow */}
        <div className={`absolute top-0 left-0 w-full h-24 ${suite.bgGlow} blur-3xl opacity-20`} />

        {/* Border */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-white/10" />

        <LayoutGroup>
          {/* Header */}
          <div className="relative p-4 border-b border-white/5">
            <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 w-full ${isCollapsed ? 'flex-col !gap-4' : ''}`}>
              {/* Suite Icon - always visible */}
              <motion.div
                layout
                whileHover={{ scale: 1.05, rotate: 5 }}
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${suite.gradient} flex items-center justify-center shadow-lg flex-shrink-0`}
              >
                <span className="text-xl">{suite.icon}</span>
              </motion.div>

              {/* Suite Text - animated opacity, width and height */}
              <motion.div
                animate={{
                  opacity: isCollapsed ? 0 : 1,
                  width: isCollapsed ? 0 : 'auto',
                  height: isCollapsed ? 0 : 'auto',
                  marginBottom: isCollapsed ? 0 : 0,
                }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={`overflow-hidden whitespace-nowrap ${isCollapsed ? '' : 'flex-1'}`}
              >
                <h1 className="text-base font-bold text-white">{suite.name}</h1>
                <p className={`text-xs bg-gradient-to-r ${suite.gradient} bg-clip-text text-transparent font-medium`}>
                  {suite.tagline}
                </p>
              </motion.div>

              {/* Collapse/Expand Button */}
              <motion.button
                layout
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isCollapsed ? 'w-full flex justify-center bg-white/5 hover:bg-white/10 hover:border-cyan-500/30' : 'hover:bg-white/5'}`}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <motion.svg
                  layout
                  animate={{ rotate: isCollapsed ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-5 h-5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </motion.svg>
              </motion.button>
            </div>
          </div>

          {/* Suite Switcher */}
          <div className="p-3">
            <motion.button
              onClick={switchToOtherSuite}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full p-3 rounded-xl bg-[#111111] border border-white/10 hover:bg-[#1A1A1A] hover:border-white/20 transition-all ${isCollapsed ? 'flex justify-center' : ''}`}
            >
              <AnimatePresence mode="wait">
                {!isCollapsed ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{suite.otherSuite.icon}</span>
                      <div className="text-left">
                        <p className="text-xs text-silver">Switch to</p>
                        <p className="text-sm font-medium text-white">{suite.otherSuite.name}</p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-silver" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </motion.div>
                ) : (
                  <motion.span
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="text-lg"
                    title={`Switch to ${suite.otherSuite.name}`}
                  >
                    {suite.otherSuite.icon}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Quick Navigation - Back to Hub */}
          <div className="px-3 pb-2">
            <motion.button
              onClick={() => router.push('/hub')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0A0A0A] border border-white/10 hover:bg-[#1A1A1A] hover:border-white/20 transition-all ${isCollapsed ? 'justify-center' : ''}`}
              title="Back to Hub"
            >
              <svg className="w-4 h-4 text-silver" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
              {!isCollapsed && <span className="text-xs text-silver">Back to Hub</span>}
            </motion.button>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {suite.items.map((item, index) => {
              const active = isActive(item.path);
              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleNavigation(item.path)}
                  className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200
                  ${active
                      ? `bg-gradient-to-r ${suite.gradient} bg-opacity-20 text-white`
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                  title={isCollapsed ? item.label : ''}
                >
                  <span className={`text-xl ${active ? '' : ''}`}>{item.icon}</span>
                  <AnimatePresence mode="wait">
                    {!isCollapsed && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="flex-1 text-left overflow-hidden"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{item.label}</span>
                          {item.badge && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.badge === 'New'
                              ? `bg-gradient-to-r ${suite.gradient} text-white`
                              : 'bg-slate-500/20 text-slate-400'
                              }`}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">{item.description}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {active && !isCollapsed && (
                    <motion.div
                      layoutId="active-nav"
                      className={`w-1 h-8 rounded-full bg-gradient-to-b ${suite.gradient}`}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Help & Support - Pinned to bottom */}
          <div className="px-3 pb-1">
            <motion.button
              onClick={() => handleNavigation('/help')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 text-slate-400 hover:bg-white/5 hover:text-white ${isCollapsed ? 'justify-center' : ''}`}
            >
              <span className="text-xl">💡</span>
              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex-1 text-left overflow-hidden"
                  >
                    <span className="font-medium text-sm">Help & Support</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* User Section */}
          <div className="p-3 border-t border-white/5">
            <div className="relative">
              <button
                onClick={() => !isCollapsed && setShowUserMenu(!showUserMenu)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors ${isCollapsed ? 'justify-center' : ''}`}
              >
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${suite.gradient} flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                  {user?.email?.[0].toUpperCase()}
                </div>
                <AnimatePresence mode="wait">
                  {!isCollapsed && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 text-left overflow-hidden"
                    >
                      <p className="text-sm font-medium text-white truncate">{user?.email?.split('@')[0]}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                {!isCollapsed && (
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                )}
              </button>

              {/* User Menu Dropdown */}
              <AnimatePresence>
                {showUserMenu && !isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-0 right-0 mb-2 p-2 rounded-xl bg-slate-800 border border-white/10 shadow-xl"
                  >
                    <button
                      onClick={() => { router.push('/hub'); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white text-left"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span className="text-sm">Suite Selector</span>
                    </button>
                    <button
                      onClick={() => { router.push('/settings'); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white text-left"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm">Settings</span>
                    </button>

                    <div className="my-1 border-t border-white/10" />
                    <button
                      onClick={handleLogoutClick}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 text-slate-300 hover:text-red-400 text-left"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span className="text-sm">Logout</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </LayoutGroup>
      </motion.aside>

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
      />
    </>
  );
}
