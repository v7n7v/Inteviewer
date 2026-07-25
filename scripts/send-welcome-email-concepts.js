const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');

function validSingleRecipient(value) {
  return /^[^\s,@<>]+@[^\s,@<>]+\.[^\s,@<>]+$/.test(String(value || '').trim());
}

function parseArgs(argv) {
  const options = { to: '', send: false, runId: '20260722_welcome_concepts_v1' };
  for (const argument of argv) {
    if (argument === '--send') options.send = true;
    else if (argument.startsWith('--to=')) options.to = argument.slice('--to='.length).trim().toLowerCase();
    else if (argument.startsWith('--run-id=')) options.runId = argument.slice('--run-id='.length).trim();
  }
  if (!validSingleRecipient(options.to)) throw new Error('recipient:single_valid_email_required');
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(options.runId)) throw new Error('run_id:invalid');
  return options;
}

function conceptSubject(index, total, label, subject) {
  return `[WELCOME CONCEPT ${index}/${total} | ${label.toUpperCase()}] ${subject}`.slice(0, 200);
}

function conceptIdempotencyKey(to, conceptId, runId) {
  const recipientHash = createHash('sha256').update(to.trim().toLowerCase()).digest('hex').slice(0, 12);
  return `tc-welcome-preview-${runId}-${recipientHash}-${conceptId}`.slice(0, 256);
}

function loadRuntime() {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'tc-welcome-concepts-'));
  const outfile = path.join(directory, 'runtime.cjs');
  buildSync({
    stdin: {
      contents: [
        "export { renderWelcomeConcepts, welcomeConcepts } from './emails/concepts/WelcomeConcepts';",
        "export { sendRenderedEmailResult } from './lib/email';",
      ].join('\n'),
      resolveDir: repoRoot,
      sourcefile: 'welcome-concept-runtime.ts',
      loader: 'ts',
    },
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  });
  return {
    runtime: require(outfile),
    cleanup: () => {
      const resolved = path.resolve(directory);
      if (!resolved.startsWith(`${temporaryRoot}${path.sep}`) || !path.basename(resolved).startsWith('tc-welcome-concepts-')) {
        throw new Error('temporary_cleanup:unsafe_path');
      }
      fs.rmSync(resolved, { recursive: true, force: true });
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const loaded = loadRuntime();
  try {
    const concepts = await loaded.runtime.renderWelcomeConcepts();
    process.stdout.write(`DRY_RENDERED ${concepts.length} welcome concepts for ${options.to}\n`);
    if (!options.send) {
      process.stdout.write('DRY_RUN complete; no provider calls and no emails sent. Add --send to deliver.\n');
      return;
    }
    let accepted = 0;
    for (let index = 0; index < concepts.length; index += 1) {
      const concept = concepts[index];
      const email = {
        ...concept.email,
        subject: conceptSubject(index + 1, concepts.length, concept.label, concept.email.subject),
      };
      const result = await loaded.runtime.sendRenderedEmailResult(options.to, email, {
        idempotencyKey: conceptIdempotencyKey(options.to, concept.id, options.runId),
        additionalTags: [
          { name: 'purpose', value: 'welcome_concept_review' },
          { name: 'concept', value: concept.id },
          { name: 'preview_run', value: options.runId },
        ],
      });
      if (!result.ok) {
        process.stderr.write(`FAILED ${concept.id} error=${String(result.error || 'provider_error').slice(0, 180)}\n`);
        process.exitCode = 1;
        continue;
      }
      accepted += 1;
      process.stdout.write(`ACCEPTED ${index + 1}/${concepts.length} ${concept.id} id=${result.id || 'unavailable'}\n`);
    }
    process.stdout.write(`SEND_SUMMARY accepted=${accepted} failed=${concepts.length - accepted}\n`);
  } finally {
    loaded.cleanup();
  }
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`Welcome concept run failed: ${error instanceof Error ? error.message : 'unexpected_failure'}\n`);
    process.exitCode = 1;
  });
}

module.exports = { conceptIdempotencyKey, conceptSubject, parseArgs, validSingleRecipient };
