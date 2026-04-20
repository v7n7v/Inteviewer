'use client';
import { motion } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';
import { useEffect, useState } from 'react';

export function AnimatedShimmerBackground() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isLight = theme === 'light';

  // Abstract gradient orbs — no images
  const orbs = [
    { top: '5%', left: '10%', size: 300, color: isLight ? 'rgba(26,115,232,0.06)' : 'rgba(168,199,250,0.04)', delay: 0 },
    { top: '20%', right: '5%', size: 400, color: isLight ? 'rgba(129,201,149,0.05)' : 'rgba(129,201,149,0.03)', delay: 2 },
    { top: '50%', left: '5%', size: 350, color: isLight ? 'rgba(253,214,99,0.04)' : 'rgba(253,214,99,0.02)', delay: 4 },
    { top: '70%', right: '15%', size: 280, color: isLight ? 'rgba(26,115,232,0.04)' : 'rgba(168,199,250,0.03)', delay: 1 },
  ];

  return (
    <div className="absolute inset-x-0 top-0 h-[900px] z-0 overflow-hidden pointer-events-none">
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            top: orb.top,
            left: orb.left,
            right: orb.right,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            filter: 'blur(40px)',
          }}
          animate={{ 
            y: [-15, 15, -15],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            y: { duration: 12 + i * 3, repeat: Infinity, ease: 'easeInOut', delay: orb.delay },
            opacity: { duration: 8 + i * 2, repeat: Infinity, ease: 'easeInOut', delay: orb.delay },
          }}
        />
      ))}

      {/* Bottom fade */}
      <div 
        className="absolute bottom-0 inset-x-0 h-40 z-10"
        style={{ background: `linear-gradient(to top, var(--bg-deep), transparent)` }}
      />
    </div>
  );
}
