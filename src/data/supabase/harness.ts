/**
 * A real Supabase client over a transport this test owns (§Q Phase 5).
 *
 * The alternative — a hand-written fake with `.from().select().eq()` stubs —
 * would test the fake. Every interesting failure in a repository is in the
 * request it BUILDS: a filter on the wrong column, a missing `company_id` on a
 * list, an `or` group that PostgREST parses as three filters instead of one.
 * A stub that returns whatever it is asked for cannot see any of those.
 *
 * So the client here is the real `@supabase/supabase-js`, with the real query
 * builder, and only `fetch` is replaced. What the tests assert is the HTTP
 * request that would have gone to PostgREST — method, path, filters, headers
 * and body — which is the thing that either works or does not.
 *
 * This is not a substitute for the round-trip suite in `supabase/tests`: that
 * one proves the columns exist against the migrated schema. Together they
 * cover both halves. Neither proves PostgREST's own behaviour, which is why
 * the §Q Phase 5 gate still needs the hosted project.
 */

import { type SupabaseClient, createClient } from '@supabase/supabase-js'

export interface Exchange {
  readonly method: string
  /** The table, taken from `/rest/v1/<table>`. */
  readonly table: string
  readonly params: URLSearchParams
  readonly body: unknown
  readonly prefer: string
}

/** What a stubbed exchange answers with: rows, or a PostgREST error. */
export type Reply = readonly unknown[] | { readonly error: { message: string; code?: string } }

export interface Harness {
  readonly db: SupabaseClient
  readonly calls: Exchange[]
  /** The exchange at `index`, with a readable failure when there isn't one. */
  call(index: number): Exchange
}

let clients = 0

export function harness(replies: readonly Reply[]): Harness {
  const calls: Exchange[] = []

  const fetchStub = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.toString())
    const headers = new Headers(init?.headers)
    const raw = init?.body
    calls.push({
      method: init?.method ?? 'GET',
      table: url.pathname.replace('/rest/v1/', ''),
      params: url.searchParams,
      body: typeof raw === 'string' && raw !== '' ? JSON.parse(raw) : undefined,
      prefer: headers.get('Prefer') ?? '',
    })

    const reply = replies[calls.length - 1] ?? []
    if (!Array.isArray(reply)) {
      const { error } = reply as { error: { message: string; code?: string } }
      return new Response(JSON.stringify({ ...error, details: null, hint: null }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }
    // Always an array: `maybeSingle()` asks for the normal representation and
    // unwraps client-side, so returning a bare object would be a shape
    // PostgREST never sends.
    return new Response(JSON.stringify(reply), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const db = createClient('https://stub.supabase.co', 'anon-key-for-tests', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      // Each harness gets its own key. Without it every client in the file
      // shares one storage slot and the auth client warns on each — noise that
      // would bury a real warning from a future test.
      storageKey: `docflow.test.${++clients}`,
    },
    global: { fetch: fetchStub as typeof fetch },
  })

  return {
    db,
    calls,
    call(index) {
      const found = calls[index]
      if (found === undefined) {
        throw new Error(`Expected at least ${index + 1} requests, got ${calls.length}.`)
      }
      return found
    },
  }
}
