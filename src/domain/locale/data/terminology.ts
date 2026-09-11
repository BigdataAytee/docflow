/**
 * The §D terminology tables for the §Q Phase-0 launch locales.
 *
 * These ship in the app bundle — switching region never needs a connection
 * (Rule #3, §D.6). The resolution layer that reads them is Phase 1.
 */

import type { LocaleId, TerminologyTable } from '../types'
import { EN_GB, EN_GH, EN_NG, EN_US } from './terminology.en'
import { AR, ES, FR } from './terminology.intl'

export const TERMINOLOGY_TABLES: Readonly<Record<LocaleId, TerminologyTable>> = {
  'EN-NG': EN_NG,
  'EN-GH': EN_GH,
  'EN-GB': EN_GB,
  'EN-US': EN_US,
  FR,
  ES,
  AR,
}

/** The §Q Phase-0 launch set. A locale is not "launched" without its §T package. */
export const LAUNCH_LOCALES = ['EN-NG', 'EN-GH', 'EN-GB', 'EN-US', 'FR', 'ES', 'AR'] as const

/** The demo company's locale (§B): Dynamic Renaissance, Ifo, Ogun State. */
export const DEFAULT_LOCALE: LocaleId = 'EN-NG'

export { EN_NG, EN_GH, EN_GB, EN_US, FR, ES, AR }
