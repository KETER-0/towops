import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA } from '../src/model/schema.ts';
import { DATASET_KEYS } from '../src/model/keys.ts';
import { loadDataset } from './load.ts';

test('every table is documented, and every documented field exists in the data', () => {
  const d = loadDataset();
  assert.deepEqual(SCHEMA.map((t) => t.key).sort(), [...DATASET_KEYS].sort());
  for (const t of SCHEMA) {
    const rows = d[t.key];
    const first = (Array.isArray(rows) ? rows[0] : rows) as unknown as Record<string, unknown>;
    const actual = Object.keys(first).sort();
    assert.deepEqual(t.fields.map((f) => f.name).sort(), actual, `fields of ${t.key}`);
  }
});
