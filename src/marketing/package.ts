/**
 * §T's unit of work: the discoverability package for a launch locale.
 *
 * §T's last line: "New launch locales ship listing + landing pages + keyword
 * sheet together — **a locale is not 'launched' without its discoverability
 * package**." So the thing that can be asked a yes/no question is the package,
 * not the listing, and this is where that question is answered.
 *
 * The answer is currently NO for every locale, for reasons the report names
 * one by one. That is the honest state of §T today and it is recorded here
 * rather than in a sentence somebody has to keep up to date.
 */

import { TERMINOLOGY_TABLES, LAUNCH_LOCALES } from '../domain/locale/data/terminology'
import type { LocaleId } from '../domain/locale/types'
import { LOCALE_LISTING_INPUTS } from './keywords'
import { type Listing, listingFor } from './listing'

export interface LocalePackage {
  readonly locale: LocaleId
  readonly listing: Listing
  /** Every reason this locale cannot launch, listing and otherwise. */
  readonly blockers: readonly string[]
  /** Worth reading before submission; never a reason to hold it. */
  readonly notes: readonly string[]
  readonly launchable: boolean
}

export interface PackageReport {
  readonly packages: readonly LocalePackage[]
  readonly launchable: readonly LocaleId[]
  readonly blocked: readonly LocaleId[]
}

export function packageFor(locale: LocaleId): LocalePackage {
  const table = TERMINOLOGY_TABLES[locale]
  const input = LOCALE_LISTING_INPUTS[locale]

  // A locale in the launch set with no table or no keyword sheet is not a
  // locale with an empty package — it is a hole in the launch set, and saying
  // so beats generating a listing out of nothing.
  if (table === undefined || input === undefined) {
    const missing = table === undefined ? 'terminology table' : 'listing input'
    return {
      locale,
      listing: {
        locale,
        title: '',
        subtitle: '',
        keywordField: '',
        playTerms: [],
        blockers: [{ field: 'locale', reason: `no ${missing}` }],
        notes: [],
        submittable: false,
      },
      blockers: [`${locale} has no ${missing}`],
      notes: [],
      launchable: false,
    }
  }

  const listing = listingFor(table, input)
  const blockers = listing.blockers.map((b) => `${b.field}: ${b.reason}`)
  const notes = listing.notes.map((n) => `${n.field}: ${n.detail}`)

  return { locale, listing, blockers, notes, launchable: blockers.length === 0 }
}

export function packageReport(locales: readonly LocaleId[] = LAUNCH_LOCALES): PackageReport {
  const packages = locales.map(packageFor)
  return {
    packages,
    launchable: packages.filter((p) => p.launchable).map((p) => p.locale),
    blocked: packages.filter((p) => !p.launchable).map((p) => p.locale),
  }
}

/** The report as text, for a person deciding what to do next. */
export function reportOf(report: PackageReport): string {
  const lines: string[] = []
  for (const entry of report.packages) {
    lines.push(`${entry.launchable ? 'ready' : 'BLOCKED'}  ${entry.locale}`)
    lines.push(`    title     ${entry.listing.title}`)
    lines.push(`    subtitle  ${entry.listing.subtitle}`)
    lines.push(`    keywords  ${entry.listing.keywordField}`)
    for (const blocker of entry.blockers) lines.push(`    BLOCKER  ${blocker}`)
    for (const note of entry.notes) lines.push(`    note     ${note}`)
  }
  lines.push(
    report.blocked.length === 0
      ? `${report.launchable.length} locales ready to submit`
      : `${report.blocked.length} of ${report.packages.length} locales cannot launch: ${report.blocked.join(', ')}`,
  )
  return lines.join('\n')
}
