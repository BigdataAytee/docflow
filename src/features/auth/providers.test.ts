/**
 * The button that offered a provider the project did not have.
 *
 * Google sign-in was rendered unconditionally, so on a project with no Google
 * credentials the only thing it could do was fail — GoTrue answers
 * `validation_failed / "Unsupported provider: provider is not enabled"`.
 */

import { describe, expect, it, vi } from 'vitest'

import { enabledProviders, readEnabledProviders } from './providers'

describe('Reading what the project has enabled', () => {
  it('keeps only the providers set to exactly true', () => {
    const on = enabledProviders({ external: { google: false, apple: true, email: true } })
    expect(on.has('google')).toBe(false)
    expect(on.has('apple')).toBe(true)
  })

  /** A changed shape must read as "no", never as "probably yes". */
  it.each([
    ['a truthy string', { external: { google: 'true' } }],
    ['a number', { external: { google: 1 } }],
    ['no external block', { other: {} }],
    ['null', null],
    ['a string body', 'nope'],
  ])('reads %s as nothing enabled', (_name, body) => {
    expect(enabledProviders(body).size).toBe(0)
  })
})

describe('Asking the project, over the network', () => {
  const settings = (external: Record<string, boolean>) =>
    vi.fn(async () => new Response(JSON.stringify({ external }), { status: 200 }))

  it('sends the anon key and reads the answer', async () => {
    const fetchImpl = settings({ google: true })
    const on = await readEnabledProviders('https://p.supabase.co', 'anon', fetchImpl as never)

    expect(on.has('google')).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://p.supabase.co/auth/v1/settings')
    expect((init.headers as Record<string, string>)['apikey']).toBe('anon')
  })

  it('does not double the slash when the url has a trailing one', async () => {
    const fetchImpl = settings({ google: true })
    await readEnabledProviders('https://p.supabase.co/', 'anon', fetchImpl as never)
    const [url] = fetchImpl.mock.calls[0] as unknown as [string]
    expect(url).toBe('https://p.supabase.co/auth/v1/settings')
  })

  /*
   * UNKNOWN IS HIDDEN. Whoever cannot reach the project also cannot complete
   * an OAuth round trip, so offering the button can only waste their time.
   */
  it.each([
    ['the request throws', vi.fn(async () => { throw new TypeError('Failed to fetch') })],
    ['the project answers 500', vi.fn(async () => new Response('', { status: 500 }))],
    ['the body is not json', vi.fn(async () => new Response('<html>', { status: 200 }))],
  ])('enables nothing when %s', async (_name, fetchImpl) => {
    const on = await readEnabledProviders('https://p.supabase.co', 'anon', fetchImpl as never)
    expect(on.size).toBe(0)
  })
})
