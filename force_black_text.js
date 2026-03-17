const fs = require('fs');

// Fix HeroSection.tsx
const heroPath = 'components/HeroSection.tsx';
let heroContent = fs.readFileSync(heroPath, 'utf8');
// match text-gray-400, text-gray-500, etc.
heroContent = heroContent.replace(/text-gray-[1-8]00/g, 'text-gray-900');
fs.writeFileSync(heroPath, heroContent, 'utf8');

// Fix globals.css
const cssPath = 'app/globals.css';
let cssContent = fs.readFileSync(cssPath, 'utf8');

// Replace text-white/* overrides
const whiteOverrideRegex = /\[data-theme="light"\] \.text-white\\\/5[\s\S]*?\[data-theme="light"\] \.text-white\\\/95 \{ color: #000000 !important; \}/m;

const newWhiteOverride = `[data-theme="light"] .text-white\\/5,
[data-theme="light"] .text-white\\/10,
[data-theme="light"] .text-white\\/15,
[data-theme="light"] .text-white\\/20,
[data-theme="light"] .text-white\\/25,
[data-theme="light"] .text-white\\/30,
[data-theme="light"] .text-white\\/40,
[data-theme="light"] .text-white\\/50,
[data-theme="light"] .text-white\\/60,
[data-theme="light"] .text-white\\/70,
[data-theme="light"] .text-white\\/80,
[data-theme="light"] .text-white\\/90,
[data-theme="light"] .text-white\\/95 { color: #000000 !important; }`;

if (whiteOverrideRegex.test(cssContent)) {
    cssContent = cssContent.replace(whiteOverrideRegex, newWhiteOverride);
}

// Replace text-slate-* overrides
const slateOverrideRegex = /\[data-theme="light"\] \.text-slate-300 \{[\s\S]*?\[data-theme="light"\] \.text-slate-500 \{[\s\S]*?\}/m;

const newSlateOverride = `[data-theme="light"] .text-slate-300,
[data-theme="light"] .text-slate-400,
[data-theme="light"] .text-slate-500 {
  color: #000000 !important;
}`;

if (slateOverrideRegex.test(cssContent)) {
    cssContent = cssContent.replace(slateOverrideRegex, newSlateOverride);
}

fs.writeFileSync(cssPath, cssContent, 'utf8');
console.log('Script done.');
