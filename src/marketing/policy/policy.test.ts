/**
 * Store-policy verification (§T, §U, §V).
 *
 * The property that matters most here is a negative one: this must never
 * report "verified" on the strength of a checklist somebody ticked once. §U
 * asks for verification **at submission time**, and an answer with no expiry
 * becomes the assumption it warns about — worse than no checklist, because it
 * looks like diligence.
 */

import { describe, expect, it } from 'vitest'

import {
  ALLOWED_DESTINATIONS,
  type CheckResult,
  checkDestinations,
  checkAccountDeletion,
  checkLocalAi,
  checkNoTrackers,
  checkRatingsPrompt,
  runChecks,
} from './checks'
import {
  ANSWERS,
  ANSWER_VALID_DAYS,
  type Answer,
  QUESTIONS,
  SUBMISSION_MARKETS,
  isCurrent,
} from './questions'
import { policyReport, reportOf, required } from './report'

const DAY = 86_400_000
const NOW = new Date('2026-09-13T00:00:00Z')
const daysAgo = (days: number): string => new Date(NOW.getTime() - days * DAY).toISOString()

const answer = (over: Partial<Answer> & Pick<Answer, 'questionId'>): Answer => ({
  answer: 'yes, as configured',
  source: 'https://example.invalid/the-page-actually-read',
  readAt: daysAgo(1),
  readBy: 'a person',
  ...over,
})

const passing: CheckResult[] = [
  { check: 'stub', passed: true, findings: [], declares: 'nothing leaves the device' },
]

describe('It never says verified on an old answer (§U)', () => {
  it('treats an answer older than the window as unanswered', () => {
    const fresh = answer({ questionId: 'apple-privacy-label', readAt: daysAgo(ANSWER_VALID_DAYS - 1) })
    const stale = answer({ questionId: 'apple-privacy-label', readAt: daysAgo(ANSWER_VALID_DAYS + 1) })

    expect(isCurrent(fresh, NOW)).toBe(true)
    expect(isCurrent(stale, NOW)).toBe(false)
  })

  it('says WHEN a stale answer was read, not just that it is stale', () => {
    // A question with no `blockedBy`: a blocked one is reported as blocked
    // whatever its answer's age, which is the point of the third bucket.
    const stale = answer({ questionId: 'apple-steering', market: 'US', readAt: daysAgo(400) })
    const report = policyReport(NOW, [stale], passing)
    const entry = report.open.find(
      (open) => open.question.id === 'apple-steering' && open.market === 'US',
    )

    expect(entry?.why).toBe('answer expired')
    expect(entry?.stale?.readAt).toBe(stale.readAt)
    expect(reportOf(report)).toContain(stale.readAt)
  })

  it('refuses a date in the future', () => {
    // A typo or a lie; either way it must not read as verified.
    const ahead = answer({ questionId: 'apple-privacy-label', readAt: daysAgo(-5) })

    expect(isCurrent(ahead, NOW)).toBe(false)
  })

  it('refuses a date that is not a date', () => {
    expect(isCurrent(answer({ questionId: 'x', readAt: 'soon' }), NOW)).toBe(false)
  })
})

describe('Both halves are required, and neither substitutes for the other', () => {
  it('is not verified with clean code and unread rules', () => {
    const report = policyReport(NOW, [], passing)

    expect(report.codeClean).toBe(true)
    expect(report.verified).toBe(false)
    expect(reportOf(report)).toContain('NOT verified')
  })

  it('is not verified with every rule read and a failing check', () => {
    const all = required().map((entry) =>
      answer({
        questionId: entry.question.id,
        ...(entry.market === undefined ? {} : { market: entry.market }),
      }),
    )
    const failing: CheckResult[] = [
      {
        check: 'destinations',
        passed: false,
        findings: [{ check: 'destinations', severity: 'blocker', detail: 'somewhere new' }],
        declares: 'x',
      },
    ]
    const report = policyReport(NOW, all, failing)

    expect(report.open).toEqual([])
    expect(report.verified).toBe(false)
    expect(reportOf(report)).toContain('code checks are failing')
  })

  it('is verified only when every half holds', () => {
    const all = required().map((entry) =>
      answer({
        questionId: entry.question.id,
        ...(entry.market === undefined ? {} : { market: entry.market }),
        confirmedBy: 'a person',
      }),
    )
    // Blocked questions are blocked by something no answer can supply, so
    // verification is tested against the questions that CAN be answered.
    const answerable = QUESTIONS.filter((question) => question.blockedBy === undefined)
    const report = policyReport(NOW, all, passing, answerable)

    expect(report.verified).toBe(true)
  })

  it('is not verified while an answer has nobody standing behind it', () => {
    const answerable = QUESTIONS.filter((question) => question.blockedBy === undefined)
    const unconfirmed = required(answerable).map((entry) =>
      answer({
        questionId: entry.question.id,
        ...(entry.market === undefined ? {} : { market: entry.market }),
      }),
    )
    const report = policyReport(NOW, unconfirmed, passing, answerable)

    // Read, cited, current — and still not verified. §U asks for a person at
    // submission time, and a fetch is not one.
    expect(report.open).toHaveLength(0)
    expect(report.unconfirmed.length).toBeGreaterThan(0)
    expect(report.verified).toBe(false)
  })

  it('never counts a blocked question as done, however fresh its answer', () => {
    const blocked = QUESTIONS.find((question) => question.blockedBy !== undefined)
    if (blocked === undefined) throw new Error('no blocked question')

    const report = policyReport(
      NOW,
      [answer({ questionId: blocked.id, market: 'US', confirmedBy: 'a person' })],
      passing,
    )

    // The account-deletion rule is read, confirmed, and the app still has no
    // deletion flow. Reading a rule is not meeting it.
    expect(report.blocked.map((entry) => entry.question.id)).toContain(blocked.id)
    expect(report.verified).toBe(false)
  })

  it('does not let one market’s answer cover another’s', () => {
    // §U: the rules "vary by region". An answer read for the US says nothing
    // about Nigeria, and this is the mistake a flat checklist makes.
    const perMarket = QUESTIONS.find(
      (question) => question.perMarket && question.blockedBy === undefined,
    )
    if (perMarket === undefined) throw new Error('no answerable per-market question')

    const report = policyReport(NOW, [answer({ questionId: perMarket.id, market: 'US' })], passing)
    const stillOpen = report.open.filter((open) => open.question.id === perMarket.id)

    expect(stillOpen).toHaveLength(SUBMISSION_MARKETS.length - 1)
    expect(stillOpen.map((open) => open.market)).not.toContain('US')
  })
})

describe('Nothing here states what a store rule is', () => {
  it('asks every question rather than answering it', () => {
    // My knowledge of a store rule has a date on it too, and §U says those
    // rules change frequently. A sentence in this repo asserting one would be
    // the assumption it warns about, in the place people trust most.
    for (const question of QUESTIONS) {
      expect(question.question.trim().endsWith('?'), `${question.id} does not ask`).toBe(true)
      expect(question.lookIn.length, `${question.id} says nowhere to look`).toBeGreaterThan(10)
      expect(question.whatWeDo.length, `${question.id} does not say what we do`).toBeGreaterThan(30)
    }
  })

  it('carries a source and a date on every answer it does record', () => {
    // The answers are no longer empty: the public rules have been read. What
    // must stay true is that none of them was written from memory — every one
    // names the page it came from and the day it was fetched.
    expect(ANSWERS.length).toBeGreaterThan(0)
    for (const recorded of ANSWERS) {
      expect(recorded.source, `${recorded.questionId} cites nothing`).toMatch(/^https:\/\//)
      expect(recorded.readAt, `${recorded.questionId} has no date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(recorded.readBy.length, `${recorded.questionId} has no reader`).toBeGreaterThan(0)
      expect(
        QUESTIONS.some((question) => question.id === recorded.questionId),
        `${recorded.questionId} answers a question that does not exist`,
      ).toBe(true)
    }
  })

  it('leaves the EU storefronts unanswered rather than answering them from the global rule', () => {
    // 3.1.1(a) is written as "the United States, and everywhere else". The EU
    // has its own external-purchase regime under the DMA, and its entitlement
    // page 404s — so FR and ES are open on purpose, not by omission.
    const euAnswers = ANSWERS.filter(
      (recorded) =>
        recorded.questionId === 'apple-steering' &&
        (recorded.market === 'FR' || recorded.market === 'ES'),
    )
    expect(euAnswers).toHaveLength(0)
  })

  it('asks per market where §U says the rules vary', () => {
    for (const id of ['apple-steering', 'apple-subscriptions', 'play-billing']) {
      expect(QUESTIONS.find((question) => question.id === id)?.perMarket, id).toBe(true)
    }
  })
})

describe('What the code says is checked, not remembered', () => {
  it('passes against the repository as it stands, except where it should not', () => {
    const failing = runChecks().filter((check) => !check.passed)

    // Exactly one, and known: there is no account-deletion flow, which Apple
    // 5.1.1(v) requires of any app that offers account creation. Named rather
    // than allowed in bulk, so a new failure still breaks this.
    expect(failing.map((check) => check.check)).toEqual(['account-deletion'])
  })

  it('does not let a check find itself', () => {
    // Both new checks scan `src/` for a string that also appears in their own
    // source. The first version reported that an owner could delete their
    // account "in src/marketing/policy/checks.ts".
    for (const check of [checkAccountDeletion(), checkRatingsPrompt()]) {
      expect(check.declares, check.check).not.toContain('src/marketing/policy/')
    }
  })

  it('fails on a destination nobody declared', () => {
    const result = checkDestinations({
      sources: { 'src/x.ts': "fetch('https://telemetry.example.com/collect')" },
      bundle: '',
    })

    expect(result.passed).toBe(false)
    expect(result.findings[0]?.detail).toContain('telemetry.example.com')
  })

  it('accepts a declared destination that has a literal host', () => {
    const withHosts = ALLOWED_DESTINATIONS.filter((entry) => entry.host !== undefined)

    expect(withHosts.length).toBeGreaterThan(0)
    for (const destination of withHosts) {
      const result = checkDestinations({
        sources: { 'src/x.ts': `https://${destination.host}/path` },
        bundle: '',
      })
      expect(result.passed, destination.host).toBe(true)
    }
  })

  it('declares the destinations that have NO literal host too', () => {
    // The Supabase project is configuration, not a compiled-in host, so the
    // scan cannot see it. A declaration built only from what the scan finds
    // would omit the one destination that actually carries the data.
    const configured = ALLOWED_DESTINATIONS.filter((entry) => entry.host === undefined)

    expect(configured.length).toBeGreaterThan(0)
    const declares = checkDestinations({ sources: {}, bundle: '' }).declares
    for (const destination of configured) expect(declares).toContain(destination.what)
  })

  it('will not grant the test-only exemption without a build to check', () => {
    const sources = { 'src/data/supabase/harness.ts': "createClient('https://stub.supabase.co')" }

    // No bundle: the exemption is unverified, so it is not granted.
    expect(checkDestinations({ sources }).passed).toBe(false)
    // A build that does not contain the host: granted.
    expect(checkDestinations({ sources, bundle: 'var a=1' }).passed).toBe(true)
    // A build that DOES contain it: the arrangement broke, and it is caught.
    const leaked = checkDestinations({ sources, bundle: 'https://stub.supabase.co' })
    expect(leaked.passed).toBe(false)
    expect(leaked.findings[0]?.detail).toContain('in the shipped bundle')
  })

  it('fails on a network call in the AI paths (§N)', () => {
    const clean = checkLocalAi({ 'src/features/ai/extract.ts': 'export const x = 1' })
    const dirty = checkLocalAi({
      'src/features/ai/extract.ts': "await fetch('https://api.example.com/transcribe')",
    })

    expect(clean.passed).toBe(true)
    expect(dirty.passed).toBe(false)
    expect(dirty.findings[0]?.detail).toContain('§N')
  })

  it('fails on an analytics or attribution SDK', () => {
    expect(checkNoTrackers(['react', 'clsx']).passed).toBe(true)
    expect(checkNoTrackers(['react', '@sentry/browser']).passed).toBe(false)
    expect(checkNoTrackers(['react', 'mixpanel-browser']).passed).toBe(false)
  })

  it('declares something a person can put on a form', () => {
    for (const check of runChecks()) {
      expect(check.declares.length, `${check.check} declares nothing`).toBeGreaterThan(20)
    }
  })
})
