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
 * **Everything here loads on demand.** Both branches are `import()`ed rather
 * than imported, and that is not a micro-optimisation — it decides what a
 * person downloads before they see anything:
 *
 *  · a demo build ships no Supabase client at all;
 *  · an account build does not build the in-memory store;
 *  · and — the one that actually matters — a CUSTOMER opening a public link
 *    downloads neither. Their page talks to the edge function over plain
 *    `fetch` and they have no account, so making them wait for a database
 *    client was making the cheapest phone on the slowest connection pay for a
 *    feature it never uses (Rule #1).
 *
 * The Supabase client is the weight here: 59 kB gzipped against a 122 kB
 * first chunk. The demo store is a rounding error by comparison, and is
 * deferred for tidiness rather than for bytes.
 *
 * What leaves this file is a `Repositories` and a `SessionService` — two
 * ports, no client.
 */

import type { Repositories } from './repositories'
import type { SessionService } from './session'

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
      /**
       * Whether these records survive closing the app.
       *
       * "Demo" here means NO ACCOUNT, not "nothing is kept" — and the two had
       * been conflated. On a phone this branch opens the encrypted SQLite
       * store and everything persists across restarts; in a browser tab it is
       * the in-memory store and nothing does. The banner said the browser's
       * answer on both, so an installed app warned that work would be lost
       * when it would not, four pixels above Home saying "Saved on this
       * phone".
       */
      readonly durable: boolean
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
  /** See `Backend`'s `durable` — the store decides, not the backend. */
  readonly durable: boolean
}

export async function createBackend(
  env: Record<string, string | undefined>,
  loadDemo: () => Promise<DemoSeed>,
): Promise<Backend> {
  if (!isConfigured(env)) {
    const seeded = await loadDemo()
    return {
      kind: 'demo',
      companyId: seeded.companyId,
      repositories: seeded.repositories,
      durable: seeded.durable,
    }
  }

  // One import, so the client, the repositories and the session land in a
  // single chunk rather than three that must arrive before anything renders.
  const [{ createBrowserClient, readConfig }, { createSupabaseRepositories }, { createSupabaseSession }] =
    await Promise.all([
      import('./supabase/client'),
      import('./supabase/repositories'),
      import('./supabase/session'),
    ])

  // `readConfig` and `createBrowserClient` throw rather than returning
  // something half-built — including when a service-role key has been pasted
  // into the anon slot, which would ship BYPASSRLS to every browser. A
  // configured-but-broken project must fail loudly here.
  const client = createBrowserClient(readConfig(env))
  return {
    kind: 'account',
    session: createSupabaseSession(client, env),
    repositories: createSupabaseRepositories(client),
  }
}
