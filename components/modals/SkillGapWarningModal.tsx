'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';

interface SkillGapWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  newSkills: { skill: string; category: 'technical' | 'soft' | 'domain' }[];
  matchScore?: number;
}

export default function SkillGapWarningModal({ isOpen, onClose, newSkills, matchScore }: SkillGapWarningModalProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const handleBridgeGap = () => {
    // Open Skill Bridge in a NEW TAB so morphing progress is preserved
    window.open('/suite/skill-bridge', '_blank');
    onClose();
  };

  if (newSkills.length === 0) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl ${
              isLight ? 'bg-white' : 'bg-[var(--theme-bg-elevated)]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Gradient */}
            <div className="relative px-6 pt-6 pb-4">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent" />
              <div className="relative flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                  isLight ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/10 border border-amber-500/20'
                }`}>
                  🌉
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                    New Skills Detected
                  </h3>
                  <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-white/40'}`}>
                    Your morphed resume includes {newSkills.length} skill{newSkills.length > 1 ? 's' : ''} you haven't listed before
                  </p>
                </div>
              </div>
            </div>

            {/* Score bar (optional) */}
            {matchScore && (
              <div className={`mx-6 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg ${
                isLight ? 'bg-emerald-50 border border-emerald-200' : 'bg-emerald-500/10 border border-emerald-500/20'
              }`}>
                <span className="text-sm"><span className="material-symbols-rounded">check_circle</span></span>
                <span className={`text-xs font-medium ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  Resume match score: {matchScore}%
                </span>
              </div>
            )}

            {/* Skills list */}
            <div className="px-6 pb-4">
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {newSkills.map((s, i) => (
                  <motion.div
                    key={s.skill}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${
                      isLight
                        ? 'bg-amber-50/80 border border-amber-200/60'
                        : 'bg-amber-500/[0.06] border border-amber-500/[0.12]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm">
                        {s.category === 'technical' ? 'computer' : s.category === 'soft' ? '🤝' : 'domain'}
                      </span>
                      <span className={`text-sm font-medium ${isLight ? 'text-gray-800' : 'text-white/80'}`}>
                        {s.skill}
                      </span>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                      isLight
                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      <span className="material-symbols-rounded align-middle mr-1">warning</span> AI-Added
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className={`mx-6 mb-5 p-3 rounded-xl text-xs leading-relaxed ${
              isLight
                ? 'bg-blue-50 border border-blue-200 text-blue-700'
                : 'bg-blue-500/[0.06] border border-blue-500/[0.12] text-blue-300/70'
            }`}>
              <strong><span className="material-symbols-rounded align-middle mr-1">lightbulb</span> Pro Tip:</strong> These skills strengthen your resume match, but you should learn the basics before your interview. Skill Bridge creates a <strong>7-day crash course</strong> to get you ready.
            </div>

            {/* Actions */}
            <div className={`px-6 pb-6 flex gap-3`}>
              <button
                onClick={handleBridgeGap}
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
              >
                🌉 Bridge the Gap
              </button>
              <button
                onClick={onClose}
                className={`px-5 py-3 rounded-xl text-sm font-medium transition-all ${
                  isLight
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'bg-white/[0.05] text-white/50 hover:bg-white/[0.08]'
                }`}
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
