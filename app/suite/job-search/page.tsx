'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface Job {
    id: number;
    title: string;
    company: string;
    location: string;
    type: string;
    salary: string;
    logo: string;
    tags: string[];
    description: string;
    match: number;
    posted: string;
}

const MOCK_JOBS: Job[] = [
    { id: 1, title: 'Senior Frontend Engineer', company: 'NVIDIA', location: 'Santa Clara, CA', type: 'Full-time', salary: '$180k - $220k', logo: 'smart_toy', tags: ['React', 'WebGL', 'Performance'], description: 'Join our core compute team to build the next generation of AI visualization tools and high-performance WebGL interfaces.', match: 94, posted: '2hrs ago' },
    { id: 2, title: 'Principal Software Engineer', company: 'Anthropic', location: 'San Francisco, CA (Hybrid)', type: 'Full-time', salary: '$200k - $280k', logo: 'psychology', tags: ['TypeScript', 'Node.js', 'Architecture'], description: 'Help build safe and reliable AI systems at scale. You will lead the architecture of our primary chat interfaces.', match: 88, posted: '5hrs ago' },
    { id: 3, title: 'Full Stack React Developer', company: 'Stripe', location: 'Remote', type: 'Contract', salary: '$120 - $150 / hr', logo: 'credit_card', tags: ['Next.js', 'PostgreSQL', 'Tailwind'], description: 'Modernize our internal billing dashboards with Next.js App Router and create seamless data visualization components.', match: 85, posted: '1d ago' },
    { id: 4, title: 'Creative Technologist', company: 'Vercel', location: 'Remote', type: 'Full-time', salary: '$160k - $190k', logo: 'rocket_launch', tags: ['Framer Motion', 'React', 'Three.js'], description: 'Push the boundaries of web UI and create stunning, animated marketing experiences that showcase the power of the web.', match: 91, posted: '2d ago' },
    { id: 5, title: 'AI Automation Specialist', company: 'OpenAI', location: 'San Francisco, CA', type: 'Full-time', salary: '$170k - $240k', logo: 'auto_awesome', tags: ['Python', 'LLMs', 'Agentic Systems'], description: 'Design robust pipelines for autonomous agent operations and integrate cutting-edge LLMs into enterprise workflows.', match: 78, posted: '3d ago' },
    { id: 6, title: 'Senior UI/UX Engineer', company: 'Linear', location: 'Remote', type: 'Full-time', salary: '$150k - $200k', logo: 'straighten', tags: ['Figma', 'React', 'CSS'], description: 'Craft pixel-perfect experiences for the fastest issue tracker on earth. Your obsession with interaction design will shine here.', match: 96, posted: '3d ago' },
    { id: 7, title: 'Mobile Platform Architect', company: 'Apple', location: 'Cupertino, CA', type: 'Full-time', salary: '$210k - $260k', logo: 'smartphone', tags: ['iOS', 'Swift', 'System Design'], description: 'Architect foundation frameworks for the next generation of spatial computing experiences.', match: 82, posted: '4d ago' },
    { id: 8, title: 'Data Visualization Lead', company: 'Bloomberg', location: 'New York, NY', type: 'Full-time', salary: '$190k - $230k', logo: 'bar_chart', tags: ['D3.js', 'Canvas', 'Finance'], description: 'Build high-frequency charting libraries that power global financial terminals.', match: 89, posted: '1w ago' }
];

export default function JobSearchPage() {
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [activeFilter, setActiveFilter] = useState<string>('All');
    
    const filters = ['All', 'Remote', 'Full-time', 'Contract', 'Top Matches'];

    const filteredJobs = MOCK_JOBS.filter(job => {
        if (activeFilter === 'All') return true;
        if (activeFilter === 'Top Matches') return job.match > 90;
        return job.type.includes(activeFilter) || job.location.includes(activeFilter);
    });

    return (
        <div className="min-h-screen p-6 relative flex flex-col h-screen overflow-hidden">
            {/* Background Atmosphere */}
            <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-5%] w-[30vw] h-[30vw] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Header / Search Area */}
            <div className="flex-shrink-0 mb-6 z-10 w-full max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <span className="text-4xl text-cyan-400">
                                Global Jobs
                            </span>
                        </h1>
                        <p className="text-[var(--text-secondary)] mt-1">Discover opportunities tailored to your morphed persona.</p>
                    </div>
                </div>

                <div className="w-full flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <span className="material-symbols-rounded absolute left-4 top-1/2 -translate-y-1/2 text-xl">search</span>
                        <input 
                            type="text" 
                            placeholder="Search by title, skill, or company..." 
                            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-[var(--theme-surface-hover)] border border-[var(--theme-border)] shadow-[var(--theme-shadow)] focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 text-[var(--text-primary)] transition-all font-medium"
                        />
                    </div>
                    <button className="px-8 py-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all flex items-center justify-center gap-2">
                        <span><span className="material-symbols-rounded">auto_awesome</span></span> Smart Match
                    </button>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                    {filters.map(filter => (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                activeFilter === filter 
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                                : 'bg-[var(--theme-surface-hover)] border border-[var(--theme-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area - Panoramic Layout */}
            <div className="flex-1 w-full max-w-7xl mx-auto flex gap-6 min-h-0 relative z-10">
                {/* Job Grid Layer */}
                <motion.div 
                    layout
                    className={`h-full overflow-y-auto pr-2 scrollbar-thin transition-all duration-500 ease-in-out ${
                        selectedJob ? 'w-1/2 md:w-5/12 hidden md:block' : 'w-full'
                    }`}
                >
                    <div className={`grid gap-4 ${selectedJob ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                        <AnimatePresence mode="popLayout">
                            {filteredJobs.map((job) => (
                                <motion.div
                                    layoutId={`job-card-${job.id}`}
                                    key={job.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    whileHover={{ scale: selectedJob?.id === job.id ? 1 : 1.02 }}
                                    onClick={() => setSelectedJob(job)}
                                    className={`cursor-pointer rounded-2xl p-5 border transition-all ${
                                        selectedJob?.id === job.id 
                                        ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.15)]' 
                                        : 'bg-[var(--theme-bg-card)] border-[var(--theme-border)] shadow-[var(--theme-shadow)] hover:border-cyan-500/30'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-[var(--theme-surface-active)] border border-[var(--theme-border)] flex items-center justify-center text-2xl shadow-sm">
                                            <span className="material-symbols-rounded">{job.logo}</span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                                                job.match > 90 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                            }`}>
                                                {job.match}% Match
                                            </span>
                                            <span className="text-xs text-[var(--text-tertiary)]">{job.posted}</span>
                                        </div>
                                    </div>
                                    
                                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1 leading-tight">{job.title}</h3>
                                    <p className="text-[var(--text-secondary)] font-medium mb-4">{job.company}</p>

                                    <div className="flex flex-col gap-2 mb-4">
                                        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                                            <span className="material-symbols-rounded text-base">public</span> {job.location}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                                            <span className="material-symbols-rounded text-base">payments</span> <span className="text-emerald-400 font-medium">{job.salary}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 mt-auto pt-4 border-t border-[var(--theme-border)]">
                                        {job.tags.slice(0,3).map(tag => (
                                            <span key={tag} className="px-2 py-1 bg-[var(--theme-surface-hover)] border border-[var(--theme-border)] rounded-md text-[11px] text-[var(--text-secondary)]">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* Panoramic Details Panel */}
                <AnimatePresence>
                    {selectedJob && (
                        <motion.div
                            layoutId={`job-panel-${selectedJob.id}`}
                            initial={{ opacity: 0, x: 50, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 50, scale: 0.95 }}
                            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                            className="w-full md:w-7/12 h-full flex flex-col rounded-3xl bg-[var(--theme-bg-card)] border border-[var(--theme-border)] shadow-2xl overflow-hidden relative z-20"
                        >
                            {/* Close Button Mobile */}
                            <button 
                                onClick={() => setSelectedJob(null)}
                                className="md:hidden absolute top-4 right-4 w-10 h-10 bg-black/20 rounded-full flex items-center justify-center text-white z-50 backdrop-blur-md"
                            >
                                <span className="material-symbols-rounded align-middle mr-1">close</span>
                            </button>

                            {/* Panel Header */}
                            <div className="relative p-8 border-b border-[var(--theme-border)] bg-gradient-to-b from-cyan-500/5 to-transparent">
                                <div className="absolute top-0 right-0 p-8 opacity-10 blur-md pointer-events-none">
                                    <span className="text-[150px] leading-none">{selectedJob.logo}</span>
                                </div>
                                
                                <div className="flex items-start gap-5 relative z-10">
                                    <div className="w-20 h-20 rounded-2xl bg-[var(--theme-bg-elevated)] border-2 border-[var(--theme-border)] flex items-center justify-center text-4xl shadow-xl">
                                        {selectedJob.logo}
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-1 leading-tight">{selectedJob.title}</h2>
                                                <div className="flex items-center gap-3 text-lg font-medium text-cyan-400">
                                                    <span>{selectedJob.company}</span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/50" />
                                                    <span className="text-[var(--text-secondary)] text-base">{selectedJob.type}</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => setSelectedJob(null)}
                                                className="hidden md:flex w-8 h-8 items-center justify-center rounded-full bg-[var(--theme-surface-hover)] border border-[var(--theme-border)] text-[var(--text-secondary)] hover:text-white transition-colors"
                                            >
                                                <span className="material-symbols-rounded align-middle mr-1">close</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Panel Body */}
                            <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="p-4 rounded-2xl bg-[var(--theme-surface-hover)] border border-[var(--theme-border)]">
                                        <span className="text-[var(--text-tertiary)] text-xs uppercase tracking-wider font-bold mb-1 block">Location</span>
                                        <p className="text-[var(--text-primary)] font-medium flex items-center gap-2"><span className="material-symbols-rounded text-lg">public</span> {selectedJob.location}</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-[var(--theme-surface-hover)] border border-[var(--theme-border)]">
                                        <span className="text-[var(--text-tertiary)] text-xs uppercase tracking-wider font-bold mb-1 block">Compensation</span>
                                        <p className="text-emerald-400 font-medium flex items-center gap-2"><span className="material-symbols-rounded text-lg">payments</span> {selectedJob.salary}</p>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                        <span><span className="material-symbols-rounded">edit_document</span></span> Role Overview
                                    </h3>
                                    <p className="text-[var(--text-secondary)] leading-relaxed text-[15px]">
                                        {selectedJob.description}
                                    </p>
                                </div>

                                <div className="mb-8">
                                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                        <span><span className="material-symbols-rounded">my_location</span></span> Required Skills
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedJob.tags.map(tag => (
                                            <span key={tag} className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-sm text-cyan-400 font-medium">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Panel Footer */}
                            <div className="p-6 border-t border-[var(--theme-border)] bg-[var(--theme-bg-elevated)]">
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                                <span><span className="material-symbols-rounded">psychology</span></span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-[var(--text-primary)] mb-0.5">Perfect Match</p>
                                                <p className="text-[11px] text-[var(--text-secondary)]">We found an optimized persona for this role.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/25 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2">
                                        <span><span className="material-symbols-rounded">bolt</span></span> Morph & Apply
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
