'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import PageHelp from '@/components/PageHelp';

interface Contact {
  id: string;
  name: string;
  company: string;
  role: string;
  email: string;
  phone: string;
  linkedin: string;
  type: 'recruiter' | 'hiring_manager' | 'referral' | 'peer' | 'other';
  notes: string;
  applicationId: string | null;
  lastContactedAt: any;
  followUpDate: string | null;
  interactions: { type: string; note: string; date: string }[];
  created_at: any;
}

const TYPE_CONFIG = {
  recruiter: { icon: 'support_agent', color: '#3b82f6', label: 'Recruiter', bg: 'bg-blue-500/10' },
  hiring_manager: { icon: 'person_pin', color: '#10b981', label: 'Hiring Manager', bg: 'bg-emerald-500/10' },
  referral: { icon: 'people', color: '#f59e0b', label: 'Referral', bg: 'bg-amber-500/10' },
  peer: { icon: 'handshake', color: '#8b5cf6', label: 'Peer', bg: 'bg-violet-500/10' },
  other: { icon: 'person', color: '#64748b', label: 'Other', bg: 'bg-slate-500/10' },
};

export default function NetworkPage() {
  const { user } = useStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Form state
  const [formName, setFormName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLinkedin, setFormLinkedin] = useState('');
  const [formType, setFormType] = useState<string>('recruiter');
  const [formNotes, setFormNotes] = useState('');

  const token = (user as any)?.accessToken || (user as any)?.stsTokenManager?.accessToken;

  const fetchContacts = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/agent/network', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setContacts(data.contacts);
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { fetchContacts(); }, [token]);

  const handleAdd = async () => {
    if (!formName) { showToast('Name is required', 'warning'); return; }
    try {
      const res = await fetch('/api/agent/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create',
          name: formName, company: formCompany, role: formRole,
          email: formEmail, phone: formPhone, linkedin: formLinkedin,
          type: formType, notes: formNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Contact added!', 'person_add');
        setShowAddModal(false);
        resetForm();
        fetchContacts();
      }
    } catch { showToast('Failed to add', 'cancel'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch('/api/agent/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete', id }),
      });
      setContacts(prev => prev.filter(c => c.id !== id));
      if (selectedContact?.id === id) setSelectedContact(null);
      showToast('Contact removed', 'delete');
    } catch { /* silent */ }
  };

  const logInteraction = async (id: string, interactionType: string, note: string) => {
    try {
      await fetch('/api/agent/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'log_interaction', id, interactionType, note }),
      });
      showToast('Interaction logged!', 'check');
      fetchContacts();
    } catch { /* silent */ }
  };

  const resetForm = () => {
    setFormName(''); setFormCompany(''); setFormRole(''); setFormEmail('');
    setFormPhone(''); setFormLinkedin(''); setFormType('recruiter'); setFormNotes('');
  };

  const filtered = contacts.filter(c => {
    const matchesSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || c.type === filterType;
    return matchesSearch && matchesType;
  });

  const stats = {
    total: contacts.length,
    recruiters: contacts.filter(c => c.type === 'recruiter').length,
    hiringManagers: contacts.filter(c => c.type === 'hiring_manager').length,
    referrals: contacts.filter(c => c.type === 'referral').length,
  };

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <span className="material-symbols-rounded text-white text-2xl">contacts</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Network CRM</h1>
              <p className="text-sm text-[var(--text-tertiary)]">Track recruiters, hiring managers & referrals</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PageHelp toolId="network" />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', boxShadow: '0 4px 16px rgba(139,92,246,0.3)' }}
            >
              <span className="material-symbols-rounded text-lg">person_add</span>
              Add Contact
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, icon: 'group', color: '#6366f1' },
          { label: 'Recruiters', value: stats.recruiters, icon: 'support_agent', color: '#3b82f6' },
          { label: 'Hiring Managers', value: stats.hiringManagers, icon: 'person_pin', color: '#10b981' },
          { label: 'Referrals', value: stats.referrals, icon: 'people', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 flex items-center gap-3" style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15` }}>
              <span className="material-symbols-rounded text-lg" style={{ color: s.color }}>{s.icon}</span>
            </div>
            <div>
              <p className="text-xl font-black text-[var(--text-primary)] tabular-nums">{s.value}</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-lg">search</span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or company..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
        >
          <option value="all">All Types</option>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </div>

      {/* Contact Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-[120px] rounded-xl animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)]" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-28 rounded bg-[var(--bg-elevated)]" />
                    <div className="h-2.5 w-20 rounded bg-[var(--bg-elevated)]" />
                  </div>
                </div>
                <div className="h-2.5 w-full rounded bg-[var(--bg-elevated)]" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
          <div className="max-w-sm mx-auto rounded-2xl p-8 relative overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-indigo-500/5" />
            <div className="relative">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <span className="material-symbols-rounded text-3xl text-violet-500">person_add</span>
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                {contacts.length === 0 ? 'Start Building Your Network' : 'No matches'}
              </h3>
              <p className="text-sm text-[var(--text-tertiary)] mb-5 max-w-xs mx-auto">
                {contacts.length === 0
                  ? 'Add recruiters, hiring managers, and referrals to keep your job search organized.'
                  : 'Try adjusting your search or filter.'}
              </p>
              {contacts.length === 0 && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', boxShadow: '0 4px 16px rgba(139,92,246,0.3)' }}
                >
                  <span className="material-symbols-rounded text-sm">person_add</span>
                  Add Your First Contact
                </button>
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {filtered.map((contact, i) => {
              const cfg = TYPE_CONFIG[contact.type] || TYPE_CONFIG.other;
              return (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedContact(contact)}
                  className="rounded-xl p-4 cursor-pointer group transition-all hover:shadow-lg"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                  whileHover={{ y: -2 }}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cfg.color}15` }}>
                      <span className="material-symbols-rounded text-lg" style={{ color: cfg.color }}>{cfg.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-[var(--text-primary)] truncate">{contact.name}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${cfg.bg}`} style={{ color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </div>
                      {contact.role && (
                        <p className="text-[11px] text-[var(--text-secondary)] truncate">{contact.role}</p>
                      )}
                      {contact.company && (
                        <p className="text-[11px] text-[var(--text-tertiary)] truncate">{contact.company}</p>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(contact.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <span className="material-symbols-rounded text-[14px]">close</span>
                    </button>
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} onClick={e => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-blue-500 hover:bg-blue-500/10 transition-all">
                        <span className="material-symbols-rounded text-[14px]">mail</span>
                      </a>
                    )}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} onClick={e => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-emerald-500 hover:bg-emerald-500/10 transition-all">
                        <span className="material-symbols-rounded text-[14px]">call</span>
                      </a>
                    )}
                    {contact.linkedin && (
                      <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-indigo-500 hover:bg-indigo-500/10 transition-all">
                        <span className="material-symbols-rounded text-[14px]">open_in_new</span>
                      </a>
                    )}
                    <span className="flex-1" />
                    <span className="text-[9px] text-[var(--text-tertiary)]">
                      {contact.interactions?.length || 0} interactions
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add Contact Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 rounded-2xl p-5 space-y-3 max-h-[80vh] overflow-y-auto"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-[var(--text-primary)]">Add Contact</h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-[var(--bg-hover)]">
                  <span className="material-symbols-rounded text-[var(--text-tertiary)]">close</span>
                </button>
              </div>

              {/* Type selector */}
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <button key={key} onClick={() => setFormType(key)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      formType === key ? 'border-2' : 'border border-transparent hover:border-[var(--border-subtle)]'
                    }`}
                    style={{
                      background: formType === key ? `${cfg.color}15` : 'var(--bg-elevated)',
                      borderColor: formType === key ? cfg.color : undefined,
                      color: formType === key ? cfg.color : 'var(--text-secondary)',
                    }}
                  >
                    <span className="material-symbols-rounded text-[14px]">{cfg.icon}</span> {cfg.label}
                  </button>
                ))}
              </div>

              <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Full Name *"
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-violet-500/50" />
              <div className="grid grid-cols-2 gap-2">
                <input value={formCompany} onChange={e => setFormCompany(e.target.value)} placeholder="Company"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none" />
                <input value={formRole} onChange={e => setFormRole(e.target.value)} placeholder="Title / Role"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none" />
              </div>
              <input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="Email"
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="Phone"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none" />
                <input value={formLinkedin} onChange={e => setFormLinkedin(e.target.value)} placeholder="LinkedIn URL"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none" />
              </div>
              <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Notes..."
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none resize-none" />

              <button onClick={handleAdd} disabled={!formName}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
              >
                Add Contact
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
