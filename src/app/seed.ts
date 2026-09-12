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
import { regionProfile } from '../features/settings/region'

export const DEV_COMPANY_ID = 'co_dev'

/** A region the phone would have inferred (§R). Overridable in Settings. */
const DEFAULT_REGION = 'NG'

export function devState(companyId = DEV_COMPANY_ID, region = DEFAULT_REGION): MemoryState {
  const profile = regionProfile(region)

  return {
    ...emptyState(),
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
      },
    ],
  }
}
