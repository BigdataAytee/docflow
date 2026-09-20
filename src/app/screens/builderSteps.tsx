/**
 * The five step bodies, chosen by index (§G).
 *
 * Split from `BuilderScreen` so that file stays about draft state and this one
 * stays about which step is on screen. Neither decides what a step is CALLED —
 * `stepNames` does, through the locale layer.
 */

import type { ReactNode } from 'react'

import type { Company, Customer } from '../../data/repositories'
import type { Payment } from '../../domain/payments/ledger'
import type { BilledInvoice } from '../../features/customers/balance'
import type { NewCustomer } from '../../features/customers/CustomerSheet'
import { type IssueProblem, type DocumentDraft, type StepIndex, stepKeysFor } from '../../features/documents/builder'
import { DetailsStep } from '../../features/documents/DetailsStep'
import { ItemsStep } from '../../features/documents/ItemsStep'
import { TotalsStep } from '../../features/documents/TotalsStep'
import { DesignStep } from '../../features/documents/DesignStep'
import { ReviewStep } from '../../features/documents/ReviewStep'
import type { ComposableDocument, ComposeOptions } from '../../pdf/compose'
import type { TemplateId } from '../../pdf/templates'
import { PPM, percentToPpm } from '../../domain/money/money'

/** §F's five brand colours, offered on the design step. */
export const BRAND_COLOURS = ['#2b3fd6', '#534AB7', '#0F6E56', '#BA7517', '#1d2452'] as const

export const percentOf = (ppm: number | undefined): number =>
  ppm === undefined ? 0 : (ppm / PPM) * 100

export interface StepBodyProps {
  readonly step: StepIndex
  readonly draft: DocumentDraft
  readonly company: Company | null
  readonly reference: string
  readonly templateId: TemplateId
  readonly showLogo: boolean
  readonly brandColour: string
  readonly discountPercent: number
  readonly taxLabel: string
  readonly problems: readonly IssueProblem[]
  /** §G step 2's per-line photo: stores the shrunk image, returns its id. */
  readonly onStoreItemPhoto?: (dataUrl: string) => Promise<string>
  /** The stored line photos, by asset id, so a row can draw the one it has. */
  readonly photoUrls?: Readonly<Record<string, string>>
  readonly composable: ComposableDocument
  readonly composeOptions: Omit<ComposeOptions, 'profile'>
  readonly customers: readonly Customer[]
  readonly invoices: readonly BilledInvoice[]
  readonly payments: readonly Payment[]
  readonly onChange: (patch: Partial<DocumentDraft>) => void
  readonly onAddCustomer: (customer: NewCustomer) => void
  readonly onDiscount: (percent: number) => void
  readonly onTemplate: (id: TemplateId) => void
  readonly onToggleLogo: (next: boolean) => void
  readonly onBrandColour: (colour: string) => void
  readonly onGoToStep: (step: number) => void
  readonly onSetUpPayment: () => void
  readonly onSign: () => void
  readonly signatureUrl?: string
  /** What a customer could actually pay through — links included (§J). */
  readonly paymentMethodCount: number
  /** Every currency §J defines, for §G's picker on the Details card. */
  readonly currencies: readonly string[]
  readonly onRememberItem: (item: { name: string; unitPriceMinor?: number; unit?: string }) => void
  /** §G: "a list icon jumps to Settings → Saved items". */
  readonly onOpenCatalogue: () => void
  readonly preview: ReactNode
}

export function StepBody(props: StepBodyProps) {
  /*
   * SWITCHED ON WHAT THE STEP IS, not on where it sits.
   *
   * This read the numeric index, which is correct only while every document
   * runs the same five. A receipt settling an invoice runs four — the items
   * were described on the invoice the customer holds — and by index alone
   * dropping one would slide Totals into the Items slot and render the wrong
   * body under the right heading.
   */
  switch (stepKeysFor(props.draft)[props.step] ?? 'review') {
    case 'details':
      return (
        <DetailsStep
          draft={props.draft}
          reference={props.reference}
          /*
           * COUNTED ONCE, by the screen that knows what this DOCUMENT has.
           *
           * This read `company.enabledPaymentMethods.length` directly, so a
           * payment link added on the invoice — printed on the page one tap
           * away — left the card still saying "Set up payment". The gate had
           * already been taught to count links; the chip beside it had not,
           * because it was working the number out for itself.
           */
          enabledPaymentMethodCount={props.paymentMethodCount}
          customers={props.customers}
          invoices={props.invoices}
          payments={props.payments}
          onChange={props.onChange}
          onAddCustomer={props.onAddCustomer}
          onSetUpPayment={props.onSetUpPayment}
          onSign={props.onSign}
          {...(props.signatureUrl === undefined ? {} : { signatureUrl: props.signatureUrl })}
          currencies={props.currencies}
        />
      )
    case 'items':
      return (
        <ItemsStep
          draft={props.draft}
          onChange={props.onChange}
          onRemember={props.onRememberItem}
          onOpenCatalogue={props.onOpenCatalogue}
          {...(props.onStoreItemPhoto === undefined
            ? {}
            : { onStorePhoto: props.onStoreItemPhoto })}
          {...(props.photoUrls === undefined ? {} : { photoUrls: props.photoUrls })}
        />
      )
    case 'totals':
      return (
        <TotalsStep
          draft={props.draft}
          discountPercent={props.discountPercent}
          taxPercent={percentOf(props.draft.taxRatePpm ?? props.company?.taxRatePpm)}
          whtPercent={percentOf(props.draft.whtRatePpm ?? props.company?.whtRatePpm)}
          taxLabel={props.taxLabel}
          onChange={props.onChange}
          onRates={(rates) => {
            if (rates.discountPercent !== undefined) props.onDiscount(rates.discountPercent)
            /*
             * ONTO THE DRAFT, never onto the company (§J).
             *
             * Settings is the only place the DEFAULT changes; this is a rate
             * for this document. Writing back would mean an owner adjusting
             * one invoice silently re-rated every future one — which is the
             * exact worry that kept these fields read-only, and the reason
             * the override lives on the document instead.
             */
            if (rates.taxPercent !== undefined) {
              props.onChange({ taxRatePpm: percentToPpm(rates.taxPercent) })
            }
            if (rates.whtPercent !== undefined) {
              props.onChange({ whtRatePpm: percentToPpm(rates.whtPercent) })
            }
          }}
        />
      )
    case 'design':
      return (
        <DesignStep
          // The pill and the chosen card take the DOCUMENT's colour, so the
          // design strip belongs to the thing being built (§F).
          type={props.draft.type}
          selected={props.templateId}
          showLogo={props.showLogo}
          brandColours={BRAND_COLOURS}
          brandColour={props.brandColour}
          onSelect={props.onTemplate}
          onToggleLogo={props.onToggleLogo}
          onBrandColour={props.onBrandColour}
          preview={props.preview}
        />
      )
    case 'review':
      return (
        <ReviewStep
          document={props.composable}
          templateId={props.templateId}
          problems={props.problems}
          onGoToStep={props.onGoToStep}
          onSetUpPayment={props.onSetUpPayment}
          brandColour={props.brandColour}
          composeOptions={props.composeOptions}
        />
      )
  }
}
