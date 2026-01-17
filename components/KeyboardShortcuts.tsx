'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Shortcut {
    keys: string[];
    description: string;
    category: string;
}

const shortcuts: Shortcut[] = [
    // Navigation
    { keys: ['⌘', 'K'], description: 'Open Quick Jump', category: 'Navigation' },
    { keys: ['?'], description: 'Show this help', category: 'Navigation' },
    { keys: ['Esc'], description: 'Close modal / Cancel', category: 'Navigation' },

    // Actions
    { keys: ['⌘', 'S'], description: 'Save current work', category: 'Actions' },
    { keys: ['⌘', 'Enter'], description: 'Submit / Confirm', category: 'Actions' },

    // Interview Suite
    { keys: ['G', 'D'], description: 'Go to Detective', category: 'Quick Navigation' },
    { keys: ['G', 'C'], description: 'Go to Co-Pilot', category: 'Quick Navigation' },
    { keys: ['G', 'R'], description: 'Go to Resume Builder', category: 'Quick Navigation' },
    { keys: ['G', 'H'], description: 'Go to Hub', category: 'Quick Navigation' },
];

export default function KeyboardShortcuts() {
    const [isOpen, setIsOpen] = useState(false);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
            // Check if not typing in an input
            const target = e.target as HTMLElement;
            if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                setIsOpen(true);
            }
        }
        if (e.key === 'Escape') {
            setIsOpen(false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
        if (!acc[shortcut.category]) acc[shortcut.category] = [];
        acc[shortcut.category].push(shortcut);
        return acc;
    }, {} as Record<string, Shortcut[]>);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50"
                    >
                        <div className="mx-4 rounded-2xl bg-slate-900/95 border border-white/10 shadow-2xl overflow-hidden backdrop-blur-xl">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                                        <span className="text-xl">⌨️</span>
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
                                        <p className="text-sm text-slate-400">Navigate like a pro</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Shortcuts List */}
                            <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                                    <div key={category} className="mb-6 last:mb-0">
                                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">
                                            {category}
                                        </h3>
                                        <div className="space-y-1">
                                            {categoryShortcuts.map((shortcut, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors"
                                                >
                                                    <span className="text-sm text-slate-300">{shortcut.description}</span>
                                                    <div className="flex items-center gap-1">
                                                        {shortcut.keys.map((key, j) => (
                                                            <kbd
                                                                key={j}
                                                                className="min-w-[28px] h-7 px-2 flex items-center justify-center rounded-lg bg-white/10 border border-white/10 text-xs font-mono text-slate-300"
                                                            >
                                                                {key}
                                                            </kbd>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-white/10 bg-white/5">
                                <p className="text-xs text-slate-500 text-center">
                                    Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-400">?</kbd> anytime to show this menu
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
