#!/usr/bin/env node

/**
 * Guarded customer-facing assistant rename.
 *
 * This pass intentionally changes only standalone display-name tokens. Internal
 * identifiers such as sona_daily, SONA_PREFLIGHT_SECRET, and /lib/sona remain
 * unchanged so persisted data and compatibility contracts are not disturbed.
 * The script is dry-run only unless --write is supplied.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const SCAN_ROOTS = ['app', 'components', 'hooks', 'lib', 'scripts', 'docs'];
const ROOT_FILES = [
  'README.md',
  'GETTING_STARTED.md',
  'DESIGN.md',
  'UI_DESIGN_GUIDE.md',
  'PRODUCT.md',
  'PRODUCT_STRATEGY_PLAN.md',
  'env.example',
  '.env.example',
  '.env.cloudrun.yaml.example',
];
const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.ts', '.tsx', '.txt', '.yaml', '.yml',
]);
const EXCLUDED_DIRECTORIES = new Set(['.git', '.next', '.agent', '.playwright-cli', 'node_modules', 'output']);
const EXCLUDED_FILES = new Set([
  'docs/taco-migration-manifest.md',
  'docs/taco-migration-runbook.md',
  'docs/taco-brand-system.md',
  'scripts/taco-brand-audit.js',
  'scripts/taco-brand-migration.js',
  'scripts/taco-brand.test.js',
]);
const REPLACEMENTS = [
  [/Taco Picks/g, 'Career Picks by Taco'],
  [/Taco Live Room/g, 'Live Interview with Taco'],
  [/Taco Agent/g, 'Ask Taco'],
  [/test:sona-harness/g, 'test:assistant-harness'],
  [/audit:sona-staging-providers/g, 'audit:assistant-staging-providers'],
  [/\bSONA\b/g, 'TACO'],
  [/\bSona\b/g, 'Taco'],
];

for (const replacement of REPLACEMENTS) {
  if (!Array.isArray(replacement) || replacement.length !== 2 || !(replacement[0] instanceof RegExp)) {
    throw new Error('Invalid replacement definition; refusing to continue.');
  }
}

function collectFiles(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return TEXT_EXTENSIONS.has(path.extname(target).toLowerCase()) ? [target] : [];
  if (EXCLUDED_DIRECTORIES.has(path.basename(target))) return [];

  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) return [];
    return collectFiles(path.join(target, entry.name));
  });
}

const files = [
  ...SCAN_ROOTS.flatMap((directory) => collectFiles(path.join(ROOT, directory))),
  ...ROOT_FILES.flatMap((file) => collectFiles(path.join(ROOT, file))),
];

const changed = [];
let replacementCount = 0;

for (const file of [...new Set(files)].sort()) {
  const relativeFile = path.relative(ROOT, file).replaceAll('\\', '/');
  if (EXCLUDED_FILES.has(relativeFile)) continue;
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  let fileCount = 0;

  for (const [pattern, replacement] of REPLACEMENTS) {
    after = after.replace(pattern, () => {
      fileCount += 1;
      return replacement;
    });
  }

  if (after === before) continue;
  if (WRITE) fs.writeFileSync(file, after, 'utf8');
  replacementCount += fileCount;
  changed.push({ file: relativeFile, replacements: fileCount });
}

process.stdout.write(`${JSON.stringify({ mode: WRITE ? 'write' : 'dry-run', files: changed.length, replacements: replacementCount })}\n`);
for (const result of changed) process.stdout.write(`${JSON.stringify(result)}\n`);
