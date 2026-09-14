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
import { join } from 'node:path'

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
]

const HOST_PATTERN = /https?:\/\/([a-z0-9.-]+)/gi

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
    ALLOWED_DESTINATIONS.flatMap((entry) => (entry.host === undefined ? [] : [entry.host])),
  )

  for (const [file, contents] of Object.entries(inputs.sources)) {
    for (const match of contents.matchAll(HOST_PATTERN)) {
      const host = (match[1] ?? '').toLowerCase()
      if (NOT_A_DESTINATION.includes(host)) continue
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

export function checkRatingsPrompt(files = trackedFiles(/^src\/.*\.tsx?$/)): CheckResult {
  const found = files
    .filter((file) => !isTest(file) && !isAboutTheApp(file))
    .filter((file) => /requestReview|SKStoreReview|AppStore\.requestReview/.test(read(file)))

  return {
    check: 'ratings-prompt',
    passed: true,
    findings:
      found.length > 0
        ? []
        : [
            {
              check: 'ratings-prompt',
              severity: 'note' as const,
              detail:
                'no ratings prompt in src/. §T wants one at a happy moment; there is nothing ' +
                'to time, and nothing that could breach a store rule about timing either',
            },
          ],
    // Not a blocker: no store requires an app to ASK for ratings. It passes
    // because an app with no prompt cannot prompt at the wrong moment — but
    // the declaration says so plainly rather than letting silence imply one
    // exists.
    declares:
      found.length > 0
        ? `A ratings prompt exists (${found.join(', ')}) and its timing needs checking.`
        : 'There is no ratings prompt. §T asks for one; nothing is shipped, so nothing is timed wrongly.',
  }
}

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
