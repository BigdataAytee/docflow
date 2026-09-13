/**
 * Full user data export (§Q Phase 7, Rule #6).
 *
 * Rule #6: "a lapsed or cancelled subscription never blocks viewing, sharing
 * or exporting anything the user already created, and **full data export stays
 * free forever**." Settings has said so on screen since Phase 2 — and the
 * button under that sentence was wired to nothing. `onExport` was optional and
 * no caller passed it, so the one control that makes Rule #6 true did nothing
 * at all.
 *
 * Two rules shape what comes out.
 *
 * **It is complete, or it says it is not.** A short archive that looks whole
 * is the worst possible outcome here: the owner keeps it, deletes the app, and
 * finds out eighteen months later. So every repository read is accounted for,
 * and `complete` is false the moment one of them fails — the same shape as the
 * migration's `balanced`, and for the same reason.
 *
 * **It is readable without DocFlow.** JSON, one file, with the money in the
 * integer minor units it is stored in (Rule #3) and the frozen labels an
 * issued document was issued under (Rule #5). Somebody opening this in ten
 * years should not need this app, or any app, to understand what they have.
 */

import type {
  AssetRecord,
  Company,
  CreditNoteRecord,
  Customer,
  DocumentRecord,
  Expense,
  Payment,
  Repositories,
  SavedItem,
  ShareEvent,
} from '../../data/repositories/types'
import { DOCUMENT_TYPES } from '../../domain/documents/types'

/** Bumped when the SHAPE changes, so a reader knows what it is holding. */
export const ARCHIVE_VERSION = 1

export interface ArchiveMeta {
  readonly archiveVersion: number
  readonly exportedAt: string
  readonly companyId: string
  /** Plain sentences, in the archive, about what it is and is not. */
  readonly notes: readonly string[]
  readonly counts: Readonly<Record<string, number>>
}

export interface Archive {
  readonly meta: ArchiveMeta
  readonly company: Company | null
  readonly customers: readonly Customer[]
  readonly documents: readonly DocumentRecord[]
  readonly payments: readonly Payment[]
  readonly items: readonly SavedItem[]
  readonly expenses: readonly Expense[]
  readonly shares: readonly ShareEvent[]
  readonly credits: readonly CreditNoteRecord[]
  readonly assets: readonly AssetRecord[]
}

export interface ExportResult {
  readonly archive: Archive
  /** Every part that could not be read, by name. */
  readonly failed: readonly { part: string; reason: string }[]
  /**
   * True only when every part was read. Never "mostly": an owner deciding
   * whether it is safe to delete the app needs one answer, not a judgement.
   */
  readonly complete: boolean
}

/**
 * Why the link tokens are NOT in here.
 *
 * They are stored as hashes and never as the token itself (§P), so exporting
 * them would hand over something that opens nothing and still reads like a
 * credential. They are also not the owner's data in any sense they would
 * recognise — a link they sent is represented by the document it points at.
 * Said in the archive rather than only here, because an owner should not have
 * to guess what an export left out.
 */
const NOTES = [
  'Money is in the currency’s smallest unit as an integer — 150000 in NGN is ₦1,500.00.',
  'An issued document carries the labels and language it was issued under (frozenLabels); those never change, even if the business later switches region.',
  'Images (signatures, delivery photos, expense photos) are inline data: URLs, so this file needs nothing else to be complete.',
  'Public-link tokens are not included: only their hashes are ever stored, so they would open nothing.',
  'This export is free, on every plan, forever.',
]

async function attempt<T>(
  part: string,
  read: () => Promise<T>,
  fallback: T,
  failed: { part: string; reason: string }[],
): Promise<T> {
  try {
    return await read()
  } catch (cause) {
    failed.push({ part, reason: cause instanceof Error ? cause.message : String(cause) })
    return fallback
  }
}

/**
 * Everything this company has, read through the repository ports.
 *
 * Through the ports, so one implementation serves memory, SQLite and Supabase
 * alike (§C) — and so the export cannot drift from what the app itself can
 * see. An export that read the database directly would eventually export a
 * different set of rows than the app shows, and nobody would notice which was
 * right.
 */
export async function exportArchive(
  repositories: Repositories,
  companyId: string,
  now: () => Date = () => new Date(),
): Promise<ExportResult> {
  const failed: { part: string; reason: string }[] = []

  const company = await attempt('company', () => repositories.companies.get(companyId), null, failed)
  const customers = await attempt('customers', () => repositories.customers.list(companyId), [], failed)

  // Per type, because that is the only listing the port offers — and doing it
  // this way means a type added later cannot be silently left out: the loop
  // reads the same list of types the rest of the app switches on.
  const documents: DocumentRecord[] = []
  for (const type of DOCUMENT_TYPES) {
    documents.push(
      ...(await attempt(
        `documents:${type}`,
        () => repositories.documents.listByType(companyId, type),
        [],
        failed,
      )),
    )
  }

  const payments = await attempt(
    'payments',
    () => repositories.payments.listForCompany(companyId),
    [],
    failed,
  )
  const items = await attempt('items', () => repositories.items.list(companyId), [], failed)
  const expenses = await attempt('expenses', () => repositories.expenses.list(companyId), [], failed)
  const shares = await attempt('shares', () => repositories.shares.list(companyId), [], failed)
  const credits = await attempt('credits', () => repositories.credits.list(companyId), [], failed)
  const assets = await attempt('assets', () => repositories.assets.list(companyId), [], failed)

  const archive: Archive = {
    meta: {
      archiveVersion: ARCHIVE_VERSION,
      exportedAt: now().toISOString(),
      companyId,
      notes: NOTES,
      counts: {
        customers: customers.length,
        documents: documents.length,
        payments: payments.length,
        items: items.length,
        expenses: expenses.length,
        shares: shares.length,
        credits: credits.length,
        assets: assets.length,
      },
    },
    company,
    customers,
    documents,
    payments,
    items,
    expenses,
    shares,
    credits,
    assets,
  }

  return { archive, failed, complete: failed.length === 0 }
}

/** The file an owner keeps. Pretty-printed, because it is meant to be read. */
export const archiveJson = (archive: Archive): string => JSON.stringify(archive, null, 2)

export const archiveFilename = (archive: Archive): string =>
  `docflow-export-${archive.meta.exportedAt.slice(0, 10)}.json`
