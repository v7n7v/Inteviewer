'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import {
    getJobApplications, updateApplicationStatus, deleteJobApplication,
    getResumeVersions, getAllStudyProgress, type JobApplication, type ResumeVersion, type StudyProgress
} from '@/lib/database-suite';
import { downloadResumePDF } from '@/lib/pdf-templates';
import { showToast } from '@/components/Toast';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

const STATUS_CONFIG = {
    not_applied: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-silver', label: 'Not Applied', icon: <span className="material-symbols-rounded text-[14px]">edit_document</span>, gradient: 'from-slate-500 to-slate-600' },
    applied: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-300', label: 'Applied', icon: <span className="material-symbols-rounded text-[14px]">send</span>, gradient: 'from-blue-500 to-cyan-500' },
    screening: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-300', label: 'Screening', icon: <span className="material-symbols-rounded text-[14px]">visibility</span>, gradient: 'from-cyan-500 to-teal-500' },
    interview_scheduled: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-300', label: 'Interview Scheduled', icon: <span className="material-symbols-rounded text-[14px]">calendar_month</span>, gradient: 'from-cyan-500 to-indigo-500' },
    interviewed: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-300', label: 'Interviewed', icon: <span className="material-symbols-rounded text-[14px]">mic</span>, gradient: 'from-indigo-500 to-violet-500' },
    offer: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-300', label: 'Offer Received', icon: <span className="material-symbols-rounded text-[14px]">celebration</span>, gradient: 'from-green-500 to-emerald-500' },
    rejected: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-300', label: 'Rejected', icon: <span className="material-symbols-rounded text-[14px]">cancel</span>, gradient: 'from-red-500 to-rose-500' },
    accepted: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-300', label: 'Accepted', icon: <span className="material-symbols-rounded text-[14px]">check_circle</span>, gradient: 'from-emerald-500 to-green-500' },
    withdrawn: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-300', label: 'Withdrawn', icon: <span className="material-symbols-rounded text-[14px]">undo</span>, gradient: 'from-orange-500 to-amber-500' },
};

type ViewMode = 'grid' | 'list';

export default function ApplicationsPage() {
    const { user } = useStore();
    const [applications, setApplications] = useState<JobApplication[]>([]);
    const [allProgress, setAllProgress] = useState<StudyProgress[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [editingNotes, setEditingNotes] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [linkedResume, setLinkedResume] = useState<ResumeVersion | null>(null);
    const [resumeLoading, setResumeLoading] = useState(false);
    const [showResumePreview, setShowResumePreview] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);

    useEffect(() => {
        loadApplications();
    }, []);

    const loadApplications = async () => {
        setIsLoading(true);
        const [appResult, progResult] = await Promise.all([
            getJobApplications(),
            getAllStudyProgress()
        ]);
        if (appResult.success && appResult.data) {
            setApplications(appResult.data);
        }
        if (progResult.success && progResult.data) {
            setAllProgress(progResult.data);
        }
        setIsLoading(false);
    };

    const getApplicationProgress = (appId: string) => {
        const appProgresses = allProgress.filter(p => p.application_ids?.includes(appId));
        if (appProgresses.length === 0) return null;

        let totalCompleted = 0;
        let totalPossible = 0;

        appProgresses.forEach(p => {
            const expectedDays = p.total_days || 7;
            totalCompleted += p.completed_days.length;
            totalPossible += expectedDays;
        });

        if (totalPossible === 0) return 0;
        return Math.round((totalCompleted / totalPossible) * 100);
    };

    const handleStatusUpdate = async (app: JobApplication, newStatus: JobApplication['status']) => {
        const additionalData: any = {};
        if (newStatus === 'applied' && !app.applied_at) {
            additionalData.appliedAt = new Date();
        }
        const result = await updateApplicationStatus(app.id, newStatus, additionalData);
        if (result.success) {
            showToast(`Status updated to: ${STATUS_CONFIG[newStatus].label}`, 'check_circle');
            loadApplications();
            if (selectedApp?.id === app.id) {
                setSelectedApp({ ...app, status: newStatus });
            }
        } else {
            showToast('Failed to update status', 'cancel');
        }
    };

    const handleNotesUpdate = async () => {
        if (!selectedApp) return;
        const result = await updateApplicationStatus(selectedApp.id, selectedApp.status, { notes: editingNotes });
        if (result.success) {
            showToast('Notes saved!', 'edit_document');
            loadApplications();
            setSelectedApp({ ...selectedApp, notes: editingNotes });
        } else {
            showToast('Failed to save notes', 'cancel');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this application? This cannot be undone.')) return;
        const result = await deleteJobApplication(id);
        if (result.success) {
            showToast('Application deleted', 'delete');
            loadApplications();
            if (selectedApp?.id === id) {
                setShowDetailModal(false);
                setSelectedApp(null);
            }
        }
    };

    const openDetailModal = async (app: JobApplication) => {
        setSelectedApp(app);
        setEditingNotes(app.notes || '');
        setShowDetailModal(true);
        setLinkedResume(null);
        setShowResumePreview(false);

        // Fetch linked resume
        if (app.resume_version_id) {
            setResumeLoading(true);
            const versions = await getResumeVersions();
            if (versions.success && versions.data) {
                const found = versions.data.find(v => v.id === app.resume_version_id);
                setLinkedResume(found || null);
            }
            setResumeLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!linkedResume?.content) return;
        setDownloading(true);
        try {
            await downloadResumePDF(linkedResume.content as any, { primary: '#0ea5e9', accent: '#06b6d4', text: '#1a202c' });
            showToast('PDF downloaded!', 'check_circle');
        } catch (error: any) {
            showToast(`PDF failed: ${error.message}`, 'cancel');
        }
        setDownloading(false);
    };

    const handleDownloadWord = async () => {
        if (!linkedResume?.content) return;
        const resume = linkedResume.content as any;
        setDownloading(true);
        try {
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        new Paragraph({ children: [new TextRun({ text: resume.name || '', bold: true, size: 48 })] }),
                        new Paragraph({ children: [new TextRun({ text: resume.title || '', size: 28, color: "666666" })] }),
                        new Paragraph({ children: [new TextRun({ text: [resume.email, resume.phone, resume.location].filter(Boolean).join(' • '), size: 20 })] }),
                        new Paragraph({ text: '' }),
                        ...(resume.summary ? [
                            new Paragraph({ text: 'PROFESSIONAL SUMMARY', heading: HeadingLevel.HEADING_2 }),
                            new Paragraph({ text: resume.summary }),
                            new Paragraph({ text: '' }),
                        ] : []),
                        ...(resume.experience?.length ? [
                            new Paragraph({ text: 'EXPERIENCE', heading: HeadingLevel.HEADING_2 }),
                            ...resume.experience.flatMap((exp: any) => [
                                new Paragraph({ children: [new TextRun({ text: `${exp.role} at ${exp.company}`, bold: true }), new TextRun({ text: ` (${exp.duration})`, italics: true })] }),
                                ...exp.achievements.map((a: string) => new Paragraph({ text: `• ${a}`, indent: { left: 360 } })),
                                new Paragraph({ text: '' }),
                            ]),
                        ] : []),
                        ...(resume.education?.length ? [
                            new Paragraph({ text: 'EDUCATION', heading: HeadingLevel.HEADING_2 }),
                            ...resume.education.map((edu: any) => new Paragraph({ text: `${edu.degree} - ${edu.institution} (${edu.year})` })),
                            new Paragraph({ text: '' }),
                        ] : []),
                        ...(resume.skills?.length ? [
                            new Paragraph({ text: 'SKILLS', heading: HeadingLevel.HEADING_2 }),
                            ...resume.skills.map((cat: any) => new Paragraph({ text: `${cat.category}: ${cat.items.join(', ')}` })),
                        ] : []),
                    ],
                }],
            });
            const blob = await Packer.toBlob(doc);
            saveAs(blob, `${resume.name?.replace(/\s+/g, '_') || 'resume'}.docx`);
            showToast('Word document downloaded!', 'check_circle');
        } catch { showToast('Download failed', 'cancel'); }
        setDownloading(false);
    };

    const filteredApplications = applications.filter(app => {
        const matchesSearch = app.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            app.job_title?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const stats = {
        total: applications.length,
        active: applications.filter(a => !['rejected', 'withdrawn', 'accepted'].includes(a.status)).length,
        interviews: applications.filter(a => a.status === 'interview_scheduled' || a.status === 'interviewed').length,
        offers: applications.filter(a => a.status === 'offer' || a.status === 'accepted').length,
    };

    return (
        <div className="min-h-screen p-6 lg:p-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl glass-card p-8 mb-8"
            >
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/30 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/30 rounded-full blur-3xl" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shadow-inner">
                            <span className="material-symbols-rounded text-3xl">bar_chart</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                                Application Tracker
                            </h1>
                            <p className="text-[var(--text-secondary)] text-sm">Track and manage your job applications</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Total Applications', value: stats.total, icon: 'description', colorClass: 'bg-slate-500/10 border-slate-500/20 text-slate-500' },
                    { label: 'Active', value: stats.active, icon: 'send', colorClass: 'bg-blue-500/10 border-blue-500/20 text-blue-500' },
                    { label: 'Interviews', value: stats.interviews, icon: 'mic', colorClass: 'bg-violet-500/10 border-violet-500/20 text-violet-500' },
                    { label: 'Offers', value: stats.offers, icon: 'celebration', colorClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)] hover:shadow-lg transition-all group cursor-default"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner transition-transform duration-300 group-hover:scale-110 ${stat.colorClass}`}>
                                <span className="material-symbols-rounded text-[24px]">{stat.icon}</span>
                            </div>
                            <span className="text-3xl font-black text-[var(--text-primary)]">
                                {stat.value}
                            </span>
                        </div>
                        <p className="text-xs md:text-sm font-medium text-[var(--text-secondary)]">{stat.label}</p>
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
                        placeholder="Search companies or positions..."
                        className="flex-1 px-4 py-3 rounded-xl glass-card text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                    />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-3 rounded-xl glass-card text-white focus:outline-none focus:border-cyan-500/50"
                    >
                        <option value="all">All Statuses</option>
                        {Object.entries(STATUS_CONFIG).map(([key, value]) => (
                            <option key={key} value={key}>{value.icon} {value.label}</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-1 p-1 rounded-xl glass-card">
                    {[
                        { mode: 'grid' as ViewMode, icon: 'grid_view', label: 'Grid' },
                        { mode: 'list' as ViewMode, icon: 'view_list', label: 'List' },
                    ].map((v) => (
                        <button
                            key={v.mode}
                            onClick={() => setViewMode(v.mode)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === v.mode
                                ? 'bg-[var(--theme-bg-elevated)] border border-[var(--theme-border)] text-cyan-600 dark:text-cyan-400'
                                : 'text-silver hover:text-white'
                                }`}
                        >
                            <span className="material-symbols-rounded text-[14px] align-middle mr-1">{v.icon}</span> {v.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Applications Display */}
            {isLoading ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-silver">Loading applications...</p>
                </div>
            ) : filteredApplications.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-16"
                >
                    <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 shadow-inner">
                        <span className="material-symbols-rounded text-5xl">inventory_2</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">No Applications Yet</h3>
                    <p className="text-silver mb-6 max-w-md mx-auto">
                        Start by morphing a resume for a specific job. Your applications will appear here for tracking.
                    </p>
                    <a
                        href="/suite/resume"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--theme-bg-elevated)] border border-[var(--theme-border)] text-cyan-600 dark:text-cyan-400 font-bold hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                    >
                        <span className="material-symbols-rounded text-[18px]">transform</span> Morph a Resume
                    </a>
                </motion.div>
            ) : viewMode === 'grid' ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredApplications.map((app, i) => (
                        <ApplicationCard
                            key={app.id}
                            app={app}
                            index={i}
                            onStatusUpdate={handleStatusUpdate}
                            onDelete={handleDelete}
                            onOpenDetail={openDetailModal}
                            skillProgress={getApplicationProgress(app.id)}
                        />
                    ))}
                </div>
            ) : (
                <div className="rounded-2xl glass-card overflow-visible">
                    <table className="w-full" style={{ overflow: 'visible' }}>
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left p-4 text-silver font-medium">Company</th>
                                <th className="text-left p-4 text-silver font-medium">Position</th>
                                <th className="text-left p-4 text-silver font-medium">Status</th>
                                <th className="text-left p-4 text-silver font-medium">Match</th>
                                <th className="text-left p-4 text-silver font-medium">Skill Bridge</th>
                                <th className="text-left p-4 text-silver font-medium">Date</th>
                                <th className="text-right p-4 text-silver font-medium">Actions</th>
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
                                            <div className={`w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-lg font-bold text-indigo-500`}>
                                                {app.company_name[0]}
                                            </div>
                                            <span className="font-medium text-white">{app.company_name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-silver">{app.job_title || '-'}</td>
                                    <td className="p-4">
                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setStatusDropdownId(statusDropdownId === app.id ? null : app.id); }}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium ${STATUS_CONFIG[app.status].bg} ${STATUS_CONFIG[app.status].border} border ${STATUS_CONFIG[app.status].text} hover:scale-105 transition-all cursor-pointer`}
                                            >
                                                {STATUS_CONFIG[app.status].icon} {STATUS_CONFIG[app.status].label}
                                                <span className="text-[10px] opacity-60 ml-1"><span className="material-symbols-rounded text-inherit align-middle">arrow_drop_down</span></span>
                                            </button>
                                            <AnimatePresence>
                                                {statusDropdownId === app.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -10 }}
                                                        className="absolute top-full left-0 mt-2 p-2 rounded-xl glass-card shadow-2xl z-50 min-w-[200px]"
                                                    >
                                                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                                            <button
                                                                key={key}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleStatusUpdate(app, key as JobApplication['status']);
                                                                    setStatusDropdownId(null);
                                                                }}
                                                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${app.status === key ? 'bg-white/10' : 'hover:bg-white/5'} ${config.text}`}
                                                            >
                                                                {config.icon} {config.label}
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {app.talent_density_score ? (
                                            <span className={`font-bold ${app.talent_density_score >= 80 ? 'text-green-400' : app.talent_density_score >= 60 ? 'text-cyan-400' : 'text-yellow-400'}`}>
                                                {app.talent_density_score}%
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="p-4">
                                        {(() => {
                                            const prog = getApplicationProgress(app.id);
                                            if (prog === null) return <span className="text-silver">-</span>;
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold ${prog >= 100 ? 'text-indigo-400' : 'text-cyan-400'}`}>{prog}%</span>
                                                    <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                                                        <div className={`h-full ${prog >= 100 ? 'bg-indigo-500' : 'bg-cyan-500'}`} style={{ width: `${prog}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="p-4 text-silver text-sm">
                                        {new Date(app.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(app.id); }}
                                            className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                                        >
                                            <span className="material-symbols-rounded text-[16px]">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Detail Modal with Resume Preview & Download */}
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
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl glass-card overflow-y-auto shadow-2xl"
                            >
                                {/* Header */}
                                <div className="p-5 border-b border-white/10 flex items-center gap-4 sticky top-0 bg-[var(--theme-bg-card)] z-10">
                                    <div className="w-12 h-12 rounded-[1.25rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl font-bold text-indigo-500 shadow-inner">
                                        {selectedApp.company_name[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-lg font-bold text-white truncate">{selectedApp.company_name}</h2>
                                        <p className="text-sm text-silver truncate">{selectedApp.job_title || 'Position not specified'}</p>
                                    </div>
                                    {selectedApp.talent_density_score && (
                                        <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${selectedApp.talent_density_score >= 80 ? 'bg-green-500/20 text-green-400' : selectedApp.talent_density_score >= 60 ? 'bg-cyan-500/20 text-cyan-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                            {selectedApp.talent_density_score}%
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setShowDetailModal(false)}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-silver hover:text-white transition-colors"
                                    >
                                        <span className="material-symbols-rounded align-middle mr-1">close</span>
                                    </button>
                                </div>

                                {/* Status Grid */}
                                <div className="p-4 border-b border-white/10">
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {Object.entries(STATUS_CONFIG).slice(0, 5).map(([key, config]) => (
                                            <button
                                                key={key}
                                                onClick={() => handleStatusUpdate(selectedApp, key as JobApplication['status'])}
                                                className={`p-2 rounded-lg text-center transition-all ${selectedApp.status === key
                                                    ? `${config.bg} border ${config.border} ${config.text} shadow-sm font-bold`
                                                    : 'bg-white/5 hover:bg-white/10 text-silver'
                                                    }`}
                                            >
                                                <span className="text-base block">{config.icon}</span>
                                                <span className="text-[10px] leading-tight block mt-0.5">{config.label.split(' ')[0]}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                                        {Object.entries(STATUS_CONFIG).slice(5).map(([key, config]) => (
                                            <button
                                                key={key}
                                                onClick={() => handleStatusUpdate(selectedApp, key as JobApplication['status'])}
                                                className={`p-2 rounded-lg text-center transition-all ${selectedApp.status === key
                                                    ? `${config.bg} border ${config.border} ${config.text} shadow-sm font-bold`
                                                    : 'bg-white/5 hover:bg-white/10 text-silver'
                                                    }`}
                                            >
                                                <span className="text-base block">{config.icon}</span>
                                                <span className="text-[10px] leading-tight block mt-0.5">{config.label.split(' ')[0]}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ===== RESUME PREVIEW & DOWNLOAD ===== */}
                                <div className="p-4 border-b border-white/10">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                            <span className="material-symbols-rounded text-[18px] text-[var(--text-muted)]">description</span> Saved Resume
                                        </h3>
                                        {linkedResume && (
                                            <button
                                                onClick={() => setShowResumePreview(!showResumePreview)}
                                                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                                            >
                                                {showResumePreview ? 'Hide Preview' : 'Show Preview'}
                                            </button>
                                        )}
                                    </div>

                                    {resumeLoading ? (
                                        <div className="flex items-center gap-2 py-3">
                                            <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                                            <span className="text-xs text-silver">Loading resume...</span>
                                        </div>
                                    ) : linkedResume ? (
                                        <div className="space-y-3">
                                            {/* Resume Info Bar */}
                                            <div className="flex items-center gap-3 p-3 rounded-xl glass-card">
                                                <div className="w-10 h-10 rounded-lg bg-[var(--tag-cyan-bg)] text-[var(--tag-cyan-text)] flex items-center justify-center">
                                                    <span className="material-symbols-rounded text-lg">description</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white truncate">
                                                        {linkedResume.version_name}
                                                    </p>
                                                    <p className="text-xs text-silver">
                                                        {(linkedResume.content as any)?.name || 'Resume'} • Saved {new Date(linkedResume.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Download Buttons */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleDownloadPDF}
                                                    disabled={downloading}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 text-red-300 text-sm font-medium hover:border-red-500/40 hover:bg-red-500/20 transition-all disabled:opacity-50"
                                                >
                                                    {downloading ? (
                                                        <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                                                    ) : (
                                                        <span className="material-symbols-rounded text-[18px]">picture_as_pdf</span>
                                                    )}
                                                    Download PDF
                                                </button>
                                                <button
                                                    onClick={handleDownloadWord}
                                                    disabled={downloading}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium hover:border-blue-500/40 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                                                >
                                                    {downloading ? (
                                                        <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                                                    ) : (
                                                        <span className="material-symbols-rounded text-[18px]">description</span>
                                                    )}
                                                    Download Word
                                                </button>
                                            </div>

                                            {/* Expandable Resume Preview */}
                                            <AnimatePresence>
                                                {showResumePreview && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <ResumePreviewCard resume={linkedResume.content as any} />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 p-3 rounded-xl glass-card">
                                            <span className="material-symbols-rounded text-lg text-[var(--text-muted)]">edit_document</span>
                                            <div>
                                                <p className="text-sm text-silver">No saved resume linked</p>
                                                <a href="/suite/resume" className="text-xs text-cyan-400 hover:text-cyan-300">
                                                    Go to Liquid Resume to create one →
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Notes */}
                                <div className="p-4 border-b border-white/10">
                                    <textarea
                                        value={editingNotes}
                                        onChange={(e) => setEditingNotes(e.target.value)}
                                        placeholder="Add notes..."
                                        rows={2}
                                        className="w-full px-3 py-2 rounded-lg glass-card text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none"
                                    />
                                    {editingNotes !== (selectedApp.notes || '') && (
                                        <button
                                            onClick={handleNotesUpdate}
                                            className="mt-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-medium hover:bg-cyan-500/30 transition-colors"
                                        >
                                            <span className="material-symbols-rounded text-[14px] align-middle">save</span> Save
                                        </button>
                                    )}
                                </div>

                                {/* Timeline */}
                                <div className="p-4 flex items-center justify-between text-xs text-silver border-b border-white/10">
                                    <div className="flex items-center gap-4">
                                        <span className="flex items-center gap-1.5"><span className="material-symbols-rounded text-[14px]">edit_document</span> Created {new Date(selectedApp.created_at).toLocaleDateString()}</span>
                                        {selectedApp.applied_at && <span className="flex items-center gap-1.5"><span className="material-symbols-rounded text-[14px]">send</span> Applied {new Date(selectedApp.applied_at).toLocaleDateString()}</span>}
                                    </div>
                                    <a href={`/suite/skill-bridge?applicationId=${selectedApp.id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--tag-purple-bg)] text-[var(--tag-purple-text)] font-medium hover:opacity-80 transition-opacity">
                                        <span className="material-symbols-rounded text-[16px]">route</span> Open Skill Bridge
                                    </a>
                                </div>

                                {/* Footer */}
                                <div className="p-4 pt-0 flex gap-2">
                                    <button
                                        onClick={() => handleDelete(selectedApp.id)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--tag-red-bg)] text-[var(--tag-red-text)] text-xs font-medium hover:opacity-80 transition-opacity"
                                    >
                                        <span className="material-symbols-rounded text-[16px]">delete</span> Delete
                                    </button>
                                    <button
                                        onClick={() => setShowDetailModal(false)}
                                        className="ml-auto px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
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

// ===== RESUME PREVIEW CARD =====
function ResumePreviewCard({ resume }: { resume: any }) {
    if (!resume) return null;

    return (
        <div className="mt-3 p-4 rounded-xl bg-white text-black max-h-[400px] overflow-y-auto" style={{ fontSize: '11px', lineHeight: '1.5' }}>
            {/* Header */}
            <div className="text-center border-b border-gray-200 pb-3 mb-3">
                <h2 className="text-lg font-bold text-gray-900">{resume.name || 'Your Name'}</h2>
                {resume.title && <p className="text-sm text-gray-500 mt-0.5">{resume.title}</p>}
                <p className="text-[10px] text-gray-400 mt-1">
                    {[resume.email, resume.phone, resume.location].filter(Boolean).join(' • ')}
                </p>
            </div>

            {/* Summary */}
            {resume.summary && (
                <div className="mb-3">
                    <h3 className="text-xs font-bold uppercase text-gray-700 border-b border-gray-100 pb-1 mb-1.5">
                        Professional Summary
                    </h3>
                    <p className="text-gray-600">{resume.summary}</p>
                </div>
            )}

            {/* Experience */}
            {resume.experience?.length > 0 && (
                <div className="mb-3">
                    <h3 className="text-xs font-bold uppercase text-gray-700 border-b border-gray-100 pb-1 mb-1.5">
                        Experience
                    </h3>
                    {resume.experience.map((exp: any, i: number) => (
                        <div key={i} className="mb-2">
                            <div className="flex justify-between items-baseline">
                                <span className="font-semibold text-gray-800">{exp.role}</span>
                                <span className="text-[10px] text-gray-400 ml-2 whitespace-nowrap">{exp.duration}</span>
                            </div>
                            <p className="text-gray-500 text-[10px]">{exp.company}</p>
                            {exp.achievements?.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                    {exp.achievements.slice(0, 3).map((a: string, j: number) => (
                                        <li key={j} className="text-gray-600 pl-3 relative">
                                            <span className="absolute left-0">•</span>
                                            {a}
                                        </li>
                                    ))}
                                    {exp.achievements.length > 3 && (
                                        <li className="text-gray-400 pl-3 italic">+{exp.achievements.length - 3} more</li>
                                    )}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Education */}
            {resume.education?.length > 0 && (
                <div className="mb-3">
                    <h3 className="text-xs font-bold uppercase text-gray-700 border-b border-gray-100 pb-1 mb-1.5">
                        Education
                    </h3>
                    {resume.education.map((edu: any, i: number) => (
                        <div key={i} className="flex justify-between">
                            <span className="text-gray-700">{edu.degree} — {edu.institution}</span>
                            <span className="text-[10px] text-gray-400">{edu.year}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Skills */}
            {resume.skills?.length > 0 && (
                <div>
                    <h3 className="text-xs font-bold uppercase text-gray-700 border-b border-gray-100 pb-1 mb-1.5">
                        Skills
                    </h3>
                    <div className="flex flex-wrap gap-1">
                        {resume.skills.flatMap((cat: any) => cat.items).slice(0, 15).map((skill: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ===== APPLICATION CARD =====
function ApplicationCard({
    app, index, onStatusUpdate, onDelete, onOpenDetail, skillProgress
}: {
    app: JobApplication;
    index: number;
    onStatusUpdate: (app: JobApplication, status: JobApplication['status']) => void;
    onDelete: (id: string) => void;
    onOpenDetail: (app: JobApplication) => void;
    skillProgress?: number | null;
}) {
    const [showQuickStatus, setShowQuickStatus] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`relative group rounded-2xl glass-card hover:border-cyan-500/30 transition-all ${showQuickStatus ? 'z-50' : 'z-0'}`}
        >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onOpenDetail(app)}>
                        <div className="w-14 h-14 rounded-[1.25rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl font-bold text-indigo-500 shadow-inner">
                            {app.company_name[0].toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg hover:text-cyan-400 transition-colors">{app.company_name}</h3>
                            {app.job_title && <p className="text-sm text-silver">{app.job_title}</p>}
                        </div>
                    </div>
                    <button
                        onClick={() => onDelete(app.id)}
                        className="p-2 rounded-lg text-silver hover:text-red-400 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                    >
                        <span className="material-symbols-rounded text-[16px]">delete</span>
                    </button>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {app.talent_density_score && (
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-silver">Match Score</span>
                                <span className={`text-sm font-bold ${app.talent_density_score >= 80 ? 'text-green-400' : app.talent_density_score >= 60 ? 'text-cyan-400' : 'text-yellow-400'}`}>
                                    {app.talent_density_score}%
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-[var(--theme-bg-elevated)] rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${app.talent_density_score}%` }}
                                    transition={{ duration: 1, delay: index * 0.1 }}
                                    className={`h-full ${app.talent_density_score >= 80 ? 'bg-green-500' : app.talent_density_score >= 60 ? 'bg-cyan-500' : 'bg-yellow-500'}`}
                                />
                            </div>
                        </div>
                    )}

                    {skillProgress !== null && typeof skillProgress === 'number' && (
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-silver">Skill Bridge</span>
                                <span className={`text-sm font-bold ${skillProgress >= 100 ? 'text-indigo-400' : 'text-cyan-400'}`}>
                                    {skillProgress}%
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-[var(--theme-bg-elevated)] rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${skillProgress}%` }}
                                    transition={{ duration: 1, delay: index * 0.1 }}
                                    className={`h-full ${skillProgress >= 100 ? 'bg-indigo-500' : 'bg-cyan-500'}`}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Status Badge */}
                <div className="relative mb-4">
                    <button
                        onClick={() => setShowQuickStatus(!showQuickStatus)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${STATUS_CONFIG[app.status].bg} ${STATUS_CONFIG[app.status].border} border ${STATUS_CONFIG[app.status].text} hover:scale-105 transition-all`}
                    >
                        {STATUS_CONFIG[app.status].icon} {STATUS_CONFIG[app.status].label}
                        <span className="material-symbols-rounded text-[16px] opacity-60">arrow_drop_down</span>
                    </button>

                    <AnimatePresence>
                        {showQuickStatus && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-0 mt-2 p-2 rounded-xl glass-card shadow-xl z-10 min-w-[200px]"
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
                    <div className="mb-4 p-3 rounded-lg glass-card">
                        <p className="text-xs text-silver line-clamp-2">{app.notes}</p>
                    </div>
                )}

                {/* Dates */}
                <div className="flex items-center gap-4 text-xs text-silver">
                    <span><span className="material-symbols-rounded text-[14px] mr-1 align-middle">calendar_month</span> {new Date(app.created_at).toLocaleDateString()}</span>
                    {app.applied_at && <span><span className="material-symbols-rounded text-[14px] mr-1 align-middle">rocket_launch</span> Applied {new Date(app.applied_at).toLocaleDateString()}</span>}
                </div>

                {/* View Details */}
                <button
                    onClick={() => onOpenDetail(app)}
                    className="w-full mt-4 px-4 py-2 rounded-xl bg-[var(--theme-bg-elevated)] text-silver text-sm font-medium hover:bg-white/10 transition-colors"
                >
                    View Details →
                </button>
            </div>
        </motion.div>
    );
}
