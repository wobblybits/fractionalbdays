/**
 * Reduced fractions p/q in [0, 1) and the words we use for them.
 */

export interface Fraction {
  p: number;
  q: number;
}

/** The whole birthday: zero of the way through the birthday-year. */
export const WHOLE: Fraction = { p: 0, q: 1 };

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

export function reduce(p: number, q: number): Fraction {
  const g = gcd(p, q) || 1;
  return { p: p / g, q: q / g };
}

export function fractionEquals(a: Fraction, b: Fraction): boolean {
  return a.p === b.p && a.q === b.q;
}

export function compareFractions(a: Fraction, b: Fraction): number {
  return a.p * b.q - b.p * a.q;
}

/**
 * All reduced fractions 0 < p/q < 1 whose denominator is in `denominators`,
 * sorted by value. With every denominator from 2 to n this is the Farey
 * sequence of order n without its end points.
 */
export function properFractions(denominators: Iterable<number>): Fraction[] {
  const out: Fraction[] = [];
  const seen = new Set<number>();
  for (const q of denominators) {
    if (!Number.isInteger(q) || q < 2 || seen.has(q)) continue;
    seen.add(q);
    for (let p = 1; p < q; p++) {
      if (gcd(p, q) === 1) out.push({ p, q });
    }
  }
  return out.sort(compareFractions);
}

/** Every integer from 2 to `max` inclusive. */
export function denominatorsUpTo(max: number): number[] {
  const out: number[] = [];
  for (let q = 2; q <= max; q++) out.push(q);
  return out;
}

/** Plain-text form such as "5/12"; empty for the whole birthday. */
export function fractionText(f: Fraction): string {
  return f.p === 0 ? '' : `${f.p}/${f.q}`;
}

const NUMERATOR_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
];

const DENOMINATOR_WORDS: Record<number, [string, string]> = {
  2: ['half', 'halves'],
  3: ['third', 'thirds'],
  4: ['quarter', 'quarters'],
  5: ['fifth', 'fifths'],
  6: ['sixth', 'sixths'],
  7: ['seventh', 'sevenths'],
  8: ['eighth', 'eighths'],
  9: ['ninth', 'ninths'],
  10: ['tenth', 'tenths'],
  11: ['eleventh', 'elevenths'],
  12: ['twelfth', 'twelfths'],
  13: ['thirteenth', 'thirteenths'],
  14: ['fourteenth', 'fourteenths'],
  15: ['fifteenth', 'fifteenths'],
  16: ['sixteenth', 'sixteenths'],
  20: ['twentieth', 'twentieths'],
};

/** Words for the fraction itself: "half", "two-thirds", "5/12" as a fallback. */
export function fractionWords(f: Fraction): string {
  if (f.p === 0) return 'whole';
  const words = DENOMINATOR_WORDS[f.q];
  if (!words) return fractionText(f);
  if (f.p === 1) return words[0];
  const numerator = NUMERATOR_WORDS[f.p] ?? String(f.p);
  return `${numerator}-${words[1]}`;
}

/** "birthday", "half birthday", "two-thirds birthday", "5/12 birthday". */
export function fractionName(f: Fraction): string {
  return f.p === 0 ? 'birthday' : `${fractionWords(f)} birthday`;
}

/** "half" / "halves", "quarter" / "quarters"; falls back to "1/q" style. */
export function denominatorWord(q: number, plural = false): string {
  const words = DENOMINATOR_WORDS[q];
  if (!words) return plural ? `${q}ths` : `${q}th`;
  return plural ? words[1] : words[0];
}
