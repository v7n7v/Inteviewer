'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { getJobApplications, updateApplicationStatus, deleteJobApplication, type JobApplication } from '@/lib/database-suite';
import { showToast } from '@/components/Toast';

const STATUS_COLORS = {
    not_applied: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-300', label: 'Not Applied' },
    applied: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-300', label: 'Applied' },
    screening: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-300', label: 'Screening' },
    interview_scheduled: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-300', label: 'Interview Scheduled' },
    interviewed: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-300', label: 'Interviewed' },
    offer: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-300', label: 'Offer Received' },
    rejected: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-300', label: 'Rejected' },
    accepted: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-300', label: 'Accepted' },
    withdrawn: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-300', label: 'Withdrawn' },
};

export default function ApplicationsPage() {
    const { user } = useStore();
    const [applications, setApplications] = useState<JobApplication[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
    const [showStatusModal, setShowStatusModal] = useState(false);

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
            showToast(`Status updated to: ${STATUS_COLORS[newStatus].label}`, '✅');
            loadApplications();
            setShowStatusModal(false);
        } else {
            showToast('Failed to update status', '❌');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this application?')) return;
        const result = await deleteJobApplication(id);
        if (result.success) {
            showToast('Application deleted', '🗑️');
            loadApplications();
        }
    };

    const filteredApplications = applications.filter(app => {
        const matchesSearch = app.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            app.job_title?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const stats = {
        total: applications.length,
        applied: applications.filter(a => a.status === 'applied' || a.status === 'screening' || a.status === 'interview_scheduled' || a.status === 'interviewed').length,
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
                className="mb-8"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                        <span className="text-3xl">📊</span>
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold gradient-text">Application Tracker</h1>
                        <p className="text-slate-400">Track {applications.length} job applications</p>
                    </div>
                </div>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Total Applications', value: stats.total, icon: '📝', color: 'from-slate-500 to-slate-600' },
                    { label: 'In Process', value: stats.applied, icon: '🚀', color: 'from-blue-500 to-cyan-500' },
                    { label: 'Interviews', value: stats.interviews, icon: '🎤', color: 'from-purple-500 to-indigo-500' },
                    { label: 'Offers', value: stats.offers, icon: '🎉', color: 'from-green-500 to-emerald-500' },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-white/10"
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

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search companies or positions..."
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                >
                    <option value="all">All Statuses</option>
                    {Object.entries(STATUS_COLORS).map(([key, value]) => (
                        <option key={key} value={key}>{value.label}</option>
                    ))}
                </select>
            </div>

            {/* Applications Grid */}
            {isLoading ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Loading applications...</p>
                </div>
            ) : filteredApplications.length === 0 ? (
                <div className="text-center py-12">
                    <span className="text-6xl mb-4 block">📭</span>
                    <h3 className="text-xl font-bold text-white mb-2">No Applications Yet</h3>
                    <p className="text-slate-400 mb-6">Start by morphing a resume for a specific company!</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredApplications.map((app, i) => (
                        <motion.div
                            key={app.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="relative group rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-white/10 p-6 hover:border-cyan-500/30 transition-all overflow-hidden"
                        >
                            {/* Glow effect on hover */}
                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="relative z-10">
                                {/* Company Icon & Name */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-2xl">
                                            {app.company_name[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg">{app.company_name}</h3>
                                            {app.job_title && <p className="text-sm text-slate-400">{app.job_title}</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Talent Density Score */}
                                {app.talent_density_score && (
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-slate-500">Talent Density</span>
                                            <span className={`text-sm font-bold ${app.talent_density_score >= 80 ? 'text-green-400' : app.talent_density_score >= 60 ? 'text-cyan-400' : 'text-yellow-400'}`}>
                                                {app.talent_density_score}%
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${app.talent_density_score}%` }}
                                                transition={{ duration: 1, delay: i * 0.1 }}
                                                className={`h-full ${app.talent_density_score >= 80 ? 'bg-green-500' : app.talent_density_score >= 60 ? 'bg-cyan-500' : 'bg-yellow-500'}`}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Status Badge */}
                                <div className="mb-4">
                                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${STATUS_COLORS[app.status].bg} ${STATUS_COLORS[app.status].border} border ${STATUS_COLORS[app.status].text}`}>
                                        {STATUS_COLORS[app.status].label}
                                    </span>
                                </div>

                                {/* Dates */}
                                <div className="space-y-1 mb-4 text-xs text-slate-500">
                                    <div>Morphed: {new Date(app.created_at).toLocaleDateString()}</div>
                                    {app.applied_at && <div>Applied: {new Date(app.applied_at).toLocaleDateString()}</div>}
                                    {app.interview_date && <div>Interview: {new Date(app.interview_date).toLocaleDateString()}</div>}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setSelectedApp(app); setShowStatusModal(true); }}
                                        className="flex-1 px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-sm hover:bg-cyan-500/30 transition-colors"
                                    >
                                        Update Status
                                    </button>
                                    <button
                                        onClick={() => handleDelete(app.id)}
                                        className="px-3 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-colors"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Status Update Modal */}
            <AnimatePresence>
                {showStatusModal && selectedApp && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowStatusModal(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        />
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 p-6"
                            >
                                <h3 className="text-xl font-bold text-white mb-4">Update Status</h3>
                                <p className="text-slate-400 mb-6">{selectedApp.company_name} - {selectedApp.job_title}</p>

                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(STATUS_COLORS).map(([key, value]) => (
                                        <button
                                            key={key}
                                            onClick={() => handleStatusUpdate(selectedApp, key as JobApplication['status'])}
                                            className={`p-3 rounded-xl text-sm font-medium transition-all ${value.bg} ${value.border} border ${value.text} hover:scale-105`}
                                        >
                                            {value.label}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setShowStatusModal(false)}
                                    className="w-full mt-4 px-4 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
