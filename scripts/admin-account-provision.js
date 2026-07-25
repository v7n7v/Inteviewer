const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');

function validEmail(value) {
  return /^[^\s,@<>]+@[^\s,@<>]+\.[^\s,@<>]+$/.test(String(value || '').trim());
}

function parseArgs(argv) {
  const options = {
    email: '',
    displayName: '',
    role: 'owner',
    apply: false,
    bootstrapOwner: false,
    confirm: '',
    sendInvitation: true,
  };

  for (const argument of argv) {
    if (argument === '--apply') options.apply = true;
    else if (argument === '--bootstrap-owner') options.bootstrapOwner = true;
    else if (argument === '--no-invitation') options.sendInvitation = false;
    else if (argument.startsWith('--email=')) options.email = argument.slice(8).trim().toLowerCase();
    else if (argument.startsWith('--name=')) options.displayName = argument.slice(7).trim();
    else if (argument.startsWith('--role=')) options.role = argument.slice(7).trim().toLowerCase();
    else if (argument.startsWith('--confirm=')) options.confirm = argument.slice(10).trim().toLowerCase();
    else throw new Error(`argument:unknown:${argument}`);
  }

  if (!validEmail(options.email)) throw new Error('email:valid_address_required');
  if (options.displayName.length > 120) throw new Error('name:maximum_120_characters');
  if (options.role !== 'owner') throw new Error('role:bootstrap_cli_is_owner_only');
  if (options.apply) {
    if (!options.bootstrapOwner) throw new Error('apply:requires_--bootstrap-owner');
    if (options.confirm !== options.email) throw new Error('apply:--confirm_must_match_email');
  }
  return options;
}

function loadRuntime() {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'tc-admin-bootstrap-'));
  const outfile = path.join(directory, 'runtime.cjs');
  buildSync({
    stdin: {
      contents: "export { bootstrapActor, inspectAdminAccount, provisionAdminAccount } from './lib/admin-accounts';",
      resolveDir: repoRoot,
      sourcefile: 'admin-bootstrap-runtime.ts',
      loader: 'ts',
    },
    absWorkingDir: repoRoot,
    outfile,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    logLevel: 'silent',
  });
  return {
    runtime: require(outfile),
    cleanup: () => {
      const resolved = path.resolve(directory);
      const owned = resolved.startsWith(`${temporaryRoot}${path.sep}`)
        && path.basename(resolved).startsWith('tc-admin-bootstrap-');
      if (!owned) throw new Error('temporary_cleanup:unsafe_path');
      fs.rmSync(resolved, { recursive: true, force: true });
    },
  };
}

function printInspection(prefix, inspection) {
  process.stdout.write(`${prefix} ${JSON.stringify(inspection)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const loaded = loadRuntime();
  try {
    const before = await loaded.runtime.inspectAdminAccount(options.email);
    printInspection('ADMIN_ACCOUNT_BEFORE', before);

    if (!options.apply) {
      process.stdout.write('DRY_RUN No account, custom claims, Firestore records, sessions, or emails were changed.\n');
      process.stdout.write(`APPLY_HINT Re-run with --apply --bootstrap-owner --confirm=${options.email}\n`);
      return;
    }

    const result = await loaded.runtime.provisionAdminAccount(
      loaded.runtime.bootstrapActor(options.email),
      {
        email: options.email,
        displayName: options.displayName || undefined,
        role: 'owner',
        sendInvitation: options.sendInvitation,
      },
      { source: 'bootstrap_cli', allowOwner: true },
    );
    const after = await loaded.runtime.inspectAdminAccount(options.email);
    printInspection('ADMIN_ACCOUNT_AFTER', after);
    process.stdout.write(`APPLIED owner_access=true firebase_user_created=${result.firebaseUserCreated} invitation=${result.invitationDelivery}\n`);
    process.stdout.write('SESSION_ACTION Sign out and sign back in to receive the current admin claims.\n');
  } finally {
    loaded.cleanup();
  }
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`Admin bootstrap failed: ${error instanceof Error ? error.message : 'unexpected_failure'}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  validEmail,
};
