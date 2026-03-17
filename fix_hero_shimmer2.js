const fs = require('fs');

const bgPath = 'components/AnimatedShimmerBackground.tsx';
let bgCode = fs.readFileSync(bgPath, 'utf8');

// Boost opacity of the floating pictures significantly
bgCode = bgCode.replace(
  "opacity: isLight ? 0.7 : 0.3",
  "opacity: isLight ? 0.95 : 0.65"
);
// Remove grayscale filtering entirely to let true colors shine softly
bgCode = bgCode.replace(
  "grayscale(10%) contrast(100%)",
  "grayscale(0%) contrast(110%) blur(0.5px)"
);
// Tune the overlay blending to let colors through but still feel "in the background"
bgCode = bgCode.replace(
  "bg-slate-50/10 backdrop-blur-[1px]",
  "bg-slate-50/20 backdrop-blur-[1.5px]"
);
// Instead of small boxes, let's make them larger
bgCode = bgCode.replace(/size: 90/g, 'size: 140');
bgCode = bgCode.replace(/size: 120/g, 'size: 180');
bgCode = bgCode.replace(/size: 80/g, 'size: 130');
bgCode = bgCode.replace(/size: 100/g, 'size: 160');
bgCode = bgCode.replace(/size: 110/g, 'size: 170');
bgCode = bgCode.replace(/size: 95/g, 'size: 150');
bgCode = bgCode.replace(/size: 105/g, 'size: 165');
bgCode = bgCode.replace(/size: 85/g, 'size: 135');

fs.writeFileSync(bgPath, bgCode, 'utf8');
console.log('Images made larger and colors restored.');
