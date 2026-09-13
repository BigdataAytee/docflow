/**
 * The documents repository over Supabase (§C, §G, §P).
 *
 * Separate from the other two because it is the only one with rules beyond
 * storage, and they are the rules Rule #5 rests on: an issued document is
 * immutable, and delivery evidence seals.
 *
 * Every mutation follows the same three steps, in this order:
 *
 *   1. read the row and ask whether THIS mutation already landed on it;
 *   2. if it did, return it — BEFORE the lifecycle guard, so a replayed issue
 *      returns the issued document instead of being refused for issuing
 *      twice, which is what makes a retry safe rather than merely harmless;
 *   3. otherwise apply the guard, then write conditioned on the status just
 *      read, so a concurrent change is reported rather than overwritten.
 *
 * Step 2 is the one that is easy to get backwards. A guard placed first turns
 * every retry of a successful-but-unacknowledged write into an error the owner
 * cannot act on — the document IS issued, and the app would say it cannot be.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { type DocumentRepository, type DocumentType, RepositoryError } from '../repositories'
import { assertTransition, isDraft, isEvidenceSealed } from '../../domain/documents/lifecycle'
import { type Row, fromDocument, toDocument } from './rows'
import { currentRow, insertOnce, updateUnchanged } from './mutate'
import { anyColumnLike, searchable } from './search'

export function createDocumentRepository(db: SupabaseClient): DocumentRepository {
  /** The status and type a guard needs, read off a row. */
  const shapeOf = (row: Row) => ({
    id: String(row['id']),
    // The column is a CHECK-constrained enum in §E; the guards take the
    // domain union. The cast names that trust in one place rather than at
    // each of the five call sites.
    type: row['type'] as DocumentType,
    status: String(row['status']),
  })

  return {
    async listByType(companyId, type) {
      const { data, error } = await db
        .from('documents')
        .select('*')
        .eq('company_id', companyId)
        .eq('type', type)
        // Newest first, and by id within a day so the order is total — two
        // documents issued on one date must not swap places between reads.
        .order('issue_date', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
      if (error !== null) throw new RepositoryError(`Could not list ${type}s: ${error.message}`)
      return (data as Row[]).map(toDocument)
    },

    async get(_companyId, id) {
      const found = await db.from('documents').select('*').eq('id', id).maybeSingle()
      if (found.error !== null) {
        throw new RepositoryError(`Could not read document ${id}: ${found.error.message}`)
      }
      return found.data === null ? null : toDocument(found.data as Row)
    },

    async search(companyId, query) {
      const q = searchable(query)
      let request = db.from('documents').select('*').eq('company_id', companyId)
      if (q !== '') {
        // §D.3: the internal type, the reference, AND the label frozen at
        // issue. A quotation issued as "Proforma" must still be found by the
        // word printed on it, years after the company's terminology changed —
        // that is the whole point of freezing the label (Rule #5).
        request = request.or(
          anyColumnLike(['type', 'issued_reference', 'frozen_labels->>printedTitle'], q),
        )
      }
      const { data, error } = await request.order('id', { ascending: false })
      if (error !== null) throw new RepositoryError(`Could not search documents: ${error.message}`)
      return (data as Row[]).map(toDocument)
    },

    async createDraft(draft, ctx) {
      // `issued_reference` and `frozen_labels` are not sent: they are null
      // until issue and frozen after, and the contract's type already removes
      // them from what a caller may pass.
      return toDocument(
        await insertOnce(db, 'documents', draft.companyId, ctx, fromDocument(draft)),
      )
    },

    async updateDraft(id, patch, ctx) {
      const { row, alreadyApplied } = await currentRow(db, 'documents', id, ctx)
      if (alreadyApplied) return toDocument(row)

      const doc = shapeOf(row)
      if (!isDraft(doc.status)) {
        throw new RepositoryError(
          `${doc.type} ${id} is issued and immutable — correct it by void, credit note or reissue (v6 §C).`,
        )
      }
      // The frozen pair is stripped even though the type forbids it: a patch
      // arriving from sync is a plain object, and Rule #5 must not depend on
      // the caller having been typechecked.
      const { issued_reference: _r, frozen_labels: _l, ...safe } = fromDocument(patch)
      return toDocument(await updateUnchanged(db, 'documents', row, safe, ctx))
    },

    async attachDeliveryPhoto(id, assetId, ctx) {
      const { row, alreadyApplied } = await currentRow(db, 'documents', id, ctx)
      if (alreadyApplied) return toDocument(row)

      const doc = shapeOf(row)
      if (isEvidenceSealed(doc.type, doc.status)) {
        throw new RepositoryError(
          `${doc.type} ${id} is already signed for. Delivery evidence cannot be altered once captured (v6 §P).`,
        )
      }
      if (isDraft(doc.status)) {
        throw new RepositoryError(
          `${doc.type} ${id} has not been issued; there is nothing to be evidence of yet.`,
        )
      }
      return toDocument(
        await updateUnchanged(db, 'documents', row, { delivery_photo_asset_id: assetId }, ctx),
      )
    },

    async signDelivery(id, evidence, ctx) {
      const { row, alreadyApplied } = await currentRow(db, 'documents', id, ctx)
      if (alreadyApplied) return toDocument(row)

      const doc = shapeOf(row)
      if (isEvidenceSealed(doc.type, doc.status)) {
        throw new RepositoryError(
          `${doc.type} ${id} is already signed for. Delivery evidence cannot be altered once captured (v6 §P).`,
        )
      }
      assertTransition(doc.type, doc.status, 'delivered')

      // ONE write: the mark, the signer, the moment and the status land
      // together or not at all (§P). Two calls could leave a delivery marked
      // delivered with nobody's signature on it — a state nobody can correct,
      // because delivered is terminal and its evidence is sealed.
      return toDocument(
        await updateUnchanged(
          db,
          'documents',
          row,
          {
            ...fromDocument({
              signerName: evidence.signerName,
              signedAt: evidence.signedAt,
              signatureAssetId: evidence.signatureAssetId,
              ...(evidence.signerRole === undefined ? {} : { signerRole: evidence.signerRole }),
            }),
            status: 'delivered',
          },
          ctx,
        ),
      )
    },

    async issue(id, issued, ctx) {
      const { row, alreadyApplied } = await currentRow(db, 'documents', id, ctx)
      if (alreadyApplied) return toDocument(row)

      const doc = shapeOf(row)
      assertTransition(doc.type, doc.status, 'issued')

      // Reference, labels, total and status in one write, because they freeze
      // together (§M). A reference written without the labels beside it would
      // be a document whose printed title could still change under it.
      return toDocument(
        await updateUnchanged(
          db,
          'documents',
          row,
          {
            status: 'issued',
            issued_reference: issued.reference,
            frozen_labels: issued.frozenLabels,
            total_minor: issued.totalMinor,
          },
          ctx,
        ),
      )
    },

    async transition(id, to, ctx) {
      const { row, alreadyApplied } = await currentRow(db, 'documents', id, ctx)
      if (alreadyApplied) return toDocument(row)

      const doc = shapeOf(row)
      assertTransition(doc.type, doc.status, to)
      return toDocument(await updateUnchanged(db, 'documents', row, { status: to }, ctx))
    },
  }
}
