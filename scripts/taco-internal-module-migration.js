#!/usr/bin/env node

/**
 * Moves assistant implementation modules behind neutral paths while leaving
 * compatibility re-exports at every former import path. Dry-run unless --write.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const ASSISTANT_DIR = path.join(ROOT, 'lib', 'assistant');
const LEGACY_DIR = path.join(ROOT, 'lib', 'sona');
const SELF = path.join(ROOT, 'scripts', 'taco-internal-module-migration.js');
const TEXT_EXTENSIONS = new Set(['.js', '.jsx', '.md', '.mjs', '.ts', '.tsx']);
const EXCLUDED_DIRECTORIES = new Set(['.git', '.next', '.agent', '.playwright-cli', 'node_modules', 'output']);

const mappings = [
  ...fs.readdirSync(LEGACY_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => ({
      source: path.join(LEGACY_DIR, entry.name),
      destination: path.join(ASSISTANT_DIR, entry.name),
      exportPath: `@/lib/assistant/${entry.name.slice(0, -3)}`,
    })),
  {
    source: path.join(ROOT, 'lib', 'sona-tools.ts'),
    destination: path.join(ASSISTANT_DIR, 'tools.ts'),
    exportPath: '@/lib/assistant/tools',
  },
  {
    source: path.join(ROOT, 'lib', 'sona-context.ts'),
    destination: path.join(ASSISTANT_DIR, 'context.ts'),
    exportPath: '@/lib/assistant/context',
  },
  {
    source: path.join(ROOT, 'lib', 'ai', 'sona-toolkit.ts'),
    destination: path.join(ASSISTANT_DIR, 'toolkit.ts'),
    exportPath: '@/lib/assistant/toolkit',
  },
];

const replacements = [
  ['@/lib/ai/sona-toolkit', '@/lib/assistant/toolkit'],
  ['@/lib/sona-tools', '@/lib/assistant/tools'],
  ['@/lib/sona-context', '@/lib/assistant/context'],
  ['@/lib/sona/', '@/lib/assistant/'],
  ['../lib/ai/sona-toolkit', '../lib/assistant/toolkit'],
  ['../lib/sona-tools', '../lib/assistant/tools'],
  ['../lib/sona-context', '../lib/assistant/context'],
  ['../lib/sona/', '../lib/assistant/'],
];

for (const pair of replacements) {
  if (!Array.isArray(pair) || pair.length !== 2 || pair.some((value) => typeof value !== 'string' || !value)) {
    throw new Error('Invalid import replacement definition; refusing to continue.');
  }
}

for (const mapping of mappings) {
  if (!mapping.source.startsWith(ROOT) || !mapping.destination.startsWith(ASSISTANT_DIR)) {
    throw new Error(`Unsafe module mapping: ${mapping.source}`);
  }
  if (!fs.existsSync(mapping.source)) throw new Error(`Missing source: ${mapping.source}`);
  if (fs.existsSync(mapping.destination)) throw new Error(`Destination already exists: ${mapping.destination}`);
}

function rewrite(value) {
  return replacements.reduce((result, [before, after]) => result.replaceAll(before, after), value);
}

function walk(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return TEXT_EXTENSIONS.has(path.extname(target)) ? [target] : [];
  if (EXCLUDED_DIRECTORIES.has(path.basename(target))) return [];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) return [];
    return walk(path.join(target, entry.name));
  });
}

const sourceSet = new Set(mappings.map((mapping) => mapping.source));
const destinationSet = new Set(mappings.map((mapping) => mapping.destination));
const rewrites = [];

for (const file of walk(ROOT)) {
  if (file === SELF || sourceSet.has(file) || destinationSet.has(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = rewrite(before);
  if (before !== after) rewrites.push({ file, before, after });
}

process.stdout.write(`${JSON.stringify({ mode: WRITE ? 'write' : 'dry-run', movedModules: mappings.length, rewrittenFiles: rewrites.length })}\n`);
for (const mapping of mappings) {
  process.stdout.write(`${JSON.stringify({ from: path.relative(ROOT, mapping.source).replaceAll('\\', '/'), to: path.relative(ROOT, mapping.destination).replaceAll('\\', '/') })}\n`);
}
for (const item of rewrites) process.stdout.write(`${JSON.stringify({ rewrite: path.relative(ROOT, item.file).replaceAll('\\', '/') })}\n`);

if (!WRITE) process.exit(0);

fs.mkdirSync(ASSISTANT_DIR, { recursive: true });
for (const mapping of mappings) {
  const implementation = rewrite(fs.readFileSync(mapping.source, 'utf8'));
  fs.writeFileSync(mapping.destination, implementation, 'utf8');
}
for (const item of rewrites) fs.writeFileSync(item.file, item.after, 'utf8');
for (const mapping of mappings) {
  fs.writeFileSync(
    mapping.source,
    `/** @deprecated Import from ${mapping.exportPath}. Kept for compatibility. */\nexport * from '${mapping.exportPath}';\n`,
    'utf8',
  );
}

