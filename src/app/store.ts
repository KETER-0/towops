// The demo's data. It starts from the bundled data/*.json; what a visitor
// changes is kept in their own browser only (localStorage) until they press
// "Reset demo". Nothing is ever sent anywhere.
import type { Dataset } from '../model/types.ts';
import { DEMO_TODAY } from '../model/types.ts';
import type { Log } from '../logic/journal.ts';
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
import users from '../../data/users.json';
import journal from '../../data/journal.json';

// v2: the dataset gained users and journal; data saved by v1 lacks them and is ignored.
const KEY = 'towops-demo-v2';
const ACTOR_KEY = 'towops-demo-actor';

const original = (): Dataset => structuredClone({
  company, insurers, services, trucks, assignments, missions, cashJobs, creditJobs, clientPayments, charges, fuelFills, stationPayments, users, journal,
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

/** Who the visitor acts as. Read from storage, so it is checked against the staff list. */
let actor = ((): string => {
  try {
    const saved = localStorage.getItem(ACTOR_KEY);
    if (saved && data.users.some((u) => u.id === saved)) return saved;
  } catch {
    // same as load()
  }
  return data.users[0]!.id;
})();

export const getActor = (): string => actor;

export function setActor(id: string): void {
  if (!data.users.some((u) => u.id === id)) return;
  actor = id;
  try {
    localStorage.setItem(ACTOR_KEY, id);
  } catch {
    // kept in memory only
  }
}

export const isModified = (): boolean => {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
};

const clock = (): string => new Date().toTimeString().slice(0, 5);

/**
 * Apply a change, journal it under the current user, keep it in this browser,
 * and redraw. The change must return what it did: no change goes unjournaled.
 */
export function update(change: (d: Dataset) => Log | Log[]): void {
  const logs = [change(data)].flat();
  // The demo's clock stops on its fixed "today"; the time of day is real.
  const at = `${DEMO_TODAY}T${clock()}`;
  for (const l of logs) data.journal.push({ id: newId('j'), at, user: actor, ...l });
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
