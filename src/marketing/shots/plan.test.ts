/**
 * The screenshot plan (§T).
 *
 * The property worth testing is the one §T states as a prohibition: a
 * screenshot must be re-shot per market, "not a translated caption over an
 * EN-NG screenshot". That means the words each frame must show have to come
 * from the terminology table and the currency — never from this file, which
 * would keep passing after a rename.
 */

import { describe, expect, it } from 'vitest'

import { CURRENCIES } from '../../domain/locale/data/currencies'
import { TERMINOLOGY_TABLES } from '../../domain/locale/data/terminology'
import { regionProfile } from '../../features/settings/region'
import { SHOT_REGIONS_WITH_FIXTURES, shotState } from './fixtures'
import { SHOT_REGIONS, planFor, reportOf, shotReport } from './plan'
import { SHOTS, STORE_DEVICES } from './spec'

describe('Every frame proves its own market (§T)', () => {
  it('requires the market’s own plural label, from the terminology table', () => {
    for (const region of SHOT_REGIONS) {
      const plan = planFor(region)
      const table = TERMINOLOGY_TABLES[plan.locale]
      if (table === undefined) continue

      for (const frame of plan.plans) {
        if (frame.shot.type === undefined) continue
        expect(
          frame.mustContain,
          `${region}/${frame.shot.id} does not require its own word`,
        ).toContain(table.types[frame.shot.type].pluralLabel)
      }
    }
  })

  it('requires the market’s own currency symbol wherever money shows', () => {
    for (const region of SHOT_REGIONS) {
      const plan = planFor(region)
      const symbol = CURRENCIES[plan.currency]?.symbol
      if (symbol === undefined) continue

      for (const frame of plan.plans) {
        if (!frame.shot.showsMoney) continue
        expect(frame.mustContain, `${region}/${frame.shot.id}`).toContain(symbol)
      }
      // A delivery document carries no money (§V), so demanding a currency
      // there would fail a correct screen.
      for (const frame of plan.plans.filter((f) => !f.shot.showsMoney)) {
        expect(frame.mustContain).not.toContain(symbol)
      }
    }
  })

  it('follows a renamed type into what the frame must show', () => {
    // The same rename that must NOT move a URL must move this.
    const before = planFor('GB').plans.find((f) => f.shot.type === 'waybill')
    const table = TERMINOLOGY_TABLES['EN-GB']
    if (before === undefined || table === undefined) throw new Error('missing plan')

    expect(before.mustContain).toContain(table.types.waybill.pluralLabel)
    expect(before.mustContain).not.toContain('Waybills')
  })

  it('distinguishes two markets that share a language', () => {
    // EN-NG and EN-GB are both English. If the plan did not read the table,
    // the two would demand the same words and the "re-shot per locale" rule
    // would be unenforced exactly where it matters most.
    const ng = planFor('NG').plans.find((f) => f.shot.type === 'waybill')
    const gb = planFor('GB').plans.find((f) => f.shot.type === 'waybill')

    expect(ng?.mustContain).not.toEqual(gb?.mustContain)
  })
})

describe('The store sizes are the ones the stores ask for', () => {
  it('matches CSS pixels times scale to the required pixel size', () => {
    // A 1290-CSS-pixel-wide page is a tablet layout photographed at phone
    // size. The product of the two is what the file must measure.
    for (const device of STORE_DEVICES) {
      expect(device.cssWidth * device.scale, device.id).toBe(device.width)
      expect(device.cssHeight * device.scale, device.id).toBe(device.height)
    }
  })

  it('plans every shot on every device for every market', () => {
    for (const region of SHOT_REGIONS) {
      expect(planFor(region).plans).toHaveLength(STORE_DEVICES.length * SHOTS.length)
    }
  })

  it('gives every frame its own file', () => {
    const files = SHOT_REGIONS.flatMap((region) => planFor(region).plans.map((f) => f.file))

    expect(new Set(files).size).toBe(files.length)
  })
})

describe('Nothing is submittable, and the report says why', () => {
  it('blocks every market', () => {
    const report = shotReport()

    expect(report.shootable).toEqual([])
    expect(report.blocked).toEqual([...SHOT_REGIONS])
    expect(reportOf(report)).toContain('no market can be shot yet')
  })

  it('blocks the demo banner on every market, deployed or not', () => {
    // §R: "a local demo is never passed off as an account." Suppressing the
    // banner for the camera would be that rule broken at a store instead of
    // at an owner.
    for (const region of SHOT_REGIONS) {
      expect(
        planFor(region).blockers.some((b) => b.includes('demo banner')),
        `${region} would be shot without declaring the banner`,
      ).toBe(true)
    }
  })

  it('blocks a market whose language has no UI strings', () => {
    for (const region of ['FR', 'ES', 'AE']) {
      expect(
        planFor(region).blockers.some((b) => b.includes('UI strings')),
        `${region} was not blocked for missing UI strings`,
      ).toBe(true)
    }
    for (const region of ['NG', 'GB', 'US']) {
      expect(planFor(region).blockers.some((b) => b.includes('UI strings'))).toBe(false)
    }
  })
})

describe('The fixtures are records, not claims', () => {
  it('has a fixture for every market being shot', () => {
    for (const region of SHOT_REGIONS) {
      expect(SHOT_REGIONS_WITH_FIXTURES, `${region} has no fixture`).toContain(region)
    }
  })

  it('refuses a market it has no records for', () => {
    expect(() => shotState('BR')).toThrow(/No screenshot fixture/)
  })

  it('holds records in the market’s own currency and language', () => {
    for (const region of SHOT_REGIONS) {
      const state = shotState(region)
      const profile = regionProfile(region)
      const company = state.companies[0]

      expect(company?.currency).toBe(profile.currency)
      expect(company?.localeRegion).toBe(region)
      // Not 'en' everywhere: a fixture that quietly said English for France
      // would make the blocked-language check look like the only obstacle.
      expect(company?.localeLanguage).toBe(TERMINOLOGY_TABLES[profile.locale]?.language)
      for (const document of state.documents) {
        expect(document.currency, `${region} document in the wrong currency`).toBe(
          profile.currency,
        )
      }
    }
  })

  it('is not the §R first-run sample', () => {
    // §R's sample is badged as a sample and excluded from balances — right in
    // the app, wrong in a listing. These are ordinary demo records instead,
    // and must not carry the sample id or flag.
    const state = shotState('NG')

    for (const document of state.documents) {
      expect(document.id).not.toContain('sample')
      expect(document).not.toHaveProperty('isSample')
    }
    for (const customer of state.customers) {
      expect(customer.id).not.toContain('sample')
    }
  })

  it('carries issued documents, because a list of drafts shows nothing', () => {
    for (const document of shotState('NG').documents) {
      expect(document.issuedReference, 'a draft has no reference to show').not.toBeNull()
    }
  })
})
