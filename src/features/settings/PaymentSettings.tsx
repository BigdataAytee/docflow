/**
 * Settings → How you get paid (§J, §G).
 *
 * "One definition per currency, read by both the settings form and the PDF."
 * The form below renders from `fieldsFor`, and `paymentBoxRows` renders the
 * printed box from the same definition — so they cannot drift, and no field
 * can be invented for a country that lacks it.
 *
 * "Switching currency re-renders the fields and says so" (§J), which is why
 * the notice is a first-class piece of the screen rather than a silent swap.
 */

import { useCompany } from '../../app/context'
import { type UiStrings, format } from '../../domain/locale/data/strings'
import { fieldsFor, validateBankDetails } from '../../domain/locale/bank-fields'
import type { BankField } from '../../domain/locale/data/currencies'
import { Icon, type IconName } from '../../ui'

/** Fixed to the method, like every other icon pairing in the app (§F). */
const METHOD_ICONS: Readonly<Record<string, IconName>> = {
  bank_transfer: 'building',
  cash_on_delivery: 'cash',
}

/**
 * What a row says under the method's name.
 *
 * Bank transfer shows the live account (§J); anything else shows the one line
 * that explains what it means for the customer. Never a status word — the
 * chip on the right already says whether it is on, and a row that says "On"
 * twice has spent its second line saying nothing.
 */
function sublabelFor(
  id: string,
  fields: readonly BankField[],
  values: Readonly<Record<string, string>>,
  strings: UiStrings,
): string {
  if (id !== 'bank_transfer') return strings.settings.cashOnDeliveryHint

  const filled = fields.map((field) => values[field.kind]?.trim()).filter((value) => value)
  return filled.length === 0 ? strings.settings.noAccountYet : filled.join(' · ')
}

export interface PaymentMethodState {
  readonly id: string
  readonly name: string
  readonly enabled: boolean
}

export interface PaymentSettingsProps {
  readonly currency: string
  /** True when the currency changed since these fields were last filled (§J). */
  readonly currencyJustChanged?: boolean
  readonly bankValues: Readonly<Record<string, string>>
  readonly methods: readonly PaymentMethodState[]
  readonly onBankValue: (kind: string, value: string) => void
  readonly onToggleMethod: (id: string, next: boolean) => void
}

export function PaymentSettings({
  currency,
  currencyJustChanged = false,
  bankValues,
  methods,
  onBankValue,
  onToggleMethod,
}: PaymentSettingsProps) {
  const { strings } = useCompany()
  const fields = fieldsFor(currency)
  const problems = validateBankDetails({ currency, values: bankValues })
  const enabledCount = methods.filter((method) => method.enabled).length

  return (
    <section className="space-y-4 px-4 py-4">
      <header>
        <h1 className="text-lg font-bold">{strings.settings.howYouGetPaid}</h1>
        <p className="text-xs opacity-70">
          {enabledCount === 0
            ? strings.settings.noMethodsYet
            : format(strings.settings.methodsOn, { count: enabledCount })}
        </p>
      </header>

      {currencyJustChanged && (
        <p role="status" className="rounded-2xl bg-status-info-tint p-3 text-xs text-status-info">
          {strings.settings.currencyChanged}
        </p>
      )}

      <section className="glass-solid space-y-3 rounded-2xl p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide opacity-60">
          {strings.settings.bankTransfer}
        </h2>
        {/* Rendered from the §J definition — never a hand-written form. */}
        {fields.map((field) => {
          const problem = problems.find((p) => p.kind === field.kind)
          return (
            <label key={field.kind} className="block">
              <span className="mb-1 block text-xs font-medium opacity-70">{field.label}</span>
              <input
                // Always text: leading zeroes are significant (§K).
                type="text"
                inputMode="text"
                value={bankValues[field.kind] ?? ''}
                onChange={(event) => onBankValue(field.kind, event.target.value)}
                aria-label={field.label}
                aria-invalid={problem !== undefined}
                className="sunken min-h-tap w-full rounded-lg px-3 text-sm"
              />
              {problem !== undefined && (
                // Beside the field, input retained — never a shake, never red
                // alone (§K).
                <span className="mt-1 block text-xs text-status-warn">{problem.message}</span>
              )}
            </label>
          )
        })}
      </section>

      <p className="px-1 text-xs font-bold uppercase tracking-wide opacity-60">
        {strings.settings.paymentMethods}
      </p>
      <ul className="glass-solid divide-y divide-ink/10 overflow-hidden rounded-2xl">
        {methods.map((method) => (
          <li key={method.id} className="flex items-center gap-3 p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Icon name={METHOD_ICONS[method.id] ?? 'credit-card'} className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{method.name}</span>
              {/*
                §J: "the bank-transfer row shows the live account details".
                The row says what a customer will actually be told to pay
                into, so a stale or empty account is visible here rather than
                discovered on a sent invoice.
              */}
              <span className="block truncate text-xs opacity-65">
                {sublabelFor(method.id, fields, bankValues, strings)}
              </span>
            </span>
            {/*
              A toggle BUTTON rather than a switch, because the reference's
              two states say different things: "On" is a state you can end,
              "Add" is an invitation. `aria-pressed` keeps it a toggle for a
              screen reader, and the accessible name stays the method rather
              than the word on the chip.
            */}
            <button
              type="button"
              aria-pressed={method.enabled}
              aria-label={method.name}
              onClick={() => onToggleMethod(method.id, !method.enabled)}
              className={`min-h-tap shrink-0 rounded-full px-3 text-xs font-semibold ${
                method.enabled
                  ? 'bg-status-good-tint text-status-good'
                  : 'glass-pill text-brand'
              }`}
            >
              {method.enabled ? strings.settings.methodOn : strings.settings.methodAdd}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
