import { describe, expect, it } from 'vitest';
import { WHOLE } from '../src/fractions';
import { kingFor } from '../src/kings';

describe('kingFor', () => {
  it('matches the regnal number to the denominator', () => {
    expect(kingFor({ p: 3, q: 8 })).toMatchObject({ name: 'Henry VIII', src: './kings/king-8.webp' });
    expect(kingFor({ p: 1, q: 2 })?.spoken).toBe('Charles the Second');
  });

  it('gives the whole birthday a First', () => {
    expect(kingFor(WHOLE)?.name).toBe('Francis I');
  });

  it('has no king past twelfths', () => {
    expect(kingFor({ p: 1, q: 13 })).toBeNull();
  });
});
