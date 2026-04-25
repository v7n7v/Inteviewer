'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface SkillGapWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  newSkills: { skill: string; category: 'technical' | 'soft' | 'domain' }[];
  matchScore?: number;
}

export default function SkillGapWarningModal({ isOpen, onClose, newSkills, matchScore }: SkillGapWarningModalProps) {
  const handleBridgeGap = () => {
    // Open Skill Bridge in a NEW TAB so morphing progress is preserved
    window.open('/suite/skill-bridge', '_blank');
    onClose();
  };

  if (newSkills.length === 0) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-xl"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative px-6 pt-6 pb-4">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent" />
                <div className="relative flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
                  >
                    🌉
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      New Skills Detected
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Your morphed resume includes {newSkills.length} skill{newSkills.length > 1 ? 's' : ''} you haven't listed before
                    </p>
                  </div>
                </div>
              </div>

              {/* Score bar (optional) */}
              {matchScore && (
                <div
                  className="mx-6 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
                >
                  <span className="material-symbols-rounded text-sm" style={{ color: 'var(--success)' }}>check_circle</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>
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
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                      style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-rounded text-sm" style={{ color: 'var(--warning)' }}>
                          {s.category === 'technical' ? 'computer' : s.category === 'soft' ? 'handshake' : 'domain'}
                        </span>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {s.skill}
                        </span>
                      </div>
                      <span
                        className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.2)' }}
                      >
                        <span className="material-symbols-rounded align-middle mr-0.5 text-[10px]">warning</span>AI-Added
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div
                className="mx-6 mb-5 p-3 rounded-xl text-xs leading-relaxed"
                style={{ background: 'var(--accent-dim)', border: '1px solid rgba(26,115,232,0.12)', color: 'var(--text-secondary)' }}
              >
                <strong><span className="material-symbols-rounded align-middle mr-1 text-sm" style={{ color: 'var(--accent)' }}>lightbulb</span>Pro Tip:</strong> These skills strengthen your resume match, but you should learn the basics before your interview. Skill Bridge creates a <strong>7-day crash course</strong> to get you ready.
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 flex gap-2.5">
                <button
                  onClick={handleBridgeGap}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', boxShadow: '0 4px 12px rgba(245,158,11,0.2)' }}
                >
                  🌉 Bridge the Gap
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
