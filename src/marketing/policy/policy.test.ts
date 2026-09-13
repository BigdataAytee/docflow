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
  checkLocalAi,
  checkNoTrackers,
  runChecks,
} from './checks'
import {
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
    const stale = answer({ questionId: 'apple-privacy-label', readAt: daysAgo(400) })
    const report = policyReport(NOW, [stale], passing)
    const entry = report.open.find((open) => open.question.id === 'apple-privacy-label')

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

  it('is verified only when both halves hold', () => {
    const all = required().map((entry) =>
      answer({
        questionId: entry.question.id,
        ...(entry.market === undefined ? {} : { market: entry.market }),
      }),
    )
    const report = policyReport(NOW, all, passing)

    expect(report.verified).toBe(true)
  })

  it('does not let one market’s answer cover another’s', () => {
    // §U: the rules "vary by region". An answer read for the US says nothing
    // about Nigeria, and this is the mistake a flat checklist makes.
    const perMarket = QUESTIONS.find((question) => question.perMarket)
    if (perMarket === undefined) throw new Error('no per-market question')

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

  it('records no answers, because nobody has read a rule', () => {
    const report = policyReport(NOW, undefined, passing)

    expect(report.open).toHaveLength(required().length)
    for (const entry of report.open) expect(entry.why).toBe('never answered')
  })

  it('asks per market where §U says the rules vary', () => {
    for (const id of ['apple-steering', 'apple-subscriptions', 'play-billing']) {
      expect(QUESTIONS.find((question) => question.id === id)?.perMarket, id).toBe(true)
    }
  })
})

describe('What the code says is checked, not remembered', () => {
  it('passes against the repository as it stands', () => {
    for (const check of runChecks()) {
      expect(check.passed, `${check.check}: ${check.findings.map((f) => f.detail).join('; ')}`).toBe(
        true,
      )
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
