'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function JobSearchPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative max-w-2xl w-full"
            >
                {/* Background glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-purple-500/20 rounded-3xl blur-3xl" />

                {/* Card */}
                <div className="relative rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 border border-white/10 p-12 text-center backdrop-blur-xl">
                    {/* Icon */}
                    <motion.div
                        animate={{
                            y: [0, -10, 0],
                            rotate: [0, 5, -5, 0]
                        }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="text-8xl mb-6"
                    >
                        🔍
                    </motion.div>

                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 mb-6"
                    >
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="text-sm font-medium text-cyan-400">Coming Soon</span>
                    </motion.div>

                    {/* Title */}
                    <h1 className="text-4xl lg:text-5xl font-bold mb-4">
                        <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Job Search
                        </span>
                    </h1>

                    {/* Description */}
                    <p className="text-slate-400 text-lg mb-8 max-w-md mx-auto">
                        Smart job discovery that searches, curates, and recommends opportunities
                        tailored to your skills and career goals.
                    </p>

                    {/* Features preview */}
                    <div className="grid md:grid-cols-3 gap-4 mb-8">
                        {[
                            { icon: '🌐', title: 'Multi-Source', desc: 'Jobs from top platforms' },
                            { icon: '🎯', title: 'AI Matching', desc: 'Personalized recommendations' },
                            { icon: '⚡', title: 'One-Click Apply', desc: 'Morph resume & apply' },
                        ].map((feature, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + i * 0.1 }}
                                className="p-4 rounded-xl bg-white/5 border border-white/10"
                            >
                                <span className="text-2xl block mb-2">{feature.icon}</span>
                                <h3 className="font-semibold text-white text-sm">{feature.title}</h3>
                                <p className="text-xs text-slate-500">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </div>

                    {/* CTA */}
                    <Link href="/suite/resume">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                        >
                            Build Your Resume First →
                        </motion.button>
                    </Link>

                    <p className="text-xs text-slate-500 mt-4">
                        Having a polished resume ready will help you get better job matches!
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
