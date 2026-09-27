/**
 * iCalendar export: one all-day event per fractional birthday, so the dates
 * can live in the user's real calendar.
 */

import { fromDayNumber, type DayNumber } from './dates';
import { primaryLabel, type Occurrence, type Person } from './events';
import { fractionName } from './fractions';
import { ageText, dayFormats, daysText, methodsText } from './format';
import { byDenominator, type Celebration } from './mutual';

interface IcsEvent {
  uid: string;
  date: DayNumber;
  /** Last day of an event that spans several days; defaults to `date`. */
  lastDate?: DayNumber;
  summary: string;
  description?: string;
}

function icsDate(n: DayNumber): string {
  const c = fromDayNumber(n);
  return `${String(c.y).padStart(4, '0')}${String(c.m).padStart(2, '0')}${String(c.d).padStart(2, '0')}`;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets as RFC 5545 requires. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (currentBytes + size > limit) {
      out.push(current);
      current = ' ';
      currentBytes = 1;
    }
    current += ch;
    currentBytes += size;
  }
  out.push(current);
  return out.join('\r\n');
}

export function buildCalendar(events: IcsEvent[], name: string, stamp: Date = new Date()): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//fractionalbdays//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(name)}`,
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.date)}`,
      `DTEND;VALUE=DATE:${icsDate((e.lastDate ?? e.date) + 1)}`,
      `SUMMARY:${escapeText(e.summary)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

function possessive(name: string): string {
  if (name === 'You') return 'Your';
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/**
 * One all-day event per fractional birthday. When the modes disagree, the
 * event spans every date they give, and the description says which is which.
 */
export function calendarForOccurrences(occurrences: Occurrence[], person: Person): string {
  const items = occurrences.map((o): IcsEvent => {
    const first = o.dates[0]?.date ?? o.date;
    const last = o.dates[o.dates.length - 1]?.date ?? o.date;
    const byMode = o.dates.map(
      (d) => `${dayFormats.medium(d.date)} by ${methodsText(d.sources)}${d.approx ? ', rounded to the nearest week' : ''}.`,
    );
    return {
      uid: `fb-${person.id}-${icsDate(first)}-${o.p}-${o.q}@fractionalbdays`,
      date: first,
      lastDate: last,
      summary: `${possessive(person.name)} ${fractionName(o)} (${ageText(o.years, o)})`,
      description: o.dates.length > 1 ? byMode.join(' ') : undefined,
    };
  });
  return buildCalendar(items, `${possessive(person.name)} fractional birthdays`);
}

export function calendarForCelebrations(celebrations: Celebration[], people: Person[]): string {
  const items = celebrations.map((c) => {
    const parts = byDenominator(c).map(({ index, event }) => {
      const label = primaryLabel(event);
      return `${people[index]?.name ?? '?'} ${ageText(event.years, label)} on ${dayFormats.short(event.date)}`;
    });
    const notes = [
      c.days.length > 1 ? `Works on ${daysText(c.days)}.` : '',
      `Score ${c.sumQ} (lower is more major).`,
      c.spread > 0 ? `Spread ${c.spread} ${c.spread === 1 ? 'day' : 'days'}.` : '',
    ];
    return {
      uid: `fbm-${c.events.map((e) => icsDate(e.date)).join('-')}@fractionalbdays`,
      date: c.day,
      summary: `Fractional birthday party: ${parts.join(', ')}`,
      description: notes.filter(Boolean).join(' '),
    };
  });
  return buildCalendar(items, 'Shared fractional birthdays');
}
