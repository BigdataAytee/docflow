/**
 * The procedural concept engine — rung 2 of §O's ladder.
 *
 * §O: "an algorithmic compositor generating marks from geometry grammars
 * (monograms, abstract forms, description-derived symbol vocabularies,
 * structural composition rules)… Runs offline on every tier and genuinely
 * satisfies the twenty-distinct rubric — unlike the prototype's preset picker,
 * which is a demonstration only."
 *
 * The rules this file exists to keep, each of them a thing §O names:
 *
 *  · **Four at a time: two with the name, two symbol-only.**
 *  · **"More ideas" never wraps around.** When the concepts are spent, the
 *    engine says so — it does not start again from the top with different
 *    colours. A recolour presented as new artwork is the specific dishonesty
 *    §O calls out, and the only way to avoid it is to admit the end.
 *  · **Earlier results are retained.** Going back to set two must show set two.
 *  · **Named and symbol-only entries never duplicate one another**, which is
 *    why the quota is counted in CONCEPTS and a concept is used once.
 *  · **Partial batches are labelled partial** (§O, "Quality and output").
 *
 * Everything is deterministic: the same name and description always produce
 * the same ideas in the same order. §O asks for seeds to be tracked, and a
 * seed you cannot reproduce is not tracked — this goes further and has no
 * randomness to track at all, so "More ideas" cannot accidentally repeat.
 */

import { type Concept, SET_SIZE, conceptKey, conceptsFor } from './concepts'
import type { Layout } from './concepts'
import { type Meaning, meaningOf } from './vocabulary'

export interface Idea {
  readonly id: string
  readonly concept: Concept
  /** Two of every four carry the name; two are the mark alone (§O). */
  readonly layout: Layout
}

export interface LogoProject {
  readonly name: string
  readonly description: string
  readonly meaning: Meaning
  /** Every idea produced so far, oldest first. §O: earlier results retained. */
  readonly ideas: readonly Idea[]
  /** How many concepts remain unused. */
  readonly remaining: number
}

export interface MoreIdeas {
  readonly project: LogoProject
  /** Just this set. The project keeps all of them. */
  readonly set: readonly Idea[]
  /**
   * Fewer than four, because the concepts ran out. §O: "Partial batches are
   * labelled partial" — the label is data, so the UI cannot forget to say it.
   */
  readonly partial: boolean
  /** No more concepts. The UI must stop offering, not start again. */
  readonly exhausted: boolean
}

export function createProject(name: string, description: string): LogoProject {
  const meaning = meaningOf(description, name)
  return {
    name,
    description,
    meaning,
    ideas: [],
    remaining: conceptsFor(meaning.motifs).length,
  }
}

/**
 * The next four.
 *
 * Two named and two symbol-only, each a concept not used before. The layouts
 * alternate rather than being chosen: §O counts a named and a symbol-only
 * version of ONE mark as a single idea, so pairing them off is not allowed —
 * each of the four is a different concept, and the layout is just how that
 * concept is presented.
 */
export function moreIdeas(project: LogoProject): MoreIdeas {
  const all = conceptsFor(project.meaning.motifs)
  const used = new Set(project.ideas.map((idea) => conceptKey(idea.concept)))
  const available = all.filter((concept) => !used.has(conceptKey(concept)))

  const chosen = available.slice(0, SET_SIZE)
  const set: Idea[] = chosen.map((concept, index) => ({
    id: `${conceptKey(concept)}`,
    concept,
    // Two with the name, two without — and alternating so a set never shows
    // the same concept twice in two dresses.
    layout: index < 2 ? (index === 0 ? 'horizontal' : 'stacked') : 'symbol',
  }))

  const ideas = [...project.ideas, ...set]
  const remaining = all.length - ideas.length

  return {
    project: { ...project, ideas, remaining },
    set,
    partial: set.length > 0 && set.length < SET_SIZE,
    // Said plainly when it is true. Starting again from the top with new
    // colours is the one thing §O forbids by name.
    exhausted: remaining <= 0,
  }
}

/** Every idea so far, so going back to an earlier set shows that set (§O). */
export const setsOf = (project: LogoProject): Idea[][] => {
  const sets: Idea[][] = []
  for (let i = 0; i < project.ideas.length; i += SET_SIZE) {
    sets.push(project.ideas.slice(i, i + SET_SIZE))
  }
  return sets
}
