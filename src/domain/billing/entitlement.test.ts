/**
 * What this company is entitled to, offline (§U, Rule #6).
 */

import { describe, expect, it } from 'vitest'

import {
  type CachedEntitlement,
  NEVER_GATED,
  allowed,
  noticeFor,
  standing,
} from './entitlement'
import { SPLIT, proFeatures } from './split'

const NOW = new Date('2026-09-14T09:00:00.000Z')
const at = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString()

const pro = (over: Partial<CachedEntitlement> = {}): CachedEntitlement => ({
  plan: 'pro',
  validUntil: at(10),
  graceUntil: at(24),
  signedPayload: 'signed.by.the.server',
  ...over,
})

describe('Where a device stands, with no network', () => {
  it('is Pro while the paid period runs', () => {
    expect(standing(pro(), NOW)).toEqual({ plan: 'pro', standing: 'active' })
  })

  it('keeps Pro through the grace window, and says when it ends', () => {
    // §U: an ordinary offline stretch must never downgrade somebody
    // mid-document.
    const past = pro({ validUntil: at(-1) })
    expect(standing(past, NOW)).toEqual({
      plan: 'pro',
      standing: 'grace',
      graceEndsAt: past.graceUntil,
    })
  })

  it('degrades to Free past grace, and never to locked', () => {
    const spent = pro({ validUntil: at(-30), graceUntil: at(-16) })
    expect(standing(spent, NOW)).toEqual({ plan: 'free', standing: 'lapsed' })
    expect(noticeFor(standing(spent, NOW))).toBe('lapsed')
  })

  it('is Free when there is no cache at all, never optimistic', () => {
    // Guessing Pro would hand a paid plan to anybody who corrupted a file.
    // Guessing Free costs a feature until the next refresh.
    expect(standing(null, NOW)).toEqual({ plan: 'free', standing: 'free' })
  })

  it('is Free when the payload carries no signature', () => {
    expect(standing(pro({ signedPayload: '' }), NOW)).toEqual({ plan: 'free', standing: 'free' })
    expect(standing(pro({ signedPayload: '   ' }), NOW)).toEqual({ plan: 'free', standing: 'free' })
  })

  it('is Free when the dates are nonsense rather than Pro forever', () => {
    const broken = pro({ validUntil: 'sometime', graceUntil: 'later' })
    expect(standing(broken, NOW).plan).toBe('free')
  })

  it('says nothing at all while somebody is simply paid up', () => {
    expect(noticeFor(standing(pro(), NOW))).toBe('none')
    expect(noticeFor(standing(null, NOW))).toBe('none')
  })
})

describe('What no plan may ever gate (Rule #6)', () => {
  it('allows every never-gated feature, on any plan, even lapsed', () => {
    const lapsed = standing(pro({ validUntil: at(-30), graceUntil: at(-16) }), NOW)

    for (const feature of NEVER_GATED) {
      // Even when somebody has explicitly listed it as Pro: the check runs
      // before the plan is read, so a future edit cannot reach these.
      expect(allowed(feature, lapsed, [feature]), feature).toBe(true)
      expect(allowed(feature, { plan: 'free', standing: 'free' }, [...NEVER_GATED]), feature).toBe(
        true,
      )
    }
  })

  it('names the six things §U and Rule #6 protect', () => {
    // A list rather than a convention, so the day somebody proposes gating
    // export "just for trials" the change lands here, in front of the rule.
    expect([...NEVER_GATED].sort()).toEqual([
      'delete_account',
      'export_archive',
      'record_payment',
      'render_pdf',
      'share_document',
      'view_document',
    ])
  })
})

describe('The Free/Pro line, which nobody has drawn yet (§W)', () => {
  it('gates nothing while the split is undecided', () => {
    // §W still lists the split under decisions requiring evidence, so
    // everything answers Free — which is also what §U asks for until billing
    // exists.
    expect(SPLIT.reviewStatus).toBe('undecided')
    expect(proFeatures()).toEqual([])
    expect(allowed('statements', { plan: 'free', standing: 'free' }, proFeatures())).toBe(true)
  })

  it('ignores a list filled in without the decision being recorded', () => {
    // The two have to move together, and the direction they fail in is free.
    expect(proFeatures({ reviewStatus: 'undecided', proFeatures: ['statements'] })).toEqual([])
    expect(proFeatures({ reviewStatus: 'recorded', proFeatures: ['statements'] })).toEqual([
      'statements',
    ])
  })

  it('gates a Pro feature once the line is recorded, and only then', () => {
    const line = proFeatures({ reviewStatus: 'recorded', proFeatures: ['statements'] })
    expect(allowed('statements', { plan: 'free', standing: 'free' }, line)).toBe(false)
    expect(allowed('statements', { plan: 'pro', standing: 'active' }, line)).toBe(true)
    expect(allowed('customers', { plan: 'free', standing: 'free' }, line)).toBe(true)
  })
})
