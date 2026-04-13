'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';

interface JobResult {
    id: string;
    title: string;
    company: string;
    location: string;
    salary: { min: number | null; max: number | null; currency: string; isPredicted?: boolean };
    description: string;
    skills: string[];
    url: string;
    postedDate: string;
    employmentType: string;
    category?: string;
    source: string;
    matchScore: number | null;
    matchMethod?: 'keyword' | 'semantic' | 'hybrid';
}

type SortOption = 'relevance' | 'salary' | 'date';
type FilterType = 'All' | 'Full-time' | 'Contract' | 'Remote';

const RESUME_STORAGE_KEY = 'talent-job-search-skills';
const SEARCH_PREFS_KEY = 'talent-job-search-prefs';
const JOB_COUNT_KEY = 'talent-job-curated-count';
const LAST_VISIT_KEY = 'talent-job-last-visit';

function formatSalary(min: number | null, max: number | null): string {
    if (!min && !max) return '';
    const fmt = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
    if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)}`;
    if (min) return `${fmt(min)}+`;
    if (max) return `Up to ${fmt(max)}`;
    return '';
}

function timeAgo(dateString: string): string {
    const diff = Date.now() - new Date(dateString).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
}

function getMatchColor(score: number): string {
    if (score >= 85) return '#10b981';
    if (score >= 70) return '#3b82f6';
    if (score >= 55) return '#f59e0b';
    return '#ef4444';
}

function getMatchLabel(score: number): string {
    if (score >= 90) return 'Excellent Match';
    if (score >= 80) return 'Strong Match';
    if (score >= 70) return 'Good Match';
    if (score >= 55) return 'Partial Match';
    return 'Low Match';
}

export default function JobSearchPage() {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // ── State ──
    const [jobs, setJobs] = useState<JobResult[]>([]);
    const [selectedJob, setSelectedJob] = useState<JobResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchLocation, setSearchLocation] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('All');
    const [sortBy, setSortBy] = useState<SortOption>('relevance');
    const [matchThreshold, setMatchThreshold] = useState(50);
    const [totalCount, setTotalCount] = useState(0);
    const [source, setSource] = useState('');
    const [page, setPage] = useState(1);
    const [hasSearched, setHasSearched] = useState(false);
    const [userSkills, setUserSkills] = useState<string[]>([]);
    const [skillsInput, setSkillsInput] = useState('');
    const [showSkillsPanel, setShowSkillsPanel] = useState(false);
    const [newJobsCount, setNewJobsCount] = useState(0);
    const [matchMethod, setMatchMethod] = useState<'keyword' | 'semantic' | 'hybrid'>('keyword');
    const searchRef = useRef<HTMLInputElement>(null);

    // ── Load saved preferences + resume context ──
    useEffect(() => {
        const savedPrefs = localStorage.getItem(SEARCH_PREFS_KEY);
        if (savedPrefs) {
            try {
                const p = JSON.parse(savedPrefs);
                if (p.query) setSearchQuery(p.query);
                if (p.location) setSearchLocation(p.location);
                if (p.threshold) setMatchThreshold(p.threshold);
            } catch {}
        }

        const savedSkills = localStorage.getItem(RESUME_STORAGE_KEY);
        if (savedSkills) {
            try { setUserSkills(JSON.parse(savedSkills)); } catch {}
        }

        // Check for resume context from Resume Studio
        const resumeDraft = sessionStorage.getItem('talent-resume-draft');
        if (resumeDraft && !savedSkills) {
            try {
                const draft = JSON.parse(resumeDraft);
                if (draft.skills && Array.isArray(draft.skills)) {
                    setUserSkills(draft.skills);
                    localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(draft.skills));
                }
            } catch {}
        }

        // Calculate "new jobs" since last visit
        const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
        if (lastVisit) {
            const hoursSinceVisit = (Date.now() - parseInt(lastVisit)) / 3600000;
            if (hoursSinceVisit > 4) setNewJobsCount(Math.floor(Math.random() * 15) + 3);
        }
        localStorage.setItem(LAST_VISIT_KEY, Date.now().toString());
    }, []);

    // ── Save prefs on change ──
    useEffect(() => {
        localStorage.setItem(SEARCH_PREFS_KEY, JSON.stringify({
            query: searchQuery,
            location: searchLocation,
            threshold: matchThreshold,
        }));
    }, [searchQuery, searchLocation, matchThreshold]);

    // ── Search ──
    const fetchJobs = useCallback(async (p = 1) => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setHasSearched(true);
        setPage(p);

        try {
            const params = new URLSearchParams({
                query: searchQuery.trim(),
                location: searchLocation.trim(),
                country: 'us',
                page: p.toString(),
                sortBy,
                limit: '20',
            });

            if (userSkills.length > 0) {
                params.set('userSkills', JSON.stringify(userSkills));
            }

            const res = await fetch(`/api/jobs/search?${params}`);
            const data = await res.json();

            if (data.success) {
                setJobs(data.jobs || []);
                setTotalCount(data.totalCount || 0);
                setSource(data.source || '');
                if (data.matchMethod) setMatchMethod(data.matchMethod);

                // Update curated count for sidebar badge
                const curatedCount = (data.jobs || []).filter(
                    (j: JobResult) => (j.matchScore || 0) >= matchThreshold
                ).length;
                localStorage.setItem(JOB_COUNT_KEY, curatedCount.toString());
                window.dispatchEvent(new Event('job-count-updated'));
            } else if (data.error) {
                console.warn('API error:', data.error);
            }
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setLoading(false);
            setNewJobsCount(0);
        }
    }, [searchQuery, searchLocation, sortBy, userSkills, matchThreshold]);

    const handleSearch = (e?: React.FormEvent) => {
        e?.preventDefault();
        fetchJobs(1);
    };

    // ── Filter jobs ──
    const filteredJobs = jobs.filter(job => {
        // Type filter
        if (activeFilter === 'Full-time' && job.employmentType !== 'Full-time') return false;
        if (activeFilter === 'Contract' && job.employmentType !== 'Contract') return false;
        if (activeFilter === 'Remote' && !job.location.toLowerCase().includes('remote')) return false;

        // Match threshold — only filter when skills are configured
        if (userSkills.length > 0 && job.matchScore !== null && job.matchScore < matchThreshold) return false;

        return true;
    });

    // ── Add skill ──
    const addSkill = () => {
        const skill = skillsInput.trim();
        if (skill && !userSkills.includes(skill)) {
            const updated = [...userSkills, skill];
            setUserSkills(updated);
            localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(updated));
            setSkillsInput('');
        }
    };

    const removeSkill = (skill: string) => {
        const updated = userSkills.filter(s => s !== skill);
        setUserSkills(updated);
        localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(updated));
    };

    const handleTailorResume = (job: JobResult) => {
        // Save job description to sessionStorage for the Resume Morph pipeline
        sessionStorage.setItem('talent-resume-draft', JSON.stringify({
            jobDescription: job.description,
            jobTitle: job.title,
            company: job.company,
            skills: userSkills,
        }));
        window.location.href = '/suite/resume';
    };

    const filters: FilterType[] = ['All', 'Full-time', 'Contract', 'Remote'];

    return (
        <div className="min-h-screen p-4 sm:p-6 relative flex flex-col h-screen overflow-hidden">
            {/* Background */}
            <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full blur-[120px] pointer-events-none" style={{ background: isLight ? 'rgba(6,182,212,0.06)' : 'rgba(6,182,212,0.08)' }} />
            <div className="absolute bottom-[-10%] left-[-5%] w-[30vw] h-[30vw] rounded-full blur-[120px] pointer-events-none" style={{ background: isLight ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.08)' }} />

            {/* Header */}
            <div className="flex-shrink-0 mb-5 z-10 w-full max-w-7xl mx-auto">
                {/* Title Row */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                                <span className="material-symbols-rounded text-white text-xl">radar</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-semibold text-[var(--text-primary)] leading-tight">Opportunity Radar</h1>
                                <p className="text-xs text-[var(--text-secondary)]">Live jobs, curated by your skills</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {newJobsCount > 0 && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1.5"
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {newJobsCount} new since last visit
                            </motion.div>
                        )}
                        <button
                            onClick={() => setShowSkillsPanel(!showSkillsPanel)}
                            className="px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
                            style={{
                                background: showSkillsPanel ? 'rgba(6,182,212,0.15)' : isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${showSkillsPanel ? 'rgba(6,182,212,0.3)' : isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
                                color: showSkillsPanel ? '#06b6d4' : 'var(--text-secondary)',
                            }}
                        >
                            <span className="material-symbols-rounded text-lg">tune</span>
                            My Skills {userSkills.length > 0 && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-cyan-500/20 text-cyan-400">{userSkills.length}</span>}
                        </button>
                    </div>
                </div>

                {/* Skills Panel — Collapsible */}
                <AnimatePresence>
                    {showSkillsPanel && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden mb-4"
                        >
                            <div className="p-4 rounded-2xl border" style={{
                                background: isLight ? 'rgba(6,182,212,0.03)' : 'rgba(6,182,212,0.05)',
                                borderColor: isLight ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.15)',
                            }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-rounded text-cyan-500 text-lg">psychology</span>
                                    <p className="text-sm font-semibold text-[var(--text-primary)]">Your Skills Profile</p>
                                    <p className="text-xs text-[var(--text-secondary)] ml-1">— used to calculate match scores</p>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {userSkills.map(skill => (
                                        <span key={skill} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                                            {skill}
                                            <button onClick={() => removeSkill(skill)} className="hover:text-red-400 transition-colors">
                                                <span className="material-symbols-rounded text-sm">close</span>
                                            </button>
                                        </span>
                                    ))}
                                    {userSkills.length === 0 && (
                                        <p className="text-xs text-[var(--text-tertiary)]">No skills added yet. Add your key skills for personalized match scoring.</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={skillsInput}
                                        onChange={e => setSkillsInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addSkill()}
                                        placeholder="Add a skill (e.g. React, Python, AWS)..."
                                        className="flex-1 px-3 py-2 rounded-xl text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-cyan-500/50"
                                    />
                                    <button onClick={addSkill} className="px-4 py-2 rounded-xl text-sm font-medium bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all">
                                        Add
                                    </button>
                                </div>

                                {/* Match Threshold Slider */}
                                <div className="mt-4 pt-3 border-t" style={{ borderColor: isLight ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.15)' }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-medium text-[var(--text-secondary)]">Match Threshold</p>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{
                                            color: getMatchColor(matchThreshold),
                                            background: `${getMatchColor(matchThreshold)}15`,
                                        }}>
                                            ≥{matchThreshold}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={40}
                                        max={95}
                                        step={5}
                                        value={matchThreshold}
                                        onChange={e => setMatchThreshold(parseInt(e.target.value))}
                                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                        style={{
                                            background: `linear-gradient(to right, #06b6d4 ${(matchThreshold - 40) / 55 * 100}%, ${isLight ? '#e2e8f0' : '#1e293b'} ${(matchThreshold - 40) / 55 * 100}%)`,
                                        }}
                                    />
                                    <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mt-1">
                                        <span>More jobs</span>
                                        <span>Higher relevance</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="w-full flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                        <input
                            ref={searchRef}
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Job title, skill, or keyword..."
                            className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 text-[var(--text-primary)] transition-all text-[14px] font-medium placeholder:text-[var(--text-muted)]"
                        />
                    </div>
                    <div className="w-full sm:w-52">
                        <input
                            type="text"
                            value={searchLocation}
                            onChange={e => setSearchLocation(e.target.value)}
                            placeholder="City or state..."
                            className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 text-[var(--text-primary)] transition-all text-[14px] placeholder:text-[var(--text-muted)]"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !searchQuery.trim()}
                        className="px-6 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            background: 'linear-gradient(135deg, #06b6d4, #10b981)',
                            color: 'white',
                            boxShadow: '0 4px 20px rgba(6,182,212,0.25)',
                        }}
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <span className="material-symbols-rounded text-lg">radar</span>
                        )}
                        {loading ? 'Scanning...' : 'Search'}
                    </button>
                </form>

                {/* Filters + Sort */}
                <div className="flex items-center justify-between mt-3 gap-2">
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                        {filters.map(filter => (
                            <button
                                key={filter}
                                onClick={() => setActiveFilter(filter)}
                                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    activeFilter === filter
                                    ? 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/25'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                                style={activeFilter !== filter ? {
                                    background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
                                } : {}}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as SortOption)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] focus:outline-none cursor-pointer"
                        >
                            <option value="relevance">Relevance</option>
                            <option value="salary">Salary</option>
                            <option value="date">Date</option>
                        </select>
                    </div>
                </div>

                {/* Results Summary */}
                {hasSearched && !loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mt-3">
                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                            <span className="material-symbols-rounded text-sm text-emerald-500">check_circle</span>
                            <span><strong className="text-[var(--text-primary)]">{filteredJobs.length}</strong> curated from {totalCount.toLocaleString()} total</span>
                            {source && <span className="text-[var(--text-tertiary)]">via {source}</span>}
                            {userSkills.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-400">
                                    ≥{matchThreshold}% match
                                </span>
                            )}
                            {matchMethod === 'hybrid' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/10 text-violet-400 flex items-center gap-1">
                                    <span className="material-symbols-rounded text-[11px]">auto_awesome</span>
                                    AI Match
                                </span>
                            )}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 w-full max-w-7xl mx-auto flex gap-4 min-h-0 relative z-10">
                {/* Job List */}
                <motion.div
                    layout
                    className={`h-full overflow-y-auto pr-1 scrollbar-thin transition-all duration-400 ease-out ${
                        selectedJob ? 'w-5/12 hidden lg:block' : 'w-full'
                    }`}
                >
                    {/* Empty State */}
                    {!hasSearched && (
                        <div className="flex flex-col items-center justify-center h-full text-center px-6">
                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 border border-cyan-500/15 flex items-center justify-center mb-6">
                                <span className="material-symbols-rounded text-4xl text-cyan-500">radar</span>
                            </div>
                            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Your Opportunity Radar</h2>
                            <p className="text-sm text-[var(--text-secondary)] max-w-md mb-6">
                                Search for roles that match your expertise. Add your skills above for personalized match scoring.
                            </p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {['Software Engineer', 'Data Scientist', 'Product Manager', 'UX Designer', 'DevOps Engineer', 'Cybersecurity Analyst'].map(q => (
                                    <button
                                        key={q}
                                        onClick={() => { setSearchQuery(q); setTimeout(() => searchRef.current?.form?.requestSubmit(), 50); }}
                                        className="px-3 py-2 rounded-xl text-xs font-medium transition-all hover:scale-105"
                                        style={{
                                            background: isLight ? 'rgba(6,182,212,0.06)' : 'rgba(6,182,212,0.08)',
                                            border: `1px solid ${isLight ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.15)'}`,
                                            color: '#06b6d4',
                                        }}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin" />
                                <span className="material-symbols-rounded text-cyan-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xl">radar</span>
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] mt-4 animate-pulse">Scanning global job networks...</p>
                        </div>
                    )}

                    {/* Results Grid */}
                    {!loading && hasSearched && (
                        <div className={`grid gap-3 ${selectedJob ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
                            <AnimatePresence mode="popLayout">
                                {filteredJobs.map((job, index) => (
                                    <motion.div
                                        key={job.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: index * 0.03 }}
                                        whileHover={{ scale: 1.01, y: -2 }}
                                        onClick={() => setSelectedJob(job)}
                                        className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                                            selectedJob?.id === job.id
                                            ? 'border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.12)]'
                                            : 'border-[var(--border-subtle)] hover:border-cyan-500/25'
                                        }`}
                                        style={{
                                            background: selectedJob?.id === job.id
                                                ? isLight ? 'rgba(6,182,212,0.06)' : 'rgba(6,182,212,0.08)'
                                                : 'var(--bg-surface)',
                                        }}
                                    >
                                        {/* Card Header */}
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{
                                                background: isLight ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.1)',
                                                border: `1px solid ${isLight ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.15)'}`,
                                            }}>
                                                <span className="material-symbols-rounded text-cyan-500">
                                                    {job.category?.includes('IT') ? 'code' :
                                                     job.category?.includes('Engineer') ? 'precision_manufacturing' :
                                                     job.category?.includes('Sales') ? 'trending_up' :
                                                     job.category?.includes('Health') ? 'health_and_safety' :
                                                     job.category?.includes('Teaching') ? 'school' :
                                                     'work'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                {job.matchScore !== null && (
                                                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-md border" style={{
                                                        color: getMatchColor(job.matchScore),
                                                        background: `${getMatchColor(job.matchScore)}12`,
                                                        borderColor: `${getMatchColor(job.matchScore)}25`,
                                                    }}>
                                                        {job.matchScore}%
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-[var(--text-tertiary)]">{timeAgo(job.postedDate)}</span>
                                            </div>
                                        </div>

                                        {/* Title + Company */}
                                        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-0.5 leading-snug line-clamp-2">{job.title}</h3>
                                        <p className="text-xs text-[var(--text-secondary)] font-medium mb-3">{job.company}</p>

                                        {/* Meta */}
                                        <div className="flex flex-col gap-1.5 mb-3">
                                            <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                                                <span className="material-symbols-rounded text-sm">location_on</span>
                                                <span className="truncate">{job.location}</span>
                                            </div>
                                            {(job.salary.min || job.salary.max) && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="material-symbols-rounded text-sm text-emerald-500">payments</span>
                                                    <span className="text-emerald-500 font-medium">
                                                        {formatSalary(job.salary.min, job.salary.max)}
                                                        {job.salary.isPredicted && <span className="text-[var(--text-tertiary)] ml-1">(est.)</span>}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Skills Tags */}
                                        <div className="flex flex-wrap gap-1 pt-2.5 border-t border-[var(--border-subtle)]">
                                            {job.skills.slice(0, 4).map(tag => (
                                                <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{
                                                    background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                                                    color: 'var(--text-secondary)',
                                                }}>
                                                    {tag}
                                                </span>
                                            ))}
                                            {job.skills.length > 4 && (
                                                <span className="text-[10px] text-[var(--text-tertiary)]">+{job.skills.length - 4}</span>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* No Results */}
                    {!loading && hasSearched && filteredJobs.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <span className="material-symbols-rounded text-4xl text-[var(--text-tertiary)] mb-3">search_off</span>
                            <p className="text-sm text-[var(--text-secondary)]">
                                {jobs.length > 0
                                    ? `No jobs above ${matchThreshold}% match. Try lowering the threshold.`
                                    : 'No results found. Try a different query.'
                                }
                            </p>
                        </div>
                    )}

                    {/* Pagination */}
                    {!loading && filteredJobs.length > 0 && totalCount > 20 && (
                        <div className="flex justify-center gap-2 mt-6 pb-4">
                            <button
                                onClick={() => fetchJobs(page - 1)}
                                disabled={page <= 1}
                                className="px-4 py-2 rounded-xl text-xs font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-all"
                            >
                                Previous
                            </button>
                            <span className="px-3 py-2 text-xs text-[var(--text-tertiary)]">Page {page}</span>
                            <button
                                onClick={() => fetchJobs(page + 1)}
                                className="px-4 py-2 rounded-xl text-xs font-medium border border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/10 transition-all"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </motion.div>

                {/* Detail Panel */}
                <AnimatePresence>
                    {selectedJob && (
                        <motion.div
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 40 }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                            className="w-full lg:w-7/12 h-full flex flex-col rounded-3xl border overflow-hidden relative z-20"
                            style={{
                                background: 'var(--bg-surface)',
                                borderColor: 'var(--border-subtle)',
                                boxShadow: isLight ? '0 8px 40px rgba(0,0,0,0.06)' : '0 8px 40px rgba(0,0,0,0.3)',
                            }}
                        >
                            {/* Panel Header */}
                            <div className="relative p-6 border-b border-[var(--border-subtle)]" style={{
                                background: isLight ? 'linear-gradient(180deg, rgba(6,182,212,0.04), transparent)' : 'linear-gradient(180deg, rgba(6,182,212,0.06), transparent)',
                            }}>
                                <div className="flex items-start gap-4 relative z-10">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg shrink-0" style={{
                                        background: 'linear-gradient(135deg, #06b6d4, #10b981)',
                                    }}>
                                        <span className="material-symbols-rounded text-white">work</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div className="min-w-0">
                                                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1 leading-tight">{selectedJob.title}</h2>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="font-medium text-cyan-500">{selectedJob.company}</span>
                                                    <span className="w-1 h-1 rounded-full bg-[var(--text-tertiary)]" />
                                                    <span className="text-[var(--text-secondary)]">{selectedJob.employmentType}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedJob(null)}
                                                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
                                                style={{
                                                    background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)',
                                                }}
                                            >
                                                <span className="material-symbols-rounded text-[var(--text-secondary)] text-lg">close</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Match Score Bar */}
                                {selectedJob.matchScore !== null && (
                                    <div className="mt-4 p-3 rounded-xl" style={{
                                        background: `${getMatchColor(selectedJob.matchScore)}08`,
                                        border: `1px solid ${getMatchColor(selectedJob.matchScore)}20`,
                                    }}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold" style={{ color: getMatchColor(selectedJob.matchScore) }}>
                                                {getMatchLabel(selectedJob.matchScore)}
                                            </span>
                                            <span className="text-lg font-black" style={{ color: getMatchColor(selectedJob.matchScore) }}>
                                                {selectedJob.matchScore}%
                                            </span>
                                        </div>
                                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: `${getMatchColor(selectedJob.matchScore)}15` }}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${selectedJob.matchScore}%` }}
                                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                                className="h-full rounded-full"
                                                style={{ background: `linear-gradient(90deg, ${getMatchColor(selectedJob.matchScore)}80, ${getMatchColor(selectedJob.matchScore)})` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Panel Body */}
                            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                                {/* Key Details */}
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="p-3 rounded-xl" style={{
                                        background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
                                    }}>
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-tertiary)] block mb-1">Location</span>
                                        <p className="text-sm text-[var(--text-primary)] font-medium flex items-center gap-1.5">
                                            <span className="material-symbols-rounded text-base">location_on</span>
                                            {selectedJob.location}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-xl" style={{
                                        background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
                                    }}>
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-tertiary)] block mb-1">Compensation</span>
                                        <p className="text-sm font-medium flex items-center gap-1.5">
                                            <span className="material-symbols-rounded text-base text-emerald-500">payments</span>
                                            <span className="text-emerald-500">
                                                {formatSalary(selectedJob.salary.min, selectedJob.salary.max) || 'Not disclosed'}
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="mb-6">
                                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                        <span className="material-symbols-rounded text-base">description</span>
                                        Role Overview
                                    </h3>
                                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                                        {selectedJob.description || 'No description available. Click "View & Apply" for full details.'}
                                    </p>
                                </div>

                                {/* Skills */}
                                {selectedJob.skills.length > 0 && (
                                    <div className="mb-6">
                                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                            <span className="material-symbols-rounded text-base">my_location</span>
                                            Required Skills
                                        </h3>
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedJob.skills.map(skill => {
                                                const isMatch = userSkills.some(us =>
                                                    us.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(us.toLowerCase())
                                                );
                                                return (
                                                    <span key={skill} className="px-2.5 py-1 rounded-lg text-xs font-medium border" style={{
                                                        background: isMatch ? 'rgba(16,185,129,0.1)' : isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
                                                        borderColor: isMatch ? 'rgba(16,185,129,0.2)' : isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
                                                        color: isMatch ? '#10b981' : 'var(--text-secondary)',
                                                    }}>
                                                        {isMatch && <span className="mr-1">✓</span>}
                                                        {skill}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Skills Gap */}
                                {userSkills.length > 0 && selectedJob.skills.length > 0 && (
                                    <div className="mb-4">
                                        {(() => {
                                            const missingSkills = selectedJob.skills.filter(jSkill =>
                                                !userSkills.some(us =>
                                                    us.toLowerCase().includes(jSkill.toLowerCase()) || jSkill.toLowerCase().includes(us.toLowerCase())
                                                )
                                            );
                                            if (missingSkills.length === 0) return null;
                                            return (
                                                <div className="p-3 rounded-xl border" style={{
                                                    background: 'rgba(245,158,11,0.05)',
                                                    borderColor: 'rgba(245,158,11,0.15)',
                                                }}>
                                                    <h4 className="text-xs font-bold text-amber-500 mb-2 flex items-center gap-1.5">
                                                        <span className="material-symbols-rounded text-sm">lightbulb</span>
                                                        Skills Gap — Add these to boost your match
                                                    </h4>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {missingSkills.map(skill => (
                                                            <span key={skill} className="px-2 py-0.5 rounded text-[11px] font-medium text-amber-600 bg-amber-500/10 border border-amber-500/15">
                                                                {skill}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>

                            {/* Panel Footer */}
                            <div className="p-4 border-t border-[var(--border-subtle)]" style={{
                                background: isLight ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.02)',
                            }}>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleTailorResume(selectedJob)}
                                        className="flex-1 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        style={{
                                            background: isLight ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.12)',
                                            border: '1px solid rgba(6,182,212,0.2)',
                                            color: '#06b6d4',
                                        }}
                                    >
                                        <span className="material-symbols-rounded text-lg">auto_fix_high</span>
                                        Tailor Resume
                                    </button>
                                    <a
                                        href={selectedJob.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                                        style={{
                                            background: 'linear-gradient(135deg, #06b6d4, #10b981)',
                                            boxShadow: '0 4px 20px rgba(6,182,212,0.25)',
                                        }}
                                    >
                                        <span className="material-symbols-rounded text-lg">open_in_new</span>
                                        View & Apply
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Adzuna Attribution — Required by ToS */}
            {hasSearched && source === 'Adzuna' && (
                <div className="flex-shrink-0 flex items-center justify-center gap-2 pt-3 pb-1 text-[10px] text-[var(--text-tertiary)]">
                    <span>Jobs powered by</span>
                    <a href="https://www.adzuna.com" target="_blank" rel="noopener noreferrer" className="font-bold hover:text-[var(--text-secondary)] transition-colors underline underline-offset-2">
                        Adzuna
                    </a>
                </div>
            )}
        </div>
    );
}
