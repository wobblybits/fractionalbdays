import { describe, expect, it } from 'vitest';
import { checkBirthParts, localeDateOrder, partsFromISO, splitPastedDate, type DateParts } from '../src/birthdate';

const today = { y: 2026, m: 9, d: 27 };
const parts = (month: string, day: string, year: string): DateParts => ({ month, day, year });
const check = (month: string, day: string, year: string) => checkBirthParts(parts(month, day, year), today);
const MDY = ['month', 'day', 'year'] as const;
const DMY = ['day', 'month', 'year'] as const;
const YMD = ['year', 'month', 'day'] as const;

describe('order of the boxes', () => {
  it('follows the locale', () => {
    expect(localeDateOrder('en-US')).toEqual(MDY);
    expect(localeDateOrder('en-GB')).toEqual(DMY);
    expect(localeDateOrder('de-DE')).toEqual(DMY);
    expect(localeDateOrder('ja-JP')).toEqual(YMD);
  });

  it('falls back to month, day, year', () => {
    expect(localeDateOrder('not a locale!')).toEqual(MDY);
  });
});

describe('stored dates and pasted text', () => {
  it('splits an ISO date into the boxes', () => {
    expect(partsFromISO('1985-03-04')).toEqual(parts('03', '04', '1985'));
    expect(partsFromISO('')).toEqual(parts('', '', ''));
    expect(partsFromISO('1985-02-30')).toEqual(parts('', '', ''));
  });

  it('reads a pasted date that starts with the year as year, month, day', () => {
    expect(splitPastedDate('1985-03-14', DMY)).toEqual(parts('03', '14', '1985'));
  });

  it('reads other pasted dates in the locale order', () => {
    expect(splitPastedDate('3/14/1985', MDY)).toEqual(parts('3', '14', '1985'));
    expect(splitPastedDate('14.3.1985', DMY)).toEqual(parts('3', '14', '1985'));
    expect(splitPastedDate('3/14/1985', YMD)).toEqual(parts('3', '14', '1985'));
  });

  it('leaves anything else to the browser', () => {
    expect(splitPastedDate('1985', MDY)).toBeNull();
    expect(splitPastedDate('March 14, 1985', MDY)).toBeNull();
    expect(splitPastedDate('123/4/1985', MDY)).toBeNull();
  });
});

describe('checking what was typed', () => {
  it('accepts a complete real date', () => {
    expect(check('3', '4', '1985')).toEqual({ kind: 'valid', iso: '1985-03-04' });
    expect(check('02', '29', '2024')).toEqual({ kind: 'valid', iso: '2024-02-29' });
    expect(check('09', '27', '2026')).toEqual({ kind: 'valid', iso: '2026-09-27' });
  });

  it('waits quietly for an unfinished date', () => {
    expect(check('', '', '')).toEqual({ kind: 'empty' });
    expect(check('1', '', '')).toEqual({ kind: 'partial', message: 'Add the day and year.' });
    expect(check('0', '', '')).toMatchObject({ kind: 'partial' });
    expect(check('12', '0', '1985')).toEqual({ kind: 'partial', message: 'Add the day.' });
    expect(check('12', '25', '85')).toEqual({ kind: 'partial', message: 'Enter all four digits of the year.' });
  });

  it('flags impossible values as soon as they are typed', () => {
    expect(check('13', '', '')).toMatchObject({ kind: 'invalid', parts: ['month'] });
    expect(check('00', '', '')).toMatchObject({ kind: 'invalid', parts: ['month'] });
    expect(check('', '32', '')).toMatchObject({ kind: 'invalid', parts: ['day'] });
    expect(check('', '00', '')).toMatchObject({ kind: 'invalid', parts: ['day'] });
    expect(check('', '', '1899')).toMatchObject({ kind: 'invalid', parts: ['year'] });
    expect(check('', '', '2027')).toMatchObject({ kind: 'invalid', parts: ['year'] });
  });

  it('knows how long each month is', () => {
    expect(check('2', '30', '')).toEqual({ kind: 'invalid', parts: ['day'], message: 'That month has only 29 days.' });
    expect(check('2', '29', '')).toMatchObject({ kind: 'partial' });
    expect(check('2', '29', '2023')).toEqual({ kind: 'invalid', parts: ['day'], message: '2023 is not a leap year.' });
    expect(check('4', '31', '1990')).toEqual({ kind: 'invalid', parts: ['day'], message: 'That month has only 30 days.' });
  });

  it('rejects dates after today', () => {
    expect(check('9', '28', '2026')).toMatchObject({ kind: 'invalid', parts: ['year', 'month', 'day'] });
  });
});
