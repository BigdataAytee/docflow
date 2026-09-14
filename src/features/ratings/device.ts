/**
 * Where the prompt's counters live (§T).
 *
 * Per DEVICE, never synced — the same rule as the theme choice, and for the
 * same reason: it is about this phone and the person holding it, not about
 * the company. Two people sharing a company share neither, so it goes nowhere
 * near the outbox.
 *
 * Every read and write is guarded. `localStorage` throws in a private window,
 * with site data blocked, and in a test environment that has none — and the
 * failure mode has to be "never asks" rather than "crashes on the screen
 * somebody was using". A prompt is the least important thing in this app.
 */

import { NEVER_ASKED, type PromptState } from '../../domain/ratings/prompt'

const KEY = 'docflow.ratings'

export function readPromptState(): PromptState {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (raw === null || raw === undefined || raw === '') return NEVER_ASKED

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return NEVER_ASKED

    const row = parsed as Record<string, unknown>
    const shares = typeof row.shares === 'number' && row.shares >= 0 ? row.shares : 0
    const asks = typeof row.asks === 'number' && row.asks >= 0 ? row.asks : 0
    // Anything else in storage is somebody else's key, or a shape from a
    // version that no longer exists. Read the fields, never trust the object.
    return typeof row.lastAskedAt === 'string'
      ? { shares, asks, lastAskedAt: row.lastAskedAt }
      : { shares, asks }
  } catch {
    return NEVER_ASKED
  }
}

export function writePromptState(state: PromptState): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(state))
  } catch {
    // Nothing to do and nothing worth saying: the prompt simply never fires
    // on a device that will not remember anything.
  }
}
