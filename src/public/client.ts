/**
 * Talking to the public-link endpoint (§P, §Q Phase 5).
 *
 * The ONE place in this app that fetches over the network to READ a document,
 * and it is not an exception to §C's repository rule — it is the opposite
 * side of it. A repository serves the owner, who is signed in and scoped to a
 * company. This serves a customer who has neither, and the only thing
 * authorising them is the token in their URL.
 *
 * It therefore imports no repository, no store and no company context. A
 * public page that could reach `useAppData` would be one refactor away from
 * rendering somebody else's documents.
 */

import type { PublicView, Refusal } from '../../supabase/functions/public-link/rules'

export type { PublicView, Refusal }

export type LinkResult =
  | { readonly ok: true; readonly view: PublicView }
  | { readonly ok: false; readonly reason: Refusal }

export interface LinkTransport {
  open(token: string): Promise<LinkResult>
  submit(token: string, body: SubmitBody): Promise<
    { readonly ok: true; readonly done: string } | { readonly ok: false; readonly reason: Refusal }
  >
}

export interface SubmitBody {
  readonly answer?: 'accepted' | 'rejected'
  readonly signerName?: string
  readonly signerRole?: string
  readonly signatureDataUrl?: string
}

/**
 * Where the function lives. Read from the environment so a deployment can
 * point at its own project; absent means the pages say so rather than
 * throwing at a customer.
 */
export const endpoint = (): string | null => {
  const base = import.meta.env['VITE_SUPABASE_URL']
  return typeof base === 'string' && base !== '' ? `${base}/functions/v1/public-link` : null
}

/**
 * A network failure is `wrong` like everything else.
 *
 * Not because it is accurate, but because the alternative leaks: an error
 * that distinguishes "the server said no" from "the server never answered"
 * tells whoever is probing that they reached something real.
 */
export function createLinkTransport(base: string | null = endpoint()): LinkTransport {
  const call = async (token: string, init?: RequestInit) => {
    if (base === null) return { ok: false as const, reason: 'wrong' as Refusal }
    try {
      const response = await fetch(`${base}?token=${encodeURIComponent(token)}`, init)
      const body = (await response.json()) as Record<string, unknown>
      if (body['ok'] === true) return body as never
      return { ok: false as const, reason: (body['reason'] as Refusal) ?? 'wrong' }
    } catch {
      return { ok: false as const, reason: 'wrong' as Refusal }
    }
  }

  return {
    async open(token) {
      return (await call(token)) as LinkResult
    },
    async submit(token, body) {
      return (await call(token, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })) as never
    },
  }
}
