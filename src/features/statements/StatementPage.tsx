/**
 * The printable customer statement (§L5), at the same A4 proportions as the
 * sixteen document designs.
 *
 * It carries no reference and no status badge, because a statement is not a
 * document in §E's sense — it is a view of the ledger between two dates. It is
 * never "issued", so nothing here freezes and there is nothing to make
 * immutable (Rule #5 applies to documents; this is a report about them).
 *
 * Every word comes from the language catalogue and every figure is passed in
 * already computed by `composeStatement`, so the page does no arithmetic.
 */

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { A4_ASPECT } from '../../pdf/DocumentPage'
import { formatMoney } from '../customers/formatMoney'
import type { Statement } from './compose'

export interface StatementPageProps {
  readonly statement: Statement
  readonly businessName: string
  readonly customerName: string
  readonly accent?: string
  /**
   * Replaces the printed start date. An open-ended statement ("everything")
   * has no real start, and printing a sentinel year on a document a customer
   * keeps would be a fiction.
   */
  readonly fromLabel?: string
}

export function StatementPage({
  statement,
  businessName,
  customerName,
  accent = '#2b3fd6',
  fromLabel,
}: StatementPageProps) {
  const { strings } = useCompany()
  const s = strings.statements

  return (
    <article
      className="mx-auto w-full max-w-[720px] bg-white text-navy shadow-sm"
      style={{ aspectRatio: String(A4_ASPECT) }}
      aria-label={s.title}
    >
      <header className="px-8 pt-8" style={{ borderTop: `4px solid ${accent}` }}>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-lg font-bold">{s.title}</h1>
            <p className="mt-0.5 break-words text-sm opacity-80">{businessName}</p>
          </div>
          <div className="shrink-0 text-end text-xs">
            <p className="font-semibold">{customerName}</p>
            <p className="mt-1 opacity-70">
              {s.from} {fromLabel ?? statement.from}
            </p>
            <p className="opacity-70">
              {s.to} {statement.to}
            </p>
          </div>
        </div>
      </header>

      <div className="px-8 pt-6">
        <div className="flex items-baseline justify-between border-b border-black/10 pb-2 text-sm">
          <span className="opacity-70">{s.openingBalance}</span>
          <span className="tabular-nums font-medium">{formatMoney(statement.openingBalance)}</span>
        </div>

        {statement.rows.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold">{s.nothingInPeriod}</p>
            <p className="mt-1 text-xs opacity-70">{s.nothingInPeriodBody}</p>
          </div>
        ) : (
          <table className="mt-3 w-full text-xs">
            <thead>
              <tr className="text-start opacity-60">
                <th scope="col" className="py-1 text-start font-medium">
                  {s.date}
                </th>
                <th scope="col" className="py-1 text-start font-medium">
                  {strings.details.reference}
                </th>
                <th scope="col" className="py-1 text-end font-medium">
                  {s.charged}
                </th>
                <th scope="col" className="py-1 text-end font-medium">
                  {s.paid}
                </th>
                <th scope="col" className="py-1 text-end font-medium">
                  {s.balance}
                </th>
              </tr>
            </thead>
            <tbody>
              {statement.rows.map((row) => (
                <tr key={`${row.kind}-${row.reference}-${row.date}`} className="border-t border-black/5">
                  <td className="py-1.5 tabular-nums">{row.date}</td>
                  <td className="py-1.5 break-words">
                    {row.reference}
                    {row.kind === 'credit' && (
                      <span className="ms-2 rounded bg-black/5 px-1 py-0.5 text-[10px]">
                        {s.credited}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-end tabular-nums">
                    {row.charged.minor === 0 ? '' : formatMoney(row.charged)}
                  </td>
                  <td className="py-1.5 text-end tabular-nums">
                    {row.paid.minor === 0 ? '' : formatMoney(row.paid)}
                  </td>
                  <td className="py-1.5 text-end tabular-nums font-medium">{formatMoney(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-6 ms-auto w-full max-w-xs space-y-1 text-sm">
          <Line label={s.charged} value={formatMoney(statement.charged)} />
          <Line label={s.paid} value={formatMoney(statement.paid)} />
          {statement.credited.minor !== 0 && (
            <Line label={s.credited} value={formatMoney(statement.credited)} />
          )}
          <div
            className="flex items-baseline justify-between gap-3 border-t-2 pt-1.5 text-base font-bold"
            style={{ borderColor: accent }}
          >
            <span>{s.closingBalance}</span>
            <span className="tabular-nums">{formatMoney(statement.closingBalance)}</span>
          </div>
        </div>

        <p className="mt-4 text-[10px] opacity-60">
          {format(s.currencyNote, { currency: statement.currency })}
        </p>
      </div>
    </article>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="opacity-70">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
