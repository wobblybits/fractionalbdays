/**
 * Human-readable dates and fractions. Dates are formatted through Intl in
 * UTC so that a day number always prints as the calendar day it represents.
 */

import { fromDayNumber, type DayNumber } from './dates';
import type { Fraction } from './fractions';

export function dayToUTCDate(n: DayNumber): Date {
  const c = fromDayNumber(n);
  return new Date(Date.UTC(c.y, c.m - 1, c.d));
}

const formatters = new Map<string, Intl.DateTimeFormat>();

export function formatDay(n: DayNumber, options: Intl.DateTimeFormatOptions, locale?: string): string {
  const key = `${locale ?? ''}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
    formatters.set(key, f);
  }
  return f.format(dayToUTCDate(n));
}

export const dayFormats = {
  full: (n: DayNumber) => formatDay(n, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  medium: (n: DayNumber) => formatDay(n, { weekday: 'short', month: 'short', day: 'numeric' }),
  short: (n: DayNumber) => formatDay(n, { month: 'short', day: 'numeric' }),
  monthYear: (n: DayNumber) => formatDay(n, { month: 'long', year: 'numeric' }),
  weekdayShort: (n: DayNumber) => formatDay(n, { weekday: 'short' }),
  weekdayLong: (n: DayNumber) => formatDay(n, { weekday: 'long' }),
  dayOfMonth: (n: DayNumber) => formatDay(n, { day: 'numeric' }),
};

/** "today", "tomorrow", "in 12 days", "3 days ago". */
export function relativeDays(from: DayNumber, to: DayNumber): string {
  const diff = to - from;
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 0) return `in ${diff} days`;
  return `${-diff} days ago`;
}

/** Plain-text age such as "34 1/2" or "35". */
export function ageText(years: number, f: Fraction): string {
  return f.p === 0 ? String(years) : `${years} ${f.p}/${f.q}`;
}

/** A rounding error in days as a short phrase, or empty when exact. */
export function errorText(errorDays: number): string {
  if (errorDays === 0) return '';
  const magnitude = Math.abs(errorDays);
  const rounded = Math.round(magnitude * 10) / 10;
  const unit = rounded === 1 ? 'day' : 'days';
  return `${rounded} ${unit} ${errorDays < 0 ? 'early' : 'late'}`;
}
