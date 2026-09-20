/**
 * The two things a `<meta>` policy cannot say (§P).
 *
 * `src/web/csp.ts` carries the whole content security policy inside the built
 * document, because the same bundle is served two ways — by a web host, and
 * by Capacitor from the app's own assets — and a host header can never cover
 * the second. That covers everything except two directives that only a real
 * response header can carry:
 *
 *  · **`frame-ancestors`** — browsers IGNORE it in a meta policy, by spec. So
 *    the clickjacking protection the app believes it has is, on the web, not
 *    there at all: any page anywhere can put DocFlow in an iframe and sit an
 *    invisible layer over "Record payment".
 *  · **`Strict-Transport-Security`** — meta cannot express it either, and its
 *    whole purpose is the request BEFORE the document loads.
 *
 * WHY THE HEADER SENDS ONLY `frame-ancestors`, not the whole policy again.
 * When a header and a meta policy both apply, a browser enforces BOTH — the
 * intersection. Sending the full policy twice would mean two copies that can
 * drift, and the drift would show up as a screen breaking in production and
 * nowhere else. One directive in the header, everything else in the document,
 * and the intersection is exactly the policy this app intends.
 *
 * WHY NO `preload` ON THE HSTS. Submitting to the preload list is a one-way
 * door: it is baked into browser binaries, removal takes months, and it binds
 * every current and future subdomain to HTTPS-only. That is the owner's
 * decision about their domain, not a default a build tool should take for
 * them. `includeSubDomains` with a year's max-age is the strong, reversible
 * setting; `preload` can be added the day somebody means it.
 *
 * WHICH HOST. Nothing in this repository names one, and inventing it would be
 * inventing a business fact. So the build emits `_headers` — the format
 * Netlify and Cloudflare Pages read directly — and the equivalents for the
 * other common servers are below, generated from these same values so no
 * snippet can quietly disagree with what ships.
 */

/** A year, which is what a browser is being asked to remember. */
export const HSTS_MAX_AGE_SECONDS = 31_536_000

export interface ResponseHeader {
  readonly name: string
  readonly value: string
  /** Why it exists, carried with it into the generated documentation. */
  readonly because: string
}

export const HOST_HEADERS: readonly ResponseHeader[] = [
  {
    name: 'Content-Security-Policy',
    value: "frame-ancestors 'none'",
    because:
      'A meta policy cannot carry frame-ancestors, so without this the app can be framed by any page on the internet.',
  },
  {
    name: 'Strict-Transport-Security',
    value: `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
    because:
      'The protection is for the request before the document loads, which no meta tag can reach. No preload: that is a one-way door and the owner’s call.',
  },
]

/** Every path, because both headers are about the origin rather than a file. */
export const HEADERS_PATH = '/*'

/**
 * The `_headers` file Netlify and Cloudflare Pages read.
 *
 * Emitted into the build rather than checked in beside the source, so it can
 * never be a stale copy of these values — and so a host that reads it finds
 * it already there in `dist/` without anybody remembering a step.
 */
export const headersFile = (): string =>
  [
    '# Generated from src/web/headers.ts — do not edit.',
    '#',
    '# The rest of the content security policy travels inside index.html, so',
    '# it applies under Capacitor too. These are the parts a meta tag cannot',
    '# express; a browser enforces the header and the document policy together.',
    HEADERS_PATH,
    ...HOST_HEADERS.map((header) => `  ${header.name}: ${header.value}`),
    '',
  ].join('\n')

/** The same two headers, for the servers that do not read `_headers`. */
export const hostSnippets = (): readonly { readonly host: string; readonly config: string }[] => [
  {
    host: 'Netlify, Cloudflare Pages',
    config: `Nothing to do — the build writes dist/_headers:\n\n${headersFile().trimEnd()}`,
  },
  {
    host: 'Vercel (vercel.json, at the repository root)',
    config: JSON.stringify(
      {
        headers: [
          {
            source: '/(.*)',
            headers: HOST_HEADERS.map(({ name, value }) => ({ key: name, value })),
          },
        ],
      },
      null,
      2,
    ),
  },
  {
    host: 'nginx (inside the server block)',
    config: HOST_HEADERS.map(
      ({ name, value }) => `add_header ${name} "${value}" always;`,
    ).join('\n'),
  },
  {
    host: 'Caddy (inside the site block)',
    config: ['header {', ...HOST_HEADERS.map(({ name, value }) => `  ${name} "${value}"`), '}'].join(
      '\n',
    ),
  },
  {
    host: 'Apache (.htaccess or the vhost)',
    config: HOST_HEADERS.map(({ name, value }) => `Header always set ${name} "${value}"`).join(
      '\n',
    ),
  },
]

/**
 * The deployment note, written from the values above.
 *
 * Generated rather than hand-kept: a page of copy-paste server config is
 * exactly the kind of documentation that goes stale silently, and the failure
 * is a header somebody believes is set and is not.
 */
export const headersDoc = (): string =>
  [
    '# Web host response headers',
    '',
    '<!-- Generated from src/web/headers.ts by src/web/headers.test.ts.',
    '     Run `npm run headers` to rewrite it. Do not edit by hand. -->',
    '',
    'DocFlow carries its whole content security policy inside the built',
    '`index.html`, because the same bundle is served both by a web host and by',
    'Capacitor from the app’s own assets — and a host header can never cover',
    'the second. Two things a `<meta>` policy cannot say have to come from the',
    'host instead:',
    '',
    ...HOST_HEADERS.map((header) => `- **\`${header.name}: ${header.value}\`** — ${header.because}`),
    '',
    'A browser applies the header and the document policy together, so the',
    'header carries only what the document cannot. Sending the full policy',
    'twice would be two copies free to drift.',
    '',
    ...hostSnippets().flatMap(({ host, config }) => [`## ${host}`, '', '```', config, '```', '']),
  ].join('\n')
