'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import {
  applyFromQueue,
  getAgentQueue,
  updateQueueFeedback,
  updateQueueItem,
  type AgentQueueItem,
} from '@/lib/database-suite';
import AnimatedToolIcon, { type ToolIconTone } from '@/components/AnimatedToolIcon';
import PageHelp from '@/components/PageHelp';
import { SonaMark } from '@/components/sona';
import SonaThinkingTile from '@/components/SonaThinkingTile';
import { showToast } from '@/components/Toast';

type QueueView = 'command' | 'queue' | 'board' | 'history' | 'settings';
type StatusFilter = 'all' | AgentQueueItem['status'];

const VIEW_CONFIG: Record<QueueView, { label: string; icon: string }> = {
  command: { label: 'Command', icon: 'auto_awesome' },
  queue: { label: 'Queue', icon: 'view_list' },
  board: { label: 'Board', icon: 'view_kanban' },
  history: { label: 'History', icon: 'history' },
  settings: { label: 'Settings', icon: 'tune' },
};

const STATUS_CONFIG: Record<AgentQueueItem['status'], { label: string; icon: string; tone: ToolIconTone; color: string }> = {
  pending: { label: 'Needs review', icon: 'pending_actions', tone: 'amber', color: '#d97706' },
  approved: { label: 'Approved', icon: 'task_alt', tone: 'emerald', color: '#059669' },
  applied: { label: 'Applied', icon: 'outgoing_mail', tone: 'blue', color: '#2563eb' },
  dismissed: { label: 'Dismissed', icon: 'block', tone: 'slate', color: '#64748b' },
  expired: { label: 'Expired', icon: 'event_busy', tone: 'rose', color: '#e11d48' },
};

const FEEDBACK_TAGS = [
  'More like this',
  'Less like this',
  'Wrong seniority',
  'Bad company',
  'Salary too low',
  'Not my role',
];

function formatSalary(salary?: { min: number | null; max: number | null }) {
  if (!salary?.min && !salary?.max) return 'Salary not listed';
  const fmt = (v: number) => `$${Math.round(v / 1000)}k`;
  if (salary.min && salary.max) return `${fmt(salary.min)}-${fmt(salary.max)}`;
  return salary.min ? `${fmt(salary.min)}+` : `Up to ${fmt(salary.max || 0)}`;
}

function formatShortDate(value?: string) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(value?: string) {
  if (!value) return 99;
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return 99;
  return Math.ceil((date - Date.now()) / (1000 * 60 * 60 * 24));
}

function scoreTone(score: number): ToolIconTone {
  if (score >= 85) return 'blue';
  if (score >= 75) return 'emerald';
  if (score >= 60) return 'amber';
  return 'slate';
}

function deriveNextAction(item: AgentQueueItem) {
  if (item.nextAction) return item.nextAction;
  if (item.status === 'pending') return 'Review the packet and decide whether to approve it.';
  if (item.status === 'approved') return 'Open the job posting and submit manually when ready.';
  if (item.status === 'applied') return 'Track the outcome in Applications.';
  if (item.status === 'dismissed') return 'Sona will learn from your feedback.';
  return 'Expired packet. Ask Sona to find fresh roles.';
}

function askSona(prompt: string, contextLabel = 'Agent Queue') {
  window.dispatchEvent(new CustomEvent('sona:open', { detail: { prompt, contextLabel } }));
}

function QueueMetric({
  icon,
  tone,
  value,
  label,
  onClick,
}: {
  icon: string;
  tone: ToolIconTone;
  value: number | string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-[18px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-left transition-all hover:border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
    >
      <div className="flex items-center justify-between gap-3">
        <AnimatedToolIcon icon={icon} tone={tone} size="xs" state="idle" />
        <span className="whitespace-nowrap text-2xl font-black tabular-nums text-[var(--text-primary)]">{value}</span>
      </div>
      <p className="mt-3 text-xs font-medium leading-5 text-[var(--text-secondary)]">{label}</p>
    </button>
  );
}

function ActionTile({
  icon,
  tone,
  label,
  value,
  description,
  onClick,
}: {
  icon: string;
  tone: ToolIconTone;
  label: string;
  value: number;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 items-center gap-3 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--card-bg)] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
    >
      <AnimatedToolIcon icon={icon} tone={tone} size="sm" state={value > 0 ? 'thinking' : 'idle'} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black tabular-nums text-[var(--text-primary)]">{value}</span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
        </div>
        <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">{description}</p>
      </div>
      <span className="material-symbols-rounded text-[18px] text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5">arrow_forward</span>
    </button>
  );
}

function QueueCard({
  item,
  selected,
  onSelect,
  onApprove,
  onDismiss,
  onApply,
  loading,
}: {
  item: AgentQueueItem;
  selected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onDismiss: () => void;
  onApply: () => void;
  loading: boolean;
}) {
  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  const expiringSoon = item.status === 'pending' && daysUntil(item.expires_at) <= 2;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className={`rounded-[22px] border bg-[var(--card-bg)] p-4 transition-all hover:border-[var(--border)] ${
        selected ? 'border-blue-500/45 ring-2 ring-blue-500/12' : 'border-[var(--border-subtle)]'
      }`}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left focus:outline-none">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] border" style={{
            background: `${status.color}14`,
            borderColor: `${status.color}30`,
            color: status.color,
          }}>
            <span className="text-sm font-black tabular-nums">{Math.round(item.match_score || 0)}%</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="min-w-0 text-base font-bold leading-6 text-[var(--text-primary)]">{item.job_title}</h3>
              {expiringSoon && <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600">EXPIRING</span>}
            </div>
            <p className="mt-0.5 text-sm leading-5 text-[var(--text-secondary)]">{item.company} · {item.location}</p>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{item.match_reason}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">{formatSalary(item.salary)}</span>
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">{status.label}</span>
          {item.packetStatus && <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-600">{item.packetStatus.replace('_', ' ')}</span>}
          {item.cover_letter && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">Cover draft</span>}
        </div>
      </button>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => askSona(`Explain this agent packet and what I should do next: ${item.job_title} at ${item.company}.`, `${item.company} packet`)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-600 transition-all hover:bg-blue-500/15"
        >
          <SonaMark size="xs" state="idle" />
          Ask Sona
        </button>
        {item.status === 'pending' && (
          <>
            <button type="button" onClick={onApprove} disabled={loading || item.source === 'legacy_sona'} className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 transition-all hover:bg-emerald-500/15 disabled:opacity-45">Approve</button>
            <button type="button" onClick={onDismiss} disabled={loading || item.source === 'legacy_sona'} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-hover)] disabled:opacity-45">Dismiss</button>
          </>
        )}
        {item.status === 'approved' && (
          <button type="button" onClick={onApply} disabled={loading} className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-600 transition-all hover:bg-cyan-500/15 disabled:opacity-45">Open and track</button>
        )}
      </div>
    </motion.article>
  );
}

function PacketDrawer({
  item,
  onClose,
  onApprove,
  onDismiss,
  onApply,
  onFeedback,
  actionLoading,
}: {
  item: AgentQueueItem;
  onClose: () => void;
  onApprove: () => void;
  onDismiss: () => void;
  onApply: () => void;
  onFeedback: (tag: string) => void;
  actionLoading: boolean;
}) {
  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  const tags = item.feedbackTags || [];

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="fixed inset-x-3 bottom-3 top-20 z-40 overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--card-bg)] shadow-2xl lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-[430px] lg:shrink-0"
      role="dialog"
      aria-label="Application packet"
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-[var(--border-subtle)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <AnimatedToolIcon icon={status.icon} tone={scoreTone(item.match_score || 0)} size="sm" state={item.status === 'pending' ? 'thinking' : 'idle'} />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Application Packet</p>
                <h2 className="mt-1 text-lg font-bold leading-6 text-[var(--text-primary)]">{item.job_title}</h2>
                <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">{item.company} · {item.location}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]" aria-label="Close packet">
              <span className="material-symbols-rounded text-[20px]">close</span>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              <p className="text-xl font-black tabular-nums text-[var(--text-primary)]">{Math.round(item.match_score || 0)}%</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Fit</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              <p className="text-sm font-bold text-[var(--text-primary)]">{formatShortDate(item.expires_at)}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Review by</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              <p className="text-sm font-bold text-[var(--text-primary)]">{status.label}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Status</p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Why Sona queued it</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.match_reason || 'Sona identified this as a relevant opportunity based on your preferences.'}</p>
            <div className="mt-3 space-y-2">
              {(item.fitSignals || []).slice(0, 4).map(signal => (
                <div key={signal} className="flex gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-5 text-[var(--text-secondary)]">
                  <span className="material-symbols-rounded text-[16px] text-emerald-600">check_circle</span>
                  <span>{signal}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Next action</h3>
            <div className="mt-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
              <p className="text-sm leading-6 text-[var(--text-primary)]">{deriveNextAction(item)}</p>
              <button
                type="button"
                onClick={() => askSona(`What should I do next for this application packet? Role: ${item.job_title}. Company: ${item.company}. Match reason: ${item.match_reason}`, `${item.company} next action`)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-600"
              >
                <SonaMark size="xs" state="listening" />
                Ask Sona for a plan
              </button>
            </div>
          </section>

          {(item.riskSignals || []).length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Checks before submitting</h3>
              <div className="mt-2 space-y-2">
                {(item.riskSignals || []).slice(0, 5).map(signal => (
                  <div key={signal} className="flex gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-5 text-[var(--text-secondary)]">
                    <span className="material-symbols-rounded text-[16px] text-amber-600">info</span>
                    <span>{signal}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {item.cover_letter && (
            <section>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Cover letter draft</h3>
                <button type="button" onClick={() => askSona(`Improve this cover letter for ${item.job_title} at ${item.company}: ${item.cover_letter}`, `${item.company} cover letter`)} className="text-xs font-bold text-blue-600">Improve</button>
              </div>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-xs leading-6 text-[var(--text-secondary)] whitespace-pre-wrap">{item.cover_letter}</div>
            </section>
          )}

          {item.morphed_resume?.summary && (
            <section>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Tailored resume summary</h3>
              <div className="mt-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-xs leading-6 text-[var(--text-secondary)]">{item.morphed_resume.summary}</div>
            </section>
          )}

          <section>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Teach Sona</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {FEEDBACK_TAGS.map(tag => {
                const active = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onFeedback(tag)}
                    disabled={item.source === 'legacy_sona'}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-45 ${
                      active
                        ? 'border-blue-500/25 bg-blue-500/10 text-blue-600'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </section>

          {item.job_description && (
            <section>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Posting details</h3>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-xs leading-6 text-[var(--text-secondary)] whitespace-pre-wrap">{item.job_description}</div>
            </section>
          )}
        </div>

        <div className="border-t border-[var(--border-subtle)] p-4">
          <div className="flex flex-wrap gap-2">
            {item.status === 'pending' && (
              <>
                <button type="button" onClick={onApprove} disabled={actionLoading || item.source === 'legacy_sona'} className="flex-1 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-600 transition-all hover:bg-emerald-500/15 disabled:opacity-45">Approve</button>
                <button type="button" onClick={onDismiss} disabled={actionLoading || item.source === 'legacy_sona'} className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-bold text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-hover)] disabled:opacity-45">Dismiss</button>
              </>
            )}
            {item.status === 'approved' && (
              <button type="button" onClick={onApply} disabled={actionLoading} className="flex-1 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-bold text-cyan-600 transition-all hover:bg-cyan-500/15 disabled:opacity-45">Open and track</button>
            )}
            {item.job_url && (
              <a href={item.job_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] transition-all hover:bg-[var(--bg-hover)]">
                <span className="material-symbols-rounded text-[16px]">open_in_new</span>
                Posting
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

export default function AgentQueuePage() {
  const router = useRouter();
  const { user } = useStore();
  const [items, setItems] = useState<AgentQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<QueueView>('command');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AgentQueueItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    if (!user) {
      setLoading(false);
      setItems([]);
      return;
    }
    setLoading(true);
    setError('');
    const res = await getAgentQueue();
    if (res.success) {
      setItems(res.data || []);
    } else {
      setError(res.error || 'Could not load Agent Queue.');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const stats = useMemo(() => {
    const pending = items.filter(i => i.status === 'pending');
    const approved = items.filter(i => i.status === 'approved');
    const highFit = items.filter(i => i.match_score >= 85 && ['pending', 'approved'].includes(i.status));
    const expiring = pending.filter(i => daysUntil(i.expires_at) <= 2);
    const risks = items.reduce((sum, item) => sum + (item.riskSignals?.length || 0), 0);
    return {
      pending: pending.length,
      approved: approved.length,
      applied: items.filter(i => i.status === 'applied').length,
      dismissed: items.filter(i => i.status === 'dismissed').length,
      expired: items.filter(i => i.status === 'expired').length,
      highFit: highFit.length,
      expiring: expiring.length,
      risks,
      total: items.length,
    };
  }, [items]);

  const needsAttention = useMemo(() => {
    return items
      .filter(item => item.status === 'pending' || (item.status === 'approved' && item.packetStatus === 'assist_apply') || daysUntil(item.expires_at) <= 2)
      .sort((a, b) => {
        const aUrgency = (daysUntil(a.expires_at) <= 2 ? 100 : 0) + (a.match_score || 0);
        const bUrgency = (daysUntil(b.expires_at) <= 2 ? 100 : 0) + (b.match_score || 0);
        return bUrgency - aUrgency;
      })
      .slice(0, 5);
  }, [items]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(item => {
      const statusOk = statusFilter === 'all' || item.status === statusFilter;
      const queryOk = !q || [item.job_title, item.company, item.location, item.match_reason, item.employment_type]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q));
      const viewOk = view === 'history'
        ? ['applied', 'dismissed', 'expired'].includes(item.status)
        : view === 'command'
          ? ['pending', 'approved'].includes(item.status)
          : true;
      return statusOk && queryOk && viewOk;
    });
  }, [items, query, statusFilter, view]);

  const runAction = async (item: AgentQueueItem, action: 'approve' | 'dismiss') => {
    setActionLoading(item.id);
    const res = await updateQueueItem(item.id, action);
    if (res.success) {
      showToast(action === 'approve' ? 'Packet approved' : 'Packet dismissed', action === 'approve' ? 'check_circle' : 'block');
      await load();
      setSelected(null);
    } else {
      showToast(res.error || 'Could not update packet', 'error');
    }
    setActionLoading(null);
  };

  const runApply = async (item: AgentQueueItem) => {
    setActionLoading(item.id);
    const res = await applyFromQueue(item.id);
    if (res.success) {
      showToast('Added to Applications as not applied. Submit manually when ready.', 'open_in_new');
      if (item.job_url) window.open(item.job_url, '_blank', 'noopener,noreferrer');
      await load();
    } else {
      showToast(res.error || 'Could not prepare tracker entry', 'error');
    }
    setActionLoading(null);
  };

  const toggleFeedback = async (item: AgentQueueItem, tag: string) => {
    const current = item.feedbackTags || [];
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    const res = await updateQueueFeedback(item.id, next);
    if (res.success) {
      setItems(prev => prev.map(q => q.id === item.id ? { ...q, feedbackTags: next } : q));
      setSelected(prev => prev?.id === item.id ? { ...prev, feedbackTags: next } : prev);
    } else {
      showToast(res.error || 'Could not save feedback', 'error');
    }
  };

  const groupedBoard = useMemo(() => {
    return (Object.keys(STATUS_CONFIG) as AgentQueueItem['status'][]).map(status => ({
      status,
      items: visibleItems.filter(item => item.status === status),
    }));
  }, [visibleItems]);

  if (!user && !loading) {
    return (
      <div className="min-h-screen p-6 lg:p-8">
        <div className="mx-auto max-w-2xl rounded-[24px] border border-[var(--border-subtle)] bg-[var(--card-bg)] p-8 text-center">
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-[24px] border border-blue-500/20 bg-blue-500/10">
            <SonaMark size="md" state="idle" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Sign in to use Agent Queue</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Sona needs your saved preferences, resumes, and applications to prepare trustworthy packets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="mb-6 rounded-[24px] border border-[var(--border-subtle)] bg-[var(--card-bg)] p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <SonaMark size="md" state={loading ? 'thinking' : 'idle'} title="Sona Agent" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Autonomous Agent</p>
              <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)] lg:text-3xl">Agent Queue</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Sona scouts roles, prepares application packets, explains fit, and waits for your review before anything is submitted.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => askSona('Review my Agent Queue and tell me the highest-leverage next action.', 'Agent Queue')}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-sm font-bold text-blue-600 transition-all hover:bg-blue-500/15"
            >
              <SonaMark size="xs" state="listening" />
              Ask Sona
            </button>
            <button
              type="button"
              onClick={() => router.push('/suite/job-search')}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] transition-all hover:bg-[var(--bg-hover)]"
            >
              <span className="material-symbols-rounded text-[18px]">tune</span>
              Preferences
            </button>
            <PageHelp toolId="agent-queue" />
          </div>
        </div>
      </div>

      {loading ? (
        <SonaThinkingTile
          variant="agent"
          title="Sona is loading your queue"
          description="Checking prepared packets, review windows, and next actions."
          stages={['Packets', 'Signals', 'Actions']}
        />
      ) : error ? (
        <div className="rounded-[22px] border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-600">{error}</div>
      ) : (
        <>
          <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <ActionTile icon="pending_actions" tone="amber" label="Need review" value={stats.pending} description="Packets waiting on your decision." onClick={() => { setView('command'); setStatusFilter('pending'); }} />
            <ActionTile icon="rocket_launch" tone="blue" label="High fit" value={stats.highFit} description="Strong matches Sona found." onClick={() => { setView('command'); setStatusFilter('all'); }} />
            <ActionTile icon="event_busy" tone="rose" label="Expiring" value={stats.expiring} description="Review windows closing soon." onClick={() => { setView('command'); setStatusFilter('pending'); }} />
            <ActionTile icon="task_alt" tone="emerald" label="Approved" value={stats.approved} description="Ready for manual apply." onClick={() => { setView('queue'); setStatusFilter('approved'); }} />
            <ActionTile icon="info" tone="slate" label="Checks" value={stats.risks} description="Items to inspect before submit." onClick={() => askSona('Help me resolve the checks in my Agent Queue before I apply.', 'Agent checks')} />
          </section>

          <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <QueueMetric icon="inventory_2" tone="cyan" value={stats.total} label="Total packets" />
            <QueueMetric icon="pending_actions" tone="amber" value={stats.pending} label="Pending review" onClick={() => setStatusFilter('pending')} />
            <QueueMetric icon="task_alt" tone="emerald" value={stats.approved} label="Approved packets" onClick={() => setStatusFilter('approved')} />
            <QueueMetric icon="outgoing_mail" tone="blue" value={stats.applied} label="Tracked as applied" onClick={() => setStatusFilter('applied')} />
            <QueueMetric icon="block" tone="slate" value={stats.dismissed + stats.expired} label="Skipped or expired" onClick={() => setView('history')} />
          </section>

          <div className="mb-5 flex flex-col gap-3 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--card-bg)] p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex overflow-x-auto rounded-xl bg-[var(--bg-surface)] p-1">
              {(Object.keys(VIEW_CONFIG) as QueueView[]).map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setView(key); setSelected(null); }}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                    view === key ? 'bg-[var(--card-bg)] text-blue-600 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="material-symbols-rounded text-[16px]">{VIEW_CONFIG[key].icon}</span>
                  {VIEW_CONFIG[key].label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 sm:w-72">
                <span className="material-symbols-rounded pointer-events-none absolute left-4 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center text-[20px] leading-none text-[var(--text-muted)]">search</span>
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search role, company, signal..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2.5 pl-14 pr-3 text-sm text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/15"
                />
              </div>
              <select
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value as StatusFilter)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)] outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/15"
              >
                <option value="all">All statuses</option>
                {(Object.keys(STATUS_CONFIG) as AgentQueueItem['status'][]).map(status => (
                  <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>
                ))}
              </select>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--card-bg)] p-8 text-center">
              <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-[24px] border border-blue-500/20 bg-blue-500/10">
                <SonaMark size="md" state="thinking" />
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">No packets yet</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--text-secondary)]">Agent settings live in Job Search preferences. Once Sona finds roles, packets will appear here for your review.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/suite/job-search')}
                  className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-sm font-bold text-blue-600"
                >
                  Set preferences
                </button>
                <button type="button" onClick={() => askSona('Help me set up Sona Agent for my job search.', 'Agent setup')} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-bold text-[var(--text-primary)]">Ask Sona</button>
              </div>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card-bg)] p-8 text-center">
              <AnimatedToolIcon icon="filter_alt_off" tone="slate" size="md" />
              <h2 className="mt-4 text-xl font-bold text-[var(--text-primary)]">No packets match the current filters</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">Clear the search or switch status to see the rest of the queue.</p>
            </div>
          ) : (
            <div className="flex gap-5">
              <main className="min-w-0 flex-1">
                {view === 'settings' ? (
                  <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--card-bg)] p-6">
                    <div className="flex items-start gap-4">
                      <AnimatedToolIcon icon="tune" tone="blue" size="md" />
                      <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Agent settings live in Job Search preferences</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Set target roles, cities, salary floor, autonomy level, nightly limits, minimum score, excluded companies, and the opt-in Sona digest email.</p>
                        <button
                          type="button"
                          onClick={() => router.push('/suite/job-search')}
                          className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-sm font-bold text-blue-600"
                        >
                          Open preferences
                        </button>
                      </div>
                    </div>
                  </div>
                ) : view === 'board' ? (
                  <div className="grid gap-4 xl:grid-cols-5">
                    {groupedBoard.map(group => (
                      <section key={group.status} className="min-w-0 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card-bg)] p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--text-primary)]">{STATUS_CONFIG[group.status].label}</span>
                          <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">{group.items.length}</span>
                        </div>
                        <div className="space-y-2">
                          {group.items.map(item => (
                            <button key={item.id} type="button" onClick={() => setSelected(item)} className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-left transition-all hover:border-[var(--border)]">
                              <p className="line-clamp-2 text-sm font-bold leading-5 text-[var(--text-primary)]">{item.job_title}</p>
                              <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{item.company}</p>
                              <p className="mt-2 text-xs font-black tabular-nums text-blue-600">{item.match_score}%</p>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {view === 'command' && needsAttention.length > 0 && (
                      <section>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">Needs attention</h2>
                            <p className="text-sm text-[var(--text-secondary)]">Highest leverage packet decisions first.</p>
                          </div>
                          <button type="button" onClick={() => askSona('Prioritize my Agent Queue and tell me what to review first.', 'Agent priority')} className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-600">Prioritize with Sona</button>
                        </div>
                        <div className="grid gap-3 xl:grid-cols-2">
                          {needsAttention.map(item => (
                            <QueueCard key={item.id} item={item} selected={selected?.id === item.id} onSelect={() => setSelected(item)} onApprove={() => runAction(item, 'approve')} onDismiss={() => runAction(item, 'dismiss')} onApply={() => runApply(item)} loading={actionLoading === item.id} />
                          ))}
                        </div>
                      </section>
                    )}

                    <section>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-[var(--text-primary)]">{view === 'history' ? 'Agent history' : 'Application packets'}</h2>
                          <p className="text-sm text-[var(--text-secondary)]">{visibleItems.length} packet{visibleItems.length === 1 ? '' : 's'} shown</p>
                        </div>
                      </div>
                      <div className="grid gap-3 xl:grid-cols-2">
                        <AnimatePresence mode="popLayout">
                          {visibleItems.map(item => (
                            <QueueCard key={item.id} item={item} selected={selected?.id === item.id} onSelect={() => setSelected(item)} onApprove={() => runAction(item, 'approve')} onDismiss={() => runAction(item, 'dismiss')} onApply={() => runApply(item)} loading={actionLoading === item.id} />
                          ))}
                        </AnimatePresence>
                      </div>
                    </section>
                  </div>
                )}
              </main>

              <AnimatePresence>
                {selected && (
                  <PacketDrawer
                    item={selected}
                    onClose={() => setSelected(null)}
                    onApprove={() => runAction(selected, 'approve')}
                    onDismiss={() => runAction(selected, 'dismiss')}
                    onApply={() => runApply(selected)}
                    onFeedback={(tag) => toggleFeedback(selected, tag)}
                    actionLoading={actionLoading === selected.id}
                  />
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}
