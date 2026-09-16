/**
 * What DocFlow actually collects, who sees it, and for how long (§P, §T).
 *
 * THE POLICIES ARE GENERATED FROM THIS FILE. That is the whole point of it
 * existing: a privacy policy written from a template describes a different
 * app, and the gap only shows up when a regulator or a store reviewer asks.
 * `documents.ts` turns these rows into prose, and `policy/checks.ts` already
 * answers the Play Data Safety form from the repository — so when a field is
 * added, the thing to update is here, and both follow.
 *
 * IT DESCRIBES THIS BUILD, NOT AN AMBITION. Every row below was read out of
 * the code: `src/data/repositories/types.ts` for the records, the Capacitor
 * plugin list for the device permissions, `package.json` for the processors.
 * Nothing is listed because it seemed likely.
 *
 * The two absences are as load-bearing as the entries, because they are what
 * makes most of a normal policy inapplicable here:
 *
 *  · **No analytics, no error tracking, no advertising, no CDN.** The
 *    dependency list is nineteen packages and none of them is any of those.
 *    §V forbids the CDN outright ("nothing needed to open a saved document
 *    touches a CDN"), and nothing was ever added for the rest.
 *  · **No cookies.** The app sets none. What it keeps is a short list of
 *    browser-storage keys, every one of them functional, listed below.
 */

/** Who the data is about. A business tool holds two kinds of person. */
export type Subject =
  /** The person using DocFlow. */
  | 'owner'
  /** Someone the owner sells to, entered BY the owner. */
  | 'customer'

export interface DataCategory {
  readonly id: string
  readonly what: string
  /** Why it exists. A field with no answer here should not be collected. */
  readonly why: string
  readonly subject: Subject
  /** GDPR Art. 6. Named per category rather than once, because they differ. */
  readonly basis: 'contract' | 'legitimate_interest' | 'legal_obligation' | 'consent'
  /** Where the bytes live. */
  readonly storedIn: readonly ('device' | 'account')[]
  readonly optional: boolean
}

/**
 * Every field, from `src/data/repositories/types.ts`.
 *
 * RULE #1 RUNS THROUGH THE `optional` COLUMN: "no new required fields, ever".
 * Everything a business can work without is optional, and the app is usable
 * with almost all of it empty.
 */
export const DATA_CATEGORIES: readonly DataCategory[] = [
  {
    id: 'account',
    what: 'Email address, and the password you choose (held by our authentication provider, never by us in readable form)',
    why: 'To sign you in and to put your records on every device you use',
    subject: 'owner',
    basis: 'contract',
    storedIn: ['account'],
    optional: false,
  },
  {
    id: 'business',
    what: 'Business name, address, logo, bank details, tax rates and numbering prefixes',
    why: 'These print on the documents you send. The bank details are what your customer pays into',
    subject: 'owner',
    basis: 'contract',
    storedIn: ['device', 'account'],
    optional: true,
  },
  {
    id: 'customers',
    what: 'The names, phone numbers, email addresses, delivery addresses, labels and private notes you enter for the people and businesses you sell to',
    why: 'To address a document to somebody, and to reach them about it',
    subject: 'customer',
    basis: 'legitimate_interest',
    storedIn: ['device', 'account'],
    optional: true,
  },
  {
    id: 'documents',
    what: 'Your invoices, quotations, receipts and delivery notes — line items, amounts, dates, delivery addresses and the payments recorded against them',
    why: 'They are the product. This is the thing you came to make',
    subject: 'owner',
    basis: 'contract',
    storedIn: ['device', 'account'],
    optional: false,
  },
  {
    id: 'signatures',
    what: 'Signatures drawn on a delivery, the name and role of whoever signed, and any delivery photo attached',
    why: 'Evidence that goods arrived. It is what settles a dispute weeks later',
    subject: 'customer',
    basis: 'legitimate_interest',
    storedIn: ['device', 'account'],
    optional: true,
  },
  {
    id: 'device',
    what: 'A random identifier for this installation, and the app settings you choose',
    why: 'To tell your devices apart when they sync, and to remember your choices',
    subject: 'owner',
    basis: 'contract',
    storedIn: ['device'],
    optional: false,
  },
]

export interface Processor {
  readonly name: string
  readonly role: string
  /** What this one actually sees. Never "all data". */
  readonly sees: string
  readonly where: string
}

/**
 * Everyone outside DocFlow who touches any of it.
 *
 * Short, and it is short for a reason that should survive: every addition
 * here is a new place a customer's address ends up. `package.json` is the
 * check — if a name appears there that is not here, one of the two is wrong.
 */
export const PROCESSORS: readonly Processor[] = [
  {
    name: 'Supabase',
    role: 'Database, authentication and server functions',
    sees: 'Everything stored in your account: your email address, your business details, your customers and your documents',
    where: '[[SUPABASE_REGION]]',
  },
  {
    name: 'Paystack',
    role: 'Payment notifications',
    sees: 'Only the payment events it sends us for payments its own customers make. It receives no customer list and no documents from DocFlow',
    where: 'Nigeria',
  },
  {
    name: 'Apple and Google',
    role: 'App distribution and subscription billing',
    sees: 'Your subscription status, through their own billing systems. DocFlow never receives or stores a card number',
    where: 'Per their own terms',
  },
]

export interface StorageKey {
  readonly key: string
  readonly purpose: string
  /** Strictly necessary keys are the only kind this app has. */
  readonly essential: true
  readonly lifetime: string
}

/**
 * Browser storage, in full.
 *
 * NOT COOKIES — the app sets none, which is why there is no consent banner:
 * there is nothing non-essential to consent to. Every key below is here
 * because a feature stops working without it.
 */
export const STORAGE_KEYS: readonly StorageKey[] = [
  {
    key: 'docflow.auth',
    purpose: 'Keeps you signed in, so you are not asked for your password on every launch',
    essential: true,
    lifetime: 'Until you sign out',
  },
  {
    key: 'docflow.db.key',
    purpose: 'The key that encrypts the records held on this device',
    essential: true,
    lifetime: 'Until the app is uninstalled',
  },
  {
    key: 'docflow.deviceId',
    purpose: 'Tells your devices apart when they sync, so an edit made on one is not applied twice',
    essential: true,
    lifetime: 'Until the app is uninstalled',
  },
  {
    key: 'docflow.theme',
    purpose: 'Remembers whether you chose light, dark, or to follow the phone',
    essential: true,
    lifetime: 'Until you change it',
  },
  {
    key: 'docflow.onboarded',
    purpose: 'Remembers that you have seen the welcome, so it is not shown again',
    essential: true,
    lifetime: 'Until the app is uninstalled',
  },
  {
    key: 'docflow.checklistHidden',
    purpose: 'Remembers that you dismissed the setup checklist on the home screen',
    essential: true,
    lifetime: 'Until the app is uninstalled',
  },
  {
    key: 'docflow.ratings',
    purpose: 'Remembers that you were asked to rate the app, so you are not asked again',
    essential: true,
    lifetime: 'Until the app is uninstalled',
  },
  {
    key: 'docflow.app',
    purpose: 'Holds the records themselves while you use DocFlow in a web browser',
    essential: true,
    lifetime: 'Until you sign out or clear your browser data',
  },
]

export interface DevicePermission {
  readonly name: string
  readonly askedWhen: string
  readonly ifRefused: string
}

/** From `android/app/src/main/AndroidManifest.xml`. Asked at the point of use. */
export const DEVICE_PERMISSIONS: readonly DevicePermission[] = [
  {
    name: 'Camera',
    askedWhen: 'Only when you tap to photograph a delivery or a receipt',
    ifRefused: 'Everything else works. You can attach a picture from your files instead',
  },
  {
    name: 'Contacts',
    askedWhen: 'Only when you choose to import customers from your phone',
    ifRefused: 'Everything else works. You can add customers by typing them',
  },
  {
    name: 'Biometrics',
    askedWhen: 'Only if you switch on the optional app lock',
    ifRefused: 'The app opens normally, without a lock',
  },
]

/** Nothing this app does not do, stated so a reviewer does not have to guess. */
export const NOT_COLLECTED: readonly string[] = [
  'No analytics, and no behavioural tracking of any kind',
  'No advertising, and no advertising identifier',
  'No location, and no background location',
  'No card numbers — Apple, Google and your customers’ payment providers handle those, never DocFlow',
  'No microphone recording leaves the device',
  'No selling or sharing of personal information to anybody, for any purpose',
]
