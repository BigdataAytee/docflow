/**
 * A drawn signature (§G, §I, §M).
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  INK,
  MINIMUM_INK,
  type Strokes,
  boundsOf,
  inkLength,
  isBlank,
  pathOf,
  renderSignature,
  undoStroke,
} from './strokes'

/** A horizontal mark of `length` units, starting at (x, y). */
const line = (x: number, y: number, length: number): Strokes => [
  [
    { x, y },
    { x: x + length / 2, y },
    { x: x + length, y },
  ],
]

const SIGNED: Strokes = [
  [
    { x: 20, y: 40 },
    { x: 40, y: 20 },
    { x: 60, y: 45 },
    { x: 80, y: 25 },
  ],
]

describe('A tap is not a signature (§P)', () => {
  it('treats nothing drawn as blank', () => {
    expect(isBlank([])).toBe(true)
  })

  it('treats a single dot as blank', () => {
    // Accepting one would mark a document signed with no signature on it.
    expect(isBlank([[{ x: 10, y: 10 }]])).toBe(true)
  })

  it('treats a slipped finger as blank', () => {
    expect(isBlank(line(0, 0, MINIMUM_INK - 1))).toBe(true)
  })

  it('accepts a short initial, which is still a signature', () => {
    expect(isBlank(line(0, 0, MINIMUM_INK + 1))).toBe(false)
  })

  it('measures the journey, not the distance travelled from the start', () => {
    // There and back again: 60 units of ink, ending where it began.
    const backAndForth: Strokes = [
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 0, y: 0 },
      ],
    ]
    expect(inkLength(backAndForth)).toBe(60)
    expect(isBlank(backAndForth)).toBe(false)
  })

  it('refuses to render anything blank', () => {
    expect(renderSignature([])).toBeNull()
    expect(renderSignature([[{ x: 1, y: 1 }]])).toBeNull()
  })
})

describe('Undo removes a mark, never part of one', () => {
  it('drops the last stroke whole', () => {
    const two: Strokes = [...SIGNED, ...line(0, 0, 40)]
    expect(undoStroke(two)).toEqual(SIGNED)
  })

  it('is safe on an empty pad', () => {
    expect(undoStroke([])).toEqual([])
  })
})

describe('The stored signature is cropped to the ink (§I)', () => {
  it('measures the ink, not the box it was drawn in', () => {
    expect(boundsOf(SIGNED)).toEqual({ x: 20, y: 20, width: 60, height: 25 })
  })

  it('has no bounds when there is no ink', () => {
    expect(boundsOf([])).toBeNull()
  })

  it('sizes the output to the ink plus a cap of padding on each side', () => {
    const rendered = renderSignature(SIGNED)
    // 60 x 25 of ink, plus one stroke width (2.4) each side.
    expect(rendered?.width).toBeCloseTo(64.8, 5)
    expect(rendered?.height).toBeCloseTo(29.8, 5)
  })

  it('never leaves ink outside the viewBox, wherever it was drawn', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -500, max: 500 }),
        fc.integer({ min: -500, max: 500 }),
        (offsetX, offsetY) => {
          const moved = SIGNED.map((stroke) =>
            stroke.map((point) => ({ x: point.x + offsetX, y: point.y + offsetY })),
          )
          const rendered = renderSignature(moved)
          if (rendered === null) return false
          const numbers = [...rendered.svg.matchAll(/[ML]([\d.]+) ([\d.]+)/g)]
          return numbers.every(
            ([, x = '0', y = '0']) =>
              Number(x) >= 0 &&
              Number(y) >= 0 &&
              Number(x) <= rendered.width &&
              Number(y) <= rendered.height,
          )
        },
      ),
    )
  })

  it('renders the same signature identically wherever it was drawn', () => {
    // Two devices, two pad positions, one mark: the same bytes either way.
    const moved = SIGNED.map((stroke) => stroke.map((p) => ({ x: p.x + 137, y: p.y + 42 })))
    expect(renderSignature(moved)?.svg).toBe(renderSignature(SIGNED)?.svg)
  })
})

describe('The path reads as handwriting, not as a chart', () => {
  it('curves through the samples rather than joining them with segments', () => {
    expect(pathOf(SIGNED[0] ?? [])).toContain('Q')
  })

  it('paints a dot where the pen was put down and not moved', () => {
    expect(pathOf([{ x: 5, y: 6 }])).toBe('M5 6l0 0')
  })

  it('has nothing to draw for an empty stroke', () => {
    expect(pathOf([])).toBe('')
  })
})

describe('A signature can carry nothing but ink', () => {
  it('is built only from numbers this module produced', () => {
    const rendered = renderSignature(SIGNED)
    // No text nodes, no scripts, no foreign markup — just one path of numbers.
    expect(rendered?.svg).toMatch(
      /^<svg [^>]+><path d="[MQLl\d. ]+" fill="none" stroke="[^"]+" [^>]+\/><\/svg>$/,
    )
    expect(rendered?.svg).not.toContain('<script')
    expect(rendered?.svg).not.toContain('<text')
  })

  it('gives the stored copy a real ink colour, since currentColor cannot resolve in an img', () => {
    const rendered = renderSignature(SIGNED)
    expect(rendered?.svg).toContain('currentColor')
    expect(rendered?.dataUrl).toContain(encodeURIComponent(INK))
    expect(rendered?.dataUrl.startsWith('data:image/svg+xml,')).toBe(true)
  })

  it('stays small enough to sync on the connection the owner has (§M)', () => {
    // A real signature is a few hundred samples.
    const many: Strokes = [
      Array.from({ length: 400 }, (_, i) => ({ x: i * 0.7, y: 30 + Math.sin(i / 9) * 18 })),
    ]
    const rendered = renderSignature(many)
    expect(rendered).not.toBeNull()
    expect((rendered?.dataUrl.length ?? 0)).toBeLessThan(16_000)
  })
})
