'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { getJobApplications, updateApplicationStatus, deleteJobApplication, type JobApplication } from '@/lib/database-suite';
import { showToast } from '@/components/Toast';

const STATUS_CONFIG = {
    not_applied: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-300', label: 'Not Applied', icon: '📝', gradient: 'from-slate-500 to-slate-600' },
    applied: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-300', label: 'Applied', icon: '🚀', gradient: 'from-blue-500 to-cyan-500' },
    screening: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-300', label: 'Screening', icon: '👀', gradient: 'from-cyan-500 to-teal-500' },
    interview_scheduled: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-300', label: 'Interview Scheduled', icon: '📅', gradient: 'from-cyan-500 to-indigo-500' },
    interviewed: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-300', label: 'Interviewed', icon: '🎤', gradient: 'from-indigo-500 to-violet-500' },
    offer: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-300', label: 'Offer Received', icon: '🎉', gradient: 'from-green-500 to-emerald-500' },
    rejected: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-300', label: 'Rejected', icon: '❌', gradient: 'from-red-500 to-rose-500' },
    accepted: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-300', label: 'Accepted', icon: '✅', gradient: 'from-emerald-500 to-green-500' },
    withdrawn: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-300', label: 'Withdrawn', icon: '🔙', gradient: 'from-orange-500 to-amber-500' },
};

type ViewMode = 'grid' | 'kanban' | 'list';

export default function ApplicationsPage() {
    const { user } = useStore();
    const [applications, setApplications] = useState<JobApplication[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [editingNotes, setEditingNotes] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');

    useEffect(() => {
        if (user) loadApplications();
    }, [user]);

    const loadApplications = async () => {
        setIsLoading(true);
        const result = await getJobApplications();
        if (result.success && result.data) {
            setApplications(result.data);
        }
        setIsLoading(false);
    };

    const handleStatusUpdate = async (app: JobApplication, newStatus: JobApplication['status']) => {
        const additionalData: any = {};

        // Auto-set applied_at when marking as applied
        if (newStatus === 'applied' && !app.applied_at) {
            additionalData.appliedAt = new Date();
        }

        const result = await updateApplicationStatus(app.id, newStatus, additionalData);
        if (result.success) {
            showToast(`Status updated to: ${STATUS_CONFIG[newStatus].label}`, STATUS_CONFIG[newStatus].icon);
            loadApplications();
            if (selectedApp?.id === app.id) {
                setSelectedApp({ ...app, status: newStatus });
            }
        } else {
            showToast('Failed to update status', '❌');
        }
    };

    const handleNotesUpdate = async () => {
        if (!selectedApp) return;

        const result = await updateApplicationStatus(selectedApp.id, selectedApp.status, { notes: editingNotes });
        if (result.success) {
            showToast('Notes saved!', '📝');
            loadApplications();
            setSelectedApp({ ...selectedApp, notes: editingNotes });
        } else {
            showToast('Failed to save notes', '❌');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this application? This cannot be undone.')) return;
        const result = await deleteJobApplication(id);
        if (result.success) {
            showToast('Application deleted', '🗑️');
            loadApplications();
            if (selectedApp?.id === id) {
                setShowDetailModal(false);
                setSelectedApp(null);
            }
        }
    };

    const openDetailModal = (app: JobApplication) => {
        setSelectedApp(app);
        setEditingNotes(app.notes || '');
        setShowDetailModal(true);
    };

    const filteredApplications = applications.filter(app => {
        const matchesSearch = app.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            app.job_title?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Group applications by status for Kanban view
    const kanbanColumns = ['not_applied', 'applied', 'screening', 'interview_scheduled', 'interviewed', 'offer', 'rejected', 'accepted'] as const;
    const groupedApplications = kanbanColumns.reduce((acc, status) => {
        acc[status] = filteredApplications.filter(app => app.status === status);
        return acc;
    }, {} as Record<string, JobApplication[]>);

    const stats = {
        total: applications.length,
        active: applications.filter(a => !['rejected', 'withdrawn', 'accepted'].includes(a.status)).length,
        interviews: applications.filter(a => a.status === 'interview_scheduled' || a.status === 'interviewed').length,
        offers: applications.filter(a => a.status === 'offer' || a.status === 'accepted').length,
    };

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center p-8">
                <div className="glass-card p-12 text-center max-w-md">
                    <span className="text-6xl mb-4 block">🔒</span>
                    <h2 className="text-2xl font-bold text-white mb-3">Sign In Required</h2>
                    <p className="text-slate-400">Please sign in to access your application tracker</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 lg:p-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-800/50 to-cyan-900/20 border border-white/10 p-8 mb-8"
            >
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/30 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/30 rounded-full blur-3xl" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                            <span className="text-3xl">📊</span>
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold">
                                <span className="bg-gradient-to-r from-cyan-400 to-cyan-400 bg-clip-text text-transparent">
                                    Application Tracker
                                </span>
                            </h1>
                            <p className="text-slate-400">Track and manage your job applications</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Total Applications', value: stats.total, icon: '📝', color: 'from-slate-500 to-slate-600' },
                    { label: 'Active', value: stats.active, icon: '🚀', color: 'from-blue-500 to-cyan-500' },
                    { label: 'Interviews', value: stats.interviews, icon: '🎤', color: 'from-cyan-500 to-indigo-500' },
                    { label: 'Offers', value: stats.offers, icon: '🎉', color: 'from-green-500 to-emerald-500' },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-white/10 hover:border-white/20 transition-all"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">{stat.icon}</span>
                            <span className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                                {stat.value}
                            </span>
                        </div>
                        <p className="text-sm text-slate-400">{stat.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Controls */}
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
                <div className="flex-1 flex gap-4">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="🔍 Search companies or positions..."
                        className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                    />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    >
                        <option value="all">All Statuses</option>
                        {Object.entries(STATUS_CONFIG).map(([key, value]) => (
                            <option key={key} value={key}>{value.icon} {value.label}</option>
                        ))}
                    </select>
                </div>

                {/* View Mode Toggle */}
                <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
                    {[
                        { mode: 'grid' as ViewMode, icon: '⊞', label: 'Grid' },
                        { mode: 'kanban' as ViewMode, icon: '☰', label: 'Kanban' },
                        { mode: 'list' as ViewMode, icon: '≡', label: 'List' },
                    ].map((v) => (
                        <button
                            key={v.mode}
                            onClick={() => setViewMode(v.mode)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === v.mode
                                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-500 text-white'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {v.icon} {v.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Applications Display */}
            {isLoading ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Loading applications...</p>
                </div>
            ) : filteredApplications.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-16"
                >
                    <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/20 flex items-center justify-center">
                        <span className="text-5xl">📭</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">No Applications Yet</h3>
                    <p className="text-slate-400 mb-6 max-w-md mx-auto">
                        Start by morphing a resume for a specific job. Your applications will appear here for tracking.
                    </p>
                    <a
                        href="/suite/resume"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-500 text-white font-bold hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                    >
                        🔄 Morph a Resume
                    </a>
                </motion.div>
            ) : viewMode === 'grid' ? (
                /* Grid View */
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredApplications.map((app, i) => (
                        <ApplicationCard
                            key={app.id}
                            app={app}
                            index={i}
                            onStatusUpdate={handleStatusUpdate}
                            onDelete={handleDelete}
                            onOpenDetail={openDetailModal}
                        />
                    ))}
                </div>
            ) : viewMode === 'kanban' ? (
                /* Kanban View */
                <div className="overflow-x-auto pb-4">
                    <div className="flex gap-4 min-w-max">
                        {kanbanColumns.slice(0, 6).map((status) => (
                            <div key={status} className="w-72 flex-shrink-0">
                                <div className={`p-3 rounded-t-xl ${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].border} border-b-0`}>
                                    <div className="flex items-center gap-2">
                                        <span>{STATUS_CONFIG[status].icon}</span>
                                        <span className={`font-medium ${STATUS_CONFIG[status].text}`}>
                                            {STATUS_CONFIG[status].label}
                                        </span>
                                        <span className="ml-auto px-2 py-0.5 rounded-full bg-white/10 text-xs text-white">
                                            {groupedApplications[status]?.length || 0}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-2 rounded-b-xl bg-white/5 border border-white/10 border-t-0 min-h-[400px] space-y-2">
                                    {groupedApplications[status]?.map((app) => (
                                        <motion.div
                                            key={app.id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            onClick={() => openDetailModal(app)}
                                            className="p-3 rounded-xl bg-slate-800/50 border border-white/10 cursor-pointer hover:border-cyan-500/30 transition-all"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-sm font-bold text-white">
                                                    {app.company_name[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-white text-sm truncate">{app.company_name}</p>
                                                    <p className="text-xs text-slate-400 truncate">{app.job_title}</p>
                                                </div>
                                            </div>
                                            {app.talent_density_score && (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${app.talent_density_score >= 80 ? 'bg-green-500' : app.talent_density_score >= 60 ? 'bg-cyan-500' : 'bg-yellow-500'}`}
                                                            style={{ width: `${app.talent_density_score}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-slate-400">{app.talent_density_score}%</span>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* List View */
                <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left p-4 text-slate-400 font-medium">Company</th>
                                <th className="text-left p-4 text-slate-400 font-medium">Position</th>
                                <th className="text-left p-4 text-slate-400 font-medium">Status</th>
                                <th className="text-left p-4 text-slate-400 font-medium">Match</th>
                                <th className="text-left p-4 text-slate-400 font-medium">Date</th>
                                <th className="text-right p-4 text-slate-400 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredApplications.map((app) => (
                                <tr
                                    key={app.id}
                                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                                    onClick={() => openDetailModal(app)}
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-lg font-bold text-white">
                                                {app.company_name[0]}
                                            </div>
                                            <span className="font-medium text-white">{app.company_name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-300">{app.job_title || '-'}</td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium ${STATUS_CONFIG[app.status].bg} ${STATUS_CONFIG[app.status].border} border ${STATUS_CONFIG[app.status].text}`}>
                                            {STATUS_CONFIG[app.status].icon} {STATUS_CONFIG[app.status].label}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {app.talent_density_score ? (
                                            <span className={`font-bold ${app.talent_density_score >= 80 ? 'text-green-400' : app.talent_density_score >= 60 ? 'text-cyan-400' : 'text-yellow-400'}`}>
                                                {app.talent_density_score}%
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="p-4 text-slate-400 text-sm">
                                        {new Date(app.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(app.id); }}
                                            className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Detail Modal */}
            <AnimatePresence>
                {showDetailModal && selectedApp && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDetailModal(false)}
                            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
                        />
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-2xl rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 overflow-hidden my-8"
                            >
                                {/* Header */}
                                <div className="relative p-6 border-b border-white/10">
                                    <div className={`absolute inset-0 bg-gradient-to-r ${STATUS_CONFIG[selectedApp.status].gradient} opacity-10`} />
                                    <div className="relative flex items-start gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-3xl font-bold text-white">
                                            {selectedApp.company_name[0]}
                                        </div>
                                        <div className="flex-1">
                                            <h2 className="text-2xl font-bold text-white">{selectedApp.company_name}</h2>
                                            <p className="text-slate-400">{selectedApp.job_title || 'Position not specified'}</p>
                                            {selectedApp.talent_density_score && (
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-sm text-slate-400">Match Score:</span>
                                                    <span className={`font-bold ${selectedApp.talent_density_score >= 80 ? 'text-green-400' : selectedApp.talent_density_score >= 60 ? 'text-cyan-400' : 'text-yellow-400'}`}>
                                                        {selectedApp.talent_density_score}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setShowDetailModal(false)}
                                            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>

                                {/* Status Selection */}
                                <div className="p-6 border-b border-white/10">
                                    <h3 className="text-sm font-medium text-slate-400 mb-3">Update Status</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                            <button
                                                key={key}
                                                onClick={() => handleStatusUpdate(selectedApp, key as JobApplication['status'])}
                                                className={`p-3 rounded-xl text-sm font-medium transition-all ${selectedApp.status === key
                                                        ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg`
                                                        : `${config.bg} ${config.border} border ${config.text} hover:scale-105`
                                                    }`}
                                            >
                                                <span className="text-lg block mb-1">{config.icon}</span>
                                                <span className="text-xs">{config.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Notes Section */}
                                <div className="p-6 border-b border-white/10">
                                    <h3 className="text-sm font-medium text-slate-400 mb-3">📝 Notes</h3>
                                    <textarea
                                        value={editingNotes}
                                        onChange={(e) => setEditingNotes(e.target.value)}
                                        placeholder="Add notes about this application, interview feedback, follow-up reminders..."
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 resize-none"
                                    />
                                    <button
                                        onClick={handleNotesUpdate}
                                        disabled={editingNotes === (selectedApp.notes || '')}
                                        className="mt-3 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-sm font-medium hover:bg-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        💾 Save Notes
                                    </button>
                                </div>

                                {/* Timeline */}
                                <div className="p-6">
                                    <h3 className="text-sm font-medium text-slate-400 mb-3">📅 Timeline</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 text-sm">
                                            <div className="w-8 h-8 rounded-lg bg-slate-500/20 flex items-center justify-center">📝</div>
                                            <div>
                                                <p className="text-white">Resume Morphed</p>
                                                <p className="text-slate-500">{new Date(selectedApp.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        {selectedApp.applied_at && (
                                            <div className="flex items-center gap-3 text-sm">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">🚀</div>
                                                <div>
                                                    <p className="text-white">Applied</p>
                                                    <p className="text-slate-500">{new Date(selectedApp.applied_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        )}
                                        {selectedApp.interview_date && (
                                            <div className="flex items-center gap-3 text-sm">
                                                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">🎤</div>
                                                <div>
                                                    <p className="text-white">Interview</p>
                                                    <p className="text-slate-500">{new Date(selectedApp.interview_date).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="p-6 pt-0 flex gap-3">
                                    <button
                                        onClick={() => handleDelete(selectedApp.id)}
                                        className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
                                    >
                                        🗑️ Delete Application
                                    </button>
                                    <button
                                        onClick={() => setShowDetailModal(false)}
                                        className="ml-auto px-6 py-2 rounded-lg bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

// Application Card Component
function ApplicationCard({
    app,
    index,
    onStatusUpdate,
    onDelete,
    onOpenDetail
}: {
    app: JobApplication;
    index: number;
    onStatusUpdate: (app: JobApplication, status: JobApplication['status']) => void;
    onDelete: (id: string) => void;
    onOpenDetail: (app: JobApplication) => void;
}) {
    const [showQuickStatus, setShowQuickStatus] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`relative group rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-white/10 hover:border-cyan-500/30 transition-all ${showQuickStatus ? 'z-50' : 'z-0'}`}
        >
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onOpenDetail(app)}>
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-2xl font-bold text-white">
                            {app.company_name[0].toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg hover:text-cyan-400 transition-colors">{app.company_name}</h3>
                            {app.job_title && <p className="text-sm text-slate-400">{app.job_title}</p>}
                        </div>
                    </div>
                    <button
                        onClick={() => onDelete(app.id)}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                    >
                        🗑️
                    </button>
                </div>

                {/* Match Score */}
                {app.talent_density_score && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-500">Match Score</span>
                            <span className={`text-sm font-bold ${app.talent_density_score >= 80 ? 'text-green-400' : app.talent_density_score >= 60 ? 'text-cyan-400' : 'text-yellow-400'}`}>
                                {app.talent_density_score}%
                            </span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${app.talent_density_score}%` }}
                                transition={{ duration: 1, delay: index * 0.1 }}
                                className={`h-full ${app.talent_density_score >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : app.talent_density_score >= 60 ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gradient-to-r from-yellow-500 to-orange-500'}`}
                            />
                        </div>
                    </div>
                )}

                {/* Status Badge */}
                <div className="relative mb-4">
                    <button
                        onClick={() => setShowQuickStatus(!showQuickStatus)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${STATUS_CONFIG[app.status].bg} ${STATUS_CONFIG[app.status].border} border ${STATUS_CONFIG[app.status].text} hover:scale-105 transition-all`}
                    >
                        {STATUS_CONFIG[app.status].icon} {STATUS_CONFIG[app.status].label}
                        <span className="text-xs opacity-60">▼</span>
                    </button>

                    {/* Quick Status Dropdown */}
                    <AnimatePresence>
                        {showQuickStatus && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-0 mt-2 p-2 rounded-xl bg-slate-800 border border-white/10 shadow-xl z-10 min-w-[200px]"
                            >
                                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            onStatusUpdate(app, key as JobApplication['status']);
                                            setShowQuickStatus(false);
                                        }}
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${app.status === key ? 'bg-white/10' : 'hover:bg-white/5'
                                            } ${config.text}`}
                                    >
                                        {config.icon} {config.label}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Notes Preview */}
                {app.notes && (
                    <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                        <p className="text-xs text-slate-400 line-clamp-2">{app.notes}</p>
                    </div>
                )}

                {/* Dates */}
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>📅 {new Date(app.created_at).toLocaleDateString()}</span>
                    {app.applied_at && <span>🚀 Applied {new Date(app.applied_at).toLocaleDateString()}</span>}
                </div>

                {/* View Details Button */}
                <button
                    onClick={() => onOpenDetail(app)}
                    className="w-full mt-4 px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-sm font-medium hover:bg-white/10 transition-colors"
                >
                    View Details →
                </button>
            </div>
        </motion.div>
    );
}
