/**
 * UI strings (§S: "all UI strings" follow the language).
 *
 * Separate from the §D terminology tables on purpose: terminology is what a
 * DOCUMENT is called and varies by region; these are the surrounding words and
 * vary by language. A French-speaking business in Lagos gets FR strings with
 * EN-NG terminology, which only works if the two are looked up independently.
 *
 * English is complete. FR, ES and AR are deliberately ABSENT rather than
 * machine-filled: §D says machine translation is a draft and §S says no
 * non-working language toggle ever ships, so `stringsFor` throws for a
 * language with no catalogue instead of silently serving English under a
 * French flag.
 *
 * Interpolation is `{name}`, substituted by `format`.
 */

export interface UiStrings {
  readonly common: {
    readonly back: string
    readonly next: string
    readonly cancel: string
    readonly search: string
    readonly loading: string
    readonly retry: string
    readonly saved: string
    readonly savingAutomatically: string
    readonly remove: string
  }
  readonly sync: {
    readonly savedLocal: string
    readonly waiting: string
    readonly uploaded: string
    readonly needsReview: string
  }
  readonly customers: {
    readonly title: string
    readonly searchPlaceholder: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly addFirst: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly owes: string
    readonly settled: string
    readonly billedAllTime: string
    readonly paid: string
    readonly owingNow: string
    readonly paysLate: string
    readonly paysEarly: string
    readonly paysOnTime: string
    readonly considerPartPayment: string
  }
  readonly builder: {
    readonly stepOf: string
    readonly saveDocument: string
    readonly missingTitle: string
    readonly fixThis: string
  }
  /** One message per `IssueProblem.field` token the builder can return. */
  readonly problems: Readonly<Record<string, string>>
}

const EN: UiStrings = {
  common: {
    back: 'Back',
    next: 'Next',
    cancel: 'Cancel',
    search: 'Search',
    loading: 'Loading',
    retry: 'Try again',
    saved: 'Saved',
    savingAutomatically: 'Draft saved automatically',
    remove: 'Remove',
  },
  sync: {
    savedLocal: 'Saved on this phone',
    waiting: 'Waiting to upload',
    uploaded: 'Uploaded',
    needsReview: 'Needs review',
  },
  customers: {
    title: 'Customers',
    searchPlaceholder: 'Search customers…',
    emptyTitle: 'No customers yet',
    emptyBody: 'Add the people and businesses you sell to. You can add one while making a document too.',
    addFirst: 'Add your first customer',
    noMatchTitle: 'Nothing matched',
    noMatchBody: 'Try a different name, phone number or address.',
    owes: 'Owes {amount}',
    settled: 'Settled',
    billedAllTime: 'Billed all time',
    paid: 'Paid',
    owingNow: 'Owing now',
    paysLate: 'Pays on average {days} days late.',
    paysEarly: 'Pays on average {days} days early.',
    paysOnTime: 'Pays on time.',
    considerPartPayment: 'Consider part payment up front.',
  },
  builder: {
    stepOf: 'Step {current} of {total}',
    saveDocument: 'Save {label}',
    missingTitle: 'Before you can issue this',
    fixThis: 'Fix this',
  },
  problems: {
    party: 'Choose who this is for.',
    issue_date: 'Add the date.',
    line_items: 'Add at least one item.',
    line_description: 'Give every item a description.',
    line_price: 'Give every item a price.',
    delivery_carries_no_money: 'A delivery document cannot carry prices.',
    payment_method: 'Set up how you get paid.',
    recorded_payment: 'Record the payment first.',
    delivery_address: 'Add the delivery address.',
    dispatch_date: 'Add the dispatch date.',
    signature: 'Add your signature.',
  },
}

const CATALOGUES: Readonly<Record<string, UiStrings>> = { en: EN }

export class MissingStringsError extends Error {}

/**
 * §S — no non-working language toggle ever ships. A language with no catalogue
 * is an error, not a silent fall back to English.
 */
export function stringsFor(language: string): UiStrings {
  const catalogue = CATALOGUES[language]
  if (catalogue === undefined) {
    throw new MissingStringsError(
      `No UI strings for "${language}". §S ships a language only when it is complete — serving English under another flag is worse than not offering it.`,
    )
  }
  return catalogue
}

export const hasStringsFor = (language: string): boolean => language in CATALOGUES

/** `format('Owes {amount}', { amount: '₦95,000' })`. Unknown keys stay literal. */
export function format(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  )
}
