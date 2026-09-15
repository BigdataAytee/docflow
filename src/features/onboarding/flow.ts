/**
 * The four-page welcome (§R, and the reference's `vOnboarding`).
 *
 * Pure state, no React and no repository, so the flow can be walked in a test
 * the way a person walks it on a phone. The screen renders what this returns
 * and calls back; it decides nothing.
 *
 * ONE DEVIATION FROM THE REFERENCE, and it is v6 winning a conflict rather
 * than a simplification. The reference's second page asks for a business name
 * and a CURRENCY. §R asks for "company name, business country (pre-filled
 * from the phone; sets terminology, currency default, bank fields, tax label,
 * date format in ONE confirmation — REPLACING the bare currency default)". A
 * bare currency is the thing §R removed: it leaves the document type names,
 * the party labels, the bank fields and the tax word unset, and every one of
 * those is harder to change later than the currency is. So this asks for the
 * country, pre-filled, and the currency follows from it.
 *
 * NO NEW REQUIRED FIELD (Rule #1). The name is the one answer that gates
 * `Save & continue`, and it is already §R's single required setup step — the
 * same validation `completeBusinessStep` applies. Every page can be left
 * entirely: "Explore the sample business" from the first, "Use sample
 * business for now" from the second, "Go to Home first" from the last.
 */

import type { DocumentType } from '../../domain/documents/types'

export type OnboardingPage = 'welcome' | 'business' | 'task' | 'ready'

/** The three the progress bar names; `welcome` sits before it and is not one. */
export const NUMBERED_PAGES: readonly OnboardingPage[] = ['business', 'task', 'ready']

export interface FlowState {
  readonly page: OnboardingPage
  readonly businessName: string
  /** Pre-filled from the phone, per §R; the currency follows from it. */
  readonly region: string
  readonly type: DocumentType
  /**
   * Set when somebody chose to look around instead of setting up. The flow is
   * over either way — what differs is whether a business was named.
   */
  readonly exploring: boolean
}

export class FlowError extends Error {}

export const startFlow = (region: string): FlowState => ({
  page: 'welcome',
  businessName: '',
  region,
  // §G's first tile and the reference's first choice. Not a guess about what
  // this person wants — a default they can change on the page that asks.
  type: 'invoice',
  exploring: false,
})

/** "Get started" — into the two answers §R actually requires. */
export const begin = (state: FlowState): FlowState => ({ ...state, page: 'business' })

/**
 * The name, and the country it will be read in.
 *
 * Refuses an empty name for the reason `completeBusinessStep` does: it prints
 * on every document, and a document headed by nothing is not a document. The
 * message is the same one, so a person who meets this twice meets one
 * sentence.
 */
export function saveBusiness(state: FlowState, name: string, region: string): FlowState {
  if (name.trim() === '') {
    throw new FlowError('A business name is needed — it prints on every document.')
  }
  return { ...state, businessName: name.trim(), region, page: 'task' }
}

/** "Use sample business for now" — §R's deferral, not a dead end. */
export const skipBusiness = (state: FlowState): FlowState => ({
  ...state,
  exploring: true,
  page: 'task',
})

export const pickType = (state: FlowState, type: DocumentType): FlowState => ({ ...state, type })

export const toReady = (state: FlowState): FlowState => ({ ...state, page: 'ready' })

/**
 * Back, which never leaves the flow by the front door.
 *
 * From the first page there is nowhere back to — the caller offers "explore"
 * instead. Returning `state` unchanged rather than throwing keeps a stray tap
 * on a hardware back button from being an error.
 */
export function back(state: FlowState): FlowState {
  const order: readonly OnboardingPage[] = ['welcome', 'business', 'task', 'ready']
  const at = order.indexOf(state.page)
  const previous = order[Math.max(0, at - 1)]
  return previous === undefined ? state : { ...state, page: previous }
}

/** 1-based, for "1. Your business" — `welcome` is before the count. */
export function stepNumber(page: OnboardingPage): number {
  const at = NUMBERED_PAGES.indexOf(page)
  return at === -1 ? 0 : at + 1
}

/**
 * Whether a person arriving at the app should be shown this at all.
 *
 * DERIVED, like the Home checklist and for the same reason: a company with no
 * name has not been set up, and that is a question about the company rather
 * than a record of whether a screen was shown. The dismissal is the one thing
 * that cannot be derived — somebody who chose to explore has answered, and
 * asking again on every launch would be the app forgetting.
 */
export function shouldOnboard(input: {
  readonly companyName: string | undefined
  readonly dismissed: boolean
  readonly documentCount: number
}): boolean {
  if (input.dismissed) return false
  // A document means they are already working; the checklist can carry the
  // rest. Onboarding somebody mid-use would be worse than never showing it.
  if (input.documentCount > 0) return false
  return (input.companyName ?? '').trim() === ''
}
