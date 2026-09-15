/**
 * Every route path in one place (§G).
 *
 * Paths are built from the INTERNAL type — `/list/waybill`, never
 * `/list/delivery-note`. A localised word in a URL would be a fifth place a
 * document name lives, and Rule #4 allows exactly one. It would also break
 * every saved link the moment a business changed region (§D.2), which is the
 * same failure the frozen labels exist to prevent.
 */

import type { DocumentType } from '../domain/documents/types'

/**
 * One path segment, encoded.
 *
 * Every id here is a UUID today, so this changes nothing about what the app
 * builds. It is here for what a segment might become: a backslash or a second
 * slash inside one turns a relative path into something a router can read as
 * a different destination, and React Router 6.30 carries an open-redirect
 * advisory (GHSA-wrjc-x8rr-h8h6) whose whole precondition is a destination
 * string somebody else can shape.
 *
 * The app is not exposed to it — every destination below is a literal prefix
 * plus an internal record id, and none of them comes from a URL, a query
 * parameter or a scanned code. That is a fact about today's call sites rather
 * than a property of the builders, which is exactly the kind of fact that
 * stops being true quietly. Encoding makes it a property of the builders.
 */
const segment = (value: string): string => encodeURIComponent(value)

export const HOME = '/'
export const CUSTOMERS = '/customers'
export const ANALYTICS = '/analytics'
export const SETTINGS = '/settings'
export const WELCOME = '/welcome'
/** §R's four-page welcome, which a first run is sent to. */
export const ONBOARDING = '/start'

export const listPath = (type: DocumentType): string => `/list/${segment(type)}`
export const newDocumentPath = (type: DocumentType): string => `/new/${segment(type)}`
export const editDocumentPath = (id: string): string => `/edit/${segment(id)}`
export const documentPath = (id: string): string => `/doc/${segment(id)}`
export const customerPath = (id: string): string => `/customers/${segment(id)}`
export const statementPath = (customerId: string, currency: string): string =>
  `/customers/${segment(customerId)}/statement/${segment(currency)}`

export const SETTINGS_PANELS = [
  'region',
  'company',
  'tax',
  'payment',
  'items',
  'signature',
  'appearance',
  'pro',
  'data',
  'account',
  'help',
  'delete',
] as const
export type SettingsPanel = (typeof SETTINGS_PANELS)[number]
export const settingsPath = (panel: SettingsPanel): string => `/settings/${segment(panel)}`
