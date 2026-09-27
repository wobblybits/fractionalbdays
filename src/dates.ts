/**
 * Calendar-date arithmetic on the proleptic Gregorian calendar.
 *
 * Dates are represented two ways:
 *  - `CivilDate`: year / month (1-12) / day (1-31), for month-aware operations.
 *  - `DayNumber`: integer days since 1970-01-01, for day arithmetic and ordering.
 *
 * There are no times and no time zones anywhere in this module, so nothing
 * here can be affected by daylight-saving changes or the browser's zone.
 */

export type DayNumber = number;

export interface CivilDate {
  y: number;
  m: number;
  d: number;
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

/** Days since 1970-01-01 (Howard Hinnant's days_from_civil). */
export function toDayNumber(date: CivilDate): DayNumber {
  const { m, d } = date;
  const y = m <= 2 ? date.y - 1 : date.y;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of `toDayNumber` (Howard Hinnant's civil_from_days). */
export function fromDayNumber(n: DayNumber): CivilDate {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: m <= 2 ? y + 1 : y, m, d };
}

/** 0 = Sunday … 6 = Saturday. 1970-01-01 was a Thursday. */
export function weekday(n: DayNumber): number {
  return (((n + 4) % 7) + 7) % 7;
}

/**
 * Add whole months, keeping the day-of-month where possible and clamping to
 * the end of the target month otherwise (Jan 31 + 1 month = Feb 28 or 29).
 *
 * Always call this once from the original date with the total offset. Adding
 * in several steps clamps at each step and loses the original day-of-month.
 */
export function addMonthsClamped(date: CivilDate, months: number): CivilDate {
  const total = date.y * 12 + (date.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return { y, m, d: Math.min(date.d, daysInMonth(y, m)) };
}

export function addYearsClamped(date: CivilDate, years: number): CivilDate {
  return addMonthsClamped(date, years * 12);
}

export function isValidCivilDate(date: CivilDate): boolean {
  return (
    Number.isInteger(date.y) &&
    Number.isInteger(date.m) &&
    Number.isInteger(date.d) &&
    date.m >= 1 &&
    date.m <= 12 &&
    date.d >= 1 &&
    date.d <= daysInMonth(date.y, date.m)
  );
}

/** Parse `YYYY-MM-DD`; returns null for anything malformed or impossible. */
export function parseISODate(s: string): CivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!match) return null;
  const date = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  return isValidCivilDate(date) ? date : null;
}

export function toISODate(date: CivilDate): string {
  const pad = (n: number, width: number) => String(n).padStart(width, '0');
  return `${pad(date.y, 4)}-${pad(date.m, 2)}-${pad(date.d, 2)}`;
}

/** Today's date in the user's local calendar. */
export function todayLocal(now: Date = new Date()): CivilDate {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

/**
 * The n-th anniversary of `birth`. Leap-day births fall on Feb 28 in
 * common years.
 */
export function anniversary(birth: CivilDate, n: number): DayNumber {
  return toDayNumber(addYearsClamped(birth, n));
}

/**
 * Index n of the birthday-year containing `day`, so that
 * anniversary(birth, n) <= day < anniversary(birth, n + 1).
 * This is also the person's age in whole years on that day.
 */
export function birthdayYearIndex(birth: CivilDate, day: DayNumber): number {
  let n = fromDayNumber(day).y - birth.y;
  if (anniversary(birth, n) > day) n -= 1;
  return n;
}
