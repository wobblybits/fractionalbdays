/**
 * iCalendar export: one all-day event per fractional birthday, so the dates
 * can live in the user's real calendar.
 */

import { fromDayNumber, type DayNumber } from './dates';
import { primaryLabel, type BirthdayEvent, type Person } from './events';
import { fractionName } from './fractions';
import { ageText, dayFormats } from './format';
import type { Celebration } from './mutual';

interface IcsEvent {
  uid: string;
  date: DayNumber;
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
      `DTEND;VALUE=DATE:${icsDate(e.date + 1)}`,
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

export function calendarForEvents(events: BirthdayEvent[], person: Person, modeName: string): string {
  const items = events.map((e) => {
    const label = primaryLabel(e);
    const age = ageText(e.years, label);
    return {
      uid: `fb-${person.id}-${icsDate(e.date)}@fractionalbdays`,
      date: e.date,
      summary: `${possessive(person.name)} ${fractionName(label)} (${age})`,
      description: `Measured in ${modeName.toLowerCase()}.${label.exact ? '' : ' Rounded.'}`,
    };
  });
  return buildCalendar(items, `${possessive(person.name)} fractional birthdays`);
}

export function calendarForCelebrations(celebrations: Celebration[], people: Person[]): string {
  const items = celebrations.map((c) => {
    const parts = c.events.map((e, i) => {
      const label = primaryLabel(e);
      return `${people[i]?.name ?? '?'} ${ageText(e.years, label)} on ${dayFormats.short(e.date)}`;
    });
    return {
      uid: `fbm-${c.events.map((e) => icsDate(e.date)).join('-')}@fractionalbdays`,
      date: c.day,
      summary: `Fractional birthday party: ${parts.join(', ')}`,
      description: `Score ${c.sumQ} (lower is more major). Spread ${c.spread} days.`,
    };
  });
  return buildCalendar(items, 'Shared fractional birthdays');
}
