/**
 * The §T keyword sheet as a FILE, so the repo's copy cannot drift from the
 * terminology tables.
 *
 * §T: "a per-locale keyword sheet derived from the terminology synonyms…
 * **maintained in the repo** beside the terminology tables… updated in the
 * same cycle as terminology-table changes."
 *
 * "Updated in the same cycle" is a promise about a person remembering. This
 * makes it a promise the build keeps: the sheet is rendered from the same
 * generator the app uses, a test compares the rendered text to the committed
 * file, and a terminology change that was not regenerated fails CI with a diff
 * instead of shipping a store listing that names a word the app no longer uses.
 *
 * The hand-written sheets in `docs/discoverability/keywords/` stay as they
 * are: they carry the QUESTIONS for the native speaker ("is 'way bill' typed
 * as two words here?"), which no generator can produce.
 */

import { LAUNCH_LOCALES } from '../domain/locale/data/terminology'
import { packageFor } from './package'

const HEADER = `<!--
  GENERATED FILE — do not edit by hand.

  Rendered from src/domain/locale (the §D terminology tables) through
  src/marketing. To update it after a terminology change:

      npm run discoverability

  A stale copy fails \`npm test\`, which is the point: §T asks for the sheets
  to be "updated in the same cycle as terminology-table changes", and a
  generated file is the only version of that promise a person cannot forget.
-->

# §T — keyword sheets and listings, generated

**Every locale below is BLOCKED from submission**, and each one says why. The
common reason is the one CLAUDE.md names: a terminology table stays \`draft\`
until a native speaker of that market signs it off, and nothing unreviewed
reaches a store listing any more than it reaches a PDF heading.

Apple's caps are reported, never applied — a title that does not fit is trimmed
by a reviewer, and what survives the trim is the local type name, never the
generic half.
`

/** Apple recombines single words; Play indexes prose. Both are shown. */
export function renderSheet(): string {
  const sections = LAUNCH_LOCALES.map((locale) => {
    const entry = packageFor(locale)
    const { listing } = entry
    const lines = [
      `## ${locale}`,
      '',
      `| Field | Value |`,
      `| --- | --- |`,
      `| Title | ${listing.title} |`,
      `| Subtitle | ${listing.subtitle} |`,
      `| Apple keyword field | \`${listing.keywordField}\` |`,
      '',
      `**Play long-description vocabulary** — whole phrases, woven into ordinary`,
      `sentences, never a keyword block:`,
      '',
      listing.playTerms.map((term) => `\`${term}\``).join(' · '),
      '',
      `**Status: ${entry.launchable ? 'ready to submit' : 'BLOCKED'}**`,
      '',
    ]
    for (const blocker of entry.blockers) lines.push(`- ❌ ${blocker}`)
    for (const note of entry.notes) lines.push(`- ℹ️ ${note}`)
    lines.push('')
    return lines.join('\n')
  })

  return `${HEADER}\n${sections.join('\n')}`
}
