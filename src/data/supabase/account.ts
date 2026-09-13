/**
 * The first company a new account belongs to (§R, §P).
 *
 * Sign-up alone leaves a user with no company: `auth.signUp` sets no custom
 * claims, so their token carries no `company_id`, `current_company_id()` is
 * NULL, and every policy denies them everything. They would land in an account
 * that shows nothing, on every screen, with no error to explain it.
 *
 * `create_company_for_new_user` (0014) closes that. The one subtlety worth
 * spelling out is the refresh:
 *
 *   The access token in hand was minted BEFORE the company existed. It cannot
 *   contain a claim about something that did not exist when it was signed.
 *   So creating the company changes nothing the client can see until the
 *   session is refreshed — and without that refresh the app would sit,
 *   correctly authenticated, reading an empty account.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { type Company } from '../repositories'
import { type Row, toCompany } from './rows'

export class AccountError extends Error {}

/** Where a signed-in user stands: with a company, or not yet. */
export type AccountState =
  | { readonly kind: 'ready'; readonly companyId: string }
  | { readonly kind: 'needs_company' }

/**
 * The company named by the CURRENT token, if any.
 *
 * Read from the token rather than from the `companies` table, deliberately:
 * the token is what every policy will be judged against, so asking it is
 * asking the only question that matters. A company row the token does not
 * name is a company this session cannot read a single row of.
 */
export async function accountState(db: SupabaseClient): Promise<AccountState> {
  const { data } = await db.auth.getSession()
  const session = data.session
  if (session === null) return { kind: 'needs_company' }

  const companyId = companyFromToken(session.access_token)
  return companyId === null ? { kind: 'needs_company' } : { kind: 'ready', companyId }
}

/**
 * The `company_id` claim, read out of the access token.
 *
 * Supabase nests custom claims under `app_metadata` — the shape that
 * `current_company_id()` reads (0013). Reading the same place here means the
 * client and the database cannot disagree about which company a session is.
 *
 * The signature is not verified, and does not need to be: this is not a trust
 * decision. The server re-reads the same claim from the same token on every
 * request, so a forged one buys nothing but a client that displays the wrong
 * id while being denied every row.
 */
export function companyFromToken(accessToken: string): string | null {
  const payload = accessToken.split('.')[1]
  if (payload === undefined) return null
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json) as { app_metadata?: { company_id?: unknown } }
    const companyId = claims.app_metadata?.company_id
    return typeof companyId === 'string' && companyId !== '' ? companyId : null
  } catch {
    return null
  }
}

export interface NewCompany {
  readonly name: string
  readonly localeRegion: string
  readonly currency: string
}

/**
 * Create the company, then refresh so the session knows about it.
 *
 * Returns the company AND its id rather than expecting the caller to re-read:
 * a caller that had to fetch it again would be doing so with a token that may
 * still be the old one, which is the whole trap this function exists to avoid.
 */
export async function createCompany(
  db: SupabaseClient,
  input: NewCompany,
): Promise<{ company: Company; companyId: string }> {
  const { data, error } = await db.rpc('create_company_for_new_user', {
    p_name: input.name,
    p_locale_region: input.localeRegion,
    p_currency: input.currency,
  })
  if (error !== null) throw new AccountError(error.message)

  const result = data as { company: Row } | null
  if (result === null || result.company === undefined) {
    throw new AccountError('The business was not created.')
  }
  const company = toCompany(result.company)

  // The token in hand predates the company. Refresh, or every read that
  // follows is denied by a policy asking about a claim this token cannot have.
  const refreshed = await db.auth.refreshSession()
  if (refreshed.error !== null) {
    throw new AccountError(
      `Your business was created, but this device could not refresh its session: ${refreshed.error.message}. Sign in again to continue.`,
    )
  }

  const token = refreshed.data.session?.access_token
  const companyId = token === undefined ? null : companyFromToken(token)
  if (companyId === null) {
    // Refreshed, and STILL no claim. Reported rather than swallowed: the
    // alternative is an app that looks signed in and shows nothing.
    throw new AccountError(
      'Your business was created, but this session still does not carry it. Sign out and in again.',
    )
  }

  return { company, companyId }
}
