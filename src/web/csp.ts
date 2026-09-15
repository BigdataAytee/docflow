/**
 * The content security policy the built app carries (§P).
 *
 * WHY IT IS HERE AND NOT ON A HOST. Response headers belong to whatever
 * serves the bundle, and this bundle is served two ways: by a web host, and
 * by Capacitor from the app's own assets over `https://localhost`. A host
 * header covers the first and can never cover the second, so the policy that
 * has to hold in BOTH places travels inside the document.
 *
 * A `<meta http-equiv>` policy is weaker than a real header in exactly one
 * way — it cannot carry `frame-ancestors`, which only a header can enforce —
 * so the host should still send its own. That is the external action noted in
 * PLAN. Everything else here applies identically in both shells.
 *
 * WHAT EACH DIRECTIVE IS FOR, because a policy nobody can explain is a policy
 * somebody widens the first time a screen breaks:
 *
 *  · `default-src 'self'` — the app ships everything it needs. §V is explicit
 *    that "fonts, template assets, icons, terminology tables and language
 *    strings ship in the app bundle — nothing needed to open a saved document
 *    touches a CDN", so a policy that allowed one would be permitting a thing
 *    the product forbids.
 *  · `img-src 'self' data: blob:` — every asset in this app IS a data URL.
 *    Signatures, logos and delivery photos are stored that way so a document
 *    stays openable offline with nothing to fetch (§M).
 *  · `connect-src 'self' https:` — Supabase's host is per-environment, so the
 *    scheme is what can be pinned here. It still refuses plain `http:`, which
 *    is the thing worth refusing: a downgraded request carrying a session.
 *  · `style-src 'self' 'unsafe-inline'` — React sets inline styles on the A4
 *    page (the paper colour, the fitted logo rect, the totals width). Removing
 *    the allowance would mean moving per-document geometry into a stylesheet,
 *    which is a worse design for no security gain: the values are computed by
 *    this app from its own records, not interpolated from anything a stranger
 *    sends.
 *  · `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` — nothing in
 *    the app embeds a plugin, rewrites its own base, or posts a form anywhere.
 *    All three are pure denial of things the app does not do.
 *  · `upgrade-insecure-requests` — belt and braces beside `connect-src`.
 *
 * BUILD ONLY. In development Vite serves an inline module preamble and an HMR
 * client, and a `script-src 'self'` policy would break the dev server — so the
 * plugin below injects nothing when the command is `serve`. That is a real
 * asymmetry and worth naming: the policy is verified by a test on the built
 * `index.html`, never by somebody remembering to check it by hand.
 */

export const CSP_DIRECTIVES: readonly string[] = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
]

export const contentSecurityPolicy = (): string => CSP_DIRECTIVES.join('; ')

/**
 * The document-level security tags, as HTML.
 *
 * `Referrer-Policy` matters more here than it looks: a document path carries
 * a record id, and `no-referrer` keeps that id out of the `Referer` of
 * anything the page ever loads.
 */
export const securityMetaTags = (): string =>
  [
    `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy()}" />`,
    '<meta name="referrer" content="no-referrer" />',
  ].join('\n    ')
