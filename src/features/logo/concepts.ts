/**
 * What counts as a distinct idea (§O's rubric, written now and argued never).
 *
 * §O: "Twenty ideas means twenty different core visual concepts or
 * substantially different compositions. **Palette, font, background, rotation,
 * or adding/removing the name from the same mark do not count.** Named and
 * symbol-only entries in the quota must not duplicate one another."
 *
 * So a CONCEPT is a motif and a construction — what the mark IS and how it is
 * built. Everything the rubric excludes is deliberately absent from the
 * concept key:
 *
 *  · palette, font and background are rendering choices, decided later and
 *    never part of identity;
 *  · rotation is a transform of one construction, not another one;
 *  · whether the name appears is a LAYOUT, which is why layout is tracked
 *    separately and why the quota counts concepts rather than pictures.
 *
 * That last point is the one a duplicate-detector would miss, and §O says so
 * outright: "Duplicate detection alone is insufficient." Two images can differ
 * in every pixel and still be the same idea recoloured. Identity is declared
 * here rather than measured afterwards.
 */

import type { Motif } from './vocabulary'

/**
 * How a mark is built. These are structurally different drawings, not styles:
 * each takes the same motif somewhere genuinely different.
 */
export const CONSTRUCTIONS = [
  /** The motif drawn plainly, at its natural weight. */
  'solid',
  /** Cut out of a filled container — the motif as negative space. */
  'negative',
  /** Repeated around a centre, so the motif becomes a pattern. */
  'radial',
  /** Two copies overlapping, sharing an edge. */
  'interlock',
  /** Reduced to strokes of one weight — a line drawing. */
  'linear',
  /** Sliced into bands with the offcuts shifted. */
  'banded',
] as const

export type Construction = (typeof CONSTRUCTIONS)[number]

/** Whether the company name is set beside the mark, and how (§O's lockups). */
export const LAYOUTS = ['symbol', 'horizontal', 'stacked'] as const
export type Layout = (typeof LAYOUTS)[number]

export interface Concept {
  readonly motif: Motif
  readonly construction: Construction
}

/** The identity §O's quota counts. Palette, font and layout are absent. */
export const conceptKey = (concept: Concept): string =>
  `${concept.motif}:${concept.construction}`

/**
 * Every concept available to a project, in the order they should be offered.
 *
 * Ordered construction-major within each motif so the FIRST set shows four
 * different motifs rather than four versions of one: a first impression of
 * "four takes on a gear" reads as a single idea shown four times, which is
 * exactly what the rubric is guarding against.
 */
export function conceptsFor(motifs: readonly Motif[]): Concept[] {
  const concepts: Concept[] = []
  for (const construction of CONSTRUCTIONS) {
    for (const motif of motifs) {
      concepts.push({ motif, construction })
    }
  }
  return concepts
}

/** §O: "at least twenty distinct ideas (five sets minimum)", four at a time. */
export const SET_SIZE = 4
export const MINIMUM_SETS = 5
export const MINIMUM_CONCEPTS = SET_SIZE * MINIMUM_SETS
