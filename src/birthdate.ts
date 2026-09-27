/**
 * The birthday field is three short number boxes in the order the user's
 * locale writes dates, instead of a date picker that opens on today and has
 * to be scrolled back decades. This module holds the parts that are not DOM:
 * the order of the boxes, splitting a pasted date, and checking what was typed.
 */

import { daysInMonth, parseISODate, toDayNumber, toISODate, type CivilDate } from './dates';
import { listText } from './format';

export type DatePart = 'year' | 'month' | 'day';
export type DateParts = Record<DatePart, string>;

export const EARLIEST_BIRTH_YEAR = 1900;
export const PART_LENGTH: Record<DatePart, number> = { year: 4, month: 2, day: 2 };

const FALLBACK_ORDER: readonly DatePart[] = ['month', 'day', 'year'];
const isPart = (type: string): type is DatePart => type === 'year' || type === 'month' || type === 'day';

export function emptyParts(): DateParts {
  return { year: '', month: '', day: '' };
}

/**
 * The order `locale` writes a numeric date in: month, day, year for en-US,
 * day, month, year for en-GB, year, month, day for ja-JP.
 */
export function localeDateOrder(locale?: string): DatePart[] {
  try {
    const order = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' })
      .formatToParts(new Date(Date.UTC(2001, 10, 22)))
      .map((part) => part.type)
      .filter(isPart);
    if (order.length === 3 && new Set(order).size === 3) return order;
  } catch {
    /* unknown locale */
  }
  return [...FALLBACK_ORDER];
}

/** The three box values for a stored ISO date, or empty boxes. */
export function partsFromISO(iso: string): DateParts {
  const date = parseISODate(iso);
  if (!date) return emptyParts();
  return { year: String(date.y), month: String(date.m).padStart(2, '0'), day: String(date.d).padStart(2, '0') };
}

/**
 * Split pasted text such as "1985-03-14" or "14/3/1985" across the boxes.
 * A leading four-digit year means year, month, day; otherwise the locale's
 * order is used, with the year moved to whichever end has four digits.
 * Null unless the text is exactly three groups of digits that fit the boxes.
 */
export function splitPastedDate(text: string, order: readonly DatePart[]): DateParts | null {
  const groups = text.match(/\d+/g);
  if (!groups || groups.length !== 3) return null;
  const monthDay = order.filter((part) => part !== 'year');
  const sequence: readonly DatePart[] =
    groups[0]!.length === 4 ? ['year', 'month', 'day'] : groups[2]!.length === 4 ? [...monthDay, 'year'] : order;
  const parts = emptyParts();
  for (const [i, part] of sequence.entries()) {
    const digits = groups[i]!;
    if (digits.length > PART_LENGTH[part]) return null;
    parts[part] = digits;
  }
  return parts;
}

export type BirthCheck =
  | { kind: 'empty' }
  /** Could still become a valid date; worth mentioning only once the user moves on. */
  | { kind: 'partial'; message: string }
  /** Wrong whatever is typed next, so it can be shown straight away. */
  | { kind: 'invalid'; message: string; parts: DatePart[] }
  | { kind: 'valid'; iso: string };

function invalid(parts: DatePart[], message: string): BirthCheck {
  return { kind: 'invalid', message, parts };
}

/** What the three boxes add up to, judged against `today`. */
export function checkBirthParts(parts: DateParts, today: CivilDate): BirthCheck {
  const { year, month, day } = parts;
  if (!year && !month && !day) return { kind: 'empty' };

  // A lone 0 may be the start of 01 to 09, so it only counts as wrong with a second digit.
  const m = Number(month);
  const d = Number(day);
  if (m > 12 || (month.length > 1 && m === 0)) return invalid(['month'], 'Enter a month from 1 to 12.');
  if (d > 31 || (day.length > 1 && d === 0)) return invalid(['day'], 'Enter a day from 1 to 31.');

  const y = year.length === 4 ? Number(year) : null;
  if (y !== null && y < EARLIEST_BIRTH_YEAR) return invalid(['year'], `Enter a year from ${EARLIEST_BIRTH_YEAR} onward.`);
  if (y !== null && y > today.y) return invalid(['year'], 'That year hasn’t happened yet.');

  if (m > 0 && d > 0) {
    // Until the year is known, allow February 29 (2000 was a leap year).
    const longest = daysInMonth(y ?? 2000, m);
    if (d > longest) {
      return invalid(['day'], m === 2 && d === 29 ? `${y} is not a leap year.` : `That month has only ${longest} days.`);
    }
  }

  const missing: string[] = [];
  if (m === 0) missing.push('month');
  if (d === 0) missing.push('day');
  if (!year) missing.push('year');
  if (missing.length > 0) return { kind: 'partial', message: `Add the ${listText(missing)}.` };
  if (y === null) return { kind: 'partial', message: 'Enter all four digits of the year.' };

  const date: CivilDate = { y, m, d };
  if (toDayNumber(date) > toDayNumber(today)) return invalid(['year', 'month', 'day'], 'That date hasn’t happened yet.');
  return { kind: 'valid', iso: toISODate(date) };
}
