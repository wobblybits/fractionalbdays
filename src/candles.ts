/**
 * The row of candles on the "next up" card, read like a star rating: one
 * candle per part of the denominator, the numerator's worth lit from the left.
 */

import type { Fraction } from './fractions';

/** How many candles there are and how many are lit. The birthday itself gets one, lit. */
export function candleCounts(f: Fraction): { total: number; lit: number } {
  return f.q <= 1 ? { total: 1, lit: 1 } : { total: f.q, lit: f.p };
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Each candle takes a fixed slot of the view box; CSS sets the height and the width follows. */
const SLOT_W = 14;
const VIEW_H = 44;
const WAX_W = 6;
const WAX_TOP = 20;
const WAX_BOTTOM = 43;

function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  ...children: SVGElement[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  el.append(...children);
  return el;
}

const FLAME = 'M0,-14 C3.5,-9 4.5,-5 4.5,-2.5 A4.5,4.5 0 0 1 -4.5,-2.5 C-4.5,-5 -3.5,-9 0,-14 Z';
const FLAME_CORE = 'M0,-8 C1.7,-5.5 2.3,-3.7 2.3,-2.3 A2.3,2.3 0 0 1 -2.3,-2.3 C-2.3,-3.7 -1.7,-5.5 0,-8 Z';

function candleNode(i: number, lit: boolean): SVGGElement {
  const x = SLOT_W * i + SLOT_W / 2;
  const left = x - WAX_W / 2;
  const height = WAX_BOTTOM - WAX_TOP;
  const g = s(
    'g',
    { class: `candle hue-${i % 4}${lit ? ' lit' : ''}` },
    s('rect', { class: 'candle-wax', x: left, y: WAX_TOP, width: WAX_W, height, rx: 1.5 }),
    s('path', {
      class: 'candle-stripes',
      d: [0, 1, 2].map((k) => `M${left},${WAX_TOP + 7 + k * 7} l${WAX_W},-3.5`).join(' '),
    }),
    s('path', { class: 'wick', d: `M${x},${WAX_TOP} q0.7,-2.2 0,-4.5` }),
  );
  if (lit) {
    g.append(
      s('circle', { class: 'glow', cx: x, cy: WAX_TOP - 9, r: 7 }),
      s(
        'g',
        { transform: `translate(${x},${WAX_TOP - 2.5})` },
        s(
          'g',
          // Out of step with each other, so the row does not flicker in unison.
          { class: 'flame', style: `animation-delay:${(-0.37 * i) % 1.3}s` },
          s('path', { class: 'flame-outer', d: FLAME }),
          s('path', { class: 'flame-core', d: FLAME_CORE }),
        ),
      ),
    );
  }
  return g;
}

/** A row of candles for a fraction, described for screen readers. */
export function candleRow(f: Fraction): SVGSVGElement {
  const { total, lit } = candleCounts(f);
  const label = f.q <= 1 ? 'One lit candle' : `${lit} of ${total} candles lit`;
  const row = s('svg', {
    class: 'candles',
    viewBox: `0 0 ${SLOT_W * total} ${VIEW_H}`,
    role: 'img',
    'aria-label': label,
  });
  for (let i = 0; i < total; i++) row.append(candleNode(i, i < lit));
  return row;
}
