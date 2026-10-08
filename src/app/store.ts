// The demo's data. It starts from the bundled data/*.json; what a visitor
// changes is kept in their own browser only (localStorage) until they press
// "Reset demo". Nothing is ever sent anywhere.
import type { Dataset } from '../model/types.ts';
import company from '../../data/company.json';
import insurers from '../../data/insurers.json';
import services from '../../data/services.json';
import trucks from '../../data/trucks.json';
import assignments from '../../data/assignments.json';
import missions from '../../data/missions.json';
import cashJobs from '../../data/cashJobs.json';
import creditJobs from '../../data/creditJobs.json';
import clientPayments from '../../data/clientPayments.json';
import charges from '../../data/charges.json';
import fuelFills from '../../data/fuelFills.json';
import stationPayments from '../../data/stationPayments.json';

const KEY = 'towops-demo-v1';

const original = (): Dataset => structuredClone({
  company, insurers, services, trucks, assignments, missions, cashJobs, creditJobs, clientPayments, charges, fuelFills, stationPayments,
} as Dataset);

function load(): Dataset {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return JSON.parse(saved) as Dataset;
  } catch {
    // Private window or blocked storage: the demo still works, it just forgets on reload.
  }
  return original();
}

let data = load();
const listeners = new Set<() => void>();

export const getData = (): Dataset => data;

export const isModified = (): boolean => {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
};

/** Apply a change, keep it in this browser, and redraw. */
export function update(change: (d: Dataset) => void): void {
  change(data);
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Same as load(): keep working in memory.
  }
  listeners.forEach((l) => l());
}

export function reset(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing stored
  }
  data = original();
  listeners.forEach((l) => l());
}

export const onChange = (l: () => void): void => {
  listeners.add(l);
};

export const newId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
