/**
 * The destination table (§G, §D.3).
 *
 * The point of this file existing at all is that the Shell, the settings
 * index and the command palette must agree about where you can go. These
 * tests are what make "agree" mean something.
 */

import { describe, expect, it } from 'vitest'

import {
  createDestinationsAll,
  listDestinationsAll,
  navDestinations,
  settingsDestinations,
} from './destinations'
import { SETTINGS_PANELS, listPath, newDocumentPath, settingsPath } from './paths'
import { stringsFor } from '../domain/locale/data/strings'
import { DOCUMENT_TYPES } from '../domain/documents/types'

const strings = stringsFor('en')
const NG = { locale: 'EN-NG' } as const
const GB = { locale: 'EN-GB' } as const

describe('Every destination is a route that already exists', () => {
  it('covers every settings panel, in the order the index shows them', () => {
    const panels = settingsDestinations(strings)
    expect(panels.map((panel) => panel.path)).toEqual(
      SETTINGS_PANELS.map((panel) => settingsPath(panel)),
    )
  })

  it('covers every document type, both to look at and to create', () => {
    expect(listDestinationsAll(NG, strings).map((d) => d.path)).toEqual(
      DOCUMENT_TYPES.map((type) => listPath(type)),
    )
    expect(createDestinationsAll(NG, strings).map((d) => d.path)).toEqual(
      DOCUMENT_TYPES.map((type) => newDocumentPath(type)),
    )
  })

  it('names the four tabs from the catalogue', () => {
    expect(navDestinations(strings).map((d) => d.label)).toEqual([
      strings.nav.home,
      strings.nav.customers,
      strings.nav.business,
      strings.nav.settings,
    ])
  })

  it('gives every destination an id that is not a localised word', () => {
    const all = [
      ...navDestinations(strings),
      ...settingsDestinations(strings),
      ...listDestinationsAll(NG, strings),
      ...createDestinationsAll(NG, strings),
    ]
    expect(new Set(all.map((d) => d.id)).size).toBe(all.length)
    for (const destination of all) {
      expect(destination.id, `${destination.id} is not an id`).toMatch(/^[a-z]+:[a-z]+$/)
    }
  })
})

describe('A destination is findable by the words its owner uses (§D.3)', () => {
  it('finds the delivery-note list by the internal type too', () => {
    // §D.3: "Searching 'waybill' or 'delivery note' finds the same documents."
    // The same has to be true of the PLACE those documents live, or the
    // palette answers a question the Home field answers differently.
    const gb = listDestinationsAll(GB, strings).find((d) => d.path === listPath('waybill'))
    expect(gb?.terms).toContain('waybill')
    expect(gb?.label.toLocaleLowerCase()).toContain('delivery note')
  })

  it('uses the region’s own word in the label, never the internal one', () => {
    const ng = listDestinationsAll(NG, strings).find((d) => d.path === listPath('waybill'))
    expect(ng?.label.toLocaleLowerCase()).toContain('waybill')
  })
})
