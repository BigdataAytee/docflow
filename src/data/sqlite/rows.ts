/**
 * Rows in, records out (§E, §Q Phase 4).
 *
 * SQLite holds four types. The records above hold optional fields, nested
 * objects and `Money`. This file is the only place the two meet, so that a
 * repository reads like the contract it implements and a column name appears
 * exactly once.
 *
 * Three decisions worth stating, because each one is a rule rather than a
 * preference:
 *
 *  · **`Money` is split into two columns, never one.** A currency and an
 *    integer, side by side, so the database can be queried without parsing and
 *    so a minor unit is stored in an INTEGER column where `strict` refuses a
 *    float (Rule #3). A single `"NGN 1500"` string would put money behind a
 *    parser, which is precisely the class of bug Rule #3 exists to close.
 *
 *  · **Absent and null are different.** An optional field the record never had
 *    is omitted from the object entirely rather than set to `undefined`, so
 *    `exactOptionalPropertyTypes` holds and a patch can still say "the owner
 *    cleared this" with an explicit `null` (see `Company.defaultSignatureAssetId`).
 *
 *  · **JSON columns are parsed defensively.** A row can be corrupt — a partial
 *    write, a restored backup, a future build's shape. A throw here would take
 *    down a list screen; the fallback keeps the other records readable and
 *    lets the one bad row be the only casualty.
 */

import type { SqlRow, SqlValue } from './driver'
import type {
  AssetRecord,
  Company,
  CreditNoteRecord,
  Customer,
  DocumentRecord,
  DocumentType,
  Expense,
  FrozenLabels,
  LineItem,
  LinkTokenRecord,
  Money,
  Payment,
  PaymentAllocation,
  RecurrenceRecord,
  SavedItem,
  ShareEvent,
} from '../repositories/types'

/* ------------------------------------------------------------------ atoms */

export const text = (value: SqlValue | undefined): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

const requiredText = (value: SqlValue | undefined, column: string): string => {
  if (typeof value !== 'string') throw new Error(`Column ${column} is missing or not text.`)
  return value
}

const int = (value: SqlValue | undefined): number | undefined =>
  typeof value === 'number' ? value : undefined

const requiredInt = (value: SqlValue | undefined, column: string): number => {
  if (typeof value !== 'number') throw new Error(`Column ${column} is missing or not a number.`)
  return value
}

/** SQLite has no boolean. 1 and 0, and absent stays absent. */
const bool = (value: SqlValue | undefined): boolean | undefined =>
  typeof value === 'number' ? value !== 0 : undefined

export const fromBool = (value: boolean | undefined): SqlValue =>
  value === undefined ? null : value ? 1 : 0

/** `undefined` means "omit the key"; the `??` chain keeps a real `null`. */
const optional = <T>(key: string, value: T | undefined): Record<string, T> =>
  value === undefined ? {} : { [key]: value }

function parseJson<T>(value: SqlValue | undefined, fallback: T): T {
  if (typeof value !== 'string' || value === '') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    // A corrupt cell loses one field, not the screen that was rendering it.
    return fallback
  }
}

export const json = (value: unknown): string => JSON.stringify(value)

/** Both halves of a `Money`, or neither. A half-written amount is not money. */
const money = (currency: SqlValue | undefined, minor: SqlValue | undefined): Money | undefined => {
  const code = text(currency)
  const amount = int(minor)
  return code !== undefined && amount !== undefined ? { currency: code, minor: amount } : undefined
}

/* -------------------------------------------------------------- companies */

export const toCompany = (row: SqlRow): Company => ({
  id: requiredText(row['id'], 'id'),
  name: requiredText(row['name'], 'name'),
  localeRegion: requiredText(row['locale_region'], 'locale_region'),
  localeLanguage: requiredText(row['locale_language'], 'locale_language'),
  labelOverrides: parseJson<Partial<Record<DocumentType, string>>>(row['label_overrides'], {}),
  currency: requiredText(row['currency'], 'currency'),
  numberingPrefixes: parseJson<Partial<Record<DocumentType, string>>>(row['numbering_prefixes'], {}),
  bankFields: parseJson<Record<string, string>>(row['bank_fields'], {}),
  enabledPaymentMethods: parseJson<string[]>(row['enabled_payment_methods'], []),
  ...optional('address', text(row['address'])),
  ...optional('phone', text(row['phone'])),
  ...optional('email', text(row['email'])),
  ...optional('website', text(row['website'])),
  ...optional('brandColour', text(row['brand_colour'])),
  ...optional('nameStyle', text(row['name_style']) as Company['nameStyle']),
  ...optional('logoSize', text(row['logo_size']) as Company['logoSize']),
  ...optional('logoAssetId', text(row['logo_asset_id'])),
  ...optional('taxRatePpm', int(row['tax_rate_ppm'])),
  ...optional('whtRatePpm', int(row['wht_rate_ppm'])),
  // The one field where `null` is a value and not an absence: it is how the
  // owner says "I removed my signature" rather than "unchanged" (§E).
  ...(row['default_signature_asset_id'] === undefined
    ? {}
    : { defaultSignatureAssetId: text(row['default_signature_asset_id']) ?? null }),
  ...optional('signatureRequired', bool(row['signature_required'])),
})

export const companyColumns = (company: Company): Record<string, SqlValue> => ({
  id: company.id,
  name: company.name,
  locale_region: company.localeRegion,
  locale_language: company.localeLanguage,
  label_overrides: json(company.labelOverrides),
  currency: company.currency,
  numbering_prefixes: json(company.numberingPrefixes),
  bank_fields: json(company.bankFields),
  enabled_payment_methods: json(company.enabledPaymentMethods),
  address: company.address ?? null,
  phone: company.phone ?? null,
  email: company.email ?? null,
  website: company.website ?? null,
  brand_colour: company.brandColour ?? null,
  name_style: company.nameStyle ?? null,
  logo_size: company.logoSize ?? null,
  logo_asset_id: company.logoAssetId ?? null,
  tax_rate_ppm: company.taxRatePpm ?? null,
  wht_rate_ppm: company.whtRatePpm ?? null,
  default_signature_asset_id: company.defaultSignatureAssetId ?? null,
  signature_required: fromBool(company.signatureRequired),
})

/* -------------------------------------------------------------- customers */

export const toCustomer = (row: SqlRow): Customer => ({
  id: requiredText(row['id'], 'id'),
  companyId: requiredText(row['company_id'], 'company_id'),
  kind: requiredText(row['kind'], 'kind') as Customer['kind'],
  name: requiredText(row['name'], 'name'),
  labels: parseJson<string[]>(row['labels'], []),
  ...optional('phone', text(row['phone'])),
  ...optional('email', text(row['email'])),
  ...optional('address', text(row['address'])),
  ...optional('privateNote', text(row['private_note'])),
})

export const customerColumns = (customer: Customer): Record<string, SqlValue> => ({
  id: customer.id,
  company_id: customer.companyId,
  kind: customer.kind,
  name: customer.name,
  phone: customer.phone ?? null,
  email: customer.email ?? null,
  address: customer.address ?? null,
  labels: json(customer.labels),
  private_note: customer.privateNote ?? null,
})

/* -------------------------------------------------------------- documents */

export const toDocument = (row: SqlRow): DocumentRecord => ({
  id: requiredText(row['id'], 'id'),
  companyId: requiredText(row['company_id'], 'company_id'),
  type: requiredText(row['type'], 'type') as DocumentType,
  status: requiredText(row['status'], 'status'),
  currency: requiredText(row['currency'], 'currency'),
  lineItems: parseJson<LineItem[]>(row['line_items'], []),
  totalMinor: requiredInt(row['total_minor'], 'total_minor'),
  // Both null until issue, then frozen forever (§M). `null` is the value, so
  // these are never omitted — a missing key would read as "not yet loaded".
  issuedReference: text(row['issued_reference']) ?? null,
  ...optional('referenceOverride', text(row['reference_override'])),
  ...optional('taxRatePpm', int(row['tax_rate_ppm'])),
  ...optional('whtRatePpm', int(row['wht_rate_ppm'])),
  frozenLabels: parseJson<FrozenLabels | null>(row['frozen_labels'], null),
  ...optional('customerId', text(row['customer_id'])),
  ...optional('issueDate', text(row['issue_date'])),
  ...optional('dueDate', text(row['due_date'])),
  ...optional('validUntil', text(row['valid_until'])),
  ...optional('convertedFromId', text(row['converted_from_id'])),
  ...optional('paymentId', text(row['payment_id'])),
  ...optional('linkedInvoiceId', text(row['linked_invoice_id'])),
  ...optional('supersedesId', text(row['supersedes_id'])),
  ...optional('signatureAssetId', text(row['signature_asset_id'])),
  ...optional('deliveryAddress', text(row['delivery_address'])),
  ...optional('driverName', text(row['driver_name'])),
  ...optional('vehicleNumber', text(row['vehicle_number'])),
  ...optional('dispatchDate', text(row['dispatch_date'])),
  ...optional('expectedDate', text(row['expected_date'])),
  ...optional('signerName', text(row['signer_name'])),
  ...optional('signerRole', text(row['signer_role'])),
  ...optional('signedAt', text(row['signed_at'])),
  ...optional('deliveryPhotoAssetId', text(row['delivery_photo_asset_id'])),
  // The design, kept with the document (§H). Null on every row saved before
  // these columns existed, which reads as "the app's defaults" — the same
  // thing those rows have always meant.
  ...optional('templateId', text(row['template_id'])),
  ...optional('showLogo', bool(row['show_logo'])),
  ...optional('brandColour', text(row['brand_colour'])),
  ...optional('discountRatePpm', int(row['discount_rate_ppm'])),
  ...optional('recurrenceKey', text(row['recurrence_key'])),
})

/* ------------------------------------------------------------ recurrences */

export const toRecurrence = (row: SqlRow): RecurrenceRecord => ({
  companyId: requiredText(row['company_id'], 'company_id'),
  sourceDocumentId: requiredText(row['source_document_id'], 'source_document_id'),
  dayOfMonth: requiredInt(row['day_of_month'], 'day_of_month'),
  startedOn: requiredText(row['started_on'], 'started_on'),
  ...optional('endedOn', text(row['ended_on'])),
})

export const recurrenceColumns = (recurrence: RecurrenceRecord): Record<string, SqlValue> => ({
  source_document_id: recurrence.sourceDocumentId,
  company_id: recurrence.companyId,
  day_of_month: recurrence.dayOfMonth,
  started_on: recurrence.startedOn,
  ended_on: recurrence.endedOn ?? null,
})

export const documentColumns = (document: DocumentRecord): Record<string, SqlValue> => ({
  id: document.id,
  company_id: document.companyId,
  type: document.type,
  status: document.status,
  customer_id: document.customerId ?? null,
  currency: document.currency,
  line_items: json(document.lineItems),
  issue_date: document.issueDate ?? null,
  due_date: document.dueDate ?? null,
  valid_until: document.validUntil ?? null,
  converted_from_id: document.convertedFromId ?? null,
  payment_id: document.paymentId ?? null,
  linked_invoice_id: document.linkedInvoiceId ?? null,
  supersedes_id: document.supersedesId ?? null,
  signature_asset_id: document.signatureAssetId ?? null,
  delivery_address: document.deliveryAddress ?? null,
  driver_name: document.driverName ?? null,
  vehicle_number: document.vehicleNumber ?? null,
  dispatch_date: document.dispatchDate ?? null,
  expected_date: document.expectedDate ?? null,
  signer_name: document.signerName ?? null,
  signer_role: document.signerRole ?? null,
  signed_at: document.signedAt ?? null,
  delivery_photo_asset_id: document.deliveryPhotoAssetId ?? null,
  template_id: document.templateId ?? null,
  // `fromBool`, not `?? null`: the latter turns `false` into null and loses a
  // logo that was deliberately switched OFF.
  show_logo: fromBool(document.showLogo),
  brand_colour: document.brandColour ?? null,
  discount_rate_ppm: document.discountRatePpm ?? null,
  recurrence_key: document.recurrenceKey ?? null,
  issued_reference: document.issuedReference,
  reference_override: document.referenceOverride ?? null,
  tax_rate_ppm: document.taxRatePpm ?? null,
  wht_rate_ppm: document.whtRatePpm ?? null,
  frozen_labels: document.frozenLabels === null ? null : json(document.frozenLabels),
  total_minor: document.totalMinor,
})

/* --------------------------------------------------------------- payments */

export const toAllocation = (row: SqlRow): PaymentAllocation => ({
  id: requiredText(row['id'], 'id'),
  paymentId: requiredText(row['payment_id'], 'payment_id'),
  invoiceId: requiredText(row['invoice_id'], 'invoice_id'),
  amount: money(row['currency'], row['amount_minor']) ?? { currency: 'XXX', minor: 0 },
})

export const toPayment = (row: SqlRow, allocations: readonly PaymentAllocation[]): Payment => ({
  id: requiredText(row['id'], 'id'),
  customerId: requiredText(row['customer_id'], 'customer_id'),
  amount: {
    currency: requiredText(row['currency'], 'currency'),
    minor: requiredInt(row['amount_minor'], 'amount_minor'),
  },
  paidAt: requiredText(row['paid_at'], 'paid_at'),
  method: requiredText(row['method'], 'method'),
  source: requiredText(row['source'], 'source') as Payment['source'],
  allocations: [...allocations],
  ...optional('reference', text(row['reference'])),
  ...optional('externalEventId', text(row['external_event_id'])),
  ...optional('reversalOfId', text(row['reversal_of_id'])),
})

export const paymentColumns = (payment: Payment): Record<string, SqlValue> => ({
  id: payment.id,
  customer_id: payment.customerId,
  currency: payment.amount.currency,
  amount_minor: payment.amount.minor,
  paid_at: payment.paidAt,
  method: payment.method,
  source: payment.source,
  reference: payment.reference ?? null,
  external_event_id: payment.externalEventId ?? null,
  reversal_of_id: payment.reversalOfId ?? null,
})

export const allocationColumns = (
  allocation: PaymentAllocation,
  position: number,
): Record<string, SqlValue> => ({
  id: allocation.id,
  payment_id: allocation.paymentId,
  invoice_id: allocation.invoiceId,
  currency: allocation.amount.currency,
  amount_minor: allocation.amount.minor,
  // Allocations are ordered, and `select *` without an ORDER BY is not. A
  // largest-remainder distribution (§K) is only reproducible in its own order.
  position,
})

/* ------------------------------------------------------------------ items */

export const toItem = (row: SqlRow): SavedItem => ({
  id: requiredText(row['id'], 'id'),
  companyId: requiredText(row['company_id'], 'company_id'),
  name: requiredText(row['name'], 'name'),
  timesUsed: requiredInt(row['times_used'], 'times_used'),
  ...optional('lastPrice', money(row['last_price_currency'], row['last_price_minor'])),
  ...optional('unit', text(row['unit'])),
})

export const itemColumns = (item: SavedItem): Record<string, SqlValue> => ({
  id: item.id,
  company_id: item.companyId,
  name: item.name,
  last_price_currency: item.lastPrice?.currency ?? null,
  last_price_minor: item.lastPrice?.minor ?? null,
  unit: item.unit ?? null,
  times_used: item.timesUsed,
})

/* --------------------------------------------------------------- expenses */

export const toExpense = (row: SqlRow): Expense => ({
  id: requiredText(row['id'], 'id'),
  companyId: requiredText(row['company_id'], 'company_id'),
  description: requiredText(row['description'], 'description'),
  amount: {
    currency: requiredText(row['currency'], 'currency'),
    minor: requiredInt(row['amount_minor'], 'amount_minor'),
  },
  spentOn: requiredText(row['spent_on'], 'spent_on'),
  ...optional('category', text(row['category'])),
  ...optional('photoAssetId', text(row['photo_asset_id'])),
})

export const expenseColumns = (expense: Expense): Record<string, SqlValue> => ({
  id: expense.id,
  company_id: expense.companyId,
  description: expense.description,
  category: expense.category ?? null,
  currency: expense.amount.currency,
  amount_minor: expense.amount.minor,
  spent_on: expense.spentOn,
  photo_asset_id: expense.photoAssetId ?? null,
})

/* ----------------------------------------------------------- credit notes */

export const toCreditNote = (row: SqlRow): CreditNoteRecord => ({
  id: requiredText(row['id'], 'id'),
  companyId: requiredText(row['company_id'], 'company_id'),
  invoiceId: requiredText(row['invoice_id'], 'invoice_id'),
  amount: {
    currency: requiredText(row['currency'], 'currency'),
    minor: requiredInt(row['amount_minor'], 'amount_minor'),
  },
  reason: requiredText(row['reason'], 'reason'),
  issuedAt: requiredText(row['issued_at'], 'issued_at'),
  reference: requiredText(row['reference'], 'reference'),
  invoiceReference: requiredText(row['invoice_reference'], 'invoice_reference'),
  invoiceTotal: {
    currency: requiredText(row['invoice_total_currency'], 'invoice_total_currency'),
    minor: requiredInt(row['invoice_total_minor'], 'invoice_total_minor'),
  },
})

export const creditNoteColumns = (note: CreditNoteRecord): Record<string, SqlValue> => ({
  id: note.id,
  company_id: note.companyId,
  invoice_id: note.invoiceId,
  currency: note.amount.currency,
  amount_minor: note.amount.minor,
  reason: note.reason,
  issued_at: note.issuedAt,
  reference: note.reference,
  invoice_reference: note.invoiceReference,
  invoice_total_currency: note.invoiceTotal.currency,
  invoice_total_minor: note.invoiceTotal.minor,
})

/* ----------------------------------------------------------- share events */

export const toShareEvent = (row: SqlRow): ShareEvent => ({
  id: requiredText(row['id'], 'id'),
  companyId: requiredText(row['company_id'], 'company_id'),
  action: requiredText(row['action'], 'action') as ShareEvent['action'],
  entity: requiredText(row['entity'], 'entity') as ShareEvent['entity'],
  recordId: requiredText(row['record_id'], 'record_id'),
  at: requiredText(row['at'], 'at'),
  channel: requiredText(row['channel'], 'channel') as ShareEvent['channel'],
  ...optional('deviceId', text(row['device_id'])),
  ...optional('actorId', text(row['actor_id'])),
})

export const shareEventColumns = (event: ShareEvent): Record<string, SqlValue> => ({
  id: event.id,
  company_id: event.companyId,
  action: event.action,
  entity: event.entity,
  record_id: event.recordId,
  at: event.at,
  device_id: event.deviceId ?? null,
  actor_id: event.actorId ?? null,
  channel: event.channel,
})

/* ----------------------------------------------------------------- assets */

export const toAsset = (row: SqlRow): AssetRecord => ({
  id: requiredText(row['id'], 'id'),
  companyId: requiredText(row['company_id'], 'company_id'),
  kind: requiredText(row['kind'], 'kind') as AssetRecord['kind'],
  dataUrl: requiredText(row['data_url'], 'data_url'),
  createdAt: requiredText(row['created_at'], 'created_at'),
})

export const assetColumns = (asset: AssetRecord): Record<string, SqlValue> => ({
  id: asset.id,
  company_id: asset.companyId,
  kind: asset.kind,
  data_url: asset.dataUrl,
  created_at: asset.createdAt,
})

/* ------------------------------------------------------------ link tokens */

export const toLinkToken = (row: SqlRow): LinkTokenRecord => ({
  documentId: requiredText(row['document_id'], 'document_id'),
  companyId: requiredText(row['company_id'], 'company_id'),
  tokenHash: requiredText(row['token_hash'], 'token_hash'),
  expiresAt: requiredText(row['expires_at'], 'expires_at'),
  ...optional('consumedAt', text(row['consumed_at'])),
})

export const linkTokenColumns = (token: LinkTokenRecord): Record<string, SqlValue> => ({
  document_id: token.documentId,
  company_id: token.companyId,
  token_hash: token.tokenHash,
  expires_at: token.expiresAt,
  consumed_at: token.consumedAt ?? null,
})

/* ------------------------------------------------------------------ write */

/**
 * Insert-or-update from a column map.
 *
 * **Not `insert or replace`**, and the difference is Rule #5. `OR REPLACE`
 * implements itself as DELETE-then-INSERT, so it fires DELETE and INSERT
 * triggers and never the UPDATE ones — the three triggers in `schema.ts` that
 * freeze an issued reference, freeze the labels and seal delivery evidence
 * would all have been stepped straight over by the one statement every write
 * in this layer goes through. `ON CONFLICT ... DO UPDATE` is a real update: the
 * triggers fire, and the floor under Rule #5 holds against this file too.
 *
 * It also preserves the row: `OR REPLACE` resets any column the map omits back
 * to its default, which for a partial write is data loss disguised as a save.
 *
 * Built here rather than at each call site so that no repository ever
 * concatenates a value into SQL. Only the KEYS of the map reach the statement
 * text, and they are literals from the functions above — never anything a
 * person typed.
 */
export function upsert(
  table: string,
  columns: Record<string, SqlValue>,
  key = 'id',
): { sql: string; params: SqlValue[] } {
  const names = Object.keys(columns)
  const assignments = names
    .filter((name) => name !== key)
    .map((name) => `${name} = excluded.${name}`)

  return {
    sql:
      `insert into ${table} (${names.join(', ')}) ` +
      `values (${names.map(() => '?').join(', ')}) ` +
      `on conflict(${key}) do update set ${assignments.join(', ')}`,
    params: names.map((name) => columns[name] as SqlValue),
  }
}
