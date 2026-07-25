const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

function shardFor(operationId, shardCount) {
  const digest = createHash('sha256').update(operationId).digest();
  return digest.readUInt32BE(0) % shardCount;
}

for (const shardCount of [16, 32]) {
  test(`${shardCount} aggregate shards distribute a 100k-operation load without a hotspot`, () => {
    const counts = Array.from({ length: shardCount }, () => 0);
    for (let index = 0; index < 100_000; index += 1) {
      counts[shardFor(`load-operation-${index}`, shardCount)] += 1;
    }
    const expected = 100_000 / shardCount;
    const largestDeviation = Math.max(
      ...counts.map(count => Math.abs(count - expected) / expected),
    );
    assert.ok(counts.every(count => count > 0), 'every shard should receive traffic');
    assert.ok(
      largestDeviation < 0.08,
      `largest shard deviation ${(largestDeviation * 100).toFixed(2)}% exceeds 8%`,
    );
  });
}

