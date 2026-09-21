/**
 * Path A, on one page (§G, §K, Rule #1).
 *
 * THE WHOLE JOURNEY IS: pick who paid, pick which bill, and then THIS — one
 * screen with everything on it, ending in a receipt. No Items step, because
 * the invoice already described the goods. No Design step, because nobody
 * choosing a template is recording money. No Review step, because the preview
 * is on the page and updates as the amount is typed: the thing being inspected
 * IS the thing being signed, which a separate Review step cannot promise.
 *
 * WHAT IT ASKS FOR, and it is four things, three of them already answered:
 *
 *  · the amount — prefilled with the whole balance, because paying in full is
 *    the common case and should cost no typing;
 *  · the date — today;
 *  · the method — the business's default;
 *  · the signature — the only thing nobody can prefill.
 *
 * ONE BUTTON. It writes the payment and issues the receipt, in that order and
 * without asking again (§V: the receipt is evidence of the payment, so the
 * payment can never be the thing that waits). What comes back is the PDF.
 */

import { type ReactNode, useId, useState } from 'react'

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { labelInSentence as typeInSentence } from '../../domain/locale/profile'
import { type Money, money } from '../../domain/money/money'
import { parseAmount } from '../../domain/money/parse'
import { minorUnitsFor } from '../../domain/locale/bank-fields'
import { formatMoney } from '../customers/formatMoney'
import { SignaturePad } from '../signature/SignaturePad'
import type { SettleableInvoice } from './receiptFlow'

export interface PayInvoiceProps {
  readonly payerName: string
  readonly invoice: SettleableInvoice
  readonly currency: string
  readonly today: string
  /** §J's enabled methods, already named in the active language. */
  readonly methods: readonly { id: string; name: string }[]
  /**
   * The receipt as it would print at this amount.
   *
   * A RENDER PROP rather than a composed page passed in, because the preview
   * has to move when the amount does — that is the point of it being on this
   * screen. The caller owns composition (§H's one piece of state); this screen
   * owns the figure, and hands it over on every keystroke.
   */
  readonly renderPreview: (state: {
    readonly amountMinor: number
    readonly paidAt: string
    readonly method: string
  }) => ReactNode
  /** The mark, once it has been stored. Absent until somebody signs. */
  readonly signatureUrl?: string
  readonly onDrawSignature: (drawn: { svg: string; dataUrl: string }) => void
  readonly onUseDefaultSignature?: () => void
  readonly signatureError?: string
  readonly onRecord: (input: {
    amount: Money
    paidAt: string
    method: string
    reference?: string
  }) => void
  readonly onBack: () => void
  readonly error?: string
}

/**
 * Minor units back into what a person would type.
 *
 * Integer arithmetic both ways (Rule #3): the amount is split by the
 * currency's own scale rather than divided as a float and rounded back. No
 * trailing zeros on a whole amount — nobody types them, and offering them
 * back makes a prefilled answer look like a calculation.
 */
export function majorFor(amount: Money): string {
  const scale = minorUnitsFor(amount.currency)
  const whole = Math.trunc(amount.minor / scale)
  const rest = amount.minor - whole * scale
  return rest === 0
    ? String(whole)
    : `${whole}.${String(rest).padStart(String(scale).length - 1, '0')}`
}

export function PayInvoice({
  payerName,
  invoice,
  currency,
  today,
  methods,
  renderPreview,
  signatureUrl,
  onDrawSignature,
  onUseDefaultSignature,
  signatureError,
  onRecord,
  onBack,
  error,
}: PayInvoiceProps): ReactNode {
  const { profile, strings } = useCompany()
  const r = strings.newReceipt
  const ids = useId()

  // PREFILLED WITH THE WHOLE BALANCE. Paying in full is the common case and
  // the app already knows the figure, so it costs no typing (Rule #1).
  const [major, setMajor] = useState(() => majorFor(invoice.outstanding))
  const [paidAt, setPaidAt] = useState(today)
  const [method, setMethod] = useState(methods[0]?.id ?? 'cash')
  const [reference, setReference] = useState('')
  const [showReference, setShowReference] = useState(false)
  const [signing, setSigning] = useState(false)

  /*
   * Through the domain parser, never `parseFloat`: a blank must not become
   * zero money and a grouped figure must not lose everything after the comma
   * (Rule #3). `null` is "not an amount", which is a different thing from an
   * amount of nothing.
   */
  const parsed = parseAmount(major, { scale: minorUnitsFor(currency) })
  const minor = parsed ?? 0
  const overpaying = minor > invoice.outstanding.minor
  const remaining = Math.max(0, invoice.outstanding.minor - minor)

  return (
    <section className="glass-solid rounded-2xl p-4" aria-label={r.title}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{r.title}</h2>
        <button
          type="button"
          onClick={onBack}
          className="min-h-tap shrink-0 text-[13px] font-semibold text-brand-ink"
        >
          {strings.common.back}
        </button>
      </div>

      {/*
        WHO PAID AND WHICH BILL, AS A LINE — not two controls to re-answer.
        Both were chosen on the way here, and offering them again would invite
        somebody to change one of them after the amount was worked out from it.
      */}
      <p data-paying-line className="mt-1.5 text-[13px] font-medium leading-snug">
        {format(r.payingLine, {
          name: payerName,
          label: typeInSentence(profile, 'invoice'),
          reference: invoice.reference,
        })}
      </p>

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-amount`}>
        {r.amount}
      </label>
      <input
        id={`${ids}-amount`}
        className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-lg tabular-nums"
        inputMode="decimal"
        value={major}
        onChange={(event) => setMajor(event.target.value)}
      />
      {/*
        WHAT THIS AMOUNT LEAVES, said the moment it is typed rather than
        discovered on the printed receipt. An overpayment is SAID too (§N) —
        it becomes customer credit (§K), and somebody who mistyped a nought
        should find that out here and not from the customer.
      */}
      <p data-leaves className="mt-1 text-[11.5px] opacity-70">
        {overpaying
          ? format(r.overpayingNote, {
              amount: formatMoney(money(currency, minor - invoice.outstanding.minor)),
            })
          : remaining === 0
            ? r.clearsIt
            : format(r.leavesOwing, { amount: formatMoney(money(currency, remaining)) })}
      </p>

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-when`}>
        {r.datePaid}
      </label>
      <input
        id={`${ids}-when`}
        type="date"
        className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
        value={paidAt}
        onChange={(event) => setPaidAt(event.target.value)}
      />

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-how`}>
        {r.method}
      </label>
      <select
        id={`${ids}-how`}
        className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
        value={method}
        onChange={(event) => setMethod(event.target.value)}
      >
        {methods.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>

      {showReference ? (
        <>
          <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-ref`}>
            {r.reference}
          </label>
          <input
            id={`${ids}-ref`}
            aria-label={r.reference}
            className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setShowReference(true)}
          className="mt-3 min-h-tap text-[12.5px] font-semibold text-brand-ink"
        >
          {r.addReference}
        </button>
      )}

      {/*
        THE PREVIEW, ON THE SAME PAGE AND MOVING WITH THE AMOUNT.

        This is what replaces a Review step. A separate Review would show the
        document after the decisions were locked; this shows it WHILE they are
        being made, so the figure somebody signs under is one they watched
        change.
      */}
      <div data-live-preview className="mt-4 overflow-hidden rounded-xl border border-edge/10">
        {renderPreview({ amountMinor: minor, paidAt, method })}
      </div>

      {/*
        THE SIGNATURE, HERE — not a screen further on. Signing after a preview
        on another page would mean the thing inspected is not the thing signed.
      */}
      {signatureUrl === undefined ? (
        signing ? (
          <div className="mt-3">
            <SignaturePad
              onClose={() => setSigning(false)}
              {...(signatureError === undefined ? {} : { error: signatureError })}
              {...(onUseDefaultSignature === undefined
                ? {}
                : { onUseDefault: onUseDefaultSignature })}
              onUse={onDrawSignature}
            />
          </div>
        ) : (
          <button
            type="button"
            data-sign
            onClick={() => setSigning(true)}
            className="mt-3 min-h-tap w-full rounded-xl border border-dashed border-edge/30 px-3 text-[13px] font-semibold opacity-75"
          >
            {strings.signature.signHere}
          </button>
        )
      ) : (
        <p data-signed className="mt-3 flex items-center gap-2 text-[12.5px] font-semibold">
          <img src={signatureUrl} alt={strings.signature.drawn} className="h-8" />
          <span className="text-status-good">{`✓ ${strings.signature.drawn}`}</span>
        </p>
      )}

      {/*
        ONE BUTTON, and it does the whole thing: writes the payment, issues
        the receipt, shows the PDF. Nothing after it asks anything.
      */}
      <button
        type="button"
        data-record
        className="raised tap-scale mt-4 min-h-tap w-full rounded-xl bg-gradient-to-b from-brand-light to-brand px-4 text-sm font-semibold text-white disabled:opacity-70"
        disabled={minor <= 0}
        onClick={() =>
          onRecord({
            amount: money(currency, minor),
            paidAt,
            method,
            ...(reference.trim() === '' ? {} : { reference: reference.trim() }),
          })
        }
      >
        {r.recordPayment}
      </button>

      {error !== undefined && (
        <p
          className="mt-3 rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm font-medium text-status-warn"
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  )
}
