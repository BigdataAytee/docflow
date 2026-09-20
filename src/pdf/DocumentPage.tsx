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
import { DocumentHeader, HEADER_DRAWS_HEADLINE, PageChrome, contentInset, headerCarriesParty } from './DocumentHeader'

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
      return (
        <td style={style} className="px-[8px] py-[6px]">
          {/*
            §I's "thumbnail if a photo was attached", INSIDE the description
            cell rather than as a column of its own.

            A column would exist on every row of every document to serve the
            few that have a picture, and would have to be sized for the widest
            one whether or not it was there — which is how a table gets wider
            than the page. In the cell, a row with no photo is exactly the row
            it was before.

            BIG ENOUGH TO SEE, and it was not. This sat beside the text at
            34px, which on a page whose own coordinate space is A4 at 96dpi
            (794px across) is NINE MILLIMETRES — a postage stamp. The picture
            exists so the person receiving the PDF can look at it and
            recognise the goods; at that size they cannot, and a picture
            nobody can make out is weight in the file for nothing.

            So it goes UNDER the description rather than beside it, which is
            what buys the size: 180 × 135px is about 47 × 36mm on the paper,
            and it costs the column no width at all. `object-cover` keeps a
            portrait photograph, a landscape one and a square one in the same
            box, so nothing a phone camera produces can stretch the table or
            push the totals off the page.
          */}
          {row.imageUrl === undefined ? (
            row.description
          ) : (
            <span className="block">
              <span className="block">{row.description}</span>
              <img
                src={row.imageUrl}
                alt=""
                data-item-photo
                className="mt-[6px] block h-[135px] w-[180px] rounded-[4px] border border-current/15 object-cover"
              />
            </span>
          )}
        </td>
      )
    case 'quantity':
      /*
         PADDED LIKE THE HEADING ABOVE IT.

         The heading band carries `px-[8px]` and the cells carried none, so a
         right-aligned quantity sat flush against a right-aligned amount and a
         full invoice printed "8₦304,000.00" — two numbers touching, which on
         a document about money is the one place they must not.
      */
      return (
        <td style={style} className="px-[8px] py-[6px] tabular-nums">
          {row.quantity}
        </td>
      )
    case 'unit':
      return (
        <td style={style} className="px-[8px] py-[6px]">
          {row.unit ?? ''}
        </td>
      )
    case 'amount':
      // Absent on a delivery document — composeDocument never emits the column.
      return (
        <td style={style} className="px-[8px] py-[6px] tabular-nums">
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

  /*
   * ONE logo node, because two things draw it.
   *
   * Sidebar's column holds the identity, so the chrome needs the logo as
   * much as the header does. Building it twice would be two places to
   * forget `showLogo`, and §F's promise is that the switch governs every
   * design rather than most of them.
   */
  const logoNode = model.branding.showLogo ? (
    <LogoHolder size={model.branding.logoSize} url={model.branding.logoUrl} />
  ) : null

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
        /*
         * A CONTAINER, so the page can scale itself to whatever width it is
         * given. See the zoom on the content layer below.
         */
        containerType: 'inline-size',
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
      <PageChrome template={template} ink={ink} model={model} logo={logoNode} />

      <div
        className="relative flex h-full flex-col p-[6%]"
        style={{
          ...contentInset(template),
          /*
           * THE PAGE IS A FAITHFUL SCALE MODEL, at any width.
           *
           * Every size in here is absolute because a printed page does not
           * reflow (see the note above). But the BOX it lives in is whatever
           * width the screen gives it — 343px on a phone against A4's 794px
           * at 96dpi — so the type was rendering at 2.3× its proper size
           * relative to the paper. A business name that fits one line on A4
           * wrapped to three, and the address was squeezed into a column
           * narrower than the figure beside it.
           *
           * That looked like a column-split problem and was not: the columns
           * are right, the type was too big for the page. `zoom` against the
           * container's own inline size makes the preview a true miniature —
           * 0.43 on a phone, 1.0 at A4 — so what is seen is what prints, at
           * every width, without a second set of sizes to keep in step.
           *
           * `cqi` needs the unit in the divisor: `100cqi / 794` is a length
           * and silently resolves to 1, which is how this first went in
           * doing nothing at all.
           */
          zoom: 'calc(100cqi / 794px)',
        }}
      >
        <DocumentHeader
          model={model}
          template={template}
          ink={ink}
          formatAmount={formatAmount}
          logo={logoNode}
        />

        {/*
          THE HEADLINE, for any design that does not place it itself (§I).

          All sixteen place it themselves now — its position is part of what
          makes each of them that design. This stays because the DEFAULT has
          to be having the amount at the top: a seventeenth design that forgets
          to draw one gets it here rather than shipping without it.
        */}
        {model.headline !== null && !HEADER_DRAWS_HEADLINE.has(template.headerStyle) && (
          <div className="mt-[10px] flex justify-end" data-headline>
            <div className="text-end">
              <p className="text-[8.5px] font-bold uppercase tracking-[0.16em] opacity-55">
                {model.headline.label}
              </p>
              {/* Never wrapped — an amount broken across two lines stops
                  reading as a number. Same rule as the header's own. */}
              <p
                className="mt-[1px] whitespace-nowrap text-[20px] font-black tabular-nums"
                style={{ color: ink }}
              >
                {formatAmount(model.headline.amount.minor, model.headline.amount.currency)}
              </p>
            </div>
          </div>
        )}

        {/*
          THE PARTY BAND (§I).

          A tinted band holding who the document is for and when it was
          issued, the way every document the legacy app produced does it. It
          was an untinted row of text sitting between the header and the
          table, so the eye ran straight past the one line saying who this is
          for into the list of things being charged.

          The tint is the ink at 6%, so it follows the design's own colour and
          a template with a brand accent does not suddenly grow a grey box.

          Compact's strip already carries these — see `headerCarriesParty`.
        */}
        {!headerCarriesParty(template) && (
        <section
          className="mt-[14px] flex justify-between gap-[24px] px-[12px] py-[10px] text-[12px]"
          style={{ backgroundColor: `${ink}0f` }}
        >
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-60">
              {model.partyLabel}
            </p>
            <p className="mt-[3px] font-semibold">{model.party.name}</p>
            {model.party.address !== undefined && (
              <p className="opacity-80">{model.party.address}</p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <p className="tabular-nums">{model.issueDate}</p>
            {model.dueDate !== undefined && (
              <p className="tabular-nums opacity-70">{model.dueDate}</p>
            )}
          </div>
        </section>
        )}

        <table className="mt-[16px] w-full border-collapse text-[12px]">
          {/* Repeated on every page (§I). */}
          <thead>
            {/*
              A RULED BAND, not a bare underline. The reference sets the
              column headings on a tinted strip closed by a heavier rule,
              which is what separates the headings from the first row at a
              glance on a page held at arm's length.
            */}
            <tr
              style={{ backgroundColor: `${ink}0a`, borderBottom: `1.5px solid ${ink}` }}
            >
              {model.columns.map((column) => (
                <th
                  key={column.key}
                  style={{ textAlign: column.align }}
                  className="px-[8px] py-[6px] text-[9.5px] font-bold uppercase tracking-[0.1em]"
                >
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
                {/*
                  THE WORDS BESIDE THE FIGURES.

                  These were `label=""` — a right-aligned column of amounts
                  with nothing saying which was the subtotal and which was
                  tax. A customer reading two figures and a total has to guess
                  what the middle one is, and where there is withholding the
                  guess is about money they are owed.
                */}
                <Line
                  label={model.subtotalLabel}
                  value={formatAmount(model.totals.subtotal.minor, currency)}
                />
                {/*
                  WHAT CAME OFF, where the customer can see it.

                  The builder has collected a discount for as long as it has
                  existed and this row was never drawn, so the page showed a
                  subtotal, a tax and a payable that did not add up — on the
                  one document where a customer checks exactly that.
                */}
                {model.discountLabel !== null && (
                  <Line
                    label={model.discountLabel}
                    value={`−${formatAmount(model.totals.discount.minor, currency)}`}
                  />
                )}
                {model.taxLabel !== null && (
                  <Line
                    label={model.taxLabel}
                    value={formatAmount(model.totals.tax.minor, currency)}
                  />
                )}
                {model.whtLabel !== null && (
                  <Line
                    label={model.whtLabel}
                    value={`−${formatAmount(model.totals.wht.minor, currency)}`}
                  />
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

            {/*
              NOTE TO CUSTOMER (§I) — the owner's payment terms in their own
              words, under the totals and above the signature, which is where
              every legacy document puts it. Ours had no such block at all, so
              the one place an owner says "payment is due within 14 days" did
              not exist.

              Nothing at all when there is no note: an empty heading says less
              than no heading (Rule #1).
            */}
            {model.note !== null && (
              <section className="mt-[14px]" data-note-block>
                <p
                  className="text-[8.5px] font-bold uppercase tracking-[0.14em] opacity-55"
                  style={{ color: ink }}
                >
                  {model.note.label}
                </p>
                <p className="mt-[3px] text-[10px] leading-relaxed opacity-75">
                  {model.note.body}
                </p>
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
                  {/*
                    THE FIGURE, AND THE WORD FOR IT.

                    It was a bare amount under the heading, which was clear
                    enough when it was the only figure in the block. It no
                    longer is: the bill and what had already arrived sit
                    beneath it now, and three amounts in a column with two of
                    them labelled makes the unlabelled one ambiguous — which
                    is the one that says how much this receipt is for.
                  */}
                  <p className="mt-[4px]" data-paid-now>
                    <span className="block uppercase tracking-wide opacity-60">
                      {model.receiptEvidence.paidNowLabel}
                    </span>
                    <span className="text-[14px] font-black tabular-nums">
                      {formatAmount(
                        model.receiptEvidence.amount.minor,
                        model.receiptEvidence.amount.currency,
                      )}
                    </span>
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
                    {/*
                      §E line 190's "linked invoice", which was on the record
                      and never reached the page. A receipt that says money
                      arrived without saying what it was for leaves the one
                      question the person filing it will have.

                      Omitted rather than blank on a standalone receipt: §G
                      allows a payment that stands alone, and a row reading
                      "For invoice —" claims a link that does not exist.
                    */}
                    {model.receiptEvidence.against !== undefined && (
                      <div className="flex gap-[8px]">
                        <dt className="w-[96px] shrink-0 opacity-60">
                          {model.receiptEvidence.againstLabel}
                        </dt>
                        <dd className="font-medium tabular-nums">
                          {model.receiptEvidence.against}
                        </dd>
                      </div>
                    )}

                    {/*
                      WHAT IS STILL OWED — the half of the question the paper
                      did not answer.

                      Somebody handed a receipt for ₦500,000 against a
                      ₦1,000,000 invoice needs to know they still owe
                      ₦500,000. The app knew and printed nothing.

                      One line or the other, never both and never neither:
                      "Balance remaining: ₦0.00" is arithmetically right and
                      reads as an oversight, so a cleared debt says so in
                      words. A standalone receipt shows neither — there is no
                      debt whose state to report, and a zero would invent one.
                    */}
                    {/*
                      THE BILL, AND WHAT HAD ALREADY ARRIVED.

                      Four questions a receipt's holder has — what was the
                      bill, what had I paid, what did I just pay, what is left
                      — and the amount alone answers one. These are the other
                      three, in the order somebody reads them.
                    */}
                    {model.receiptEvidence.invoiceTotal !== undefined && (
                      <div className="flex gap-[8px]" data-invoice-total>
                        <dt className="w-[96px] shrink-0 opacity-60">
                          {model.receiptEvidence.invoiceTotalLabel}
                        </dt>
                        <dd className="font-medium tabular-nums">
                          {formatAmount(
                            model.receiptEvidence.invoiceTotal.minor,
                            model.receiptEvidence.invoiceTotal.currency,
                          )}
                        </dd>
                      </div>
                    )}
                    {model.receiptEvidence.paidBefore !== undefined && (
                      <div className="flex gap-[8px]" data-paid-before>
                        <dt className="w-[96px] shrink-0 opacity-60">
                          {model.receiptEvidence.paidBeforeLabel}
                        </dt>
                        <dd className="font-medium tabular-nums">
                          {formatAmount(
                            model.receiptEvidence.paidBefore.minor,
                            model.receiptEvidence.paidBefore.currency,
                          )}
                        </dd>
                      </div>
                    )}

                    {model.receiptEvidence.balanceRemaining !== undefined && (
                      <div className="flex gap-[8px]" data-balance-remaining>
                        <dt className="w-[96px] shrink-0 opacity-60">
                          {model.receiptEvidence.balanceRemainingLabel}
                        </dt>
                        <dd className="font-bold tabular-nums">
                          {formatAmount(
                            model.receiptEvidence.balanceRemaining.minor,
                            model.receiptEvidence.balanceRemaining.currency,
                          )}
                        </dd>
                      </div>
                    )}
                    {model.receiptEvidence.paidInFull !== undefined && (
                      <div className="flex gap-[8px]" data-paid-in-full>
                        <dd className="font-bold">{model.receiptEvidence.paidInFull}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/*
                THE RECIPIENT'S BLOCK — and it can finally say something.

                This drew a caption over an empty rule, and it was empty
                FOREVER: the mark a customer drew at the gate went into the
                business's signature field and printed on the other side of
                this row, under the business's caption and the business's
                name. The one block belonging to the person receiving the
                goods was the only one that could never carry anything.

                Unsigned it is still a caption over a rule, because that is
                what somebody signs ON — the paper has to work at the gate
                before anyone has touched it.
              */}
              {model.receivedBy !== null && (
                <div className="flex-1" data-received-by>
                  {/*
                    The mark sits ON the rule, bottom-aligned in a fixed-height
                    box so a tall hand and a flat one meet the same line — the
                    same treatment the sender's mark gets opposite.
                  */}
                  {model.receivedBy.markUrl !== undefined && (
                    <div className="flex h-[40px] w-[160px] items-end">
                      <img
                        src={model.receivedBy.markUrl}
                        alt={model.receivedBy.caption}
                        data-received-mark
                        className="max-h-[40px] w-auto max-w-[140px] object-contain object-bottom"
                      />
                    </div>
                  )}
                  <div
                    className={`${model.receivedBy.markUrl === undefined ? 'mt-[24px]' : ''} w-[160px] border-t`}
                    style={{ borderColor: ink }}
                  />
                  <p className="mt-[4px] font-bold uppercase tracking-wide">
                    {model.receivedBy.caption}
                  </p>
                  {model.receivedBy.name !== undefined && (
                    <p className="opacity-70">
                      {model.receivedBy.name}
                      {model.receivedBy.role === undefined ? '' : ` · ${model.receivedBy.role}`}
                    </p>
                  )}
                  {model.receivedBy.signedOn !== undefined && (
                    <p className="opacity-55">{model.receivedBy.signedOn}</p>
                  )}
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
                {/*
                  Whose signature it is. A mark over a bare rule says somebody
                  signed and not on whose behalf — every legacy document names
                  the business under the caption.
                */}
                {model.signature.signerBusiness !== undefined && (
                  <p className="opacity-70" data-signer-business>
                    {model.signature.signerBusiness}
                  </p>
                )}
              </div>
            </footer>
          </>
        )}

        <ContactStrip branding={model.branding} showsFooter={page.showsFooter} ink={template.ink} />

        {totalPages > 1 && (
          <p className="mt-[8px] text-center text-[10px] tabular-nums opacity-50">
            {page.pageNumber} / {totalPages}
          </p>
        )}
      </div>
    </article>
  )
}

/**
 * How a customer reaches the business (§I).
 *
 * Every document ended in white space. On a quotation that is the one thing
 * the recipient needs — somebody who wants to accept it has no way to say so
 * — and the legacy documents carried it on every page they produced.
 *
 * Three rules, each from a way this goes wrong:
 *
 *  · ON THE LAST PAGE ONLY. A footer repeated under page one of four reads as
 *    the end of the document, four times.
 *  · NOTHING AT ALL WHEN THERE IS NOTHING. An owner who has filled none of
 *    the three gets no strip and no hairline, rather than an empty band with
 *    a rule over it announcing that something is missing.
 *  · SEPARATORS BETWEEN, NEVER AROUND. Joining the present values means a
 *    business with only a phone number prints the number, not "· +234… ·".
 */
function ContactStrip({
  branding,
  showsFooter,
  ink,
}: {
  branding: PageModel['branding']
  showsFooter: boolean
  ink: string
}) {
  if (!showsFooter) return null

  const parts = [branding.phone, branding.email, branding.website].filter(
    (value): value is string => value !== undefined && value.trim() !== '',
  )
  if (parts.length === 0) return null

  return (
    /*
      NO `mt-auto` HERE — and that is why the strip was invisible.

      The signature `<footer>` above already carries `mt-auto`, which in a
      flex column absorbs ALL the free space and pushes itself to the bottom
      of the page. A second `mt-auto` on this element asks for space that has
      already been given away, so the strip landed BELOW the footer, past the
      bottom of a box that is `overflow-hidden` at a fixed A4 aspect — drawn,
      measurable, and clipped off the paper.

      Sitting directly under the footer is what the reference does anyway.
    */
    <div data-contact-strip className="pt-[10px]">
      <div className="border-t opacity-25" style={{ borderColor: ink }} />
      <p className="mt-[6px] text-center text-[9px] tracking-[0.02em] opacity-70">
        {parts.join('  ·  ')}
      </p>
    </div>
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
