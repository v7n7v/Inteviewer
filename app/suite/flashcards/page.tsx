'use client';

import { motion } from 'framer-motion';

export default function FlashCardsPage() {
    return (
        <div className="min-h-screen p-6 lg:p-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl bg-[#0A0A0A] to-purple-900/20 border border-white/10 p-8 mb-8"
            >
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl" />
                </div>

                <div className="relative z-10">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 mb-4"
                    >
                        <span className="text-xs font-medium text-purple-400">Coming Soon</span>
                    </motion.div>
                    <h1 className="text-4xl lg:text-5xl font-bold mb-3">
                        <span className="text-gradient from-purple-400 to-pink-400">Study Flash Cards</span>
                    </h1>
                    <p className="text-silver text-lg max-w-xl">
                        Master technical concepts with AI-generated spaced repetition flash cards.
                    </p>
                </div>
            </motion.div>

            {/* Coming Soon Content */}
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mt-12">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-8 rounded-3xl bg-[#111111] border border-white/10 relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <span className="text-5xl mb-6 block">🧠</span>
                    <h2 className="text-2xl font-bold text-white mb-3">AI-Powered Recall</h2>
                    <p className="text-silver mb-6">
                        Our AI analyzes your resume and job description to generate personalized flash cards focusing on your weak spots.
                    </p>
                    <div className="flex gap-2">
                        <div className="h-2 w-24 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-purple-500 w-3/4" />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-8 rounded-3xl bg-[#111111] border border-white/10 relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <span className="text-5xl mb-6 block">⚡</span>
                    <h2 className="text-2xl font-bold text-white mb-3">Spaced Repetition</h2>
                    <p className="text-silver mb-6">
                        Scientifically proven learning intervals ensure you retain information long-term, just in time for your interviews.
                    </p>
                    <div className="flex gap-1 items-end h-8">
                        <div className="w-2 h-4 bg-purple-500/30 rounded-t-sm" />
                        <div className="w-2 h-6 bg-purple-500/50 rounded-t-sm" />
                        <div className="w-2 h-3 bg-purple-500/30 rounded-t-sm" />
                        <div className="w-2 h-8 bg-purple-500 rounded-t-sm" />
                        <div className="w-2 h-5 bg-purple-500/50 rounded-t-sm" />
                    </div>
                </motion.div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-center mt-12"
            >
                <button disabled className="px-8 py-4 rounded-xl bg-white/5 text-slate-400 border border-white/10 font-medium cursor-not-allowed">
                    Notifications Enabled
                </button>
                <p className="text-xs text-slate-600 mt-3">We'll notify you when this feature launches.</p>
            </motion.div>
        </div>
    );
}
