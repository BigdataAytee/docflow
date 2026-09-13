/**
 * Which screenshots exist, and what each one must prove.
 *
 * A shot is planned per REGION rather than per locale, because a screenshot
 * shows a currency and a locale does not carry one — §D's whole point is that
 * one country choice settles terminology, currency, bank fields, tax label and
 * date format together, so the region is the thing a screenshot is "of".
 */

import { CURRENCIES } from '../../domain/locale/data/currencies'
import { hasStringsFor } from '../../domain/locale/data/strings'
import { TERMINOLOGY_TABLES } from '../../domain/locale/data/terminology'
import { regionProfile } from '../../features/settings/region'
import { SHOTS, STORE_DEVICES, type ShotPlan, fileFor } from './spec'

/**
 * The markets a store listing is shot for — one per launch locale, so that
 * every locale with a listing has the screenshots §T says it cannot launch
 * without.
 */
export const SHOT_REGIONS = ['NG', 'GH', 'GB', 'US', 'FR', 'ES', 'AE'] as const

export interface RegionPlan {
  readonly region: string
  readonly locale: string
  readonly currency: string
  readonly plans: readonly ShotPlan[]
  /** Why this market cannot be shot at all. Empty means it can. */
  readonly blockers: readonly string[]
}

export function planFor(region: string): RegionPlan {
  const profile = regionProfile(region)
  const table = TERMINOLOGY_TABLES[profile.locale]
  const currency = CURRENCIES[profile.currency]
  const blockers: string[] = []

  if (table === undefined) blockers.push(`${region} has no terminology table`)
  if (currency === undefined) blockers.push(`${region} has no currency definition`)

  // §S, and `strings.ts` before it: a screenshot of an English UI under a
  // French flag is the same lie as a French landing page written in English,
  // except a screenshot is submitted to a store as a depiction of the product.
  if (table !== undefined && !hasStringsFor(table.language)) {
    blockers.push(
      `${region} needs ${table.language} UI strings and has none — a screenshot of ` +
        'the English app is not a screenshot of the app this listing describes',
    )
  }
  // The banner across the top of every frame.
  //
  // The screenshot build runs on the demo backend, and §R says "a local demo
  // is never passed off as an account" — so `DemoBanner` states it on every
  // screen, correctly. A real user in a real account never sees that strip,
  // which makes every frame taken here a depiction of a state the product does
  // not ship. Suppressing the banner for the camera would be the exact thing
  // §R forbids, aimed at a store instead of at an owner.
  //
  // So this is a blocker rather than a rendering detail, and it is the same
  // blocker as everything else: submittable frames need the app running
  // against a deployed project, in account mode, with nothing to declare.
  blockers.push(
    `${region} would be photographed on the demo backend, so every frame carries the ` +
      '§R demo banner a real account never shows — the frames are drafts until the ' +
      'app can be shot signed in to a deployed project',
  )

  if (table !== undefined && table.reviewStatus !== 'approved') {
    blockers.push(
      `${region}'s ${table.locale} terminology is ${table.reviewStatus}: the words in ` +
        'the image are not signed off, and an image is harder to correct than a string',
    )
  }

  const plans =
    table === undefined || currency === undefined
      ? []
      : STORE_DEVICES.flatMap((device) =>
          SHOTS.map((shot) => ({
            locale: profile.locale,
            device,
            shot,
            file: fileFor(region, device, shot),
            mustContain: [
              ...(shot.type === undefined ? [] : [table.types[shot.type].pluralLabel]),
              ...(shot.showsMoney ? [currency.symbol] : []),
            ],
          })),
        )

  return { region, locale: profile.locale, currency: profile.currency, plans, blockers }
}

export interface ShotReport {
  readonly regions: readonly RegionPlan[]
  readonly shootable: readonly string[]
  readonly blocked: readonly string[]
}

export function shotReport(regions: readonly string[] = SHOT_REGIONS): ShotReport {
  const plans = regions.map(planFor)
  return {
    regions: plans,
    shootable: plans.filter((p) => p.blockers.length === 0).map((p) => p.region),
    blocked: plans.filter((p) => p.blockers.length > 0).map((p) => p.region),
  }
}

export function reportOf(report: ShotReport): string {
  const lines: string[] = []
  for (const entry of report.regions) {
    lines.push(
      `${entry.blockers.length === 0 ? 'shoot' : 'BLOCKED'}  ${entry.region} ` +
        `(${entry.locale}, ${entry.currency}) — ${entry.plans.length} frames`,
    )
    for (const blocker of entry.blockers) lines.push(`    · ${blocker}`)
  }
  lines.push(
    report.shootable.length === 0
      ? `no market can be shot yet: ${report.blocked.join(', ')}`
      : `${report.shootable.length} of ${report.regions.length} markets shootable`,
  )
  return lines.join('\n')
}
