/**
 * Turns a person plus a mode into the list of their fractional birthdays
 * inside a window of days. This is the one place that enumerates fractions
 * and resolves two fractions landing on the same date.
 */

import { birthdayYearIndex, type CivilDate, type DayNumber } from './dates';
import { properFractions, WHOLE, type Fraction } from './fractions';
import type { Mode } from './modes';

export interface Person {
  id: string;
  name: string;
  birth: CivilDate;
}

export interface FractionLabel extends Fraction {
  exact: boolean;
  errorDays: number;
  clamped: boolean;
}

export interface BirthdayEvent {
  personId: string;
  date: DayNumber;
  /** Age in whole years on this date. */
  years: number;
  /** Every fraction that lands on this date, best first. */
  labels: FractionLabel[];
}

/** The label a date is known by: exact beats rounded, then the lower denominator wins. */
export function primaryLabel(event: BirthdayEvent): FractionLabel {
  const label = event.labels[0];
  if (!label) throw new Error('event without labels');
  return label;
}

export function compareLabels(a: FractionLabel, b: FractionLabel): number {
  if (a.exact !== b.exact) return a.exact ? -1 : 1;
  if (a.q !== b.q) return a.q - b.q;
  const error = Math.abs(a.errorDays) - Math.abs(b.errorDays);
  if (error !== 0) return error;
  return a.p - b.p;
}

/** The whole birthday plus every proper fraction the mode can place. */
export function fractionsForMode(mode: Mode, denominators: readonly number[]): Fraction[] {
  const usable = denominators.filter((q) => mode.status(q) !== 'unsupported');
  return [WHOLE, ...properFractions(usable)];
}

/**
 * Fractional birthdays of `person` with `from <= date < to`, sorted by date.
 * One event per date; fractions that round to the same date share it.
 */
export function eventsForPerson(
  person: Person,
  mode: Mode,
  denominators: readonly number[],
  from: DayNumber,
  to: DayNumber,
): BirthdayEvent[] {
  if (to <= from) return [];
  const fractions = fractionsForMode(mode, denominators);
  const byDate = new Map<DayNumber, BirthdayEvent>();

  const firstYear = birthdayYearIndex(person.birth, from);
  const lastYear = birthdayYearIndex(person.birth, to - 1);
  for (let n = firstYear; n <= lastYear; n++) {
    for (const f of fractions) {
      const placed = mode.place(person.birth, n, f.p, f.q);
      if (placed.date < from || placed.date >= to) continue;
      const label: FractionLabel = {
        p: f.p,
        q: f.q,
        exact: placed.exact,
        errorDays: placed.errorDays,
        clamped: placed.clamped,
      };
      const existing = byDate.get(placed.date);
      if (existing) existing.labels.push(label);
      else byDate.set(placed.date, { personId: person.id, date: placed.date, years: n, labels: [label] });
    }
  }

  const events = [...byDate.values()];
  for (const e of events) e.labels.sort(compareLabels);
  return events.sort((a, b) => a.date - b.date);
}
