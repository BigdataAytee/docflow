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

export const HOME = '/'
export const CUSTOMERS = '/customers'
export const ANALYTICS = '/analytics'
export const SETTINGS = '/settings'
export const WELCOME = '/welcome'
/** §R's four-page welcome, which a first run is sent to. */
export const ONBOARDING = '/start'

export const listPath = (type: DocumentType): string => `/list/${type}`
export const newDocumentPath = (type: DocumentType): string => `/new/${type}`
export const editDocumentPath = (id: string): string => `/edit/${id}`
export const documentPath = (id: string): string => `/doc/${id}`
export const customerPath = (id: string): string => `/customers/${id}`
export const statementPath = (customerId: string, currency: string): string =>
  `/customers/${customerId}/statement/${currency}`

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
  'delete',
] as const
export type SettingsPanel = (typeof SETTINGS_PANELS)[number]
export const settingsPath = (panel: SettingsPanel): string => `/settings/${panel}`
