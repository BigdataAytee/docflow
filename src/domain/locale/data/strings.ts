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
    /**
     * §G's two round controls on Home. The names are here rather than in
     * `home` because the same two capabilities are reached from the builder
     * as well, and one word for one thing is the whole point of §D.
     */
    readonly voice: string
    readonly scan: string
    readonly offlineToolsNeeded: string
  }
  /**
   * Signing in, and the first business (§R, §S).
   *
   * Every word here goes through the catalogue like every other word: an
   * account screen is not exempt from §S because it happens before the app.
   */
  /**
   * Settings → Help & support (§G: "WhatsApp + FAQ").
   *
   * Every answer describes a rule this build actually enforces. A FAQ that
   * describes behaviour the app does not have creates the support calls it
   * was written to prevent.
   */
  readonly help: {
    readonly title: string
    readonly chatWithSupport: string
    readonly onWhatsApp: string
    readonly gettingStarted: string
    readonly gettingStartedHint: string
    readonly faq: readonly { readonly question: string; readonly answer: string }[]
  }
  readonly account: {
    /** Settings → Your account (§P, and the reference's account screen). */
    readonly title: string
    readonly signedIn: string
    readonly noSession: string
    readonly noSessionBody: string
    readonly changePassword: string
    readonly changePasswordHint: string
    readonly resetSentToYou: string
    readonly resetFailed: string
    readonly signInTitle: string
    readonly signInBody: string
    readonly email: string
    readonly password: string
    readonly passwordRule: string
    readonly signIn: string
    readonly createAccount: string
    readonly haveAccount: string
    readonly noAccount: string
    readonly forgotPassword: string
    readonly resetSent: string
    readonly continueWithGoogle: string
    readonly needsConnection: string
    readonly signOut: string
    /**
     * Confirming it (§P). What the copy promises is only what is true:
     * records are on the device and export is free forever (Rule #6), so
     * signing out never takes a document away.
     */
    readonly signOutTitle: string
    readonly signOutBody: string
    readonly signOutConfirm: string
    readonly signOutCancel: string
    readonly businessTitle: string
    readonly businessBody: string
    readonly businessName: string
    readonly businessCountry: string
    readonly createBusiness: string
    readonly creating: string
    readonly demoTitle: string
    /**
     * Two answers, because "no account" and "nothing is kept" are different
     * facts and the banner was stating the second on a build where only the
     * first was true. §R's requirement is that a local demo is never passed
     * off as an account — both sentences keep that, and only the one about
     * where the records go differs.
     */
    readonly demoBody: string
    readonly demoBodyKept: string
    /**
     * What a refused sign-in says (§P, §S). The provider's own English —
     * "Email rate limit exceeded", "Invalid login credentials" — used to
     * reach the screen verbatim: untranslated, jargon, and a description of
     * how the system is built handed to whoever is probing it.
     *
     * `wrongDetails` is deliberately ONE sentence for "no such account" and
     * "wrong password" both. Telling them apart tells a stranger which
     * addresses are registered.
     */
    readonly tooManyTries: string
    readonly tooManyTriesIn: string
    readonly wrongDetails: string
    readonly signInProblem: string
  }
  readonly nav: {
    /**
     * The NAME OF THE NAVIGATION LANDMARK, not of a destination in it. It was
     * `nav.home`, so the tab bar announced as "Home, navigation" while also
     * containing a link called Home — the screen-reader sweep's
     * landmark-name-collides rule is the one that noticed.
     */
    readonly sections: string
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
  /**
   * The command palette (§Q Phase 7, §V). Every word here names a way to
   * REACH something that already exists — the palette adds no feature of its
   * own, and the catalogue should read that way.
   */
  /**
   * Ending the account (§S; Apple 5.1.1(v)). Plain words for a serious
   * action: no "deactivate", no "we hope you come back", and a date rather
   * than a period, because a date is what a person can act on.
   */
  readonly deleteAccount: {
    readonly title: string
    readonly rowLabel: string
    readonly body: string
    readonly exportFirst: string
    readonly exportAction: string
    readonly exportDone: string
    readonly typeName: string
    readonly confirm: string
    readonly ownerOnly: string
    readonly nameMismatch: string
    readonly scheduledTitle: string
    readonly scheduledBody: string
    readonly daysLeft: string
    readonly keep: string
    readonly whatGoes: string
    readonly whatStays: string
  }
  /**
   * DocFlow Pro, said quietly (§U).
   *
   * §U asks for "no modal ambushes, no fake urgency" — so there is no "only
   * today", no "don't miss out", and the dismiss is a plain word rather than
   * a guilt trip ("No thanks", never "I don't want to grow my business").
   */
  readonly pro: {
    readonly name: string
    /** The plan somebody is on when they are not on Pro. §U's "honest core". */
    readonly free: string
    readonly settingsRow: string
    readonly partOfPro: string
    readonly perMonth: string
    readonly perYear: string
    readonly freeTrial: string
    readonly notNow: string
    readonly seePlan: string
    readonly managePlan: string
    readonly restore: string
    readonly badge: string
    readonly freeForever: string
    readonly graceNotice: string
    readonly lapsedNotice: string
  }
  readonly palette: {
    readonly title: string
    readonly placeholder: string
    readonly open: string
    readonly goTo: string
    readonly create: string
    readonly records: string
    readonly noMatch: string
    readonly resultCount: string
    /**
     * The RESULT LIST's own name. It was `title`, so the dialog, the field
     * and the list were all called "Go anywhere" and a reader heard the same
     * three words three times before reaching a row.
     */
    readonly results: string
    /** "All Invoices" — the plural label goes in. */
    readonly openList: string
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
    readonly add: string
    readonly newCustomer: string
    readonly name: string
    readonly phone: string
    readonly email: string
    readonly address: string
    readonly isCompany: string
    readonly isPerson: string
    readonly save: string
  }
  readonly contact: {
    readonly chat: string
    readonly call: string
    readonly statement: string
    readonly noPhone: string
    readonly balance: string
    readonly history: string
    readonly noHistory: string
    readonly noHistoryBody: string
    readonly notes: string
    readonly notesHint: string
    readonly notesPlaceholder: string
    readonly newLabel: string
    readonly saveLabel: string
    readonly removeLabel: string
    readonly back: string
  }
  readonly builder: {
    readonly stepOf: string
    readonly saveDocument: string
    /** §G step 5: which design, and the shape it prints at. */
    readonly designAndSize: string
    /** The header when the builder is CREATING — "New invoice". */
    readonly newDocument: string
    readonly missingTitle: string
    readonly fixThis: string
    readonly notReadyYet: string
    readonly couldNotIssue: string
  }
  readonly details: {
    readonly numberAndDates: string
    /** The small label above the reference in step 1's first card. */
    readonly numberLabel: string
    readonly reference: string
    readonly editReference: string
    readonly issueDate: string
    readonly dueDate: string
    readonly validUntil: string
    readonly datePaid: string
    readonly dispatchDate: string
    /** A delivery's two dates: when it leaves, and when it should land. */
    readonly dispatch: string
    readonly expected: string
    readonly expectedDelivery: string
    readonly today: string
    readonly tomorrow: string
    readonly yesterday: string
    readonly inDays: string
    /** The calendar's month arrows, and the name of the picker itself. */
    readonly previousMonth: string
    readonly nextMonth: string
    readonly chooseDate: string
    readonly currencyAndPayment: string
    readonly currency: string
    readonly paymentReady: string
    readonly paymentNotSet: string
    readonly setUpPayment: string
    /** §G: the blue return band over a Settings panel reached from a draft. */
    readonly settingUpPayment: string
    readonly backToDraft: string
    readonly signature: string
    readonly tapToSign: string
    readonly deliveryAddress: string
    readonly linkedInvoice: string
    readonly chooseCustomer: string
    readonly searchCustomers: string
    readonly nobodyChosen: string
    readonly addNamed: string
    readonly noCustomerMatch: string
    readonly change: string
    readonly method: string
    readonly paymentReference: string
  }
  readonly items: {
    readonly addItem: string
    readonly description: string
    readonly quantity: string
    readonly unitPrice: string
    readonly unit: string
    /** An example unit, shown as the placeholder — "cartons", not a rule. */
    readonly unitExample: string
    /** The Goods card's title on a delivery — money types say "Add an item". */
    readonly goods: string
    /** The description field's placeholder, which also explains autocomplete. */
    readonly typeAnItem: string
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
    readonly oneLanguageOnly: string
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
    readonly paymentMethods: string
    readonly cashOnDelivery: string
    readonly cashOnDeliveryHint: string
    readonly methodOn: string
    readonly methodAdd: string
    readonly noAccountYet: string
    readonly currencyChanged: string
    readonly company: string
    readonly businessName: string
    readonly businessAddress: string
    /** The logo holder and the two ways to fill it (§F, §Q). */
    readonly noLogoYet: string
    readonly uploadLogo: string
    readonly replaceLogo: string
    readonly createLogo: string
    readonly createLogoLater: string
    readonly logoUnreadable: string
    readonly nameStyle: string
    readonly logoSize: string
    readonly numberingPrefixes: string
    readonly prefixHint: string
    readonly tax: string
    readonly taxRate: string
    readonly withholdingRate: string
    readonly workedExample: string
    readonly savedItems: string
    readonly savedItemsHint: string
    readonly perUnit: string
    /** The two groups the settings index is divided into. */
    readonly groupBusiness: string
    readonly groupYou: string
    /** Row sublabels, which say the current value rather than repeating the row. */
    readonly notSetUpYet: string
    readonly notSet: string
    readonly itemCount: string
    readonly noSavedItems: string
    readonly noSavedItemsBody: string
    readonly usedTimes: string
    readonly theme: string
    readonly themeHint: string
    readonly themeSystem: string
    readonly themeLight: string
    readonly themeDark: string
    readonly legal: string
    readonly legalUnfinished: string
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
  /**
   * The four-page welcome (§R). Every one of these is a whole sentence in the
   * catalogue rather than a fragment assembled at the call site — a language
   * that orders a clause differently cannot be served by concatenation (§S).
   */
  readonly welcome: {
    readonly brand: string
    readonly headline: string
    readonly body: string
    readonly step1: string
    readonly step1Body: string
    readonly step2: string
    readonly step2Body: string
    readonly step3: string
    readonly step3Body: string
    readonly getStarted: string
    readonly explore: string
    readonly offlineNote: string
    /** The progress bar's three names. */
    readonly progressLabel: string
    readonly stepBusiness: string
    readonly stepTask: string
    readonly stepReady: string
    readonly back: string
    readonly setupTitle: string
    /** Page 1 — the two answers §R requires, country pre-filled. */
    readonly businessTitle: string
    readonly businessBody: string
    readonly nameLabel: string
    readonly namePlaceholder: string
    readonly nameHelp: string
    readonly countryLabel: string
    readonly countryHelp: string
    readonly saveContinue: string
    readonly skipBusiness: string
    /** Page 2 — which document, explained by what it is for. */
    readonly taskTitle: string
    readonly taskBody: string
    /**
     * What each document is FOR, in one line.
     *
     * Descriptions, not names — the names come from the terminology catalogue
     * through `label()` (Rule #4). A hint may say "invoice" in prose; the
     * heading beside it is whatever this region calls one.
     *
     * Keys spelled out rather than `Record<DocumentType, string>`: this file
     * imports nothing, and it is the leaf on purpose — the words must not
     * depend on the domain that uses them.
     */
    readonly hints: {
      readonly invoice: string
      readonly quotation: string
      readonly receipt: string
      readonly waybill: string
    }
    readonly continueOn: string
    /** Page 3 — what happens next, and where things live. */
    readonly readyTitle: string
    readonly readyBody: string
    readonly ready1: string
    readonly ready1Body: string
    readonly ready2: string
    readonly ready2Body: string
    readonly ready3: string
    readonly ready3Body: string
    readonly findYourWay: string
    readonly whereHome: string
    readonly whereCustomers: string
    readonly whereAnalytics: string
    readonly whereSettings: string
    readonly startMine: string
    readonly homeFirst: string
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
    /**
     * §L4: a long gap's missed months, said out loud.
     *
     * The catch-up creates the recent ones and bounds itself; the older ones
     * are named rather than dropped, so an owner is told rather than counting
     * backwards and finding eleven invoices absent.
     */
    readonly repeatsSkipped: string
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
    /**
     * §G's "one line of copy" under the greeting. It says what the two stat
     * cards below it are, so the figures are introduced rather than simply
     * appearing — and it is the same sentence whether they are full or empty.
     */
    readonly greetingLine: string
  }
  /**
   * Home's "Your next steps" card (§18, §R).
   *
   * Every item is DERIVED from the state it describes, so these words label a
   * question the app can answer rather than a box somebody ticked.
   */
  readonly setup: {
    readonly title: string
    readonly body: string
    readonly progress: string
    readonly start: string
    readonly viewGuide: string
    readonly hide: string
    readonly businessDetails: string
    readonly logo: string
    readonly payment: string
    readonly firstDocument: string
  }
  readonly payments: {
    /** The card's own heading on a saved invoice (§G — the saved document). */
    readonly title: string
    readonly paidOfTotal: string
    readonly amountLeft: string
    readonly settled: string
    readonly recordPayment: string
    readonly amount: string
    readonly method: string
    readonly reference: string
    readonly datePaid: string
    readonly none: string
    readonly noneBody: string
    readonly creditedLine: string
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
  /** §M: a handoff, never a claim of delivery. `{label}` `{reference}` etc. */
  readonly share: {
    readonly title: string
    readonly line: string
    readonly forCustomer: string
    readonly totalLine: string
    readonly outstandingLine: string
    readonly dueLine: string
    readonly fromBusiness: string
    readonly openSheet: string
    readonly copyInstead: string
    readonly handedOff: string
    readonly copied: string
    readonly dismissed: string
    readonly failed: string
    readonly unavailable: string
    readonly neverClaimsDelivery: string
    readonly fileComingWithApp: string
    readonly sharedOnce: string
    readonly sharedTimes: string
    readonly lastSharedOn: string
    readonly preview: string
  }
  /** §G's convert action. `{label}` is the target type's own name (§D). */
  readonly convert: {
    readonly title: string
    readonly turnInto: string
    readonly nothingToConvert: string
    readonly needsPrices: string
    readonly alreadyMade: string
    readonly openIt: string
    readonly madeFrom: string
    readonly originalUntouched: string
    readonly failed: string
  }
  /** Rule #5's corrections: void, credit, reissue. */
  /** §G: a receipt is evidence of a payment, and the payment comes first. */
  readonly newReceipt: {
    readonly title: string
    readonly explain: string
    readonly amount: string
    readonly method: string
    readonly reference: string
    readonly datePaid: string
    readonly whoPaid: string
    readonly against: string
    readonly standalone: string
    readonly standaloneNote: string
    readonly pickWhoFirst: string
    readonly lineStandalone: string
    readonly lineAgainst: string
    readonly record: string
    readonly alreadyHasOne: string
    readonly openReceipt: string
    readonly noPayment: string
    readonly failed: string
  }
  readonly publicLink: {
    readonly checking: string
    readonly wrong: string
    readonly expired: string
    readonly used: string
    readonly notAnswerable: string
    readonly rateLimited: string
    readonly from: string
    readonly accept: string
    readonly reject: string
    readonly accepted: string
    readonly rejected: string
    readonly signHere: string
    readonly whoAreYou: string
    readonly yourRole: string
    /** The goods table on the recipient's own page (§P, §V). */
    readonly goodsHeading: string
    readonly expected: string
    readonly signedThanks: string
    readonly optionalSignature: string
    readonly deliverTo: string
    readonly sending: string
    readonly failed: string
    readonly copyAccept: string
    readonly copySign: string
    /**
     * The sheet the link appears in (§G). `{label}` is the document's own
     * name through the terminology catalogue, never the word "waybill"
     * written here (Rule #4).
     */
    readonly signingLinkTitle: string
    readonly signingLinkBody: string
    readonly sendLink: string
    readonly copyLink: string
    readonly copiedShort: string
    readonly backTo: string
    readonly copied: string
    readonly expiresIn: string
    readonly needsInternet: string
    readonly mintFailed: string
  }
  readonly photo: {
    readonly add: string
    readonly change: string
    readonly taken: string
    readonly title: string
    readonly explain: string
    readonly sealed: string
    readonly notAnImage: string
    readonly failed: string
  }
  readonly signature: {
    readonly title: string
    readonly explain: string
    readonly pad: string
    readonly hint: string
    readonly undo: string
    readonly clear: string
    readonly use: string
    readonly nothingDrawn: string
    readonly drawn: string
    readonly useDefault: string
    readonly signHere: string
    readonly whoSigned: string
    readonly theirRole: string
    readonly rolePlaceholder: string
    readonly nameFirst: string
    readonly sendOnItsWay: string
    readonly onItsWay: string
    readonly markOnTheWay: string
    readonly linkLater: string
    readonly confirmDelivery: string
    readonly deliveredOn: string
    readonly signedBy: string
    readonly sealed: string
    readonly failed: string
  }
  readonly answer: {
    readonly title: string
    readonly explain: string
    readonly accepted: string
    readonly rejected: string
    readonly recorded: string
    readonly linkLater: string
    readonly failed: string
  }
  readonly revision: {
    readonly action: string
    readonly explain: string
    readonly make: string
    readonly openExisting: string
    readonly alreadyExists: string
    readonly badge: string
    readonly supersededBy: string
    readonly supersedes: string
    readonly openIt: string
    readonly checkTheDate: string
    readonly failed: string
  }
  readonly reissue: {
    readonly action: string
    readonly explain: string
    readonly openInvoice: string
    readonly replacedBy: string
    readonly replaces: string
    readonly moneyStays: string
    readonly paymentReversed: string
    readonly failed: string
  }
  readonly voidIt: {
    readonly title: string
    readonly explain: string
    readonly confirm: string
    readonly done: string
    readonly alreadyVoid: string
    readonly notAllowed: string
    readonly moneyReceived: string
    readonly creditTheBalance: string
    readonly reverseThePayment: string
    readonly paymentsStay: string
    readonly receiptPaymentStays: string
    readonly failed: string
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
    /** The row of brand-colour swatches above the strip (§H). */
    readonly brandColour: string
    /**
     * The page size every document prints at (§I: "A4 portrait, always").
     * A sentence in the catalogue rather than a literal at the call site, so
     * a region that prints Letter says so in one place.
     */
    readonly paper: string
    /**
     * The line above a saved document's page: what it is, which design, on
     * what paper. `{design}` is the design's OWN name and is never localised
     * (§H); `{type}` is the printed title, which for an issued document is
     * the frozen one (§D.2).
     */
    readonly caption: string
  }
  readonly totals: {
    /** The card's own title on a priced document. */
    readonly title: string
    /** The card's title on a delivery, which carries no money at all. */
    readonly dispatch: string
    readonly subtotal: string
    readonly discount: string
    readonly tax: string
    readonly withholding: string
    readonly payable: string
    /** A receipt states what arrived; it is not asking for anything (§H). */
    readonly received: string
    /** "VAT 7.5%" — the rate beside the word, so no figure is unexplained. */
    readonly atRate: string
    /** Where the tax rates come from, said once rather than guessed at (§J). */
    readonly ratesFromSettings: string
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
    /**
     * The FIELD's name. `askAnything` labels the card, and `askPlaceholder` is
     * an example question — announcing either as the field's name tells a
     * reader the card's title twice or reads an example as an instruction.
     */
    readonly askField: string
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
    /**
     * Names the scrollable table. Five money columns do not fit 320px, so the
     * table scrolls inside the page rather than dragging the page sideways —
     * and a region that scrolls has to be reachable by keyboard and named
     * when it takes focus (WCAG 2.1.1).
     */
    readonly rowsRegion: string
    readonly currencyNote: string
    readonly pickPeriod: string
    readonly thisMonth: string
    readonly last3Months: string
    readonly last12Months: string
    readonly everything: string
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
    readonly sheetTitle: string
    readonly howMuchLeft: string
    readonly creditAll: string
    readonly issue: string
    readonly issued: string
    readonly nothingLeft: string
    readonly failed: string
    readonly neverMovesIncome: string
    readonly reducesWhatIsOwed: string
  }
  readonly dataSync: {
    readonly title: string
    readonly uploadState: string
    readonly noAccountToSyncTo: string
    readonly storageTitle: string
    readonly storageDocuments: string
    readonly storageImages: string
    readonly exportAll: string
    readonly exportAlwaysFree: string
    /** After a successful export. Names the file, so it can be found again. */
    readonly exportDone: string
    /**
     * Said when the archive could not be read whole. It is never handed over
     * in that state: an owner who keeps a short export believes it complete.
     */
    readonly exportIncomplete: string
    readonly exportUnavailable: string
    readonly exportFailed: string
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
    voice: 'Say it out loud',
    scan: 'Photograph a document',
    /** §N: a missing model says so plainly — never "needs internet". */
    offlineToolsNeeded: 'These work on this phone once the offline tools are installed. Download them when you are connected.',
  },
  help: {
    title: 'Help & support',
    chatWithSupport: 'Chat with support',
    onWhatsApp: 'On WhatsApp',
    gettingStarted: 'Getting started',
    gettingStartedHint: 'The four document types, explained again',
    faq: [
      {
        question: 'How do I work without internet?',
        answer:
          'Everything saves on this phone first. Creating, viewing, sharing and recording a payment all work with the radios off; uploading happens by itself when you are back online.',
      },
      {
        question: 'When does an invoice become overdue?',
        answer:
          'On its own, the day after the due date. Nothing needs to be marked — the status is worked out from the date and what has been paid, every time you look.',
      },
      {
        question: 'Can I change a document I already sent?',
        answer:
          'No, and that is deliberate: the copy your customer is holding must keep saying what it said. Void it and issue a replacement, or add a credit note. The new one names the one it replaces.',
      },
      {
        question: 'What happens to my documents if I stop paying?',
        answer:
          'Nothing. Viewing, sharing and exporting everything you have already made stay free forever. A lapsed subscription never locks a record you made.',
      },
    ],
  },
  account: {
    title: 'Your account',
    signedIn: 'Signed in on this device.',
    noSession: 'No account on this device',
    noSessionBody: 'Everything here is kept on the phone. There is nothing to sign out of.',
    changePassword: 'Change password',
    changePasswordHint: 'We send a reset link to your email.',
    resetSentToYou: 'A reset link is on its way to your email. It expires after an hour.',
    resetFailed: 'That needs an internet connection. Nothing was sent — try again when you are online.',
    signInTitle: 'Sign in to DocFlow',
    signInBody: 'Your records sync to your account, so they are on every device you use.',
    email: 'Email',
    password: 'Password',
    passwordRule: 'At least {count} characters.',
    signIn: 'Sign in',
    createAccount: 'Create an account',
    haveAccount: 'Already have an account? Sign in',
    noAccount: 'New here? Create an account',
    forgotPassword: 'Forgot your password?',
    resetSent: 'If that email has an account, a reset link is on its way.',
    continueWithGoogle: 'Continue with Google',
    // §R: "Initial auth needs a connection." Said plainly, before the
    // attempt, rather than as an error afterwards (§N).
    needsConnection: 'Signing in needs an internet connection. Everything after this works offline.',
    signOut: 'Sign out',
    signOutTitle: 'Sign out of DocFlow?',
    signOutBody:
      'You’ll need your email and password to get back in. Your documents stay on this phone either way.',
    signOutConfirm: 'Sign out',
    signOutCancel: 'Stay signed in',
    businessTitle: 'Name your business',
    businessBody:
      'This goes at the top of every document you send. Your country sets the words, the currency and the payment details — you can change all of it later.',
    businessName: 'Business name',
    businessCountry: 'Business country',
    createBusiness: 'Create my business',
    creating: 'Creating your business…',
    demoTitle: 'Demo',
    // §R: "a local demo is never passed off as an account".
    demoBody:
      'This is a demo with sample records on this device only. Nothing is saved to an account, and it is cleared when you close the tab.',
    demoBodyKept:
      'Sample records on this phone only. Nothing is saved to an account, so nothing appears on another device.',
    tooManyTries: 'Too many tries. Wait a moment and try again.',
    tooManyTriesIn: 'Too many tries. Try again in {wait}.',
    wrongDetails: 'That email and password do not match.',
    signInProblem: 'Something went wrong signing in. Try again.',
  },
  nav: {
    sections: 'Sections',
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
  deleteAccount: {
    title: 'Delete this business',
    rowLabel: 'Delete this business',
    body:
      'Everything goes: documents, customers, payments, photos and signatures. ' +
      'Nobody at DocFlow keeps a copy you cannot reach.',
    exportFirst: 'Take your records with you first. Export is free, always.',
    exportAction: 'Export everything',
    exportDone: 'Exported',
    typeName: 'Type the business name to confirm',
    confirm: 'Delete in {days} days',
    ownerOnly: 'Only the owner can delete the business.',
    nameMismatch: 'That is not the business name.',
    scheduledTitle: 'This business will be deleted',
    scheduledBody:
      'Everything is still here until then. Sign in and tap Keep it to stop the deletion.',
    daysLeft: '{days} days left',
    keep: 'Keep it',
    whatGoes: 'Deleted: every document, customer, payment, photo and signature, and the sign-in itself.',
    whatStays: 'Kept: the date it was deleted, and nothing else about it.',
  },
  pro: {
    name: 'DocFlow Pro',
    free: 'Free',
    settingsRow: 'DocFlow Pro',
    partOfPro: '{feature} is part of Pro',
    perMonth: '{price} a month',
    perYear: '{price} a year',
    freeTrial: '{days} days free first',
    notNow: 'Not now',
    seePlan: 'See the plan',
    managePlan: 'Manage plan',
    restore: 'Restore purchases',
    badge: 'Pro',
    // Rule #6, said where somebody can read it rather than only in a spec.
    freeForever: 'Your documents stay yours either way — viewing, sharing and export are always free.',
    graceNotice: 'We could not check your plan. Pro keeps working until {date}.',
    lapsedNotice: 'Pro has ended. Nothing is locked, and everything comes back when it renews.',
  },
  palette: {
    title: 'Go anywhere',
    placeholder: 'Search, or jump to a page',
    open: 'Open the command palette',
    goTo: 'Go to',
    create: 'Create',
    records: 'Records',
    noMatch: 'Nothing matches that',
    resultCount: '{count} results',
    results: 'Results',
    openList: 'All {label}',
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
    add: 'Add a customer',
    newCustomer: 'New customer',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    isCompany: 'A business',
    isPerson: 'A person',
    save: 'Save',
  },
  contact: {
    chat: 'Chat',
    call: 'Call',
    statement: 'Statement',
    noPhone: 'Add a phone number to chat or call.',
    balance: 'Balance',
    history: 'History',
    noHistory: 'Nothing yet',
    noHistoryBody: 'Everything you make for this customer shows up here.',
    notes: 'Notes',
    notesHint: 'Only you see this. It never prints on a document.',
    notesPlaceholder: 'Anything worth remembering',
    newLabel: 'New label',
    saveLabel: 'Add',
    removeLabel: 'Remove {label}',
    back: 'All customers',
  },
  builder: {
    stepOf: 'Step {current} of {total}',
    saveDocument: 'Save {label}',
    designAndSize: '{design} · A4 portrait',
    newDocument: 'New {label}',
    missingTitle: 'Before you can issue this',
    notReadyYet: 'Not quite ready — the amber band above says what is missing.',
    couldNotIssue: 'That could not be issued: {reason}',
    fixThis: 'Fix this',
  },
  details: {
    numberAndDates: 'Number & dates',
    numberLabel: 'Number',
    reference: 'Reference',
    editReference: 'Edit reference',
    issueDate: 'Date',
    dueDate: 'Due',
    validUntil: 'Valid until',
    datePaid: 'Date paid',
    dispatchDate: 'Dispatch date',
    dispatch: 'Dispatch',
    expected: 'Expected',
    expectedDelivery: 'Expected delivery',
    today: 'Today',
    tomorrow: 'Tomorrow',
    yesterday: 'Yesterday',
    inDays: '{days} days',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    chooseDate: 'Choose a date',
    currencyAndPayment: 'Currency & payment',
    currency: 'Currency',
    paymentReady: '{count} payment method ready',
    paymentNotSet: 'No payment method yet',
    setUpPayment: 'Set up payment',
    settingUpPayment: 'Setting up payment for your document',
    backToDraft: 'Back to draft',
    signature: 'Signature',
    tapToSign: 'Tap to sign',
    deliveryAddress: 'Delivery address',
    linkedInvoice: 'Linked invoice',
    chooseCustomer: 'Choose who this is for',
    searchCustomers: 'Search or type a new name',
    nobodyChosen: 'Nobody chosen yet',
    addNamed: 'Add "{name}"',
    noCustomerMatch: 'No match. Type a name and add it.',
    change: 'Change',
    method: 'Method',
    paymentReference: 'Payment reference',
  },
  items: {
    addItem: 'Add an item',
    description: 'Description',
    quantity: 'Qty',
    unitPrice: 'Unit price',
    unit: 'Unit',
    unitExample: 'cartons, bags, pallets…',
    goods: 'Goods',
    typeAnItem: 'Type an item — saved ones appear',
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
    oneLanguageOnly: 'More languages appear here as each one is finished. DocFlow never ships a half-translated screen.',
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
    paymentMethods: 'Payment methods',
    cashOnDelivery: 'Cash on delivery',
    cashOnDeliveryHint: 'Pay the driver',
    methodOn: 'On',
    methodAdd: 'Add',
    noAccountYet: 'No account details yet',
    currencyChanged: 'Your currency changed, so these fields changed too.',
    company: 'Company & logo',
    businessName: 'Business name',
    businessAddress: 'Address',
    noLogoYet: 'No logo yet',
    uploadLogo: 'Upload',
    replaceLogo: 'Replace',
    createLogo: 'Create with AI',
    createLogoLater: 'Making a logo on the phone arrives with the offline model. Upload one meanwhile.',
    logoUnreadable: 'That file could not be read as an image.',
    nameStyle: 'Name style',
    logoSize: 'Logo size',
    numberingPrefixes: 'Numbering prefixes',
    prefixHint: 'Your prefix is always used, whatever the region suggests.',
    tax: 'Tax',
    taxRate: '{label} rate',
    withholdingRate: 'Withholding tax rate',
    workedExample: 'On {subtotal} you would charge {tax} and withhold {wht}, leaving {payable}.',
    savedItems: 'Saved items',
    savedItemsHint: 'Built from what you type. Change a price on a document and it applies next time.',
    perUnit: 'per {unit}',
    groupBusiness: 'Your business',
    groupYou: 'You & your data',
    notSetUpYet: 'Not set up yet',
    notSet: 'Not set',
    itemCount: '{count} items',
    noSavedItems: 'Nothing saved yet',
    noSavedItemsBody: 'Items you type into a document are kept here for next time.',
    usedTimes: 'used {count}×',
    theme: 'Dark mode',
    themeHint: 'Follows your phone unless you choose.',
    themeSystem: 'Follow phone',
    themeLight: 'Light',
    themeDark: 'Dark',
    legal: 'Privacy & terms',
    legalUnfinished: 'These documents still have blanks to fill in before release.',
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
  welcome: {
    brand: 'DocFlow',
    headline: 'Your paperwork. One clear place.',
    body: 'Create invoices, quotations, receipts and waybills. Keep customers and payments together.',
    step1: '1. Set up your business',
    step1Body: 'Add a business name and choose your country. You can finish the rest later.',
    step2: '2. Choose your first task',
    step2Body: 'We’ll explain which document fits what you need.',
    step3: '3. Follow your next steps',
    step3Body: 'A short checklist stays on Home while you get started.',
    getStarted: 'Get started',
    explore: 'Look around first',
    offlineNote: 'Everything works without a signal. Your records stay on this phone.',
    progressLabel: 'Setup progress',
    stepBusiness: '1. Your business',
    stepTask: '2. Your first task',
    stepReady: '3. Ready',
    back: '← Back',
    setupTitle: 'DocFlow setup',
    businessTitle: 'First, your business.',
    businessBody:
      'Start with the basics. You can add your logo, payment details and address in Settings later.',
    nameLabel: 'Business name',
    namePlaceholder: 'e.g. Chidinma Building Supplies',
    nameHelp: 'This prints at the top of every document you make.',
    countryLabel: 'Business country',
    countryHelp: 'Sets your currency, document names, bank fields and tax wording.',
    saveContinue: 'Save and continue',
    skipBusiness: 'Skip for now',
    taskTitle: 'What do you need to do?',
    taskBody: 'Pick one to start. All four are always available on Home.',
    hints: {
      invoice: 'Ask a customer to pay you.',
      quotation: 'Send a price before work begins.',
      receipt: 'Confirm a payment you received.',
      waybill: 'Record goods being delivered.',
    },
    continueOn: 'Continue',
    readyTitle: 'You’re ready to begin.',
    readyBody: 'Your first {label} follows a guided process. Review the details before you finish.',
    ready1: 'Choose a customer',
    ready1Body: 'Pick someone you have saved, or add a contact as you go.',
    ready2: 'Add the details',
    ready2Body: 'Items, quantities and prices — or goods and delivery details.',
    ready3: 'Review your document',
    ready3Body: 'Choose a design, check everything, then share it.',
    findYourWay: 'Find your way around',
    whereHome: 'Home: documents and next steps',
    whereCustomers: 'Customers: contacts and history',
    whereAnalytics: 'Analytics: money and activity',
    whereSettings: 'Settings: company, payments and preferences',
    startMine: 'Start my {label}',
    homeFirst: 'Go to Home first',
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
    repeatsSkipped:
      'Repeats: {count} older months were not created because the gap was too long ({months}). Everything since is here.',
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
    greetingLine: 'Here is where your money stands today.',
  },
  setup: {
    title: 'Your next steps',
    body: 'Use your own details, or explore with the sample data.',
    progress: '{done} of {total} complete',
    start: 'Start',
    viewGuide: 'View guide',
    hide: 'Hide checklist',
    businessDetails: 'Set up your business',
    logo: 'Add your logo',
    payment: 'Set up how you get paid',
    firstDocument: 'Complete your first document',
  },
  payments: {
    title: 'Payments',
    paidOfTotal: '{paid} paid of {total}',
    amountLeft: '{amount} left',
    settled: 'Settled in full',
    recordPayment: 'Record a payment',
    amount: 'Amount',
    method: 'Method',
    reference: 'Reference',
    datePaid: 'Date paid',
    none: 'No payments yet',
    noneBody: 'Record one when the money arrives.',
    creditedLine: '{amount} credited back',
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
  share: {
    title: 'Send this document',
    line: '{label} {reference}',
    forCustomer: 'For {customer}',
    totalLine: 'Total {amount}',
    outstandingLine: '{amount} still outstanding',
    dueLine: 'Due {due}',
    fromBusiness: '— {business}',
    openSheet: 'Send it',
    copyInstead: 'Copy the text',
    handedOff: 'Handed to the app you picked.',
    copied: 'Copied. Paste it wherever you like.',
    dismissed: 'Nothing was sent.',
    failed: 'That did not go through. Try again, or copy the text.',
    unavailable: 'This phone cannot open a share sheet. Copy the text instead.',
    neverClaimsDelivery: 'DocFlow cannot tell whether it arrived — only that you sent it.',
    fileComingWithApp: 'The PDF attaches itself in the installed app. For now the text goes out on its own.',
    sharedOnce: 'Sent once',
    sharedTimes: 'Sent {count} times',
    lastSharedOn: 'Last sent {date}',
    preview: 'What goes out',
  },
  convert: {
    title: 'Turn this into something else',
    // No article before {label}: the word comes from the region's own table,
    // and "a"/"an" cannot be chosen for it here without guessing (§D, §S).
    turnInto: 'Turn into {label}',
    nothingToConvert: 'Nothing to make from this one.',
    needsPrices: 'Prices needed — the delivery carried none.',
    alreadyMade: 'Already made: {label}',
    openIt: 'Open it',
    madeFrom: 'Made from {reference}',
    originalUntouched: 'This document stays exactly as it is.',
    failed: 'That could not be made: {reason}',
  },
  newReceipt: {
    title: 'Acknowledge a payment',
    explain: 'Record what came in first. The document is evidence of it.',
    amount: 'How much came in?',
    method: 'How?',
    reference: 'Their reference',
    datePaid: 'When?',
    whoPaid: 'Who paid?',
    against: 'Against',
    standalone: 'Nothing — it stands on its own',
    standaloneNote: 'Nothing is billed for it. The money sits as customer credit.',
    pickWhoFirst: 'Say who paid, and anything they still owe appears here.',
    lineStandalone: 'Payment received',
    lineAgainst: 'Payment received against {reference}',
    record: 'Record it',
    alreadyHasOne: 'This payment already has one.',
    openReceipt: 'Open it',
    noPayment: 'Record the payment first.',
    failed: 'That could not be recorded: {reason}',
  },
  publicLink: {
    checking: 'One moment…',
    // §P: a wrong token and an unknown document say the same thing, and
    // neither says whether a document is there.
    wrong: 'This link does not work. Ask whoever sent it for a new one.',
    expired: 'This link has expired. Ask whoever sent it for a new one.',
    used: 'This link has already been used.',
    notAnswerable: 'This has already been dealt with. Nothing more to do here.',
    rateLimited: 'Too many tries. Wait a minute and open the link again.',
    from: 'From {business}',
    accept: 'Accept',
    reject: 'Turn it down',
    accepted: 'Thank you — {business} has been told you accepted.',
    rejected: 'Thank you — {business} has been told.',
    signHere: 'Sign to confirm you received these goods',
    whoAreYou: 'Your name',
    yourRole: 'Your role (optional)',
    goodsHeading: 'Goods received',
    expected: 'Expected: {quantity}',
    signedThanks: 'Thank you. {business} has been told this arrived.',
    optionalSignature: 'Add your signature (optional)',
    deliverTo: 'Delivered to',
    sending: 'Sending…',
    failed: 'That did not go through. Check your connection and try again.',
    copyAccept: 'Copy a link for them to accept',
    copySign: 'Copy a link for them to sign',
    signingLinkTitle: '{label} signing link',
    signingLinkBody:
      'A private link for the recipient to check the goods and sign for them. It works once, for 14 days.',
    sendLink: 'Send it',
    copyLink: 'Copy the link',
    copiedShort: 'Copied',
    backTo: 'Back to the {label}',
    copied: 'Copied. It works for 14 days, once.',
    expiresIn: 'A link is already out. Copying again replaces it.',
    // §Q: "Copy-link actions disabled with a 'needs internet' note until
    // synced." The link opens a page on the web, so it cannot be made offline.
    needsInternet: 'Needs internet — the link opens a page on the web.',
    mintFailed: 'That link could not be made: {reason}',
  },
  photo: {
    add: 'Add a photo',
    change: 'Take another',
    taken: 'Photo attached',
    title: 'Proof of delivery',
    explain: 'The goods at the gate, the stack, the plate number — whatever settles an argument later.',
    sealed: 'This was taken at delivery and cannot be changed.',
    notAnImage: 'That file is not a photo.',
    failed: 'That photo could not be saved: {reason}',
  },
  signature: {
    title: 'Sign',
    explain: 'Draw with a finger or a stylus.',
    pad: 'Signing area',
    hint: 'Sign above the line',
    undo: 'Undo',
    clear: 'Start again',
    use: 'Use this',
    nothingDrawn: 'Nothing drawn yet.',
    drawn: 'Signed',
    useDefault: 'Use my saved signature',
    signHere: 'Tap to sign',
    whoSigned: 'Who received it?',
    theirRole: 'Their role',
    rolePlaceholder: 'Storekeeper, driver, owner…',
    nameFirst: 'Add who received it, then hand over the phone to sign.',
    sendOnItsWay: 'Send it on its way',
    onItsWay: 'On its way. Sign for it when it arrives.',
    markOnTheWay: 'Mark it on the way',
    linkLater: 'A link they can sign on their own phone arrives with the web app.',
    confirmDelivery: 'Confirm delivery',
    deliveredOn: 'Delivered {date}',
    signedBy: 'Signed by {name}',
    sealed: 'This cannot be changed once signed.',
    failed: 'That could not be saved: {reason}',
  },
  answer: {
    title: 'What did they say?',
    explain: 'Record their answer so the rest of the app knows where this stands.',
    accepted: 'They accepted',
    rejected: 'They turned it down',
    recorded: 'Answered {answer} — this cannot be changed. Withdraw it or send a new version instead.',
    linkLater: 'A link they can answer on themselves arrives with the web app.',
    failed: 'That could not be recorded: {reason}',
  },
  revision: {
    // §G calls it "duplicate as Rev 2", and Rev is what a quotation says in
    // the trades this is built for. The sentence around it is the plain part.
    action: 'Make Rev {number}',
    explain: 'A fresh copy to change and send. The one they already have stays exactly as it is.',
    make: 'Make Rev {number}',
    openExisting: 'Rev {number} already exists.',
    alreadyExists: 'There is already a newer version of this.',
    badge: 'Rev {number}',
    supersededBy: 'Replaced by Rev {number}',
    supersedes: 'Replaces {reference}',
    openIt: 'Open it',
    checkTheDate: 'Set how long this one is good for.',
    failed: 'That could not be copied: {reason}',
  },
  reissue: {
    action: 'Cancel and draw a new one',
    explain: 'This one is cancelled and a fresh copy is drawn for the same money.',
    openInvoice: 'Open what it paid for',
    replacedBy: 'Cancelled — a newer one replaces this',
    replaces: 'Replaces {reference}',
    moneyStays: 'The money stays exactly as recorded. Nothing is received twice.',
    paymentReversed: 'That payment was reversed, so there is nothing left to acknowledge. Cancel this one on its own.',
    failed: 'That could not be done: {reason}',
  },
  voidIt: {
    title: 'Cancel this document',
    explain: 'It stays on your records, marked cancelled. Nothing is deleted.',
    confirm: 'Cancel it',
    done: 'Cancelled.',
    alreadyVoid: 'Already cancelled.',
    notAllowed: 'This one cannot be cancelled from where it is.',
    moneyReceived: 'Money has already come in against this, so cancelling it would leave that payment attached to nothing.',
    creditTheBalance: 'Credit the balance back instead',
    reverseThePayment: 'Reverse the payment first, if it was recorded by mistake',
    paymentsStay: 'Payments already recorded stay exactly as they are.',
    receiptPaymentStays: 'The payment stays on your records — only this receipt is cancelled.',
    failed: 'That could not be cancelled: {reason}',
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
    brandColour: 'Brand colour',
    paper: 'A4 portrait',
    caption: '{type} · {design} · {paper}',
  },
  totals: {
    title: 'Totals',
    dispatch: 'Dispatch',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Tax',
    withholding: 'Less withholding tax',
    payable: 'Payable',
    received: 'Received',
    atRate: '{label} {rate}%',
    ratesFromSettings: 'Tax rates come from Settings → Tax, and are saved onto the document when you issue it.',
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
    askField: 'Your question',
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
    rowsRegion: 'Statement rows',
    nothingInPeriod: 'Nothing in this period',
    nothingInPeriodBody: 'Pick a wider period, or start from this customer first document.',
    currencyNote: 'All amounts in {currency}.',
    pickPeriod: 'Period',
    thisMonth: 'This month',
    last3Months: 'Last 3 months',
    last12Months: 'Last 12 months',
    everything: 'Everything',
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
    sheetTitle: 'Credit some of this back',
    howMuchLeft: '{amount} of this can still be credited.',
    creditAll: 'All of it',
    issue: 'Credit it back',
    issued: 'Credited {amount}.',
    nothingLeft: 'This one is fully credited already.',
    failed: 'That could not be credited: {reason}',
    neverMovesIncome: 'A credit lowers what is owed. It never changes money you have already received.',
    reducesWhatIsOwed: 'Reduces what is owed by {amount}.',
  },
  dataSync: {
    title: 'Data & sync',
    uploadState: 'Upload state',
    noAccountToSyncTo: 'There is no account on this device, so nothing is uploaded anywhere.',
    storageTitle: 'Storage on this phone',
    storageDocuments: 'Documents',
    storageImages: 'Photos, logos, signatures',
    exportAll: 'Export all my data',
    exportAlwaysFree: 'Your documents and export are never locked, on any plan.',
    exportDone: 'Exported everything as',
    exportIncomplete:
      'Not exported — some of your records could not be read, so the file would have been ' +
      'incomplete. Nothing was saved. What failed:',
    exportUnavailable: 'This device has no way to save or share a file.',
    exportFailed: 'Nothing was exported.',
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
    // Named so the fix is obvious: the method is on, the details are not.
    payment_details: 'Finish your bank details — the method is on, but the account is empty.',
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

/**
 * The languages a person may actually choose (§S).
 *
 * DERIVED FROM THE CATALOGUES, never a list written beside them. §S says no
 * non-working language toggle ever ships, and a hand-kept list is exactly how
 * one does: somebody adds "Français" to the picker, the catalogue is not
 * there, and `stringsFor` throws on the next render.
 *
 * So the picker offers what exists. Today that is English alone; the day a
 * complete FR catalogue is added to `CATALOGUES`, the row appears with no
 * screen changed.
 *
 * The names are the language's OWN — a person looking for Yorùbá is not
 * looking for "Yoruba", and someone who cannot read the current language
 * needs their own name to find their way out.
 */
const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  ar: 'العربية',
}

export interface AvailableLanguage {
  readonly code: string
  /** In the language itself. */
  readonly name: string
}

export function availableLanguages(): AvailableLanguage[] {
  return Object.keys(CATALOGUES).map((code) => ({
    code,
    name: LANGUAGE_NAMES[code] ?? code.toLocaleUpperCase(),
  }))
}

/** `format('Owes {amount}', { amount: '₦95,000' })`. Unknown keys stay literal. */
export function format(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  )
}
