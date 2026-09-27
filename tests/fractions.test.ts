import { describe, expect, it } from 'vitest';
import {
  denominatorsUpTo,
  fractionName,
  fractionText,
  gcd,
  properFractions,
  reduce,
  WHOLE,
} from '../src/fractions';

describe('proper fractions', () => {
  it('enumerates the month-mode set', () => {
    const fractions = properFractions([2, 3, 4, 6, 12]);
    expect(fractions).toHaveLength(11);
    expect(fractions.map((f) => `${f.p}/${f.q}`)).toEqual([
      '1/12', '1/6', '1/4', '1/3', '5/12', '1/2', '7/12', '2/3', '3/4', '5/6', '11/12',
    ]);
  });

  it('gives the Farey sequence of order 13 without end points', () => {
    const fractions = properFractions(denominatorsUpTo(13));
    expect(fractions).toHaveLength(57);
    for (const f of fractions) expect(gcd(f.p, f.q)).toBe(1);
    for (let i = 1; i < fractions.length; i++) {
      const a = fractions[i - 1]!;
      const b = fractions[i]!;
      expect(a.p / a.q).toBeLessThan(b.p / b.q);
    }
  });

  it('ignores duplicates and nonsense denominators', () => {
    expect(properFractions([2, 2, 1, 0, -3, 2.5])).toEqual([{ p: 1, q: 2 }]);
  });

  it('reduces', () => {
    expect(reduce(6, 12)).toEqual({ p: 1, q: 2 });
    expect(reduce(0, 7)).toEqual({ p: 0, q: 1 });
  });
});

describe('names', () => {
  it('spells fractions out', () => {
    expect(fractionName(WHOLE)).toBe('birthday');
    expect(fractionName({ p: 1, q: 2 })).toBe('half birthday');
    expect(fractionName({ p: 2, q: 3 })).toBe('two-thirds birthday');
    expect(fractionName({ p: 3, q: 4 })).toBe('three-quarters birthday');
    expect(fractionName({ p: 5, q: 12 })).toBe('five-twelfths birthday');
    expect(fractionName({ p: 12, q: 13 })).toBe('twelve-thirteenths birthday');
    expect(fractionText({ p: 5, q: 12 })).toBe('5/12');
    expect(fractionText(WHOLE)).toBe('');
  });
});
