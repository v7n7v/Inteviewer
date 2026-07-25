#!/usr/bin/env node

/** Updates source-inspection tests to read canonical assistant implementations. */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const SELF = path.basename(__filename);
const replacements = [
  ['lib/ai/sona-toolkit.ts', 'lib/assistant/toolkit.ts'],
  ['lib/sona-tools.ts', 'lib/assistant/tools.ts'],
  ['lib/sona-context.ts', 'lib/assistant/context.ts'],
  ['lib/sona/', 'lib/assistant/'],
  ["'lib', 'ai', 'sona-toolkit.ts'", "'lib', 'assistant', 'toolkit.ts'"],
  ["'lib', 'sona-tools.ts'", "'lib', 'assistant', 'tools.ts'"],
  ["'lib', 'sona-context.ts'", "'lib', 'assistant', 'context.ts'"],
  ["'lib', 'sona',", "'lib', 'assistant',"],
  ['analytics\\.sonaResume', 'analytics\\.assistantResume'],
  ['analytics.sonaResume', 'analytics.assistantResume'],
  ['analytics\\.sonaPacket', 'analytics\\.assistantPacket'],
  ['analytics.sonaPacket', 'analytics.assistantPacket'],
  ['sonaResumeHandoffStaged', 'assistantResumeHandoffStaged'],
  ['sonaResumeAuthAbandoned', 'assistantResumeAuthAbandoned'],
];

const files = fs.readdirSync(path.join(ROOT, 'scripts'))
  .filter((name) => name.endsWith('.test.js') && name !== SELF)
  .map((name) => path.join(ROOT, 'scripts', name));
const changes = [];

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  const after = replacements.reduce((value, [from, to]) => value.replaceAll(from, to), before);
  if (before !== after) changes.push({ file, after });
}

process.stdout.write(`${JSON.stringify({ mode: WRITE ? 'write' : 'dry-run', files: changes.length })}\n`);
for (const change of changes) process.stdout.write(`${JSON.stringify({ file: path.basename(change.file) })}\n`);
if (WRITE) for (const change of changes) fs.writeFileSync(change.file, change.after, 'utf8');
