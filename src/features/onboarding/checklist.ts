/**
 * The Home checklist (§R).
 *
 * "Short, dismissible (business details, logo, payment, first document);
 * completing the underlying action ticks it automatically."
 *
 * Automatically is the load-bearing word: every item is DERIVED from the state
 * it describes, so there is no separate "done" flag to set, and no way for the
 * checklist to disagree with the app. Adding a logo in Settings ticks the logo
 * item because the item is a question about the logo, not a record of a tap.
 */

export type ChecklistItemId = 'business_details' | 'logo' | 'payment' | 'first_document'

export interface OnboardingState {
  readonly companyName: string
  readonly region: string
  readonly hasLogo: boolean
  readonly enabledPaymentMethodCount: number
  /** Real documents only — a sample never ticks this (§R). */
  readonly realDocumentCount: number
  readonly dismissed: boolean
}

export interface ChecklistItem {
  readonly id: ChecklistItemId
  readonly done: boolean
}

export function checklist(state: OnboardingState): ChecklistItem[] {
  return [
    {
      id: 'business_details',
      done: state.companyName.trim() !== '' && state.region.trim() !== '',
    },
    { id: 'logo', done: state.hasLogo },
    { id: 'payment', done: state.enabledPaymentMethodCount > 0 },
    { id: 'first_document', done: state.realDocumentCount > 0 },
  ]
}

/** §R: the checklist is short and dismissible, and disappears when finished. */
export function shouldShowChecklist(state: OnboardingState): boolean {
  if (state.dismissed) return false
  return checklist(state).some((item) => !item.done)
}

export const remainingCount = (state: OnboardingState): number =>
  checklist(state).filter((item) => !item.done).length
