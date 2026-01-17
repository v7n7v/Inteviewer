'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CompanyInfoModalProps {
    isOpen: boolean;
    onSubmit: (info: { companyName: string; jobTitle?: string; applicationLink?: string }) => void;
    onCancel: () => void;
    jobDescription?: string;
}

export default function CompanyInfoModal({ isOpen, onSubmit, onCancel, jobDescription }: CompanyInfoModalProps) {
    const [companyName, setCompanyName] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [applicationLink, setApplicationLink] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);

    const handleExtractFromJD = async () => {
        if (!jobDescription) return;

        setIsExtracting(true);
        try {
            // Simple extraction logic - look for common patterns
            const lines = jobDescription.split('\n');

            // Try to find company name (usually in first few lines or after "at", "with", etc.)
            const companyMatch = jobDescription.match(/(?:at|with|join)\s+([A-Z][a-zA-Z\s&]+?)(?:\s|,|\.|\n)/);
            if (companyMatch) {
                setCompanyName(companyMatch[1].trim());
            }

            // Try to find job title (usually first line or after "Position:", "Role:", etc.)
            const titleMatch = jobDescription.match(/^(.+?)(?:\n|$)/) ||
                jobDescription.match(/(?:Position|Role|Title):\s*(.+?)(?:\n|$)/i);
            if (titleMatch) {
                setJobTitle(titleMatch[1].trim());
            }
        } catch (error) {
            console.error('Extraction error:', error);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleSubmit = () => {
        if (!companyName.trim()) return;
        onSubmit({
            companyName: companyName.trim(),
            jobTitle: jobTitle.trim() || undefined,
            applicationLink: applicationLink.trim() || undefined,
        });
        // Reset form
        setCompanyName('');
        setJobTitle('');
        setApplicationLink('');
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 p-8 shadow-2xl"
                        >
                            {/* Decorative glow */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl -z-10" />

                            {/* Header */}
                            <div className="mb-6">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-4">
                                    <span className="text-3xl">🏢</span>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Company Information</h2>
                                <p className="text-slate-400 text-sm">
                                    Which company are you tailoring this resume for?
                                </p>
                            </div>

                            {/* Form */}
                            <div className="space-y-4">
                                {/* Company Name */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Company Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        placeholder="e.g., Google, Microsoft, Tesla"
                                        className="w-full px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                        autoFocus
                                    />
                                </div>

                                {/* Job Title */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Job Title <span className="text-slate-500 text-xs">(optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={jobTitle}
                                        onChange={(e) => setJobTitle(e.target.value)}
                                        placeholder="e.g., Senior Software Engineer"
                                        className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>

                                {/* Application Link */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Application URL <span className="text-slate-500 text-xs">(optional)</span>
                                    </label>
                                    <input
                                        type="url"
                                        value={applicationLink}
                                        onChange={(e) => setApplicationLink(e.target.value)}
                                        placeholder="https://company.com/careers/job-123"
                                        className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>

                                {/* AI Extract Button */}
                                {jobDescription && (
                                    <button
                                        onClick={handleExtractFromJD}
                                        disabled={isExtracting}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 text-slate-300 text-sm hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isExtracting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                Extracting...
                                            </>
                                        ) : (
                                            <>
                                                <span>✨</span>
                                                Extract from Job Description
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={onCancel}
                                    className="flex-1 px-6 py-3 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!companyName.trim()}
                                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Continue
                                </button>
                            </div>

                            {/* Helper text */}
                            <p className="text-xs text-slate-500 mt-4 text-center">
                                💡 Your resume will be auto-saved as "Resume_{companyName}_{jobTitle}_{year}"
                            </p>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
