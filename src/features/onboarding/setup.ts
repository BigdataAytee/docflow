/**
 * Business setup (§R).
 *
 * "Company name, business country (pre-filled from the phone; sets terminology,
 * currency default, bank fields, tax label, date format in ONE confirmation —
 * replacing the bare currency default, ADDING NO NEW REQUIRED FIELD), plus the
 * minimum to create a document; logo, address, payment details and signature
 * each offer 'Do this later'; every completed step saves and resumes after
 * restart."
 *
 * Rule #1 in miniature: exactly two answers are required, and the country is
 * pre-filled so it costs a confirmation rather than a decision.
 */

import { regionProfile } from '../settings/region'

export type SetupStepId = 'business' | 'logo' | 'address' | 'payment' | 'signature'

/** §R is explicit: only these two are required. Everything else defers. */
export const REQUIRED_STEPS: readonly SetupStepId[] = ['business']

export const DEFERRABLE_STEPS: readonly SetupStepId[] = ['logo', 'address', 'payment', 'signature']

export interface SetupState {
  readonly companyName: string
  /** Pre-filled from the phone's region; the user confirms rather than picks. */
  readonly region: string
  readonly completed: readonly SetupStepId[]
  readonly deferred: readonly SetupStepId[]
}

export const emptySetup = (inferredRegion: string): SetupState => ({
  companyName: '',
  region: inferredRegion,
  completed: [],
  deferred: [],
})

export class SetupError extends Error {}

/** The business step: a name, and a country that was already filled in. */
export function completeBusinessStep(state: SetupState, companyName: string): SetupState {
  if (companyName.trim() === '') {
    throw new SetupError('A business name is needed — it prints on every document.')
  }
  // Throws for a market with no validated profile, rather than proceeding with
  // a currency and tax vocabulary nobody checked (§W).
  regionProfile(state.region)

  return {
    ...state,
    companyName: companyName.trim(),
    completed: [...new Set([...state.completed, 'business' as const])],
  }
}

/** "Do this later" — a first-class outcome, not a skipped step (§R). */
export function deferStep(state: SetupState, step: SetupStepId): SetupState {
  if (REQUIRED_STEPS.includes(step)) {
    throw new SetupError(`The ${step} step cannot be put off — nothing works without it.`)
  }
  return { ...state, deferred: [...new Set([...state.deferred, step])] }
}

export function completeStep(state: SetupState, step: SetupStepId): SetupState {
  return {
    ...state,
    completed: [...new Set([...state.completed, step])],
    // Completing something previously put off clears the deferral.
    deferred: state.deferred.filter((s) => s !== step),
  }
}

/** Setup is finished once the required steps are done — not all of them. */
export const isSetupComplete = (state: SetupState): boolean =>
  REQUIRED_STEPS.every((step) => state.completed.includes(step))

/**
 * Where to resume after a restart (§R: "every completed step saves and resumes
 * after restart"). Returns null when there is nothing left to offer.
 */
export function resumeAt(state: SetupState): SetupStepId | null {
  if (!state.completed.includes('business')) return 'business'
  const next = DEFERRABLE_STEPS.find(
    (step) => !state.completed.includes(step) && !state.deferred.includes(step),
  )
  return next ?? null
}
