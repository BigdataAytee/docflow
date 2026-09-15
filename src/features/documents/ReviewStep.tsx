/**
 * Step 5 — Review (§G).
 *
 * "Full page at A4 proportions with an amber band listing anything missing;
 * each item links to its step; nothing typed is discarded."
 *
 * The band sits ABOVE the page rather than over it, so the document stays
 * readable while the list of what is missing is visible at the same time —
 * §G asks for both, and covering one with the other would defeat the point.
 */

import { useCompany } from '../../app/context'
import { composeDocument, type ComposableDocument, type ComposeOptions } from '../../pdf/compose'
import { paginate } from '../../pdf/paginate'
import { DocumentPage } from '../../pdf/DocumentPage'
import { templateById, type TemplateId } from '../../pdf/templates'
import { TYPE_PALETTE } from '../../ui'
import { formatMoney } from '../customers/formatMoney'
import { money } from '../../domain/money/money'
import type { IssueProblem } from './builder'
import { ReviewBand } from './ReviewBand'

export interface ReviewStepProps {
  readonly document: ComposableDocument
  readonly templateId: TemplateId
  readonly problems: readonly IssueProblem[]
  readonly onGoToStep: (step: number) => void
  /** §J: a payment problem is fixed in Settings, not at a step. */
  readonly onSetUpPayment?: () => void
  readonly brandColour?: string
  readonly composeOptions: Omit<ComposeOptions, 'profile'>
}

/** Rows that fit a page of the preview. Tuned per design in Phase 4 on device. */
const ROWS_PER_PAGE = 18
const FOOTER_ROW_COST = 4

export function ReviewStep({
  document,
  templateId,
  problems,
  onGoToStep,
  onSetUpPayment,
  brandColour,
  composeOptions,
}: ReviewStepProps) {
  const { profile, strings } = useCompany()

  const model = composeDocument(document, { ...composeOptions, profile })
  const pages = paginate(model, { rowsPerPage: ROWS_PER_PAGE, footerRowCost: FOOTER_ROW_COST })
  const template = templateById(templateId)
  const accent = brandColour ?? TYPE_PALETTE[document.type].accent

  return (
    <div className="space-y-4">
      {/* Above the page, never over it — both must be readable at once (§G). */}
      <ReviewBand
        problems={problems}
        onGoToStep={onGoToStep}
        {...(onSetUpPayment === undefined ? {} : { onSetUpPayment })}
      />

      <div className="space-y-4">
        {pages.map((page) => (
          <DocumentPage
            key={page.pageNumber}
            model={model}
            template={template}
            page={page}
            totalPages={pages.length}
            formatAmount={(minor, currency) => formatMoney(money(currency, minor))}
            currency={document.currency}
            accent={accent}
            continuedLabel={strings.common.next}
          />
        ))}
      </div>
    </div>
  )
}
