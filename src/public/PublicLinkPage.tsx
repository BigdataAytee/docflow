/**
 * The pages a customer opens (§G, §P, §Q Phase 5, §T).
 *
 * §G: "copy accept link" on a quotation and "copy signing link" on a
 * delivery. §Q: "Tokenized public pages: delivery remote signing (view + sign
 * → atomic delivered + timestamp, token invalidated) and quotation acceptance
 * (Accept/Reject, optional signature, timestamped), rate-limited, rendered in
 * the document's frozen language."
 *
 * Four rules shape what is here:
 *
 *  · **No app.** No repository, no store, no company context, no tab bar. The
 *    customer has no account, and a page that could reach `useAppData` would
 *    be one refactor away from rendering somebody else's documents.
 *  · **The document's frozen language, not the device's** (§P, §D.2). The
 *    endpoint sends the frozen labels; whatever language this phone is set
 *    to, the offer reads as it was sent.
 *  · **A refusal shows a friendly message and never data** (§P). Wrong,
 *    expired and used are separate sentences, but none of them says whether
 *    a document exists — the endpoint already made them indistinguishable
 *    where it mattered.
 *  · **`noindex, nofollow`** (§T): "customer documents must never enter a
 *    search index."
 */

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { type LinkTransport, type PublicView, type Refusal, createLinkTransport } from './client'
import { SignaturePad } from '../features/signature/SignaturePad'
import { PublicDocumentPage } from './PublicDocumentPage'
import { type UiStrings, format, stringsFor } from '../domain/locale/data/strings'

export interface PublicLinkPageProps {
  readonly kind: 'accept' | 'sign'
  /** Injected in tests; the real one talks to the edge function. */
  readonly transport?: LinkTransport
}

type Screen =
  | { readonly state: 'loading' }
  | { readonly state: 'refused'; readonly reason: Refusal }
  | { readonly state: 'open'; readonly view: PublicView }
  | { readonly state: 'done'; readonly view: PublicView; readonly outcome: string }

/** §T: these pages are excluded from every index, for as long as one is open. */
function useNoIndex() {
  useEffect(() => {
    const tag = document.createElement('meta')
    tag.name = 'robots'
    tag.content = 'noindex, nofollow'
    document.head.appendChild(tag)
    return () => tag.remove()
  }, [])
}

export function PublicLinkPage({ kind, transport }: PublicLinkPageProps) {
  const { token = '' } = useParams<{ token: string }>()
  const [screen, setScreen] = useState<Screen>({ state: 'loading' })
  const [busy, setBusy] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signerRole, setSignerRole] = useState('')
  const [failed, setFailed] = useState(false)

  useNoIndex()

  // One transport per mount, so the effect below has an honest dependency
  // rather than a new object every render.
  const port = useMemo(() => transport ?? createLinkTransport(), [transport])

  useEffect(() => {
    let live = true
    void port.open(token).then((result) => {
      if (!live) return
      setScreen(
        result.ok
          ? // The link's own kind has to match the page it opened. A sign
            // token replayed at /accept must not be answered (§P).
            result.view.kind === kind
            ? { state: 'open', view: result.view }
            : { state: 'refused', reason: 'wrong' }
          : { state: 'refused', reason: result.reason },
      )
    })
    return () => {
      live = false
    }
  }, [token, kind, port])

  // Until the document arrives there is no frozen language to read, so the
  // few words before that are in the bundle's default.
  const view = screen.state === 'open' || screen.state === 'done' ? screen.view : null
  const strings: UiStrings = stringsFor(view?.language ?? 'en')
  const s = strings.publicLink

  const submit = async (body: Parameters<LinkTransport['submit']>[1]) => {
    if (view === null) return
    setBusy(true)
    setFailed(false)
    const result = await port.submit(token, body)
    setBusy(false)
    if (result.ok) {
      setScreen({ state: 'done', view, outcome: result.done })
      return
    }
    // A refusal that arrived on submit is final: the link died while the page
    // was open, which is exactly what §P's second check is for.
    if (result.reason === 'used' || result.reason === 'expired') {
      setScreen({ state: 'refused', reason: result.reason })
      return
    }
    setFailed(true)
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-paper px-4 py-8" lang={view?.language ?? 'en'}>
      {screen.state === 'loading' && <p className="text-center text-sm opacity-60">{s.checking}</p>}

      {screen.state === 'refused' && (
        <section className="glass rounded-2xl p-6 text-center" aria-label={s.wrong}>
          {/* A message, and nothing else. Never a reference, never a name. */}
          <p className="text-sm font-medium">
            {screen.reason === 'expired'
              ? s.expired
              : screen.reason === 'used'
                ? s.used
                : screen.reason === 'not_answerable'
                  ? s.notAnswerable
                  : screen.reason === 'rate_limited'
                    ? s.rateLimited
                    : s.wrong}
          </p>
        </section>
      )}

      {/*
        THE DOCUMENT FIRST, then what to do about it.

        This was a heading, a card and a row per line — a long scroll in which
        the thing being signed for never actually appeared as a document. The
        page is the page now, at A4 proportions, and the controls sit under
        it. What the page can show is bounded by what the link carries: see
        `PublicDocumentPage`.
      */}
      {view !== null && (
        <>
          <header className="mb-3 text-center">
            <p className="text-xs uppercase tracking-wide opacity-60">
              {format(s.from, { business: view.businessName })}
            </p>
          </header>

          <PublicDocumentPage view={view} strings={strings} />
        </>
      )}

      {screen.state === 'done' && (
        <section className="mt-4 rounded-2xl bg-status-good-tint p-6 text-center text-sm font-medium text-status-good">
          {screen.outcome === 'delivered'
            ? format(s.signedThanks, { business: screen.view.businessName })
            : screen.outcome === 'accepted'
              ? format(s.accepted, { business: screen.view.businessName })
              : format(s.rejected, { business: screen.view.businessName })}
        </section>
      )}

      {screen.state === 'open' && kind === 'accept' && (
        <section className="mt-4 space-y-2">
          {signing ? (
            <SignaturePad
              strings={strings}
              onClose={() => setSigning(false)}
              onUse={(drawn) => {
                setSigning(false)
                void submit({
                  answer: 'accepted',
                  signatureDataUrl: drawn.dataUrl,
                  ...(signerName.trim() === '' ? {} : { signerName: signerName.trim() }),
                })
              }}
            />
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                className="raised tap-scale min-h-tap w-full rounded-xl bg-gradient-to-b from-brand-light to-brand px-4 text-sm font-semibold text-white disabled:opacity-40"
                onClick={() => void submit({ answer: 'accepted' })}
              >
                {busy ? s.sending : s.accept}
              </button>
              <button
                type="button"
                disabled={busy}
                className="min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-4 text-sm font-medium disabled:opacity-40"
                onClick={() => void submit({ answer: 'rejected' })}
              >
                {s.reject}
              </button>
              {/* §Q: the signature is OPTIONAL on an acceptance. */}
              <button
                type="button"
                disabled={busy}
                className="min-h-tap w-full rounded-xl px-4 text-xs font-medium opacity-70 disabled:opacity-40"
                onClick={() => setSigning(true)}
              >
                {s.optionalSignature}
              </button>
            </>
          )}
        </section>
      )}

      {screen.state === 'open' && kind === 'sign' && (
        <section className="mt-4 space-y-2">
          <p className="text-sm font-medium">{s.signHere}</p>
          <label className="block text-xs font-medium opacity-70" htmlFor="public-signer">
            {s.whoAreYou}
          </label>
          <input
            id="public-signer"
            className="min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
            value={signerName}
            onChange={(event) => setSignerName(event.target.value)}
          />
          <label className="block text-xs font-medium opacity-70" htmlFor="public-role">
            {s.yourRole}
          </label>
          <input
            id="public-role"
            className="min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
            value={signerRole}
            onChange={(event) => setSignerRole(event.target.value)}
          />

          {/* Same rule as the owner's own sheet: no pad until there is a name,
              so a mark already drawn is never thrown away (§P). */}
          {signerName.trim() !== '' && (
            <SignaturePad
              strings={strings}
              onClose={() => setSignerName('')}
              onUse={(drawn) =>
                void submit({
                  signerName: signerName.trim(),
                  ...(signerRole.trim() === '' ? {} : { signerRole: signerRole.trim() }),
                  signatureDataUrl: drawn.dataUrl,
                })
              }
            />
          )}
        </section>
      )}

      {failed && (
        <p
          className="mt-3 rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm font-medium text-status-warn"
          role="alert"
        >
          {s.failed}
        </p>
      )}
    </main>
  )
}
