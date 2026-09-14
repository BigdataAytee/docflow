/**
 * Documents, on SQLite (§E, Rule #5, §Q Phase 4).
 *
 * Its own file because it carries the rules the other ten repositories do not:
 * a draft may be edited and an issued document may not, issue freezes the
 * reference and the labels together, and delivery evidence is written once and
 * sealed. Those rules are NOT restated here — `src/domain/documents/lifecycle`
 * owns them and is called, exactly as the in-memory store calls it, so the
 * demo, the phone and the server cannot disagree about whether a quotation can
 * become a waybill.
 *
 * Underneath, `schema.ts` has triggers that refuse the same edits at the
 * database. Belt and braces on purpose: this layer protects the app's own
 * writes, and the triggers protect against every other writer — a sync
 * applying a server row, a repair script, a migration (§M: "Sync must never
 * rewrite them").
 */

import {
  type DocumentRecord,
  type DocumentRepository,
  type MutationContext,
  RepositoryError,
} from '../repositories/types'
import { assertTransition, isDraft, isEvidenceSealed } from '../../domain/documents/lifecycle'
import type { SqlDriver, SqlTransaction } from './driver'
import { type MutationDeps, mutate, readBackBy } from './mutation'
import { documentColumns, toDocument, upsert } from './rows'

const readBack = readBackBy('documents', toDocument)

/** Inside the transaction — the row as it is right now, not as it was read. */
const require_ = async (tx: SqlTransaction, id: string): Promise<DocumentRecord> => {
  const row = await readBack(tx, id)
  if (row === null) throw new RepositoryError(`No document ${id}.`)
  return row
}

const write = async (tx: SqlTransaction, document: DocumentRecord): Promise<DocumentRecord> => {
  const { sql, params } = upsert('documents', documentColumns(document))
  await tx.run(sql, params)
  return document
}

export function createDocumentRepository(
  driver: SqlDriver,
  deps: MutationDeps,
): DocumentRepository {
  const scoped = async (companyId: string, where: string, params: readonly string[]) => {
    const rows = await driver.all(
      `select * from documents where company_id = ? ${where} order by rowid asc`,
      [companyId, ...params],
    )
    return rows.map(toDocument)
  }

  const change = (
    id: string,
    ctx: MutationContext,
    kind: 'update',
    apply: (current: DocumentRecord) => DocumentRecord,
  ) =>
    mutate<DocumentRecord>(
      { ...deps, driver },
      ctx,
      {
        entity: 'document',
        kind,
        write: async (tx) => write(tx, apply(await require_(tx, id))),
        recordId: (record) => record.id,
      },
      readBack,
    )

  return {
    async listByType(companyId, type) {
      return scoped(companyId, 'and type = ?', [type])
    },

    async get(companyId, id) {
      const row = await driver.get('select * from documents where company_id = ? and id = ?', [
        companyId,
        id,
      ])
      return row === null ? null : toDocument(row)
    },

    /**
     * Matches the internal type, the current label and the FROZEN label (§D.3).
     *
     * The frozen label is why this is a LIKE over `frozen_labels` rather than a
     * lookup by type: a document issued as a Waybill stays findable by
     * "waybill" after the company moves to a region that calls it a Delivery
     * Note. Searching only by today's terminology would hide the owner's own
     * history from them the moment they switched region.
     */
    async search(companyId, query) {
      const q = query.trim().toLocaleLowerCase()
      if (q === '') return scoped(companyId, '', [])
      const like = `%${q}%`
      return scoped(
        companyId,
        `and (lower(type) like ?
              or lower(coalesce(issued_reference, '')) like ?
              or lower(coalesce(frozen_labels, '')) like ?)`,
        [like, like, like],
      )
    },

    async createDraft(draft, ctx) {
      return mutate<DocumentRecord>(
        { ...deps, driver },
        ctx,
        {
          entity: 'document',
          kind: 'create',
          write: async (tx) =>
            write(tx, {
              ...draft,
              id: deps.newId('doc'),
              issuedReference: null,
              frozenLabels: null,
            }),
          recordId: (record) => record.id,
          // A document names a customer. §M: "Parents and assets resolve
          // before dependents become externally visible."
          ...(draft.customerId === undefined ? {} : { dependsOn: [draft.customerId] }),
        },
        readBack,
      )
    },

    async updateDraft(id, patch, ctx) {
      return change(id, ctx, 'update', (current) => {
        if (!isDraft(current.status)) {
          throw new RepositoryError(
            `${current.type} ${id} is issued and immutable — correct it by void, credit note or reissue (v6 §C).`,
          )
        }
        return {
          ...current,
          ...patch,
          // Three fields a patch can never move, whatever it says.
          id: current.id,
          issuedReference: current.issuedReference,
          frozenLabels: current.frozenLabels,
        }
      })
    },

    async issue(id, issued, ctx) {
      return change(id, ctx, 'update', (current) => {
        assertTransition(current.type, current.status, 'issued')
        // Reference, labels and total land in one write. §M freezes them
        // "at issue" — together, or the document exists in a state where its
        // number is fixed and its words are not.
        return {
          ...current,
          status: 'issued',
          issuedReference: issued.reference,
          frozenLabels: issued.frozenLabels,
          totalMinor: issued.totalMinor,
        }
      })
    },

    async transition(id, to, ctx) {
      return change(id, ctx, 'update', (current) => {
        assertTransition(current.type, current.status, to)
        return { ...current, status: to }
      })
    },

    async attachDeliveryPhoto(id, assetId, ctx) {
      return change(id, ctx, 'update', (current) => {
        if (isEvidenceSealed(current.type, current.status)) {
          throw new RepositoryError(
            `${current.type} ${id} is already signed for. Delivery evidence cannot be altered once captured (v6 §P).`,
          )
        }
        if (isDraft(current.status)) {
          throw new RepositoryError(
            `${current.type} ${id} has not been issued; there is nothing to be evidence of yet.`,
          )
        }
        return { ...current, deliveryPhotoAssetId: assetId }
      })
    },

    async signDelivery(id, evidence, ctx) {
      return change(id, ctx, 'update', (current) => {
        if (isEvidenceSealed(current.type, current.status)) {
          throw new RepositoryError(
            `${current.type} ${id} is already signed for. Delivery evidence cannot be altered once captured (v6 §P).`,
          )
        }
        // The lifecycle decides whether this document can reach delivered at
        // all — a draft cannot, and neither can a void one.
        assertTransition(current.type, current.status, 'delivered')
        // One write: the mark, the signer, the moment and the status land
        // together or not at all (§P: "atomic delivered + timestamp").
        return { ...current, ...evidence, status: 'delivered' }
      })
    },
  }
}
