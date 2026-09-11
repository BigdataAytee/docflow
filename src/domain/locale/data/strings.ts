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
  readonly details: {
    readonly numberAndDates: string
    readonly reference: string
    readonly editReference: string
    readonly issueDate: string
    readonly dueDate: string
    readonly validUntil: string
    readonly datePaid: string
    readonly dispatchDate: string
    readonly expectedDelivery: string
    readonly today: string
    readonly tomorrow: string
    readonly yesterday: string
    readonly inDays: string
    readonly currencyAndPayment: string
    readonly currency: string
    readonly paymentReady: string
    readonly paymentNotSet: string
    readonly setUpPayment: string
    readonly signature: string
    readonly tapToSign: string
    readonly deliveryAddress: string
    readonly linkedInvoice: string
    readonly method: string
    readonly paymentReference: string
  }
  readonly items: {
    readonly addItem: string
    readonly description: string
    readonly quantity: string
    readonly unitPrice: string
    readonly unit: string
    readonly add: string
    readonly none: string
    readonly noneBody: string
    readonly savedToCatalogue: string
  }
  readonly settings: {
    readonly regionAndLanguage: string
    readonly businessCountry: string
    readonly countryHint: string
    readonly appLanguage: string
    readonly callThisDocument: string
    readonly useRegionalName: string
    readonly currencyIs: string
    readonly taxIsCalled: string
    readonly bankFieldsAre: string
    readonly effectiveImmediately: string
    readonly howYouGetPaid: string
    readonly methodsOn: string
    readonly noMethodsYet: string
    readonly bankTransfer: string
    readonly currencyChanged: string
    readonly company: string
    readonly businessName: string
    readonly nameStyle: string
    readonly logoSize: string
    readonly numberingPrefixes: string
    readonly prefixHint: string
    readonly tax: string
    readonly taxRate: string
    readonly withholdingRate: string
    readonly workedExample: string
    readonly savedItems: string
    readonly noSavedItems: string
    readonly noSavedItemsBody: string
    readonly usedTimes: string
    readonly defaultSignature: string
    readonly signatureHint: string
  }
  readonly firstRun: {
    readonly title: string
    readonly body: string
    readonly createFirst: string
    readonly viewSample: string
    readonly sampleBadge: string
    readonly sampleNotice: string
  }
  readonly lists: {
    readonly eyebrow: string
    readonly countLine: string
    readonly newDocument: string
    readonly searchIn: string
    readonly none: string
    readonly noneBody: string
    readonly noMatch: string
  }
  readonly home: {
    readonly outstanding: string
    readonly receivedThisMonth: string
    readonly nothingOutstanding: string
    readonly nothingReceived: string
    readonly needsAttention: string
    readonly overdueBy: string
    readonly inTransit: string
    readonly chase: string
    readonly sign: string
    readonly greetingMorning: string
    readonly greetingAfternoon: string
    readonly greetingEvening: string
    readonly searchEverything: string
    readonly addLogo: string
    readonly logOut: string
  }
  readonly payments: {
    readonly paidOfTotal: string
    readonly amountLeft: string
    readonly settled: string
    readonly recordPayment: string
    readonly amount: string
    readonly method: string
    readonly reference: string
    readonly datePaid: string
    readonly receipt: string
    readonly none: string
    readonly noneBody: string
    readonly partPaymentNote: string
    readonly save: string
  }
  readonly design: {
    readonly logoOn: string
    readonly logoOff: string
    readonly logoOnHint: string
    readonly logoOffHint: string
    readonly newTag: string
    readonly chooseDesign: string
  }
  readonly totals: {
    readonly subtotal: string
    readonly discount: string
    readonly tax: string
    readonly withholding: string
    readonly payable: string
    readonly driver: string
    readonly vehicle: string
    readonly noMoneyOnDelivery: string
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
  details: {
    numberAndDates: 'Number & dates',
    reference: 'Reference',
    editReference: 'Edit reference',
    issueDate: 'Date',
    dueDate: 'Due',
    validUntil: 'Valid until',
    datePaid: 'Date paid',
    dispatchDate: 'Dispatch date',
    expectedDelivery: 'Expected delivery',
    today: 'Today',
    tomorrow: 'Tomorrow',
    yesterday: 'Yesterday',
    inDays: '{days} days',
    currencyAndPayment: 'Currency & payment',
    currency: 'Currency',
    paymentReady: '{count} payment method ready',
    paymentNotSet: 'No payment method yet',
    setUpPayment: 'Set up payment',
    signature: 'Signature',
    tapToSign: 'Tap to sign',
    deliveryAddress: 'Delivery address',
    linkedInvoice: 'Linked invoice',
    method: 'Method',
    paymentReference: 'Payment reference',
  },
  items: {
    addItem: 'Add an item',
    description: 'Description',
    quantity: 'Qty',
    unitPrice: 'Unit price',
    unit: 'Unit',
    add: 'Add',
    none: 'Nothing added yet',
    noneBody: 'Type what you are selling and it is saved for next time.',
    savedToCatalogue: 'Saved to your items',
  },
  settings: {
    regionAndLanguage: 'Region & language',
    businessCountry: 'Business country',
    countryHint: 'Sets what your documents are called, your currency, your bank fields and your tax wording.',
    appLanguage: 'App language',
    callThisDocument: 'Call this document',
    useRegionalName: 'Use the usual name',
    currencyIs: 'Currency',
    taxIsCalled: 'Tax is called',
    bankFieldsAre: 'Bank details',
    effectiveImmediately: 'Changes apply everywhere straight away, with or without internet.',
    howYouGetPaid: 'How you get paid',
    methodsOn: '{count} switched on',
    noMethodsYet: 'None switched on yet',
    bankTransfer: 'Bank transfer',
    currencyChanged: 'Your currency changed, so these fields changed too.',
    company: 'Company & logo',
    businessName: 'Business name',
    nameStyle: 'Name style',
    logoSize: 'Logo size',
    numberingPrefixes: 'Numbering prefixes',
    prefixHint: 'Your prefix is always used, whatever the region suggests.',
    tax: 'Tax',
    taxRate: '{label} rate',
    withholdingRate: 'Withholding tax rate',
    workedExample: 'On {subtotal} you would charge {tax} and withhold {wht}, leaving {payable}.',
    savedItems: 'Saved items',
    noSavedItems: 'Nothing saved yet',
    noSavedItemsBody: 'Items you type into a document are kept here for next time.',
    usedTimes: 'used {count}×',
    defaultSignature: 'Default signature',
    signatureHint: 'Signs new documents unless you draw a different one.',
  },
  firstRun: {
    title: 'Make your first document',
    body: 'Or look at a sample first, to see how one turns out.',
    createFirst: 'Create my first {label}',
    viewSample: 'View a sample',
    sampleBadge: 'SAMPLE',
    sampleNotice: 'This is a sample. Its figures are not counted anywhere, and you can delete it whenever you like.',
  },
  lists: {
    eyebrow: 'DOCUMENTS',
    countLine: '{count} {label}',
    newDocument: '+ New {label}',
    searchIn: 'Search {label}…',
    none: 'Nothing here yet',
    noneBody: 'Make your first one — it takes a minute.',
    noMatch: 'Nothing matched that search.',
  },
  home: {
    outstanding: 'Outstanding',
    receivedThisMonth: 'Received this month',
    nothingOutstanding: 'Nothing owed',
    nothingReceived: 'Nothing yet',
    needsAttention: 'Needs attention',
    overdueBy: 'Overdue · {amount}',
    inTransit: 'On its way',
    chase: 'Chase',
    sign: 'Sign',
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    searchEverything: 'Search everything',
    addLogo: 'Tap to add your logo',
    logOut: 'Log out',
  },
  payments: {
    paidOfTotal: '{paid} paid of {total}',
    amountLeft: '{amount} left',
    settled: 'Settled in full',
    recordPayment: 'Record a payment',
    amount: 'Amount',
    method: 'Method',
    reference: 'Reference',
    datePaid: 'Date paid',
    receipt: 'Receipt',
    none: 'No payments yet',
    noneBody: 'Record one when the money arrives.',
    partPaymentNote: 'Less than the balance is recorded as a part payment.',
    save: 'Record it',
  },
  design: {
    logoOn: 'Logo on',
    logoOff: 'Logo off',
    logoOnHint: 'Your logo prints at the top of every design',
    logoOffHint: 'Logo hidden — only your business name prints',
    newTag: 'NEW',
    chooseDesign: 'Choose a design',
  },
  totals: {
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Tax',
    withholding: 'Less withholding tax',
    payable: 'Payable',
    driver: 'Driver',
    vehicle: 'Vehicle',
    noMoneyOnDelivery: 'Delivery documents carry no prices.',
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
