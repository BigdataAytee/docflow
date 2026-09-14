/**
 * Ending the account, over PostgREST (§S; Apple 5.1.1(v)).
 *
 * Both mutations are RPCs rather than table writes, and `account_deletions`
 * has no insert, update or delete policy at all. That is deliberate: the rule
 * is about WHO the caller is — owner, and no permission promotes anybody into
 * it — and an RLS policy cannot express that, because a policy sees rows
 * rather than roles. `0017_account_deletion.sql` checks the role inside a
 * SECURITY DEFINER function; this file only asks.
 *
 * The domain module is still the source of the rules. It runs here too, so a
 * refusal is shown before a round trip — but the server refuses again, and
 * the server's refusal is the one that counts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  type DeletionRequest,
  type Lifecycle,
  type Result,
  type Role,
  canRequest,
  confirms,
} from '../../domain/account/deletion'
import type { AccountRepository } from '../repositories'

interface DeletionRow {
  readonly company_id: string
  readonly requested_by: string
  readonly requested_at: string
  readonly purge_after: string
  readonly exported: boolean
}

const toRequest = (row: DeletionRow): DeletionRequest => ({
  companyId: row.company_id,
  requestedBy: row.requested_by,
  requestedAt: row.requested_at,
  purgeAfter: row.purge_after,
  exported: row.exported,
})

export function accountRepository(client: SupabaseClient): AccountRepository {
  return {
    async lifecycle(companyId) {
      const { data, error } = await client
        .from('account_deletions')
        .select('company_id, requested_by, requested_at, purge_after, exported')
        .eq('company_id', companyId)
        .maybeSingle()

      // A read that fails is not an active account — saying "active" on an
      // error would hide a scheduled deletion behind a network blip, and the
      // whole point of the notice is that it cannot be missed.
      if (error !== null) throw error
      return data === null
        ? { state: 'active' }
        : { state: 'scheduled', request: toRequest(data as DeletionRow) }
    },

    async request(input) {
      // Checked here so the refusal is immediate and in the right language,
      // and checked again in the function because this one can be skipped.
      if (!canRequest(input.role)) return { ok: false, why: 'not_owner' }
      if (!confirms(input.typedName, input.companyName)) return { ok: false, why: 'name_mismatch' }

      const { data, error } = await client.rpc('request_account_deletion', {
        p_typed_name: input.typedName,
        p_exported: input.exported,
      })
      if (error !== null) throw error
      return { ok: true, value: toRequest(data as DeletionRow) }
    },

    async cancel(_companyId, role) {
      if (!canRequest(role)) return { ok: false, why: 'not_owner' }
      const { error } = await client.rpc('cancel_account_deletion')
      if (error !== null) throw error
      return { ok: true, value: { state: 'active' } as Lifecycle }
    },
  }
}

export type { Result, Role }
