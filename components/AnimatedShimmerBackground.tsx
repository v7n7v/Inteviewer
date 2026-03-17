'use client';
import { motion } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';
import { useEffect, useState } from 'react';

const images = [
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=300&fit=crop", // pro woman
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&fit=crop", // pro man
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&h=300&fit=crop", // pro woman
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=300&fit=crop", // pro man
  "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=300&h=300&fit=crop", // paperwork / resume
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop", // pro man
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=300&h=300&fit=crop", // hiring manager
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=300&h=300&fit=crop", // teamwork
]

export function AnimatedShimmerBackground() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isLight = theme === 'light';

  const positions = [
    { top: '5%', left: '8%', size: 140, delay: 0 },
    { top: '25%', right: '5%', size: 180, delay: 1.5 },
    { top: '45%', left: '2%', size: 130, delay: 3 },
    { top: '65%', right: '10%', size: 160, delay: 2 },
    { top: '80%', left: '15%', size: 170, delay: 4.5 },
    { top: '15%', left: '75%', size: 150, delay: 0.5 },
    { top: '35%', right: '35%', size: 165, delay: 2.5 },
    { top: '75%', right: '25%', size: 135, delay: 1 },
  ];

  return (
    <div className="absolute inset-x-0 top-0 h-[1000px] z-0 overflow-hidden pointer-events-none fade-in">
      {/* Blending overlay to soften the imagery */}
      <div className={`absolute inset-0 z-10 ${isLight ? 'bg-slate-50/20 backdrop-blur-[1.5px]' : 'bg-zinc-950/90 backdrop-blur-[4px]'}`} />
      
      {images.map((img, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-2xl overflow-hidden shadow-2xl ${isLight ? 'mix-blend-normal' : 'mix-blend-overlay'}`}
          style={{
            top: positions[i].top,
            left: positions[i].left,
            right: positions[i].right,
            width: positions[i].size,
            height: positions[i].size,
            filter: isLight ? 'grayscale(0%) contrast(110%) blur(0.5px)' : 'grayscale(60%) brightness(150%)',
          }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isLight ? 0.95 : 0.65, y: [-20, 20, -20] }}
          transition={{
            opacity: { duration: 3, delay: positions[i].delay },
            y: { duration: 15 + (i % 4) * 3, repeat: Infinity, ease: 'easeInOut', delay: positions[i].delay }
          }}
        >
          {/* We use standard img tags to avoid next.config.mjs domain whitelist issues */}
          <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
          {/* Shimmer overlay inside the image */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent -skew-x-12"
            animate={{ x: ['-200%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 5 + i * 2, ease: 'easeInOut' }}
          />
        </motion.div>
      ))}
      
      {/* Bottom fade out into the next section */}
      <div className={`absolute bottom-0 inset-x-0 h-40 z-20 bg-gradient-to-t ${isLight ? 'from-slate-50 to-transparent' : 'from-zinc-950 to-transparent'}`} />
    </div>
  );
}
