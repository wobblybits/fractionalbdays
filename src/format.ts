/**
 * Human-readable dates and fractions. Dates are formatted through Intl in
 * UTC so that a day number always prints as the calendar day it represents.
 */

import { fromDayNumber, type DayNumber } from './dates';
import type { Source } from './events';
import type { Fraction } from './fractions';
import { modeName } from './modes';

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

/** "a", "a and b", "a, b and c". */
export function listText(items: readonly string[], conjunction = 'and'): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

/** The modes behind a date in lower case: "weeks and days". */
export function methodsText(sources: readonly Source[]): string {
  return listText(sources.map((s) => modeName(s.mode).toLowerCase()));
}

/** Runs of consecutive days in an ascending list, as [first, last] pairs. */
export function dayRuns(days: readonly DayNumber[]): [DayNumber, DayNumber][] {
  const runs: [DayNumber, DayNumber][] = [];
  for (const day of days) {
    const run = runs[runs.length - 1];
    if (run && day === run[1] + 1) run[1] = day;
    else runs.push([day, day]);
  }
  return runs;
}

/**
 * Days to choose from: one day in full ("Wednesday, July 15, 2026"),
 * otherwise runs such as "Tue, Sep 8 – Thu, Sep 10" or "Fri, May 15 or Sun, May 17".
 */
export function daysText(days: readonly DayNumber[]): string {
  if (days.length === 1) return dayFormats.full(days[0]!);
  const runs = dayRuns(days).map(([a, b]) =>
    a === b ? dayFormats.medium(a) : `${dayFormats.medium(a)} – ${dayFormats.medium(b)}`,
  );
  return listText(runs, 'or');
}
