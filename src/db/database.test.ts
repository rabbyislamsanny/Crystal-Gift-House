import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './database';

test('runAcceptanceTests executes all 10 acceptance criteria and passes', () => {
  const results = db.runAcceptanceTests();
  assert.equal(results.length, 10, 'Must have 10 acceptance tests');

  for (const r of results) {
    assert.equal(r.passed, true, `Test ${r.id} (${r.name}) failed: ${r.message}`);
  }
});
