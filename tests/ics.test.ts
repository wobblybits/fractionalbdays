import { describe, expect, it } from 'vitest';
import { toDayNumber } from '../src/dates';
import { occurrencesForPerson, type Person } from '../src/events';
import { denominatorsUpTo } from '../src/fractions';
import { buildCalendar, calendarForCelebrations, calendarForOccurrences } from '../src/ics';
import { MODES, monthsMode } from '../src/modes';
import { rankCelebrations } from '../src/mutual';

const from = toDayNumber({ y: 2026, m: 1, d: 1 });
const to = toDayNumber({ y: 2027, m: 1, d: 1 });

describe('iCalendar export', () => {
  it('writes one all-day event per fractional birthday', () => {
    const sam: Person = { id: 'p1', name: 'Sam', birth: { y: 1990, m: 7, d: 4 } };
    const occurrences = occurrencesForPerson(sam, [monthsMode], denominatorsUpTo(13), from, to);
    const ics = calendarForOccurrences(occurrences, sam);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(12);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260704');
    expect(ics).toContain('DTEND;VALUE=DATE:20260705');
    expect(ics).toContain("SUMMARY:Sam's birthday (36)");
    expect(ics).toContain("SUMMARY:Sam's half birthday (35 1/2)");
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });

  it('spans the dates the modes give and says which is which', () => {
    const sam: Person = { id: 'p1', name: 'Sam', birth: { y: 2000, m: 1, d: 1 } };
    const occurrences = occurrencesForPerson(sam, MODES, [2], from, to);
    const ics = calendarForOccurrences(occurrences, sam).replace(/\r\n /g, '');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260101\r\nDTEND;VALUE=DATE:20260102');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260701\r\nDTEND;VALUE=DATE:20260704');
    expect(ics).toContain("SUMMARY:Sam's half birthday (26 1/2)");
    for (const way of ['by months.', 'by weeks.', 'by days.']) expect(ics).toContain(way);
  });

  it('escapes text and folds long lines', () => {
    const ics = buildCalendar(
      [{ uid: 'u', date: from, summary: 'a, b; c\\d\nnew', description: 'x'.repeat(200) }],
      'Test',
      new Date('2026-09-26T12:00:00Z'),
    );
    expect(ics).toContain('SUMMARY:a\\, b\; c\\\\d\\nnew');
    expect(ics).toContain('DTSTAMP:20260926T120000Z');
    expect(ics).toContain('\r\n x');
  });

  it('exports shared celebrations', () => {
    const people: Person[] = [
      { id: 'a', name: 'Sam', birth: { y: 1990, m: 1, d: 15 } },
      { id: 'b', name: 'Alex', birth: { y: 1992, m: 7, d: 15 } },
    ];
    const ranked = rankCelebrations(people, [monthsMode], denominatorsUpTo(13), from, to, 0);
    const ics = calendarForCelebrations(ranked.slice(0, 3), people).replace(/\r\n /g, '');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain('Sam 36 on Jan 15');
    // Lowest denominator first: Alex's birthday before Sam's half birthday.
    expect(ics).toContain('SUMMARY:Fractional birthday party: Alex 34 on Jul 15\\, Sam 36 1/2 on Jul 15');
  });
});
