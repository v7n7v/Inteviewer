const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');
const { EXPECTED_SENDERS } = require('./email-release-readiness');
const { COMPLETE_EMAIL_TEMPLATE_FIXTURE } = require('./email-template-sample-fixture');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_RUN_ID = '20260722-root-domain-preview-v1';

function readEmailEventKeys(root = repoRoot) {
  const contracts = fs.readFileSync(path.join(root, 'lib', 'email', 'contracts.ts'), 'utf8');
  const eventBlock = contracts.match(/EMAIL_EVENT_KEYS = \[([\s\S]*?)\] as const/)?.[1] || '';
  return [...eventBlock.matchAll(/'([^']+)'/g)].map(match => match[1]);
}

function buildSamplePlan(events = readEmailEventKeys()) {
  return {
    permitted: events.filter(event => !event.startsWith('marketing.')),
    skippedMarketing: events.filter(event => event.startsWith('marketing.')),
  };
}

function selectEvents(availableEvents, requestedEvents) {
  if (!requestedEvents?.length) return availableEvents;

  const available = new Set(availableEvents);
  const unknown = requestedEvents.filter(event => !available.has(event));
  if (unknown.length) throw new Error(`events:unknown:${unknown.join(',')}`);
  return [...new Set(requestedEvents)];
}

function validSingleRecipient(value) {
  return /^[^\s,@<>]+@[^\s,@<>]+\.[^\s,@<>]+$/.test(String(value || '').trim());
}

function parseArgs(argv) {
  const options = { to: '', send: false, delayMs: 850, runId: DEFAULT_RUN_ID, events: null };
  for (const argument of argv) {
    if (argument === '--send') options.send = true;
    else if (argument.startsWith('--to=')) options.to = argument.slice('--to='.length).trim().toLowerCase();
    else if (argument.startsWith('--delay-ms=')) options.delayMs = Number(argument.slice('--delay-ms='.length));
    else if (argument.startsWith('--run-id=')) options.runId = argument.slice('--run-id='.length).trim();
    else if (argument.startsWith('--events=')) {
      options.events = argument
        .slice('--events='.length)
        .split(',')
        .map(event => event.trim())
        .filter(Boolean);
    }
  }
  if (!validSingleRecipient(options.to)) throw new Error('recipient:single_valid_email_required');
  if (!Number.isInteger(options.delayMs) || options.delayMs < 500 || options.delayMs > 5_000) {
    throw new Error('delay_ms:must_be_500_to_5000');
  }
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(options.runId)) throw new Error('run_id:invalid');
  if (options.events && (options.events.length === 0 || options.events.length > 20)) throw new Error('events:must_select_1_to_20');
  return options;
}

function mockSubject(index, total, event, subject) {
  return `[MOCK TEMPLATE ${index}/${total} | ${event}] ${subject}`.slice(0, 200);
}

function previewIdempotencyKey(to, event, runId) {
  const recipientHash = createHash('sha256').update(to.trim().toLowerCase()).digest('hex').slice(0, 12);
  return `tc-preview-${runId}-${recipientHash}-${event.replace(/[^A-Za-z0-9_-]/g, '-')}`.slice(0, 256);
}

function configureSenderEnvironment() {
  Object.assign(process.env, EXPECTED_SENDERS, {
    EMAIL_SYSTEM_V2_ENABLED: 'true',
    EMAIL_MARKETING_ENABLED: 'false',
    EMAIL_MAILING_ADDRESS: '',
    EMAIL_SUPPORT_REPLY_TO: 'support@talentconsulting.io',
    EMAIL_OPS_REPLY_TO: 'ops@talentconsulting.io',
  });
}

function loadEmailRuntime() {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'tc-email-sample-runtime-'));
  const outfile = path.join(directory, 'runtime.cjs');
  buildSync({
    stdin: {
      contents: [
        "export { renderEmail } from './lib/email/render';",
        "export { sendRenderedEmailResult } from './lib/email';",
      ].join('\n'),
      resolveDir: repoRoot,
      sourcefile: 'email-sample-runtime.ts',
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
      const isOwnedTemporaryDirectory = resolved.startsWith(`${temporaryRoot}${path.sep}`)
        && path.basename(resolved).startsWith('tc-email-sample-runtime-');
      if (!isOwnedTemporaryDirectory) throw new Error('temporary_cleanup:unsafe_path');
      fs.rmSync(resolved, { recursive: true, force: true });
    },
  };
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function prepareSamples(runtime, permitted) {
  const samples = [];
  for (let index = 0; index < permitted.length; index += 1) {
    const event = permitted[index];
    const rendered = await runtime.renderEmail(event, COMPLETE_EMAIL_TEMPLATE_FIXTURE);
    samples.push({
      event,
      rendered: {
        ...rendered,
        subject: mockSubject(index + 1, permitted.length, event, rendered.subject),
        headers: { ...rendered.headers, 'X-TalentConsulting-Preview': 'mock-template-evaluation' },
      },
    });
  }
  return samples;
}

async function sendSamples({ runtime, samples, to, delayMs, runId }) {
  const accepted = [];
  const failed = [];
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const result = await runtime.sendRenderedEmailResult(to, sample.rendered, {
      idempotencyKey: previewIdempotencyKey(to, sample.event, runId),
      additionalTags: [
        { name: 'purpose', value: 'template_preview' },
        { name: 'preview_run', value: runId },
        { name: 'sequence', value: String(index + 1) },
      ],
    });
    if (result.ok) {
      accepted.push({ event: sample.event, id: result.id || null });
      process.stdout.write(`ACCEPTED ${index + 1}/${samples.length} ${sample.event} id=${result.id || 'unavailable'}\n`);
    } else {
      failed.push({ event: sample.event, error: String(result.error || 'provider_error').slice(0, 180) });
      process.stderr.write(`FAILED ${index + 1}/${samples.length} ${sample.event} error=${failed.at(-1).error}\n`);
    }
    if (index + 1 < samples.length) await wait(delayMs);
  }
  return { accepted, failed };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = buildSamplePlan(selectEvents(readEmailEventKeys(), options.events));
  configureSenderEnvironment();
  const loaded = loadEmailRuntime();
  try {
    const samples = await prepareSamples(loaded.runtime, plan.permitted);
    process.stdout.write(`DRY_RENDERED ${samples.length} templates for ${options.to}\n`);
    process.stdout.write(`SKIPPED_MARKETING ${plan.skippedMarketing.length}: ${plan.skippedMarketing.join(', ')}\n`);
    if (!options.send) {
      process.stdout.write('DRY_RUN complete; no provider calls and no emails sent. Add --send to deliver.\n');
      return;
    }
    const result = await sendSamples({ runtime: loaded.runtime, samples, ...options });
    process.stdout.write(`SEND_SUMMARY accepted=${result.accepted.length} failed=${result.failed.length} skipped_marketing=${plan.skippedMarketing.length}\n`);
    if (result.failed.length) process.exitCode = 1;
  } finally {
    loaded.cleanup();
  }
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`Email template sample run failed: ${error instanceof Error ? error.message : 'unexpected_failure'}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_RUN_ID,
  buildSamplePlan,
  mockSubject,
  parseArgs,
  previewIdempotencyKey,
  readEmailEventKeys,
  selectEvents,
  validSingleRecipient,
};
