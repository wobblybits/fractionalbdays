import { describe, expect, it } from 'vitest';
import { toDayNumber, type CivilDate } from '../src/dates';
import { eventsForPerson, primaryLabel, type Person } from '../src/events';
import { denominatorsUpTo } from '../src/fractions';
import { daysMode, monthsMode, weeksMode } from '../src/modes';

const civil = (y: number, m: number, d: number): CivilDate => ({ y, m, d });
const person = (birth: CivilDate, name = 'Test'): Person => ({ id: 'x', name, birth });
const ALL = denominatorsUpTo(13);
const year2026 = [toDayNumber(civil(2026, 1, 1)), toDayNumber(civil(2027, 1, 1))] as const;

describe('events for one person', () => {
  it('gives one event per month in months mode', () => {
    const events = eventsForPerson(person(civil(1990, 7, 4)), monthsMode, ALL, ...year2026);
    expect(events).toHaveLength(12);
    for (const e of events) expect(e.labels).toHaveLength(1);
    const birthday = events.find((e) => e.date === toDayNumber(civil(2026, 7, 4)));
    expect(birthday).toBeDefined();
    expect(primaryLabel(birthday!)).toMatchObject({ p: 0, q: 1 });
    expect(birthday!.years).toBe(36);
    const half = events.find((e) => e.date === toDayNumber(civil(2026, 1, 4)));
    expect(primaryLabel(half!)).toMatchObject({ p: 1, q: 2 });
    expect(half!.years).toBe(35);
  });

  it('resolves week-mode collisions in favour of exact, then lower denominators', () => {
    const start = toDayNumber(civil(2026, 1, 1));
    const events = eventsForPerson(person(civil(2000, 1, 1)), weeksMode, ALL, ...year2026);
    const byOffset = new Map(events.map((e) => [e.date - start, e]));

    const week4 = byOffset.get(28)!;
    expect(week4.labels.map((l) => `${l.p}/${l.q}`)).toEqual(['1/13', '1/12']);
    expect(primaryLabel(week4).exact).toBe(true);

    const week46 = byOffset.get(46 * 7)!;
    expect(week46.labels.map((l) => `${l.p}/${l.q}`)).toEqual(['7/8', '8/9']);

    for (let k = 1; k < 7; k++) {
      const seventh = byOffset.get(52 * k)!;
      expect(primaryLabel(seventh)).toMatchObject({ p: k, q: 7, exact: true });
    }
  });

  it('has no collisions in days mode', () => {
    const events = eventsForPerson(person(civil(2000, 1, 1)), daysMode, ALL, ...year2026);
    expect(events).toHaveLength(58);
    for (const e of events) expect(e.labels).toHaveLength(1);
  });

  it('keeps every event inside the window, sorted', () => {
    for (const mode of [monthsMode, weeksMode, daysMode]) {
      for (const birth of [civil(1990, 7, 4), civil(2000, 2, 29), civil(1975, 12, 31)]) {
        const from = toDayNumber(civil(2026, 9, 26));
        const to = toDayNumber(civil(2027, 9, 26));
        const events = eventsForPerson(person(birth), mode, ALL, from, to);
        expect(events.length).toBeGreaterThan(0);
        for (let i = 0; i < events.length; i++) {
          const e = events[i]!;
          expect(e.date).toBeGreaterThanOrEqual(from);
          expect(e.date).toBeLessThan(to);
          if (i > 0) expect(e.date).toBeGreaterThan(events[i - 1]!.date);
        }
      }
    }
  });

  it('respects the chosen denominators', () => {
    const events = eventsForPerson(person(civil(1990, 7, 4)), monthsMode, [2], ...year2026);
    expect(events.map((e) => `${primaryLabel(e).p}/${primaryLabel(e).q}`)).toEqual(['1/2', '0/1']);
    expect(eventsForPerson(person(civil(1990, 7, 4)), monthsMode, [5, 7], ...year2026)).toHaveLength(1);
  });

  it('returns nothing for an empty window', () => {
    expect(eventsForPerson(person(civil(1990, 7, 4)), monthsMode, ALL, 100, 100)).toEqual([]);
  });
});
