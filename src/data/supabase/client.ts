/**
 * The Supabase client (§C, §Q Phase 1).
 *
 * Only `src/data/*` may import this — UI goes through `src/data/repositories`
 * (CLAUDE.md; the no-restricted-imports rule enforces it).
 *
 * The anon key is a public client key: its authority comes entirely from RLS,
 * which is why §P puts RLS on every table and why FORCE matters. The
 * service-role key holds BYPASSRLS and must never be VITE_-prefixed, never
 * bundled, never logged — see TODO(Phase 7) in 0006_rls.sql.
 */

import { type SupabaseClient, createClient } from '@supabase/supabase-js'

export class SupabaseConfigError extends Error {}

export interface SupabaseConfig {
  readonly url: string
  readonly anonKey: string
}

export function readConfig(env: Record<string, string | undefined>): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  if (url === undefined || url === '' || anonKey === undefined || anonKey === '') {
    throw new SupabaseConfigError(
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set. They live in .env, which is gitignored.',
    )
  }
  return { url, anonKey }
}

/**
 * A key is service-role if its JWT payload says so. Used to refuse one at the
 * client boundary: a mis-pasted service key in VITE_SUPABASE_ANON_KEY would
 * ship BYPASSRLS to every browser, and nothing else would notice.
 */
export function isServiceRoleKey(key: string): boolean {
  const payload = key.split('.')[1]
  if (payload === undefined) return false
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    )
    return (
      typeof decoded === 'object' &&
      decoded !== null &&
      (decoded as { role?: unknown }).role === 'service_role'
    )
  } catch {
    return false
  }
}

export function createBrowserClient(config: SupabaseConfig): SupabaseClient {
  if (isServiceRoleKey(config.anonKey)) {
    throw new SupabaseConfigError(
      'That is a service-role key, not an anon key. It bypasses RLS and must never reach a browser bundle.',
    )
  }

  return createClient(config.url, config.anonKey, {
    auth: {
      // §Q Phase 1: sessions tolerant of long offline gaps. Supabase refresh
      // tokens do not expire while they keep being used; persisting the
      // session and refreshing it is what carries a user past 30 days.
      persistSession: true,
      autoRefreshToken: true,
      // §R: reset and Google return through real provider URLs, so the client
      // must read the session back out of the redirect.
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'docflow.auth',
    },
  })
}
