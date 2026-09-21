/**
 * Pasting one payment link (§J, §K, Rule #1).
 *
 * The trader already has this link. It is in another app on the same phone,
 * two taps away, and every step between their clipboard and this field is a
 * step where they give up. So the form is one input, a Paste button and a
 * line showing what will print — and nothing else at all.
 *
 * WHY PASTE IS A BUTTON. Long-pressing a field on a phone, waiting for the
 * bubble, hitting a 40px "Paste" target and then fixing the cursor is four
 * chances to fail at the one moment the feature is being tried for the first
 * time. One tap instead. The field stays editable for anybody whose clipboard
 * the WebView will not hand over, which is a real case and gets said rather
 * than silently doing nothing (§N).
 *
 * WHAT PRINTS IS SHOWN WHILE THEY TYPE. `printedLine` is the same function
 * the composed page calls, so the line under the field is not a preview of
 * the line on the invoice — it is that line, rendered early.
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { normaliseProviderLink, printedLine } from '../../domain/payments/links'
import type { LinkProblem } from '../../domain/payments/links'
import { PROVIDERS, receivesIn } from '../../domain/payments/providers'
import type { ProviderId } from '../../domain/payments/providers'
import { countryName } from '../../domain/locale/data/countries'
import { Icon } from '../../ui'

export interface PaymentLinkFormProps {
  readonly provider: ProviderId
  /** What is already saved for it, when something is. */
  readonly current?: string
  /** Where the trader is, for the note on a provider that cannot receive. */
  readonly country: string
  /**
   * Whether this method PRINTS, and how to change it (§J).
   *
   * The switch lives here rather than on the row because the row is one tap
   * target that opens these fields — two competing targets in a 56px row is
   * how somebody switches a method off while reaching for its details. Beside
   * the account it governs is also simply where it means the most.
   *
   * Absent until there is something to switch: a provider with no link yet
   * has nothing to put on an invoice.
   */
  readonly enabled?: boolean
  readonly onToggle?: (next: boolean) => void
  readonly onSave: (value: string) => void
  readonly onRemove: () => void
  readonly onClose: () => void
}

export function PaymentLinkForm({
  provider: providerId,
  current,
  country,
  enabled,
  onToggle,
  onSave,
  onRemove,
  onClose,
}: PaymentLinkFormProps) {
  const { strings } = useCompany()
  const provider = PROVIDERS[providerId]
  const [typed, setTyped] = useState(current ?? '')
  const [problem, setProblem] = useState<LinkProblem | null>(null)
  const [clipboardRefused, setClipboardRefused] = useState(false)

  const result = typed.trim() === '' ? null : normaliseProviderLink(providerId, typed)
  const preview = result?.value === undefined ? null : printedLine({ provider: providerId, value: result.value })

  /** §K: said beside the field, and the input is never touched. */
  const message = (kind: LinkProblem): string => {
    switch (kind) {
      case 'not_this_provider':
        return format(strings.settings.linkNotThisProvider, { provider: provider.name })
      case 'no_handle':
        return format(strings.settings.linkNoHandle, { prefix: provider.prefix })
      case 'not_a_link':
        return strings.settings.linkNotALink
      default:
        return strings.settings.linkNotALink
    }
  }

  const paste = () => {
    setClipboardRefused(false)
    /*
     * A WebView may refuse this outright, and on some Android builds it
     * resolves with nothing at all. Both are SAID rather than swallowed: a
     * button that does nothing is the §N failure of a capability wired to
     * silence, and the field is still there to type into.
     */
    void navigator.clipboard
      ?.readText()
      .then((text) => {
        if (text.trim() === '') return setClipboardRefused(true)
        setTyped(text)
        setProblem(null)
      })
      .catch(() => setClipboardRefused(true))
  }

  const save = () => {
    if (typed.trim() === '') return onRemove()
    const outcome = normaliseProviderLink(providerId, typed)
    if (outcome.value === undefined) return setProblem(outcome.problem)
    setProblem(null)
    onSave(outcome.value)
    onClose()
  }

  return (
    <div className="space-y-2.5 border-t border-ink/10 p-4">
      {/*
        THE NOTE, when somebody has opened a provider that cannot take money
        where they are (§N). Inline and quiet: they reached this through "Use
        a different service", which means they had a reason, and the app's
        job is to tell them what it knows rather than to argue.
      */}
      {!receivesIn(provider, country) && (
        <p className="rounded-xl bg-status-warn-tint px-3 py-2 text-[11px] font-medium text-status-warn">
          {format(strings.settings.notInCountry, { country: countryName(country) })}
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-medium opacity-70">{provider.name}</span>
        <span className="flex gap-2">
          <input
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={typed}
            /* THE SHAPE, not a word about one. `paypal.me/yourname` says
               everything a sentence of instructions would. */
            placeholder={provider.sample}
            onChange={(event) => {
              setTyped(event.target.value)
              setProblem(null)
            }}
            onBlur={save}
            /*
              "Paystack link", not "Paystack": the On/Off chip on the row
              above is named for the provider, and two controls with one name
              is a screen reader reading the same word twice for two
              different things.
            */
            aria-label={format(strings.settings.linkField, { provider: provider.name })}
            aria-invalid={problem !== null}
            className="sunken min-h-tap w-full flex-1 rounded-lg px-3 text-sm"
          />
          <button
            type="button"
            onClick={paste}
            aria-label={strings.settings.pasteIt}
            className="glass-pill tap-scale flex min-h-tap shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-brand"
          >
            <Icon name="list" size={0.8} />
            {strings.settings.pasteIt}
          </button>
        </span>
      </label>

      {problem !== null && (
        <p className="text-[11px] font-medium text-status-warn" role="alert">
          {message(problem)}
        </p>
      )}
      {clipboardRefused && (
        <p className="text-[11px] font-medium text-status-warn" role="alert">
          {strings.settings.clipboardRefused}
        </p>
      )}

      {/*
        WHAT THEIR CUSTOMER WILL READ, while they are still looking at it —
        no document to generate, nothing to preview. It is the same call the
        composed page makes, so there is no second rendering to be wrong.
      */}
      {preview !== null && (
        <p className="text-[11px] opacity-70" data-link-preview>
          {strings.settings.thisPrints}{' '}
          <span className="font-mono font-medium opacity-100">
            {preview.label} — {preview.value}
          </span>
        </p>
      )}

      {/* One sentence, in the app. Never a help article, never a link out. */}
      {provider.findIt !== undefined && (
        <p className="text-[11px] opacity-55">{provider.findIt}</p>
      )}

      {/*
        THE SWITCH, BESIDE WHAT IT SWITCHES (§J).
        
        §J gives every method this: "each off until added … everything
        switched on prints in invoice payment instructions". A link that is
        saved and off is a link the trader KEEPS and does not print, and
        turning it off must never mean deleting it — pasting it again to turn
        it back on would be the app losing their work to save a boolean.
      */}
      {enabled !== undefined && onToggle !== undefined && (
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className="flex min-h-tap w-full items-center justify-between gap-3 rounded-xl bg-ink/[0.04] px-3 text-start text-xs font-medium"
        >
          {strings.settings.printOnInvoices}
          <span
            aria-hidden
            className={`grid h-6 w-10 shrink-0 items-center rounded-full px-0.5 motion-safe:transition-colors ${
              enabled ? 'bg-status-good' : 'bg-ink/20'
            }`}
          >
            <span
              className={`block size-5 rounded-full bg-surface motion-safe:transition-transform ${
                enabled ? 'translate-x-4' : ''
              }`}
            />
          </span>
        </button>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          className="raised tap-scale min-h-tap flex-1 rounded-xl bg-gradient-to-b from-brand-light to-brand px-4 text-sm font-semibold text-white"
        >
          {strings.settings.saveAccount}
        </button>
        {current !== undefined && (
          <button
            type="button"
            onClick={() => {
              onRemove()
              onClose()
            }}
            aria-label={format(strings.settings.removeLink, { provider: provider.name })}
            className="glass-pill min-h-tap min-w-tap shrink-0 rounded-xl px-3 text-status-warn"
          >
            <Icon name="trash" size={0.85} />
          </button>
        )}
      </div>
    </div>
  )
}
