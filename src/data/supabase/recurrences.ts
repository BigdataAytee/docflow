/**
 * Monthly repeats over Supabase (§L4, §P).
 *
 * The device has had this since local schema 4; this is the half that was
 * held back until a Postgres existed to run `npm run test:rls` against. It
 * ships WITH `0021_recurrences.sql` and never separately: a table without its
 * client is a landmine, and a client without its table is a crash.
 *
 * IDEMPOTENT BY IDENTITY, not by a remembered key. Every other write here
 * carries an `idempotency_key` because two inserts of the same payment are
 * two different rows unless something says otherwise. A schedule cannot be
 * two rows: `source_document_id` is the primary key, so switching Repeat on
 * twice upserts the same row by arithmetic rather than by bookkeeping. That
 * is why this file has no `insertOnce` and needs none — and why the table has
 * no `idempotency_key` column to pair with one.
 *
 * The drafts a schedule produces are ordinary documents carrying a
 * `recurrence_key`, and THAT is where the interesting idempotency lives — a
 * partial unique index in the same migration, so a catch-up interrupted
 * halfway finds its own earlier drafts and creates only what is missing.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { type RecurrenceRepository, RepositoryError } from '../repositories'
import { type Row, fromRecurrence, toRecurrence } from './rows'

export function createRecurrenceRepository(db: SupabaseClient): RecurrenceRepository {
  return {
    async list(companyId) {
      const { data, error } = await db
        .from('recurrences')
        .select('*')
        .eq('company_id', companyId)
        .order('source_document_id', { ascending: true })

      if (error !== null) {
        throw new RepositoryError(`Could not list repeats: ${error.message}`)
      }
      return (data ?? []).map((row) => toRecurrence(row as Row))
    },

    async start(recurrence) {
      /*
       * An upsert on the primary key, because switching Repeat on for a
       * document that already has a schedule is the SAME schedule.
       *
       * `ended_on` is written as part of the row rather than left alone, and
       * that is the part worth stating: re-starting a STOPPED schedule has to
       * clear the end date, or the row would say it ended while the toggle
       * said it was on. `fromRecurrence` drops undefined keys, so this passes
       * an explicit null when the record carries no end.
       */
      const { data, error } = await db
        .from('recurrences')
        .upsert(
          { ...fromRecurrence(recurrence), ended_on: recurrence.endedOn ?? null },
          { onConflict: 'source_document_id' },
        )
        .select()
        .maybeSingle()

      if (error !== null) {
        throw new RepositoryError(`Could not switch Repeat on: ${error.message}`)
      }
      if (data === null) {
        // RLS denied it, or the trigger refused a document belonging to
        // somebody else. Either way nothing was written, and saying "saved"
        // over a row that does not exist is the one outcome to avoid.
        throw new RepositoryError('The repeat was not saved. Nothing has been changed.')
      }
      return toRecurrence(data as Row)
    },

    async stop(companyId, sourceDocumentId, on) {
      /*
       * An UPDATE, never a delete (§L4): the drafts already made stand, and a
       * row that vanishes makes "why did this stop?" unanswerable.
       *
       * Scoped by company as well as by document. RLS denies the cross-company
       * case already; the filter is here so the FAILURE is a clean "no repeat
       * on that document" rather than a silent zero-row update that the caller
       * would read as success.
       */
      const { data, error } = await db
        .from('recurrences')
        .update({ ended_on: on })
        .eq('source_document_id', sourceDocumentId)
        .eq('company_id', companyId)
        .select()
        .maybeSingle()

      if (error !== null) {
        throw new RepositoryError(`Could not switch Repeat off: ${error.message}`)
      }
      if (data === null) {
        throw new RepositoryError(`No repeat on document ${sourceDocumentId}.`)
      }
      return toRecurrence(data as Row)
    },
  }
}
