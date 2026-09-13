/**
 * The RTL readiness sweep (§Q Phase 7, §S, §V).
 *
 * §V: "RTL locales (when shipped) mirror completely, **PDFs included**."
 *
 * "When shipped" is doing real work: AR has no UI strings, so RTL cannot ship
 * and this is an ASSESSMENT rather than a pass. What an assessment can do
 * today is the part that rots silently — a layout written with physical
 * directions does not mirror, and nobody notices until an Arabic build exists,
 * by which time the offending classes are spread across forty files.
 *
 * So the rule is enforced now, while it is cheap: logical properties
 * everywhere. `text-start` rather than `text-left`, `ms-` rather than `ml-`.
 * They are identical in English and correct in Arabic, so there is no cost to
 * being right and a large cost to being wrong later.
 *
 * The sweep found 25 physical utilities across 14 files, including five in
 * the PDF — exactly what §V calls out.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

const sourceFiles = (): string[] =>
  execFileSync('git', ['ls-files', 'src'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))

/**
 * Physical direction in Tailwind classes.
 *
 * `left-`/`right-` are matched only with a value, so `text-left` is caught by
 * its own alternative and words like `right` inside prose are not.
 */
const PHYSICAL = [
  { pattern: /\btext-(?:left|right)\b/g, use: 'text-start / text-end' },
  { pattern: /\b(?:ml|mr)-[a-z0-9./[\]-]+/g, use: 'ms- / me-' },
  { pattern: /\b(?:pl|pr)-[a-z0-9./[\]-]+/g, use: 'ps- / pe-' },
  { pattern: /\b(?:left|right)-[0-9][a-z0-9./[\]-]*/g, use: 'start- / end-' },
  { pattern: /\b(?:border|rounded)-(?:l|r)-[a-z0-9./[\]-]+/g, use: 'the -s / -e variants' },
]

/** CSS written directly, where the same rule applies. */
const PHYSICAL_CSS = [
  { pattern: /\bmargin-(?:left|right)\s*:/g, use: 'margin-inline-start / -end' },
  { pattern: /\bpadding-(?:left|right)\s*:/g, use: 'padding-inline-start / -end' },
  { pattern: /\btext-align\s*:\s*(?:left|right)\b/g, use: 'text-align: start / end' },
]

describe('Nothing in the UI is written left-to-right by hand (§V)', () => {
  it('uses logical Tailwind utilities everywhere, PDFs included', () => {
    const findings: string[] = []

    for (const file of sourceFiles()) {
      const contents = readFileSync(join(ROOT, file), 'utf8')
      for (const rule of PHYSICAL) {
        for (const match of contents.match(rule.pattern) ?? []) {
          findings.push(`${file}: ${match} — use ${rule.use}`)
        }
      }
    }

    expect(findings, findings.join('\n')).toEqual([])
  })

  it('writes no physical direction in raw CSS either', () => {
    const findings: string[] = []
    const files = [
      ...sourceFiles(),
      ...execFileSync('git', ['ls-files', 'src'], { cwd: ROOT, encoding: 'utf8' })
        .split('\n')
        .filter((file) => file.endsWith('.css')),
    ]

    for (const file of files) {
      if (file === '') continue
      const contents = readFileSync(join(ROOT, file), 'utf8')
      for (const rule of PHYSICAL_CSS) {
        for (const match of contents.match(rule.pattern) ?? []) {
          findings.push(`${file}: ${match} — use ${rule.use}`)
        }
      }
    }

    expect(findings, findings.join('\n')).toEqual([])
  })

  it('catches a physical utility if one comes back', () => {
    // The check is worth having only if it bites; asserting an empty list
    // against a clean tree passes for the wrong reason forever.
    const planted = 'className="mt-3 text-right font-bold"'
    const hits = PHYSICAL.flatMap((rule) => planted.match(rule.pattern) ?? [])

    expect(hits).toEqual(['text-right'])
  })

  it('leaves a genuine left/right word in prose alone', () => {
    // "the goods left" and "left-hand" are not layout.
    const prose = 'the goods left the yard; see the note on the right-hand copy'
    const hits = PHYSICAL.flatMap((rule) => prose.match(rule.pattern) ?? [])

    expect(hits).toEqual([])
  })
})
