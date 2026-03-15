'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type HelpTab = 'guides' | 'faq' | 'shortcuts' | 'contact';

// ===== GUIDE DATA =====
const guides = [
    {
        id: 'liquid-resume',
        title: 'Liquid Resume',
        icon: '📄',
        color: 'from-cyan-500 to-blue-500',
        description: 'Build and morph resumes for any job',
        sections: [
            {
                title: 'Getting Started',
                steps: [
                    'Navigate to **Liquid Resume** from the sidebar.',
                    'Choose between **Morph My Resume** (import + adapt) or **Build From Scratch**.',
                    'Morph mode: Upload your existing resume (PDF or DOCX), paste a job description, and let AI tailor it.',
                    'Build mode: Fill in your details section by section with AI-assisted suggestions.',
                ],
            },
            {
                title: 'Morph My Resume',
                steps: [
                    '**Step 1: Upload** — Drag and drop or click to upload your resume (PDF or Word supported).',
                    '**Step 2: Job Description** — Paste the target job description. The AI needs this to understand what to optimize for.',
                    '**Step 3: Morph** — Click "Morph Resume" and the AI will rewrite your resume, matching keywords, skills, and achievements to the JD.',
                    '**Step 4: Review** — Compare the original vs morphed version side by side. Edit any section you want.',
                    '**Step 5: Save & Track** — Enter the company name and save. This creates an application entry automatically.',
                ],
                tips: ['The more detailed the job description, the better the morph results. Include the full JD, not just the title.'],
            },
            {
                title: 'Build From Scratch',
                steps: [
                    'Enter your **name, title, email, phone, and location** in the header section.',
                    'Use **"✨ Generate Summary"** to create a professional summary based on your title.',
                    'Add **Experience** entries with company, role, duration, and achievements.',
                    'Click **"✨ Generate"** on any experience to get AI-suggested achievement bullets.',
                    'Add **Education** and **Skills** sections.',
                    'Choose a **template** from the template gallery to style your resume.',
                ],
                tips: ['Use the template picker at the bottom to see how your resume looks in different styles before downloading.'],
            },
            {
                title: 'Downloading Your Resume',
                steps: [
                    'Click **"📥 Download PDF"** to get a styled PDF using your selected template.',
                    'Click **"📄 Download Word"** for a `.docx` file compatible with ATS systems.',
                    'PDF files retain the visual template styling.',
                    'Word files are plain-formatted for maximum ATS compatibility.',
                ],
            },
            {
                title: 'Saving Versions',
                steps: [
                    'Click **"💾 Save Version"** after morphing or building your resume.',
                    'Enter a **version name** (e.g., "Google SWE Resume") and the **company** you\'re applying to.',
                    'Saved versions are stored in the cloud and accessible from any device.',
                    'Each saved version automatically creates an entry in the **Application Tracker**.',
                    'You can load any saved version later to re-morph it for a different job.',
                ],
            },
        ],
    },
    {
        id: 'applications',
        title: 'Application Tracker',
        icon: '📊',
        color: 'from-blue-500 to-indigo-500',
        description: 'Track and manage your job applications',
        sections: [
            {
                title: 'Overview',
                steps: [
                    'The Application Tracker shows all your saved job applications in one place.',
                    '**Stats cards** at the top show Total Applications, Active, Interviews, and Offers.',
                    'Switch between **Grid view** (cards) and **List view** (table) using the toggle.',
                    'Use the **search bar** to find applications by company or position.',
                    'Use the **status filter** dropdown to show only specific statuses.',
                ],
            },
            {
                title: 'Managing Applications',
                steps: [
                    'Click **"View Details →"** on any card to open the full application detail modal.',
                    'Change the status by clicking any status button in the modal (Applied, Screening, Interview, etc.).',
                    'Add **notes** in the notes field (e.g., interview prep, contact info, follow-up dates).',
                    'Click **"🗑️ Delete"** to permanently remove an application.',
                ],
            },
            {
                title: 'Resume Preview & Download',
                steps: [
                    'Each application links to the resume version you used when applying.',
                    'In the detail modal, you\'ll see the **"📄 Saved Resume"** section.',
                    'Click **"Show Preview"** to expand an inline mini-resume viewer.',
                    'Click **"Download PDF"** or **"Download Word"** to download the resume anytime.',
                    'If no resume is linked, click the link to go to Liquid Resume and create one.',
                ],
                tips: ['You can download your saved resume even months after applying — it\'s stored in the cloud forever.'],
            },
            {
                title: 'Application Statuses',
                steps: [
                    '**📝 Not Applied** — Saved but not yet submitted.',
                    '**🚀 Applied** — Application submitted.',
                    '**👀 Screening** — Recruiter reviewing your application.',
                    '**📅 Interview Scheduled** — Interview date set.',
                    '**🎤 Interviewed** — Completed interview(s).',
                    '**🎉 Offer Received** — Got an offer!',
                    '**✅ Accepted** — You accepted the offer.',
                    '**❌ Rejected** — Application was declined.',
                    '**🔙 Withdrawn** — You withdrew your application.',
                ],
            },
        ],
    },
    {
        id: 'jd-generator',
        title: 'JD Generator',
        icon: '💼',
        color: 'from-emerald-500 to-teal-500',
        description: 'Generate and analyze job descriptions',
        sections: [
            {
                title: 'How It Works',
                steps: [
                    'Navigate to **JD Generator** from the sidebar.',
                    'Enter a **job title** and optional details like industry, level, and skills.',
                    'Click **Generate** to create a comprehensive job description.',
                    'The AI produces a complete JD with responsibilities, qualifications, nice-to-haves, and compensation.',
                    'Copy the JD or use it directly in the Morph Resume flow.',
                ],
            },
        ],
    },
    {
        id: 'study-cards',
        title: 'Study Cards',
        icon: '🎴',
        color: 'from-rose-500 to-pink-500',
        description: 'Flash cards for interview prep',
        sections: [
            {
                title: 'Using Study Cards',
                steps: [
                    'Navigate to **Study Cards** from the sidebar.',
                    'Choose a **category** (Behavioral, Technical, System Design, etc.).',
                    'Click on a card to flip it and see the answer.',
                    'Use the navigation arrows to move between cards.',
                    'Mark cards as **"Got it"** or **"Review again"** to track your progress.',
                ],
                tips: ['Study cards are great for interview prep. Review them on your phone while commuting!'],
            },
        ],
    },
    {
        id: 'market-oracle',
        title: 'Market Oracle',
        icon: '🔮',
        color: 'from-violet-500 to-purple-500',
        description: 'AI-powered career intelligence',
        sections: [
            {
                title: 'Career Intelligence',
                steps: [
                    'Access **Market Oracle** from the sidebar.',
                    'View current **market trends** for your target role.',
                    'Analyze **salary data** across different regions and experience levels.',
                    'See **demand heatmaps** showing which skills are most in-demand.',
                    'Get **AI-recommended actions** to improve your career trajectory.',
                ],
            },
        ],
    },
    {
        id: 'settings',
        title: 'Account Settings',
        icon: '⚙️',
        color: 'from-slate-500 to-gray-500',
        description: 'Manage your account and security',
        sections: [
            {
                title: 'Accessing Settings',
                steps: [
                    'Click your **avatar** at the bottom of the sidebar.',
                    'Select **"Settings"** from the popup menu.',
                    'Alternatively, navigate directly to the Settings page from the sidebar.',
                ],
            },
            {
                title: 'Profile',
                steps: [
                    'View and edit your **display name**, phone, and bio.',
                    'See your account details: email, user ID, member since, auth provider.',
                ],
            },
            {
                title: 'Security',
                steps: [
                    '**Change Password**: Enter current password, then new password with strength indicator.',
                    '**Change Email**: Enter new email. A verification link will be sent.',
                    '**Two-Factor Auth**: Set up Google Authenticator or any TOTP app for extra security.',
                    'Scan the QR code with your authenticator app and enter the 6-digit code to verify.',
                ],
                tips: ['We strongly recommend enabling 2FA for maximum account security.'],
            },
            {
                title: 'Other Tabs',
                steps: [
                    '**Notifications**: Toggle email and push notification preferences.',
                    '**Sessions**: View active devices and login history. Revoke other sessions.',
                    '**Danger Zone**: Export your data or permanently delete your account.',
                ],
            },
        ],
    },
];

// ===== FAQ DATA =====
const faqs = [
    {
        category: '📄 Resume',
        questions: [
            { q: 'What file formats can I upload?', a: 'We support PDF (.pdf) and Word (.docx) files. The system parses them automatically using AI to extract your information.' },
            { q: 'How does the Morph feature work?', a: 'Morph analyzes your existing resume and the target job description using AI. It rewrites your experience, skills, and summary to match the JD\'s keywords and requirements while preserving your actual achievements.' },
            { q: 'Will the morphed resume pass ATS systems?', a: 'Yes! Our AI is trained to optimize for Applicant Tracking Systems. The Word download format is specifically ATS-friendly with clean formatting.' },
            { q: 'Can I save multiple versions of my resume?', a: 'Absolutely. Each time you morph or build a resume, you can save it as a named version. All versions are stored in the cloud and can be accessed from any device.' },
            { q: 'How many resumes can I save?', a: 'There\'s no limit. Save as many versions as you need — one for each job application.' },
        ],
    },
    {
        category: '📊 Applications',
        questions: [
            { q: 'How do applications get created?', a: 'Applications are automatically created when you save a resume version with a company name. You can also manually update statuses and add notes.' },
            { q: 'Can I download my saved resume from the Applications section?', a: 'Yes! Click "View Details" on any application card. You\'ll see the linked resume with PDF and Word download buttons, plus an inline preview.' },
            { q: 'What do the different statuses mean?', a: 'Statuses track your application journey: Not Applied → Applied → Screening → Interview → Offer → Accepted. You can also mark as Rejected or Withdrawn.' },
        ],
    },
    {
        category: '🔒 Account & Security',
        questions: [
            { q: 'Where is my data stored?', a: 'All data is stored in Google Firebase Firestore cloud database. Your data is encrypted and accessible from any device you log into.' },
            { q: 'How do I enable two-factor authentication?', a: 'Go to Settings → Security → Two-Factor Authentication. Click "Set Up Authenticator", scan the QR code with Google Authenticator or Authy, and enter the 6-digit code.' },
            { q: 'Can I delete my account?', a: 'Yes. Go to Settings → Danger Zone → Delete My Account. You\'ll need to type "DELETE" to confirm. This permanently removes all your data.' },
            { q: 'How do I change my password?', a: 'Go to Settings → Security → Change Password. Enter your current password, then your new password. We show a strength meter to help you choose a strong one.' },
        ],
    },
    {
        category: '🌐 General',
        questions: [
            { q: 'Can I use this on my phone?', a: 'Yes! The platform is fully responsive and works on mobile browsers. Your data syncs across all devices.' },
            { q: 'Is there a dark mode?', a: 'The platform is dark mode by default — designed for reduced eye strain during long job search sessions.' },
            { q: 'What AI model powers the platform?', a: 'We use Google Gemini AI for resume morphing, summary generation, achievement suggestions, and career intelligence analysis.' },
            { q: 'Is my resume data used to train AI?', a: 'No. Your personal data is never used to train any AI models. It\'s only processed temporarily to generate your results.' },
        ],
    },
];

// ===== KEYBOARD SHORTCUTS =====
const shortcuts = [
    { category: 'Navigation', items: [
        { keys: ['⌘', 'K'], desc: 'Open Command Palette / Quick Jump' },
        { keys: ['⌘', 'B'], desc: 'Toggle sidebar' },
        { keys: ['Esc'], desc: 'Close modals and popups' },
    ]},
    { category: 'Resume Builder', items: [
        { keys: ['⌘', 'S'], desc: 'Save current resume version' },
        { keys: ['⌘', 'D'], desc: 'Download as PDF' },
        { keys: ['⌘', 'Shift', 'D'], desc: 'Download as Word' },
    ]},
    { category: 'General', items: [
        { keys: ['⌘', '/'], desc: 'Open Help page' },
        { keys: ['⌘', ','], desc: 'Open Settings' },
        { keys: ['⌘', 'Shift', 'L'], desc: 'Sign out' },
    ]},
];

const TABS: { id: HelpTab; label: string; icon: string }[] = [
    { id: 'guides', label: 'How-To Guides', icon: '📖' },
    { id: 'faq', label: 'FAQ', icon: '❓' },
    { id: 'shortcuts', label: 'Shortcuts', icon: '⌨️' },
    { id: 'contact', label: 'Contact & Support', icon: '💬' },
];

export default function HelpPage() {
    const [activeTab, setActiveTab] = useState<HelpTab>('guides');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGuide, setExpandedGuide] = useState<string | null>(null);
    const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

    const filteredGuides = guides.filter(g =>
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.sections.some(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.steps.some(step => step.toLowerCase().includes(searchQuery.toLowerCase()))
        )
    );

    const filteredFaqs = faqs.map(cat => ({
        ...cat,
        questions: cat.questions.filter(q =>
            q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
            q.a.toLowerCase().includes(searchQuery.toLowerCase())
        ),
    })).filter(cat => cat.questions.length > 0);

    return (
        <div className="min-h-screen p-6 lg:p-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl bg-[#0A0A0A] border border-white/10 p-8 mb-8"
            >
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/30 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                            <span className="text-3xl">📚</span>
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold">
                                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                                    Help & How-To
                                </span>
                            </h1>
                            <p className="text-silver">Everything you need to master the Talent Suite</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="max-w-xl mt-4">
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-silver">🔍</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search guides, FAQs, shortcuts..."
                                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
                            />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id
                            ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300 shadow-lg'
                            : 'bg-[#0A0A0A] border border-white/10 text-silver hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {activeTab === 'guides' && (
                    <motion.div key="guides" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
                        {/* Quick Start Banner */}
                        {!searchQuery && (
                            <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-6 mb-6">
                                <h3 className="text-lg font-bold text-white mb-2">🚀 Quick Start</h3>
                                <div className="grid md:grid-cols-3 gap-4 text-sm">
                                    <div className="flex items-start gap-2">
                                        <span className="mt-0.5 text-amber-400 font-bold">1.</span>
                                        <p className="text-silver">Upload your resume in <strong className="text-white">Liquid Resume</strong></p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="mt-0.5 text-amber-400 font-bold">2.</span>
                                        <p className="text-silver">Paste a job description and click <strong className="text-white">Morph</strong></p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="mt-0.5 text-amber-400 font-bold">3.</span>
                                        <p className="text-silver">Save, download, and track in <strong className="text-white">Applications</strong></p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Guide Cards */}
                        {filteredGuides.map((guide) => (
                            <div key={guide.id} className="rounded-2xl bg-[#0A0A0A] border border-white/10 overflow-hidden">
                                <button
                                    onClick={() => setExpandedGuide(expandedGuide === guide.id ? null : guide.id)}
                                    className="w-full p-6 flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${guide.color} flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform`}>
                                            {guide.icon}
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-lg font-bold text-white">{guide.title}</h3>
                                            <p className="text-sm text-silver">{guide.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-silver bg-white/5 px-2 py-1 rounded-lg">{guide.sections.length} guides</span>
                                        <motion.svg animate={{ rotate: expandedGuide === guide.id ? 180 : 0 }} className="w-5 h-5 text-silver" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </motion.svg>
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {expandedGuide === guide.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-6 pb-6 space-y-6">
                                                {guide.sections.map((section, si) => (
                                                    <div key={si} className="relative">
                                                        <h4 className="text-base font-semibold text-white mb-3 flex items-center gap-3">
                                                            <span className={`w-7 h-7 rounded-lg bg-gradient-to-br ${guide.color} flex items-center justify-center text-xs text-white font-bold`}>
                                                                {si + 1}
                                                            </span>
                                                            {section.title}
                                                        </h4>
                                                        <div className="pl-10 space-y-2">
                                                            {section.steps.map((step, stepI) => (
                                                                <div key={stepI} className="flex gap-3">
                                                                    <span className="w-1.5 h-1.5 mt-2 rounded-full bg-silver/40 flex-shrink-0" />
                                                                    <p className="text-sm text-silver leading-relaxed"
                                                                        dangerouslySetInnerHTML={{
                                                                            __html: step.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-medium">$1</strong>')
                                                                        }}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {section.tips && section.tips.length > 0 && (
                                                            <div className="ml-10 mt-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
                                                                <span className="text-base mt-0.5">💡</span>
                                                                <div className="text-xs text-amber-200/80">
                                                                    {section.tips.map((tip, ti) => <p key={ti}>{tip}</p>)}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </motion.div>
                )}

                {activeTab === 'faq' && (
                    <motion.div key="faq" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
                        {filteredFaqs.map((category) => (
                            <div key={category.category}>
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">{category.category}</h3>
                                <div className="space-y-2">
                                    {category.questions.map((faq, i) => {
                                        const faqKey = `${category.category}-${i}`;
                                        return (
                                            <div key={i} className="rounded-xl bg-[#0A0A0A] border border-white/10 overflow-hidden">
                                                <button
                                                    onClick={() => setExpandedFaq(expandedFaq === faqKey ? null : faqKey)}
                                                    className="w-full p-4 flex items-center justify-between text-left"
                                                >
                                                    <span className="text-sm font-medium text-white pr-4">{faq.q}</span>
                                                    <motion.svg animate={{ rotate: expandedFaq === faqKey ? 180 : 0 }} className="w-4 h-4 text-silver flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </motion.svg>
                                                </button>
                                                <AnimatePresence>
                                                    {expandedFaq === faqKey && (
                                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                                            <div className="px-4 pb-4">
                                                                <p className="text-sm text-silver leading-relaxed">{faq.a}</p>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}

                {activeTab === 'shortcuts' && (
                    <motion.div key="shortcuts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                        {shortcuts.map((group) => (
                            <div key={group.category} className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <span>⌨️</span> {group.category}
                                </h3>
                                <div className="space-y-3">
                                    {group.items.map((shortcut, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                                            <span className="text-sm text-silver">{shortcut.desc}</span>
                                            <div className="flex gap-1.5">
                                                {shortcut.keys.map((key, ki) => (
                                                    <kbd key={ki} className="px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-white/10 text-white text-xs font-mono shadow-sm">
                                                        {key}
                                                    </kbd>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}

                {activeTab === 'contact' && (
                    <motion.div key="contact" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                        {/* Support Channels */}
                        <div className="grid md:grid-cols-3 gap-4">
                            {[
                                { icon: '📧', title: 'Email Support', desc: 'Get help via email', action: 'support@talentconsulting.io', color: 'from-blue-500/10 to-cyan-500/10', border: 'border-blue-500/20' },
                                { icon: '💬', title: 'Live Chat', desc: 'Chat with our AI assistant', action: 'Click the AI bubble →', color: 'from-emerald-500/10 to-teal-500/10', border: 'border-emerald-500/20' },
                                { icon: '🐛', title: 'Report a Bug', desc: 'Help us improve', action: 'feedback@talentconsulting.io', color: 'from-red-500/10 to-rose-500/10', border: 'border-red-500/20' },
                            ].map((channel, i) => (
                                <div key={i} className={`rounded-2xl bg-gradient-to-br ${channel.color} border ${channel.border} p-6`}>
                                    <span className="text-3xl block mb-3">{channel.icon}</span>
                                    <h3 className="text-lg font-bold text-white mb-1">{channel.title}</h3>
                                    <p className="text-sm text-silver mb-3">{channel.desc}</p>
                                    <p className="text-sm text-cyan-400 font-medium">{channel.action}</p>
                                </div>
                            ))}
                        </div>

                        {/* Feedback Form */}
                        <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><span>📝</span> Send Feedback</h3>
                            <div className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Your Name</label>
                                        <input type="text" placeholder="Enter your name" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                                        <input type="email" placeholder="your@email.com" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
                                    <select className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-500/50">
                                        <option value="bug">🐛 Bug Report</option>
                                        <option value="feature">✨ Feature Request</option>
                                        <option value="general">💬 General Feedback</option>
                                        <option value="other">📋 Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Message</label>
                                    <textarea rows={4} placeholder="Tell us what's on your mind..." className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-none" />
                                </div>
                                <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:shadow-lg hover:shadow-amber-500/25 transition-all">
                                    📤 Send Feedback
                                </button>
                            </div>
                        </div>

                        {/* Platform Info */}
                        <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                            <h3 className="text-lg font-bold text-white mb-4">ℹ️ Platform Info</h3>
                            <div className="grid md:grid-cols-2 gap-3">
                                {[
                                    { label: 'Version', value: 'Talent Suite v1.0' },
                                    { label: 'AI Engine', value: 'Google Gemini' },
                                    { label: 'Cloud Storage', value: 'Firebase Firestore' },
                                    { label: 'Auth Provider', value: 'Firebase Auth' },
                                ].map((info, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                                        <span className="text-sm text-silver">{info.label}</span>
                                        <span className="text-sm text-white font-medium">{info.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
