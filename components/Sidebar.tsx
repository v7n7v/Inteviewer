'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { authHelpers } from '@/lib/supabase';
import { useStore } from '@/lib/store';

interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  description: string;
  path: string;
  badge?: string;
}

const navigationSections = [
  {
    title: 'Interview Suite',
    items: [
      { id: 'detective', label: 'Detective', icon: '🔍', description: 'CV Intelligence', path: '/dashboard/detective' },
      { id: 'copilot', label: 'Co-Pilot', icon: '🎙️', description: 'Live Interview', path: '/dashboard/copilot' },
      { id: 'calibration', label: 'Calibration', icon: '⚖️', description: 'Hybrid Grading', path: '/dashboard/calibration' },
      { id: 'analytics', label: 'Analytics', icon: '📊', description: 'Insights Hub', path: '/dashboard/analytics' },
    ],
  },
  {
    title: 'Talent Suite',
    items: [
      { id: 'resume', label: 'Resume Builder', icon: '📄', description: 'Liquid Resume', path: '/suite/resume', badge: 'New' },
      { id: 'jd-generator', label: 'JD Generator', icon: '💼', description: 'Persona-JD Engine', path: '/suite/jd-generator' },
      { id: 'shadow', label: 'Practice', icon: '🎭', description: 'Shadow Interviewer', path: '/suite/shadow-interview', badge: 'New' },
      { id: 'oracle', label: 'Market Oracle', icon: '🔮', description: 'Career Intelligence', path: '/suite/market-oracle', badge: 'New' },
    ],
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser } = useStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleNavigation = (path: string) => {
    router.push(path);
    if (onNavigate) onNavigate();
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await authHelpers.signOut();
      setUser(null);
      router.push('/');
    }
  };

  const isActive = (path: string) => {
    if (path === '/dashboard/detective' && (pathname === '/dashboard' || pathname === '/')) return true;
    return pathname?.startsWith(path);
  };

  return (
    <motion.aside
      layout
      initial={false}
      animate={{ width: isCollapsed ? 80 : 260 }}
      transition={{
        type: 'tween',
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1]
      }}
      className="fixed left-0 top-0 z-50 glass-card border-r border-white/10 overflow-hidden"
      style={{
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        height: 'fit-content',
        maxHeight: '100vh',
      }}
    >
      <LayoutGroup>
        <div className="flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center justify-between">
              <motion.div
                layout
                className="flex items-center gap-2.5 overflow-hidden"
                style={{ width: isCollapsed ? 0 : 'auto', opacity: isCollapsed ? 0 : 1 }}
                transition={{ duration: 0.15 }}
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center pulse-glow flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-bold text-gradient whitespace-nowrap">TalentConsulting.io</h1>
                  <p className="text-[10px] text-slate-500 whitespace-nowrap">Talent Platform</p>
                </div>
              </motion.div>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="p-3 space-y-3">
            {navigationSections.map((section, sectionIndex) => {
              // Get initials from section title (e.g., "Interview Suite" -> "IS", "Talent Suite" -> "TS")
              const getInitials = (title: string) => {
                return title
                  .split(' ')
                  .map(word => word[0])
                  .join('')
                  .toUpperCase();
              };

              return (
                <div key={section.title}>
                  <motion.h3
                    layout
                    className="px-3 mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-center"
                    transition={{ duration: 0.15 }}
                  >
                    <AnimatePresence mode="wait">
                      {isCollapsed ? (
                        <motion.span
                          key="initials"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                          className="text-xs font-semibold text-slate-500"
                        >
                          {getInitials(section.title)}
                        </motion.span>
                      ) : (
                        <motion.span
                          key="full"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                          className="text-xs font-semibold text-slate-500 uppercase tracking-wider"
                        >
                          {section.title}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.h3>
                  <div className="space-y-1">
                    {section.items.map((item, itemIndex) => (
                      <div key={item.id}>
                        <button
                          onClick={() => handleNavigation(item.path)}
                          disabled={item.badge === 'Soon'}
                          className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150
                          ${isActive(item.path)
                              ? 'bg-cyber-cyan/10 border border-cyber-cyan/30 text-white'
                              : item.badge === 'Soon'
                                ? 'text-slate-600 cursor-not-allowed'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }
                        `}
                          title={isCollapsed ? item.label : ''}
                        >
                          <span className="text-xl flex-shrink-0">{item.icon}</span>
                          <AnimatePresence mode="wait">
                            {!isCollapsed && (
                              <motion.div
                                key="content"
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={{ duration: 0.15 }}
                                className="flex-1 text-left overflow-hidden"
                              >
                                <div className="font-semibold text-sm flex items-center gap-2 whitespace-nowrap">
                                  {item.label}
                                  {item.badge && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.badge === 'New' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                                      }`}>
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 whitespace-nowrap">{item.description}</div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          {!isCollapsed && isActive(item.path) && (
                            <motion.div
                              layoutId="active-indicator"
                              className="w-1 h-7 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500 flex-shrink-0"
                              transition={{ type: 'tween', duration: 0.2 }}
                            />
                          )}
                        </button>

                        {/* User Menu - Show after Market Oracle */}
                        {section.title === 'Talent Suite' && item.id === 'oracle' && (
                          <>
                            {/* Divider */}
                            <AnimatePresence>
                              {!isCollapsed && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="my-2 mx-3 border-t border-white/10 overflow-hidden"
                                />
                              )}
                            </AnimatePresence>

                            {/* User Account - Always visible, shows initials when collapsed */}
                            <div className="relative">
                              <button
                                onClick={() => !isCollapsed && setShowUserMenu(!showUserMenu)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors duration-150 ${isCollapsed ? 'justify-center' : ''
                                  }`}
                                title={isCollapsed ? user?.email?.split('@')[0] : ''}
                              >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                  {user?.email?.[0].toUpperCase()}
                                </div>
                                <AnimatePresence mode="wait">
                                  {!isCollapsed && (
                                    <motion.div
                                      key="user-content"
                                      initial={{ opacity: 0, width: 0 }}
                                      animate={{ opacity: 1, width: 'auto' }}
                                      exit={{ opacity: 0, width: 0 }}
                                      transition={{ duration: 0.15 }}
                                      className="flex-1 text-left overflow-hidden"
                                    >
                                      <div className="text-sm font-semibold text-white truncate">
                                        {user?.email?.split('@')[0]}
                                      </div>
                                      <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                                <AnimatePresence>
                                  {!isCollapsed && (
                                    <motion.svg
                                      initial={{ opacity: 0, width: 0 }}
                                      animate={{ opacity: 1, width: 'auto' }}
                                      exit={{ opacity: 0, width: 0 }}
                                      transition={{ duration: 0.15 }}
                                      className="w-4 h-4 text-slate-400 flex-shrink-0"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </motion.svg>
                                  )}
                                </AnimatePresence>
                              </button>

                              {/* User Dropdown */}
                              <AnimatePresence>
                                {showUserMenu && !isCollapsed && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute top-full left-0 right-0 mt-2 glass-card p-2 border border-white/10 rounded-xl z-10"
                                  >
                                    <button
                                      onClick={() => router.push('/settings')}
                                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors text-left"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      <span className="text-sm">Settings</span>
                                    </button>
                                    <button
                                      onClick={handleLogout}
                                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 text-slate-300 hover:text-red-400 transition-colors text-left"
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
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </LayoutGroup>
    </motion.aside>
  );
}
