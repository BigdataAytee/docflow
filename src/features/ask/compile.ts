/**
 * A validated plan, compiled to a parameterized read-only query (§N, §P).
 *
 * §N: "the app compiles a parameterized read-only query with company scope,
 * permissions, date ranges, currency separation and limits."
 *
 * Every one of those is enforced here rather than trusted from the plan:
 *
 *  · **Company scope** is added by this compiler, always, and cannot be
 *    removed by anything a plan says. A plan has no field for it — which is
 *    the point: what cannot be expressed cannot be subverted.
 *  · **Parameterized** means no value is ever concatenated. Filter values go
 *    in the parameter list; only ALLOWLISTED COLUMN NAMES reach the SQL text,
 *    and they arrive from a fixed table in this file rather than from the
 *    plan's strings.
 *  · **Read-only** is structural: this emits a SELECT and there is no branch
 *    that emits anything else.
 *  · **Currency separation** (Rule #3): money is never summed across
 *    currencies, so every money query groups by currency whether the plan
 *    asked or not. One number spanning naira and cedis is not a number.
 *  · **Limits** are applied by the compiler, from the validated plan's capped
 *    value.
 */

import type { AskPlan, FilterField, Grouping, Metric } from './plan'
import { toIsoDay } from '../../domain/dates/calendar'

export interface CompiledQuery {
  readonly sql: string
  readonly params: readonly unknown[]
  /** What the answer sentence may say. Checked against the rows (§N). */
  readonly shape: { readonly money: boolean; readonly grouped: boolean }
}

/** The ONLY column names that ever reach SQL text. */
const COLUMN: Readonly<Record<FilterField, string>> = {
  document_type: 'd.type',
  status: 'd.status',
  customer_id: 'd.customer_id',
  currency: 'd.currency',
}

const GROUP_COLUMN: Readonly<Record<Exclude<Grouping, 'none'>, string>> = {
  month: "strftime('%Y-%m', d.issue_date)",
  customer: 'd.customer_id',
  document_type: 'd.type',
  category: 'd.type',
}

/** Which metrics are money, and therefore may never cross a currency. */
const MONEY_METRICS: readonly Metric[] = ['revenue', 'outstanding', 'expenses', 'payments_received']

export function compile(plan: AskPlan, companyId: string): CompiledQuery {
  const params: unknown[] = []
  const where: string[] = []

  // Company scope FIRST and unconditionally. Not a filter the plan supplies —
  // there is no plan field for it, so no plan can drop it.
  where.push('d.company_id = ?')
  params.push(companyId)

  // §N: "issued documents" is what a business question means; drafts are not
  // revenue, and counting them would answer a question nobody asked.
  where.push("d.status != 'draft'")

  const range = rangeFor(plan.period)
  if (range !== null) {
    where.push('d.issue_date >= ?')
    where.push('d.issue_date < ?')
    params.push(range.from, range.until)
  }

  for (const filter of plan.filters) {
    // The COLUMN comes from the table above; the VALUE goes in params. A
    // filter value is never any part of the SQL text.
    where.push(`${COLUMN[filter.field]} = ?`)
    params.push(filter.equals)
  }

  const money = MONEY_METRICS.includes(plan.metric)
  const selected: string[] = []
  const groupBy: string[] = []

  // Currency separation, whether or not the plan asked (Rule #3). A single
  // total spanning naira and cedis is not a total; it is two facts added
  // together as though they were one.
  if (money) {
    selected.push('d.currency as currency')
    groupBy.push('d.currency')
  }

  if (plan.grouping !== 'none') {
    selected.push(`${GROUP_COLUMN[plan.grouping]} as bucket`)
    groupBy.push(GROUP_COLUMN[plan.grouping])
  }

  selected.push(`${aggregate(plan)} as value`)

  const sql = [
    `select ${selected.join(', ')}`,
    'from documents d',
    `where ${where.join(' and ')}`,
    groupBy.length > 0 ? `group by ${groupBy.join(', ')}` : '',
    'order by value desc',
    'limit ?',
  ]
    .filter((part) => part !== '')
    .join(' ')

  params.push(plan.limit)

  return { sql, params, shape: { money, grouped: plan.grouping !== 'none' } }
}

function aggregate(plan: AskPlan): string {
  switch (plan.intent) {
    case 'count':
      return 'count(*)'
    case 'average':
      return 'avg(d.total_minor)'
    case 'total':
    case 'list':
      return 'sum(d.total_minor)'
  }
}

export interface DateRange {
  readonly from: string
  readonly until: string
}

/**
 * The period, as two dates. `null` for all time.
 *
 * Half-open — `>= from` and `< until` — so a document issued on the last day
 * of a month is counted once, in that month. Inclusive-both would double it
 * across adjacent periods, which is exactly the sort of arithmetic error a
 * chart makes invisible.
 */
export function rangeFor(period: AskPlan['period'], now = new Date()): DateRange | null {
  // LOCAL fields. "This month" is the month the owner is in, not the month
  // Greenwich is in — and for the last hours of every evening in the
  // Americas those are different months.
  const year = now.getFullYear()
  const month = now.getMonth()
  // `m` is 0-BASED here, and deliberately allowed to overflow: callers below
  // pass `month + 3` and `12` to roll into the next quarter and the next
  // year. The Date constructor normalises that; formatting the number
  // directly does not, and produced "2026-13-01".
  const day = (y: number, m: number, d: number) => {
    const at = new Date(y, m, d)
    return toIsoDay(at.getFullYear(), at.getMonth() + 1, at.getDate())
  }

  switch (period) {
    case 'this_month':
      return { from: day(year, month, 1), until: day(year, month + 1, 1) }
    case 'last_month':
      return { from: day(year, month - 1, 1), until: day(year, month, 1) }
    case 'this_quarter': {
      const quarter = Math.floor(month / 3) * 3
      return { from: day(year, quarter, 1), until: day(year, quarter + 3, 1) }
    }
    case 'this_year':
      return { from: day(year, 0, 1), until: day(year + 1, 0, 1) }
    case 'last_year':
      return { from: day(year - 1, 0, 1), until: day(year, 0, 1) }
    case 'all_time':
      return null
  }
}

/**
 * §N's chips: "predefined local queries" that run on EVERY tier.
 *
 * Plans, not questions — so Tier B and C reach the same compiler by the same
 * path, and the only thing a model changes is whether a plan can be composed
 * from words rather than chosen from a list.
 */
export const CHIP_PLANS: Readonly<Record<string, AskPlan>> = {
  revenue_this_month: {
    intent: 'total',
    metric: 'revenue',
    period: 'this_month',
    grouping: 'none',
    chart: 'none',
    filters: [{ field: 'document_type', equals: 'invoice' }],
    limit: 50,
  },
  outstanding_now: {
    intent: 'total',
    metric: 'outstanding',
    period: 'all_time',
    grouping: 'customer',
    chart: 'bar',
    filters: [{ field: 'document_type', equals: 'invoice' }],
    limit: 20,
  },
  revenue_by_month: {
    intent: 'total',
    metric: 'revenue',
    period: 'this_year',
    grouping: 'month',
    chart: 'line',
    filters: [{ field: 'document_type', equals: 'invoice' }],
    limit: 12,
  },
}
