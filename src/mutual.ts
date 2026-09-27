/**
 * Ranks the days on which a whole group can celebrate fractional birthdays
 * together. A celebration is a day such that every person has a fractional
 * birthday within `windowDays` of it. Lower denominators are more major.
 */

import type { DayNumber } from './dates';
import { eventsForPerson, primaryLabel, type BirthdayEvent, type Person } from './events';
import type { Mode } from './modes';

export interface Celebration {
  /** One event per person, in the same order as the people passed in. */
  events: BirthdayEvent[];
  /** Earliest and latest of those events' dates. */
  first: DayNumber;
  last: DayNumber;
  /** The single day closest to everyone's fractional birthday. */
  day: DayNumber;
  /** Score parts, all lower-is-better, compared in this order. */
  sumQ: number;
  maxQ: number;
  spread: number;
}

export function compareCelebrations(a: Celebration, b: Celebration): number {
  return a.sumQ - b.sumQ || a.maxQ - b.maxQ || a.spread - b.spread || a.first - b.first;
}

/** Between two of one person's events near `day`, prefer the lower denominator, then the closer date. */
function betterFor(day: DayNumber, candidate: BirthdayEvent, current: BirthdayEvent): boolean {
  const qDiff = primaryLabel(candidate).q - primaryLabel(current).q;
  if (qDiff !== 0) return qDiff < 0;
  const distDiff = Math.abs(candidate.date - day) - Math.abs(current.date - day);
  if (distDiff !== 0) return distDiff < 0;
  return candidate.date < current.date;
}

function makeCelebration(events: BirthdayEvent[], day: DayNumber): Celebration {
  const dates = events.map((e) => e.date);
  const qs = events.map((e) => primaryLabel(e).q);
  const first = Math.min(...dates);
  const last = Math.max(...dates);
  return {
    events,
    first,
    last,
    day,
    sumQ: qs.reduce((s, q) => s + q, 0),
    maxQ: Math.max(...qs),
    spread: last - first,
  };
}

/**
 * All distinct celebrations with a celebration day in `[from, to)`, best first.
 * People whose fractional birthdays never line up produce an empty list.
 */
export function rankCelebrations(
  people: readonly Person[],
  mode: Mode,
  denominators: readonly number[],
  from: DayNumber,
  to: DayNumber,
  windowDays: number,
): Celebration[] {
  if (people.length === 0 || to <= from) return [];
  const w = Math.max(0, Math.floor(windowDays));
  const lists = people.map((p) => eventsForPerson(p, mode, denominators, from - w, to + w));
  const found = new Map<string, { celebration: Celebration; distance: number }>();

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

    const key = chosen.map((e) => e.date).join(',');
    const distance = chosen.reduce((s, e) => s + Math.abs(e.date - day), 0);
    const existing = found.get(key);
    if (!existing) found.set(key, { celebration: makeCelebration(chosen, day), distance });
    else if (distance < existing.distance) {
      existing.celebration.day = day;
      existing.distance = distance;
    }
  }

  return [...found.values()].map((x) => x.celebration).sort(compareCelebrations);
}
