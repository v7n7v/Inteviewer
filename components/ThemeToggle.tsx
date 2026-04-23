'use client';

/**
 * ThemeToggle — Animated sun/moon toggle switch
 * 
 * Night: twinkling stars on dark sky. Day: warm sun with radiating glow.
 * The "knob" slides left (dark/moon) or right (light/sun) with a spring animation.
 */
import { motion } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';

interface ThemeToggleProps {
  size?: 'sm' | 'md';
  className?: string;
}

export default function ThemeToggle({ size = 'sm', className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  const dims = size === 'md'
    ? { w: 56, h: 28, knob: 22, pad: 3, iconSize: 14 }
    : { w: 44, h: 22, knob: 16, pad: 3, iconSize: 10 };

  return (
    <motion.button
      onClick={toggleTheme}
      className={`relative rounded-full cursor-pointer flex-shrink-0 ${className}`}
      style={{
        width: dims.w,
        height: dims.h,
        padding: dims.pad,
      }}
      whileTap={{ scale: 0.92 }}
      title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      aria-label={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      {/* Track background */}
      <motion.div
        className="absolute inset-0 rounded-full overflow-hidden"
        animate={{
          background: isLight
            ? 'linear-gradient(135deg, #87CEEB 0%, #60A5FA 50%, #3B82F6 100%)'
            : 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)',
        }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        {/* Stars (visible in dark mode) — twinkling */}
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: isLight ? 0 : 1 }}
          transition={{ duration: 0.3 }}
        >
          {[
            { x: '18%', y: '22%', s: 2.5 },
            { x: '32%', y: '65%', s: 2 },
            { x: '50%', y: '18%', s: 1.5 },
            { x: '12%', y: '72%', s: 2 },
            { x: '68%', y: '40%', s: 1.5 },
            { x: '42%', y: '48%', s: 1 },
            { x: '75%', y: '22%', s: 1.5 },
            { x: '25%', y: '42%', s: 1 },
          ].map((star, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: star.x,
                top: star.y,
                width: star.s,
                height: star.s,
              }}
              animate={{
                opacity: isLight ? 0 : [0.3, 1, 0.3],
                scale: isLight ? 0.5 : [0.8, 1.3, 0.8],
              }}
              transition={{
                duration: 1.5 + i * 0.2,
                delay: i * 0.15,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
            />
          ))}
        </motion.div>

        {/* Sun glow rays (visible in light mode) */}
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: isLight ? 0.7 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Warm ambient glow behind the sun */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 20,
              height: 20,
              background: 'radial-gradient(circle, rgba(253,184,19,0.4) 0%, transparent 70%)',
              right: '-2%',
              top: '-5%',
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Small floating cloud */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 12,
              height: 5,
              background: 'rgba(255,255,255,0.5)',
              borderRadius: 10,
              bottom: '30%',
              left: '12%',
            }}
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </motion.div>

      {/* Knob (sun/moon) */}
      <motion.div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: dims.knob,
          height: dims.knob,
        }}
        animate={{
          x: isLight ? dims.w - dims.knob - dims.pad * 2 : 0,
          background: isLight
            ? 'linear-gradient(135deg, #FDB813 0%, #F59E0B 100%)'
            : 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)',
          boxShadow: isLight
            ? '0 0 10px 3px rgba(253,184,19,0.5), inset 0 -1px 2px rgba(0,0,0,0.1)'
            : '0 0 8px 2px rgba(200,210,230,0.35), inset 0 -1px 2px rgba(0,0,0,0.15)',
        }}
        transition={{
          x: { type: 'spring', stiffness: 400, damping: 30 },
          background: { duration: 0.4 },
          boxShadow: { duration: 0.4 },
        }}
      >
        {/* Sun rays (light mode) */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ opacity: isLight ? 1 : 0, rotate: isLight ? 0 : -90 }}
          transition={{ duration: 0.3 }}
        >
          <svg width={dims.iconSize} height={dims.iconSize} viewBox="0 0 16 16" fill="none">
            {/* Center */}
            <circle cx="8" cy="8" r="3" fill="#92400E" opacity="0.3" />
            {/* Rays */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <motion.line
                key={angle}
                x1="8"
                y1="2"
                x2="8"
                y2="0.5"
                stroke="#92400E"
                strokeWidth="1"
                strokeLinecap="round"
                opacity="0.4"
                transform={`rotate(${angle} 8 8)`}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, delay: angle / 360, repeat: Infinity }}
              />
            ))}
          </svg>
        </motion.div>

        {/* Moon craters (dark mode) */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ opacity: isLight ? 0 : 1, rotate: isLight ? 90 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <svg width={dims.iconSize} height={dims.iconSize} viewBox="0 0 16 16" fill="none">
            <circle cx="6" cy="5" r="1.5" fill="#94A3B8" opacity="0.4" />
            <circle cx="9" cy="9" r="1" fill="#94A3B8" opacity="0.3" />
            <circle cx="5" cy="10" r="0.8" fill="#94A3B8" opacity="0.25" />
          </svg>
        </motion.div>
      </motion.div>
    </motion.button>
  );
}

