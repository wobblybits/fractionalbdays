/**
 * A king whose regnal number matches a fraction's denominator: Henry VIII for
 * an eighth birthday, Francis I for the whole birthday. Portraits are cropped
 * public-domain paintings from Wikimedia Commons, served from public/kings/.
 */

import type { Fraction } from './fractions';

export interface King {
  /** "Henry VIII" */
  name: string;
  /** "Henry the Eighth" */
  spoken: string;
  src: string;
}

const KINGS: Record<number, [name: string, spoken: string]> = {
  1: ['Francis I', 'Francis the First'],
  2: ['Charles II', 'Charles the Second'],
  3: ['George III', 'George the Third'],
  4: ['Henri IV', 'Henri the Fourth'],
  5: ['Charles V', 'Charles the Fifth'],
  6: ['Henry VI', 'Henry the Sixth'],
  7: ['Edward VII', 'Edward the Seventh'],
  8: ['Henry VIII', 'Henry the Eighth'],
  9: ['Louis IX', 'Louis the Ninth'],
  10: ['Charles X', 'Charles the Tenth'],
  11: ['Louis XI', 'Louis the Eleventh'],
  12: ['Charles XII', 'Charles the Twelfth'],
};

/** The king for a fraction's denominator, or null past twelfths. */
export function kingFor(f: Fraction): King | null {
  const q = Math.max(f.q, 1);
  const entry = KINGS[q];
  return entry ? { name: entry[0], spoken: entry[1], src: `./kings/king-${q}.jpg` } : null;
}
