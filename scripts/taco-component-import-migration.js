#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const ROOTS = ['app', 'components', 'hooks'];
const EXTENSIONS = new Set(['.ts', '.tsx']);
const EXCLUDED_PREFIXES = [
  'components/assistant/',
  'components/sona/',
  'components/SonaFloatingOrb.tsx',
  'components/SonaPicksCapture.tsx',
  'components/SonaThinkingTile.tsx',
  'components/workspace/SonaContextPanel.tsx',
];
const EXACT_REPLACEMENTS = [
  ['@/components/workspace/SonaContextPanel', '@/components/assistant/AssistantContextPanel'],
  ['@/components/SonaThinkingTile', '@/components/assistant/AssistantThinkingTile'],
  ['@/components/SonaFloatingOrb', '@/components/assistant/AssistantFloatingOrb'],
  ['@/components/SonaPicksCapture', '@/components/assistant/AssistantPicksCapture'],
  ['@/components/sona/SonaActivationProofPanel', '@/components/assistant/AssistantActivationProofPanel'],
  ['@/components/sona/SonaCapabilityDrawer', '@/components/assistant/AssistantCapabilityDrawer'],
  ['@/components/sona/SonaMessageContent', '@/components/assistant/AssistantMessageContent'],
  ['@/components/sona', '@/components/assistant'],
];
const IDENTIFIER_REPLACEMENTS = [
  [/\bSonaMarkV2State\b/g, 'AssistantMarkMotionState'],
  [/\bSonaMarkV2Size\b/g, 'AssistantMarkMotionSize'],
  [/\bSonaMarkV2\b/g, 'AssistantMarkMotion'],
  [/\bSonaActivationProofPanel\b/g, 'AssistantActivationProofPanel'],
  [/\bSonaActivationProofViewState\b/g, 'AssistantActivationProofViewState'],
  [/\bSonaCapabilityDrawer\b/g, 'AssistantCapabilityDrawer'],
  [/\bSonaMessageContent\b/g, 'AssistantMessageContent'],
  [/\bSonaThinkingTile\b/g, 'AssistantThinkingTile'],
  [/\bSonaFloatingOrb\b/g, 'AssistantFloatingOrb'],
  [/\bSonaPicksCapture\b/g, 'AssistantPicksCapture'],
  [/\bSonaContextPanel\b/g, 'AssistantContextPanel'],
  [/\bSonaMarkState\b/g, 'AssistantMarkState'],
  [/\bSonaMarkSize\b/g, 'AssistantMarkSize'],
  [/\bSonaMark\b/g, 'AssistantMark'],
];

function walk(target) {
  if (!fs.existsSync(target)) return [];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(target, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

const changes = [];
for (const file of ROOTS.flatMap((root) => walk(path.join(ROOT, root)))) {
  const relative = path.relative(ROOT, file).replaceAll('\\', '/');
  if (EXCLUDED_PREFIXES.some((prefix) => relative === prefix || relative.startsWith(prefix))) continue;
  const before = fs.readFileSync(file, 'utf8');
  let after = EXACT_REPLACEMENTS.reduce((value, [from, to]) => value.replaceAll(from, to), before);
  after = IDENTIFIER_REPLACEMENTS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), after);
  if (before !== after) changes.push({ file, relative, after });
}

process.stdout.write(`${JSON.stringify({ mode: WRITE ? 'write' : 'dry-run', files: changes.length })}\n`);
for (const change of changes) process.stdout.write(`${JSON.stringify({ file: change.relative })}\n`);
if (WRITE) for (const change of changes) fs.writeFileSync(change.file, change.after, 'utf8');
