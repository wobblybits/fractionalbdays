import { describe, expect, it } from 'vitest';
import type { Source } from '../src/events';
import { dayRuns, listText, methodsText } from '../src/format';

const source = (mode: Source['mode']): Source => ({ mode, exact: true, errorDays: 0, clamped: false, approx: false });

describe('text helpers', () => {
  it('joins lists in plain English', () => {
    expect(listText([])).toBe('');
    expect(listText(['a'])).toBe('a');
    expect(listText(['a', 'b'])).toBe('a and b');
    expect(listText(['a', 'b', 'c'], 'or')).toBe('a, b or c');
  });

  it('names the modes behind a date', () => {
    expect(methodsText([source('weeks'), source('days')])).toBe('weeks and days');
    expect(methodsText([source('months'), source('weeks'), source('days')])).toBe('months, weeks and days');
  });

  it('finds runs of consecutive days', () => {
    expect(dayRuns([1, 2, 3, 5, 7, 8])).toEqual([
      [1, 3],
      [5, 5],
      [7, 8],
    ]);
    expect(dayRuns([])).toEqual([]);
  });
});
