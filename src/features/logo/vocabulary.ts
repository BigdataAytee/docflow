/**
 * What a business is about, from what its owner said (§O).
 *
 * §O's rubric is explicit about where meaning comes from, and the ordering is
 * the whole rule: "The **description** is the primary source of meaning; the
 * name supplies brand context and lettering — **never an inferred industry
 * that contradicts the description.**"
 *
 * That sentence is aimed at a specific failure, and §O's fixed test set
 * includes "a deliberately misleading name" to catch it: a generator-repair
 * business called Sunrise Bakery must not be given bread. Guessing an industry
 * from a name is the easy thing to do and produces a logo about somebody
 * else's company.
 *
 * So the name is consulted ONLY where the description said nothing at all,
 * and even then only for lettering and initials. Nothing here reads the name
 * for industry.
 */

/** A symbol idea. Rendered by `grammar.ts`; named here so it can be reasoned about. */
export type Motif =
  | 'gear' | 'bolt' | 'beam' | 'spark'
  | 'leaf' | 'grain' | 'drop' | 'sun'
  | 'bag' | 'tag' | 'basket' | 'scale'
  | 'wheel' | 'route' | 'arrow' | 'container'
  | 'book' | 'pen' | 'cap' | 'lamp'
  | 'node' | 'signal' | 'screen' | 'cube'
  | 'bottle' | 'petal' | 'comb' | 'mirror'
  | 'pot' | 'flame' | 'knife' | 'cup'
  | 'brick' | 'hammer' | 'rule' | 'ladder'
  /** The fallbacks, used when a description carries no recognised trade. */
  | 'monogram' | 'orbit' | 'stack' | 'weave'

/**
 * Words to motifs, by trade.
 *
 * Deliberately a table rather than a cleverness: it is auditable, a native
 * speaker can extend it, and it cannot surprise anyone. §O's ten-description
 * test set names the trades that must be covered, and each has a row.
 */
const TRADES: readonly { readonly words: readonly string[]; readonly motifs: readonly Motif[] }[] = [
  {
    words: ['engineer', 'engineering', 'mechanic', 'generator', 'machine', 'welding', 'fabricat', 'repair', 'motor', 'pump'],
    motifs: ['gear', 'bolt', 'beam', 'spark'],
  },
  {
    words: ['farm', 'agric', 'crop', 'poultry', 'livestock', 'seed', 'harvest', 'fish'],
    motifs: ['leaf', 'grain', 'sun', 'drop'],
  },
  {
    words: ['shop', 'store', 'retail', 'trading', 'supermarket', 'boutique', 'wholesale', 'market'],
    motifs: ['bag', 'tag', 'basket', 'scale'],
  },
  {
    words: ['transport', 'logistics', 'haulage', 'delivery', 'courier', 'freight', 'truck', 'bus'],
    motifs: ['wheel', 'route', 'arrow', 'container'],
  },
  {
    words: ['school', 'tutor', 'teach', 'academy', 'college', 'lesson', 'train', 'educat'],
    motifs: ['book', 'pen', 'cap', 'lamp'],
  },
  {
    words: ['software', 'tech', 'computer', 'data', 'network', 'web', 'digital', 'it '],
    motifs: ['node', 'signal', 'screen', 'cube'],
  },
  {
    words: ['cosmetic', 'beauty', 'salon', 'hair', 'skin', 'spa', 'makeup', 'barber'],
    motifs: ['bottle', 'petal', 'comb', 'mirror'],
  },
  {
    words: ['food', 'restaurant', 'cater', 'bakery', 'bread', 'kitchen', 'chop', 'cook'],
    motifs: ['pot', 'flame', 'knife', 'cup'],
  },
  {
    words: ['build', 'construct', 'carpent', 'plumb', 'electric', 'paint', 'tile', 'roof', 'mason'],
    motifs: ['brick', 'hammer', 'rule', 'ladder'],
  },
]

/** Always available, so a project is never short of concepts (§O's quota). */
const FALLBACK: readonly Motif[] = ['monogram', 'orbit', 'stack', 'weave']

export interface Meaning {
  readonly motifs: readonly Motif[]
  /** Which trades the description matched. Empty means none were recognised. */
  readonly trades: number
  /** The initials, for a monogram. From the NAME — lettering, not industry. */
  readonly initials: string
}

export function meaningOf(description: string, name: string): Meaning {
  const text = ` ${description.toLocaleLowerCase()} `
  const motifs: Motif[] = []
  let trades = 0

  for (const trade of TRADES) {
    if (trade.words.some((word) => text.includes(word))) {
      trades += 1
      for (const motif of trade.motifs) if (!motifs.includes(motif)) motifs.push(motif)
    }
  }

  // The fallbacks come last, never instead. A recognised trade always leads.
  for (const motif of FALLBACK) if (!motifs.includes(motif)) motifs.push(motif)

  return { motifs, trades, initials: initialsOf(name) }
}

/**
 * Up to two initials, from the name.
 *
 * Unicode-aware: §O requires "non-English names with accents and non-Latin
 * scripts", so this takes the first character of each word as the script
 * writes it rather than assuming A–Z. An Arabic or accented initial is the
 * initial.
 */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/[\s\-_]+/u)
    .filter((word) => word !== '' && /\p{L}/u.test(word))
  const letters = words.slice(0, 2).map((word) => [...word][0] ?? '')
  return letters.join('')
}

/**
 * §O: "A short clarifying question is allowed **only when the description is
 * genuinely ambiguous between incompatible readings**."
 *
 * Deliberately narrow. Asking whenever the engine is unsure would turn a
 * two-field screen into an interview, which §O rules out in its first
 * paragraph ("no model settings, no prompt engineering"). So it asks only
 * when two INCOMPATIBLE trades are both present — where a logo for one would
 * be wrong for the other — and never merely because nothing was recognised.
 */
export function needsClarifying(description: string): boolean {
  const meaning = meaningOf(description, '')
  return meaning.trades > 1
}
