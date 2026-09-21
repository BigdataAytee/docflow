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
import { printedLine, type SavedPaymentLink } from '../../domain/payments/links'
import { providersFor, type PaymentProvider } from '../../domain/payments/providers'
import { Icon } from '../../ui'
import { ProviderLogo } from './ProviderLogo'
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

  /**
   * ONE ROW, ONE TAP TARGET.
   *
   * The whole row is the button and it opens that method's fields — which is
   * what the reference does, and what a thumb expects from a row with a
   * chevron on the end. The on/off control moved INSIDE the form, where the
   * thing being switched is visible: two competing tap targets in a 56px row
   * is how somebody switches a method off while reaching for its details.
   *
   * Left to right: a 40px round badge, the name with one muted line under it,
   * the state in a word, a chevron.
   */
  const row = (provider: PaymentProvider) => {
    const value = saved.get(provider.id)
    const isOpen = open === provider.id
    const isOn = value !== undefined && enabled.includes(provider.id)

    const subtitle =
      value === undefined ? provider.blurb : printedLine({ provider: provider.id, value }).value
    const state =
      value === undefined
        ? strings.settings.methodAdd
        : isOn
          ? strings.settings.methodOn
          : strings.settings.methodOff

    return (
      <li key={provider.id}>
        <button
          type="button"
          aria-expanded={isOpen}
          /*
           * COMPOSED, not left to the DOM.
           *
           * The name a browser builds from these spans runs the words
           * together — "PaystackPaste your Paystack page linkAdd" — because
           * nothing between them is a space. Written out, it reads as three
           * facts: which service, what it holds, whether it prints.
           */
          aria-label={`${provider.name}. ${subtitle}. ${state}`}
          onClick={() => setOpen((current) => (current === provider.id ? null : provider.id))}
          className="flex w-full items-center gap-3 p-3 text-start"
        >
          <ProviderLogo provider={provider.id} name={provider.name} />

          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{provider.name}</span>
            {/*
              THE LIVE LINE once there is one — exactly as it prints, which is
              the rule §J gives the bank-transfer row. A stale link is visible
              here rather than discovered on an invoice already sent. Before
              there is one, the blurb says what this row will ask for.
            */}
            <span className="block truncate text-[11.5px] opacity-60">{subtitle}</span>
          </span>

          {/*
            THE STATE IN A WORD, not a control. Tapping it would be tapping
            the row, and the row opens the fields — so this reads rather than
            acts, and the switch itself lives where the account does.
          */}
          <span
            data-provider-state={provider.id}
            className={`shrink-0 text-xs font-semibold ${
              isOn ? 'text-status-good' : 'opacity-55'
            }`}
          >
            {state}
          </span>
          <Icon
            name="chevron-right"
            className={`size-[15px] shrink-0 opacity-35 ${isOpen ? 'rotate-90' : ''}`}
            aria-hidden
          />
        </button>

        {isOpen && (
          <PaymentLinkForm
            provider={provider.id}
            {...(value === undefined ? {} : { current: value })}
            country={country}
            /* The switch, beside the thing it switches (§J). */
            {...(value === undefined
              ? {}
              : {
                  enabled: enabled.includes(provider.id),
                  onToggle: (next: boolean) => onToggle(provider.id, next),
                })}
            onSave={(next) => put(provider, next)}
            onRemove={() => drop(provider)}
            onClose={() => setOpen(null)}
          />
        )}
      </li>
    )
  }

  /**
   * A HEADING AND A CARD, per group.
   *
   * §G's own pattern on this screen, and the reference's: a plain grey
   * heading over a rounded card of hairline-divided rows. Grouping is what
   * makes eleven rows scannable — "Payment links" is a different KIND of
   * answer from "Bank transfer", and a trader looking for one is not reading
   * the other.
   */
  const group = (heading: string, rows: readonly PaymentProvider[]) =>
    rows.length === 0 ? null : (
      <div className="space-y-1.5">
        <p className="px-1 text-xs font-bold uppercase tracking-wide opacity-55">{heading}</p>
        <ul className="glass-solid divide-y divide-ink/10 overflow-hidden rounded-2xl">
          {rows.map(row)}
        </ul>
      </div>
    )

  return (
    <div className="space-y-4">
      {group(strings.settings.paymentLinks, visible)}

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

      {showingOthers && group(strings.settings.otherServices, stillHidden)}
    </div>
  )
}
