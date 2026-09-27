import { describe, expect, it } from 'vitest';
import { fromDayNumber, toDayNumber, weekday, type CivilDate } from '../src/dates';
import { daysMode, modeName, modesSupporting, monthsMode, weeksMode } from '../src/modes';

const civil = (y: number, m: number, d: number): CivilDate => ({ y, m, d });
const on = (date: number) => fromDayNumber(date);

describe('months mode', () => {
  it('keeps the day-of-month', () => {
    expect(on(monthsMode.place(civil(2000, 1, 1), 26, 1, 2).date)).toEqual(civil(2026, 7, 1));
    expect(on(monthsMode.place(civil(1990, 7, 4), 36, 1, 3).date)).toEqual(civil(2026, 11, 4));
    expect(on(monthsMode.place(civil(1990, 7, 4), 36, 11, 12).date)).toEqual(civil(2027, 6, 4));
  });

  it('clamps once, from the birth date', () => {
    const feb = monthsMode.place(civil(2000, 1, 31), 26, 1, 12);
    expect(on(feb.date)).toEqual(civil(2026, 2, 28));
    expect(feb.clamped).toBe(true);
    const mar = monthsMode.place(civil(2000, 1, 31), 26, 1, 6);
    expect(on(mar.date)).toEqual(civil(2026, 3, 31));
    expect(mar.clamped).toBe(false);
  });

  it('handles leap-day births', () => {
    const leapling = civil(2000, 2, 29);
    expect(on(monthsMode.place(leapling, 26, 0, 1).date)).toEqual(civil(2026, 2, 28));
    expect(on(monthsMode.place(leapling, 26, 1, 12).date)).toEqual(civil(2026, 3, 29));
    expect(on(monthsMode.place(leapling, 26, 1, 2).date)).toEqual(civil(2026, 8, 29));
    expect(on(monthsMode.place(leapling, 28, 0, 1).date)).toEqual(civil(2028, 2, 29));
  });

  it('only supports denominators dividing 12', () => {
    expect([2, 3, 4, 6, 12].map((q) => monthsMode.status(q))).toEqual(['exact', 'exact', 'exact', 'exact', 'exact']);
    expect([5, 7, 8, 9, 10, 11, 13].map((q) => monthsMode.status(q))).toEqual(Array(7).fill('unsupported'));
    expect(() => monthsMode.place(civil(2000, 1, 1), 26, 1, 5)).toThrow();
  });
});

describe('weeks mode', () => {
  const birth = civil(2000, 1, 1);
  const start = toDayNumber(civil(2026, 1, 1));

  it('places exact fractions as whole days of a 364-day year', () => {
    const half = weeksMode.place(birth, 26, 1, 2);
    expect(half).toMatchObject({ exact: true, errorDays: 0 });
    expect(on(half.date)).toEqual(civil(2026, 7, 2));
    expect(on(weeksMode.place(birth, 26, 1, 4).date)).toEqual(civil(2026, 4, 2));
    const seventh = weeksMode.place(birth, 26, 1, 7);
    expect(seventh.exact).toBe(true);
    expect(seventh.date - start).toBe(52);
    expect(on(seventh.date)).toEqual(civil(2026, 2, 22));
    const thirteenth = weeksMode.place(birth, 26, 1, 13);
    expect(thirteenth.exact).toBe(true);
    expect(thirteenth.date - start).toBe(28);
  });

  it('rounds everything else to whole weeks on the birthday weekday', () => {
    const third = weeksMode.place(birth, 26, 1, 3);
    expect(third.exact).toBe(false);
    expect(third.date - start).toBe(17 * 7);
    expect(third.errorDays).toBeCloseTo(119 - 364 / 3, 6);
    expect(weekday(third.date)).toBe(weekday(start));
    const eighth = weeksMode.place(birth, 26, 1, 8);
    expect(eighth.date - start).toBe(7 * 7); // 6.5 weeks rounds up
  });

  it('reports which denominators are exact', () => {
    expect([2, 4, 7, 13].map((q) => weeksMode.status(q))).toEqual(['exact', 'exact', 'exact', 'exact']);
    expect([3, 5, 6, 8, 9, 10, 11, 12].map((q) => weeksMode.status(q))).toEqual(Array(8).fill('rounded'));
  });
});

describe('days mode', () => {
  const birth = civil(2000, 1, 1);

  it('uses the real length of the birthday-year', () => {
    const half2026 = daysMode.place(birth, 26, 1, 2);
    expect(on(half2026.date)).toEqual(civil(2026, 7, 3));
    expect(half2026.exact).toBe(false);
    expect(half2026.errorDays).toBeCloseTo(0.5);
    const half2028 = daysMode.place(birth, 28, 1, 2);
    expect(on(half2028.date)).toEqual(civil(2028, 7, 2));
    expect(half2028.exact).toBe(true);
  });

  it('rounds to the nearest day', () => {
    const quarter = daysMode.place(birth, 26, 1, 4);
    expect(on(quarter.date)).toEqual(civil(2026, 4, 2));
    expect(quarter.errorDays).toBeCloseTo(-0.25);
    const fifth = daysMode.place(birth, 26, 1, 5);
    expect(on(fifth.date)).toEqual(civil(2026, 3, 15));
    expect(fifth.exact).toBe(true);
  });

  it('never leaves the birthday-year', () => {
    for (const b of [civil(2000, 1, 1), civil(1999, 12, 31), civil(2000, 2, 29), civil(1987, 3, 31)]) {
      for (let n = 20; n < 30; n++) {
        const start = toDayNumber(b) + 0; // placeholder to keep types happy
        void start;
        for (let q = 2; q <= 13; q++) {
          for (let p = 1; p < q; p++) {
            for (const mode of [weeksMode, daysMode]) {
              const placed = mode.place(b, n, p, q);
              const a0 = mode.place(b, n, 0, 1).date;
              const a1 = mode.place(b, n + 1, 0, 1).date;
              expect(placed.date).toBeGreaterThanOrEqual(a0);
              expect(placed.date).toBeLessThan(a1);
            }
          }
        }
      }
    }
  });
});

describe('mode lookup', () => {
  it('lists the modes that can place a denominator', () => {
    expect(modesSupporting(1).map((m) => m.id)).toEqual(['months', 'weeks', 'days']);
    expect(modesSupporting(6).map((m) => m.id)).toEqual(['months', 'weeks', 'days']);
    expect(modesSupporting(5).map((m) => m.id)).toEqual(['weeks', 'days']);
    expect(modeName('weeks')).toBe('Weeks');
  });
});
