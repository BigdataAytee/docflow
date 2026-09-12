/**
 * Analytics, wired (§G, §L6).
 *
 * Every figure comes from `src/features/analytics`, so what is on screen is
 * what the property tests bind. Adding an expense goes through the repository
 * and the page re-reads — "Kept" moves because it is recomputed, not because
 * anything here updates a total (Rule #3).
 */

import { useMemo } from 'react'

import { useAppData } from '../store'
import { Analytics } from '../../features/analytics/Analytics'
import { knownCategories } from '../../features/expenses/record'
import { analyticsRecords, customerNames, customerOf } from '../derive'

export function AnalyticsScreen({ today = new Date().toISOString().slice(0, 10) }: { today?: string }) {
  const { company, customers, documents, payments, expenses, creditNotes, loading, actions } =
    useAppData()

  const records = useMemo(() => analyticsRecords(documents), [documents])

  const expenseEntries = useMemo(
    () => expenses.map((expense) => ({ id: expense.id, amount: expense.amount, spentOn: expense.spentOn })),
    [expenses],
  )

  const expenseLines = useMemo(
    () =>
      [...expenses]
        .sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.id.localeCompare(a.id))
        .map((expense) => ({
          id: expense.id,
          description: expense.description,
          amount: expense.amount,
          spentOn: expense.spentOn,
          ...(expense.category === undefined ? {} : { category: expense.category }),
        })),
    [expenses],
  )

  const categories = useMemo(
    () =>
      knownCategories(
        expenses.map((expense) => ({
          id: expense.id,
          companyId: expense.companyId,
          amount: expense.amount,
          spentOn: expense.spentOn,
          description: expense.description,
          ...(expense.category === undefined ? {} : { category: expense.category }),
        })),
      ),
    [expenses],
  )

  return (
    <Analytics
      documents={records}
      payments={payments}
      expenses={expenseEntries}
      expenseLines={expenseLines}
      customerNames={customerNames(customers)}
      customerOf={customerOf(documents)}
      creditNotes={creditNotes}
      today={today}
      defaultCurrency={company?.currency ?? 'NGN'}
      knownCategories={categories}
      loading={loading}
      onAddExpense={(input) => {
        void actions.addExpense({
          amount: input.amount,
          spentOn: input.spentOn,
          description: input.description,
          ...(input.category === undefined ? {} : { category: input.category }),
        })
      }}
    />
  )
}
