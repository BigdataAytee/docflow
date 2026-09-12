/**
 * Adding a customer (§G).
 *
 * The name is the only thing asked for. Rule #1 — no new required fields,
 * ever — so phone, email, address and whether this is a business or a person
 * are all offered and all skippable; a customer typed in mid-document should
 * cost one field, not six.
 *
 * §G also puts a "+ Add…" inside the builder's customer dropdown, carrying
 * whatever was typed. That picker does not exist yet, so `initialName` is here
 * for it to use when it does, rather than a second sheet being written later.
 */

import { useId, useState } from 'react'

import { useCompany } from '../../app/context'
import type { Customer } from '../../data/repositories'

export type NewCustomer = Omit<Customer, 'id' | 'companyId'>

export interface CustomerSheetProps {
  readonly initialName?: string
  readonly onSave: (customer: NewCustomer) => void
  readonly onCancel: () => void
}

export function CustomerSheet({ initialName = '', onSave, onCancel }: CustomerSheetProps) {
  const { strings } = useCompany()
  const ids = useId()

  const [name, setName] = useState(initialName)
  const [kind, setKind] = useState<Customer['kind']>('company')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')

  const trimmed = name.trim()

  // The form carries its own name, not the `+` button's: two things sharing one
  // accessible name is one too many for anyone navigating by label.
  return (
    <form
      className="rounded-2xl bg-white/80 p-4 backdrop-blur"
      aria-label={strings.customers.newCustomer}
      onSubmit={(event) => {
        event.preventDefault()
        if (trimmed === '') return
        onSave({
          kind,
          name: trimmed,
          labels: [],
          // Absent, not empty: an empty string on the record would print as a
          // blank line on a document (§I).
          ...(phone.trim() === '' ? {} : { phone: phone.trim() }),
          ...(email.trim() === '' ? {} : { email: email.trim() }),
          ...(address.trim() === '' ? {} : { address: address.trim() }),
        })
      }}
    >
      <label className="block text-xs font-medium opacity-70" htmlFor={`${ids}-name`}>
        {strings.customers.name}
      </label>
      <input
        id={`${ids}-name`}
        className="mt-1 min-h-tap w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <div className="mt-3 flex gap-2" role="group" aria-label={strings.customers.isCompany}>
        {(['company', 'person'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={kind === option}
            className={`min-h-tap flex-1 rounded-xl border text-sm font-medium ${
              kind === option ? 'border-transparent bg-brand text-white' : 'border-black/10 bg-white'
            }`}
            onClick={() => setKind(option)}
          >
            {option === 'company' ? strings.customers.isCompany : strings.customers.isPerson}
          </button>
        ))}
      </div>

      <Field id={`${ids}-phone`} label={strings.customers.phone} value={phone} onChange={setPhone} />
      <Field id={`${ids}-email`} label={strings.customers.email} value={email} onChange={setEmail} />
      <Field
        id={`${ids}-address`}
        label={strings.customers.address}
        value={address}
        onChange={setAddress}
      />

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="min-h-tap flex-1 rounded-xl text-sm font-medium opacity-70"
          onClick={onCancel}
        >
          {strings.common.cancel}
        </button>
        <button
          type="submit"
          className="min-h-tap flex-1 rounded-xl bg-brand text-sm font-semibold text-white disabled:opacity-40"
          disabled={trimmed === ''}
        >
          {strings.customers.save}
        </button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <>
      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="mt-1 min-h-tap w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </>
  )
}
