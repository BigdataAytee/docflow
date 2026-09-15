/**
 * Every place a person can go, in one list (§G, §V).
 *
 * The Shell's tabs, the settings index and the command palette all need the
 * same answer to "where can I go from here", and until this existed the
 * settings panels' labels lived in `SettingsScreen` while their paths lived
 * in `paths.ts`, so a palette would have been a second copy of both. A
 * destination list that disagrees with the nav is worse than no palette.
 *
 * Nothing here invents a destination. Every entry is a route that already
 * exists in `paths.ts` and a string that already exists in the catalogue —
 * which is the whole design of the palette: a VIEW of the route table, not a
 * surface with features of its own.
 */

import { DOCUMENT_TYPES, type DocumentType } from '../domain/documents/types'
import { label as typeLabel, pluralLabel, type LocaleProfile } from '../domain/locale/profile'
import { format, type UiStrings } from '../domain/locale/data/strings'
import {
  ANALYTICS,
  CUSTOMERS,
  HOME,
  SETTINGS,
  type SettingsPanel,
  listPath,
  newDocumentPath,
  settingsPath,
} from './paths'

export interface Destination {
  /** Stable, and never a localised word — the same reason paths are not. */
  readonly id: string
  /** What it is called, in the active language. */
  readonly label: string
  readonly path: string
  /** Everything it can be found by, lower-cased (§D.3 rules apply). */
  readonly terms: readonly string[]
}

/**
 * The first word is always the destination's own LABEL. Typing what a row
 * says has to find that row — obvious, and it was missing: "New Quotation"
 * matched nothing, because the terms held the type's word and not the phrase
 * the row is written in.
 */
const terms = (...words: readonly string[]): string[] => [
  ...new Set(words.map((word) => word.trim().toLocaleLowerCase()).filter((word) => word !== '')),
]

/** The four tabs (§G). The Shell renders these; so does the palette. */
export function navDestinations(strings: UiStrings): Destination[] {
  return [
    { id: 'nav:home', label: strings.nav.home, path: HOME, terms: terms(strings.nav.home) },
    {
      id: 'nav:customers',
      label: strings.nav.customers,
      path: CUSTOMERS,
      terms: terms(strings.nav.customers),
    },
    {
      id: 'nav:business',
      label: strings.nav.business,
      path: ANALYTICS,
      terms: terms(strings.nav.business, strings.analytics.title),
    },
    {
      id: 'nav:settings',
      label: strings.nav.settings,
      path: SETTINGS,
      terms: terms(strings.nav.settings),
    },
  ]
}

/**
 * The settings panels, in the order the index shows them. `SettingsPanel` is
 * a closed union, so a panel added to `paths.ts` and forgotten here is a type
 * error rather than a row missing from the palette.
 */
/**
 * The settings index, in the two groups the reference draws (§F).
 *
 * The index was a flat list of plain rows; the reference has YOUR BUSINESS
 * and YOU & YOUR DATA as separate divided cards, each row carrying an icon, a
 * sublabel saying its CURRENT VALUE, and a chevron. A row that only repeats
 * its own name tells somebody nothing they did not know from the list.
 *
 * Declared here rather than in the screen so the command palette and the
 * index cannot disagree about which panels exist — two copies of that list
 * drifted the moment a panel was added, which is why there is one.
 */
export interface SettingsGroup {
  readonly id: 'business' | 'you'
  readonly title: string
  readonly panels: readonly SettingsPanel[]
}

export function settingsGroups(strings: UiStrings): readonly SettingsGroup[] {
  return [
    {
      id: 'business',
      title: strings.settings.groupBusiness,
      panels: ['company', 'tax', 'payment', 'items', 'signature'],
    },
    {
      id: 'you',
      title: strings.settings.groupYou,
      panels: ['region', 'appearance', 'data', 'pro', 'delete'],
    },
  ]
}

export function settingsDestinations(strings: UiStrings): Destination[] {
  const labels: Record<SettingsPanel, string> = {
    region: strings.settings.regionAndLanguage,
    company: strings.settings.company,
    tax: strings.settings.tax,
    payment: strings.settings.howYouGetPaid,
    items: strings.settings.savedItems,
    signature: strings.settings.defaultSignature,
    appearance: strings.settings.theme,
    pro: strings.pro.settingsRow,
    data: strings.dataSync.title,
    delete: strings.deleteAccount.rowLabel,
  }

  return (Object.keys(labels) as SettingsPanel[]).map((panel) => ({
    id: `settings:${panel}`,
    label: labels[panel],
    path: settingsPath(panel),
    terms: terms(labels[panel], strings.nav.settings),
  }))
}

/**
 * One list per type, and one "new" per type. Both resolve their word through
 * the locale profile (Rule #4), and both carry the plural and the §D.3
 * synonyms as search terms so "delivery note" finds the waybill list in a
 * company that has never used the word "waybill".
 */
export function listDestinations(
  profile: LocaleProfile,
  strings: UiStrings,
  type: DocumentType,
): Destination {
  const one = typeLabel(profile, type)
  const many = pluralLabel(profile, type)
  return {
    id: `list:${type}`,
    label: format(strings.palette.openList, { label: many }),
    path: listPath(type),
    terms: terms(format(strings.palette.openList, { label: many }), one, many, type),
  }
}

export function createDestination(
  profile: LocaleProfile,
  strings: UiStrings,
  type: DocumentType,
): Destination {
  const one = typeLabel(profile, type)
  return {
    id: `new:${type}`,
    label: format(strings.lists.newDocument, { label: one }),
    path: newDocumentPath(type),
    terms: terms(format(strings.lists.newDocument, { label: one }), one, type, strings.palette.create),
  }
}

export const listDestinationsAll = (profile: LocaleProfile, strings: UiStrings): Destination[] =>
  DOCUMENT_TYPES.map((type) => listDestinations(profile, strings, type))

export const createDestinationsAll = (profile: LocaleProfile, strings: UiStrings): Destination[] =>
  DOCUMENT_TYPES.map((type) => createDestination(profile, strings, type))
