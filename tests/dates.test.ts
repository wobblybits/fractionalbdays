import { describe, expect, it } from 'vitest';
import {
  addMonthsClamped,
  addYearsClamped,
  anniversary,
  birthdayYearIndex,
  daysInMonth,
  fromDayNumber,
  isLeapYear,
  parseISODate,
  toDayNumber,
  toISODate,
  weekday,
} from '../src/dates';

describe('day numbers', () => {
  it('starts at the epoch', () => {
    expect(toDayNumber({ y: 1970, m: 1, d: 1 })).toBe(0);
    expect(fromDayNumber(0)).toEqual({ y: 1970, m: 1, d: 1 });
  });

  it('round-trips every day from 1896 to 2104', () => {
    let n = toDayNumber({ y: 1896, m: 1, d: 1 });
    for (let y = 1896; y <= 2104; y++) {
      for (let m = 1; m <= 12; m++) {
        for (let d = 1; d <= daysInMonth(y, m); d++) {
          expect(toDayNumber({ y, m, d })).toBe(n);
          expect(fromDayNumber(n)).toEqual({ y, m, d });
          n++;
        }
      }
    }
  });

  it('matches known day counts and weekdays', () => {
    expect(toDayNumber({ y: 2000, m: 3, d: 1 })).toBe(11017);
    expect(weekday(0)).toBe(4); // Thursday
    expect(weekday(toDayNumber({ y: 2026, m: 9, d: 26 }))).toBe(6); // Saturday
    expect(weekday(toDayNumber({ y: 1969, m: 12, d: 31 }))).toBe(3); // Wednesday, negative day number
  });
});

describe('leap years and month lengths', () => {
  it('follows the Gregorian rules', () => {
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe('adding months', () => {
  it('clamps to the end of shorter months', () => {
    expect(addMonthsClamped({ y: 2026, m: 1, d: 31 }, 1)).toEqual({ y: 2026, m: 2, d: 28 });
    expect(addMonthsClamped({ y: 2024, m: 1, d: 31 }, 1)).toEqual({ y: 2024, m: 2, d: 29 });
    expect(addMonthsClamped({ y: 2026, m: 3, d: 31 }, 1)).toEqual({ y: 2026, m: 4, d: 30 });
  });

  it('keeps the original day-of-month when computed in one step', () => {
    expect(addMonthsClamped({ y: 2026, m: 1, d: 31 }, 13)).toEqual({ y: 2027, m: 2, d: 28 });
    expect(addMonthsClamped({ y: 2026, m: 1, d: 31 }, 14)).toEqual({ y: 2027, m: 3, d: 31 });
  });

  it('handles negative offsets and year boundaries', () => {
    expect(addMonthsClamped({ y: 2026, m: 3, d: 15 }, -3)).toEqual({ y: 2025, m: 12, d: 15 });
    expect(addMonthsClamped({ y: 2026, m: 11, d: 5 }, 2)).toEqual({ y: 2027, m: 1, d: 5 });
  });

  it('adds years with leap-day clamping', () => {
    expect(addYearsClamped({ y: 2000, m: 2, d: 29 }, 1)).toEqual({ y: 2001, m: 2, d: 28 });
    expect(addYearsClamped({ y: 2000, m: 2, d: 29 }, 4)).toEqual({ y: 2004, m: 2, d: 29 });
  });
});

describe('ISO parsing', () => {
  it('accepts real dates and rejects impossible ones', () => {
    expect(parseISODate('2024-02-29')).toEqual({ y: 2024, m: 2, d: 29 });
    expect(parseISODate('2026-02-29')).toBeNull();
    expect(parseISODate('2026-13-01')).toBeNull();
    expect(parseISODate('')).toBeNull();
    expect(parseISODate('abc')).toBeNull();
    expect(toISODate({ y: 1990, m: 7, d: 4 })).toBe('1990-07-04');
  });
});

describe('anniversaries', () => {
  const birth = { y: 1990, m: 7, d: 4 };

  it('finds the birthday-year containing a day', () => {
    expect(birthdayYearIndex(birth, toDayNumber({ y: 2026, m: 7, d: 3 }))).toBe(35);
    expect(birthdayYearIndex(birth, toDayNumber({ y: 2026, m: 7, d: 4 }))).toBe(36);
    expect(birthdayYearIndex(birth, toDayNumber({ y: 2026, m: 12, d: 31 }))).toBe(36);
  });

  it('puts leap-day anniversaries on Feb 28 in common years', () => {
    const leapling = { y: 2000, m: 2, d: 29 };
    expect(fromDayNumber(anniversary(leapling, 26))).toEqual({ y: 2026, m: 2, d: 28 });
    expect(fromDayNumber(anniversary(leapling, 28))).toEqual({ y: 2028, m: 2, d: 29 });
    expect(birthdayYearIndex(leapling, toDayNumber({ y: 2026, m: 2, d: 28 }))).toBe(26);
    expect(birthdayYearIndex(leapling, toDayNumber({ y: 2026, m: 2, d: 27 }))).toBe(25);
  });
});
