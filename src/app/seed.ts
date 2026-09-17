/**
 * The dev server's starting company (`npm run dev`, memory repositories).
 *
 * `npm run dev` runs against `createMemoryRepositories`, which starts empty —
 * and an app with no company has no currency, no prefixes and no region, so
 * every screen would render its empty state and none of them would be wrong.
 * This gives the dev server one company to hang off.
 *
 * It is NOT sample data in §R's sense: no customers, no documents and no money.
 * §R's sample is shown on the welcome screen and never written (see
 * `WelcomeScreen`), so nothing here can leak a seeded figure into a balance.
 */

import { type MemoryState, emptyState } from '../data/repositories'
import { showcaseState } from './showcase'
import { regionProfile } from '../features/settings/region'

export const DEV_COMPANY_ID = 'co_dev'

/** A region the phone would have inferred (§R). Overridable in Settings. */
const DEFAULT_REGION = 'NG'

export function devState(companyId = DEV_COMPANY_ID, region = DEFAULT_REGION): MemoryState {
  const profile = regionProfile(region)

  /*
   * A full set to look at, when the demo build asks for one.
   *
   * `VITE_SHOWCASE=1` alongside the demo mode — never in an account build,
   * because `createBackend` only reaches this branch when no project is
   * configured. §R: a demo is never passed off as an account, and twenty
   * invented invoices in somebody's ledger would be exactly that.
   */
  const showcase =
    (import.meta.env as unknown as Record<string, string | undefined>).VITE_SHOWCASE === '1'
      ? showcaseState(companyId, region)
      : {}

  return {
    ...emptyState(),
    ...showcase,
    companies: [
      {
        id: companyId,
        name: '',
        localeRegion: region,
        localeLanguage: 'en',
        labelOverrides: {},
        currency: profile.currency,
        numberingPrefixes: {},
        bankFields: {},
        enabledPaymentMethods: [],
        nameStyle: 'classic',
        logoSize: 'M',
        ...(showcase.documents === undefined
          ? {}
          : {
              name: 'Dynamic Renaissance BIZ ENTs. LTD',
              address: 'Lagos Abeokuta Motor Road, Vespa Bus Stop, Ifo, 572, Ogun State',
              phone: '+2348106332490',
              email: 'admin@dynamicrenaissance.org',
              website: 'www.dynamicrenaissance.org',
              taxRatePpm: 75_000,
            }),
      },
    ],
  }
}
