/**
 * Customers and the statement page (§G, §L5).
 */

import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { useCompany } from '../context'
import { useAppData } from '../store'
import { CUSTOMERS, HOME, statementPath } from '../paths'
import { CustomerList } from '../../features/customers/CustomerList'
import { StatementPage } from '../../features/statements/StatementPage'
import { composeStatement, statementCurrencies } from '../../features/statements/compose'
import type { BilledInvoice } from '../../features/customers/balance'
import { shiftMonths } from '../../features/analytics/inOutKept'
import { PageHeader, SkeletonList } from '../../ui'
import { statementDocuments, totalOf } from '../derive'

/** What `customerBalances` needs of an invoice — issued, non-void, with a total. */
function billedInvoices(
  documents: ReturnType<typeof useAppData>['documents'],
): BilledInvoice[] {
  return documents
    .filter(
      (document) =>
        document.type === 'invoice' &&
        document.customerId !== undefined &&
        // Nothing was billed until it was dated and issued (§M).
        document.issueDate !== undefined,
    )
    .map((document) => ({
      id: document.id,
      customerId: document.customerId ?? '',
      status: document.status,
      total: totalOf(document),
      issueDate: document.issueDate ?? '',
      ...(document.dueDate === undefined ? {} : { dueDate: document.dueDate }),
    }))
}

export function CustomersScreen() {
  const { documents, payments } = useAppData()
  const navigate = useNavigate()

  const invoices = useMemo(() => billedInvoices(documents), [documents])

  return (
    <CustomerList
      invoices={invoices}
      payments={payments}
      onOpen={(customer) => {
        // §G's contact page is its own screen and is not invented here; the
        // statement is the part of it that exists, so that is where this goes.
        const currencies = statementCurrencies(customer.id, statementDocuments(documents), payments)
        const currency = currencies[0]
        if (currency !== undefined) navigate(statementPath(customer.id, currency))
      }}
    />
  )
}

export function StatementScreen({ today = new Date().toISOString().slice(0, 10) }: { today?: string }) {
  const { customerId, currency } = useParams<{ customerId: string; currency: string }>()
  const { strings } = useCompany()
  const { company, customers, documents, payments, loading } = useAppData()

  const customer = customers.find((row) => row.id === customerId)

  const statement = useMemo(() => {
    if (customerId === undefined || currency === undefined) return null
    return composeStatement({
      customerId,
      currency,
      // A statement needs a period; §G says "any period". The last twelve
      // months is the opening offer, not a hidden assumption — the dates are
      // printed on the page.
      from: shiftMonths(today, -11),
      to: shiftMonths(today, 1),
      documents: statementDocuments(documents),
      payments,
    })
  }, [customerId, currency, documents, payments, today])

  if (loading) return <SkeletonList rows={4} label={strings.common.loading} />
  if (statement === null || customer === undefined) return <Navigate to={CUSTOMERS} replace />

  return (
    <div className="pb-28">
      <PageHeader title={strings.statements.title} eyebrow={customer.name} />
      <div className="px-4 pt-4">
        <StatementPage
          statement={statement}
          businessName={company?.name ?? ''}
          customerName={customer.name}
        />
      </div>
    </div>
  )
}

export const CUSTOMERS_HOME = HOME
