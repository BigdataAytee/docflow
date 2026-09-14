/**
 * The live preview above the design strip (§H).
 *
 * "Tapping a card re-renders the full preview instantly." The design step had
 * been passed `preview={null}` since it was written, so there was nothing to
 * re-render: sixteen designs, chosen blind, and the first sight of the choice
 * came a step later on Review.
 *
 * It is the FIRST page only. §H asks for a preview of the design, not a
 * readthrough of the document — and re-laying out a twelve-page invoice on
 * every tap of a thumbnail is the one way to make "instantly" untrue.
 *
 * The same `composeDocument` and the same `DocumentPage` as Review and as the
 * PDF, so what is previewed is what prints (Rule #5). A second renderer here
 * could disagree with the page that actually gets shared, which is the whole
 * class of bug §H's "one piece of state" clause exists to prevent.
 */

import { useCompany } from '../../app/context'
import { composeDocument, type ComposableDocument, type ComposeOptions } from '../../pdf/compose'
import { paginate } from '../../pdf/paginate'
import { DocumentPage } from '../../pdf/DocumentPage'
import { templateById, type TemplateId } from '../../pdf/templates'
import { TYPE_PALETTE } from '../../ui'
import { formatMoney } from '../customers/formatMoney'
import { money } from '../../domain/money/money'

export interface LivePreviewProps {
  readonly document: ComposableDocument
  readonly templateId: TemplateId
  readonly composeOptions: Omit<ComposeOptions, 'profile'>
  readonly brandColour?: string
  readonly logoNaturalSize?: { width: number; height: number }
}

/** Matches Review, so the preview breaks where the printed page breaks. */
const ROWS_PER_PAGE = 18
const FOOTER_ROW_COST = 4

export function LivePreview({
  document,
  templateId,
  composeOptions,
  brandColour,
  logoNaturalSize,
}: LivePreviewProps) {
  const { profile, strings } = useCompany()

  const model = composeDocument(document, { ...composeOptions, profile })
  const pages = paginate(model, { rowsPerPage: ROWS_PER_PAGE, footerRowCost: FOOTER_ROW_COST })
  const first = pages[0]
  if (first === undefined) return null

  return (
    <DocumentPage
      model={model}
      template={templateById(templateId)}
      page={first}
      totalPages={pages.length}
      formatAmount={(minor, currency) => formatMoney(money(currency, minor))}
      currency={document.currency}
      accent={brandColour ?? TYPE_PALETTE[document.type].accent}
      {...(logoNaturalSize === undefined ? {} : { logoNaturalSize })}
      continuedLabel={strings.common.next}
    />
  )
}
