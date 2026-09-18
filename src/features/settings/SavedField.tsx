/**
 * A Settings field that says whether it saved (§G, §N, Rule #1).
 *
 * Settings has always saved automatically and never said so. Every field was
 * `onChange={(v) => void actions.updateCompany({ ... })}` — the promise
 * DISCARDED — so:
 *
 *  · a save that landed and a save that failed looked identical, and
 *  · a failure took the typed value with it, because the input is fed from
 *    the company record and a failed write leaves that record unchanged.
 *
 * Somebody typed their business name, watched it vanish, and had no idea
 * whether the app or their typing was at fault.
 *
 * WHAT THE TICK MEANS, and it is the whole point: the repository accepted the
 * write. Not "the input changed" — that is what a per-keystroke tick would
 * mean, and it would be true even when nothing was stored. The state is
 * driven by the promise settling, so a tick is a fact about the database and
 * not about the keyboard.
 *
 * PER FIELD, not one banner. A floating "Saved" with no referent tells
 * somebody that SOMETHING saved; a mark beside the box they just left tells
 * them which. The wording matches the builder's "Draft saved automatically",
 * so the app makes one promise in one voice.
 */

import { useEffect, useRef, useState } from 'react'

import { useCompany } from '../../app/context'

/** Where a field is between typing and a stored value. */
export type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'failed'

export interface SavedFieldProps {
  readonly label: string
  /** The stored value. Wins whenever there is nothing unsaved in the box. */
  readonly value: string
  /**
   * Performs the write. MUST return the repository's promise — a handler that
   * returns void makes the tick a lie, because there is then nothing to wait
   * for and nothing that can reject.
   */
  readonly onCommit: (value: string) => Promise<unknown>
  readonly placeholder?: string
  readonly inputMode?: 'text' | 'email' | 'tel' | 'url'
  readonly autoComplete?: string
  readonly maxLength?: number
}

/**
 * How long after the last keystroke the write goes out.
 *
 * A write per keystroke is what the screen did before, and it makes the tick
 * useless: it would flicker on every letter and mean "the last character
 * reached the database", which nobody is asking. Blur alone would be too
 * late — an app killed mid-edit would lose the field — so it is both: a short
 * settle while typing, and immediately on leaving the box.
 */
const SETTLE_MS = 600

export function SavedField({
  label,
  value,
  onCommit,
  placeholder,
  inputMode = 'text',
  autoComplete,
  maxLength,
}: SavedFieldProps) {
  const { strings } = useCompany()
  const s = strings.settings

  const [local, setLocal] = useState(value)
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The value the last write was for, so a stale resolve cannot tick late. */
  const inFlight = useRef<string | null>(null)

  /*
   * THE STORED VALUE WINS ONLY WHEN THE BOX IS SETTLED.
   *
   * While something is being typed, is on its way, or has FAILED, the box
   * keeps what the person put in it. That last case is the one that matters:
   * a failed write leaves the company record unchanged, so syncing from it
   * would silently replace their typing with the old value — losing the edit
   * and the evidence at the same moment.
   */
  useEffect(() => {
    if (state === 'idle' || state === 'saved') setLocal(value)
  }, [value, state])

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  const commit = (next: string): void => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    // Nothing to do if this is already what is stored.
    if (next === value) {
      setState('idle')
      return
    }
    inFlight.current = next
    setState('saving')
    void onCommit(next)
      .then(() => {
        // A later edit has overtaken this one; its own write will report.
        if (inFlight.current !== next) return
        setState('saved')
      })
      .catch(() => {
        if (inFlight.current !== next) return
        setState('failed')
      })
  }

  const type = (next: string): void => {
    setLocal(next)
    setState('editing')
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => commit(next), SETTLE_MS)
  }

  return (
    <label className="block">
      {/*
        A DIV, not a span wrapping a span. The nested pair made the label's
        text match twice for anything reading the rendered document — the
        panel-order test counted ten headings where there are eight — and a
        flex row is a block anyway.
      */}
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium opacity-70">{label}</span>

        {/*
          THE MARK, beside the field it is about.

          `role="status"` so a screen reader hears the change without the
          focus moving — a visual tick tells somebody who can see it that the
          write landed, and this is the same fact for somebody who cannot.
          Nothing is announced while typing: "Saving…" on every letter would
          be noise, and it is not a fact about storage yet.
        */}
        <span
          role="status"
          aria-live="polite"
          data-save-state={state}
          className={`shrink-0 text-[10.5px] font-semibold ${
            state === 'failed' ? 'text-status-bad' : 'text-status-good'
          }`}
        >
          {state === 'saving' && s.savingField}
          {state === 'saved' && `✓ ${s.savedField}`}
          {state === 'failed' && s.saveFailed}
        </span>
      </div>

      <input
        value={local}
        onChange={(event) => type(event.target.value)}
        /* Leaving the box writes immediately — no reason to wait out the settle. */
        onBlur={() => commit(local)}
        aria-label={label}
        aria-invalid={state === 'failed'}
        {...(placeholder === undefined ? {} : { placeholder })}
        {...(inputMode === 'text' ? {} : { type: inputMode })}
        {...(autoComplete === undefined ? {} : { autoComplete })}
        {...(maxLength === undefined ? {} : { maxLength })}
        className="sunken min-h-tap w-full rounded-lg px-3 text-sm"
      />
    </label>
  )
}
