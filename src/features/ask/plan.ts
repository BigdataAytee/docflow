/**
 * The ask box's validated plan (§N).
 *
 * §N: "question → local model (Tier A) → **validated, allowlisted plan**
 * (intent, metric, period, grouping, filters, chart type) → the app compiles a
 * parameterized read-only query with company scope, permissions, date ranges,
 * currency separation and limits → SQLite → in-app chart + plain-language
 * answer whose numbers are checked against the query result… **Never execute
 * model-returned SQL or code.**"
 *
 * That last sentence is the whole reason this file exists, and the reason it
 * has no dependency on any model. A model proposes a PLAN — a small, closed
 * object drawn from fixed vocabularies — and this validates it against those
 * vocabularies before anything is compiled. A plan is not a query, and cannot
 * become one by containing clever text: every field is checked against an
 * allowlist, and anything not on it is rejected rather than passed through.
 *
 * The asymmetry matters. A denylist ("reject DROP, reject ;") is a losing
 * game played forever. An allowlist has a fixed, readable size, and the worst
 * a hostile model can do is propose a plan that is refused.
 */

export const INTENTS = ['total', 'count', 'average', 'list'] as const
export const METRICS = [
  'revenue',
  'outstanding',
  'expenses',
  'payments_received',
  'documents_issued',
] as const
export const PERIODS = [
  'this_month',
  'last_month',
  'this_quarter',
  'this_year',
  'last_year',
  'all_time',
] as const
export const GROUPINGS = ['none', 'month', 'customer', 'document_type', 'category'] as const
export const CHARTS = ['none', 'bar', 'line', 'donut'] as const
/** The only columns a filter may name. Nothing else is addressable. */
export const FILTER_FIELDS = ['document_type', 'status', 'customer_id', 'currency'] as const

export type Intent = (typeof INTENTS)[number]
export type Metric = (typeof METRICS)[number]
export type Period = (typeof PERIODS)[number]
export type Grouping = (typeof GROUPINGS)[number]
export type Chart = (typeof CHARTS)[number]
export type FilterField = (typeof FILTER_FIELDS)[number]

export interface Filter {
  readonly field: FilterField
  /** Equality only. No operators means no operator injection. */
  readonly equals: string
}

export interface AskPlan {
  readonly intent: Intent
  readonly metric: Metric
  readonly period: Period
  readonly grouping: Grouping
  readonly chart: Chart
  readonly filters: readonly Filter[]
  /** §N: "limits". Capped here, not by whatever the model suggested. */
  readonly limit: number
}

export const MAX_LIMIT = 200
export const MAX_FILTERS = 4
/** A filter value long enough to be a payload is not a filter value. */
export const MAX_FILTER_VALUE = 64

export type PlanResult =
  | { readonly ok: true; readonly plan: AskPlan }
  | { readonly ok: false; readonly reason: string }

const oneOf = <T extends string>(allowed: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)

/**
 * Validate whatever came back, and build a plan that is safe by construction.
 *
 * The returned object is BUILT HERE, field by field, from values that passed
 * an allowlist — it is never the input object with a type assertion on it.
 * That distinction is the difference between validation and hope: an input
 * that is merely *checked* still carries every extra key it arrived with,
 * straight into whatever reads it next.
 */
export function validatePlan(input: unknown): PlanResult {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, reason: 'not a plan' }
  }
  const raw = input as Record<string, unknown>

  if (!oneOf(INTENTS, raw['intent'])) return { ok: false, reason: 'unknown intent' }
  if (!oneOf(METRICS, raw['metric'])) return { ok: false, reason: 'unknown metric' }
  if (!oneOf(PERIODS, raw['period'])) return { ok: false, reason: 'unknown period' }
  if (!oneOf(GROUPINGS, raw['grouping'])) return { ok: false, reason: 'unknown grouping' }
  if (!oneOf(CHARTS, raw['chart'])) return { ok: false, reason: 'unknown chart' }

  const rawFilters = raw['filters']
  if (rawFilters !== undefined && !Array.isArray(rawFilters)) {
    return { ok: false, reason: 'filters must be a list' }
  }
  const proposed = (rawFilters ?? []) as unknown[]
  if (proposed.length > MAX_FILTERS) return { ok: false, reason: 'too many filters' }

  const filters: Filter[] = []
  for (const candidate of proposed) {
    if (typeof candidate !== 'object' || candidate === null) {
      return { ok: false, reason: 'a filter is not an object' }
    }
    const filter = candidate as Record<string, unknown>
    if (!oneOf(FILTER_FIELDS, filter['field'])) {
      return { ok: false, reason: 'a filter names a field that cannot be queried' }
    }
    const equals = filter['equals']
    if (typeof equals !== 'string' || equals === '') {
      return { ok: false, reason: 'a filter has no value' }
    }
    if (equals.length > MAX_FILTER_VALUE) {
      return { ok: false, reason: 'a filter value is too long' }
    }
    filters.push({ field: filter['field'], equals })
  }

  const rawLimit = raw['limit']
  const limit =
    typeof rawLimit === 'number' && Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : MAX_LIMIT

  return {
    ok: true,
    // Built, not cast. Every field came through an allowlist, and nothing the
    // input carried beyond these keys survives.
    plan: {
      intent: raw['intent'],
      metric: raw['metric'],
      period: raw['period'],
      grouping: raw['grouping'],
      chart: raw['chart'],
      filters,
      limit,
    },
  }
}
