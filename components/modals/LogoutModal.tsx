'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface LogoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export default function LogoutModal({ isOpen, onClose, onConfirm }: LogoutModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-sm rounded-3xl bg-slate-900 border border-white/10 overflow-hidden shadow-2xl"
                        >
                            {/* Decorative Header */}
                            <div className="relative h-32 bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center overflow-hidden">
                                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                    <div className="w-64 h-64 bg-red-500/30 rounded-full blur-3xl animate-pulse" />
                                </div>
                                <div className="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg shadow-red-500/30 flex items-center justify-center text-4xl transform rotate-12">
                                    👋
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 text-center">
                                <h2 className="text-xl font-bold text-white mb-2">Sign Out?</h2>
                                <p className="text-slate-400 mb-8">
                                    Are you sure you want to sign out? You'll need to sign back in to access your suite.
                                </p>

                                <div className="flex gap-3">
                                    <button
                                        onClick={onClose}
                                        className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={onConfirm}
                                        className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold hover:shadow-lg hover:shadow-red-500/25 transition-all"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
