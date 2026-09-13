/**
 * Making a mutation happen exactly once, against a database (§M).
 *
 * The in-memory store keeps a `Map` of idempotency keys, which is honest for
 * what it is and useless here: the retry §M exists for arrives after the
 * process that made the first attempt is gone — that is what an outbox IS.
 * Whatever remembered "already sent" died with it.
 *
 * So the key is written ON THE ROW, under a unique index per company
 * (`0009_idempotency.sql`), and these two helpers are the only places that
 * read it. The guarantee is then the database's: two devices replaying one
 * outbox entry converge on one record because an index says they must, not
 * because both happened to check first.
 *
 * There is one honest limit, stated here rather than discovered later: a row
 * remembers only the key of the mutation that most recently touched it. A
 * replay of an OLDER mutation against a row that has since moved on is not
 * recognised as a replay — it is treated as a new mutation and meets the
 * lifecycle guard, which is the correct outcome anyway (issuing an already
 * issued document is refused by `assertTransition`, not silently repeated).
 * What matters for the outbox is the head of the queue, and that is exactly
 * what the last key covers.
 */

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { type MutationContext, RepositoryError } from '../repositories'
import type { Row } from './rows'

/** Never let a PostgREST failure surface as a silent null (§M). */
export function orThrow<T>(
  what: string,
  result: { data: T | null; error: PostgrestError | null },
): T {
  if (result.error !== null) {
    throw new RepositoryError(`${what}: ${result.error.message}`)
  }
  if (result.data === null) {
    throw new RepositoryError(`${what}: the row was not returned.`)
  }
  return result.data
}

/**
 * Insert once, then read back what is there — whoever wrote it.
 *
 * `ignoreDuplicates` makes the insert a no-op when this company has already
 * used this key, so the read that follows returns the winner's row for the
 * loser too. No transaction is involved and none is needed: the unique index
 * decides the race in one statement, and a crash between the two calls leaves
 * the record written and the next attempt reading it back.
 */
export async function insertOnce(
  db: SupabaseClient,
  table: string,
  companyId: string,
  ctx: MutationContext,
  row: Row,
): Promise<Row> {
  const payload = { ...row, company_id: companyId, idempotency_key: ctx.idempotencyKey }

  const written = await db
    .from(table)
    .upsert(payload, { onConflict: 'company_id,idempotency_key', ignoreDuplicates: true })
    .select()
    .maybeSingle()
  if (written.error !== null) {
    throw new RepositoryError(`Could not write to ${table}: ${written.error.message}`)
  }
  // A row came back: this attempt is the one that wrote it.
  if (written.data !== null) return written.data as Row

  // No row: the key was already used, so the record exists. Read it back
  // rather than reporting a failure — the caller's intent is satisfied.
  return orThrow(
    `A ${table} row was written under ${ctx.idempotencyKey} but could not be read back`,
    await db
      .from(table)
      .select('*')
      .eq('company_id', companyId)
      .eq('idempotency_key', ctx.idempotencyKey)
      .maybeSingle(),
  )
}

/**
 * The row as it is now, and whether this mutation has already been applied to
 * it. Callers use the flag to return early — before the lifecycle guard, so a
 * replayed issue returns the issued document instead of being refused for
 * issuing twice.
 */
export interface Current {
  readonly row: Row
  readonly alreadyApplied: boolean
}

export async function currentRow(
  db: SupabaseClient,
  table: string,
  id: string,
  ctx: MutationContext,
): Promise<Current> {
  // No company filter: RLS scopes this, and adding a second place for the
  // boundary to be enforced adds a second place for it to be wrong (§P).
  const found = await db.from(table).select('*').eq('id', id).maybeSingle()
  if (found.error !== null) {
    throw new RepositoryError(`Could not read ${table} ${id}: ${found.error.message}`)
  }
  if (found.data === null) throw new RepositoryError(`No ${table} row ${id}.`)
  const row = found.data as Row
  return { row, alreadyApplied: row['idempotency_key'] === ctx.idempotencyKey }
}

/**
 * Apply a patch to a row that has not moved since it was read.
 *
 * Conditioned on the status observed, so two devices editing the same document
 * cannot interleave into a state neither asked for: the second finds no row to
 * update and is told, rather than overwriting a transition it never saw. That
 * is stricter than the in-memory store, which cannot have concurrent writers.
 */
export async function updateUnchanged(
  db: SupabaseClient,
  table: string,
  current: Row,
  patch: Row,
  ctx: MutationContext,
): Promise<Row> {
  const updated = await db
    .from(table)
    .update({ ...patch, idempotency_key: ctx.idempotencyKey })
    .eq('id', current['id'] as string)
    .eq('status', current['status'] as string)
    .select()
    .maybeSingle()
  if (updated.error !== null) {
    throw new RepositoryError(`Could not update ${table}: ${updated.error.message}`)
  }
  if (updated.data === null) {
    throw new RepositoryError(
      `${table} ${String(current['id'])} changed while this edit was being made. Reopen it and try again.`,
    )
  }
  return updated.data as Row
}
