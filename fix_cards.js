const fs = require('fs');

const cssPath = 'app/globals.css';
let cssContent = fs.readFileSync(cssPath, 'utf8');

// Update theme borders
cssContent = cssContent.replace(
  /--theme-border: rgba\(0, 0, 0, 0\.08\);/,
  '--theme-border: rgba(0, 0, 0, 0.15);'
);
cssContent = cssContent.replace(
  /--theme-border-hover: rgba\(0, 0, 0, 0\.15\);/,
  '--theme-border-hover: rgba(0, 0, 0, 0.3);'
);

// Update elevation-1 shadows
cssContent = cssContent.replace(
  /box-shadow: 0 4px 6px -1px rgba\(0, 0, 0, 0\.05\), 0 2px 4px -1px rgba\(0, 0, 0, 0\.03\), 0 0 0 1px rgba\(0, 0, 0, 0\.02\);/g,
  'box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.1), 0 4px 10px -2px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.05);'
);
// Hover shadows
cssContent = cssContent.replace(
  /box-shadow: 0 10px 15px -3px rgba\(0, 0, 0, 0\.08\), 0 4px 6px -2px rgba\(0, 0, 0, 0\.04\), 0 0 0 1px rgba\(0, 0, 0, 0\.05\);/g,
  'box-shadow: 0 20px 40px -5px rgba(0, 0, 0, 0.15), 0 8px 16px -4px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.08);'
);

fs.writeFileSync(cssPath, cssContent, 'utf8');
console.log('Cards made pronounced.');
