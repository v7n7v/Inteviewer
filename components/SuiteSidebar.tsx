'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authHelpers } from '@/lib/firebase';
import { useStore } from '@/lib/store';
import { useTheme } from '@/components/ThemeProvider';
import LogoutModal from './modals/LogoutModal';
import AuthModal from './modals/AuthModal';
import { useUserTier } from '@/hooks/use-user-tier';
import UsageCounter from '@/components/UsageCounter';

// Dynamic job count hook for sidebar badge
function useJobCount() {
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    const read = () => {
      const c = localStorage.getItem('talent-job-curated-count');
      if (c) setCount(parseInt(c) || 0);
    };
    read();
    window.addEventListener('job-count-updated', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('job-count-updated', read);
      window.removeEventListener('storage', read);
    };
  }, []);
  return count;
}

interface NavigationItem {
  id: string;
  label: string;
  description: string;
  path: string;
  badge?: string;
  iconName: string;
  color: { iconColor: string };
}

interface NavigationGroup {
  label: string;
  icon: string;
  items: NavigationItem[];
}

const navGroups: NavigationGroup[] = [
  // ─── Pinned: Sona Agent ───
  {
    label: '',
    icon: '',
    items: [
      {
        id: 'agent',
        label: 'Sona Agent',
        description: 'Career Intelligence AI',
        path: '/suite/agent',
        badge: 'MAX',
        iconName: 'auto_awesome',
        color: { iconColor: '#f43f5e' },
      },
    ],
  },
  // ─── Phase 1: Build your materials ───
  {
    label: 'Build',
    icon: 'construction',
    items: [
      {
        id: 'resume',
        label: 'Resume Studio',
        description: 'Resume Builder + AI Morph',
        path: '/suite/resume',
        iconName: 'description',
        color: { iconColor: '#f59e0b' },
      },
      {
        id: 'cover-letter',
        label: 'Cover Letter',
        description: 'AI-Tailored Letters',
        path: '/suite/cover-letter',
        badge: 'PRO',
        iconName: 'edit_document',
        color: { iconColor: '#f43f5e' },
      },
      {
        id: 'ats-analyzer',
        label: 'ATS Analyzer',
        description: 'Preview + Match Score',
        path: '/suite/ats-analyzer',
        iconName: 'scanner',
        color: { iconColor: '#06b6d4' },
      },
      {
        id: 'linkedin',
        label: 'LinkedIn',
        description: 'Profile Optimizer',
        path: '/suite/linkedin',
        badge: 'PRO',
        iconName: 'badge',
        color: { iconColor: '#3b82f6' },
      },
      {
        id: 'writing-tools',
        label: 'AI Humanizer',
        description: 'Detect & Humanize AI Text',
        path: '/suite/writing-tools',
        badge: 'PRO',
        iconName: 'ink_pen',
        color: { iconColor: '#f43f5e' },
      },
    ],
  },
  // ─── Phase 2: Find & track jobs ───
  {
    label: 'Search & Apply',
    icon: 'work',
    items: [
      {
        id: 'job-search',
        label: 'Job Search',
        description: 'AI Opportunity Radar',
        path: '/suite/job-search',
        badge: 'PRO',
        iconName: 'radar',
        color: { iconColor: '#06b6d4' },
      },
      {
        id: 'oracle',
        label: 'Market Oracle',
        description: 'JD Decoder + Fit Score',
        path: '/suite/market-oracle',
        iconName: 'troubleshoot',
        color: { iconColor: '#a855f7' },
      },
      {
        id: 'applications',
        label: 'Applications',
        description: 'Pipeline Tracker',
        path: '/suite/applications',
        iconName: 'work',
        color: { iconColor: '#22c55e' },
      },
      {
        id: 'network',
        label: 'Network CRM',
        description: 'Contact Tracker',
        path: '/suite/network',
        badge: 'PRO',
        iconName: 'contacts',
        color: { iconColor: '#8b5cf6' },
      },
    ],
  },
  // ─── Phase 3: Prepare for interviews ───
  {
    label: 'Prepare',
    icon: 'school',
    items: [
      {
        id: 'flashcards',
        label: 'Interview Sim',
        description: 'AI Mock Interviews + Debrief',
        path: '/suite/flashcards',
        iconName: 'chat',
        color: { iconColor: '#3b82f6' },
      },
      {
        id: 'stories',
        label: 'Story Bank',
        description: 'STAR Stories + Answer RAG',
        path: '/suite/agent/stories',
        iconName: 'auto_stories',
        color: { iconColor: '#10b981' },
      },
      {
        id: 'skill-bridge',
        label: 'Skill Bridge',
        description: 'Gap-to-Ready Paths',
        path: '/suite/skill-bridge',
        badge: 'PRO',
        iconName: 'route',
        color: { iconColor: '#10b981' },
      },
      {
        id: 'vault',
        label: 'Study Vault',
        description: 'Saved Practice Notes',
        path: '/suite/vault',
        iconName: 'folder_open',
        color: { iconColor: '#f97316' },
      },
    ],
  },
  // ─── Phase 4: Close & grow ───
  {
    label: 'Grow',
    icon: 'trending_up',
    items: [
      {
        id: 'negotiate',
        label: 'Salary Coach',
        description: 'Negotiation Strategy',
        path: '/suite/negotiate',
        badge: 'PRO',
        iconName: 'payments',
        color: { iconColor: '#10b981' },
      },
      {
        id: 'intelligence',
        label: 'Career Intelligence',
        description: 'Health Score + Pulse + Insights',
        path: '/suite/intelligence',
        iconName: 'neurology',
        color: { iconColor: '#8b5cf6' },
      },
    ],
  },
];

function ThemeMenu({ isCollapsed }: { isCollapsed: boolean }) {
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const options: { value: 'light' | 'dark' | 'system'; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <span className="material-symbols-rounded text-[16px]">light_mode</span> },
    { value: 'dark', label: 'Dark', icon: <span className="material-symbols-rounded text-[16px]">dark_mode</span> },
    { value: 'system', label: 'System', icon: <span className="material-symbols-rounded text-[16px]">desktop_windows</span> },
  ];

  return (
    <div ref={ref} className="relative group/theme">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors duration-100 text-[var(--sidebar-text)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] ${isCollapsed ? 'justify-center' : ''}`}
        title={isCollapsed ? 'Theme' : ''}
      >
        <span
          className="material-symbols-rounded flex-shrink-0 text-[18px] w-6 h-6 flex items-center justify-center rounded-md"
          style={{
            backgroundColor: 'var(--tag-purple-bg)',
            color: 'var(--tag-purple-text)'
          }}
        >
          palette
        </span>
        {!isCollapsed && (
          <>
            <span className="flex-1 text-left">Theme</span>
            <span
              className="material-symbols-rounded text-[16px] opacity-50 transition-transform duration-200"
              style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
              chevron_right
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          className="absolute left-[calc(100%+8px)] bottom-0 w-44 rounded-[10px] border shadow-xl z-[100] py-1"
          style={{
            background: 'var(--bg-primary)',
            borderColor: 'var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          {options.map((opt) => {
            const isActive = mode === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { setMode(opt.value); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-[14px] leading-[20px] transition-colors duration-100 hover:bg-[var(--bg-hover)]"
                style={{
                  color: 'var(--text-primary)',
                  backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                }}
              >
                <span
                  className="flex items-center justify-center w-[16px] h-[16px] rounded-full border-[1.5px] flex-shrink-0"
                  style={{ borderColor: 'currentColor' }}
                >
                  {isActive && (
                    <span className="w-[8px] h-[8px] rounded-full bg-current" />
                  )}
                </span>
                <span className="flex-shrink-0 opacity-70">{opt.icon}</span>
                <span className="flex-1 text-left">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SuiteSidebarProps {
  onNavigate?: () => void;
}

export default function SuiteSidebar({ onNavigate }: SuiteSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser } = useStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { tier, isPro } = useUserTier();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState<'login' | 'signup' | null>(null);
  const jobCount = useJobCount();

  // Collapsible section state — start with all open
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach(g => { if (g.label) initial[g.label] = true; });
    return initial;
  });

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // Auto-expand group containing the active page
  useEffect(() => {
    for (const group of navGroups) {
      if (group.label && group.items.some(item => pathname?.startsWith(item.path))) {
        setExpandedGroups(prev => prev[group.label] ? prev : { ...prev, [group.label]: true });
      }
    }
  }, [pathname]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const handleNav = (path: string) => {
    router.push(path);
    onNavigate?.();
  };

  const confirmLogout = async () => {
    await authHelpers.signOut();
    setUser(null);
    router.push('/');
    setShowLogoutModal(false);
  };

  const isActive = (path: string) => pathname?.startsWith(path);
  const sidebarWidth = isCollapsed ? 56 : 250;

  return (
    <>
      {/* Mobile toggle */}
      {isMobile && (
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="fixed top-3 left-3 z-[60] p-2 rounded-lg border border-[var(--border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] hover:text-[var(--text-primary)] transition-colors duration-100"
        >
          {isMobileOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          )}
        </button>
      )}

      {/* Mobile overlay */}
      {isMobile && isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/50 z-40"
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: isMobile ? 250 : sidebarWidth,
          transform: isMobile ? (isMobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
        }}
        className="fixed left-0 top-0 h-screen z-50 flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--border)] transition-all duration-200 ease-out"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 h-[52px] border-b border-[var(--border-subtle)]">
          {!isCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-[var(--text-primary)] truncate">Talent Studio</span>
              <span className="material-symbols-rounded text-[16px] text-[var(--text-muted)]">chevron_right</span>
            </div>
          )}
          {!isMobile && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--sidebar-text)] hover:text-[var(--text-primary)] transition-colors duration-100 flex-shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none' }}>
                <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Dashboard link */}
        <div className="px-2 pt-2">
          <button
            onClick={() => handleNav('/suite')}
            className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors duration-100 ${
              pathname === '/suite'
                ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                : 'text-[var(--sidebar-text)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            } ${isCollapsed ? 'justify-center' : ''}`}
            title="Dashboard"
          >
            <span
              className="material-symbols-rounded flex-shrink-0 text-[18px] w-6 h-6 flex items-center justify-center rounded-md transition-colors"
              style={pathname === '/suite' ? {
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981'
              } : {}}
            >home</span>
            {!isCollapsed && <span>Dashboard</span>}
          </button>
        </div>

        {/* Divider */}
        <div className="mx-3 my-2 h-px bg-[var(--border-subtle)]" />

        {/* Navigation — grouped with collapsible sections */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {navGroups.map((group, gi) => {
            const isExpanded = !group.label || expandedGroups[group.label] !== false;
            const hasActiveChild = group.items.some(item => isActive(item.path));

            return (
              <div key={gi}>
                {/* Section header — clickable dropdown toggle */}
                {group.label && !isCollapsed && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center gap-2 px-2 pt-2.5 pb-1 group/header hover:opacity-100 transition-opacity"
                  >
                    <span
                      className="material-symbols-rounded text-[14px] text-[var(--text-muted)] transition-transform duration-200"
                      style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    >
                      chevron_right
                    </span>
                    <span className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex-1 text-left">
                      {group.label}
                    </span>
                    {!isExpanded && hasActiveChild && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
                    )}
                  </button>
                )}
                {group.label && isCollapsed && (
                  <div className="mx-auto my-2 w-4 h-px bg-[var(--border-subtle)]" />
                )}

                {/* Items — collapsible */}
                {(isExpanded || isCollapsed) && (
                  <div>
                    {group.items.map((item) => {
                      const active = isActive(item.path);
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNav(item.path)}
                          className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors duration-100 text-[var(--sidebar-text)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] ${
                            isCollapsed ? 'justify-center' : ''
                          } ${active ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : ''}`}
                          title={isCollapsed ? item.label : item.description}
                        >
                          <span
                            className="material-symbols-rounded flex-shrink-0 text-[18px] w-6 h-6 flex items-center justify-center rounded-md flex-none"
                            style={{ color: item.color.iconColor }}
                          >
                            {item.iconName}
                          </span>

                          {!isCollapsed && (
                            <span className="flex-1 text-left truncate font-[450]">{item.label}</span>
                          )}

                          {!isCollapsed && item.badge && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              item.badge === 'PRO'
                                ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                                : item.badge === 'MAX'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                            }`}>
                              {item.badge}
                            </span>
                          )}
                          {!isCollapsed && item.id === 'job-search' && jobCount > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-cyan-500/15 text-cyan-500 border border-cyan-500/20 tabular-nums">
                              {jobCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        </nav>

        {/* Bottom section */}
        <div className="border-t border-[var(--border-subtle)] px-2 py-1.5">
          {/* Usage counter — free users only */}
          {!isPro && !isCollapsed && (
            <UsageCounter compact />
          )}
          {/* Upgrade CTA — free users only */}
          {!isPro && !isCollapsed && (
            <button
              onClick={() => handleNav('/suite/upgrade')}
              className="w-full mb-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 justify-center transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 2px 12px rgba(16,185,129,0.25)' }}
            >
              <span className="material-symbols-rounded text-[16px]">bolt</span>
              Upgrade to Pro · $9.99/mo
            </button>
          )}
          {!isPro && isCollapsed && (
            <button
              onClick={() => handleNav('/suite/upgrade')}
              title="Upgrade to Pro"
              className="w-full flex justify-center py-2 rounded-xl text-emerald-500 hover:bg-emerald-500/10 transition-colors"
            >
              <span className="material-symbols-rounded text-[20px]">bolt</span>
            </button>
          )}
          {/* Admin (master only) */}
          {user?.email && ['alula2006@gmail.com'].includes(user.email.toLowerCase()) && (
            <button
              onClick={() => handleNav('/suite/admin')}
              className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors duration-100 ${
                isActive('/suite/admin') ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--sidebar-text)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              } ${isCollapsed ? 'justify-center' : ''}`}
            >
              <span className="material-symbols-rounded flex-shrink-0 text-[20px]" style={{ color: '#fdd663' }}>shield</span>
              {!isCollapsed && <span>Admin</span>}
            </button>
          )}

          {/* Gallery */}
          <button
            onClick={() => handleNav('/suite/gallery')}
            className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors duration-100 text-[var(--sidebar-text)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] ${isCollapsed ? 'justify-center' : ''} ${isActive('/suite/gallery') ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : ''}`}
            title={isCollapsed ? 'Gallery' : 'Tools Gallery'}
          >
            <span className="material-symbols-rounded flex-shrink-0 text-[20px]" style={{ color: '#8b5cf6' }}>widgets</span>
            {!isCollapsed && <span>Gallery</span>}
          </button>

          {/* Theme — AI Studio flyout */}
          <ThemeMenu isCollapsed={isCollapsed} />

          {/* Help */}
          <button
            onClick={() => handleNav('/suite/help')}
            className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors duration-100 text-[var(--sidebar-text)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] ${isCollapsed ? 'justify-center' : ''}`}
          >
            <span className="material-symbols-rounded flex-shrink-0 text-[20px]" style={{ color: '#06b6d4' }}>help</span>
            {!isCollapsed && <span>Help</span>}
          </button>

          {/* Settings */}
          <button
            onClick={() => handleNav('/suite/settings')}
            className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors duration-100 text-[var(--sidebar-text)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] ${isCollapsed ? 'justify-center' : ''}`}
          >
            <span className="material-symbols-rounded flex-shrink-0 text-[20px]" style={{ color: '#94a3b8' }}>settings</span>
            {!isCollapsed && <span>Settings</span>}
          </button>
        </div>

        {/* User section */}
        <div className="border-t border-[var(--border-subtle)] px-2 py-2">
          {user ? (
            /* Authenticated — show profile */
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-[var(--bg-hover)] border border-[var(--border)] flex items-center justify-center text-xs font-medium text-[var(--text-secondary)] flex-shrink-0">
                {user.email?.[0].toUpperCase() || '?'}
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-primary)] truncate flex items-center gap-1.5">
                    {user.displayName || user.email?.split('@')[0] || 'User'}
                    {isPro && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        (tier === 'god' || tier === 'studio') ? 'bg-[rgba(139,92,246,0.1)] text-violet-400' : 'bg-[rgba(129,201,149,0.1)] text-[var(--success)]'
                      }`}>
                        {(tier === 'god' || tier === 'studio') ? 'MAX' : 'PRO'}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] truncate">{user.email}</p>
                </div>
              )}
              {!isCollapsed && (
                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-red-500 transition-colors duration-100"
                  title="Sign out"
                >
                  <span className="material-symbols-rounded text-[20px] block" style={{ color: '#ef4444' }}>logout</span>
                </button>
              )}
            </div>
          ) : (
            /* Anonymous — show Sign In */
            <button
              onClick={() => setShowAuthModal('login')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-100 hover:bg-[var(--bg-hover)] ${isCollapsed ? 'justify-center' : ''}`}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)' }}
              >
                <span className="material-symbols-rounded text-[16px]" style={{ color: '#06b6d4' }}>login</span>
              </div>
              {!isCollapsed && (
                <div className="text-left">
                  <p className="text-xs font-medium text-[var(--text-primary)] leading-tight">Sign In</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Create a free account</p>
                </div>
              )}
            </button>
          )}
        </div>
      </aside>

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
      />

      {showAuthModal && (
        <AuthModal
          mode={showAuthModal}
          onClose={() => setShowAuthModal(null)}
          onSwitchMode={() => setShowAuthModal(showAuthModal === 'login' ? 'signup' : 'login')}
        />
      )}
    </>
  );
}
