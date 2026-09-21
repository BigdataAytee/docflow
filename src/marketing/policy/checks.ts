/**
 * What a store review will test, checked against the code rather than
 * remembered (§T "store-policy verification at submission time", §V).
 *
 * **This file states no store rule.** §U is explicit: "store steering /
 * external-purchase policies change frequently and vary by region — verify the
 * current rules at submission time in each store market rather than assuming
 * today's." A checklist that said "Apple requires X" would be exactly that
 * assumption, written down and then trusted for a year.
 *
 * So the work splits. The current text of any rule is a question for a person,
 * and lives in `questions.ts` with a date and a source against it. What lives
 * HERE is the other half: facts about DocFlow that a reviewer or a data-safety
 * form will ask about, checked against the repository — because the rejection
 * that actually happens is not "we misread the rule", it is a privacy
 * declaration that does not match what the binary does.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { ALL_PROVIDERS } from '../../domain/payments/providers'
import { PROVIDER_LOGOS } from '../../features/payments/logos'
import { join } from 'node:path'

import { PLACEHOLDERS, unfilled } from '../../legal/placeholders'
import { VALUES_FILE, missingValues } from '../../legal/values'
import { legalPages } from '../legalPages'

export type Severity = 'blocker' | 'note'

export interface Finding {
  readonly check: string
  readonly severity: Severity
  readonly detail: string
}

export interface CheckResult {
  readonly check: string
  readonly passed: boolean
  readonly findings: readonly Finding[]
  /** What a person would write on a store form, given this result. */
  readonly declares: string
}

const root = (): string => process.cwd()

/** Tracked source files, so a scan cannot miss a file nobody built. */
export function trackedFiles(pattern: RegExp): string[] {
  const out = execFileSync('git', ['ls-files'], { cwd: root(), encoding: 'utf8' })
  return out.split('\n').filter((file) => file !== '' && pattern.test(file))
}

const read = (file: string): string => readFileSync(join(root(), file), 'utf8')

const isTest = (file: string): boolean => /\.test\.[tj]sx?$/.test(file)

/**
 * Every destination the app can reach, enumerated from source.
 *
 * Both store forms — Apple's privacy nutrition label and Play's Data Safety
 * section — are declarations about where data goes, and both are checked
 * against the binary. Deriving the list from the code means the form is filled
 * from evidence; keeping it as an allowlist means a NEW destination fails here
 * rather than being discovered by a reviewer.
 */
export interface Destination {
  readonly what: string
  readonly why: string
  /**
   * The hostname as it appears in source, when it appears at all.
   *
   * Most of these have none, and that is the substantive point rather than an
   * implementation detail: the Supabase project is configuration, supplied per
   * install through `VITE_SUPABASE_URL`, so **no default host is compiled into
   * the app**. A scan for literal hostnames therefore cannot find it — which
   * is why the declaration below names it in words and the scan only polices
   * the literals.
   */
  readonly host?: string
}

export const ALLOWED_DESTINATIONS: readonly Destination[] = [
  {
    what: 'the company’s own Supabase project',
    why: 'sync and sign-in (§C, §Q Phase 5). Configured per install; no default host is compiled in.',
  },
  {
    what: 'the public-link edge function on that same project',
    why: 'a customer opening a shared document (§P). Same origin as above, and no separate host.',
  },
  {
    what: 'wa.me',
    why:
      'a WhatsApp share the USER taps. It is a link, not a request: no data is sent ' +
      'until they act, and nothing is sent to DocFlow.',
    host: 'wa.me',
  },
  /*
   * THE PAYMENT PROVIDERS, WHICH THE APP NEVER CONTACTS (§J).
   *
   * Exactly `wa.me`'s case, and declared the same way rather than added to
   * `NOT_A_DESTINATION` — because a reviewer who sees `paypal.me` inside the
   * app deserves the answer in the privacy declaration, not an exemption
   * buried in a scanner.
   *
   * What these are: an address the TRADER pasted in, printed on their
   * invoice, read by their customer. DocFlow makes no request to any of them,
   * holds no key for any of them and has no SDK from any of them. Nothing
   * leaves the device to reach one; a customer types it into their own
   * browser off a piece of paper.
   *
   * DERIVED FROM `PROVIDERS`, so this list cannot fall behind the app's. A
   * provider added tomorrow is declared by having been added — which is the
   * same "declared once, read by both" §J applies to the field sets.
   */
  /*
   * BRAND-GUIDELINES PAGES, RECORDED AS PROVENANCE (§F).
   *
   * `logos.ts` notes where each provider publishes its own rules for using
   * its mark, so the next person can re-check them. DocFlow never opens one:
   * they are citations in a data file, the same kind of thing a footnote is.
   *
   * Declared rather than exempted, and derived from the same map the app
   * reads, so a provider added tomorrow is covered by having been added.
   */
  ...Object.values(PROVIDER_LOGOS).flatMap((logo) => {
    if (logo?.guidelines === undefined) return []
    const host = logo.guidelines.replace(/^https?:\/\//, '').split('/')[0] ?? ''
    return host === ''
      ? []
      : [
          {
            what: host,
            why: 'a brand-guidelines page recorded as provenance for a bundled mark. Never opened by the app; a citation, not a request.',
            host,
          },
        ]
  }),
  ...ALL_PROVIDERS.flatMap((provider) => {
    const host = provider.prefix.split('/')[0] ?? ''
    return host === ''
      ? []
      : [
          {
            what: host,
            why:
              `a ${provider.name} payment address the trader pasted in, printed on their ` +
              'invoice. A link, not a request: DocFlow never contacts it and sends it nothing.',
            host,
          },
        ]
  }),
]

const HOST_PATTERN = /https?:\/\/([a-z0-9.-]+)/gi

/**
 * One spelling per host, on BOTH sides of every comparison.
 *
 * `www.paypal.me` and `paypal.me` are one destination by definition, and
 * treating them as two meant a declared host could be flagged for whichever
 * spelling somebody happened to copy. Normalising only the scanned side was
 * worse than not doing it at all: it silently broke the `www.w3.org`
 * exemption that had worked since this check was written, and the failure
 * looked exactly like a real finding.
 */
const bareHost = (value: string): string => value.toLowerCase().replace(/^www\./, '')

/**
 * Files that name a host but never reach a user.
 *
 * `harness.ts` builds a real Supabase client over a transport the tests own,
 * pointed at a hostname that does not exist. It is in `src/` and is not named
 * `.test.ts`, so the scan finds it — correctly, because "only tests import it"
 * is an arrangement, and this whole check exists because arrangements rot.
 *
 * So the exemption is EARNED rather than declared: the host must be absent
 * from the built bundle. Without a build to check against, the exemption is
 * not granted — a scan that trusts a list is the scan that misses the day
 * somebody imports the harness from a screen.
 */
const TEST_ONLY = ['src/data/supabase/harness.ts']

/**
 * This directory TALKS ABOUT the app; it is not the app.
 *
 * Two things went wrong the moment the questionnaire started citing real
 * pages, and both are the same mistake from opposite ends. The destination
 * scan read `developer.apple.com` in a citation as somewhere the app sends
 * data. And the account-deletion check found the word `deleteAccount` — in
 * its own regex, one file away — and declared that an owner can delete their
 * account "in src/marketing/policy/checks.ts".
 *
 * A check that can find itself is not a check. Nothing in here is imported by
 * `src/main.tsx`, and the bundle exemption below is what proves it rather
 * than this comment.
 */
const ABOUT_THE_APP = 'src/marketing/policy/'

const isAboutTheApp = (file: string): boolean => file.startsWith(ABOUT_THE_APP)

/** Hosts that are documentation or markup namespaces, not destinations. */
const NOT_A_DESTINATION = [
  'schema.org',
  'www.w3.org',
  'www.sitemaps.org',
  'developer.mozilla.org',
  'docflow.app',
  'www.docflow.app',
  'claude.ai',
  'claude.com',
  'localhost',
  '127.0.0.1',
]

export interface DestinationInputs {
  /** file path -> contents, for everything shipped from `src/`. */
  readonly sources: Readonly<Record<string, string>>
  /** The built bundle, concatenated. Absent means "no build to check against". */
  readonly bundle?: string
}

export function readDestinationInputs(): DestinationInputs {
  const sources: Record<string, string> = {}
  for (const file of trackedFiles(/^src\/.*\.tsx?$/)) {
    if (!isTest(file)) sources[file] = read(file)
  }
  return { sources, ...(bundleText() === undefined ? {} : { bundle: bundleText() as string }) }
}

export function checkDestinations(inputs = readDestinationInputs()): CheckResult {
  const findings: Finding[] = []
  const allowed = new Set<string>(
    ALLOWED_DESTINATIONS.flatMap((entry) =>
      entry.host === undefined ? [] : [bareHost(entry.host)],
    ),
  )

  for (const [file, contents] of Object.entries(inputs.sources)) {
    for (const match of contents.matchAll(HOST_PATTERN)) {
      /*
       * `www.` IS NOT A DIFFERENT DESTINATION. `www.paypal.me` and
       * `paypal.me` are one host by definition, and treating them as two
       * meant a declared destination could be flagged for the spelling
       * somebody happened to copy — which is a false alarm, and a check that
       * cries wolf is one people learn to ignore.
       */
      const host = bareHost(match[1] ?? '')
      if (NOT_A_DESTINATION.map(bareHost).includes(host)) continue
      if (allowed.has(host)) continue

      if (TEST_ONLY.includes(file) || isAboutTheApp(file)) {
        // The exemption, earned against the build rather than asserted.
        if (inputs.bundle === undefined) {
          findings.push({
            check: 'destinations',
            severity: 'blocker',
            detail:
              `${file} names ${host} and is exempt as documentation, but there is no build ` +
              'to check that against — run the build first; an unverified exemption is ' +
              'the same as no check',
          })
          continue
        }
        if (!inputs.bundle.includes(host)) continue
        findings.push({
          check: 'destinations',
          severity: 'blocker',
          detail: `${file} is exempt as documentation, but ${host} is in the shipped bundle`,
        })
        continue
      }

      findings.push({
        check: 'destinations',
        severity: 'blocker',
        detail:
          `${file} names ${host}, which is not in the declared destination list — ` +
          'a destination the privacy declaration does not mention is the mismatch ' +
          'that gets an app rejected',
      })
    }
  }

  return {
    check: 'destinations',
    passed: findings.length === 0,
    findings,
    declares:
      'Data leaves the device only to: ' +
      ALLOWED_DESTINATIONS.map((entry) => entry.what).join('; ') +
      '.',
  }
}

/**
 * §N: local AI, with no cloud calls and no silent online fallback.
 *
 * This is not a policy question — it is a claim DocFlow makes, which the store
 * listing and the privacy form will both repeat, and which a reviewer with a
 * proxy can check in a minute. So it is checked here: the AI paths must
 * contain no network primitive at all.
 */
export function readAiSources(): Readonly<Record<string, string>> {
  const sources: Record<string, string> = {}
  for (const file of trackedFiles(/^src\/features\/ai\/.*\.tsx?$/)) {
    if (!isTest(file)) sources[file] = read(file)
  }
  return sources
}

export function checkLocalAi(sources = readAiSources()): CheckResult {
  const findings: Finding[] = []
  const NETWORK = /\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|EventSource)\b/

  for (const [file, contents] of Object.entries(sources)) {
    const match = NETWORK.exec(contents)
    if (match !== null) {
      findings.push({
        check: 'local-ai',
        severity: 'blocker',
        detail: `${file} reaches the network with ${match[1]} — §N forbids a cloud call or a silent online fallback`,
      })
    }
  }

  return {
    check: 'local-ai',
    passed: findings.length === 0,
    findings,
    declares: 'Voice, scan and extraction run on the device. No audio, image or text is uploaded.',
  }
}

/**
 * No analytics, attribution or advertising SDK.
 *
 * Play's Data Safety form and Apple's label both ask, and a third-party SDK
 * collects on its own schedule whatever the app intended. Checked against the
 * dependency list rather than against a memory of what was installed.
 */
const TRACKING_PACKAGES = [
  'firebase',
  '@firebase',
  'analytics',
  'amplitude',
  'mixpanel',
  'segment',
  '@segment',
  'posthog',
  'sentry',
  '@sentry',
  'appsflyer',
  'adjust',
  'branch-sdk',
  'facebook',
  'react-ga',
  'gtag',
]

export function readDependencies(): readonly string[] {
  const manifest = JSON.parse(read('package.json')) as {
    dependencies?: Record<string, string>
  }
  return Object.keys(manifest.dependencies ?? {})
}

export function checkNoTrackers(deps = readDependencies()): CheckResult {
  const findings: Finding[] = deps
    .filter((name) => TRACKING_PACKAGES.some((bad) => name.toLowerCase().includes(bad)))
    .map((name) => ({
      check: 'no-trackers',
      severity: 'blocker' as const,
      detail: `${name} is a runtime dependency, and it collects on its own schedule`,
    }))

  return {
    check: 'no-trackers',
    passed: findings.length === 0,
    findings,
    declares: `No analytics, attribution or advertising SDK. Runtime dependencies: ${deps.join(', ')}.`,
  }
}

/** The built app, concatenated, or `undefined` when nothing has been built. */
export function bundleText(): string | undefined {
  const dir = join(root(), 'dist', 'assets')
  if (!existsSync(dir)) return undefined
  return readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n')
}

/**
 * Does the app have the two things a store REQUIRES of it, rather than
 * forbids?
 *
 * Every other check in this file asks whether the repository contains
 * something it claims not to. These two ask the opposite, and they exist
 * because reading the rules found the questionnaire describing features that
 * are not there: "an owner can delete their account in Settings" and "the
 * ratings prompt fires after a successful share". Neither was ever built.
 *
 * Apple 5.1.1(v) makes in-app account deletion mandatory for any app that
 * offers account creation, so the first of those is a submission blocker and
 * not a nicety. A questionnaire that describes a feature nobody wrote is
 * worse than a blank one: it reads as diligence.
 */
export function checkAccountDeletion(
  files = trackedFiles(/^src\/.*\.tsx?$/),
): CheckResult {
  const found = files
    .filter((file) => !isTest(file) && !isAboutTheApp(file))
    .filter((file) => /deleteAccount|deleteCompany|closeAccount/.test(read(file)))

  return {
    check: 'account-deletion',
    passed: found.length > 0,
    findings:
      found.length > 0
        ? []
        : [
            {
              check: 'account-deletion',
              severity: 'blocker' as const,
              detail:
                'no account-deletion flow in src/. Apple 5.1.1(v) requires one in-app for any ' +
                'app that offers account creation; export alone (Rule #6) does not satisfy it',
            },
          ],
    declares:
      found.length > 0
        ? `An owner can delete their account in the app (${found.join(', ')}).`
        : 'There is NO in-app account deletion. An iOS submission is blocked until there is.',
  }
}

/**
 * Source with its comments removed.
 *
 * Learned twice now. A scan that reads prose finds the word it is looking for
 * in the sentence explaining why the word is not there: this file's own
 * `deleteAccount` regex, and — the moment the review port was written —
 * "StoreKit's `requestReview`" in a comment describing what Phase 4 will
 * call. A check a comment can satisfy is not a check.
 */
export function codeOnly(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')
    })
    .join('\n')
}

/**
 * Is there a ratings prompt, and can anything show it?
 *
 * Two different questions, and conflating them is how "we have a prompt"
 * comes to mean "a prompt appears". §T asks for a prompt at a happy moment;
 * §N asks that an unavailable capability be stated plainly. Both are answered
 * separately here, and the declaration says both out loud.
 *
 * Not a blocker either way: no store requires an app to ask for ratings, and
 * an app with no platform to ask through cannot ask at the wrong moment.
 */
export function checkRatingsPrompt(files = trackedFiles(/^src\/.*\.tsx?$/)): CheckResult {
  const source = files
    .filter((file) => !isTest(file) && !isAboutTheApp(file))
    .map((file) => ({ file, code: codeOnly(read(file)) }))

  // Wired: a screen reports a moment, and the decision runs.
  const wired = source
    .filter(({ file }) => !file.startsWith('src/features/ratings/'))
    .filter(({ code }) => /\bmaybeAskForReview\b|\buseReview\b/.test(code))
    .map(({ file }) => file)

  // Showable: some port can actually reach a platform review API.
  const platform = source
    .filter(({ code }) => /\brequestReview\b|\bSKStoreReview\b|\bInAppReview\b/.test(code))
    .map(({ file }) => file)

  const findings: Finding[] =
    wired.length > 0
      ? []
      : [
          {
            check: 'ratings-prompt',
            severity: 'note' as const,
            detail:
              'no ratings prompt is wired to any moment. §T asks for one at a happy moment; ' +
              'there is nothing to time, and nothing that could breach a rule about timing',
          },
        ]

  return {
    check: 'ratings-prompt',
    passed: true,
    findings,
    declares:
      wired.length === 0
        ? 'There is no ratings prompt. §T asks for one; nothing is shipped, so nothing is timed wrongly.'
        : `A ratings prompt is wired to a happy moment (${wired.join(', ')}). ` +
          (platform.length > 0
            ? `A platform can show it (${platform.join(', ')}), so its timing and frequency need checking against the current rules.`
            : 'NO platform can show it yet — the web has no review API and Phase 4 has not shipped — so nothing is shown to anybody today.'),
  }
}

/**
 * No policy reaches a reader with a business fact still blank (§U, §P).
 *
 * `placeholders.ts` declares the eight facts nobody here may invent, and the
 * documents carry `[[TOKEN]]` until somebody fills them. Nothing checked that
 * they HAD been: the emitted site shipped a privacy policy reading "write to
 * [[SUPPORT_EMAIL]]", which is not an address, on the page a store reviewer
 * opens and a customer uses to exercise a data right.
 *
 * A BLOCKER, not a note. Every other unfinished thing here degrades what the
 * app can claim; this one publishes a legal document that is visibly
 * unfinished, under a company's own name.
 *
 * It reads the RENDERED pages rather than the source, because filling happens
 * at render: checking `documents.ts` would report tokens that were about to
 * be replaced, and checking nothing at all is where this started.
 */
export function checkLegalPlaceholders(
  pages: readonly { readonly path: string; readonly contents: string }[] = legalPages(),
): CheckResult {
  const findings: Finding[] = pages.flatMap((page) =>
    unfilled(page.contents).map((token) => ({
      check: 'legal-placeholders',
      severity: 'blocker' as const,
      detail: `${page.path} still says [[${token}]] — ${
        PLACEHOLDERS.find((placeholder) => placeholder.token === token)?.what ?? 'unknown fact'
      }`,
    })),
  )

  const missing = missingValues()
  return {
    check: 'legal-placeholders',
    passed: findings.length === 0,
    findings,
    declares:
      findings.length === 0
        ? 'The published policy, terms and storage note carry no unfilled business facts.'
        : `${missing.length} of ${PLACEHOLDERS.length} business facts are unanswered. Put them in ${VALUES_FILE}: ${missing
            .map((placeholder) => placeholder.token)
            .join(', ')}.`,
  }
}

/*
 * NOT IN `CHECKS`, and the distinction is the point.
 *
 * `codeClean` means the code is doing what it claims, and every check in that
 * list is something this repository can fix. No amount of code can invent a
 * registered address — so listing it there would hold `npm run verify` red
 * forever on work that is not the code's to do, and a permanently red gate is
 * a gate people learn to skip.
 *
 * It is reported as awaiting a PERSON, beside the store questions nobody has
 * signed off, and it still keeps `verified` false. The hard refusal lives
 * where publishing happens: `legalPages` will not render a page carrying an
 * unfilled token into the emitted site.
 */
export const CHECKS = [
  checkDestinations,
  checkLocalAi,
  checkNoTrackers,
  checkAccountDeletion,
  checkRatingsPrompt,
]

export function runChecks(): readonly CheckResult[] {
  return CHECKS.map((check) => check())
}
