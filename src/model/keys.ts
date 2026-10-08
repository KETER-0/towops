import type { Dataset } from './types.ts';

/** Every table of the dataset, in display order. One JSON file each in data/. */
export const DATASET_KEYS: (keyof Dataset)[] = [
  'company', 'insurers', 'services', 'trucks', 'assignments', 'missions',
  'cashJobs', 'creditJobs', 'clientPayments', 'charges', 'fuelFills', 'stationPayments',
];
