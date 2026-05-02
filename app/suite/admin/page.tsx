'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/Toast';
import Link from 'next/link';

interface UserRecord {
  uid: string;
  email: string;
  displayName?: string;
  createdAt: string;
  lastSignIn: string;
  disabled: boolean;
  tier: string;
}

export default function AdminDashboard() {
  const { user } = useStore();
  const router = useRouter();
  const MASTER_EMAILS = ['alula2006@gmail.com'];
  const isAdmin = user?.email && MASTER_EMAILS.includes(user.email.toLowerCase());

  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'controls' | 'costs'>('overview');

  // Auth fetch helper
  const authFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = await (user as any)?.getIdToken?.();
    if (!token) throw new Error('Not authenticated');
    return fetch(url, { ...options, headers: { ...options?.headers, Authorization: `Bearer ${token}` } });
  }, [user]);

  // ── OVERVIEW STATE ──
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── USERS STATE ──
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tierFilter, setTierFilter] = useState('all');

  // ── CONTROLS STATE ──
  const [promoActive, setPromoActive] = useState(false);
  const [promoHeadline, setPromoHeadline] = useState('🚀 Limited Time — 50% off Pro for 3 months!');
  const [promoCode, setPromoCode] = useState('LAUNCH50');
  const [promoCta, setPromoCta] = useState('Claim Offer');
  const [promoLoading, setPromoLoading] = useState(false);
  
  const [settings, setSettings] = useState<any>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  // ── COSTS STATE ──
  const [costs, setCosts] = useState<any>(null);
  const [costsLoading, setCostsLoading] = useState(false);

  // ── UI STATE ──
  const [actionDropdown, setActionDropdown] = useState<string | null>(null);
  const [subFormPlan, setSubFormPlan] = useState<'free'|'pro'|'studio'>('free');
  const [subFormMonths, setSubFormMonths] = useState<string>('');

  // ── DATA FETCHING ──

  // Stats (Overview)
  useEffect(() => {
    if (!isAdmin) return;
    setStatsLoading(true);
    authFetch('/api/admin/stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => showToast('Failed to load stats', 'cancel'))
      .finally(() => setStatsLoading(false));
  }, [isAdmin, authFetch]);

  // Load Users Helper
  const loadUsers = useCallback(async (searchQuery = '', token: string | null = null) => {
    setUsersLoading(true);
    try {
      let url = `/api/admin/users?limit=25`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      if (token) url += `&pageToken=${encodeURIComponent(token)}`;

      const res = await authFetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      
      if (token) {
        setUsersList(prev => [...prev, ...data.users]);
      } else {
        setUsersList(data.users);
      }
      setNextPageToken(data.nextPageToken || null);
      setUsersLoaded(true);
    } catch (err: any) {
      showToast(err.message, 'cancel');
    }
    setUsersLoading(false);
  }, [authFetch]);

  // Users Tab
  useEffect(() => {
    if (activeTab === 'users' && !usersLoaded && isAdmin) {
      loadUsers();
    }
  }, [activeTab, usersLoaded, isAdmin, loadUsers]);

  // Controls Tab (Settings + Promo)
  useEffect(() => {
    if (activeTab !== 'controls' || !isAdmin) return;
    // Load promo
    authFetch('/api/admin/promo').then(r => r.json()).then(data => {
      setPromoActive(data.active || false);
      if (data.headline) setPromoHeadline(data.headline);
      if (data.code) setPromoCode(data.code);
      if (data.ctaText) setPromoCta(data.ctaText);
    }).catch(() => {});
    // Load settings
    authFetch('/api/admin/settings').then(r => r.json()).then(data => {
      setSettings(data);
      if (data.maintenance !== undefined) setMaintenance(data.maintenance);
      if (data.maintenanceMessage) setMaintenanceMessage(data.maintenanceMessage);
    }).catch(() => {});
  }, [activeTab, isAdmin, authFetch]);

  // Costs Tab
  useEffect(() => {
    if (activeTab === 'costs' && !costs && isAdmin) {
      setCostsLoading(true);
      authFetch('/api/admin/costs')
        .then(r => r.json())
        .then(data => setCosts(data))
        .catch(() => showToast('Failed to load costs', 'cancel'))
        .finally(() => setCostsLoading(false));
    }
  }, [activeTab, costs, isAdmin, authFetch]);

  // ── ACTION HANDLERS ──

  const handleAction = async (uid: string, email: string, action: string) => {
    setActionDropdown(null);
    setActionLoading(`${uid}:${action}`);
    try {
      const res = await authFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, email, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message, 'check_circle');
      loadUsers(search);
    } catch (err: any) { 
      showToast(err.message || 'Action failed', 'cancel'); 
    }
    setActionLoading(null);
  };

  const handleUpdateSubscription = async (uid: string, email: string) => {
    if (!subFormPlan) return;
    setActionLoading(`${uid}:update_sub`);
    try {
      const payload: any = { uid, email, action: 'update_subscription', plan: subFormPlan };
      if (subFormPlan !== 'free' && subFormMonths.trim() !== '') {
        const m = parseInt(subFormMonths, 10);
        if (!isNaN(m) && m > 0) {
          payload.months = m;
        }
      }
      
      const res = await authFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message, 'check_circle');
      
      // Refresh current user
      await loadUserDetail(uid, true);
      setSubFormMonths('');
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'cancel');
    }
    setActionLoading(null);
  };

  const loadUserDetail = async (uid: string, forceRefresh = false) => {
    if (expandedUser === uid && !forceRefresh) { setExpandedUser(null); return; }
    setExpandedUser(uid);
    setDetailLoading(true);
    try {
      const res = await authFetch(`/api/admin/user-detail?uid=${uid}`);
      const data = await res.json();
      setUserDetail(data);
    } catch { showToast('Failed to load user detail', 'cancel'); }
    setDetailLoading(false);
  };

  const togglePromo = async () => {
    setPromoLoading(true);
    try {
      const payload = { active: !promoActive, headline: promoHeadline, code: promoCode, ctaText: promoCta };
      const res = await authFetch('/api/admin/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      setPromoActive(!promoActive);
      showToast(promoActive ? 'Promo deactivated' : 'Promo activated', 'check_circle');
    } catch {
      showToast('Failed to update promo', 'cancel');
    }
    setPromoLoading(false);
  };

  const saveSettings = async (updates: any) => {
    setSettingsLoading(true);
    try {
      const res = await authFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed');
      showToast('Settings saved', 'check_circle');
      setSettings((prev: any) => ({ ...prev, ...updates }));
    } catch { 
      showToast('Failed to save settings', 'cancel'); 
    }
    setSettingsLoading(false);
  };

  const toggleFeatureFlag = (key: string) => {
    if (!settings?.features) return;
    const newFeatures = { ...settings.features, [key]: !settings.features[key] };
    saveSettings({ features: newFeatures });
  };

  const saveMaintenance = () => {
    saveSettings({ maintenance, maintenanceMessage });
  };

  // ── RENDER HELPERS ──
  
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <span className="material-symbols-rounded text-6xl text-[var(--tag-rose-text)]/50 mb-4">block</span>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Access Denied</h1>
        <p className="text-[var(--text-muted)] mb-6">You must be a platform administrator to view this page.</p>
        <Link href="/suite" className="px-6 py-2.5 rounded-xl bg-[var(--tag-green-bg)] border border-[var(--tag-green-text)]/30 text-[var(--tag-green-text)] font-medium hover:bg-[var(--tag-green-bg)] transition-colors">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'dashboard' },
    { key: 'users', label: 'Users', icon: 'group' },
    { key: 'controls', label: 'Controls', icon: 'tune' },
    { key: 'costs', label: 'Financials', icon: 'account_balance' },
  ] as const;

  const usageItems = [
    { label: 'Morphs', key: 'morphs', icon: 'transform' },
    { label: 'Gauntlets', key: 'gauntlets', icon: 'quiz' },
    { label: 'Flashcards', key: 'flashcards', icon: 'school' },
    { label: 'Cover Letters', key: 'coverLetters', icon: 'draft' },
    { label: 'Resume Checks', key: 'resumeChecks', icon: 'fact_check' },
    { label: 'JD Generations', key: 'jdGenerations', icon: 'work' },
    { label: 'Writing Tools', key: 'writingTools', icon: 'edit_note' },
    { label: 'Gallery', key: 'galleryTools', icon: 'grid_view' },
  ];

  const featureFlagsList = [
    { key: 'liveVoice', label: 'Live Voice Interview', icon: 'mic' },
    { key: 'humanizer', label: 'AI Humanizer', icon: 'edit_note' },
    { key: 'marketOracle', label: 'Market Oracle', icon: 'analytics' },
    { key: 'jobSearch', label: 'Job Search', icon: 'work' },
    { key: 'skillBridge', label: 'Skill Bridge', icon: 'school' },
  ];

  const tierFilters = ['all', 'admin', 'max', 'pro', 'free', 'disabled'];
  const filteredUsers = usersList.filter(u => {
    if (tierFilter === 'all') return true;
    if (tierFilter === 'disabled') return u.disabled;
    if (tierFilter === 'admin') return MASTER_EMAILS.includes(u.email.toLowerCase());
    return u.tier === tierFilter;
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* ── HEADER ── */}
      <div className="glass-card rounded-3xl p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--tag-green-bg)] rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[var(--tag-green-bg)] border border-[var(--tag-green-text)]/30 flex items-center justify-center shrink-0">
              <span className="material-symbols-rounded text-3xl text-[var(--tag-green-text)]">admin_panel_settings</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Admin Command Center</h1>
              <p className="text-[var(--text-muted)] text-sm">Platform operations & intelligence</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === t.key
                    ? 'bg-[var(--tag-green-bg)] text-[var(--tag-green-text)] border border-[var(--tag-green-text)]/30'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-transparent'
                }`}
              >
                <span className="material-symbols-rounded text-[18px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {/* ================= OVERVIEW TAB ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {statsLoading ? (
                <div className="flex justify-center py-12"><div className="scanning-loader" /></div>
              ) : !stats ? (
                <div className="text-center py-8 text-[var(--text-muted)]">Failed to load statistics.</div>
              ) : (
                <>
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Users', value: stats.totalUsers, icon: 'group' },
                      { label: 'MRR', value: `$${stats.mrr}`, icon: 'payments', highlight: true },
                      { label: 'Active (7d)', value: stats.activeWeek, icon: 'trending_up' },
                      { label: 'Active Today', value: stats.activeToday, icon: 'bolt' },
                    ].map((kpi, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--tag-green-bg)' }}>
                            <span className="material-symbols-rounded text-[18px]" style={{ color: 'var(--tag-green-text)' }}>{kpi.icon}</span>
                          </div>
                          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{kpi.label}</span>
                        </div>
                        <div className={`text-3xl font-bold ${kpi.highlight ? 'text-[var(--tag-green-text)]' : 'text-[var(--text-primary)]'}`}>{kpi.value}</div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Tier Distribution */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-6">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Tier Distribution</h3>
                      <div className="flex h-3 rounded-full overflow-hidden mb-4">
                        <div style={{ width: `${(stats.tierCounts.free / Math.max(stats.totalUsers, 1)) * 100}%` }} className="bg-slate-500" />
                        <div style={{ width: `${(stats.tierCounts.pro / Math.max(stats.totalUsers, 1)) * 100}%` }} className="bg-emerald-500" />
                        <div style={{ width: `${(stats.tierCounts.studio / Math.max(stats.totalUsers, 1)) * 100}%` }} className="bg-blue-500" />
                        <div style={{ width: `${(stats.tierCounts.disabled / Math.max(stats.totalUsers, 1)) * 100}%` }} className="bg-red-500" />
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-slate-500"/> <span className="text-[var(--text-muted)]">Free: {stats.tierCounts.free}</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> <span className="text-[var(--text-muted)]">Pro: {stats.tierCounts.pro}</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"/> <span className="text-[var(--text-muted)]">Max: {stats.tierCounts.studio}</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"/> <span className="text-[var(--text-muted)]">Disabled: {stats.tierCounts.disabled}</span></div>
                      </div>
                    </motion.div>

                    {/* Recent Signups */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="glass-card rounded-2xl p-6">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Recent Signups</h3>
                      <div className="space-y-1">
                        {stats.recentSignups?.slice(0, 4).map((u: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 py-2 border-b border-[var(--border-subtle)] last:border-0">
                            <div className="w-8 h-8 rounded-full bg-[var(--tag-green-bg)] text-[var(--tag-green-text)] text-xs font-bold flex items-center justify-center shrink-0">
                              {(u.email || u.displayName || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[var(--text-primary)] truncate">{u.email || u.displayName}</p>
                              <p className="text-xs text-[var(--text-muted)]">{new Date(u.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              u.tier === 'studio' ? 'bg-[var(--tag-blue-bg)] border-blue-500/20 text-[var(--tag-blue-text)]' :
                              u.tier === 'pro' ? 'bg-[var(--tag-green-bg)] border-[var(--tag-green-text)]/30 text-[var(--tag-green-text)]' :
                              'bg-slate-500/10 border-slate-500/20 text-[var(--text-muted)]'
                            }`}>
                              {(u.tier === 'studio' || u.tier === 'god') ? 'MAX' : u.tier.toUpperCase()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </div>

                  {/* Feature Usage Heatmap */}
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Feature Usage Heatmap</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                      {Object.entries(stats.featureUsage || {})
                        .sort((a: any, b: any) => (b[1] || 0) - (a[1] || 0))
                        .map(([key, value]: any, i) => {
                          const max = Math.max(...Object.values(stats.featureUsage || {}) as number[], 1);
                          return (
                            <div key={key} className="flex items-center gap-3 py-2">
                              <span className="text-xs text-[var(--text-muted)] w-28 truncate capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <div className="flex-1 h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: 'var(--tag-green-text)', opacity: 0.6 }} />
                              </div>
                              <span className="text-xs font-mono text-[var(--text-muted)] w-10 text-right">{value || 0}</span>
                            </div>
                          );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          )}

          {/* ================= USERS TAB ================= */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Search Bar */}
              <div className="glass-card rounded-2xl p-5 flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <span className="material-symbols-rounded absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[20px]">search</span>
                  <input
                    type="text"
                    placeholder="Search by email, name, or UID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') loadUsers(search); }}
                    className="w-full bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-primary)] placeholder-slate-500 focus:border-[var(--tag-green-text)]/50 focus:ring-emerald-500/20 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none"
                  />
                </div>
                <button onClick={() => loadUsers(search)} className="px-5 py-2.5 rounded-xl bg-[var(--tag-green-bg)] border border-[var(--tag-green-text)]/30 text-[var(--tag-green-text)] text-sm font-medium hover:bg-emerald-500/25 transition-colors">
                  Search
                </button>
                <button onClick={() => { setSearch(''); loadUsers(''); }} className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center">
                  <span className="material-symbols-rounded text-[18px]">refresh</span>
                </button>
              </div>

              {/* Filters & Stats */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {tierFilters.map(t => (
                    <button
                      key={t}
                      onClick={() => setTierFilter(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                        tierFilter === t ? 'bg-[var(--tag-green-bg)] text-[var(--tag-green-text)] border border-[var(--tag-green-text)]/30' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {stats && (
                  <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] bg-[var(--bg-hover)] px-4 py-2 rounded-xl">
                    <span>Total: <strong className="text-[var(--text-primary)]">{stats.totalUsers}</strong></span>
                    <span className="w-px h-3 bg-[var(--bg-hover)]" />
                    <span>Max: <strong className="text-[var(--text-primary)]">{stats.tierCounts.studio}</strong></span>
                    <span className="w-px h-3 bg-[var(--bg-hover)]" />
                    <span>Pro: <strong className="text-[var(--text-primary)]">{stats.tierCounts.pro}</strong></span>
                  </div>
                )}
              </div>

              {/* User Table */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-[var(--bg-hover)] border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <div className="col-span-12 md:col-span-5">User</div>
                  <div className="col-span-6 md:col-span-2">Tier</div>
                  <div className="col-span-3 hidden md:block">Created</div>
                  <div className="col-span-2 text-right hidden md:block">Actions</div>
                </div>

                {usersLoading && usersList.length === 0 ? (
                  <div className="py-12 flex justify-center"><div className="scanning-loader" /></div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-12 text-center text-[var(--text-muted)] text-sm">No users found.</div>
                ) : (
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {filteredUsers.map(u => {
                      const isMaster = MASTER_EMAILS.includes(u.email?.toLowerCase() || '');
                      const isExpanded = expandedUser === u.uid;

                      return (
                        <div key={u.uid} className="flex flex-col">
                          {/* Row */}
                          <div 
                            onClick={() => loadUserDetail(u.uid)}
                            className={`grid grid-cols-12 gap-4 px-5 py-3.5 items-center cursor-pointer transition-colors ${u.disabled ? 'opacity-50' : ''} ${isExpanded ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-elevated)]'}`}
                          >
                            <div className="col-span-12 md:col-span-5 flex items-center gap-3 min-w-0">
                              <span className="material-symbols-rounded text-[18px] text-[var(--text-muted)] shrink-0">
                                {isExpanded ? 'expand_less' : 'expand_more'}
                              </span>
                              <div className="w-8 h-8 rounded-full bg-[var(--tag-green-bg)] text-[var(--tag-green-text)] text-xs font-bold flex items-center justify-center shrink-0">
                                {(u.email || u.displayName || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{u.email}</p>
                                <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">{u.uid}</p>
                              </div>
                            </div>
                            
                            <div className="col-span-6 md:col-span-2 flex items-center">
                              {isMaster ? (
                                <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold uppercase tracking-wider">Admin</span>
                              ) : u.tier === 'studio' ? (
                                <span className="px-2 py-0.5 rounded-md bg-[var(--tag-blue-bg)] text-[var(--tag-blue-text)] border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider">💎 Max</span>
                              ) : u.tier === 'pro' ? (
                                <span className="px-2 py-0.5 rounded-md bg-[var(--tag-green-bg)] text-[var(--tag-green-text)] border border-[var(--tag-green-text)]/30 text-[10px] font-bold uppercase tracking-wider">🟢 Pro</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-[var(--text-muted)] border border-slate-500/20 text-[10px] font-bold uppercase tracking-wider">○ Free</span>
                              )}
                            </div>

                            <div className="col-span-3 hidden md:block text-xs text-[var(--text-muted)]">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </div>

                            <div className="col-span-6 md:col-span-2 flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                              {!isMaster && (
                                <div className="relative">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionDropdown(actionDropdown === u.uid ? null : u.uid);
                                    }}
                                    className="w-8 h-8 rounded flex items-center justify-center bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
                                  >
                                    <span className="material-symbols-rounded text-[18px]">more_vert</span>
                                  </button>
                                  
                                  {/* Dropdown Menu */}
                                  {actionDropdown === u.uid && (
                                    <div className="absolute right-0 top-full mt-2 w-36 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden z-50">
                                      {u.tier === 'free' && (
                                        <button onClick={() => handleAction(u.uid, u.email, 'upgrade_pro')} className="w-full text-left px-4 py-2.5 text-xs text-[var(--tag-green-text)] hover:bg-[var(--bg-hover)] transition-colors">↑ Upgrade Pro</button>
                                      )}
                                      {u.tier === 'pro' && (
                                        <>
                                          <button onClick={() => handleAction(u.uid, u.email, 'downgrade_free')} className="w-full text-left px-4 py-2.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors">↓ Downgrade Free</button>
                                          <button onClick={() => handleAction(u.uid, u.email, 'upgrade_studio')} className="w-full text-left px-4 py-2.5 text-xs text-[var(--tag-blue-text)] hover:bg-[var(--bg-hover)] transition-colors">↑ Upgrade Max</button>
                                        </>
                                      )}
                                      {u.tier === 'studio' && (
                                        <button onClick={() => handleAction(u.uid, u.email, 'downgrade_pro')} className="w-full text-left px-4 py-2.5 text-xs text-[var(--tag-green-text)] hover:bg-[var(--bg-hover)] transition-colors">↓ Downgrade Pro</button>
                                      )}
                                      <button onClick={() => handleAction(u.uid, u.email, u.disabled ? 'enable' : 'disable')} className="w-full text-left px-4 py-2.5 text-xs text-[var(--tag-rose-text)] border-t border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
                                        {u.disabled ? 'Unlock Account' : 'Suspend Account'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Expanded Detail */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden bg-[var(--bg-surface)]"
                              >
                                <div className="p-5 border-t border-[var(--border-subtle)]">
                                  {detailLoading ? (
                                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] py-2"><div className="scanning-loader" style={{ width: 16, height: 16, borderWidth: 2 }} /> Fetching deep-dive...</div>
                                  ) : userDetail ? (
                                    <div className="space-y-5">
                                      {/* Usage Grid */}
                                      <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Lifetime Tool Usage</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                          {usageItems.map(item => (
                                            <div key={item.key} className="rounded-lg p-2.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <span className="material-symbols-rounded text-[14px] text-[var(--text-muted)]">{item.icon}</span>
                                                <span className="text-[10px] text-[var(--text-muted)]">{item.label}</span>
                                              </div>
                                              <span className="text-sm font-semibold text-[var(--text-primary)]">{userDetail.usage?.[item.key] || 0}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Sub & Resource Usage */}
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="rounded-xl p-3 bg-[var(--bg-elevated)]">
                                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Subscription</p>
                                          {userDetail.subscription ? (
                                            <div className="text-xs text-[var(--text-secondary)]">
                                              Plan: <strong className="text-[var(--tag-green-text)] capitalize">{userDetail.subscription.plan}</strong><br/>
                                              Status: {userDetail.subscription.status}<br/>
                                              {userDetail.subscription.grantedBy && <>Granted by: <span className="font-mono text-[10px]">{userDetail.subscription.grantedBy}</span><br/></>}
                                              {userDetail.subscription.expiresAt && <>Expires: <span className="font-mono text-[10px]">{new Date(userDetail.subscription.expiresAt).toLocaleDateString()}</span></>}
                                            </div>
                                          ) : <p className="text-xs text-[var(--text-muted)]">No active subscription</p>}
                                        </div>

                                        <div className="rounded-xl p-3 bg-[var(--bg-elevated)] sm:col-span-2">
                                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Manage Access</p>
                                          <div className="flex flex-col sm:flex-row gap-2">
                                            <select 
                                              value={subFormPlan}
                                              onChange={(e) => setSubFormPlan(e.target.value as any)}
                                              className="bg-[var(--bg-hover)] border border-[var(--border)] text-xs text-[var(--text-primary)] rounded-lg px-3 py-2 outline-none focus:border-[var(--tag-green-text)]/50"
                                            >
                                              <option value="free" className="bg-[var(--bg-elevated)]">Free Tier</option>
                                              <option value="pro" className="bg-[var(--bg-elevated)]">Pro Tier</option>
                                              <option value="studio" className="bg-[var(--bg-elevated)]">Max Tier</option>
                                            </select>
                                            
                                            {subFormPlan !== 'free' && (
                                              <input 
                                                type="number"
                                                placeholder="Months (blank for lifetime)"
                                                value={subFormMonths}
                                                onChange={(e) => setSubFormMonths(e.target.value)}
                                                className="bg-[var(--bg-hover)] border border-[var(--border)] text-xs text-[var(--text-primary)] rounded-lg px-3 py-2 outline-none focus:border-[var(--tag-green-text)]/50 flex-1"
                                              />
                                            )}
                                            
                                            <button 
                                              onClick={() => handleUpdateSubscription(u.uid, u.email)}
                                              disabled={actionLoading === `${u.uid}:update_sub`}
                                              className="bg-[var(--tag-green-bg)] text-[var(--tag-green-text)] hover:bg-[var(--tag-green-bg)] hover:brightness-110 px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                            >
                                              {actionLoading === `${u.uid}:update_sub` ? 'Updating...' : 'Save Plan'}
                                            </button>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="rounded-xl p-3 bg-[var(--bg-elevated)]">
                                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Resource Limits (Monthly)</p>
                                          <div className="space-y-2">
                                            <div>
                                              <div className="flex justify-between text-[10px] mb-1 text-[var(--text-muted)]"><span>Voice API</span> <span className="font-mono">{userDetail.voice?.usedSeconds || 0}s</span></div>
                                              <div className="h-1.5 rounded-full bg-[var(--bg-hover)]"><div className="h-full rounded-full" style={{ width: `${Math.min(((userDetail.voice?.usedSeconds || 0)/900)*100, 100)}%`, background: 'var(--tag-green-text)', opacity: 0.5 }}/></div>
                                            </div>
                                            <div>
                                              <div className="flex justify-between text-[10px] mb-1 text-[var(--text-muted)]"><span>AI Writing</span> <span className="font-mono">{userDetail.writing?.usedWords || 0}w</span></div>
                                              <div className="h-1.5 rounded-full bg-[var(--bg-hover)]"><div className="h-full rounded-full" style={{ width: `${Math.min(((userDetail.writing?.usedWords || 0)/50000)*100, 100)}%`, background: 'var(--tag-blue-text)', opacity: 0.5 }}/></div>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="rounded-xl p-3 bg-[var(--bg-elevated)] flex flex-col justify-center items-center text-center">
                                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Interview Debriefs</p>
                                          <span className="text-2xl font-bold text-[var(--text-primary)]">{userDetail.debriefCount}</span>
                                          <span className="text-xs text-[var(--text-muted)]">Saved sessions</span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-[var(--text-muted)] py-2">No detail found.</div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}

                {nextPageToken && !usersLoading && (
                  <div className="p-4 border-t border-[var(--border-subtle)] text-center bg-[var(--bg-surface)]">
                    <button onClick={() => loadUsers(search, nextPageToken)} className="px-6 py-2 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                      Load More
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= CONTROLS TAB ================= */}
          {activeTab === 'controls' && (
            <div className="max-w-2xl space-y-6">
              
              {/* Promo Popup */}
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2"><span className="material-symbols-rounded text-[var(--tag-green-text)]">campaign</span> Promo Popup</h2>
                    <p className="text-sm text-[var(--text-muted)] mt-1">Live on landing page via Sona orb</p>
                  </div>
                  <button
                    onClick={togglePromo}
                    disabled={promoLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${promoActive ? 'bg-emerald-500' : 'bg-[var(--bg-hover)]'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${promoActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Headline</label>
                    <input type="text" value={promoHeadline} onChange={e => setPromoHeadline(e.target.value)} className="w-full bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--tag-green-text)]/50 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Promo Code</label>
                      <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value)} className="w-full bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--tag-green-text)]/50 rounded-lg px-3 py-2 text-sm font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">CTA Text</label>
                      <input type="text" value={promoCta} onChange={e => setPromoCta(e.target.value)} className="w-full bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--tag-green-text)]/50 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <button onClick={togglePromo} disabled={promoLoading} className="w-full py-2.5 rounded-xl bg-[var(--tag-green-bg)] border border-[var(--tag-green-text)]/30 text-[var(--tag-green-text)] text-sm font-medium hover:bg-[var(--tag-green-bg)] transition-colors mt-2">
                    {promoLoading ? 'Saving...' : 'Save Promo Settings'}
                  </button>
                </div>
              </div>

              {/* Feature Flags */}
              <div className="glass-card rounded-2xl p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2"><span className="material-symbols-rounded text-[var(--tag-green-text)]">tune</span> Feature Flags</h2>
                  <p className="text-sm text-[var(--text-muted)] mt-1">Toggle platform features on/off</p>
                </div>
                
                {settingsLoading && !settings ? (
                  <div className="py-4"><div className="scanning-loader" style={{ width: 24, height: 24, borderWidth: 2, display: 'block', margin: '0 auto' }} /></div>
                ) : (
                  <div className="space-y-1">
                    {featureFlagsList.map(flag => {
                      const isOn = settings?.features?.[flag.key] ?? true;
                      return (
                        <div key={flag.key} className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)] last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-rounded text-[var(--text-muted)]">{flag.icon}</span>
                            <span className="text-sm font-medium text-[var(--text-primary)]">{flag.label}</span>
                          </div>
                          <button
                            onClick={() => toggleFeatureFlag(flag.key)}
                            disabled={settingsLoading}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isOn ? 'bg-emerald-500' : 'bg-[var(--bg-hover)]'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOn ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Maintenance Mode */}
              <div className={`glass-card rounded-2xl p-6 transition-colors duration-300 ${maintenance ? 'border-amber-500/30 bg-amber-500/5' : ''}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2"><span className={`material-symbols-rounded ${maintenance ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>build</span> Maintenance Mode</h2>
                    <p className="text-sm text-[var(--text-muted)] mt-1">Shows a warning banner across the platform</p>
                  </div>
                  <button
                    onClick={() => setMaintenance(!maintenance)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${maintenance ? 'bg-amber-500' : 'bg-[var(--bg-hover)]'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${maintenance ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div>
                  <textarea 
                    value={maintenanceMessage} 
                    onChange={e => setMaintenanceMessage(e.target.value)} 
                    placeholder="We're upgrading the platform. Back in a few minutes."
                    className="w-full bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg px-3 py-2 text-sm resize-none h-20 mb-3 outline-none focus:border-amber-500/50" 
                  />
                  <button onClick={saveMaintenance} disabled={settingsLoading} className="w-full py-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors">
                    Save Maintenance Status
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ================= COSTS TAB ================= */}
          {activeTab === 'costs' && (
            <div className="space-y-6">
              {costsLoading ? (
                <div className="flex justify-center py-12"><div className="scanning-loader" /></div>
              ) : !costs ? (
                <div className="text-center py-8 text-[var(--text-muted)]">Failed to load financials.</div>
              ) : (
                <>
                  {/* Top Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="glass-card rounded-2xl p-5 border-[var(--tag-green-text)]/30">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Total MRR</p>
                      <p className="text-2xl font-bold text-[var(--tag-green-text)]">${costs.mrr}</p>
                    </div>
                    <div className="glass-card rounded-2xl p-5 border-red-500/20">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Est. Monthly Cost</p>
                      <p className="text-2xl font-bold text-[var(--tag-rose-text)]">${costs.totalCost}</p>
                    </div>
                    <div className="glass-card rounded-2xl p-5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Net Profit</p>
                      <p className="text-2xl font-bold text-[var(--text-primary)]">${costs.netProfit}</p>
                    </div>
                    <div className="glass-card rounded-2xl p-5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Margin / Cost Per User</p>
                      <p className="text-2xl font-bold text-[var(--text-primary)]">{costs.profitMargin}% <span className="text-xs text-[var(--text-muted)] font-normal ml-1">/ ${costs.costPerUser} ea</span></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: AI Provider Burn Rate */}
                    <div className="glass-card rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-6">
                        <span className="material-symbols-rounded text-[var(--tag-green-text)] text-[20px]">smart_toy</span>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">AI Provider Burn Rate</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-[var(--text-secondary)]">Gemini (Voice & Audio)</span> <span className="font-mono text-[var(--text-primary)]">${costs.breakdown.ai.geminiVoice.toFixed(2)}</span></div>
                          <div className="h-1.5 rounded-full bg-[var(--bg-hover)]"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max((costs.breakdown.ai.geminiVoice / (costs.breakdown.ai.total || 1)) * 100, 2)}%` }} /></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-[var(--text-secondary)]">Gemini 1.5 Flash (Text)</span> <span className="font-mono text-[var(--text-primary)]">${costs.breakdown.ai.geminiText.toFixed(2)}</span></div>
                          <div className="h-1.5 rounded-full bg-[var(--bg-hover)]"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${Math.max((costs.breakdown.ai.geminiText / (costs.breakdown.ai.total || 1)) * 100, 2)}%` }} /></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-[var(--text-secondary)]">Groq (Fast Inference)</span> <span className="font-mono text-[var(--text-primary)]">${costs.breakdown.ai.groq.toFixed(2)}</span></div>
                          <div className="h-1.5 rounded-full bg-[var(--bg-hover)]"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.max((costs.breakdown.ai.groq / (costs.breakdown.ai.total || 1)) * 100, 2)}%` }} /></div>
                        </div>
                        
                        <div className="pt-3 mt-3 border-t border-[var(--border-subtle)] flex justify-between items-center">
                          <span className="text-xs text-[var(--text-muted)]">Total AI Costs</span>
                          <span className="text-sm font-bold text-[var(--text-primary)]">${costs.breakdown.ai.total}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Infrastructure Overhead */}
                    <div className="glass-card rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-6">
                        <span className="material-symbols-rounded text-[var(--tag-blue-text)] text-[20px]">dns</span>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Infrastructure Overhead</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-[var(--text-secondary)]">Google Cloud Run (Compute)</span> <span className="font-mono text-[var(--text-primary)]">${costs.breakdown.infra.cloudRun.toFixed(2)}</span></div>
                          <div className="h-1.5 rounded-full bg-[var(--bg-hover)]"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.max((costs.breakdown.infra.cloudRun / (costs.breakdown.infra.total || 1)) * 100, 2)}%` }} /></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-[var(--text-secondary)]">Firebase (DB + Auth)</span> <span className="font-mono text-[var(--text-primary)]">${costs.breakdown.infra.firebase.toFixed(2)}</span></div>
                          <div className="h-1.5 rounded-full bg-[var(--bg-hover)]"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.max((costs.breakdown.infra.firebase / (costs.breakdown.infra.total || 1)) * 100, 2)}%` }} /></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-[var(--text-secondary)]">Upstash (Rate Limits)</span> <span className="font-mono text-[var(--text-primary)]">${costs.breakdown.infra.upstash.toFixed(2)}</span></div>
                          <div className="h-1.5 rounded-full bg-[var(--bg-hover)]"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.max((costs.breakdown.infra.upstash / (costs.breakdown.infra.total || 1)) * 100, 2)}%` }} /></div>
                        </div>
                        
                        <div className="pt-3 mt-3 border-t border-[var(--border-subtle)] flex justify-between items-center">
                          <span className="text-xs text-[var(--text-muted)]">Total Infra Costs</span>
                          <span className="text-sm font-bold text-[var(--text-primary)]">${costs.breakdown.infra.total}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Unit Economics */}
                  <div className="glass-card rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Unit Economics & Raw Usage</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4">
                        <span className="material-symbols-rounded text-[var(--text-muted)] mb-2 block">record_voice_over</span>
                        <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">{costs.metrics.voiceSeconds}s</p>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Total Voice Processed</p>
                        <p className="text-xs text-[var(--text-muted)] mt-2">~ ${(costs.metrics.voiceSeconds * 0.000005).toFixed(2)} overhead</p>
                      </div>
                      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4">
                        <span className="material-symbols-rounded text-[var(--text-muted)] mb-2 block">edit_document</span>
                        <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">{costs.metrics.writtenWords}</p>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Total Words Generated</p>
                        <p className="text-xs text-[var(--text-muted)] mt-2">~ ${(costs.metrics.writtenWords * 0.0000015).toFixed(2)} overhead</p>
                      </div>
                      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4">
                        <span className="material-symbols-rounded text-[var(--text-muted)] mb-2 block">bolt</span>
                        <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">{costs.metrics.invocations}</p>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Feature Invocations</p>
                        <p className="text-xs text-[var(--text-muted)] mt-2">~ ${(costs.metrics.invocations * 0.00005).toFixed(2)} overhead</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
