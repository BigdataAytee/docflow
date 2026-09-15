/**
 * The page renderer (§I), at A4 proportions.
 *
 * It draws a PageModel under a TemplateDefinition and knows nothing about
 * document types: every per-type decision was already made in
 * `composeDocument`, which is why a delivery document renders without money
 * here without this file containing a single branch about it.
 */

import { type CSSProperties, useEffect, useState } from 'react'

import type { PageModel, TableRow } from './compose'
import type { PrintPage } from './paginate'
import type { TemplateDefinition } from './templates'
import { LOGO_SCALE, fitLogo } from './logo'
import { DocumentHeader, PageChrome, contentInset, headerCarriesParty } from './DocumentHeader'

/** A4 portrait: 210 × 297 mm. */
export const A4_ASPECT = 210 / 297

const FONT_STACK: Record<TemplateDefinition['fontFamily'], string> = {
  sans: '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  'serif-display': '"Plus Jakarta Sans", Georgia, serif',
}

export interface DocumentPageProps {
  readonly model: PageModel
  readonly template: TemplateDefinition
  readonly page: PrintPage
  readonly totalPages: number
  /** Resolved amounts, formatted by the caller through the locale layer. */
  readonly formatAmount: (minor: number, currency: string) => string
  readonly currency: string
  readonly accent: string
  readonly continuedLabel?: string
}

/**
 * The logo, in its white square (§F, §I).
 *
 * "White rounded square with a thin inner margin; the logo scales to touch
 * the margin — square nearly fills, wide spans width, tall runs height —
 * NEVER CROPPED." `fitLogo` is that rule, property-tested; this draws what it
 * returns.
 *
 * THE NATURAL SIZE IS MEASURED HERE rather than passed in. It used to be a
 * prop — `logoNaturalSize`, threaded through LivePreview and ReviewStep — and
 * no caller ever supplied one, so the branch that drew the mark could not be
 * reached and every header printed an empty square. Measuring where the
 * drawing happens leaves nothing to forget.
 *
 * The holder is drawn BEFORE the image resolves, and before a logo exists at
 * all, so the header does not jump when one is added.
 */
function LogoHolder({
  size,
  url,
}: {
  size: PageModel['branding']['logoSize']
  url?: string | undefined
}) {
  const holderSide = 96 * LOGO_SCALE[size]
  const holder = { width: holderSide, height: holderSide }
  const margin = holderSide * 0.06
  const natural = useImageSize(url)

  const fit = natural === null ? null : fitLogo(natural, holder, margin)

  return (
    <div
      className="relative shrink-0 rounded-xl bg-white"
      style={{ width: holderSide, height: holderSide }}
      aria-hidden="true"
    >
      {fit !== null && url !== undefined && (
        <img
          src={url}
          alt=""
          className="absolute"
          style={{ left: fit.left, top: fit.top, width: fit.width, height: fit.height }}
        />
      )}
    </div>
  )
}

/**
 * A data URL's own pixel dimensions.
 *
 * `fitLogo` needs them and nothing else does. Null until the image decodes,
 * and null again if it cannot be decoded — a logo that will not load leaves
 * an empty holder rather than a broken-image glyph on a document somebody is
 * about to send to a customer.
 */
function useImageSize(url: string | undefined): { width: number; height: number } | null {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    setSize(null)
    if (url === undefined || typeof Image === 'undefined') return undefined

    let live = true
    const image = new Image()
    image.onload = () => {
      if (live && image.naturalWidth > 0 && image.naturalHeight > 0) {
        setSize({ width: image.naturalWidth, height: image.naturalHeight })
      }
    }
    image.src = url
    return () => {
      live = false
    }
  }, [url])

  return size
}

function Cell({ row, column, formatAmount, currency }: {
  row: TableRow
  column: PageModel['columns'][number]
  formatAmount: DocumentPageProps['formatAmount']
  currency: string
}) {
  const style: CSSProperties = { textAlign: column.align }
  switch (column.key) {
    case 'description':
      return <td style={style} className="py-[6px] pe-[8px]">{row.description}</td>
    case 'quantity':
      return <td style={style} className="py-[6px] tabular-nums">{row.quantity}</td>
    case 'unit':
      return <td style={style} className="py-[6px]">{row.unit ?? ''}</td>
    case 'amount':
      // Absent on a delivery document — composeDocument never emits the column.
      return (
        <td style={style} className="py-[6px] tabular-nums">
          {row.amount === undefined ? '' : formatAmount(row.amount.minor, currency)}
        </td>
      )
  }
}

export function DocumentPage({
  model,
  template,
  page,
  totalPages,
  formatAmount,
  currency,
  accent,
  continuedLabel,
}: DocumentPageProps) {
  const ink = template.usesBrandAccent ? accent : template.ink

  return (
    <article
      className="relative mx-auto w-full overflow-hidden"
      style={{
        aspectRatio: String(A4_ASPECT),
        /*
         * THE PAGE IS A PICTURE OF PAPER, so it sets its own base and every
         * size inside it is absolute.
         *
         * Everything here used to be Tailwind's rem scale, which resolves
         * against the ROOT font size — so at the 200% text setting every
         * accessibility guide asks for, the type and the spacing doubled
         * while the A4 box did not, and the invoice clipped its own table.
         * The large-text sweep caught it; one more clause in that sweep's
         * decoration exemption would have silenced it instead, since the
         * preview is aria-hidden on the document screen.
         *
         * A printed page does not reflow because a phone's text setting
         * changed — the PDF is the same PDF — and the screen around this one
         * still scales normally, which is where a person reads. The document
         * screen presents everything this page says in accessible form.
         */
        fontSize: '16px',
        backgroundColor: template.paper,
        color: template.ink,
        fontFamily: FONT_STACK[template.fontFamily],
      }}
      aria-label={`${model.title} ${model.reference}`}
    >
      {/*
        The chrome sits BEHIND the content — a column, a spine, a wave, a
        frame — and the content stands clear of it by `contentInset`. Both
        come from the template definition, so a design is one entry in
        `templates.ts` and never a branch here (§H).
      */}
      <PageChrome template={template} ink={ink} />

      <div
        className="relative flex h-full flex-col p-[6%]"
        style={contentInset(template)}
      >
        <DocumentHeader
          model={model}
          template={template}
          ink={ink}
          logo={
            model.branding.showLogo ? (
              <LogoHolder
                size={model.branding.logoSize}
                url={model.branding.logoUrl}
              />
            ) : null
          }
        />

        {/* Compact's strip already carries these — see `headerCarriesParty`. */}
        {!headerCarriesParty(template) && (
        <section className="mt-[16px] flex justify-between gap-[24px] text-[12px]">
          <div className="min-w-0">
            <p className="font-bold uppercase tracking-wide opacity-60">{model.partyLabel}</p>
            <p className="font-semibold">{model.party.name}</p>
            {model.party.address !== undefined && <p className="opacity-80">{model.party.address}</p>}
          </div>
          <div className="shrink-0 text-end">
            <p className="tabular-nums">{model.issueDate}</p>
            {model.dueDate !== undefined && <p className="tabular-nums opacity-70">{model.dueDate}</p>}
          </div>
        </section>
        )}

        <table className="mt-[16px] w-full border-collapse text-[12px]">
          {/* Repeated on every page (§I). */}
          <thead>
            <tr style={{ borderBottom: `1px solid ${ink}` }}>
              {model.columns.map((column) => (
                <th key={column.key} style={{ textAlign: column.align }} className="pb-[4px] font-bold uppercase tracking-wide">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row, index) => (
              <tr key={`${row.description}-${index}`} className="border-b border-current/10">
                {model.columns.map((column) => (
                  <Cell
                    key={column.key}
                    row={row}
                    column={column}
                    formatAmount={formatAmount}
                    currency={currency}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {page.continued && continuedLabel !== undefined && (
          <p className="mt-[8px] text-[10px] italic opacity-60">{continuedLabel}</p>
        )}

        {page.showsFooter && (
          <>
            {model.totals !== null && (
              <section
                className="mt-[12px] self-end text-[12px]"
                style={{ width: `${model.totalsWidthPercent}%` }}
              >
                <Line label="" value={formatAmount(model.totals.subtotal.minor, currency)} />
                {model.totals.tax.minor !== 0 && (
                  <Line label="" value={formatAmount(model.totals.tax.minor, currency)} />
                )}
                {model.totals.wht.minor !== 0 && (
                  <Line label="" value={`−${formatAmount(model.totals.wht.minor, currency)}`} />
                )}
                <div className="mt-[4px] border-t-2 pt-[4px]" style={{ borderColor: ink }}>
                  <div className="flex justify-between text-[14px] font-black" style={{ color: ink }}>
                    <span>{model.totalsLabel ?? ''}</span>
                    <span className="tabular-nums">
                      {formatAmount(model.totals.payable.minor, currency)}
                    </span>
                  </div>
                </div>
              </section>
            )}

            <footer className="mt-auto flex items-end justify-between gap-[24px] pt-[16px] text-[10px]">
              {/* §I: the payment box is inline beside the signature, never a
                  full-width band — and a delivery document has none at all. */}
              {model.paymentBox !== null && (
                <div style={{ maxWidth: `${model.paymentBox.maxWidthPercent}%` }}>
                  <p className="font-bold uppercase tracking-wide" style={{ color: ink }}>
                    {model.paymentBox.heading}
                  </p>
                  <dl className="mt-[4px]">
                    {model.paymentBox.rows.map((row) => (
                      <div key={row.label} className="flex gap-[8px]">
                        <dt className="w-[96px] shrink-0 opacity-60">{row.label}</dt>
                        <dd className="font-medium">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {/*
                    §I: "online methods under a DASHED DIVIDER labelled 'Other
                    payment methods', cash listed separately".

                    Built and never drawn, like the receipt's evidence before
                    it: `otherMethods` has been on the composed box since it
                    was written, nothing supplied one and nothing read one, so
                    an owner could switch a method on in Settings and it
                    printed nowhere. Turning something on and seeing no change
                    on the document is the toggle that lies.
                  */}
                  {model.paymentBox.otherMethods.length > 0 && (
                    <div className="mt-[6px] pt-[6px]" style={{ borderTop: `1px dashed ${ink}` }}>
                      <p className="font-bold uppercase tracking-wide opacity-60">
                        {model.paymentBox.otherMethodsLabel}
                      </p>
                      <p className="font-medium">{model.paymentBox.otherMethods.join(' · ')}</p>
                    </div>
                  )}
                </div>
              )}

              {/*
                A RECEIPT'S EVIDENCE, in the slot an invoice gives to HOW TO
                PAY (§I, §K).

                The reference sends every non-delivery type through that one
                footer slot — `cur==='way' ? RECEIVED BY : PAYBOX()` — so this
                takes it rather than inventing a position. §E line 190 is what
                it must say: "receipts show date paid, linked invoice, method
                + reference".

                It was BUILT and never drawn. `compose` has returned a
                `receiptEvidence` since it was written and no page ever read
                one, so every printed receipt was missing the three facts that
                make it a receipt. Found by the declared-field sweep, which
                exists because this kept happening.
              */}
              {model.receiptEvidence !== null && (
                <div style={{ maxWidth: '60%' }}>
                  <p className="font-bold uppercase tracking-wide" style={{ color: ink }}>
                    {model.receiptEvidence.heading}
                  </p>
                  <p className="mt-[4px] text-[14px] font-black tabular-nums">
                    {formatAmount(model.receiptEvidence.amount.minor, model.receiptEvidence.amount.currency)}
                  </p>
                  <dl className="mt-[4px]">
                    <div className="flex gap-[8px]">
                      <dt className="w-[96px] shrink-0 opacity-60">
                        {model.receiptEvidence.datePaidLabel}
                      </dt>
                      <dd className="font-medium tabular-nums">{model.receiptEvidence.paidAt}</dd>
                    </div>
                    {model.receiptEvidence.method !== undefined && (
                      <div className="flex gap-[8px]">
                        <dt className="w-[96px] shrink-0 opacity-60">
                          {model.receiptEvidence.methodLabel}
                        </dt>
                        <dd className="font-medium">{model.receiptEvidence.method}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {model.receivedByRule !== null && (
                <div className="flex-1">
                  <div className="mt-[24px] w-[160px] border-t" style={{ borderColor: ink }} />
                  <p className="mt-[4px] font-bold uppercase tracking-wide">{model.receivedByRule}</p>
                </div>
              )}

              <div className="shrink-0 text-end">
                {/*
                  §I: the actual captured signature, then a short ~76px rule,
                  then the localised caption and the signer's name. The mark
                  sits ON the rule, which is why it is bottom-aligned in a
                  fixed-height box — a tall signature and a flat one both have
                  to meet the same line.
                */}
                {model.signature.imageUrl !== undefined && (
                  <div className="flex h-[40px] items-end justify-end">
                    <img
                      src={model.signature.imageUrl}
                      alt={model.signature.caption}
                      className="ms-auto max-h-[40px] w-auto max-w-[140px] object-contain object-bottom"
                    />
                  </div>
                )}
                <div className="ms-auto w-[76px] border-t" style={{ borderColor: ink }} />
                <p className="mt-[4px] font-bold uppercase tracking-wide">{model.signature.caption}</p>
                {model.signature.signerName !== undefined && (
                  <p className="opacity-70">{model.signature.signerName}</p>
                )}
              </div>
            </footer>
          </>
        )}

        {totalPages > 1 && (
          <p className="mt-[8px] text-center text-[10px] tabular-nums opacity-50">
            {page.pageNumber} / {totalPages}
          </p>
        )}
      </div>
    </article>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="opacity-60">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
