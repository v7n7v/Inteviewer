const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const PRODUCTION_FIREBASE_PROJECT = 'talent-consulting-acf16';
const REQUIRED_RECOVERY_OWNERS = 2;

function parseServiceAccount(value) {
  const serviceAccount = JSON.parse(String(value || '').replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
  if (serviceAccount.project_id !== PRODUCTION_FIREBASE_PROJECT) {
    throw new Error('Recovery-owner proof is bound to the production Firebase project.');
  }
  return serviceAccount;
}

async function verifyRecoveryOwners(options = {}) {
  const serviceAccount = options.serviceAccount
    || parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const app = options.app || (
    getApps()[0]
    || initializeApp({
      credential: cert(serviceAccount),
      projectId: PRODUCTION_FIREBASE_PROJECT,
    })
  );
  const db = options.db || getFirestore(app);
  const auth = options.auth || getAuth(app);
  const snapshot = await db.collection('admin_accounts')
    .where('role', '==', 'owner')
    .where('status', '==', 'active')
    .limit(REQUIRED_RECOVERY_OWNERS + 1)
    .get();
  if (snapshot.size < REQUIRED_RECOVERY_OWNERS) {
    throw new Error('At least two active recovery owners are required.');
  }
  const ownerEvidence = await Promise.all(snapshot.docs.map(async document => ({
    record: document.data() || {},
    user: await auth.getUser(document.id),
  })));
  const eligible = ownerEvidence.filter(({ record, user }) => {
    const recordEmail = String(record.email || '').trim().toLowerCase();
    const authEmail = String(user.email || '').trim().toLowerCase();
    const version = Number(record.version);
    return user.disabled !== true
      && user.emailVerified === true
      && (user.multiFactor?.enrolledFactors?.length || 0) > 0
      && Boolean(recordEmail)
      && recordEmail === authEmail
      && record.role === 'owner'
      && record.status === 'active'
      && Number.isInteger(version)
      && version >= 1
      && user.customClaims?.admin === true
      && user.customClaims?.adminRole === 'owner'
      && Number(user.customClaims?.adminVersion) === version;
  });
  if (eligible.length < REQUIRED_RECOVERY_OWNERS) {
    throw new Error('At least two recovery owners must have matching active records, claims, verified email, version, and enrolled MFA.');
  }
  return {
    activeOwners: snapshot.size,
    mfaReadyOwners: eligible.length,
    projectId: PRODUCTION_FIREBASE_PROJECT,
  };
}

async function main() {
  const proof = await verifyRecoveryOwners();
  process.stdout.write(
    `Recovery-owner proof passed: ${proof.mfaReadyOwners} MFA-ready active owners in ${proof.projectId}.\n`,
  );
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseServiceAccount,
  verifyRecoveryOwners,
};
