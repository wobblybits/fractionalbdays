/**
 * Application state and its round trip through the URL hash, so a link
 * carries everything needed to reproduce a view without any server.
 */

import { parseISODate } from './dates';
import { denominatorsUpTo } from './fractions';
import type { Person } from './events';

export const MAX_DENOMINATOR = 13;
/** The Me view leaves out thirteenths. */
export const SOLO_MAX_DENOMINATOR = 12;
export const MAX_WINDOW_DAYS = 7;
/** 0 means everyone's fractional birthday falls on the celebration day itself. */
export const DEFAULT_WINDOW_DAYS = 0;

export type View = 'me' | 'together';

export interface PersonInput {
  id: string;
  name: string;
  /** ISO date or empty while the user is still typing. */
  birth: string;
}

export interface AppState {
  view: View;
  denominators: number[];
  windowDays: number;
  people: PersonInput[];
}

let nextId = 0;
export function newPersonId(): string {
  nextId += 1;
  return `p${nextId}`;
}

export function defaultState(): AppState {
  return {
    view: 'me',
    denominators: denominatorsUpTo(MAX_DENOMINATOR),
    windowDays: DEFAULT_WINDOW_DAYS,
    people: [{ id: newPersonId(), name: '', birth: '' }],
  };
}

/** People with a usable birthday, in order. */
export function validPeople(state: AppState): Person[] {
  const out: Person[] = [];
  state.people.forEach((p, index) => {
    const birth = parseISODate(p.birth);
    if (birth) out.push({ id: p.id, name: p.name.trim() || defaultName(index), birth });
  });
  return out;
}

/** The denominators a view uses: the chosen ones, without thirteenths in the Me view. */
export function denominatorsForView(state: AppState, view: View = state.view): number[] {
  return view === 'me' ? state.denominators.filter((q) => q <= SOLO_MAX_DENOMINATOR) : state.denominators;
}

export function defaultName(index: number): string {
  return index === 0 ? 'You' : `Person ${index + 1}`;
}

export function encodeState(state: AppState): string {
  const params = new URLSearchParams();
  params.set('v', state.view);
  const all = denominatorsUpTo(MAX_DENOMINATOR);
  const chosen = [...state.denominators].sort((a, b) => a - b);
  if (chosen.length !== all.length || chosen.some((q, i) => q !== all[i])) {
    params.set('q', chosen.join(','));
  }
  params.set('w', String(state.windowDays));
  for (const p of state.people) {
    if (!p.name && !p.birth) continue;
    params.append('p', `${encodeURIComponent(p.name)}|${p.birth}`);
  }
  return params.toString();
}

/**
 * Tolerant decode: anything malformed falls back to the default. Links from
 * before every mode was shown at once also carry `m`, which is ignored.
 */
export function decodeState(hash: string): AppState {
  const state = defaultState();
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.size === 0) return state;

  const view = params.get('v');
  if (view === 'me' || view === 'together') state.view = view;

  const q = params.get('q');
  if (q !== null) {
    const parsed = q
      .split(',')
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && n >= 2 && n <= MAX_DENOMINATOR);
    state.denominators = [...new Set(parsed)].sort((a, b) => a - b);
  }

  const w = params.get('w');
  if (w !== null && /^\d+$/.test(w) && Number(w) <= MAX_WINDOW_DAYS) state.windowDays = Number(w);

  const people = params.getAll('p');
  if (people.length > 0) {
    state.people = people.map((entry) => {
      const cut = entry.lastIndexOf('|');
      const rawName = cut >= 0 ? entry.slice(0, cut) : entry;
      const birth = cut >= 0 ? entry.slice(cut + 1) : '';
      let name = rawName;
      try {
        name = decodeURIComponent(rawName);
      } catch {
        /* keep raw */
      }
      return { id: newPersonId(), name: name.slice(0, 60), birth: parseISODate(birth) ? birth : '' };
    });
  }
  return state;
}
