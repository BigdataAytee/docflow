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
import { format } from '../../domain/locale/data/strings'
import { fieldsFor, validateBankDetails } from '../../domain/locale/bank-fields'

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

      <section className="space-y-3 rounded-2xl bg-white/85 p-4">
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
                className="min-h-tap w-full rounded-lg bg-page px-3 text-sm shadow-inner"
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

      <ul className="divide-y divide-navy/8 overflow-hidden rounded-2xl bg-white/85">
        {methods.map((method) => (
          <li key={method.id} className="flex items-center gap-3 p-3">
            <span className="flex-1 text-sm font-medium">{method.name}</span>
            <button
              type="button"
              role="switch"
              aria-checked={method.enabled}
              aria-label={method.name}
              onClick={() => onToggleMethod(method.id, !method.enabled)}
              className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 ${
                method.enabled ? 'justify-end bg-status-good' : 'justify-start bg-navy/25'
              }`}
            >
              <span className="h-5 w-5 rounded-full bg-white" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
