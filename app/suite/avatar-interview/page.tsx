'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

export default function AvatarInterviewPage() {
    const [email, setEmail] = useState('');
    const [notified, setNotified] = useState(false);

    const handleNotify = (e: React.FormEvent) => {
        e.preventDefault();
        setNotified(true);
        // TODO: Save email to waitlist
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 overflow-hidden relative">
            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto relative z-10 flex flex-col items-center justify-center min-h-[80vh] text-center">

                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-md"
                >
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                    </span>
                    <span className="text-sm font-medium text-silver">Coming Soon • Q2 2026</span>
                </motion.div>

                {/* Hero Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-6xl md:text-8xl font-bold mb-6 tracking-tight"
                >
                    <span className="bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
                        Face the
                    </span>
                    <br />
                    <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-500 bg-clip-text text-transparent animate-gradient-x">
                        Future
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-xl text-slate-400 max-w-2xl mb-12 leading-relaxed"
                >
                    Experience the world's first <strong>AI Avatar Mock Interview</strong>.
                    Real-time eye contact, micro-expression analysis, and voice stress detection.
                    <br />
                    It feels real because it is.
                </motion.p>

                {/* Feature Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mb-16">
                    {[
                        { icon: '👁️', title: 'Eye Contact', desc: 'Maintains realistic gaze and reacts to your focus.' },
                        { icon: '📉', title: 'Voice Analytics', desc: 'Detects hesitation, confidence, and filler words.' },
                        { icon: '🎭', title: 'Adaptive Persona', desc: 'Switch from "Friendly HR" to "Ruthless CTO".' }
                    ].map((feature, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 + i * 0.1 }}
                            className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-colors text-left"
                        >
                            <div className="text-3xl mb-4">{feature.icon}</div>
                            <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                            <p className="text-sm text-slate-400">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Notify Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="w-full max-w-md"
                >
                    {notified ? (
                        <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-medium">
                            You're on the list! We'll notify you when beta opens. 🚀
                        </div>
                    ) : (
                        <form onSubmit={handleNotify} className="flex gap-2">
                            <input
                                type="email"
                                placeholder="Enter your email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none transition-colors"
                            />
                            <button
                                type="submit"
                                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 font-semibold text-white hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                            >
                                Notify Me
                            </button>
                        </form>
                    )}
                </motion.div>

            </div>
        </div>
    );
}
