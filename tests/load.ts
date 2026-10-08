import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dataset } from '../src/model/types.ts';
import { DATASET_KEYS } from '../src/model/keys.ts';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

export function loadDataset(): Dataset {
  return Object.fromEntries(DATASET_KEYS.map((k) => [k, JSON.parse(readFileSync(join(DATA, `${k}.json`), 'utf8'))])) as unknown as Dataset;
}
