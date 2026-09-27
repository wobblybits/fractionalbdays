/**
 * The three ways of turning "p/q of the way through a birthday-year" into a
 * calendar date. Each mode is a strategy object; nothing else in the app knows
 * how any particular mode works.
 */

import {
  addMonthsClamped,
  anniversary,
  toDayNumber,
  type CivilDate,
  type DayNumber,
} from './dates';

export type ModeId = 'months' | 'weeks' | 'days';

export interface Placement {
  /** The calendar date of this fractional birthday. */
  date: DayNumber;
  /** True when the mode's own arithmetic lands exactly on a day. */
  exact: boolean;
  /** Signed days the chosen date is off from the mode's ideal instant; 0 when exact. */
  errorDays: number;
  /** Month mode only: the day-of-month had to be pulled back to the end of a shorter month. */
  clamped: boolean;
}

export type DenominatorStatus = 'exact' | 'rounded' | 'unsupported';

export interface Mode {
  id: ModeId;
  name: string;
  /** One line for the UI. */
  summary: string;
  /** Longer explanation of the rules, shown in the help panel. */
  details: string[];
  /** Whether fractions with this denominator appear at all, and whether they are exact. */
  status(q: number): DenominatorStatus;
  /** Whether rounded placements are worth flagging in the UI (false when they are never more than half a day off). */
  flagRounding: boolean;
  /** Date of the fraction p/q in the birthday-year that starts at the n-th anniversary. */
  place(birth: CivilDate, n: number, p: number, q: number): Placement;
}

const exactPlacement = (date: DayNumber, clamped = false): Placement => ({
  date,
  exact: true,
  errorDays: 0,
  clamped,
});

/**
 * Months: the day-of-month stays the same, so only fractions that are a whole
 * number of months exist (denominators dividing 12). Dates are computed from
 * the birth date in a single step and clamped once, which keeps a 31st-born
 * person on the 31st in long months even after passing through February.
 */
export const monthsMode: Mode = {
  id: 'months',
  name: 'Months',
  summary: 'A year is 12 months. The day of the month stays the same.',
  details: [
    'Only fractions that are a whole number of months exist: halves, thirds, quarters, sixths and twelfths. A fifth of a year is not a whole number of months, so there is no fifth birthday in this mode.',
    'If the birthday is on the 29th, 30th or 31st and the target month is shorter, the date is pulled back to the last day of that month. It returns to the real day-of-month in the following long month.',
    'People born on February 29 have their birthday on February 28 in common years, but their fractional birthdays stay on the 29th of their months.',
  ],
  status(q) {
    return 12 % q === 0 ? 'exact' : 'unsupported';
  },
  flagRounding: false,
  place(birth, n, p, q) {
    if (12 % q !== 0) throw new Error(`Month mode does not support denominator ${q}`);
    const date = addMonthsClamped(birth, 12 * n + (12 * p) / q);
    return exactPlacement(toDayNumber(date), date.d !== birth.d);
  },
};

const WEEK_YEAR_DAYS = 52 * 7;

/**
 * Weeks: a year is 52 weeks, which is 364 days. Fractions that are a whole
 * number of days in that year are exact: halves, quarters, sevenths (52 days),
 * thirteenths (4 weeks) and so on. Everything else is rounded to the nearest
 * whole week, so it falls on the same weekday as that year's birthday.
 */
export const weeksMode: Mode = {
  id: 'weeks',
  name: 'Weeks',
  summary: 'A year is 52 weeks. Halves, quarters, sevenths and thirteenths are exact.',
  details: [
    'Fifty-two weeks is 364 days. A fraction is exact when it is a whole number of days in that year: a half is 26 weeks, a quarter is 13 weeks, a thirteenth is 4 weeks and a seventh is 52 days.',
    'Every other fraction is rounded to the nearest whole week and marked with ≈. Those dates always fall on the same weekday as that year\'s birthday. The rounding can be up to three and a half days.',
    'When a rounded fraction lands on the same week as an exact one, the exact one is the main label and the rounded one is listed beneath it.',
  ],
  status(q) {
    return WEEK_YEAR_DAYS % q === 0 ? 'exact' : 'rounded';
  },
  flagRounding: true,
  place(birth, n, p, q) {
    const start = anniversary(birth, n);
    const ideal = (WEEK_YEAR_DAYS * p) / q;
    if (Number.isInteger(ideal)) return exactPlacement(start + ideal);
    const offset = Math.round((52 * p) / q) * 7;
    return { date: start + offset, exact: false, errorDays: offset - ideal, clamped: false };
  },
};

/**
 * Days: a year is the actual number of days between two consecutive
 * anniversaries, 365 or 366. Every fraction is rounded to the nearest day,
 * so nothing is ever more than half a day off.
 */
export const daysMode: Mode = {
  id: 'days',
  name: 'Days',
  summary: 'A year is 365 days, or 366 across a leap day. Everything rounds to the nearest day.',
  details: [
    'The year is the real number of days from one birthday to the next, so leap days are counted when they fall inside it.',
    'A fraction is placed at the nearest whole day, which is never more than half a day from the true instant. Half of 365 days rounds up, so a half birthday comes 183 days after the birthday in a common year.',
    'Almost nothing is exact in this mode. Fifths are exact in a 365-day year, and halves, thirds and sixths are exact in a 366-day year.',
  ],
  status() {
    return 'rounded';
  },
  flagRounding: false,
  place(birth, n, p, q) {
    const start = anniversary(birth, n);
    const length = anniversary(birth, n + 1) - start;
    const ideal = (length * p) / q;
    const offset = Math.round(ideal);
    return {
      date: start + offset,
      exact: Number.isInteger(ideal),
      errorDays: offset - ideal,
      clamped: false,
    };
  },
};

export const MODES: readonly Mode[] = [monthsMode, weeksMode, daysMode];

export function modeById(id: string): Mode {
  return MODES.find((m) => m.id === id) ?? monthsMode;
}
