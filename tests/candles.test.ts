import { describe, expect, it } from 'vitest';
import { candleCounts } from '../src/candles';

describe('candleCounts', () => {
  it('gives one candle per part of the denominator, the numerator lit', () => {
    expect(candleCounts({ p: 3, q: 8 })).toEqual({ total: 8, lit: 3 });
  });

  it('gives the birthday itself a single lit candle', () => {
    expect(candleCounts({ p: 0, q: 1 })).toEqual({ total: 1, lit: 1 });
  });
});
