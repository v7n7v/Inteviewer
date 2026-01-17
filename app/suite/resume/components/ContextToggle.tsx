'use client';

import { motion } from 'framer-motion';

interface ContextToggleProps {
  mode: 'technical' | 'leadership';
  onModeChange: (mode: 'technical' | 'leadership') => void;
}

export default function ContextToggle({ mode, onModeChange }: ContextToggleProps) {
  return (
    <div className="glass-card p-2 inline-flex gap-2 bg-black/40">
      <button
        onClick={() => onModeChange('technical')}
        className="relative px-6 py-3 rounded-xl font-semibold transition-colors"
      >
        {mode === 'technical' && (
          <motion.div
            layoutId="context-mode"
            className="absolute inset-0 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, #00f5ff 0%, #0099ff 100%)',
            }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
          </svg>
          Technical Deep-Dive
        </span>
      </button>

      <button
        onClick={() => onModeChange('leadership')}
        className="relative px-6 py-3 rounded-xl font-semibold transition-colors"
      >
        {mode === 'leadership' && (
          <motion.div
            layoutId="context-mode"
            className="absolute inset-0 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, #bf00ff 0%, #ff00aa 100%)',
            }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          Leadership Focus
        </span>
      </button>
    </div>
  );
}
