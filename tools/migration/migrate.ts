/**
 * The legacy Base44 migration (§Q Phase 7).
 *
 * §Q: "run as a **parallel-run cutover, not a big bang**: both apps live
 * during beta; accounts migrate in batches with per-account reconciliation…
 * webdocflow.com points at the new app only after totals match; the legacy
 * backend stays readable — never writable — for a grace window."
 *
 * Everything about the shape of this file follows from "not a big bang":
 *
 *  · It converts ONE ACCOUNT at a time and returns a reconciliation. A batch
 *    is a loop over that, so a failure is one account's problem rather than
 *    everyone's.
 *  · It is PURE. It reads an exported account and returns records plus a
 *    report; it writes nothing. Writing is a separate step a person runs after
 *    reading the report, which is what "points at the new app only after
 *    totals match" requires — if this wrote as it went, the decision would
 *    already have been made.
 *  · It never touches the legacy backend at all, so "readable, never
 *    writable" is not a rule to remember.
 *
 * CLAUDE.md forbids importing anything from `legacy/` into `src/`. This is
 * neither: it lives in `tools/`, and it reads legacy *data* rather than legacy
 * *code* — the exported JSON, whose shape is pinned by the fixtures.
 */

import { freezeLabels } from '../../src/domain/locale/profile'
import type { FrozenLabels, DocumentType } from '../../src/domain/documents/types'
import { UnmappableStatus, mapStatus } from './status'
import { UnconvertibleAmount, checkTotal, toMinor } from './money'

/** Only the fields the migration reads. The legacy row has many more. */
export interface LegacyDocument {
  readonly id: string
  readonly type: string
  readonly number?: string
  readonly status: string
  readonly currency?: string
  readonly issue_date?: string
  readonly due_date?: string
  readonly customer_id?: string
  readonly customer_name?: string
  readonly total?: number
  readonly paid_amount?: number
  readonly balance_due?: number
  readonly items?: readonly {
    readonly description?: string
    readonly quantity?: number
    readonly unit_price?: number
    readonly amount?: number
  }[]
}

export interface LegacyAccount {
  readonly accountId: string
  readonly companyName: string
  readonly documents: readonly LegacyDocument[]
}

export interface MigratedDocument {
  readonly legacyId: string
  readonly type: DocumentType
  readonly status: string
  readonly currency: string
  readonly totalMinor: number
  readonly issuedReference: string | null
  readonly frozenLabels: FrozenLabels | null
  readonly issueDate?: string
  readonly dueDate?: string
  readonly customerName?: string
  readonly lineItems: readonly {
    description: string
    quantityMilli: number
    unitPriceMinor: number
    taxable: boolean
  }[]
  /** Carried across so a paid invoice does not arrive looking unpaid. */
  readonly paymentMinor: number
}

export interface Refusal {
  readonly legacyId: string
  readonly reason: string
}

export interface Disagreement {
  readonly legacyId: string
  readonly storedMinor: number
  readonly recomputedMinor: number
  readonly differenceMinor: number
}

export interface Reconciliation {
  readonly accountId: string
  /** §Q: "counts and totals reconciled to the naira." */
  readonly legacyCount: number
  readonly migratedCount: number
  readonly legacyTotalMinor: number
  readonly migratedTotalMinor: number
  readonly legacyPaidMinor: number
  readonly migratedPaidMinor: number
  /** Documents this migration will not guess about. */
  readonly refusals: readonly Refusal[]
  /** Legacy rows whose stored total disagrees with their own lines. */
  readonly disagreements: readonly Disagreement[]
  /**
   * The decision. True only when every document converted, every total
   * matches, and nothing was refused — which is what "points at the new app
   * only after totals match" means in one boolean.
   */
  readonly balanced: boolean
}

export interface MigrationResult {
  readonly documents: readonly MigratedDocument[]
  readonly reconciliation: Reconciliation
}

const TYPES: readonly string[] = ['invoice', 'quotation', 'receipt', 'waybill']

/**
 * One account, converted and reconciled. Writes nothing.
 *
 * §Q: "migrated documents assigned **EN-NG frozen labels matching what they
 * were issued with**." The legacy app was EN-NG only, so freezing anything
 * else would relabel history — a 2024 invoice would start printing as
 * whatever the company's region says today, and Rule #5 exists precisely to
 * stop that.
 */
export function migrateAccount(account: LegacyAccount, scale = 100): MigrationResult {
  const documents: MigratedDocument[] = []
  const refusals: Refusal[] = []
  const disagreements: Disagreement[] = []

  let legacyTotalMinor = 0
  let legacyPaidMinor = 0

  for (const row of account.documents) {
    try {
      if (!TYPES.includes(row.type)) {
        throw new Error(`unknown document type "${row.type}"`)
      }
      const type = row.type as DocumentType

      const storedTotal = toMinor(row.total, scale, 'total')
      const paid = toMinor(row.paid_amount, scale, 'paid_amount')
      legacyTotalMinor += storedTotal
      legacyPaidMinor += paid

      const mapped = mapStatus(type, row.status)

      const lineItems = (row.items ?? []).map((item, index) => ({
        description: item.description ?? '',
        // Legacy quantities are plain numbers; the new model is thousandths.
        quantityMilli: toMinor(item.quantity ?? 1, 1000, `items[${index}].quantity`),
        unitPriceMinor: toMinor(item.unit_price, scale, `items[${index}].unit_price`),
        taxable: true,
      }))

      // Recomputed from the lines, because the new model never stores a total
      // as truth (Rule #3). Where it disagrees with the legacy row's own
      // stored total, that is REPORTED and the legacy figure is kept for the
      // reconciliation — a migration that corrected somebody's invoice while
      // copying it would be changing history, not moving it.
      const recomputed = lineItems.reduce(
        (sum, item) => sum + Math.round((item.quantityMilli * item.unitPriceMinor) / 1000),
        0,
      )
      const check = checkTotal(storedTotal, recomputed)
      if (!check.agrees) {
        disagreements.push({
          legacyId: row.id,
          storedMinor: check.storedMinor,
          recomputedMinor: check.recomputedMinor,
          differenceMinor: check.differenceMinor,
        })
      }

      const issued = mapped.status !== 'draft'
      documents.push({
        legacyId: row.id,
        type,
        status: mapped.status,
        currency: row.currency ?? 'NGN',
        totalMinor: storedTotal,
        issuedReference: issued ? (row.number ?? null) : null,
        // EN-NG, matching what they were issued with (§Q, Rule #5).
        frozenLabels: issued ? freezeLabels({ locale: 'EN-NG' }, type) : null,
        ...(row.issue_date === undefined ? {} : { issueDate: row.issue_date }),
        ...(row.due_date === undefined ? {} : { dueDate: row.due_date }),
        ...(row.customer_name === undefined ? {} : { customerName: row.customer_name }),
        lineItems,
        // The payment that made a legacy "paid" true. Dropping it is the
        // silent failure this migration is most able to cause.
        paymentMinor: mapped.impliesPayment ? paid : 0,
      })
    } catch (cause) {
      const reason =
        cause instanceof UnmappableStatus || cause instanceof UnconvertibleAmount
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : String(cause)
      refusals.push({ legacyId: row.id, reason })
    }
  }

  const migratedTotalMinor = documents.reduce((sum, d) => sum + d.totalMinor, 0)
  const migratedPaidMinor = documents.reduce((sum, d) => sum + d.paymentMinor, 0)

  return {
    documents,
    reconciliation: {
      accountId: account.accountId,
      legacyCount: account.documents.length,
      migratedCount: documents.length,
      legacyTotalMinor,
      migratedTotalMinor,
      legacyPaidMinor,
      // Only the documents whose legacy status said money had moved carry a
      // payment, so this is compared against that subset rather than against
      // every `paid_amount` in the export.
      migratedPaidMinor,
      refusals,
      disagreements,
      balanced:
        refusals.length === 0 &&
        documents.length === account.documents.length &&
        migratedTotalMinor === legacyTotalMinor,
    },
  }
}

/** A batch is a loop, so one account's failure is one account's problem. */
export function migrateBatch(accounts: readonly LegacyAccount[]): MigrationResult[] {
  return accounts.map((account) => migrateAccount(account))
}

/** The report a person reads before pointing the domain at the new app. */
export function reportOf(reconciliation: Reconciliation): string {
  const naira = (minor: number) => (minor / 100).toFixed(2)
  const lines = [
    `account ${reconciliation.accountId}`,
    `  documents: ${reconciliation.migratedCount} of ${reconciliation.legacyCount}`,
    `  total:     ${naira(reconciliation.migratedTotalMinor)} of ${naira(reconciliation.legacyTotalMinor)}`,
    `  payments:  ${naira(reconciliation.migratedPaidMinor)} carried across`,
  ]
  for (const refusal of reconciliation.refusals) {
    lines.push(`  REFUSED ${refusal.legacyId}: ${refusal.reason}`)
  }
  for (const disagreement of reconciliation.disagreements) {
    lines.push(
      `  DISAGREES ${disagreement.legacyId}: stored ${naira(disagreement.storedMinor)}, lines make ${naira(disagreement.recomputedMinor)}`,
    )
  }
  lines.push(reconciliation.balanced ? '  BALANCED' : '  NOT BALANCED — do not cut over')
  return lines.join('\n')
}
