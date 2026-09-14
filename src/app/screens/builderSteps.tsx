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
import type { IssueProblem, DocumentDraft, StepIndex } from '../../features/documents/builder'
import { DetailsStep } from '../../features/documents/DetailsStep'
import { ItemsStep } from '../../features/documents/ItemsStep'
import { TotalsStep } from '../../features/documents/TotalsStep'
import { DesignStep } from '../../features/documents/DesignStep'
import { ReviewStep } from '../../features/documents/ReviewStep'
import type { ComposableDocument, ComposeOptions } from '../../pdf/compose'
import type { TemplateId } from '../../pdf/templates'
import { PPM } from '../../domain/money/money'

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
  readonly onRememberItem: (item: { name: string; unitPriceMinor?: number }) => void
  /** §G: "a list icon jumps to Settings → Saved items". */
  readonly onOpenCatalogue: () => void
  readonly preview: ReactNode
}

export function StepBody(props: StepBodyProps) {
  switch (props.step) {
    case 0:
      return (
        <DetailsStep
          draft={props.draft}
          reference={props.reference}
          enabledPaymentMethodCount={props.company?.enabledPaymentMethods.length ?? 0}
          customers={props.customers}
          invoices={props.invoices}
          payments={props.payments}
          onChange={props.onChange}
          onAddCustomer={props.onAddCustomer}
          onSetUpPayment={props.onSetUpPayment}
          onSign={props.onSign}
          {...(props.signatureUrl === undefined ? {} : { signatureUrl: props.signatureUrl })}
        />
      )
    case 1:
      return (
        <ItemsStep
          draft={props.draft}
          onChange={props.onChange}
          onRemember={props.onRememberItem}
          onOpenCatalogue={props.onOpenCatalogue}
        />
      )
    case 2:
      return (
        <TotalsStep
          draft={props.draft}
          discountPercent={props.discountPercent}
          taxPercent={percentOf(props.company?.taxRatePpm)}
          whtPercent={percentOf(props.company?.whtRatePpm)}
          taxLabel={props.taxLabel}
          onChange={props.onChange}
          onRates={(rates) => {
            if (rates.discountPercent !== undefined) props.onDiscount(rates.discountPercent)
          }}
        />
      )
    case 3:
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
    case 4:
      return (
        <ReviewStep
          document={props.composable}
          templateId={props.templateId}
          problems={props.problems}
          onGoToStep={props.onGoToStep}
          brandColour={props.brandColour}
          composeOptions={props.composeOptions}
        />
      )
  }
}
