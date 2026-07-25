const assert = require('node:assert/strict');
const test = require('node:test');
const {
  primeAdminAggregates,
  validateAdminAggregateReceipt,
} = require('./admin-aggregate-prime');

function validReceipt(overrides = {}) {
  return {
    success: true,
    skipped: false,
    generatedAt: new Date().toISOString(),
    windows: [7, 30, 90],
    partial: false,
    providerWritesPerformed: false,
    observabilityResets: { failed: 0, overdue: 0 },
    ...overrides,
  };
}

test('aggregate prime validates a fresh, complete execution receipt', () => {
  const receipt = validateAdminAggregateReceipt(validReceipt());
  assert.deepEqual(receipt.windows, [7, 30, 90]);
  assert.equal(receipt.partial, false);
});

test('aggregate prime rejects skipped, stale, incomplete, or provider-mutating receipts', () => {
  assert.throws(
    () => validateAdminAggregateReceipt(validReceipt({ skipped: true })),
    /already running/,
  );
  assert.throws(
    () => validateAdminAggregateReceipt(validReceipt({
      generatedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    })),
    /stale or invalid/,
  );
  assert.throws(
    () => validateAdminAggregateReceipt(validReceipt({ windows: [7, 30] })),
    /every required finance window/,
  );
  assert.throws(
    () => validateAdminAggregateReceipt(validReceipt({ providerWritesPerformed: true })),
    /read-only provider contract/,
  );
  assert.throws(
    () => validateAdminAggregateReceipt(validReceipt({
      observabilityResets: { failed: 1, overdue: 0 },
    })),
    /reset worker reported/,
  );
  assert.throws(
    () => validateAdminAggregateReceipt(validReceipt({
      observabilityResets: { failed: 0, overdue: 1 },
    })),
    /24-hour completion SLA/,
  );
});

test('aggregate prime authenticates without exposing the secret and accepts partial evidence', async () => {
  const calls = [];
  const receipt = await primeAdminAggregates({
    baseUrl: 'https://talentconsulting.io/',
    secret: 'a'.repeat(32),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => validReceipt({ partial: true }),
      };
    },
  });
  assert.equal(receipt.partial, true);
  assert.equal(calls[0].url, 'https://talentconsulting.io/api/cron/admin-aggregates');
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${'a'.repeat(32)}`);
});
