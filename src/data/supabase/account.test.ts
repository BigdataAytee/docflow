/**
 * Reading the company out of a session, and creating the first one.
 *
 * The RPC's own rules are tested against real Postgres in
 * `supabase/tests/account.test.ts`. What is only testable here is the claim
 * shape the client reads, and the refresh — the step whose absence leaves an
 * app correctly authenticated and reading an empty account.
 */

import { describe, expect, it } from 'vitest'

import { AccountError, companyFromToken, createCompany } from './account'
import { harness } from './harness'

const ACME = '11111111-1111-1111-1111-111111111111'

/** A token shaped like Supabase's: header.payload.signature, base64url. */
function token(claims: unknown): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`
}

describe('The company is read from where the database reads it (§P)', () => {
  it('finds the claim nested under app_metadata', async () => {
    // The shape Supabase actually issues. Reading anywhere else means the
    // client and `current_company_id()` can disagree about which company a
    // session is — which is how the top-level read went unnoticed (0013).
    expect(
      companyFromToken(token({ sub: 'u1', app_metadata: { provider: 'email', company_id: ACME } })),
    ).toBe(ACME)
  })

  it('does not accept a top-level claim the server would ignore', async () => {
    // A token carrying it here but not under app_metadata would let the app
    // show a company for which every single row is denied.
    expect(companyFromToken(token({ sub: 'u1', company_id: ACME }))).toBeNull()
  })

  it('returns null for a fresh sign-up, which has no company yet', async () => {
    expect(
      companyFromToken(token({ sub: 'u1', app_metadata: { provider: 'email', providers: ['email'] } })),
    ).toBeNull()
  })

  it('returns null rather than throwing on a token it cannot read', async () => {
    for (const bad of ['', 'not-a-token', 'a.b', 'a.!!!.c']) {
      expect(companyFromToken(bad), bad).toBeNull()
    }
  })
})

describe('Creating the first company (§R)', () => {
  const companyRow = {
    id: ACME,
    name: 'Sola Ventures',
    currency: 'GHS',
    locale_region: 'GH',
    locale_language: 'en',
    label_overrides: {},
    numbering_prefixes: {},
    bank_fields: {},
    enabled_payment_methods: [],
  }
  const input = { name: 'Sola Ventures', localeRegion: 'GH', currency: 'GHS' }

  it('calls the function with the business the owner described', async () => {
    const h = harness([{ json: { company: companyRow, created: true } }])
    h.db.auth.refreshSession = async () =>
      ({
        data: { session: { access_token: token({ app_metadata: { company_id: ACME } }) } },
        error: null,
      }) as never

    const { companyId } = await createCompany(h.db, input)

    expect(h.call(0).table).toBe('rpc/create_company_for_new_user')
    expect(h.call(0).body).toMatchObject({
      p_name: 'Sola Ventures',
      p_locale_region: 'GH',
      p_currency: 'GHS',
    })
    expect(companyId).toBe(ACME)
  })

  it('refreshes the session, because the token predates the company', async () => {
    let refreshed = false
    const h = harness([{ json: { company: companyRow, created: true } }])
    h.db.auth.refreshSession = async () => {
      refreshed = true
      return {
        data: { session: { access_token: token({ app_metadata: { company_id: ACME } }) } },
        error: null,
      } as never
    }

    await createCompany(h.db, input)
    // Without this the app sits correctly authenticated, reading an empty
    // account, with nothing on screen to explain why.
    expect(refreshed).toBe(true)
  })

  it('says so when the refreshed session still carries no company', async () => {
    const h = harness([{ json: { company: companyRow, created: true } }])
    h.db.auth.refreshSession = async () =>
      ({ data: { session: { access_token: token({ app_metadata: {} }) } }, error: null }) as never

    // Reported rather than swallowed: an app that looks signed in and shows
    // nothing is the worst outcome available here.
    await expect(createCompany(h.db, input)).rejects.toThrow(/still does not carry it/)
  })

  it('says the business WAS created when only the refresh failed', async () => {
    const h = harness([{ json: { company: companyRow, created: true } }])
    h.db.auth.refreshSession = async () =>
      ({ data: { session: null }, error: { message: 'network' } }) as never

    // The distinction matters to the person reading it: retrying the creation
    // is not what they need to do.
    await expect(createCompany(h.db, input)).rejects.toThrow(/was created/)
  })

  it('passes the database refusal through rather than reinventing it', async () => {
    const h = harness([{ error: { message: 'A business needs a name.' } }])
    await expect(createCompany(h.db, { ...input, name: '' })).rejects.toThrow(AccountError)
  })
})
