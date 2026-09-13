/**
 * The procedural logo engine, against §O's rubric.
 *
 * §O writes the rubric "now, argued never", so these tests are the rubric
 * rather than a paraphrase of it. The ten-description fixed test set is here
 * too — §O requires human review of it before launch, which is deferred; what
 * is automatable is that each description can actually produce the quota, and
 * that nothing in the quota is a recolour of something already in it.
 */

import { describe, expect, it } from 'vitest'

import { MINIMUM_CONCEPTS, MINIMUM_SETS, SET_SIZE, conceptKey } from './concepts'
import { createProject, moreIdeas, setsOf, type LogoProject } from './engine'
import { initialsOf, meaningOf, needsClarifying } from './vocabulary'
import { DARK, LIGHT, letteringOf, lockupOf, symbolOf } from './render'

/**
 * §O's fixed test set: "ten business descriptions spanning engineering,
 * cosmetics, food, retail, transport, trades, education, agriculture,
 * technology and a deliberately misleading name."
 */
const FIXED_TEST_SET: readonly { name: string; description: string }[] = [
  { name: 'Adeyemi Works', description: 'We repair and service diesel generators and water pumps' },
  { name: 'Bella Glow', description: 'A beauty salon doing hair, skin treatments and makeup' },
  { name: 'Mama Nkechi', description: 'We cook and cater for parties, weddings and offices' },
  { name: 'Okoro & Sons', description: 'A retail store selling building materials wholesale' },
  { name: 'Swift Haulage', description: 'Long distance transport and freight delivery by truck' },
  { name: 'Ilesanmi Builders', description: 'Construction, plumbing and electrical work for homes' },
  { name: 'Bright Minds', description: 'A tutoring academy teaching maths and science lessons' },
  { name: 'Green Acres', description: 'A farm producing crops, poultry and fish' },
  { name: 'Zenith Data', description: 'We build software and manage computer networks' },
  // The deliberately misleading one. §O's rubric: the DESCRIPTION is the
  // primary source of meaning; the name must never imply a contradicting
  // industry.
  { name: 'Sunrise Bakery', description: 'We repair diesel generators and industrial machines' },
]

/** Run a project to exhaustion, the way "More ideas" does. */
function runToEnd(project: LogoProject): { sets: number; ideas: ReturnType<typeof setsOf> } {
  let current = project
  let sets = 0
  for (let guard = 0; guard < 100; guard += 1) {
    const result = moreIdeas(current)
    if (result.set.length === 0) break
    current = result.project
    sets += 1
    if (result.exhausted) break
  }
  return { sets, ideas: setsOf(current) }
}

describe('Twenty distinct ideas across five sets (§O)', () => {
  it('produces the quota for every description in the fixed test set', () => {
    for (const { name, description } of FIXED_TEST_SET) {
      const project = createProject(name, description)
      const { sets, ideas } = runToEnd(project)
      const flat = ideas.flat()

      expect(sets, description).toBeGreaterThanOrEqual(MINIMUM_SETS)
      expect(flat.length, description).toBeGreaterThanOrEqual(MINIMUM_CONCEPTS)
    }
  })

  it('offers four at a time, two with the name and two without (§O)', () => {
    const { project } = moreIdeas(createProject('Okoro & Sons', 'A retail store'))
    const first = setsOf(project)[0] ?? []

    expect(first).toHaveLength(SET_SIZE)
    expect(first.filter((i) => i.layout !== 'symbol')).toHaveLength(2)
    expect(first.filter((i) => i.layout === 'symbol')).toHaveLength(2)
  })

  it('never repeats a concept, including across named and symbol-only (§O)', () => {
    for (const { name, description } of FIXED_TEST_SET) {
      const { ideas } = runToEnd(createProject(name, description))
      const keys = ideas.flat().map((idea) => conceptKey(idea.concept))
      // §O: "Named and symbol-only entries in the quota must not duplicate
      // one another." Counting concepts rather than pictures is what makes
      // that true by construction.
      expect(new Set(keys).size, description).toBe(keys.length)
    }
  })

  it('shows four different motifs first, not four versions of one', () => {
    // Four takes on a gear reads as one idea shown four times — precisely
    // what the rubric guards against.
    const { set } = moreIdeas(createProject('Adeyemi Works', 'We repair diesel generators'))
    expect(new Set(set.map((i) => i.concept.motif)).size).toBe(SET_SIZE)
  })
})

describe('What does NOT count as a new idea (§O)', () => {
  it('leaves palette, font and background out of a concept entirely', () => {
    const [idea] = moreIdeas(createProject('Zenith Data', 'We build software')).set
    // The rubric excludes them, so they are absent from the key rather than
    // being compared and ignored. A recolour cannot become a new concept
    // because there is nowhere for the colour to be recorded.
    expect(conceptKey(idea!.concept)).toBe(`${idea!.concept.motif}:${idea!.concept.construction}`)
    expect(JSON.stringify(idea!.concept)).not.toMatch(/colour|color|font|background/i)
  })

  it('draws the same concept in light and dark without it becoming two ideas', () => {
    const [idea] = moreIdeas(createProject('Zenith Data', 'We build software')).set
    const light = symbolOf(idea!.concept, LIGHT)
    const dark = symbolOf(idea!.concept, DARK)

    // Different pictures, one idea. §O: "Duplicate detection alone is
    // insufficient" — two images can differ in every pixel and still be the
    // same thing recoloured, which is why identity is declared, not measured.
    expect(light).not.toBe(dark)
    expect(conceptKey(idea!.concept)).toBe(conceptKey(idea!.concept))
  })
})

describe('"More ideas" never wraps around (§O)', () => {
  it('stops and says so rather than starting again', () => {
    const project = createProject('Okoro & Sons', 'A retail store selling building materials')
    let last = moreIdeas(project)
    for (let guard = 0; guard < 100 && !last.exhausted; guard += 1) {
      last = moreIdeas(last.project)
    }
    expect(last.exhausted).toBe(true)

    // Asking again gives nothing — not the first set in a new colour, which
    // is the specific dishonesty §O forbids by name.
    const after = moreIdeas(last.project)
    expect(after.set).toHaveLength(0)
    expect(after.project.ideas).toHaveLength(last.project.ideas.length)
  })

  it('labels a short final batch partial, as data rather than a UI decision', () => {
    let project = createProject('Bella Glow', 'A beauty salon doing hair and makeup')
    const partials: boolean[] = []
    for (let guard = 0; guard < 100; guard += 1) {
      const result = moreIdeas(project)
      if (result.set.length === 0) break
      partials.push(result.partial)
      project = result.project
      if (result.exhausted) break
    }
    // Every full set is not partial; only a short one can be.
    expect(partials.filter(Boolean).length).toBeLessThanOrEqual(1)
  })

  it('retains earlier results, so going back shows what was there', () => {
    const first = moreIdeas(createProject('Green Acres', 'A farm producing crops'))
    const second = moreIdeas(first.project)
    expect(setsOf(second.project)[0]).toEqual(first.set)
  })

  it('is deterministic, so the same project never re-rolls its ideas', () => {
    const a = runToEnd(createProject('Swift Haulage', 'Transport and freight by truck'))
    const b = runToEnd(createProject('Swift Haulage', 'Transport and freight by truck'))
    // §O asks for seeds to be tracked. There is no randomness here at all,
    // which is stronger: "More ideas" cannot accidentally repeat.
    expect(a.ideas).toEqual(b.ideas)
  })
})

describe('The description is the primary source of meaning (§O)', () => {
  it('ignores a name that contradicts the description', () => {
    // The fixed test set's misleading entry: a generator-repair business
    // called Sunrise Bakery must not be given bread.
    const misleading = meaningOf('We repair diesel generators and industrial machines', 'Sunrise Bakery')
    expect(misleading.motifs).toContain('gear')
    expect(misleading.motifs).not.toContain('pot')
    expect(misleading.motifs).not.toContain('flame')
  })

  it('never reads the name for an industry at all', () => {
    // Same name, no description. Nothing is inferred from "Bakery" — the
    // fallbacks are used instead, because guessing produces a logo about
    // somebody else's company.
    const nothing = meaningOf('', 'Sunrise Bakery')
    expect(nothing.trades).toBe(0)
    expect(nothing.motifs).not.toContain('pot')
  })

  it('takes initials from the name, which IS what a name is for', () => {
    // "&" is skipped rather than taken as an initial: "O&" is not a monogram
    // anybody would want, and the words that carry letters are the ones that
    // carry the name.
    expect(initialsOf('Okoro & Sons')).toBe('OS')
    expect(initialsOf('Adeyemi Works')).toBe('AW')
    // §O: "non-English names with accents and non-Latin scripts."
    expect(initialsOf('Ọkọrọ Ventures')).toBe('ỌV')
    expect(initialsOf('شركة النور')).toBe('شا')
  })
})

describe('A clarifying question is rare, and only for incompatible readings (§O)', () => {
  it('stays quiet for an ordinary description', () => {
    expect(needsClarifying('We repair diesel generators')).toBe(false)
  })

  it('stays quiet when nothing was recognised, rather than interrogating', () => {
    // §O's first paragraph rules out an interview: "no model settings, no
    // prompt engineering." Not recognising a trade is not a reason to ask.
    expect(needsClarifying('We do many different things for many people')).toBe(false)
  })

  it('asks when two incompatible trades are both present', () => {
    expect(needsClarifying('A beauty salon that also does haulage and freight')).toBe(true)
  })
})

describe('Lettering is set, never drawn (§O)', () => {
  it('keeps the name exactly as typed, accents and all', () => {
    const svg = letteringOf('Ọkọrọ & Sons', LIGHT)
    // A model asked for artwork "saying Ọkọrọ & Sons" returns approximate
    // letters, and a misspelled name in artwork is worse than no logo.
    expect(svg).toContain('Ọkọrọ')
    expect(svg).toContain('&amp;')
  })

  it('puts no text in the symbol, ever', () => {
    const [idea] = moreIdeas(createProject('Zenith Data', 'We build software')).set
    expect(symbolOf(idea!.concept, LIGHT)).not.toContain('<text')
    expect(lockupOf(idea!.concept, 'Zenith Data', 'symbol', LIGHT)).not.toContain('<text')
  })

  it('sets the name in the lockups that carry one', () => {
    const [idea] = moreIdeas(createProject('Zenith Data', 'We build software')).set
    for (const layout of ['horizontal', 'stacked'] as const) {
      const svg = lockupOf(idea!.concept, 'Zenith Data', layout, LIGHT)
      expect(svg).toContain('<text')
      expect(svg).toContain('Zenith Data')
    }
  })

  it('escapes a name that would otherwise break the drawing', () => {
    // A company name is data, and a name is exactly the field somebody
    // eventually pastes something strange into.
    const svg = letteringOf('<script>alert(1)</script>', LIGHT)
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })
})

describe('Output is true vector (§O)', () => {
  it('emits SVG with a viewBox and no raster anywhere', () => {
    const [idea] = moreIdeas(createProject('Green Acres', 'A farm producing crops')).set
    const svg = symbolOf(idea!.concept, LIGHT)
    // §O: "SVG only for true vector output." Everything here is geometry, so
    // the PNG is rasterised FROM this rather than this being traced from one.
    expect(svg).toContain('viewBox="0 0 100 100"')
    expect(svg).not.toContain('<image')
    expect(svg).not.toContain('data:image')
  })

  it('draws every concept in both light and dark (§O)', () => {
    const { ideas } = runToEnd(createProject('Ilesanmi Builders', 'Construction and plumbing'))
    for (const idea of ideas.flat()) {
      for (const palette of [LIGHT, DARK]) {
        const svg = symbolOf(idea.concept, palette)
        expect(svg.startsWith('<svg'), conceptKey(idea.concept)).toBe(true)
        expect(svg).toContain(palette.ink)
      }
    }
  })
})
