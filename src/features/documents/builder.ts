/**
 * The five-step builder (§G).
 *
 * Step names are per type and resolved through the locale layer, never written
 * here (Rule #5). This module owns the RULES: which steps exist, when you may
 * move, what "draft" permits, and what final issue demands.
 *
 * Two §G rules shape the whole design:
 *  · "Draft saving is always allowed." Validation never blocks a save, only an
 *    issue. Nothing typed is ever discarded to satisfy a rule.
 *  · Problems are returned as TOKENS, not sentences — the review screen's
 *    amber band resolves them into the active language, and each one carries
 *    the step it belongs to so it can link back (§G step 5).
 */

import type { DocumentType, LineItem } from '../../domain/documents/types'
import { carriesMoney } from '../../domain/documents/types'
import { type LocaleProfile, steps as localisedSteps } from '../../domain/locale/profile'

export const STEP_COUNT = 5
export type StepIndex = 0 | 1 | 2 | 3 | 4

/** The localised step names, in order, for this type (§G). */
export const stepNames = (profile: LocaleProfile, type: DocumentType): readonly string[] =>
  localisedSteps(profile, type)

export interface DocumentDraft {
  readonly type: DocumentType
  readonly currency: string
  readonly customerId?: string
  readonly lineItems: readonly LineItem[]
  readonly issueDate?: string
  readonly dueDate?: string
  readonly validUntil?: string
  readonly signatureAssetId?: string
  /** Receipts only: the payment this receipt is evidence of (§G, §K). */
  readonly paymentId?: string
  readonly linkedInvoiceId?: string
  /** Delivery documents only. */
  readonly deliveryAddress?: string
  readonly driverName?: string
  /**
   * The registration of whatever is carrying the goods (§G, §E).
   *
   * The column, the row mappers and the PDF have all carried this since
   * Phase 2; only the DRAFT was missing it, so §G's "deliveries get driver
   * and vehicle" was half true and the field could never be filled in.
   */
  readonly vehicleNumber?: string
  readonly dispatchDate?: string
  /** §E `expected_delivery_date` — when the goods should arrive. */
  readonly expectedDate?: string
}

export interface IssueContext {
  /** How many payment methods the company has switched on (§J). */
  readonly enabledPaymentMethodCount: number
  /** Whether `draft.paymentId` names a payment that actually exists (§K). */
  readonly paymentIsRecorded: boolean
  /** Company setting; §G validates "the signature requirement" at issue. */
  readonly signatureRequired: boolean
}

/** A token, not a sentence. The UI resolves the words (Rule #5). */
export interface IssueProblem {
  readonly step: StepIndex
  readonly field: string
}

const problem = (step: StepIndex, field: string): IssueProblem => ({ step, field })

/**
 * What still stands between this draft and issue (§G step 5).
 *
 * Empty means it may be issued. A non-empty list is the amber band — and the
 * draft stays exactly as typed either way.
 */
export function validateForIssue(
  draft: DocumentDraft,
  context: IssueContext,
): IssueProblem[] {
  const problems: IssueProblem[] = []

  // Step 1 — the party. Localised as Customer / Client / Deliver to (§G).
  if (draft.customerId === undefined || draft.customerId === '') {
    problems.push(problem(0, 'party'))
  }
  if (draft.issueDate === undefined || draft.issueDate === '') {
    problems.push(problem(0, 'issue_date'))
  }

  // Step 2 — items, or goods on a delivery document.
  if (draft.lineItems.length === 0) {
    problems.push(problem(1, 'line_items'))
  }
  for (const line of draft.lineItems) {
    if (line.description.trim() === '') problems.push(problem(1, 'line_description'))
    // A priced document needs prices; a delivery document must not have them.
    if (carriesMoney(draft.type) && line.unitPriceMinor === undefined) {
      problems.push(problem(1, 'line_price'))
    }
    if (!carriesMoney(draft.type) && line.unitPriceMinor !== undefined) {
      problems.push(problem(1, 'delivery_carries_no_money'))
    }
  }

  switch (draft.type) {
    case 'invoice':
      // §J: payment setup is enforced only at final invoice issuance.
      if (context.enabledPaymentMethodCount === 0) problems.push(problem(2, 'payment_method'))
      break

    case 'receipt':
      // §K: "Reject a receipt without an effective payment." A receipt is
      // evidence of money that moved, never the thing that moves it.
      if (draft.paymentId === undefined || !context.paymentIsRecorded) {
        problems.push(problem(0, 'recorded_payment'))
      }
      break

    case 'waybill':
      if (draft.deliveryAddress === undefined || draft.deliveryAddress.trim() === '') {
        problems.push(problem(0, 'delivery_address'))
      }
      if (draft.dispatchDate === undefined || draft.dispatchDate === '') {
        problems.push(problem(2, 'dispatch_date'))
      }
      break

    case 'quotation':
      // §J: quotations require no payment setup, ever.
      break
  }

  if (context.signatureRequired && (draft.signatureAssetId ?? '') === '') {
    problems.push(problem(0, 'signature'))
  }

  return problems
}

export const canIssue = (draft: DocumentDraft, context: IssueContext): boolean =>
  validateForIssue(draft, context).length === 0

/**
 * §G: "Draft saving is always allowed." There is no draft a user can type
 * themselves into that this module refuses to persist — a rejected save would
 * mean losing what they wrote, which Rule #1 does not permit.
 */
export const canSaveDraft = (): true => true

/** The problems belonging to one step, for that step's inline messages (§K). */
export const problemsForStep = (problems: readonly IssueProblem[], step: StepIndex) =>
  problems.filter((p) => p.step === step)

/** The first step that still has a problem — where "Fix this" should land. */
export function firstProblemStep(problems: readonly IssueProblem[]): StepIndex | null {
  const steps = problems.map((p) => p.step).sort((a, b) => a - b)
  return steps[0] ?? null
}

export interface BuilderState {
  readonly step: StepIndex
  readonly draft: DocumentDraft
  /** Edits not yet committed. Flushed on step change and on exit (§G). */
  readonly dirty: boolean
  /** Set once a commit succeeds; a failed commit must never show "Saved" (§C). */
  readonly lastSavedAt?: string
}

export const clampStep = (step: number): StepIndex =>
  Math.min(STEP_COUNT - 1, Math.max(0, Math.trunc(step))) as StepIndex

export const isLastStep = (step: StepIndex): boolean => step === STEP_COUNT - 1

/**
 * Moving between steps. Every step is reachable in both directions — the
 * review screen lists what is missing and links back to it, so a step is never
 * a gate. Changing step flushes pending edits (§G autosave).
 */
export function goToStep(state: BuilderState, target: number): BuilderState {
  const step = clampStep(target)
  if (step === state.step) return state
  return { ...state, step, dirty: state.dirty }
}

export const next = (state: BuilderState): BuilderState => goToStep(state, state.step + 1)
export const back = (state: BuilderState): BuilderState => goToStep(state, state.step - 1)

/** Editing always succeeds and always marks the draft dirty. */
export function edit(state: BuilderState, patch: Partial<DocumentDraft>): BuilderState {
  return { ...state, draft: { ...state.draft, ...patch, type: state.draft.type }, dirty: true }
}

/**
 * A commit landed. Only now may the UI show a saved state — §C: "A failed
 * commit must not show 'Saved'", which is why this is the only way to clear
 * `dirty` and it requires the timestamp of an actual write.
 */
export const committed = (state: BuilderState, at: string): BuilderState => ({
  ...state,
  dirty: false,
  lastSavedAt: at,
})

/** What the primary button does: "Next", or "Save {label}" on the last step. */
export const primaryAction = (step: StepIndex): 'next' | 'save' =>
  isLastStep(step) ? 'save' : 'next'
