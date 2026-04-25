'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/Toast';
import { useTheme } from '@/components/ThemeProvider';

const MASTER_EMAILS = ['alula2006@gmail.com'];

interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastSignIn: string;
  disabled: boolean;
  tier: 'free' | 'pro' | 'max' | 'admin';
}

export default function AdminPage() {
  const { user } = useStore();
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, max: 0, pro: 0, free: 0, disabled: 0 });

  // Promo state
  const [promoActive, setPromoActive] = useState(false);
  const [promoHeadline, setPromoHeadline] = useState('🚀 Limited Time — 50% off Pro for 3 months!');
  const [promoCode, setPromoCode] = useState('LAUNCH50');
  const [promoCta, setPromoCta] = useState('Claim Offer');
  const [promoLoading, setPromoLoading] = useState(false);

  const isAdmin = user?.email && MASTER_EMAILS.includes(user.email.toLowerCase());

  const authFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = await (user as any)?.getIdToken?.();
    if (!token) throw new Error('Not authenticated');
    return fetch(url, {
      ...options,
      headers: { ...options?.headers, Authorization: `Bearer ${token}` },
    });
  }, [user]);

  const loadUsers = useCallback(async (searchQuery = '', pageToken?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (pageToken) params.set('pageToken', pageToken);
      params.set('limit', '50');

      const res = await authFetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data.users || []);
      setNextPageToken(data.nextPageToken);
      
      // Compute stats
      const allUsers = data.users || [];
      setStats({
        total: allUsers.length,
        max: allUsers.filter((u: UserRecord) => u.tier === 'max' || u.tier === 'admin').length,
        pro: allUsers.filter((u: UserRecord) => u.tier === 'pro').length,
        free: allUsers.filter((u: UserRecord) => u.tier === 'free').length,
        disabled: allUsers.filter((u: UserRecord) => u.disabled).length,
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to load users', 'cancel');
    }
    setLoading(false);
  }, [authFetch]);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  // Load promo state
  useEffect(() => {
    if (!isAdmin) return;
    authFetch('/api/admin/promo')
      .then(r => r.json())
      .then(data => {
        setPromoActive(data.active || false);
        if (data.headline) setPromoHeadline(data.headline);
        if (data.code) setPromoCode(data.code);
        if (data.ctaText) setPromoCta(data.ctaText);
      })
      .catch(() => {});
  }, [isAdmin, authFetch]);

  const togglePromo = async (newActive: boolean) => {
    setPromoLoading(true);
    try {
      const res = await authFetch('/api/admin/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active: newActive,
          headline: promoHeadline,
          code: promoCode,
          ctaText: promoCta,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setPromoActive(newActive);
      showToast(newActive ? 'Promo is LIVE!' : 'Promo disabled', newActive ? 'check_circle' : 'cancel');
    } catch {
      showToast('Failed to update promo', 'cancel');
    }
    setPromoLoading(false);
  };

  const handleAction = async (uid: string, email: string, action: string) => {
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

  const handleSearch = () => {
    loadUsers(search);
  };

  // Access denied for non-admins
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-24 h-24 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6 text-red-500">
            <span className="material-symbols-rounded text-5xl">block</span>
          </div>
          <h1 className={`text-2xl font-bold mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>Access Denied</h1>
          <p className={`mb-6 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            This page is restricted to admin accounts only.
          </p>
          <button
            onClick={() => router.push('/suite')}
            className="px-6 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-medium hover:bg-cyan-500/20 transition-all"
          >
            ← Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl glass-card p-8 mb-8"
        >
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/30 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex items-center gap-4 pl-12 lg:pl-0">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shadow-inner">
              <span className="material-symbols-rounded text-3xl">admin_panel_settings</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                  Admin Panel
              </h1>
              <p className={`${isLight ? 'text-slate-500' : 'text-slate-400'}`}>User management & platform controls</p>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
        >
          {[
            { label: 'Total Users', value: stats.total, icon: 'group', color: 'cyan' },
            { label: 'Max Users', value: stats.max, icon: 'diamond', color: 'amber' },
            { label: 'Pro Users', value: stats.pro, icon: 'verified_user', color: 'emerald' },
            { label: 'Free Users', value: stats.free, icon: 'person', color: 'slate' },
            { label: 'Disabled', value: stats.disabled, icon: 'block', color: 'red' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-2 text-[var(--theme-text-secondary)]">
                <span className="material-symbols-rounded text-2xl">{stat.icon}</span>
                <span className={`text-xs font-medium uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{stat.label}</span>
              </div>
              <p className={`text-3xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{stat.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Promo Control */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass-card rounded-2xl p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                promoActive
                  ? 'bg-emerald-500/15 border border-emerald-500/20 text-emerald-400'
                  : isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 border border-white/10 text-slate-500'
              }`}>
                <span className="material-symbols-rounded text-xl">campaign</span>
              </div>
              <div>
                <h3 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Promo Popup
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {promoActive ? 'Live on landing page' : 'Currently disabled'}
                </p>
              </div>
            </div>

            {/* Toggle */}
            <button
              onClick={() => togglePromo(!promoActive)}
              disabled={promoLoading}
              className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                promoActive ? 'bg-emerald-500' : isLight ? 'bg-slate-300' : 'bg-white/10'
              } ${promoLoading ? 'opacity-50' : ''}`}
            >
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                promoActive ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'
              }`} />
            </button>
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Headline
              </label>
              <input
                type="text"
                value={promoHeadline}
                onChange={(e) => setPromoHeadline(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 transition-all ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-900 focus:ring-emerald-500/30'
                    : 'bg-white/5 border-white/10 text-white focus:ring-emerald-500/30'
                }`}
              />
            </div>
            <div>
              <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Promo Code
              </label>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                className={`w-full px-3 py-2 rounded-lg text-sm font-mono border focus:outline-none focus:ring-1 transition-all ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-900 focus:ring-emerald-500/30'
                    : 'bg-white/5 border-white/10 text-emerald-400 focus:ring-emerald-500/30'
                }`}
              />
            </div>
            <div>
              <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                CTA Text
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCta}
                  onChange={(e) => setPromoCta(e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 transition-all ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-900 focus:ring-emerald-500/30'
                      : 'bg-white/5 border-white/10 text-white focus:ring-emerald-500/30'
                  }`}
                />
                <button
                  onClick={() => togglePromo(promoActive)}
                  disabled={promoLoading}
                  className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {promoLoading ? '...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card rounded-2xl p-6 mb-6"
        >
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400 material-symbols-rounded">search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by email, name, or UID..."
                className={`w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-amber-500/20'
                    : 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-amber-500/50 focus:ring-amber-500/20'
                }`}
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:shadow-lg hover:shadow-amber-500/25 transition-all"
            >
              Search
            </button>
            <button
              onClick={() => { setSearch(''); loadUsers(); }}
              className={`px-4 py-3 rounded-xl border transition-all ${
                isLight
                  ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  : 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              Reset
            </button>
          </div>
        </motion.div>

        {/* User Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl overflow-hidden"
        >
          {/* Table Header */}
          <div className={`grid grid-cols-12 gap-4 px-6 py-4 text-xs font-semibold uppercase tracking-wider border-b ${
            isLight ? 'text-slate-500 border-slate-200 bg-slate-50/50' : 'text-slate-400 border-white/5 bg-white/[0.02]'
          }`}>
            <div className="col-span-4">User</div>
            <div className="col-span-2">Tier</div>
            <div className="col-span-2 hidden md:block">Created</div>
            <div className="col-span-2 hidden md:block">Last Sign In</div>
            <div className="col-span-4 md:col-span-2 text-right">Actions</div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="p-12 text-center">
              <div className="w-10 h-10 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin mx-auto mb-4" />
              <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Loading users...</p>
            </div>
          )}

          {/* Empty */}
          {!loading && users.length === 0 && (
            <div className="p-12 text-center">
              <span className="material-symbols-rounded text-4xl mb-4 block text-[var(--theme-text-tertiary)]">person_off</span>
              <p className={`${isLight ? 'text-slate-500' : 'text-slate-400'}`}>No users found</p>
            </div>
          )}

          {/* User Rows */}
          <AnimatePresence>
            {!loading && users.map((u, i) => (
              <motion.div
                key={u.uid}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.02 }}
                className={`grid grid-cols-12 gap-4 px-6 py-4 items-center border-b transition-colors ${
                  isLight
                    ? 'border-slate-100 hover:bg-slate-50/50'
                    : 'border-white/[0.03] hover:bg-white/[0.02]'
                } ${u.disabled ? 'opacity-50' : ''}`}
              >
                {/* User Info */}
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    u.tier === 'admin' ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white'
                    : u.tier === 'max' ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white'
                    : u.tier === 'pro' ? 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white'
                    : isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-slate-400'
                  }`}>
                    {u.email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {u.displayName || u.email?.split('@')[0]}
                    </p>
                    <p className={`text-xs truncate ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>{u.email}</p>
                  </div>
                </div>

                {/* Tier */}
                <div className="col-span-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    u.tier === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : u.tier === 'max' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                    : u.tier === 'pro' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : isLight ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                  }`}>
                    {u.tier === 'admin' ? <><span className="material-symbols-rounded text-[14px]">shield_person</span> Admin</>
                     : u.tier === 'max' ? <><span className="material-symbols-rounded text-[14px]">diamond</span> Max</>
                     : u.tier === 'pro' ? <><span className="material-symbols-rounded text-[14px]">star</span> Pro</>
                     : <><span className="material-symbols-rounded text-[14px]">person</span> Free</>}
                  </span>
                  {u.disabled && (
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Disabled</span>
                  )}
                </div>

                {/* Created */}
                <div className="col-span-2 hidden md:block">
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                  </p>
                </div>

                {/* Last Sign In */}
                <div className="col-span-2 hidden md:block">
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                    {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                  </p>
                </div>

                {/* Actions */}
                <div className="col-span-4 md:col-span-2 flex items-center gap-2 justify-end">
                  {u.tier === 'admin' ? (
                    <span className="text-[10px] text-amber-400 font-medium">Master</span>
                  ) : (
                    <>
                      {/* Tier action buttons */}
                      <div className="flex items-center gap-1">
                        {u.tier !== 'max' && (
                          <button
                            onClick={() => handleAction(u.uid, u.email, 'set_max')}
                            disabled={actionLoading === `${u.uid}:set_max`}
                            className="px-2.5 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-medium hover:bg-violet-500/20 transition-all disabled:opacity-50"
                            title="Upgrade to Max"
                          >
                            {actionLoading === `${u.uid}:set_max` ? '...' : '↑ Max'}
                          </button>
                        )}
                        {u.tier !== 'pro' && (
                          <button
                            onClick={() => handleAction(u.uid, u.email, 'set_pro')}
                            disabled={actionLoading === `${u.uid}:set_pro`}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                            title="Set to Pro"
                          >
                            {actionLoading === `${u.uid}:set_pro` ? '...' : u.tier === 'max' ? '↓ Pro' : '↑ Pro'}
                          </button>
                        )}
                        {u.tier !== 'free' && (
                          <button
                            onClick={() => handleAction(u.uid, u.email, 'set_free')}
                            disabled={actionLoading === `${u.uid}:set_free`}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-400 text-[11px] font-medium hover:bg-slate-500/20 transition-all disabled:opacity-50"
                            title="Downgrade to Free"
                          >
                            {actionLoading === `${u.uid}:set_free` ? '...' : '↓ Free'}
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => handleAction(u.uid, u.email, u.disabled ? 'enable' : 'disable')}
                        disabled={actionLoading === `${u.uid}:${u.disabled ? 'enable' : 'disable'}`}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-50 ${
                          u.disabled
                            ? 'bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20'
                            : 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                        }`}
                        title={u.disabled ? 'Enable user' : 'Disable user'}
                      >
                        {actionLoading === `${u.uid}:${u.disabled ? 'enable' : 'disable'}` ? '...' : u.disabled ? '✓ Enable' : <><span className="material-symbols-rounded align-middle mr-1">close</span> Disable</>}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Load More */}
          {nextPageToken && !loading && (
            <div className="p-4 text-center">
              <button
                onClick={() => loadUsers(search, nextPageToken)}
                className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                Load More Users →
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
