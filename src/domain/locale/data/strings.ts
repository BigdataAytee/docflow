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
  readonly nav: {
    readonly home: string
    readonly customers: string
    readonly business: string
    readonly settings: string
    readonly openSettings: string
    readonly notFound: string
    readonly notFoundBody: string
    readonly goHome: string
    readonly somethingWrong: string
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
    readonly labels: string
    readonly addLabel: string
    readonly filterByLabel: string
    readonly clearLabelFilter: string
    readonly noneWithLabel: string
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
  readonly conflict: {
    readonly title: string
    readonly body: string
    readonly seeBoth: string
    readonly useMine: string
    readonly useTheirs: string
    readonly bothSaved: string
    readonly mine: string
    readonly theirs: string
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
  readonly search: {
    readonly documents: string
    readonly customers: string
    readonly items: string
    readonly matches: string
    readonly noMatch: string
    readonly noMatchBody: string
    readonly tryOneOfThese: string
    readonly clear: string
    readonly openInSettings: string
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
  /** The §L1 reminder templates. `{customer}` `{business}` `{reference}` `{amount}` `{due}`. */
  readonly chase: {
    readonly softerOpening: string
    readonly firmerOpening: string
    readonly amountLine: string
    readonly dueLine: string
    readonly overdueLine: string
    readonly howToPay: string
    readonly closing: string
    readonly softer: string
    readonly firmer: string
    readonly title: string
    readonly nothingToChase: string
    readonly sendOnWhatsApp: string
    readonly nothingSendsUnseen: string
  }
  readonly savedDocument: {
    readonly title: string
    readonly actions: string
    readonly sharePdf: string
    readonly voidIt: string
    readonly creditNote: string
    readonly openStatement: string
    readonly notIssuedYet: string
    readonly continueEditing: string
    readonly needsDevice: string
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
  readonly analytics: {
    readonly title: string
    readonly eyebrow: string
    readonly moneyIn: string
    readonly moneyOut: string
    readonly kept: string
    readonly keptHelp: string
    readonly inVsOut: string
    readonly howLate: string
    readonly bucketNotDue: string
    readonly bucket1to30: string
    readonly bucket31to60: string
    readonly bucket60plus: string
    readonly worstBucket: string
    readonly nothingLate: string
    readonly whatSellsBest: string
    readonly soldAcross: string
    readonly noSales: string
    readonly nothingYet: string
    readonly nothingYetBody: string
    readonly askAnything: string
    readonly askPlaceholder: string
    readonly askOffline: string
    readonly askUnavailable: string
    /** One per `AskChip`. */
    readonly askChips: Readonly<Record<string, string>>
  }
  readonly expenses: {
    readonly title: string
    readonly add: string
    readonly amount: string
    readonly date: string
    readonly whatFor: string
    readonly category: string
    readonly attachPhoto: string
    readonly photoAttached: string
    readonly fromPhoto: string
    readonly save: string
    readonly none: string
    readonly noneBody: string
    readonly photoNeverSetsAmount: string
  }
  readonly statements: {
    readonly title: string
    readonly period: string
    readonly from: string
    readonly to: string
    readonly openingBalance: string
    readonly charged: string
    readonly paid: string
    readonly credited: string
    readonly closingBalance: string
    readonly balance: string
    readonly date: string
    readonly nothingInPeriod: string
    readonly nothingInPeriodBody: string
    readonly currencyNote: string
    readonly share: string
  }
  readonly recurring: {
    readonly repeat: string
    readonly repeatOn: string
    readonly repeatOff: string
    readonly repeatHint: string
    readonly repeatOffHint: string
    readonly everyMonth: string
    readonly nextOn: string
    readonly draftsWaiting: string
    readonly reviewBeforeSending: string
    readonly stopRepeating: string
  }
  readonly credits: {
    readonly title: string
    readonly create: string
    readonly reason: string
    readonly amount: string
    readonly against: string
    readonly none: string
    readonly noneBody: string
    readonly neverMovesIncome: string
    readonly reducesWhatIsOwed: string
  }
  readonly dataSync: {
    readonly title: string
    readonly uploadState: string
    readonly exportAll: string
    readonly exportAlwaysFree: string
    readonly conflictDemo: string
    readonly conflictDemoHint: string
    readonly showExample: string
    readonly hideExample: string
    readonly demoNotice: string
  }
  /** One word per status token the §F tone map knows — stored and derived. */
  readonly statuses: Readonly<Record<string, string>>
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
  nav: {
    home: 'Home',
    customers: 'Customers',
    business: 'Business',
    settings: 'Settings',
    openSettings: 'Open settings',
    notFound: 'That page is not here',
    notFoundBody: 'The link may be old, or the record may have been removed.',
    goHome: 'Go to Home',
    somethingWrong: 'Something went wrong loading your work',
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
labels: 'Labels',
    addLabel: 'Add a label',
    filterByLabel: 'Filter by label',
    clearLabelFilter: 'Show everyone',
    noneWithLabel: 'Nobody has that label yet.',
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
  conflict: {
    // §L7: plain language, in the active language. No "merge", no "revision".
    title: '{person} changed this too',
    body: 'You both edited the same thing while apart.',
    seeBoth: 'See both',
    useMine: 'Use mine',
    useTheirs: 'Use theirs',
    bothSaved: 'Both versions are saved until you choose.',
    mine: 'Yours',
    theirs: 'Theirs',
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
  search: {
    documents: 'Documents',
    customers: 'Customers',
    items: 'Things you sell',
    matches: '{count} found',
    noMatch: 'Nothing matched "{query}"',
    noMatchBody: 'Search by a name, a number, an amount, or what you sold.',
    tryOneOfThese: 'Try one of these',
    clear: 'Clear the search',
    openInSettings: 'In your saved list',
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
  chase: {
    softerOpening: 'Hello {customer}, hope business is good.',
    firmerOpening: 'Hello {customer}, this is a reminder about {reference}.',
    amountLine: '{amount} is still outstanding on {reference}.',
    dueLine: 'It falls due on {due}.',
    overdueLine: 'It was due on {due}.',
    howToPay: 'You can pay into:',
    closing: 'Thank you. — {business}',
    softer: 'Softer',
    firmer: 'Firmer',
    title: 'Chase this money',
    nothingToChase: 'Nothing is outstanding on this one.',
    sendOnWhatsApp: 'Open in WhatsApp',
    nothingSendsUnseen: 'Nothing is sent until you send it.',
  },
  savedDocument: {
    title: 'Saved',
    actions: 'Actions',
    sharePdf: 'Share the PDF',
    voidIt: 'Cancel it',
    creditNote: 'Credit some of this back',
    openStatement: 'Statement',
    notIssuedYet: 'This is still a draft.',
    continueEditing: 'Carry on editing',
    needsDevice: 'Needs the installed app — coming with the phone build.',
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
  analytics: {
    title: 'Your business',
    eyebrow: 'This month',
    moneyIn: 'In',
    moneyOut: 'Out',
    kept: 'Kept',
    keptHelp: 'Kept is the money you recorded coming in, less the expenses you recorded.',
    inVsOut: 'In and out, last six months',
    howLate: 'How late the money is',
    bucketNotDue: 'Not due yet',
    bucket1to30: '1-30 days late',
    bucket31to60: '31-60 days late',
    bucket60plus: 'Over 60 days late',
    worstBucket: 'Most of what is late sits in {bucket}.',
    nothingLate: 'Nothing is late.',
    whatSellsBest: 'What sells best',
    soldAcross: 'across {count}',
    noSales: 'Nothing has sold yet.',
    nothingYet: 'Nothing to show yet',
    nothingYetBody: 'Record a payment or an expense and this page fills itself in.',
    askAnything: 'Ask anything about your business',
    askPlaceholder: 'Who owes me the most?',
    askOffline: 'Answered on this phone, offline.',
    askUnavailable: 'Free-form questions need the offline tools installed. The chips above work on any phone.',
    askChips: {
      who_owes_most: 'Who owes me the most?',
      best_seller: 'What sells best?',
      kept_this_month: 'What did I keep this month?',
      how_late: 'How late is my money?',
    },
  },
  expenses: {
    title: 'Expenses',
    add: 'Add an expense',
    amount: 'Amount',
    date: 'Date',
    whatFor: 'What was it for?',
    category: 'Category',
    attachPhoto: 'Attach the receipt',
    photoAttached: 'Receipt attached',
    fromPhoto: 'From the receipt photo',
    save: 'Add it',
    none: 'No expenses yet',
    noneBody: 'Add what you spend and "Kept" starts telling you the truth.',
    photoNeverSetsAmount: 'Type the amount yourself — a photo is kept as proof, never read for figures.',
  },
  statements: {
    title: 'Statement',
    period: 'Period',
    from: 'From',
    to: 'To',
    openingBalance: 'Balance brought forward',
    charged: 'Charged',
    paid: 'Paid',
    credited: 'Credited',
    closingBalance: 'Balance carried forward',
    balance: 'Balance',
    date: 'Date',
    nothingInPeriod: 'Nothing in this period',
    nothingInPeriodBody: 'Pick a wider period, or start from this customer first document.',
    currencyNote: 'All amounts in {currency}.',
    share: 'Share the statement',
  },
  recurring: {
    repeat: 'Repeat',
    repeatOn: 'Repeating',
    repeatOff: 'Not repeating',
    repeatHint: 'A fresh draft appears each month for you to check and send.',
    repeatOffHint: 'This one is a one-off.',
    everyMonth: 'Every month on day {day}',
    nextOn: 'Next draft on {date}',
    draftsWaiting: '{count} waiting for you to check',
    reviewBeforeSending: 'Nothing is sent until you look at it.',
    stopRepeating: 'Stop repeating',
  },
  credits: {
    title: 'Credits',
    create: 'Credit some of this back',
    reason: 'Why?',
    amount: 'How much?',
    against: 'Against {reference}',
    none: 'No credits',
    noneBody: 'Credit money back when you have overcharged, without touching what you already sent.',
    neverMovesIncome: 'A credit lowers what is owed. It never changes money you have already received.',
    reducesWhatIsOwed: 'Reduces what is owed by {amount}.',
  },
  dataSync: {
    title: 'Data & sync',
    uploadState: 'Upload state',
    exportAll: 'Export all my data',
    exportAlwaysFree: 'Your documents and export are never locked, on any plan.',
    conflictDemo: 'See what happens when two phones edit at once',
    conflictDemoHint: 'A worked example. Nothing on this phone changes.',
    showExample: 'Show me',
    hideExample: 'Close',
    demoNotice: 'This is an example, not your data.',
  },
  statuses: {
    draft: 'Draft',
    issued: 'Issued',
    void: 'Cancelled',
    sent: 'Sent',
    accepted: 'Accepted',
    rejected: 'Turned down',
    dispatched: 'Sent out',
    in_transit: 'On the way',
    delivered: 'Delivered',
    unpaid: 'Not paid',
    partially_paid: 'Part paid',
    paid: 'Paid',
    overdue: 'Late',
    expired: 'Out of date',
    money_out: 'Money out',
    settled: 'Settled',
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
