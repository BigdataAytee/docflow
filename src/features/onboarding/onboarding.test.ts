/**
 * Onboarding (§R) — sample records, the checklist, and business setup.
 */

import { describe, expect, it } from 'vitest'

import { money } from '../../domain/money/money'
import { outstandingByCurrency, type StatDocument } from '../home/stats'
import { SampleError, assertNotSample, isSample, realOnly, samplesOnly } from './sample'
import { type OnboardingState, checklist, remainingCount, shouldShowChecklist } from './checklist'
import {
  type SetupState,
  SetupError,
  completeBusinessStep,
  completeStep,
  deferStep,
  emptySetup,
  isSetupComplete,
  resumeAt,
} from './setup'

const NGN = (m: number) => money('NGN', m)

describe('Sample money never enters a real account (§R)', () => {
  const records = [
    { id: 'real-1' },
    { id: 'sample-1', isSample: true },
    { id: 'real-2' },
  ]

  it('separates samples from real records', () => {
    expect(realOnly(records).map((r) => r.id)).toEqual(['real-1', 'real-2'])
    expect(samplesOnly(records).map((r) => r.id)).toEqual(['sample-1'])
  })

  it('treats an absent flag as real — nothing is a sample by accident', () => {
    expect(isSample({ id: 'x' })).toBe(false)
    expect(isSample({ id: 'x', isSample: false })).toBe(false)
  })

  it('keeps a sample invoice out of Outstanding (§R, §G)', () => {
    const documents: (StatDocument & { isSample?: boolean })[] = [
      { id: 'i1', type: 'invoice', status: 'issued', total: NGN(145_000_00) },
      { id: 'sample', type: 'invoice', status: 'issued', total: NGN(999_000_00), isSample: true },
    ]
    // The figures are fed through realOnly, so the seeded money cannot reach
    // a balance even though the sample is a perfectly valid issued invoice.
    expect(outstandingByCurrency(realOnly(documents), []).get('NGN')).toEqual(NGN(145_000_00))
    expect(outstandingByCurrency(documents, []).get('NGN')).toEqual(NGN(1_144_000_00))
  })

  it('refuses to issue a sample at all', () => {
    expect(() => assertNotSample({ id: 's', isSample: true }, 'issued')).toThrow(SampleError)
    expect(() => assertNotSample({ id: 'r' }, 'issued')).not.toThrow()
  })
})

describe('The checklist ticks itself (§R)', () => {
  const base: OnboardingState = {
    companyName: '',
    region: 'NG',
    hasLogo: false,
    enabledPaymentMethodCount: 0,
    realDocumentCount: 0,
    dismissed: false,
  }

  it('is derived from state, with no separate done flag to set', () => {
    expect(checklist(base).every((item) => !item.done)).toBe(true)

    const progressed = { ...base, companyName: 'Dynamic Renaissance', hasLogo: true }
    const items = checklist(progressed)
    expect(items.find((i) => i.id === 'business_details')?.done).toBe(true)
    expect(items.find((i) => i.id === 'logo')?.done).toBe(true)
    expect(items.find((i) => i.id === 'payment')?.done).toBe(false)
  })

  it('ticks the first-document item only for a real document (§R)', () => {
    // A sample must not tick it — the user has not yet made anything.
    expect(checklist({ ...base, realDocumentCount: 0 }).find((i) => i.id === 'first_document')?.done).toBe(false)
    expect(checklist({ ...base, realDocumentCount: 1 }).find((i) => i.id === 'first_document')?.done).toBe(true)
  })

  it('disappears once everything is done', () => {
    const finished: OnboardingState = {
      ...base,
      companyName: 'Dynamic Renaissance',
      hasLogo: true,
      enabledPaymentMethodCount: 1,
      realDocumentCount: 1,
    }
    expect(shouldShowChecklist(finished)).toBe(false)
    expect(remainingCount(finished)).toBe(0)
  })

  it('respects a dismissal even with work outstanding (§R)', () => {
    expect(shouldShowChecklist({ ...base, dismissed: true })).toBe(false)
  })
})

describe('Business setup asks for two things (§R, Rule #1)', () => {
  const start = (): SetupState => emptySetup('NG')

  it('pre-fills the country from the phone rather than asking', () => {
    expect(start().region).toBe('NG')
  })

  it('is complete once the business step is done', () => {
    const done = completeBusinessStep(start(), 'Dynamic Renaissance Business Enterprises Ltd')
    expect(isSetupComplete(done)).toBe(true)
  })

  it('refuses an empty business name — it prints on every document', () => {
    expect(() => completeBusinessStep(start(), '   ')).toThrow(SetupError)
  })

  /*
   * CHANGED DELIBERATELY. This asserted that setting up a business in Japan
   * THREW, because §W held unvalidated markets closed. The refusal was real,
   * and so was its cost: the country was not in the dropdown, and choosing it
   * failed. §W's guarantee is about terminology — `regionIsComplete` still
   * reports which markets have a signed-off table — not about whether someone
   * abroad may invoice at all.
   */
  it('sets a business up in a market nobody has validated yet (§W)', () => {
    expect(() => completeBusinessStep(emptySetup('JP'), 'Some Ltd')).not.toThrow()
  })

  /** A malformed country is still a bug, and still refused. */
  it('refuses something that is not a country code', () => {
    expect(() => completeBusinessStep(emptySetup('Japan'), 'Some Ltd')).toThrow()
  })

  it('lets logo, address, payment and signature be put off (§R)', () => {
    let state = completeBusinessStep(start(), 'Dynamic Renaissance')
    for (const step of ['logo', 'address', 'payment', 'signature'] as const) {
      state = deferStep(state, step)
    }
    expect(isSetupComplete(state)).toBe(true)
    expect(resumeAt(state)).toBeNull()
  })

  it('will not let the business step be put off', () => {
    expect(() => deferStep(start(), 'business')).toThrow(SetupError)
  })

  it('resumes where it left off after a restart (§R)', () => {
    expect(resumeAt(start())).toBe('business')

    const named = completeBusinessStep(start(), 'Dynamic Renaissance')
    expect(resumeAt(named)).toBe('logo')

    const skippedLogo = deferStep(named, 'logo')
    expect(resumeAt(skippedLogo)).toBe('address')
  })

  it('clears a deferral when the step is finished later', () => {
    const deferred = deferStep(completeBusinessStep(start(), 'Ltd'), 'logo')
    const done = completeStep(deferred, 'logo')
    expect(done.deferred).not.toContain('logo')
    expect(done.completed).toContain('logo')
  })
})
