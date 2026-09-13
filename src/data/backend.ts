/**
 * Which backend the app runs on (§C, §Q Phase 5, §R).
 *
 * One decision, made once. There are exactly two answers:
 *
 *  · **account** — a Supabase project is configured. Records live in the
 *    account, sign-in is required, and RLS draws the company boundary (§P).
 *  · **demo** — no project is configured. `npm run dev` runs here, on
 *    in-memory repositories with seeded records.
 *
 * The rule shaping this file is one line of §R: **"a local demo is never
 * passed off as an account."** So the demo is not a silent fallback that
 * happens to look like the app with nobody signed in. It is a named state the
 * UI says out loud, and it is chosen ONLY by the absence of configuration —
 * never by a failure at runtime. A project that is configured but broken is an
 * account having a bad day; degrading it to a demo would quietly discard
 * whatever the owner typed into what they believed was their account.
 *
 * It lives in `src/data` because composing a backend means naming a client,
 * and §C puts that here rather than in the UI. What leaves this file is a
 * `Repositories` and a `SessionService` — two ports, no client.
 */

import { type Repositories, createMemoryRepositories } from './repositories'
import type { SessionService } from './session'
import { createSupabaseRepositories } from './supabase/repositories'
import { createBrowserClient, readConfig } from './supabase/client'
import { createSupabaseSession } from './supabase/session'

export type Backend =
  | {
      readonly kind: 'account'
      readonly session: SessionService
      readonly repositories: Repositories
    }
  | {
      readonly kind: 'demo'
      readonly companyId: string
      readonly repositories: Repositories
    }

/** True when a Supabase project is configured for this build. */
export function isConfigured(env: Record<string, string | undefined>): boolean {
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY
  return url !== undefined && url !== '' && key !== undefined && key !== ''
}

export interface DemoSeed {
  readonly companyId: string
  readonly repositories: Repositories
}

export function createBackend(
  env: Record<string, string | undefined>,
  demo: () => DemoSeed,
): Backend {
  if (!isConfigured(env)) {
    const seeded = demo()
    return { kind: 'demo', companyId: seeded.companyId, repositories: seeded.repositories }
  }

  // `readConfig` and `createBrowserClient` throw rather than returning
  // something half-built — including when a service-role key has been pasted
  // into the anon slot, which would ship BYPASSRLS to every browser. A
  // configured-but-broken project must fail loudly here.
  const client = createBrowserClient(readConfig(env))
  return {
    kind: 'account',
    session: createSupabaseSession(client),
    repositories: createSupabaseRepositories(client),
  }
}

export { createMemoryRepositories }
