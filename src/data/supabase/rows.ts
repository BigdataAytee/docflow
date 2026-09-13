/**
 * Database rows ↔ the repository contracts (§C, §E).
 *
 * Every repository implementation over Supabase is two things: a query, and a
 * translation. The queries are thin; the translation is where the bugs live,
 * and all of them are quiet:
 *
 *  · **snake_case both ways.** A column read under the wrong name is
 *    `undefined`, not an error, so a mistyped mapping shows up as a missing
 *    customer rather than a crash.
 *  · **Optional is not null.** The app is built with
 *    `exactOptionalPropertyTypes`, so `{ phone: undefined }` and `{}` are
 *    different types — and Postgres only has the first. `omitNull` is how the
 *    two meet, and using it is not a style choice: a customer with
 *    `phone: undefined` on the record prints a blank line on a PDF (§I).
 *  · **Money is minor units, on both sides.** `bigint` columns come back from
 *    `pg` as strings and from PostgREST as numbers, so every amount goes
 *    through `Number(...)` on the way in and never through a float on the way
 *    out (Rule #3).
 *  · **`null` sometimes MEANS something.** `default_signature_asset_id` null
 *    is "the owner removed it", which a patch must be able to express (§M).
 *    Absent and null are kept apart there on purpose.
 *
 * These are pure functions with no client, so they are unit-tested here AND
 * round-tripped through a real Postgres in `supabase/tests/rows.test.ts` —
 * which is what proves the column names exist, rather than assuming.
 */

import type {
  AssetRecord,
  Company,
  Customer,
  DocumentRecord,
  Expense,
  LinkTokenRecord,
  SavedItem,
} from '../repositories'
import type { DocumentType, FrozenLabels, LineItem } from '../../domain/documents/types'
import { money } from '../../domain/money/money'

/** A row as the driver hands it over. Deliberately loose: this is the seam. */
export type Row = Record<string, unknown>

/**
 * Drops keys whose value is null or undefined.
 *
 * The one function that makes `exactOptionalPropertyTypes` and SQL agree:
 * Postgres says "no value" with null, the domain says it by having no key,
 * and a record carrying `phone: undefined` is not the same as one without a
 * phone — it prints a blank line (§I) and fails an equality check.
 */
export type Present<T> = { [K in keyof T]?: Exclude<T[K], null | undefined> }

export function omitNull<T extends Record<string, unknown>>(source: T): Present<T> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== null && value !== undefined) out[key] = value
  }
  // `Present<T>` rather than `Partial<T>`: under `exactOptionalPropertyTypes`
  // a `Partial` still admits an explicit `undefined`, which is the very thing
  // this function exists to remove. The type has to say what it did.
  return out as Present<T>
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

/** `bigint` arrives as a string from `pg` and a number from PostgREST. */
const minor = (value: unknown): number => {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0
  return Number.isFinite(n) ? n : 0
}

const bool = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined

/** A `date` column comes back as a Date from `pg` and a string from PostgREST. */
const day = (value: unknown): string | undefined => {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return text(value)
}

const stamp = (value: unknown): string | undefined => {
  if (value instanceof Date) return value.toISOString()
  return text(value)
}

const json = <T,>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

// ---------------------------------------------------------------- companies

export function toCompany(row: Row): Company {
  const tax = json<{ taxRatePpm?: number; whtRatePpm?: number }>(row['tax_defaults'], {})
  return {
    id: String(row['id']),
    name: String(row['name'] ?? ''),
    localeRegion: String(row['locale_region'] ?? 'NG'),
    localeLanguage: String(row['locale_language'] ?? 'en'),
    labelOverrides: json(row['label_overrides'], {}),
    currency: String(row['currency'] ?? 'NGN'),
    numberingPrefixes: json(row['numbering_prefixes'], {}),
    bankFields: json(row['bank_fields'], {}),
    enabledPaymentMethods: json<string[]>(row['enabled_payment_methods'], []),
    ...omitNull({
      brandColour: text(row['brand_colour']),
      nameStyle: text(row['name_style']) as Company['nameStyle'],
      logoSize: text(row['logo_size']) as Company['logoSize'],
      logoAssetId: text(row['logo_asset_id']),
      taxRatePpm: tax.taxRatePpm,
      whtRatePpm: tax.whtRatePpm,
      signatureRequired: bool(row['signature_required']),
    }),
    // NOT through omitNull: null here means "the owner removed it", which a
    // patch has to be able to say (§M).
    ...(row['default_signature_asset_id'] === undefined
      ? {}
      : { defaultSignatureAssetId: (row['default_signature_asset_id'] as string | null) ?? null }),
  }
}

export function fromCompany(patch: Partial<Company>): Row {
  const row: Row = {
    ...omitNull({
      name: patch.name,
      locale_region: patch.localeRegion,
      locale_language: patch.localeLanguage,
      label_overrides: patch.labelOverrides,
      currency: patch.currency,
      numbering_prefixes: patch.numberingPrefixes,
      bank_fields: patch.bankFields,
      enabled_payment_methods: patch.enabledPaymentMethods,
      brand_colour: patch.brandColour,
      name_style: patch.nameStyle,
      logo_size: patch.logoSize,
      logo_asset_id: patch.logoAssetId,
      signature_required: patch.signatureRequired,
    }),
  }
  // The rates live together in one jsonb column (§E `tax_defaults`), as parts
  // per million so 7.5% is an integer (§K).
  if (patch.taxRatePpm !== undefined || patch.whtRatePpm !== undefined) {
    row['tax_defaults'] = omitNull({
      taxRatePpm: patch.taxRatePpm,
      whtRatePpm: patch.whtRatePpm,
    })
  }
  // An explicit null clears it; an absent key leaves it alone.
  if (patch.defaultSignatureAssetId !== undefined) {
    row['default_signature_asset_id'] = patch.defaultSignatureAssetId
  }
  return row
}

// ---------------------------------------------------------------- customers

export function toCustomer(row: Row): Customer {
  return {
    id: String(row['id']),
    companyId: String(row['company_id']),
    kind: (text(row['kind']) as Customer['kind']) ?? 'person',
    name: String(row['name'] ?? ''),
    labels: json<string[]>(row['labels'], []),
    ...omitNull({
      phone: text(row['phone']),
      email: text(row['email']),
      address: text(row['address']),
      privateNote: text(row['private_note']),
    }),
  }
}

export function fromCustomer(patch: Partial<Customer>): Row {
  return omitNull({
    company_id: patch.companyId,
    kind: patch.kind,
    name: patch.name,
    phone: patch.phone,
    email: patch.email,
    address: patch.address,
    labels: patch.labels,
    private_note: patch.privateNote,
  })
}

// ---------------------------------------------------------------- documents

export function toDocument(row: Row): DocumentRecord {
  return {
    id: String(row['id']),
    companyId: String(row['company_id']),
    type: String(row['type']) as DocumentType,
    status: String(row['status'] ?? 'draft'),
    currency: String(row['currency'] ?? 'NGN'),
    lineItems: json<LineItem[]>(row['line_items'], []),
    totalMinor: minor(row['total_minor']),
    // Both stay NULL rather than absent: §M freezes them at issue, and a
    // draft's null is the thing that says it has not been issued.
    issuedReference: (text(row['issued_reference']) ?? null) as string | null,
    frozenLabels: (json<FrozenLabels | null>(row['frozen_labels'], null) ?? null),
    ...omitNull({
      customerId: text(row['customer_id']),
      issueDate: day(row['issue_date']),
      dueDate: day(row['due_date']),
      validUntil: day(row['valid_until']),
      convertedFromId: text(row['converted_from_id']),
      paymentId: text(row['payment_id']),
      linkedInvoiceId: text(row['related_invoice_id']),
      supersedesId: text(row['supersedes_id']),
      signatureAssetId: text(row['signature_asset_id']),
      deliveryAddress: text(row['delivery_address']),
      driverName: text(row['driver_name']),
      vehicleNumber: text(row['vehicle_number']),
      dispatchDate: day(row['dispatch_date']),
      signerName: text(row['signer_name']),
      signerRole: text(row['signer_role']),
      signedAt: stamp(row['signed_at']),
      deliveryPhotoAssetId: text(row['delivery_photo_asset_id']),
    }),
  }
}

export function fromDocument(patch: Partial<DocumentRecord>): Row {
  const row: Row = omitNull({
    company_id: patch.companyId,
    type: patch.type,
    status: patch.status,
    currency: patch.currency,
    line_items: patch.lineItems,
    total_minor: patch.totalMinor,
    customer_id: patch.customerId,
    issue_date: patch.issueDate,
    due_date: patch.dueDate,
    valid_until: patch.validUntil,
    converted_from_id: patch.convertedFromId,
    payment_id: patch.paymentId,
    related_invoice_id: patch.linkedInvoiceId,
    supersedes_id: patch.supersedesId,
    signature_asset_id: patch.signatureAssetId,
    delivery_address: patch.deliveryAddress,
    driver_name: patch.driverName,
    vehicle_number: patch.vehicleNumber,
    dispatch_date: patch.dispatchDate,
    signer_name: patch.signerName,
    signer_role: patch.signerRole,
    signed_at: patch.signedAt,
    delivery_photo_asset_id: patch.deliveryPhotoAssetId,
  })
  // These two are nullable on purpose: a draft HAS no reference, and writing
  // null is how it is created (§M).
  if (patch.issuedReference !== undefined) row['issued_reference'] = patch.issuedReference
  if (patch.frozenLabels !== undefined) row['frozen_labels'] = patch.frozenLabels
  return row
}

// -------------------------------------------------------------------- items

export function toItem(row: Row): SavedItem {
  const price = row['last_price_minor']
  const currency = text(row['currency'])
  return {
    id: String(row['id']),
    companyId: String(row['company_id']),
    name: String(row['name'] ?? ''),
    timesUsed: minor(row['times_used']),
    ...omitNull({
      unit: text(row['unit']),
      lastPrice:
        price === null || price === undefined || currency === undefined
          ? undefined
          : money(currency, minor(price)),
    }),
  }
}

export function fromItem(patch: Partial<SavedItem>): Row {
  return omitNull({
    company_id: patch.companyId,
    name: patch.name,
    unit: patch.unit,
    times_used: patch.timesUsed,
    last_price_minor: patch.lastPrice?.minor,
    currency: patch.lastPrice?.currency,
  })
}

// ----------------------------------------------------------------- expenses

export function toExpense(row: Row): Expense {
  return {
    id: String(row['id']),
    companyId: String(row['company_id']),
    description: String(row['description'] ?? ''),
    amount: money(String(row['currency'] ?? 'NGN'), minor(row['amount_minor'])),
    spentOn: day(row['spent_on']) ?? '',
    ...omitNull({
      category: text(row['category']),
      photoAssetId: text(row['photo_asset_id']),
    }),
  }
}

export function fromExpense(patch: Partial<Expense>): Row {
  return omitNull({
    company_id: patch.companyId,
    description: patch.description,
    category: patch.category,
    currency: patch.amount?.currency,
    amount_minor: patch.amount?.minor,
    spent_on: patch.spentOn,
    photo_asset_id: patch.photoAssetId,
  })
}

// ------------------------------------------------------------------- assets

export function toAsset(row: Row): AssetRecord {
  return {
    id: String(row['id']),
    companyId: String(row['company_id']),
    kind: String(row['kind'] ?? 'signature') as AssetRecord['kind'],
    dataUrl: String(row['data_url'] ?? ''),
    createdAt: stamp(row['created_at']) ?? '',
  }
}

export function fromAsset(patch: Partial<AssetRecord>): Row {
  return omitNull({
    company_id: patch.companyId,
    kind: patch.kind,
    data_url: patch.dataUrl,
    created_at: patch.createdAt,
  })
}

// -------------------------------------------------------------- link tokens

export function toLinkToken(row: Row): LinkTokenRecord {
  return {
    documentId: String(row['document_id']),
    companyId: String(row['company_id']),
    tokenHash: String(row['token_hash'] ?? ''),
    expiresAt: stamp(row['expires_at']) ?? '',
    ...omitNull({ consumedAt: stamp(row['consumed_at']) }),
  }
}

export function fromLinkToken(patch: Partial<LinkTokenRecord>): Row {
  return omitNull({
    document_id: patch.documentId,
    company_id: patch.companyId,
    token_hash: patch.tokenHash,
    expires_at: patch.expiresAt,
    consumed_at: patch.consumedAt,
  })
}
