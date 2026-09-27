/**
 * A king whose regnal number matches a fraction's denominator: Henry VIII for
 * an eighth birthday, Francis I for the whole birthday. Portraits are busts cut
 * out of public-domain paintings from Wikimedia Commons, turned to face left,
 * and served from public/kings/.
 */

import type { Fraction } from './fractions';

export interface King {
  /** "Henry VIII" */
  name: string;
  /** "Henry the Eighth" */
  spoken: string;
  src: string;
  /** Where the lips are, as fractions of the portrait's width and height. */
  mouth: [x: number, y: number];
}

const KINGS: Record<number, [name: string, spoken: string, mouth: [number, number]]> = {
  1: ['Francis I', 'Francis the First', [0.494, 0.409]],
  2: ['Charles II', 'Charles the Second', [0.492, 0.415]],
  3: ['George III', 'George the Third', [0.487, 0.403]],
  4: ['Henri IV', 'Henri the Fourth', [0.486, 0.403]],
  5: ['Charles V', 'Charles the Fifth', [0.437, 0.436]],
  6: ['Henry VI', 'Henry the Sixth', [0.512, 0.545]],
  7: ['Edward VII', 'Edward the Seventh', [0.485, 0.394]],
  8: ['Henry VIII', 'Henry the Eighth', [0.504, 0.391]],
  9: ['Louis IX', 'Louis the Ninth', [0.55, 0.55]],
  10: ['Charles X', 'Charles the Tenth', [0.487, 0.411]],
  11: ['Louis XI', 'Louis the Eleventh', [0.443, 0.397]],
  12: ['Charles XII', 'Charles the Twelfth', [0.484, 0.4]],
};

/** The king for a fraction's denominator, or null past twelfths. */
export function kingFor(f: Fraction): King | null {
  const q = Math.max(f.q, 1);
  const entry = KINGS[q];
  return entry ? { name: entry[0], spoken: entry[1], mouth: entry[2], src: `./kings/king-${q}.webp` } : null;
}
