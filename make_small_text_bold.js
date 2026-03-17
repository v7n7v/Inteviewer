const fs = require('fs');
const filePath = 'components/HeroSection.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

const smallTextRegex = /text-\[(7|8|9|10|11|12|13|14)px\]/;
const ternaryRegex = /isLight \? '([^']+)' : '([^']+)'/g;

let changedCount = 0;

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // We check if the line OR the previous line contains small text logic
    // because JSX classes can be multi-line
    let hasSmallText = smallTextRegex.test(line);
    if (!hasSmallText && i > 0 && smallTextRegex.test(lines[i-1])) {
        hasSmallText = true;
    }
    if (!hasSmallText && i > 1 && smallTextRegex.test(lines[i-2])) {
        hasSmallText = true;
    }
    
    if (hasSmallText) {
        let newLine = line.replace(ternaryRegex, (match, lightClasses, darkClasses) => {
            const hasColorOrDarkGray = /\btext-(gray-[5-9]00|emerald-[5-9]00|amber-[5-9]00|cyan-[5-9]00|violet-[5-9]00|blue-[5-9]00|red-[5-9]00|black)\b/.test(lightClasses);
            const hasBold = /\bfont-(bold|semibold|extrabold|black)\b/.test(lightClasses);
            const baseHasBold = /\bfont-(bold|semibold|extrabold|black)\b/.test(line); // rough check
            
            if (hasColorOrDarkGray && !hasBold && !baseHasBold) {
                let cleanLight = lightClasses.replace(/\bfont-(thin|extralight|light|normal|medium)\b/g, '').replace(/\s+/g, ' ').trim();
                return `isLight ? 'font-bold ${cleanLight}' : '${darkClasses}'`;
            }
            return match;
        });
        
        if (newLine !== line) {
            lines[i] = newLine;
            changedCount++;
        }
    }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log(`Script done. Changed ${changedCount} lines.`);
