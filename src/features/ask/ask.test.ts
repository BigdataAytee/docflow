/**
 * The ask box (§N, §P).
 *
 * §N's hard rule is one sentence — "Never execute model-returned SQL or code"
 * — and everything here tests the two properties that make it structural
 * rather than aspirational: a plan is drawn from closed vocabularies, and a
 * compiled query puts no plan value into SQL text.
 */

import { describe, expect, it } from 'vitest'

import {
  CHIP_PLANS,
  compile,
  rangeFor,
} from './compile'
import {
  type AskPlan,
  MAX_FILTERS,
  MAX_LIMIT,
  validatePlan,
} from './plan'

const ACME = '11111111-1111-1111-1111-111111111111'

const good = {
  intent: 'total',
  metric: 'revenue',
  period: 'this_month',
  grouping: 'month',
  chart: 'line',
  filters: [{ field: 'document_type', equals: 'invoice' }],
  limit: 10,
}

const planOf = (over: object = {}): AskPlan => {
  const result = validatePlan({ ...good, ...over })
  if (!result.ok) throw new Error(`fixture is not a valid plan: ${result.reason}`)
  return result.plan
}

describe('A plan is drawn from closed vocabularies (§N)', () => {
  it('accepts a plan made only of allowed values', () => {
    expect(validatePlan(good).ok).toBe(true)
  })

  it('refuses anything not on the list, rather than passing it through', () => {
    for (const [field, value] of [
      ['intent', 'drop'],
      ['metric', 'everything'],
      ['period', 'forever'],
      ['grouping', 'password'],
      ['chart', 'exfiltrate'],
    ] as const) {
      const result = validatePlan({ ...good, [field]: value })
      expect(result.ok, field).toBe(false)
    }
  })

  it('refuses a filter naming a column that is not queryable', () => {
    // An allowlist has a fixed, readable size. A denylist is a losing game
    // played forever.
    const result = validatePlan({ ...good, filters: [{ field: 'secret', equals: 'x' }] })
    expect(result.ok).toBe(false)
  })

  it('builds the plan rather than casting the input', () => {
    const result = validatePlan({ ...good, evil: 'rm -rf', __proto__: { polluted: true } })
    expect(result.ok).toBe(true)
    // The difference between validation and hope: a merely CHECKED input still
    // carries every extra key straight into whatever reads it next.
    expect(result.ok && Object.keys(result.plan).sort()).toEqual([
      'chart',
      'filters',
      'grouping',
      'intent',
      'limit',
      'metric',
      'period',
    ])
  })

  it('caps the limit here, not wherever the model suggested', () => {
    expect(validatePlan({ ...good, limit: 10_000_000 })).toMatchObject({
      plan: { limit: MAX_LIMIT },
    })
    expect(validatePlan({ ...good, limit: -1 })).toMatchObject({ plan: { limit: MAX_LIMIT } })
  })

  it('refuses more filters than a question needs, and a payload-sized value', () => {
    const many = Array.from({ length: MAX_FILTERS + 1 }, () => ({
      field: 'status',
      equals: 'issued',
    }))
    expect(validatePlan({ ...good, filters: many }).ok).toBe(false)
    expect(
      validatePlan({ ...good, filters: [{ field: 'status', equals: 'x'.repeat(500) }] }).ok,
    ).toBe(false)
  })

  it('refuses a plan that is not an object at all', () => {
    for (const bad of [null, undefined, 'select 1', 42, []]) {
      expect(validatePlan(bad).ok, JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('No plan value reaches the SQL text (§N, §P)', () => {
  it('puts every filter VALUE in the parameter list', () => {
    const { sql, params } = compile(planOf({ filters: [{ field: 'status', equals: 'issued' }] }), ACME)

    expect(sql).not.toContain('issued')
    expect(params).toContain('issued')
    expect(sql).toContain('d.status = ?')
  })

  it('survives a filter value that is an injection attempt', () => {
    const hostile = "issued'; drop table documents; --"
    const { sql, params } = compile(
      planOf({ filters: [{ field: 'status', equals: hostile }] }),
      ACME,
    )

    // It is a value, and values are parameters. There is no concatenation for
    // it to escape from.
    expect(sql).not.toContain('drop')
    expect(sql).not.toContain(hostile)
    expect(params).toContain(hostile)
  })

  it('emits a SELECT and nothing else', () => {
    for (const plan of Object.values(CHIP_PLANS)) {
      const { sql } = compile(plan, ACME)
      expect(sql.trim().startsWith('select ')).toBe(true)
      expect(sql).not.toMatch(/\b(insert|update|delete|drop|alter|attach|pragma)\b/i)
    }
  })
})

describe('The company scope cannot be dropped (§P)', () => {
  it('is always the first condition, with the id as a parameter', () => {
    const { sql, params } = compile(planOf(), ACME)
    expect(sql).toContain('d.company_id = ?')
    expect(params[0]).toBe(ACME)
  })

  it('has no plan field that could express it', () => {
    // What cannot be expressed cannot be subverted. A plan simply has no
    // company key, so no plan can name another company's.
    const result = validatePlan({ ...good, company_id: 'someone-else' })
    expect(result.ok && 'company_id' in result.plan).toBe(false)
    const { params } = compile(planOf({ company_id: 'someone-else' }), ACME)
    expect(params).not.toContain('someone-else')
  })
})

describe('Money never crosses a currency (Rule #3)', () => {
  it('groups by currency whether the plan asked or not', () => {
    const { sql, shape } = compile(planOf({ grouping: 'none', metric: 'revenue' }), ACME)
    // One total spanning naira and cedis is not a total; it is two facts
    // added together as though they were one.
    expect(sql).toContain('d.currency')
    expect(sql).toContain('group by')
    expect(shape.money).toBe(true)
  })

  it('leaves a count alone, which is not money', () => {
    const { shape } = compile(planOf({ intent: 'count', metric: 'documents_issued' }), ACME)
    expect(shape.money).toBe(false)
  })
})

describe('A period is a half-open range', () => {
  it('ends where the next one begins, so a day is counted once', () => {
    const at = new Date(Date.UTC(2026, 5, 15))
    const thisMonth = rangeFor('this_month', at)
    const lastMonth = rangeFor('last_month', at)

    // Inclusive-both would count the last day of a month in two periods —
    // an arithmetic error a chart makes invisible.
    expect(lastMonth?.until).toBe(thisMonth?.from)
    expect(thisMonth).toEqual({ from: '2026-06-01', until: '2026-07-01' })
  })

  it('rolls a quarter and a year correctly', () => {
    const at = new Date(Date.UTC(2026, 10, 20))
    expect(rangeFor('this_quarter', at)).toEqual({ from: '2026-10-01', until: '2027-01-01' })
    expect(rangeFor('this_year', at)).toEqual({ from: '2026-01-01', until: '2027-01-01' })
    expect(rangeFor('last_year', at)).toEqual({ from: '2025-01-01', until: '2026-01-01' })
  })

  it('has no range at all for all time', () => {
    expect(rangeFor('all_time')).toBeNull()
  })
})

describe('Chips run on every tier (§N)', () => {
  it('are plans, so they reach the same compiler by the same path', () => {
    for (const [name, plan] of Object.entries(CHIP_PLANS)) {
      // Tier B and C have no model; a chip is a plan already chosen. The only
      // thing a model changes is whether a plan can be composed from words.
      expect(validatePlan(plan).ok, name).toBe(true)
      expect(compile(plan, ACME).params[0]).toBe(ACME)
    }
  })

  it('never include a draft in a business answer', () => {
    for (const plan of Object.values(CHIP_PLANS)) {
      // Drafts are not revenue, and counting them answers a question nobody
      // asked.
      expect(compile(plan, ACME).sql).toContain("d.status != 'draft'")
    }
  })
})
