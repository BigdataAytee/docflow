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
import { filterByLabels, labelsInUse } from './labels'
import { formatMoney } from './formatMoney'
import type { CreditNote, Payment } from '../../domain/payments/ledger'

export interface CustomerListProps {
  readonly invoices: readonly BilledInvoice[]
  readonly payments: readonly Payment[]
  /** A credited invoice owes less, so the card's badge says less (§E). */
  readonly creditNotes?: readonly CreditNote[]
  readonly onOpen?: (customer: Customer) => void
  readonly onAdd?: () => void
}

export function CustomerList({
  invoices,
  payments,
  creditNotes = [],
  onOpen,
  onAdd,
}: CustomerListProps) {
  const { companyId, repositories, strings } = useCompany()
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [query, setQuery] = useState('')
  const [selectedLabels, setSelectedLabels] = useState<readonly string[]>([])

  useEffect(() => {
    let live = true
    void repositories.customers.list(companyId).then((rows) => {
      if (live) setCustomers(rows)
    })
    return () => {
      live = false
    }
  }, [companyId, repositories])

  // The filter row exists only once labels do (Rule #1: nothing is required,
  // so nothing about labels appears for a business that never uses them).
  const availableLabels = useMemo(
    () => (customers === null ? [] : labelsInUse(customers)),
    [customers],
  )

  const visible = useMemo(() => {
    if (customers === null) return null
    const labelled = filterByLabels(customers, selectedLabels)
    const q = query.trim().toLocaleLowerCase()
    if (q === '') return labelled
    return labelled.filter((c) =>
      [c.name, c.phone, c.email, c.address, ...c.labels]
        .filter((v): v is string => typeof v === 'string')
        .some((v) => v.toLocaleLowerCase().includes(q)),
    )
  }, [customers, query, selectedLabels])

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

      {availableLabels.length > 0 && (
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label={strings.customers.filterByLabel}
        >
          {availableLabels.map((label) => {
            const on = selectedLabels.includes(label)
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  on ? 'bg-brand text-white' : 'border border-black/10 bg-white'
                }`}
                onClick={() =>
                  setSelectedLabels((current) =>
                    current.includes(label)
                      ? current.filter((existing) => existing !== label)
                      : [...current, label],
                  )
                }
              >
                {label}
              </button>
            )
          })}
          {selectedLabels.length > 0 && (
            <button
              type="button"
              className="px-2 py-1.5 text-xs font-medium opacity-70"
              onClick={() => setSelectedLabels([])}
            >
              {strings.customers.clearLabelFilter}
            </button>
          )}
        </div>
      )}

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
          <EmptyState
            title={strings.customers.noMatchTitle}
            body={
              selectedLabels.length > 0 && query.trim() === ''
                ? strings.customers.noneWithLabel
                : strings.customers.noMatchBody
            }
          />
        )}

        {/* The empty state offers the first one; after that the `+` is how
            another is added, matching the document lists' FAB (§G). */}
        {onAdd !== undefined && visible !== null && visible.length > 0 && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={strings.customers.add}
            className="mb-2 grid h-11 w-11 place-items-center rounded-full bg-brand text-xl font-bold text-white"
          >
            +
          </button>
        )}

        {visible !== null && visible.length > 0 && (
          <ul className="space-y-2">
            {visible.map((customer) => (
              <li key={customer.id}>
                <CustomerCard
                  customer={customer}
                  invoices={invoices}
                  payments={payments}
                  creditNotes={creditNotes}
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
  creditNotes,
  onOpen,
}: {
  customer: Customer
  invoices: readonly BilledInvoice[]
  payments: readonly Payment[]
  creditNotes: readonly CreditNote[]
  onOpen?: ((customer: Customer) => void) | undefined
}) {
  const { strings } = useCompany()
  const balances = customerBalances(customer.id, invoices, payments, creditNotes)
  const owing = hasOutstanding(balances)

  return (
    <button
      type="button"
      onClick={() => onOpen?.(customer)}
      className="flex min-h-tap w-full items-center gap-3 rounded-2xl bg-white/80 p-3 text-start"
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
        {customer.labels.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {customer.labels.map((label) => (
              <span
                key={label}
                className="rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-medium text-brand"
              >
                {label}
              </span>
            ))}
          </span>
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
