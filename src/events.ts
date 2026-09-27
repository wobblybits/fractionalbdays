/**
 * Turns a person into their fractional birthdays inside a window of days,
 * counted by several modes at once. This is the one place that enumerates
 * fractions and decides what a date is known by when several fractions land
 * on it.
 *
 * The same placements are grouped two ways: by date (`eventsForPerson`, what
 * the shared-celebration search needs) and by fractional birthday
 * (`occurrencesForPerson`, one entry per half birthday, third birthday and so
 * on, listing every date the modes give it).
 */

import { birthdayYearIndex, type CivilDate, type DayNumber } from './dates';
import { properFractions, WHOLE, type Fraction } from './fractions';
import type { Mode, ModeId } from './modes';

export interface Person {
  id: string;
  name: string;
  birth: CivilDate;
}

/** One mode's placement of a fraction on a date. */
export interface Source {
  mode: ModeId;
  /** The mode's arithmetic lands exactly on this day. */
  exact: boolean;
  /** Signed days the date is off from the mode's ideal instant; 0 when exact. */
  errorDays: number;
  /** Months only: the day of the month was pulled back to the end of a shorter month. */
  clamped: boolean;
  /** Rounded far enough to be worth flagging with ≈ (weeks only). */
  approx: boolean;
}

/** A fraction on one date, with every mode that puts it there. */
export interface FractionLabel extends Fraction {
  /** In the order the modes were given. */
  sources: Source[];
  /** True when every source is a rounded (≈) placement. */
  approx: boolean;
}

export interface BirthdayEvent {
  personId: string;
  date: DayNumber;
  /** Age in whole years on this date. */
  years: number;
  /** Every fraction that lands on this date, best first. */
  labels: FractionLabel[];
}

/** One of the dates of an occurrence, with the modes that give it. */
export interface OccurrenceDate {
  date: DayNumber;
  sources: Source[];
  approx: boolean;
}

/**
 * One fractional birthday, such as the half birthday at 36 1/2, with every
 * date the modes give for it. The modes rarely disagree by more than a few
 * days.
 */
export interface Occurrence extends Fraction {
  personId: string;
  /** Age in whole years on each of its dates. */
  years: number;
  /** Every distinct date, earliest first. Some may lie outside the window that was asked for. */
  dates: OccurrenceDate[];
  /** The earliest of `dates` inside the window. */
  date: DayNumber;
}

/** The label a date is known by: see `compareLabels`. */
export function primaryLabel(event: BirthdayEvent): FractionLabel {
  const label = event.labels[0];
  if (!label) throw new Error('event without labels');
  return label;
}

function smallestError(label: FractionLabel): number {
  return Math.min(...label.sources.map((s) => Math.abs(s.errorDays)));
}

/** Best first: a label that is not rounded (≈) beats one that is, then the lower denominator wins. */
export function compareLabels(a: FractionLabel, b: FractionLabel): number {
  if (a.approx !== b.approx) return a.approx ? 1 : -1;
  if (a.q !== b.q) return a.q - b.q;
  const error = smallestError(a) - smallestError(b);
  if (error !== 0) return error;
  return a.p - b.p;
}

/** The whole birthday plus every proper fraction at least one of the modes can place. */
export function fractionsFor(modes: readonly Mode[], denominators: readonly number[]): Fraction[] {
  const usable = denominators.filter((q) => modes.some((m) => m.status(q) !== 'unsupported'));
  return [WHOLE, ...properFractions(usable)];
}

const allApprox = (sources: readonly Source[]): boolean => sources.every((s) => s.approx);

interface Hit {
  date: DayNumber;
  years: number;
  fraction: Fraction;
  sources: Source[];
}

/**
 * Every date any mode gives any chosen fraction in birthday-years `firstYear`
 * to `lastYear`. Modes that agree on a date share one hit.
 */
function hitsFor(
  person: Person,
  modes: readonly Mode[],
  denominators: readonly number[],
  firstYear: number,
  lastYear: number,
): Hit[] {
  const fractions = fractionsFor(modes, denominators);
  const hits: Hit[] = [];
  for (let n = firstYear; n <= lastYear; n++) {
    for (const fraction of fractions) {
      const byDate = new Map<DayNumber, Source[]>();
      for (const mode of modes) {
        if (mode.status(fraction.q) === 'unsupported') continue;
        const placed = mode.place(person.birth, n, fraction.p, fraction.q);
        const source: Source = {
          mode: mode.id,
          exact: placed.exact,
          errorDays: placed.errorDays,
          clamped: placed.clamped,
          approx: mode.flagRounding && !placed.exact,
        };
        const sources = byDate.get(placed.date);
        if (sources) sources.push(source);
        else byDate.set(placed.date, [source]);
      }
      for (const [date, sources] of byDate) hits.push({ date, years: n, fraction, sources });
    }
  }
  return hits;
}

/** Birthday-years that can have a date in `[from, to)`: every mode keeps a year's dates inside that year. */
function yearsCovering(person: Person, from: DayNumber, to: DayNumber): [number, number] {
  return [birthdayYearIndex(person.birth, from), birthdayYearIndex(person.birth, to - 1)];
}

/**
 * Fractional birthdays of `person` with `from <= date < to`, sorted by date.
 * One event per date; everything that lands on the same date shares it.
 */
export function eventsForPerson(
  person: Person,
  modes: readonly Mode[],
  denominators: readonly number[],
  from: DayNumber,
  to: DayNumber,
): BirthdayEvent[] {
  if (to <= from) return [];
  const byDate = new Map<DayNumber, BirthdayEvent>();
  for (const hit of hitsFor(person, modes, denominators, ...yearsCovering(person, from, to))) {
    if (hit.date < from || hit.date >= to) continue;
    const label: FractionLabel = { ...hit.fraction, sources: hit.sources, approx: allApprox(hit.sources) };
    const existing = byDate.get(hit.date);
    if (existing) existing.labels.push(label);
    else byDate.set(hit.date, { personId: person.id, date: hit.date, years: hit.years, labels: [label] });
  }

  const events = [...byDate.values()];
  for (const e of events) e.labels.sort(compareLabels);
  return events.sort((a, b) => a.date - b.date);
}

/**
 * Fractional birthdays of `person` with at least one date in `[from, to)`,
 * one per fraction and year, ordered by their first date in that window and
 * then by denominator.
 */
export function occurrencesForPerson(
  person: Person,
  modes: readonly Mode[],
  denominators: readonly number[],
  from: DayNumber,
  to: DayNumber,
): Occurrence[] {
  if (to <= from) return [];
  const groups = new Map<string, { years: number; fraction: Fraction; dates: OccurrenceDate[] }>();
  for (const hit of hitsFor(person, modes, denominators, ...yearsCovering(person, from, to))) {
    const key = `${hit.years}:${hit.fraction.p}/${hit.fraction.q}`;
    let group = groups.get(key);
    if (!group) {
      group = { years: hit.years, fraction: hit.fraction, dates: [] };
      groups.set(key, group);
    }
    group.dates.push({ date: hit.date, sources: hit.sources, approx: allApprox(hit.sources) });
  }

  const occurrences: Occurrence[] = [];
  for (const { years, fraction, dates } of groups.values()) {
    dates.sort((a, b) => a.date - b.date);
    const inside = dates.find((d) => d.date >= from && d.date < to);
    if (inside) occurrences.push({ personId: person.id, ...fraction, years, dates, date: inside.date });
  }
  return occurrences.sort((a, b) => a.date - b.date || a.q - b.q || a.p - b.p);
}
