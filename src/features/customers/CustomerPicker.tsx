/**
 * The builder's customer card (§G, step 1).
 *
 * "Avatar+name+address row opening a searchable dropdown with '+ Add…'
 * carrying whatever was typed; Chat and Call chips; a balance chip ('Owes
 * ₦95,000' / 'Settled'); a small `+` in the card header adds a contact
 * directly."
 *
 * The two details that make or break it:
 *
 *  · **"+ Add…" carries whatever was typed.** Somebody halfway through a
 *    document types a name that is not in the list; retyping it into a blank
 *    form is the moment they put the phone down. The typed text becomes the
 *    new customer's name.
 *  · **The balance chip is the real balance**, from `customerBalances` — the
 *    same figures the contact page shows. A number here that disagreed with
 *    the one two taps away would make both untrustworthy.
 *
 * The card is never blank: with nobody chosen it says so and offers the
 * search, which is also the add (§L8 — never a blank screen).
 */

import { useMemo, useState } from 'react'

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import type { Customer } from '../../data/repositories'
import type { Payment } from '../../domain/payments/ledger'
import { StatusBadge } from '../../ui'
import { type BilledInvoice, customerBalances, hasOutstanding } from './balance'
import { CustomerSheet, type NewCustomer } from './CustomerSheet'
import { formatMoney } from './formatMoney'

export interface CustomerPickerProps {
  readonly customers: readonly Customer[]
  readonly selectedId?: string
  readonly invoices: readonly BilledInvoice[]
  readonly payments: readonly Payment[]
  readonly onSelect: (id: string) => void
  readonly onAdd: (customer: NewCustomer) => void
  /** Delivery documents carry no money, so no balance chip appears (§G, §I). */
  readonly showBalance?: boolean
}

export function CustomerPicker({
  customers,
  selectedId,
  invoices,
  payments,
  onSelect,
  onAdd,
  showBalance = true,
}: CustomerPickerProps) {
  const { strings } = useCompany()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)

  const selected = customers.find((row) => row.id === selectedId)

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    if (q === '') return customers
    return customers.filter((row) =>
      [row.name, row.phone, row.email, row.address]
        .filter((value): value is string => typeof value === 'string')
        .some((value) => value.toLocaleLowerCase().includes(q)),
    )
  }, [customers, query])

  const typed = query.trim()

  if (adding) {
    return (
      <CustomerSheet
        initialName={typed}
        onCancel={() => setAdding(false)}
        onSave={(fresh) => {
          setAdding(false)
          setOpen(false)
          setQuery('')
          onAdd(fresh)
        }}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex min-h-tap min-w-0 flex-1 items-center gap-3 rounded-lg bg-page px-3 text-start shadow-inner"
          aria-expanded={open}
          aria-label={strings.details.chooseCustomer}
          onClick={() => setOpen((was) => !was)}
        >
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-tint text-xs font-bold text-brand"
            aria-hidden="true"
          >
            {selected === undefined ? '?' : selected.name.trim().charAt(0).toLocaleUpperCase()}
          </span>
          <span className="min-w-0 flex-1 py-2">
            <span className="block truncate text-sm font-semibold">
              {selected?.name ?? strings.details.nobodyChosen}
            </span>
            {selected?.address !== undefined && (
              <span className="block truncate text-xs opacity-70">{selected.address}</span>
            )}
          </span>
          <span className="shrink-0 text-xs font-medium opacity-60">
            {selected === undefined ? '' : strings.details.change}
          </span>
        </button>

        {/* §G's small `+` in the card header: straight to the form, no search. */}
        <button
          type="button"
          aria-label={strings.customers.add}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-lg font-bold text-white"
          onClick={() => {
            setQuery('')
            setAdding(true)
          }}
        >
          +
        </button>
      </div>

      {selected !== undefined && (
        <Chips customer={selected} invoices={invoices} payments={payments} showBalance={showBalance} />
      )}

      {open && (
        <div className="rounded-xl border border-black/10 bg-white p-2">
          <input
            type="search"
            className="min-h-tap w-full rounded-lg bg-page px-3 text-sm shadow-inner"
            placeholder={strings.details.searchCustomers}
            aria-label={strings.details.searchCustomers}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {matches.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex min-h-tap w-full flex-col justify-center rounded-lg px-3 text-start hover:bg-black/[0.04]"
                  onClick={() => {
                    onSelect(row.id)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <span className="break-words text-sm font-medium">{row.name}</span>
                  {row.address !== undefined && (
                    <span className="break-words text-xs opacity-60">{row.address}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {matches.length === 0 && typed === '' && (
            <p className="px-3 py-2 text-xs opacity-70">{strings.details.noCustomerMatch}</p>
          )}

          {/* Carries whatever was typed into the form (§G). */}
          {typed !== '' && (
            <button
              type="button"
              className="mt-1 min-h-tap w-full rounded-lg bg-brand-tint px-3 text-start text-sm font-semibold text-brand"
              onClick={() => setAdding(true)}
            >
              {format(strings.details.addNamed, { name: typed })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Chat, Call and the balance chip (§G). */
function Chips({
  customer,
  invoices,
  payments,
  showBalance,
}: {
  customer: Customer
  invoices: readonly BilledInvoice[]
  payments: readonly Payment[]
  showBalance: boolean
}) {
  const { strings } = useCompany()

  const digits = customer.phone?.replace(/\D/g, '') ?? ''
  const balances = customerBalances(customer.id, invoices, payments)
  const owing = hasOutstanding(balances)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {digits !== '' && (
        <>
          <a
            href={`https://wa.me/${digits}`}
            className="min-h-tap rounded-full bg-status-good-tint px-3 py-2 text-xs font-semibold text-status-good"
          >
            {strings.contact.chat}
          </a>
          <a
            href={`tel:${customer.phone ?? ''}`}
            className="min-h-tap rounded-full bg-page px-3 py-2 text-xs font-semibold"
          >
            {strings.contact.call}
          </a>
        </>
      )}

      {showBalance &&
        (owing ? (
          // One chip per currency — §G never adds NGN to USD.
          balances
            .filter((balance) => balance.owing.minor > 0)
            .map((balance) => (
              <StatusBadge
                key={balance.currency}
                status="unpaid"
                label={format(strings.customers.owes, { amount: formatMoney(balance.owing) })}
              />
            ))
        ) : (
          <StatusBadge status="settled" label={strings.customers.settled} />
        ))}
    </div>
  )
}
