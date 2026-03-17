const fs = require('fs');
const file = 'components/HeroSection.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Stylized animation for Motto
code = code.replace(
  `<motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-3xl md:text-4xl font-bold text-[var(--theme-text)] tracking-tight leading-[1.15] mb-3">
                Talent Density,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Decoded</span>
              </motion.h1>`,
              `<motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-3xl md:text-4xl font-bold text-[var(--theme-text)] tracking-tight leading-[1.15] mb-3 relative inline-block group"
              >
                <div className="relative inline-block">
                  <span className="relative z-10">Talent Density,</span>
                  <motion.div 
                    animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.05, 1] }} 
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -inset-4 bg-emerald-500/10 blur-xl z-0 rounded-full"
                  />
                </div>
                {' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 relative inline-block overflow-hidden">
                  Decoded
                  <motion.span 
                    initial={{ left: '-50%' }}
                    animate={{ left: '150%' }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
                    className="absolute top-0 bottom-0 w-[8px] bg-white opacity-60 blur-[3px] -skew-x-[20deg]"
                  />
                </span>
              </motion.h1>`
);

// 2. Subheadline true black
code = code.replace(
  `className="text-[14px] text-[var(--theme-text-secondary)] leading-relaxed mb-5 max-w-md">
                Resume morphing`,
  `className={\`text-[14px] leading-relaxed mb-5 max-w-md \${isLight ? 'font-bold text-gray-900' : 'text-[var(--theme-text-secondary)]'}\`}>
                Resume morphing`
);

// 3. Quotes true black
code = code.replace(
  `className="text-lg md:text-xl font-light text-[var(--theme-text-secondary)] italic leading-relaxed max-w-2xl mx-auto"
                >
                  &ldquo;We don&apos;t just dress up your resume.{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 font-medium not-italic">
                    We make you the candidate it says you are.
                  </span>&rdquo;
                </motion.p>`,
  `className={\`text-lg md:text-xl font-light italic leading-relaxed max-w-2xl mx-auto \${isLight ? 'font-bold text-gray-900' : 'text-[var(--theme-text-secondary)]'}\`}
                >
                  &ldquo;We don&apos;t just dress up your resume.{' '}
                  <span className={\`font-medium not-italic \${isLight ? 'text-emerald-700' : 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400'}\`}>
                    We make you the candidate it says you are.
                  </span>&rdquo;
                </motion.p>`
);

code = code.replace(
  `className="mt-3 text-[11px] text-[var(--theme-text-muted)] font-medium tracking-widest uppercase"
                >
                  Your AI Career Co-Pilot`,
  `className={\`mt-3 text-[11px] font-medium tracking-widest uppercase \${isLight ? 'font-bold text-gray-900' : 'text-[var(--theme-text-muted)]'}\`}
                >
                  Your AI Career Co-Pilot`
);

fs.writeFileSync(file, code, 'utf8');
console.log('HeroSection.tsx updated.');

