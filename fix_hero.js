const fs = require('fs');

const bgPath = 'components/AnimatedShimmerBackground.tsx';
let bgCode = fs.readFileSync(bgPath, 'utf8');

// Reduce overlay opacity
bgCode = bgCode.replace(
  "bg-slate-50/85 backdrop-blur-[2px]",
  "bg-slate-50/10 backdrop-blur-[1px]" // let images show through much more
);
// Make images more visible
bgCode = bgCode.replace(
  "opacity: isLight ? 0.4 : 0.2",
  "opacity: isLight ? 0.7 : 0.3"
);
// Change blend mode so it's not totally crushed
bgCode = bgCode.replace(
  "mix-blend-multiply",
  "mix-blend-normal"
);
// Remove heavy grayscale
bgCode = bgCode.replace(
  "grayscale(30%) contrast(120%)",
  "grayscale(10%) contrast(100%)"
);
fs.writeFileSync(bgPath, bgCode, 'utf8');

const heroPath = 'components/HeroSection.tsx';
let heroCode = fs.readFileSync(heroPath, 'utf8');

// Replace problematic text-slate-400 and text-slate-500 that didn't take the global CSS mapping
heroCode = heroCode.replace(/text-slate-400/g, 'text-gray-900 dark:text-slate-400');
heroCode = heroCode.replace(/text-slate-500/g, 'text-gray-900 dark:text-slate-500');

fs.writeFileSync(heroPath, heroCode, 'utf8');
console.log('Fixed background and text colors.');
