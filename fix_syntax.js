const fs = require('fs');
const file = '/Users/alulagebreegziabher/Documents/Personal-Projects/Talent Consulting 0411026 - SIMPLEFIED-GEMINI/app/tools/ai-detector/AIDetectorDemo.tsx';
let content = fs.readFileSync(file, 'utf8');

// The issue is I wrote className={\`... \${...}\`} instead of className={`... ${...}`}
content = content.replace(/\\`/g, '`').replace(/\\\$/g, '$');

fs.writeFileSync(file, content);
console.log("Fixed backticks and dollar signs.");
