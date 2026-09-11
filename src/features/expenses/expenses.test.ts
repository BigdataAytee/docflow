/**
 * Recording an expense (§G, §L6).
 *
 * The rule under test that matters most: a receipt photo is evidence, never a
 * source of an amount (Rule #3 — money is never inferred).
 */

import { describe, expect, it } from 'vitest'

import { money } from '../../domain/money/money'
import { ExpenseError, knownCategories, recordExpense, sortExpenses } from './record'

const NGN = (m: number) => money('NGN', m)

const base = {
  id: 'exp_1',
  companyId: 'co_1',
  amount: NGN(12_500_00),
  spentOn: '2026-09-11',
}

describe('The three-field sheet (§G)', () => {
  it('records amount, date and what it was for', () => {
    const expense = recordExpense({ ...base, description: 'Diesel for the generator' })
    expect(expense.amount).toEqual(NGN(12_500_00))
    expect(expense.spentOn).toBe('2026-09-11')
    expect(expense.description).toBe('Diesel for the generator')
    expect(expense.category).toBeUndefined()
  })

  it('accepts a receipt photo instead of a description', () => {
    const expense = recordExpense({ ...base, photoAssetId: 'asset_9' })
    expect(expense.photoAssetId).toBe('asset_9')
    expect(expense.description).toBe('')
  })

  it('will not take a photo INSTEAD of an amount — money is never inferred', () => {
    expect(() =>
      recordExpense({ ...base, amount: NGN(0), photoAssetId: 'asset_9' }),
    ).toThrow(ExpenseError)
  })

  it('refuses a negative expense', () => {
    expect(() => recordExpense({ ...base, amount: NGN(-1), description: 'Refund?' })).toThrow(
      ExpenseError,
    )
  })

  it('asks for one of the two evidences, not both', () => {
    expect(() => recordExpense({ ...base, description: '   ' })).toThrowError(
      expect.objectContaining({ field: 'evidence' }),
    )
    expect(() => recordExpense({ ...base, description: 'Fuel' })).not.toThrow()
    expect(() => recordExpense({ ...base, photoAssetId: 'asset_9' })).not.toThrow()
  })

  it('refuses a date it cannot read', () => {
    expect(() => recordExpense({ ...base, spentOn: 'yesterday', description: 'Fuel' })).toThrow(
      ExpenseError,
    )
  })

  it('keeps the day and drops any time of day', () => {
    const expense = recordExpense({ ...base, spentOn: '2026-09-11T16:20:00Z', description: 'Fuel' })
    expect(expense.spentOn).toBe('2026-09-11')
  })

  it('adds no required field — category is optional and blank means absent', () => {
    expect(recordExpense({ ...base, description: 'Fuel', category: '  ' }).category).toBeUndefined()
    expect(recordExpense({ ...base, description: 'Fuel', category: 'Transport' }).category).toBe(
      'Transport',
    )
  })

  it('is frozen once recorded', () => {
    const expense = recordExpense({ ...base, description: 'Fuel' })
    expect(Object.isFrozen(expense)).toBe(true)
  })
})

describe('The expense list (§G)', () => {
  const rows = [
    recordExpense({ ...base, id: 'exp_1', spentOn: '2026-09-01', description: 'Fuel', category: 'Transport' }),
    recordExpense({ ...base, id: 'exp_2', spentOn: '2026-09-11', description: 'Airtime', category: 'Airtime' }),
    recordExpense({ ...base, id: 'exp_3', spentOn: '2026-09-05', description: 'Fuel', category: 'Transport' }),
  ]

  it('shows the most recent first', () => {
    expect(sortExpenses(rows).map((row) => row.id)).toEqual(['exp_2', 'exp_3', 'exp_1'])
  })

  it('suggests the categories already used, commonest first', () => {
    expect(knownCategories(rows)).toEqual(['Transport', 'Airtime'])
  })

  it('suggests nothing when nothing has been categorised', () => {
    expect(knownCategories([recordExpense({ ...base, description: 'Fuel' })])).toEqual([])
  })
})
