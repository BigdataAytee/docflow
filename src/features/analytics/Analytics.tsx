/**
 * Analytics — "one page, no tabs, no filter panels" (§G).
 *
 * Top to bottom, exactly what §G lists: In / Out / Kept for the month, the
 * paired in-vs-out bars across six months, the ageing buckets with a line
 * naming the worst one, what sells best, the expense list with its `+`, and
 * the ask box.
 *
 * The page holds no arithmetic of its own. Every figure comes from
 * `inOutKept`, `ageingByCurrency` and `topItems`, which are the same functions
 * the tests bind, so nothing on screen can drift from what the ledger says.
 * Currencies are rendered as separate rows throughout — §G forbids one
 * combined figure, and a chart is exactly where that rule gets broken quietly.
 */

import { useMemo, useState } from 'react'

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import type { CurrencyCode, Money } from '../../domain/money/money'
import type { CreditNote, Payment } from '../../domain/payments/ledger'
import { EmptyState, PageHeader, Skeleton } from '../../ui'
import { formatMoney } from '../customers/formatMoney'
import { type AgeingBucket, type AgeingDocument, ageingByCurrency } from './ageing'
import { type ExpenseEntry, inOutKept, monthlyBars, shiftMonths, tallestBar } from './inOutKept'
import { type SoldDocument, topItems } from './topItems'
import { type AskFacts } from './ask'
import { AskBox } from './AskBox'
import { ExpenseSheet } from './ExpenseSheet'

export interface AnalyticsRecord extends AgeingDocument, SoldDocument {}

export interface AnalyticsProps {
  readonly documents: readonly AnalyticsRecord[]
  readonly payments: readonly Payment[]
  readonly expenses: readonly ExpenseEntry[]
  readonly expenseLines: readonly { id: string; description: string; category?: string; amount: Money; spentOn: string }[]
  readonly creditNotes?: readonly CreditNote[]
  readonly customerNames: ReadonlyMap<string, string>
  readonly customerOf: ReadonlyMap<string, string>
  readonly today: string
  readonly defaultCurrency: CurrencyCode
  readonly knownCategories: readonly string[]
  readonly loading?: boolean
  readonly onAddExpense: (input: {
    amount: Money
    spentOn: string
    description: string
    category?: string
    photoAssetId?: string
  }) => void
  readonly onStorePhoto?: (dataUrl: string) => Promise<string>
}

export function Analytics(props: AnalyticsProps) {
  const { strings } = useCompany()
  const [sheetOpen, setSheetOpen] = useState(false)

  const month = useMemo(
    () => ({ from: shiftMonths(props.today, 0), to: shiftMonths(props.today, 1) }),
    [props.today],
  )

  const rows = useMemo(
    () => [...inOutKept(props.payments, props.expenses, month).values()],
    [props.payments, props.expenses, month],
  )

  const ageing = useMemo(
    () => [...ageingByCurrency(props.documents, props.payments, props.today, props.creditNotes ?? []).values()],
    [props.documents, props.payments, props.today, props.creditNotes],
  )

  const best = useMemo(
    () => topItems(props.documents, { from: month.from, to: month.to, limit: 5 }),
    [props.documents, month],
  )

  const bucketLabels: Readonly<Record<AgeingBucket, string>> = {
    not_due: strings.analytics.bucketNotDue,
    d1_30: strings.analytics.bucket1to30,
    d31_60: strings.analytics.bucket31to60,
    d60_plus: strings.analytics.bucket60plus,
  }

  const facts: AskFacts = {
    documents: props.documents,
    payments: props.payments,
    expenses: props.expenses,
    ...(props.creditNotes === undefined ? {} : { creditNotes: props.creditNotes }),
    customerNames: props.customerNames,
    customerOf: props.customerOf,
    today: props.today,
  }

  const nothingAtAll = rows.length === 0 && ageing.length === 0 && best.length === 0

  return (
    <div className="pb-24">
      <PageHeader title={strings.analytics.title} eyebrow={strings.analytics.eyebrow} />

      <div className="space-y-4 px-4 pt-4">
        {props.loading === true ? (
          <div className="space-y-3" aria-busy="true" aria-label={strings.common.loading}>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            {nothingAtAll && (
              <EmptyState
                title={strings.analytics.nothingYet}
                body={strings.analytics.nothingYetBody}
              />
            )}

            {rows.map((row) => (
              <section key={row.currency} aria-label={`${strings.analytics.eyebrow} ${row.currency}`}>
                <div className="flex gap-2">
                  <Card title={strings.analytics.moneyIn} amount={row.moneyIn} />
                  <Card title={strings.analytics.moneyOut} amount={row.moneyOut} />
                  <Card title={strings.analytics.kept} amount={row.kept} emphasis />
                </div>
                <p className="mt-1.5 px-1 text-[11px] opacity-60">{strings.analytics.keptHelp}</p>
                <Bars
                  currency={row.currency}
                  payments={props.payments}
                  expenses={props.expenses}
                  today={props.today}
                  title={strings.analytics.inVsOut}
                  inLabel={strings.analytics.moneyIn}
                  outLabel={strings.analytics.moneyOut}
                />
              </section>
            ))}

            {ageing.length > 0 && (
              <section className="rounded-2xl bg-white/70 p-4 backdrop-blur">
                <h2 className="text-sm font-semibold">{strings.analytics.howLate}</h2>
                {ageing.map((row) => (
                  <div key={row.currency} className="mt-3">
                    <dl className="space-y-1.5">
                      {(Object.keys(bucketLabels) as AgeingBucket[]).map((bucket) => (
                        <div key={bucket} className="flex items-baseline justify-between gap-3 text-sm">
                          <dt className="opacity-70">{bucketLabels[bucket]}</dt>
                          <dd className="tabular-nums font-medium">{formatMoney(row.buckets[bucket])}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-2 text-xs opacity-70">
                      {row.worst === null
                        ? strings.analytics.nothingLate
                        : format(strings.analytics.worstBucket, { bucket: bucketLabels[row.worst] })}
                    </p>
                  </div>
                ))}
              </section>
            )}

            {best.length > 0 && (
              <section className="rounded-2xl bg-white/70 p-4 backdrop-blur">
                <h2 className="text-sm font-semibold">{strings.analytics.whatSellsBest}</h2>
                <ol className="mt-3 space-y-2">
                  {best.map((item) => (
                    <li key={`${item.currency}-${item.name}`} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 break-words">{item.name}</span>
                      <span className="shrink-0 tabular-nums font-medium">{formatMoney(item.value)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="rounded-2xl bg-white/70 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">{strings.expenses.title}</h2>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-full bg-brand text-lg font-bold text-white"
                  aria-label={strings.expenses.add}
                  aria-expanded={sheetOpen}
                  onClick={() => setSheetOpen((open) => !open)}
                >
                  +
                </button>
              </div>

              {sheetOpen && (
                <div className="mt-3">
                  <ExpenseSheet
                    currency={props.defaultCurrency}
                    today={props.today}
                    knownCategories={props.knownCategories}
                    {...(props.onStorePhoto === undefined ? {} : { onStorePhoto: props.onStorePhoto })}
                    onCancel={() => setSheetOpen(false)}
                    onSave={(input) => {
                      props.onAddExpense(input)
                      setSheetOpen(false)
                    }}
                  />
                </div>
              )}

              {props.expenseLines.length === 0 ? (
                <p className="mt-3 text-sm opacity-70">{strings.expenses.noneBody}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {props.expenseLines.map((line) => (
                    <li key={line.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 break-words">
                        {line.description === '' ? strings.expenses.fromPhoto : line.description}
                        {line.category !== undefined && (
                          <span className="ms-2 text-[11px] opacity-60">{line.category}</span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums font-medium">{formatMoney(line.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <AskBox facts={facts} chipLabels={strings.analytics.askChips} bucketLabels={bucketLabels} />
          </>
        )}
      </div>
    </div>
  )
}

function Card({ title, amount, emphasis }: { title: string; amount: Money; emphasis?: boolean }) {
  return (
    <section className="flex-1 rounded-2xl bg-white/70 p-3 backdrop-blur" aria-label={title}>
      <p className="text-[11px] font-medium opacity-70">{title}</p>
      <p className={`mt-1 tabular-nums ${emphasis === true ? 'text-lg font-bold' : 'text-base font-semibold'}`}>
        {formatMoney(amount)}
      </p>
    </section>
  )
}

function Bars({
  currency,
  payments,
  expenses,
  today,
  title,
  inLabel,
  outLabel,
}: {
  currency: CurrencyCode
  payments: readonly Payment[]
  expenses: readonly ExpenseEntry[]
  today: string
  title: string
  inLabel: string
  outLabel: string
}) {
  const bars = monthlyBars(payments, expenses, currency, today)
  const tallest = tallestBar(bars)
  // A flat window scales to nothing rather than dividing by zero.
  const height = (amount: Money) => (tallest === 0 ? 0 : Math.round((amount.minor / tallest) * 100))

  return (
    <figure className="mt-3 rounded-2xl bg-white/70 p-4 backdrop-blur">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      <div className="mt-3 flex h-28 items-end gap-2">
        {bars.map((bar) => (
          <div key={bar.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-full w-full items-end justify-center gap-0.5">
              <span
                className="w-1/3 rounded-t bg-brand"
                style={{ height: `${height(bar.moneyIn)}%` }}
                aria-label={`${inLabel} ${bar.month}: ${formatMoney(bar.moneyIn)}`}
                role="img"
              />
              <span
                className="w-1/3 rounded-t bg-amber-400"
                style={{ height: `${height(bar.moneyOut)}%` }}
                aria-label={`${outLabel} ${bar.month}: ${formatMoney(bar.moneyOut)}`}
                role="img"
              />
            </div>
            <span className="text-[10px] opacity-60">{bar.month.slice(5)}</span>
          </div>
        ))}
      </div>
    </figure>
  )
}
