/**
 * The payment links a trader is offered, and the ones they are not (§J, §N).
 *
 * WHAT A NIGERIAN TRADER SEES is Paystack and Flutterwave. What a German
 * trader sees is PayPal, Wise, Revolut and Stripe. Neither is asked to pick a
 * region for this — the app already detected one to set up the business with
 * — and neither is shown a service that cannot receive money where they are.
 * No popup, no warning, no selector: the wrong options are simply not there.
 *
 * AND NOTHING IS LOCKED AWAY, which is the harder half. One quiet line opens
 * the whole list plus "Other link", because a trader holding an account
 * somewhere else is a real trader and an automatic choice is a default rather
 * than a gate. Anything reached that way carries a note if the table says it
 * cannot receive in their country — told, not argued with.
 *
 * The country list that shipped with thirteen entries is the lesson being
 * applied here deliberately: detection that cannot be overridden is a bug
 * waiting for the first person it is wrong about.
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { printedLine, type SavedPaymentLink } from '../../domain/payments/links'
import { providersFor, type PaymentProvider } from '../../domain/payments/providers'
import { Icon } from '../../ui'
import { PaymentLinkForm } from './PaymentLinkForm'

export interface PaymentLinkSectionProps {
  /** Where the trader is — the detected region, not a question they answered. */
  readonly country: string
  readonly links: readonly SavedPaymentLink[]
  readonly onChange: (links: readonly SavedPaymentLink[]) => void
  /**
   * Which providers are switched ON, and therefore print (§J).
   *
   * SAVED AND ON ARE TWO DIFFERENT THINGS. A trader who has pasted their
   * PayPal link has not necessarily decided every invoice should carry it —
   * §J's whole list works this way ("each off until added"), and the row's
   * own chip is where that is said. Switching one off keeps the link: it is
   * still theirs, and having to paste it again to turn it back on would be
   * the app losing their work to save a boolean.
   */
  readonly enabled: readonly string[]
  readonly onToggle: (provider: string, next: boolean) => void
}

export function PaymentLinkSection({
  country,
  links,
  onChange,
  enabled,
  onToggle,
}: PaymentLinkSectionProps) {
  const { strings } = useCompany()
  const [open, setOpen] = useState<string | null>(null)
  const [showingOthers, setShowingOthers] = useState(false)

  const { offered, others } = providersFor(country)
  const saved = new Map(links.map((link) => [link.provider, link.value]))

  /*
   * SAVED ONES ARE ALWAYS SHOWN, wherever they came from.
   *
   * A trader who added PayPal from "Use a different service" last month must
   * not have it disappear behind that line the next time they open Settings —
   * what they have set up is theirs, and hiding it would look like losing it.
   */
  const fromOthers = others.filter((provider) => saved.has(provider.id))
  const visible = [...offered, ...fromOthers]
  const stillHidden = others.filter((provider) => !saved.has(provider.id))

  const put = (provider: PaymentProvider, value: string) => {
    onChange([
      ...links.filter((link) => link.provider !== provider.id),
      { provider: provider.id, value },
    ])
    /*
     * PASTING ONE SWITCHES IT ON. Somebody who went and found their PayPal
     * link wants it used; leaving it saved-but-off would be a second step
     * for a decision they already made by doing the first.
     */
    if (!enabled.includes(provider.id)) onToggle(provider.id, true)
  }

  const drop = (provider: PaymentProvider) =>
    onChange(links.filter((link) => link.provider !== provider.id))

  const row = (provider: PaymentProvider) => {
    const value = saved.get(provider.id)
    return (
      <li key={provider.id}>
        <div className="flex items-center gap-3 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Icon name="credit-card" className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{provider.name}</span>
            {/*
              THE LIVE LINE, exactly as it prints — the same rule §J gives the
              bank-transfer row. A stale link is visible here rather than
              discovered on an invoice already sent.
            */}
            <span className="block truncate text-xs opacity-65">
              {value === undefined
                ? provider.sample
                : printedLine({ provider: provider.id, value }).value}
            </span>
          </span>
          {/*
            TWO CONTROLS ONCE THERE IS A LINK, and they do different things.

            The pencil opens what was pasted; the chip decides whether it
            PRINTS. Both were one button, so "On" meant "has a value" and a
            trader had no way to keep a link without putting it on every
            invoice — they would have had to delete it and paste it back.

            Before there is a link there is only one thing to do, so there is
            only one control: Add.
          */}
          {value !== undefined && (
            <button
              type="button"
              aria-expanded={open === provider.id}
              aria-label={format(strings.settings.editLink, { provider: provider.name })}
              onClick={() => setOpen((current) => (current === provider.id ? null : provider.id))}
              className="glass-pill min-h-tap min-w-tap shrink-0 rounded-full px-2 text-brand"
            >
              <Icon name="pencil" className="size-[15px]" />
            </button>
          )}
          <button
            type="button"
            {...(value === undefined
              ? { 'aria-expanded': open === provider.id }
              : { 'aria-pressed': enabled.includes(provider.id) })}
            aria-label={
              value === undefined
                ? format(strings.settings.addLink, { provider: provider.name })
                : provider.name
            }
            onClick={() => {
              if (value === undefined) {
                return setOpen((current) => (current === provider.id ? null : provider.id))
              }
              onToggle(provider.id, !enabled.includes(provider.id))
            }}
            className={`min-h-tap shrink-0 rounded-full px-3 text-xs font-semibold ${
              value !== undefined && enabled.includes(provider.id)
                ? 'bg-status-good-tint text-status-good'
                : 'glass-pill text-brand'
            }`}
          >
            {value === undefined
              ? strings.settings.methodAdd
              : enabled.includes(provider.id)
                ? strings.settings.methodOn
                : strings.settings.methodOff}
          </button>
        </div>

        {open === provider.id && (
          <PaymentLinkForm
            provider={provider.id}
            {...(value === undefined ? {} : { current: value })}
            country={country}
            onSave={(next) => put(provider, next)}
            onRemove={() => drop(provider)}
            onClose={() => setOpen(null)}
          />
        )}
      </li>
    )
  }

  return (
    <>
      <p className="px-1 text-xs font-bold uppercase tracking-wide opacity-60">
        {strings.settings.paymentLinks}
      </p>

      {visible.length > 0 && (
        <ul className="glass-solid divide-y divide-ink/10 overflow-hidden rounded-2xl">
          {visible.map(row)}
        </ul>
      )}

      {/*
        THE QUIET LINE. A text button, not a card and not a chevron row:
        almost nobody needs it, and the ones who do are looking for it.
      */}
      <button
        type="button"
        aria-expanded={showingOthers}
        onClick={() => setShowingOthers((shown) => !shown)}
        className="min-h-tap px-1 text-xs font-semibold text-brand underline"
      >
        {showingOthers ? strings.settings.hideAnother : strings.settings.useAnother}
      </button>

      {showingOthers && stillHidden.length > 0 && (
        <ul className="glass-solid divide-y divide-ink/10 overflow-hidden rounded-2xl">
          {stillHidden.map(row)}
        </ul>
      )}
    </>
  )
}
