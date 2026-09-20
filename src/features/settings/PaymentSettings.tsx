/**
 * Settings → How you get paid (§J, §G, Rule #1).
 *
 * "One definition per currency, read by both the settings form and the PDF."
 * The form renders from `fieldsFor`, and `paymentBoxRows` renders the printed
 * box from the same definition — so they cannot drift, and no field can be
 * invented for a country that lacks it.
 *
 * THE FORM IS NOW BEHIND "ADD", which is what the screen was always saying
 * and never doing. It opened with three empty bank fields at the top — a form
 * nobody had asked for, above a list of methods where the actual decision
 * lives — so an owner who only wanted cash on delivery still had to scroll
 * past somebody else's bank account. The fields belong to the method, and
 * they come out when the method does.
 *
 * AND THE COUNTRY IS THE FIRST QUESTION IN IT. §J keys the field set to the
 * CURRENCY, which is right — the definition is about the account, not the
 * business — but "NGN" is not what anybody knows about their own bank. They
 * know it is a Nigerian account. So the form asks for the country and
 * resolves the currency from it, and the field set underneath is §J's, for
 * that currency, unchanged. Nothing here invents a banking rule: an unlisted
 * market still falls through to `currencyDefinition`'s generic set.
 *
 * The country is PRE-ANSWERED from the business's own region, because the app
 * already knows it and Rule #1 forbids asking again. It sits at the top of
 * the form where it can be changed — a Nigerian business holding a sterling
 * account picks the United Kingdom and the fields become Bank · Sort code ·
 * Account number · Account name, with a line saying so (§J's "switching
 * currency re-renders the fields and says so").
 */

import { useMemo, useState } from 'react'

import { useCompany } from '../../app/context'
import { type UiStrings, format } from '../../domain/locale/data/strings'
import { fieldsFor, validateBankDetails } from '../../domain/locale/bank-fields'
import { COUNTRY_CURRENCY, countriesByName, countryName } from '../../domain/locale/data/countries'
import type { BankField } from '../../domain/locale/data/currencies'
import { Icon, type IconName } from '../../ui'
import { PaymentLinkSection } from './PaymentLinkSection'
import type { SavedPaymentLink } from '../../domain/payments/links'

/** Fixed to the method, like every other icon pairing in the app (§F). */
const METHOD_ICONS: Readonly<Record<string, IconName>> = {
  bank_transfer: 'building',
  cash_on_delivery: 'cash',
}

/**
 * The currency an account in this country is held in (§J).
 *
 * A lookup, not a rule: `COUNTRY_CURRENCY` is the same table the region
 * picker and the onboarding screen read, and the field set still comes from
 * §J's currency definition. A country nobody has listed falls back to the
 * company's own currency rather than to a guess.
 */
export const currencyForCountry = (country: string, fallback: string): string =>
  COUNTRY_CURRENCY[country.trim().toUpperCase()] ?? fallback

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
  /** The business's own currency, and the fallback for an unlisted country. */
  readonly currency: string
  /** The business's country, which pre-answers the account's (§G, Rule #1). */
  readonly region: string
  /** Where the account is held, when the owner has said (§J). */
  readonly accountCountry?: string
  /** True when the currency changed since these fields were last filled (§J). */
  readonly currencyJustChanged?: boolean
  readonly bankValues: Readonly<Record<string, string>>
  readonly methods: readonly PaymentMethodState[]
  readonly onBankValue: (kind: string, value: string) => void
  readonly onAccountCountry: (country: string) => void
  readonly onToggleMethod: (id: string, next: boolean) => void
  /** §J's pasted links. Absent hides the section entirely. */
  readonly paymentLinks?: readonly SavedPaymentLink[]
  /**
   * Every id switched on, links included (§J).
   *
   * Separate from `methods` on purpose: that list is what the screen DRAWS
   * as rows, and this is what the company has actually enabled. A link
   * provider appears in the second and never in the first.
   */
  readonly enabledMethodIds?: readonly string[]
  readonly onPaymentLinks?: (links: readonly SavedPaymentLink[]) => void
}

/**
 * The account form, which only exists once somebody has asked for it.
 *
 * Kept as its own component so the list above it stays readable, and so the
 * country → currency → fields chain is one thing to look at rather than three
 * conditionals threaded through a longer render.
 */
function AccountDetails({
  country,
  currency,
  fields,
  values,
  problems,
  showsProblem,
  onValue,
  onTouch,
  onCountry,
  onDone,
}: {
  country: string
  currency: string
  fields: readonly BankField[]
  values: Readonly<Record<string, string>>
  problems: readonly { kind: string; message: string }[]
  showsProblem: (kind: string) => boolean
  onValue: (kind: string, value: string) => void
  onTouch: (kind: string) => void
  onCountry: (country: string) => void
  onDone: () => void
}) {
  const { strings } = useCompany()
  // Built once: 240-odd names through a collator is not work to repeat on
  // every keystroke in the fields below.
  const countries = useMemo(() => countriesByName(), [])

  return (
    <div className="space-y-3 border-t border-ink/10 p-4">
      {/*
        THE COUNTRY FIRST, because it is what decides everything under it.
        Pre-answered from the business's region, so the common case is a
        glance rather than an answer (Rule #1).
      */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium opacity-70">
          {strings.settings.accountCountry}
        </span>
        <select
          value={country}
          onChange={(event) => onCountry(event.target.value)}
          aria-label={strings.settings.accountCountry}
          className="sunken min-h-tap w-full rounded-lg px-3 text-sm"
        >
          {/* The NAME, not the code — the same source the region picker reads. */}
          {countries.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs opacity-60">
          {strings.settings.accountCountryHint}
        </span>
      </label>

      {/*
        §J: "switching currency re-renders the fields and says so." Said as a
        statement about the fields below rather than as an alert, because
        nothing has gone wrong — the form has simply become the right one.

        THE COUNTRY LEADS, and no preposition follows it. "banks in {country}"
        printed "banks in United Kingdom" on the phone — the article is part
        of a handful of English names (the United Kingdom, the Netherlands,
        the Philippines) and of nothing else, and carrying an article table
        for 240 countries would be inventing linguistic data in every
        language §D has to be translated into. Leading with the name and
        pointing back at it with "there" is correct for every one of them.
      */}
      <p className="text-xs opacity-65" data-fields-for={currency}>
        {format(strings.settings.accountFieldsFollowCountry, {
          country: countryName(country),
        })}
      </p>

      {/* Rendered from the §J definition — never a hand-written form. */}
      {fields.map((field) => {
        const found = problems.find((problem) => problem.kind === field.kind)
        const problem = found !== undefined && showsProblem(field.kind) ? found : undefined
        return (
          <label key={field.kind} className="block">
            <span className="mb-1 block text-xs font-medium opacity-70">{field.label}</span>
            <input
              // Always text: leading zeroes are significant (§K).
              type="text"
              inputMode="text"
              value={values[field.kind] ?? ''}
              onChange={(event) => onValue(field.kind, event.target.value)}
              // On BLUR rather than on the first keystroke: a field is not
              // wrong while it is still being filled in.
              onBlur={() => onTouch(field.kind)}
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

      {/*
        SAVE AND CLOSE, although every keystroke has already been saved.

        The writes are immediate — this is settings, and a draft of a setting
        is a thing to lose — so the button commits nothing. It exists because
        a form with no way out is a form people stay stuck in, and because
        "done" is the word somebody is looking for when they have finished
        typing. Saying "Save and close" rather than "Close" is honest: it
        does close, and by then it is saved.
      */}
      <button
        type="button"
        onClick={onDone}
        className="raised tap-scale min-h-tap w-full rounded-xl bg-gradient-to-b from-brand-light to-brand px-4 text-sm font-semibold text-white"
      >
        {strings.settings.saveAccount}
      </button>
    </div>
  )
}

export function PaymentSettings({
  currency,
  region,
  accountCountry,
  currencyJustChanged = false,
  bankValues,
  methods,
  onBankValue,
  onAccountCountry,
  onToggleMethod,
  paymentLinks = [],
  /*
   * Defaulted FROM `methods`, so a caller that has not been taught about
   * links still gets the right answer for the rows it does draw. The screen
   * passes the company's real list.
   */
  enabledMethodIds = methods.filter((method) => method.enabled).map((method) => method.id),
  onPaymentLinks,
}: PaymentSettingsProps) {
  const { strings } = useCompany()

  /*
   * ONE QUESTION, AND IT IS THE COUNTRY.
   *
   * §J keys its table to the CURRENCY, which is the right key for a lookup
   * and the wrong question for a person: nobody knows their account as "an
   * NGN account", they know it is a Nigerian one. So the screen asks where
   * the bank is and resolves the currency from it, and §J's definition —
   * unchanged, still the only source of field sets — does the rest.
   *
   * THE ACCOUNT'S COUNTRY IS NOT THE BUSINESS'S CURRENCY. Conflating them is
   * what made this confusing: what a business PRICES in and where its money
   * LANDS are two facts, and a Nigerian business billing in sterling has
   * both. `currency` stays what documents are priced in and is touched by
   * nothing here; it serves only as the fallback for a country nobody has
   * listed a currency for.
   *
   * Pre-answered from the business's own region, because the app already
   * knows it and Rule #1 forbids asking twice. Changing it re-renders the
   * fields and says so, which is §J's own requirement.
   */
  const country = accountCountry ?? region
  const accountCurrency = currencyForCountry(country, currency)
  const fields = fieldsFor(accountCurrency)
  const problems = validateBankDetails({ currency: accountCurrency, values: bankValues })
  /*
   * EVERYTHING SWITCHED ON, links included.
   *
   * This counted `methods`, which draws bank transfer and cash on delivery
   * and never a link provider — so the header read "None switched on yet"
   * over a Paystack row showing On. The third time on this feature that one
   * half of a screen asked a list that could not contain the answer.
   */
  const enabledCount = enabledMethodIds.length

  const bankTransferOn = methods.some(
    (method) => method.id === 'bank_transfer' && method.enabled,
  )
  const hasDetails = fields.some((field) => (bankValues[field.kind] ?? '').trim() !== '')

  /*
   * OPEN WHEN THERE IS SOMETHING TO FIX, shut otherwise.
   *
   * A method switched on with no account behind it is a promise with nothing
   * behind it, so that case opens the form rather than leaving somebody to
   * find the row and tap it. Everything else starts closed: the list is the
   * screen, and the form is what one of its rows opens.
   */
  const [openForm, setOpenForm] = useState<boolean>(() => bankTransferOn && !hasDetails)

  /*
   * WHEN A MISSING FIELD BECOMES A PROBLEM (§K).
   *
   * This screen used to greet a new owner with "Bank is needed. Account
   * number is needed. Account name is needed." before they had typed
   * anything — three red lines for the offence of having just arrived. An
   * untouched settings screen is EMPTY, not invalid; nothing is wrong yet
   * because nothing has been claimed yet.
   *
   * Two things turn an empty field into a real problem, and both are the
   * owner saying something: they touched it and left it empty, or they
   * switched bank transfer on — which tells customers to pay into an account.
   *
   * §K is unchanged either way: the message sits beside the field and nothing
   * typed is ever cleared. What changes is only WHEN it appears.
   */
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set())
  const showsProblem = (kind: string) => bankTransferOn || touched.has(kind)

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

      <p className="px-1 text-xs font-bold uppercase tracking-wide opacity-60">
        {strings.settings.paymentMethods}
      </p>
      <ul className="glass-solid divide-y divide-ink/10 overflow-hidden rounded-2xl">
        {methods.map((method) => (
          <li key={method.id}>
            <div className="flex items-center gap-3 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon name={METHOD_ICONS[method.id] ?? 'credit-card'} className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{method.name}</span>
                {/*
                  §J: "the bank-transfer row shows the live account details".
                  The row says what a customer will actually be told to pay
                  into, so a stale or empty account is visible here rather
                  than discovered on a sent invoice.
                */}
                <span className="block truncate text-xs opacity-65">
                  {sublabelFor(method.id, fields, bankValues, strings)}
                </span>
              </span>
              {/*
                BANK TRANSFER OPENS ITS DETAILS; everything else just toggles.

                "Add" on a method that needs an account cannot mean "switched
                on" — there is nothing behind it yet. So this row's Add opens
                the form, and switching the method on is what the form's
                presence lets somebody do knowingly rather than by tapping a
                chip above an empty account.
              */}
              {method.id === 'bank_transfer' && !method.enabled ? (
                <button
                  type="button"
                  aria-expanded={openForm}
                  aria-label={strings.settings.addBankTransfer}
                  onClick={() => setOpenForm((open) => !open)}
                  className="glass-pill min-h-tap shrink-0 rounded-full px-3 text-xs font-semibold text-brand"
                >
                  {strings.settings.methodAdd}
                </button>
              ) : (
                <>
                  {method.id === 'bank_transfer' && (
                    <button
                      type="button"
                      aria-expanded={openForm}
                      aria-label={
                        openForm
                          ? strings.settings.closeAccountForm
                          : strings.settings.editBankTransfer
                      }
                      onClick={() => setOpenForm((open) => !open)}
                      className="glass-pill min-h-tap min-w-tap shrink-0 rounded-full px-2 text-brand"
                    >
                      <Icon name="pencil" className="size-[15px]" />
                    </button>
                  )}
                  {/*
                    A toggle BUTTON rather than a switch, because the
                    reference's two states say different things: "On" is a
                    state you can end, "Add" is an invitation. `aria-pressed`
                    keeps it a toggle for a screen reader, and the accessible
                    name stays the method rather than the word on the chip.
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
                </>
              )}
            </div>

            {method.id === 'bank_transfer' && openForm && (
              <AccountDetails
                country={country}
                currency={accountCurrency}
                fields={fields}
                values={bankValues}
                problems={problems}
                showsProblem={showsProblem}
                onValue={onBankValue}
                onTouch={(kind) => setTouched((previous) => new Set(previous).add(kind))}
                onCountry={onAccountCountry}
                onDone={() => {
                  /*
                   * Switched on by finishing the form, when there is
                   * something behind it. Somebody who filled in an account
                   * and pressed "Save and close" has said what they want;
                   * making them then find the chip is a second answer to a
                   * question they already answered.
                   */
                  if (!bankTransferOn && problems.length === 0) {
                    onToggleMethod('bank_transfer', true)
                  }
                  setOpenForm(false)
                }}
              />
            )}
          </li>
        ))}
      </ul>

      {/*
        §J'S OTHER HALF. The bank account is one way to be paid; the links
        are the rest of the list §J has always named, and until now the only
        thing switching one on did was print its name with nothing behind it.
      */}
      {onPaymentLinks !== undefined && (
        <PaymentLinkSection
          country={country}
          links={paymentLinks}
          onChange={onPaymentLinks}
          /*
           * THE COMPANY'S OWN LIST, not the methods rendered above it.
           *
           * This read `methods`, which is the curated set §J calls always
           * available — bank transfer and cash on delivery — and a link
           * provider is never in it. So toggling Paystack on wrote
           * `paystack_page` into `enabledPaymentMethods` and the chip read
           * back Off, because it was asking a list that could not contain
           * the answer. Found on the phone; the jsdom test passed `enabled`
           * straight in, so the seam between these two components was the
           * one thing it could not see.
           */
          enabled={enabledMethodIds}
          onToggle={onToggleMethod}
        />
      )}
    </section>
  )
}
