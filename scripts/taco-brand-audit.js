#!/usr/bin/env node

/** Fails when a standalone legacy display name remains in a customer-facing source file. */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SEARCH_ROOTS = ['app', 'components', 'hooks'];
const TEXT_EXTENSIONS = new Set(['.css', '.js', '.jsx', '.md', '.ts', '.tsx']);
const LEGACY_DISPLAY_NAME = /\b(?:Sona|SONA)\b/g;

function walk(target) {
  if (!fs.existsSync(target)) return [];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(target, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return TEXT_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

const findings = [];
for (const file of SEARCH_ROOTS.flatMap((directory) => walk(path.join(ROOT, directory)))) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (LEGACY_DISPLAY_NAME.test(line)) {
      findings.push(`${path.relative(ROOT, file).replaceAll('\\', '/')}:${index + 1}: ${line.trim()}`);
    }
    LEGACY_DISPLAY_NAME.lastIndex = 0;
  });
}

if (findings.length > 0) {
  process.stderr.write(`Found ${findings.length} customer-facing legacy assistant-name reference(s):\n`);
  process.stderr.write(`${findings.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Taco brand audit passed: no standalone legacy display-name references in customer-facing source.\n');
