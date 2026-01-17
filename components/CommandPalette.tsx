'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface Command {
  id: string;
  label: string;
  icon: string;
  description: string;
  path?: string;
  action?: () => void;
  category: 'navigation' | 'action' | 'suite';
  keywords: string[];
}

const commands: Command[] = [
  // Interview Suite
  { id: 'detective', label: 'Detective', icon: '🔍', description: 'CV Intelligence & Analysis', path: '/dashboard/detective', category: 'navigation', keywords: ['cv', 'resume', 'scan', 'analyze'] },
  { id: 'copilot', label: 'Co-Pilot', icon: '🎙️', description: 'Live Interview Assistant', path: '/dashboard/copilot', category: 'navigation', keywords: ['live', 'interview', 'record', 'transcribe'] },
  { id: 'calibration', label: 'Calibration', icon: '⚖️', description: 'Hybrid Grading System', path: '/dashboard/calibration', category: 'navigation', keywords: ['grade', 'score', 'evaluate', 'rate'] },
  { id: 'analytics', label: 'Analytics', icon: '📊', description: 'Insights & Reports', path: '/dashboard/analytics', category: 'navigation', keywords: ['stats', 'data', 'reports', 'insights'] },

  // Talent Suite
  { id: 'resume', label: 'Resume Builder', icon: '📄', description: 'Liquid Resume Architect', path: '/suite/resume', category: 'navigation', keywords: ['build', 'create', 'cv', 'morph'] },
  { id: 'jd-generator', label: 'JD Generator', icon: '💼', description: 'Mission Blueprint Creator', path: '/suite/jd-generator', category: 'navigation', keywords: ['job', 'description', 'posting', 'write'] },
  { id: 'practice', label: 'Shadow Interview', icon: '🎭', description: 'AI Interview Practice', path: '/suite/shadow-interview', category: 'navigation', keywords: ['practice', 'mock', 'train', 'prepare'] },
  { id: 'oracle', label: 'Market Oracle', icon: '🔮', description: '3D Career Intelligence', path: '/suite/market-oracle', category: 'navigation', keywords: ['market', 'career', 'salary', 'trends'] },

  // Suites
  { id: 'interview-suite', label: 'Interview Suite', icon: '🎯', description: 'For Hiring Teams', path: '/dashboard/detective', category: 'suite', keywords: ['hiring', 'recruit', 'interview'] },
  { id: 'talent-suite', label: 'Talent Suite', icon: '✨', description: 'For Job Seekers', path: '/suite/resume', category: 'suite', keywords: ['job', 'seeker', 'candidate'] },
  { id: 'hub', label: 'Suite Selector', icon: '🏠', description: 'Return to Hub', path: '/hub', category: 'suite', keywords: ['home', 'main', 'switch'] },
];

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const filteredCommands = commands.filter((command) => {
    if (!query) return true;
    const searchLower = query.toLowerCase();
    return (
      command.label.toLowerCase().includes(searchLower) ||
      command.description.toLowerCase().includes(searchLower) ||
      command.keywords.some(k => k.includes(searchLower))
    );
  });

  const groupedCommands = {
    suite: filteredCommands.filter(c => c.category === 'suite'),
    navigation: filteredCommands.filter(c => c.category === 'navigation'),
    action: filteredCommands.filter(c => c.category === 'action'),
  };

  const flatCommands = [...groupedCommands.suite, ...groupedCommands.navigation, ...groupedCommands.action];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Open with Cmd+K or Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen(true);
      setQuery('');
      setSelectedIndex(0);
    }

    // Close with Escape
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
    }
  }, [isOpen]);

  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, flatCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatCommands[selectedIndex]) {
      executeCommand(flatCommands[selectedIndex]);
    }
  };

  const executeCommand = (command: Command) => {
    setIsOpen(false);
    if (command.path) {
      router.push(command.path);
    } else if (command.action) {
      command.action();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Don't render on landing page
  if (pathname === '/') return null;

  return (
    <>
      {/* Keyboard shortcut hint */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-black/80 border border-white/10 backdrop-blur-xl hover:border-white/20 transition-all"
        >
          <svg className="w-4 h-4 text-silver" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs text-silver">Quick Jump</span>
          <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-silver font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Command Palette Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Palette */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
            >
              <div className="mx-4 rounded-2xl bg-[#0A0A0A] border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
                {/* Search Input */}
                <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-[#111111]">
                  <svg className="w-5 h-5 text-silver" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handlePaletteKeyDown}
                    placeholder="Search or jump to..."
                    className="flex-1 bg-transparent text-white placeholder-silver/50 outline-none text-lg"
                  />
                  <kbd className="px-2 py-1 rounded bg-[#161616] text-xs text-silver font-mono border border-white/10">ESC</kbd>
                </div>

                {/* Results */}
                <div className="max-h-[400px] overflow-y-auto p-2">
                  {flatCommands.length === 0 ? (
                    <div className="p-8 text-center text-silver">
                      <span className="text-3xl block mb-2">🔍</span>
                      No results found
                    </div>
                  ) : (
                    <>
                      {groupedCommands.suite.length > 0 && (
                        <div className="mb-2">
                          <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Suites</p>
                          {groupedCommands.suite.map((command, i) => {
                            const globalIndex = i;
                            return (
                              <CommandItem
                                key={command.id}
                                command={command}
                                isSelected={selectedIndex === globalIndex}
                                onSelect={() => executeCommand(command)}
                                onHover={() => setSelectedIndex(globalIndex)}
                              />
                            );
                          })}
                        </div>
                      )}
                      {groupedCommands.navigation.length > 0 && (
                        <div>
                          <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Navigation</p>
                          {groupedCommands.navigation.map((command, i) => {
                            const globalIndex = groupedCommands.suite.length + i;
                            return (
                              <CommandItem
                                key={command.id}
                                command={command}
                                isSelected={selectedIndex === globalIndex}
                                onSelect={() => executeCommand(command)}
                                onHover={() => setSelectedIndex(globalIndex)}
                              />
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-3 border-t border-white/10 bg-[#111111]">
                  <div className="flex items-center gap-4 text-xs text-silver">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded bg-[#161616] text-silver border border-white/10">↑↓</kbd>
                      Navigate
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded bg-[#161616] text-silver border border-white/10">↵</kbd>
                      Select
                    </span>
                  </div>
                  <span className="text-xs text-silver">TalentConsulting.io</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function CommandItem({
  command,
  isSelected,
  onSelect,
  onHover
}: {
  command: Command;
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors ${isSelected ? 'bg-[#1A1A1A] text-white border border-white/10' : 'text-silver hover:bg-[#111111]'
        }`}
    >
      <span className="text-xl">{command.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{command.label}</p>
        <p className="text-sm text-silver truncate">{command.description}</p>
      </div>
      {isSelected && (
        <svg className="w-4 h-4 text-silver" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
}
