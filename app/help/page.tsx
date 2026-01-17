'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface DocSection {
    id: string;
    title: string;
    icon: string;
    description: string;
    color: string;
    content: {
        title: string;
        steps: string[];
        tips?: string[];
    }[];
}

const docs: DocSection[] = [
    {
        id: 'talent-suite',
        title: 'Talent Suite',
        icon: '✨',
        description: 'Tools for job seekers to optimize their applications.',
        color: 'from-emerald-500 to-blue-500',
        content: [
            {
                title: 'Liquid Resume',
                steps: [
                    'Navigate to **Talent Suite > Liquid Resume**.',
                    'Import your existing resume (PDF/DOCX) or start from scratch.',
                    'Use the **Morph** feature to tailor your resume for a specific Job Description.',
                    'View your **Skill Graph** to see how your skills connect to market demands.'
                ],
                tips: ['Keep your "Master Resume" updated; the AI uses it as a base for all variations.']
            },
            {
                title: 'Job Applications',
                steps: [
                    'Go to **Talent Suite > Applications**.',
                    'Use the **Kanban Board** to drag and drop applications across stages (Wishlist -> Applied -> Interview -> Offer).',
                    'Click on any card to add notes, interview dates, or specific documents.'
                ]
            },
            {
                title: 'Market Oracle',
                steps: [
                    'Access **Talent Suite > Market Oracle**.',
                    'Analyze current market trends for your role.',
                    'View salary data, demand heatmaps, and skill gaps.'
                ]
            },
            {
                title: 'Shadow Practice',
                steps: [
                    'Go to **Talent Suite > Practice**.',
                    'Start an AI-simulated interview session.',
                    'Practice answering behavioral and technical questions.',
                    'Get real-time feedback on your tone, pace, and content.'
                ],
                tips: ['Treat this like a real interview; the AI adapts to your responses.']
            }
        ]
    },
    {
        id: 'interview-suite',
        title: 'Interview Suite',
        icon: '🎯',
        description: 'Tools for hiring teams to conduct better interviews.',
        color: 'from-cyan-500 to-blue-500',
        content: [
            {
                title: 'Detective',
                steps: [
                    'Go to **Interview Suite > Detective**.',
                    'Upload a candidate\'s CV.',
                    'The AI analyzes the resume for red flags, inconsistencies, and gaps.',
                    'Review the generated "Interrogation Questions" to probe deeper during the interview.'
                ]
            },
            {
                title: 'Co-Pilot',
                steps: [
                    'Navigate to **Interview Suite > Co-Pilot** during an interview.',
                    'Start a session and enable microphone access (optional).',
                    'The AI listens (or you can type contexts) and suggests real-time follow-up questions.',
                    'Use the "Quick Actions" to mark key moments.'
                ],
                tips: ['Use Co-Pilot to ensure you cover all necessary competencies without getting stuck.']
            },
            {
                title: 'Calibration',
                steps: [
                    'After an interview, go to **Interview Suite > Calibration**.',
                    'Select the candidate and the role.',
                    'Rate the candidate on defined competencies.',
                    'The AI helps normalize scores across different interviewers to reduce bias.'
                ]
            },
            {
                title: 'JD Generator',
                steps: [
                    'Navigate to **Interview Suite > JD Generator**.',
                    'Enter the role title and key requirements.',
                    'The AI generates a comprehensive, unbiased Job Description.',
                    'Export or save the JD for use in your ATS.'
                ]
            },
            {
                title: 'Analytics',
                steps: [
                    'Go to **Interview Suite > Analytics**.',
                    'View dashboard metrics on time-to-hire, candidate quality, and interview pass rates.',
                    'Identify bottlenecks in your hiring pipeline.'
                ]
            }
        ]
    },
    {
        id: 'general',
        title: 'General & Settings',
        icon: '⚙️',
        description: 'Account management and platform configuration.',
        color: 'from-cyan-500 to-blue-500',
        content: [
            {
                title: 'Profile & Settings',
                steps: [
                    'Click your avatar in the sidebar bottom menu.',
                    'Select **Settings**.',
                    'Update your personal information, notification preferences, and API keys.',
                    'You can also change your password here.'
                ]
            },
            {
                title: 'Switching Suites',
                steps: [
                    'Use the "Switch to..." button in the sidebar to toggle between **Talent Suite** (for candidates) and **Interview Suite** (for recruiters).',
                    'Each suite has its own specialized tools and dashboard views.'
                ]
            }
        ]
    }
];

export default function HelpPage() {
    const router = useRouter();
    const [selectedDoc, setSelectedDoc] = useState<DocSection | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredDocs = docs.filter(doc =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.content.some(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
            {/* Background Ambience */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="mb-12 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-block"
                    >
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                            <span className="text-4xl">📚</span>
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl font-bold mb-4 bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent"
                    >
                        How can we help you?
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-400 max-w-2xl mx-auto text-lg"
                    >
                        Explore our comprehensive guides to master the Talent Consulting Platform.
                    </motion.p>

                    {/* Search Bar */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-8 max-w-xl mx-auto"
                    >
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl blur-md group-hover:blur-lg transition-all" />
                            <div className="relative bg-white/5 border border-white/10 rounded-xl flex items-center p-1 focus-within:border-cyan-500/50 focus-within:bg-white/10 transition-all">
                                <span className="pl-4 text-slate-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </span>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search for tools, features, or guides..."
                                    className="w-full bg-transparent border-none text-white px-4 py-3 focus:outline-none placeholder-slate-500"
                                />
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Categories Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {filteredDocs.map((doc, index) => (
                        <motion.button
                            key={doc.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 + index * 0.1 }}
                            onClick={() => setSelectedDoc(doc)}
                            className="relative group text-left h-full"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/0 rounded-2xl border border-white/10 group-hover:border-white/20 transition-all" />
                            <div className={`absolute inset-0 bg-gradient-to-br ${doc.color} opacity-0 group-hover:opacity-10 rounded-2xl transition-all duration-500`} />

                            <div className="relative p-6 h-full flex flex-col">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${doc.color} flex items-center justify-center text-2xl mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                    {doc.icon}
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-200 transition-colors">
                                    {doc.title}
                                </h3>

                                <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-1">
                                    {doc.description}
                                </p>

                                <div className="flex items-center text-sm font-medium text-cyan-400 group-hover:translate-x-1 transition-transform">
                                    View Guides
                                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </div>
                            </div>
                        </motion.button>
                    ))}
                </div>

                {/* Back Button */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-center"
                >
                    <button
                        onClick={() => router.back()}
                        className="text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Dashboard
                    </button>
                </motion.div>
            </div>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedDoc && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedDoc(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-4xl max-h-[85vh] bg-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="relative p-8 pb-6 border-b border-white/10 z-10 shrink-0">
                                <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${selectedDoc.color}`} />
                                <button
                                    onClick={() => setSelectedDoc(null)}
                                    className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>

                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${selectedDoc.color} flex items-center justify-center text-3xl shadow-lg`}>
                                        {selectedDoc.icon}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">{selectedDoc.title}</h2>
                                        <p className="text-slate-400">{selectedDoc.description}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="p-8 overflow-y-auto custom-scrollbar">
                                <div className="space-y-12">
                                    {selectedDoc.content.map((section, idx) => (
                                        <div key={idx} className="relative">
                                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                                                <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${selectedDoc.color} flex items-center justify-center text-sm`}>
                                                    {idx + 1}
                                                </span>
                                                {section.title}
                                            </h3>

                                            <div className="pl-4 border-l-2 border-white/10 ml-4 space-y-6">
                                                <div className="space-y-4">
                                                    {section.steps.map((step, stepIdx) => (
                                                        <div key={stepIdx} className="flex gap-4">
                                                            <div className="w-1.5 h-1.5 mt-2 rounded-full bg-slate-600 shrink-0" />
                                                            <p className="text-slate-300 leading-relaxed"
                                                                dangerouslySetInnerHTML={{
                                                                    __html: step.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-medium">$1</strong>')
                                                                }}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>

                                                {section.tips && section.tips.length > 0 && (
                                                    <div className="mt-4 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10 flex gap-4">
                                                        <span className="text-xl">💡</span>
                                                        <div className="text-sm text-cyan-200/80">
                                                            {section.tips.map((tip, tipIdx) => (
                                                                <p key={tipIdx}>{tip}</p>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Easter Egg */}
            <div className="absolute bottom-4 right-6 pointer-events-none opacity-20 hover:opacity-80 transition-opacity duration-300">
                <p className="text-xs font-medium bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    made with love for sona ❤️
                </p>
            </div>
        </div>
    );
}
