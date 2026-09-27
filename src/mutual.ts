/**
 * Ranks the ways a whole group can celebrate fractional birthdays together.
 * On each day, every person contributes their most major fractional birthday
 * within `windowDays` of it. Lower denominators are more major.
 *
 * The modes often put the same fractional birthday on neighbouring days, so
 * the same people celebrating the same fractional birthdays can work on
 * several days. Those days make one celebration, which lists all of them.
 */

import type { DayNumber } from './dates';
import { eventsForPerson, primaryLabel, type BirthdayEvent, type Person } from './events';
import type { Mode } from './modes';

export interface Celebration {
  /** The tightest arrangement: one event per person, in the order the people were passed in. */
  events: BirthdayEvent[];
  /** Per person, every event of theirs that one of `days` uses, earliest first. */
  personEvents: BirthdayEvent[][];
  /** Every day this celebration works on, ascending. */
  days: DayNumber[];
  /** The day that best fits `events`, closest to everyone's date. */
  day: DayNumber;
  /** Earliest and latest of the dates in `events`. */
  first: DayNumber;
  last: DayNumber;
  /** Score parts, all lower-is-better, compared in this order. */
  sumQ: number;
  maxQ: number;
  spread: number;
}

export function compareCelebrations(a: Celebration, b: Celebration): number {
  return a.sumQ - b.sumQ || a.maxQ - b.maxQ || a.spread - b.spread || a.first - b.first;
}

/** Everyone's event in a celebration, lowest denominator first; ties keep the order the people were given in. */
export function byDenominator(c: Celebration): { index: number; event: BirthdayEvent }[] {
  return c.events
    .map((event, index) => ({ index, event }))
    .sort((a, b) => primaryLabel(a.event).q - primaryLabel(b.event).q || a.index - b.index);
}

/** Between two of one person's events near `day`: the lower denominator, then the closer date, then one that is not rounded. */
function betterFor(day: DayNumber, candidate: BirthdayEvent, current: BirthdayEvent): boolean {
  const qDiff = primaryLabel(candidate).q - primaryLabel(current).q;
  if (qDiff !== 0) return qDiff < 0;
  const distDiff = Math.abs(candidate.date - day) - Math.abs(current.date - day);
  if (distDiff !== 0) return distDiff < 0;
  const approxDiff = Number(primaryLabel(candidate).approx) - Number(primaryLabel(current).approx);
  if (approxDiff !== 0) return approxDiff < 0;
  return candidate.date < current.date;
}

/** Everyone's chosen event on one particular day. */
interface Arrangement {
  events: BirthdayEvent[];
  day: DayNumber;
  spread: number;
  /** How many of the events are rounded (≈). */
  approx: number;
  /** Total days from `day` to everyone's date. */
  distance: number;
}

function compareArrangements(a: Arrangement, b: Arrangement): number {
  return a.spread - b.spread || a.approx - b.approx || a.distance - b.distance || a.day - b.day;
}

interface Group {
  best: Arrangement;
  days: DayNumber[];
  personEvents: Map<DayNumber, BirthdayEvent>[];
}

function toCelebration({ best, days, personEvents }: Group): Celebration {
  const dates = best.events.map((e) => e.date);
  const qs = best.events.map((e) => primaryLabel(e).q);
  return {
    events: best.events,
    personEvents: personEvents.map((byDate) => [...byDate.values()].sort((a, b) => a.date - b.date)),
    days,
    day: best.day,
    first: Math.min(...dates),
    last: Math.max(...dates),
    sumQ: qs.reduce((s, q) => s + q, 0),
    maxQ: Math.max(...qs),
    spread: best.spread,
  };
}

/**
 * All distinct celebrations with a day in `[from, to)`, best first.
 * People whose fractional birthdays never line up produce an empty list.
 */
export function rankCelebrations(
  people: readonly Person[],
  modes: readonly Mode[],
  denominators: readonly number[],
  from: DayNumber,
  to: DayNumber,
  windowDays: number,
): Celebration[] {
  if (people.length === 0 || to <= from) return [];
  const w = Math.max(0, Math.floor(windowDays));
  const lists = people.map((p) => eventsForPerson(p, modes, denominators, from - w, to + w));
  const groups = new Map<string, Group>();

  for (let day = from; day < to; day++) {
    const chosen: BirthdayEvent[] = [];
    for (const list of lists) {
      let best: BirthdayEvent | undefined;
      for (const e of list) {
        if (e.date < day - w) continue;
        if (e.date > day + w) break;
        if (!best || betterFor(day, e, best)) best = e;
      }
      if (!best) break;
      chosen.push(best);
    }
    if (chosen.length !== lists.length) continue;

    const dates = chosen.map((e) => e.date);
    const arrangement: Arrangement = {
      events: chosen,
      day,
      spread: Math.max(...dates) - Math.min(...dates),
      approx: chosen.filter((e) => primaryLabel(e).approx).length,
      distance: dates.reduce((s, d) => s + Math.abs(d - day), 0),
    };
    // Everyone's fractional birthday, whichever of its dates carries it.
    const key = chosen
      .map((e) => {
        const label = primaryLabel(e);
        return `${e.years}:${label.p}/${label.q}`;
      })
      .join(',');

    const group = groups.get(key);
    if (!group) {
      groups.set(key, { best: arrangement, days: [day], personEvents: chosen.map((e) => new Map([[e.date, e]])) });
      continue;
    }
    group.days.push(day);
    chosen.forEach((e, i) => group.personEvents[i]?.set(e.date, e));
    if (compareArrangements(arrangement, group.best) < 0) group.best = arrangement;
  }

  return [...groups.values()].map(toCelebration).sort(compareCelebrations);
}
