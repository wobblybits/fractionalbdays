import { describe, expect, it } from 'vitest';
import { fromDayNumber, toDayNumber, type CivilDate } from '../src/dates';
import { primaryLabel, type Person } from '../src/events';
import { denominatorsUpTo } from '../src/fractions';
import { monthsMode, weeksMode } from '../src/modes';
import { compareCelebrations, rankCelebrations, type Celebration } from '../src/mutual';

const civil = (y: number, m: number, d: number): CivilDate => ({ y, m, d });
const ALL = denominatorsUpTo(13);
const from = toDayNumber(civil(2026, 1, 1));
const to = toDayNumber(civil(2027, 1, 1));
const people = (...births: CivilDate[]): Person[] =>
  births.map((birth, i) => ({ id: `p${i}`, name: `P${i}`, birth }));
const labels = (c: Celebration) => c.events.map((e) => `${primaryLabel(e).p}/${primaryLabel(e).q}`);

describe('ranking shared celebrations', () => {
  it('puts a shared birthday first', () => {
    const ranked = rankCelebrations(people(civil(1990, 3, 10), civil(1985, 3, 10)), monthsMode, ALL, from, to, 0);
    expect(ranked[0]).toMatchObject({ sumQ: 2, maxQ: 1, spread: 0 });
    expect(fromDayNumber(ranked[0]!.first)).toEqual(civil(2026, 3, 10));
  });

  it('finds birthday-plus-half for people six months apart', () => {
    const ranked = rankCelebrations(people(civil(1990, 1, 15), civil(1992, 7, 15)), monthsMode, ALL, from, to, 0);
    expect(ranked[0]!.sumQ).toBe(3);
    expect(ranked[1]!.sumQ).toBe(3);
    expect(new Set([labels(ranked[0]!).join(' '), labels(ranked[1]!).join(' ')])).toEqual(
      new Set(['0/1 1/2', '1/2 0/1']),
    );
  });

  it('prefers a third and a quarter over a birthday and a twelfth', () => {
    const ranked = rankCelebrations(people(civil(1990, 1, 15), civil(1992, 2, 15)), monthsMode, ALL, from, to, 0);
    expect(ranked[0]!.sumQ).toBe(7);
    expect(ranked[1]!.sumQ).toBe(7);
    const top = [ranked[0]!, ranked[1]!].map((c) => [fromDayNumber(c.first).m, labels(c).join(' ')]);
    expect(top).toEqual(
      expect.arrayContaining([
        [5, '1/3 1/4'],
        [10, '3/4 2/3'],
      ]),
    );
    const birthdays = ranked.filter((c) => c.maxQ === 12 && c.sumQ === 13);
    expect(birthdays).toHaveLength(2);
  });

  it('needs a window when days of month differ in months mode', () => {
    const pair = people(civil(1990, 1, 15), civil(1992, 1, 17));
    expect(rankCelebrations(pair, monthsMode, ALL, from, to, 0)).toEqual([]);
    const ranked = rankCelebrations(pair, monthsMode, ALL, from, to, 2);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]).toMatchObject({ sumQ: 2, maxQ: 1, spread: 2 });
  });

  it('never repeats the same set of events', () => {
    const ranked = rankCelebrations(people(civil(1990, 1, 15), civil(1992, 1, 17), civil(1970, 6, 2)), weeksMode, ALL, from, to, 3);
    const keys = ranked.map((c) => c.events.map((e) => e.date).join(','));
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of ranked) {
      for (const e of c.events) expect(Math.abs(e.date - c.day)).toBeLessThanOrEqual(3);
    }
  });

  it('is sorted by the score parts in order', () => {
    const ranked = rankCelebrations(people(civil(1990, 1, 15), civil(1992, 1, 17), civil(1970, 6, 2)), weeksMode, ALL, from, to, 3);
    for (let i = 1; i < ranked.length; i++) {
      expect(compareCelebrations(ranked[i - 1]!, ranked[i]!)).toBeLessThanOrEqual(0);
    }
  });

  it('handles empty input', () => {
    expect(rankCelebrations([], monthsMode, ALL, from, to, 3)).toEqual([]);
    expect(rankCelebrations(people(civil(1990, 1, 15)), monthsMode, ALL, to, from, 3)).toEqual([]);
  });
});
