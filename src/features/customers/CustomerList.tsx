/**
 * The customers screen (§G — Customers).
 *
 * "Cards with avatar, name, address, balance right."
 *
 * Ships with everything §C requires of a screen: a skeleton while loading, a
 * distinct empty state for "none yet" and for "nothing matched", accessible
 * names on every control, and no spinner or blank frame at any point.
 */

import { useEffect, useMemo, useState } from 'react'

import { useCompany } from '../../app/context'
import type { Customer } from '../../data/repositories'
import { EmptyState, SkeletonList, StatusBadge } from '../../ui'
import { format } from '../../domain/locale/data/strings'
import { type BilledInvoice, customerBalances, hasOutstanding } from './balance'
import { formatMoney } from './formatMoney'
import type { Payment } from '../../domain/payments/ledger'

export interface CustomerListProps {
  readonly invoices: readonly BilledInvoice[]
  readonly payments: readonly Payment[]
  readonly onOpen?: (customer: Customer) => void
  readonly onAdd?: () => void
}

export function CustomerList({ invoices, payments, onOpen, onAdd }: CustomerListProps) {
  const { companyId, repositories, strings } = useCompany()
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let live = true
    void repositories.customers.list(companyId).then((rows) => {
      if (live) setCustomers(rows)
    })
    return () => {
      live = false
    }
  }, [companyId, repositories])

  const visible = useMemo(() => {
    if (customers === null) return null
    const q = query.trim().toLocaleLowerCase()
    if (q === '') return customers
    return customers.filter((c) =>
      [c.name, c.phone, c.email, c.address]
        .filter((v): v is string => typeof v === 'string')
        .some((v) => v.toLocaleLowerCase().includes(q)),
    )
  }, [customers, query])

  return (
    <section className="px-4 py-4">
      <label className="block">
        <span className="sr-only">{strings.customers.searchPlaceholder}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={strings.customers.searchPlaceholder}
          aria-label={strings.customers.searchPlaceholder}
          className="min-h-tap w-full rounded-lg bg-white/80 px-4 text-sm shadow-inner"
        />
      </label>

      <div className="mt-4">
        {/* Skeleton, never a spinner (§C). */}
        {visible === null && <SkeletonList rows={3} label={strings.common.loading} />}

        {visible !== null && visible.length === 0 && customers?.length === 0 && (
          <EmptyState
            title={strings.customers.emptyTitle}
            body={strings.customers.emptyBody}
            action={
              onAdd === undefined ? undefined : (
                <button
                  type="button"
                  onClick={onAdd}
                  className="min-h-tap rounded-full bg-brand px-5 text-sm font-semibold text-white"
                >
                  {strings.customers.addFirst}
                </button>
              )
            }
          />
        )}

        {visible !== null && visible.length === 0 && (customers?.length ?? 0) > 0 && (
          <EmptyState title={strings.customers.noMatchTitle} body={strings.customers.noMatchBody} />
        )}

        {visible !== null && visible.length > 0 && (
          <ul className="space-y-2">
            {visible.map((customer) => (
              <li key={customer.id}>
                <CustomerCard
                  customer={customer}
                  invoices={invoices}
                  payments={payments}
                  onOpen={onOpen}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function CustomerCard({
  customer,
  invoices,
  payments,
  onOpen,
}: {
  customer: Customer
  invoices: readonly BilledInvoice[]
  payments: readonly Payment[]
  onOpen?: ((customer: Customer) => void) | undefined
}) {
  const { strings } = useCompany()
  const balances = customerBalances(customer.id, invoices, payments)
  const owing = hasOutstanding(balances)

  return (
    <button
      type="button"
      onClick={() => onOpen?.(customer)}
      className="flex min-h-tap w-full items-center gap-3 rounded-2xl bg-white/80 p-3 text-left"
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-tint text-sm font-bold text-brand"
        aria-hidden="true"
      >
        {customer.name.trim().charAt(0).toLocaleUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{customer.name}</span>
        {customer.address !== undefined && (
          <span className="block truncate text-xs opacity-70">{customer.address}</span>
        )}
      </span>
      <span className="shrink-0">
        {/* Each currency shown separately — never summed (§G). */}
        {owing ? (
          balances
            .filter((b) => b.owing.minor > 0)
            .map((b) => (
              <StatusBadge
                key={b.currency}
                status="unpaid"
                label={format(strings.customers.owes, { amount: formatMoney(b.owing) })}
              />
            ))
        ) : (
          <StatusBadge status="settled" label={strings.customers.settled} />
        )}
      </span>
    </button>
  )
}
