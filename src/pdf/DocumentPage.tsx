/**
 * The page renderer (§I), at A4 proportions.
 *
 * It draws a PageModel under a TemplateDefinition and knows nothing about
 * document types: every per-type decision was already made in
 * `composeDocument`, which is why a delivery document renders without money
 * here without this file containing a single branch about it.
 */

import { type CSSProperties } from 'react'

import type { PageModel, TableRow } from './compose'
import type { PrintPage } from './paginate'
import type { TemplateDefinition } from './templates'
import { LOGO_SCALE, fitLogo } from './logo'

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
  readonly logoNaturalSize?: { width: number; height: number }
  readonly continuedLabel?: string
}

function LogoHolder({
  size,
  natural,
}: {
  size: PageModel['branding']['logoSize']
  natural?: { width: number; height: number } | undefined
}) {
  const holderSide = 96 * LOGO_SCALE[size]
  const holder = { width: holderSide, height: holderSide }
  const margin = holderSide * 0.06

  // §G: the holder is drawn even before a logo exists, so the header does not
  // jump when one is added.
  const fit =
    natural === undefined ? null : fitLogo(natural, holder, margin)

  return (
    <div
      className="relative shrink-0 rounded-xl bg-white"
      style={{ width: holderSide, height: holderSide }}
      aria-hidden="true"
    >
      {fit !== null && (
        <div
          className="absolute bg-navy/10"
          style={{ left: fit.left, top: fit.top, width: fit.width, height: fit.height }}
        />
      )}
    </div>
  )
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
      return <td style={style} className="py-1.5 pr-2">{row.description}</td>
    case 'quantity':
      return <td style={style} className="py-1.5 tabular-nums">{row.quantity}</td>
    case 'unit':
      return <td style={style} className="py-1.5">{row.unit ?? ''}</td>
    case 'amount':
      // Absent on a delivery document — composeDocument never emits the column.
      return (
        <td style={style} className="py-1.5 tabular-nums">
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
  logoNaturalSize,
  continuedLabel,
}: DocumentPageProps) {
  const ink = template.usesBrandAccent ? accent : template.ink

  return (
    <article
      className="mx-auto w-full overflow-hidden"
      style={{
        aspectRatio: String(A4_ASPECT),
        backgroundColor: template.paper,
        color: template.ink,
        fontFamily: FONT_STACK[template.fontFamily],
      }}
      aria-label={`${model.title} ${model.reference}`}
    >
      <div className="flex h-full flex-col p-[6%]">
        <header className="flex items-start gap-4">
          {model.branding.showLogo && (
            <LogoHolder size={model.branding.logoSize} natural={logoNaturalSize} />
          )}
          <div className="min-w-0 flex-1">
            <p className="break-words text-lg font-bold leading-tight">{model.branding.name}</p>
            <h2
              className="mt-1 break-words text-2xl font-black uppercase tracking-tight"
              style={{ color: ink }}
            >
              {model.title}
            </h2>
            <p className="text-xs tabular-nums opacity-70">{model.reference}</p>
          </div>
        </header>

        <div
          className="mt-4 h-[3px] w-full"
          style={{ backgroundColor: ink, opacity: template.headerStyle === 'hairline' ? 0.25 : 1 }}
        />

        <section className="mt-4 flex justify-between gap-6 text-xs">
          <div className="min-w-0">
            <p className="font-bold uppercase tracking-wide opacity-60">{model.partyLabel}</p>
            <p className="font-semibold">{model.party.name}</p>
            {model.party.address !== undefined && <p className="opacity-80">{model.party.address}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="tabular-nums">{model.issueDate}</p>
            {model.dueDate !== undefined && <p className="tabular-nums opacity-70">{model.dueDate}</p>}
          </div>
        </section>

        <table className="mt-4 w-full border-collapse text-xs">
          {/* Repeated on every page (§I). */}
          <thead>
            <tr style={{ borderBottom: `1px solid ${ink}` }}>
              {model.columns.map((column) => (
                <th key={column.key} style={{ textAlign: column.align }} className="pb-1 font-bold uppercase tracking-wide">
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
          <p className="mt-2 text-[10px] italic opacity-60">{continuedLabel}</p>
        )}

        {page.showsFooter && (
          <>
            {model.totals !== null && (
              <section
                className="mt-3 self-end text-xs"
                style={{ width: `${model.totalsWidthPercent}%` }}
              >
                <Line label="" value={formatAmount(model.totals.subtotal.minor, currency)} />
                {model.totals.tax.minor !== 0 && (
                  <Line label="" value={formatAmount(model.totals.tax.minor, currency)} />
                )}
                {model.totals.wht.minor !== 0 && (
                  <Line label="" value={`−${formatAmount(model.totals.wht.minor, currency)}`} />
                )}
                <div className="mt-1 border-t-2 pt-1" style={{ borderColor: ink }}>
                  <div className="flex justify-between text-sm font-black" style={{ color: ink }}>
                    <span>{model.totalsLabel ?? ''}</span>
                    <span className="tabular-nums">
                      {formatAmount(model.totals.payable.minor, currency)}
                    </span>
                  </div>
                </div>
              </section>
            )}

            <footer className="mt-auto flex items-end justify-between gap-6 pt-4 text-[10px]">
              {/* §I: the payment box is inline beside the signature, never a
                  full-width band — and a delivery document has none at all. */}
              {model.paymentBox !== null && (
                <div style={{ maxWidth: `${model.paymentBox.maxWidthPercent}%` }}>
                  <p className="font-bold uppercase tracking-wide" style={{ color: ink }}>
                    {model.paymentBox.heading}
                  </p>
                  <dl className="mt-1">
                    {model.paymentBox.rows.map((row) => (
                      <div key={row.label} className="flex gap-2">
                        <dt className="w-24 shrink-0 opacity-60">{row.label}</dt>
                        <dd className="font-medium">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {model.receivedByRule !== null && (
                <div className="flex-1">
                  <div className="mt-6 w-40 border-t" style={{ borderColor: ink }} />
                  <p className="mt-1 font-bold uppercase tracking-wide">{model.receivedByRule}</p>
                </div>
              )}

              <div className="shrink-0 text-right">
                <div className="ml-auto w-[76px] border-t" style={{ borderColor: ink }} />
                <p className="mt-1 font-bold uppercase tracking-wide">{model.signature.caption}</p>
                {model.signature.signerName !== undefined && (
                  <p className="opacity-70">{model.signature.signerName}</p>
                )}
              </div>
            </footer>
          </>
        )}

        {totalPages > 1 && (
          <p className="mt-2 text-center text-[10px] tabular-nums opacity-50">
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
