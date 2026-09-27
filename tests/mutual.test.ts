import { describe, expect, it } from 'vitest';
import { fromDayNumber, toDayNumber, type CivilDate } from '../src/dates';
import { primaryLabel, type Person } from '../src/events';
import { denominatorsUpTo } from '../src/fractions';
import { MODES, monthsMode, weeksMode } from '../src/modes';
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
    const ranked = rankCelebrations(people(civil(1990, 3, 10), civil(1985, 3, 10)), [monthsMode], ALL, from, to, 0);
    expect(ranked[0]).toMatchObject({ sumQ: 2, maxQ: 1, spread: 0 });
    expect(fromDayNumber(ranked[0]!.first)).toEqual(civil(2026, 3, 10));
  });

  it('finds birthday-plus-half for people six months apart', () => {
    const ranked = rankCelebrations(people(civil(1990, 1, 15), civil(1992, 7, 15)), [monthsMode], ALL, from, to, 0);
    expect(ranked[0]!.sumQ).toBe(3);
    expect(ranked[1]!.sumQ).toBe(3);
    expect(new Set([labels(ranked[0]!).join(' '), labels(ranked[1]!).join(' ')])).toEqual(
      new Set(['0/1 1/2', '1/2 0/1']),
    );
  });

  it('prefers a third and a quarter over a birthday and a twelfth', () => {
    const ranked = rankCelebrations(people(civil(1990, 1, 15), civil(1992, 2, 15)), [monthsMode], ALL, from, to, 0);
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
    expect(rankCelebrations(pair, [monthsMode], ALL, from, to, 0)).toEqual([]);
    const ranked = rankCelebrations(pair, [monthsMode], ALL, from, to, 2);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]).toMatchObject({ sumQ: 2, maxQ: 1, spread: 2 });
  });

  it('never repeats the same set of events', () => {
    const ranked = rankCelebrations(people(civil(1990, 1, 15), civil(1992, 1, 17), civil(1970, 6, 2)), [weeksMode], ALL, from, to, 3);
    const keys = ranked.map((c) => c.events.map((e) => e.date).join(','));
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of ranked) {
      for (const e of c.events) expect(Math.abs(e.date - c.day)).toBeLessThanOrEqual(3);
    }
  });

  it('is sorted by the score parts in order', () => {
    const ranked = rankCelebrations(people(civil(1990, 1, 15), civil(1992, 1, 17), civil(1970, 6, 2)), [weeksMode], ALL, from, to, 3);
    for (let i = 1; i < ranked.length; i++) {
      expect(compareCelebrations(ranked[i - 1]!, ranked[i]!)).toBeLessThanOrEqual(0);
    }
  });

  it('handles empty input', () => {
    expect(rankCelebrations([], [monthsMode], ALL, from, to, 3)).toEqual([]);
    expect(rankCelebrations(people(civil(1990, 1, 15)), [monthsMode], ALL, to, from, 3)).toEqual([]);
  });
});

describe('ranking with every mode at once', () => {
  const day = (m: number, d: number) => toDayNumber(civil(2026, m, d));
  const modesOf = (e: { labels: { sources: { mode: string }[] }[] }) => e.labels[0]!.sources.map((s) => s.mode);

  it('lists every day a celebration works as one entry', () => {
    const ranked = rankCelebrations(people(civil(1990, 3, 10), civil(1985, 3, 10)), MODES, ALL, from, to, 0);
    expect(ranked[0]).toMatchObject({ sumQ: 2, days: [day(3, 10)] });
    // Half birthdays by weeks, days and months.
    expect(ranked[1]).toMatchObject({ sumQ: 4, maxQ: 2, spread: 0, day: day(9, 8) });
    expect(ranked[1]!.days).toEqual([day(9, 8), day(9, 9), day(9, 10)]);
    expect(ranked[1]!.personEvents[0]!.map((e) => e.date)).toEqual([day(9, 8), day(9, 9), day(9, 10)]);
    expect(ranked[1]!.personEvents[0]!.map(modesOf)).toEqual([['weeks'], ['days'], ['months']]);
    const halves = ranked.filter((c) => c.sumQ === 4);
    expect(halves).toHaveLength(1);
  });

  it('finds exact matches that no single mode has', () => {
    const pair = people(civil(1990, 1, 15), civil(1992, 1, 17));
    expect(rankCelebrations(pair, [monthsMode], ALL, from, to, 0)).toEqual([]);
    const ranked = rankCelebrations(pair, MODES, ALL, from, to, 0);
    // A half by days for the first person, by months for the second.
    expect(ranked[0]).toMatchObject({ sumQ: 4, spread: 0, days: [day(7, 17)] });
    expect(ranked[0]!.events.map(modesOf)).toEqual([['days'], ['months']]);
  });

  it('merges a third and a quarter that line up two ways', () => {
    const ranked = rankCelebrations(people(civil(1990, 1, 15), civil(1992, 2, 15)), MODES, ALL, from, to, 0);
    expect(ranked.slice(0, 2).map((c) => [labels(c).join(' '), c.days])).toEqual([
      ['1/3 1/4', [day(5, 15), day(5, 17)]],
      ['3/4 2/3', [day(10, 15), day(10, 16)]],
    ]);
  });

  it('never repeats the same fractional birthdays', () => {
    const ranked = rankCelebrations(people(civil(1990, 1, 15), civil(1992, 1, 17), civil(1970, 6, 2)), MODES, ALL, from, to, 3);
    const keys = ranked.map((c) => c.events.map((e) => `${e.years}:${primaryLabel(e).p}/${primaryLabel(e).q}`).join(' '));
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of ranked) {
      expect(c.days).toContain(c.day);
      for (let i = 1; i < c.days.length; i++) expect(c.days[i]!).toBeGreaterThan(c.days[i - 1]!);
      for (const e of c.events) expect(Math.abs(e.date - c.day)).toBeLessThanOrEqual(3);
    }
  });
});
