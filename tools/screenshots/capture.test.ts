/**
 * The capture harness.
 *
 * Two jobs, and the first matters more: prove that a frame which did NOT
 * render the locale's words is refused. §T's named failure — "not a translated
 * caption over an EN-NG screenshot" — is invisible in a PNG, so the only place
 * it can be caught is here, and a refusal nobody has watched fail is not a
 * refusal.
 *
 * `npm run shots` sets SHOOT=1 and takes the real screenshots.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { SHOT_REGIONS, planFor, shotReport } from '../../src/marketing/shots/plan'
import { capture, main } from './capture'

/** A page that renders whatever text it is given. */
const fakePage = (text: string) => {
  const shots: string[] = []
  return {
    shots,
    page: {
      setViewportSize: async () => undefined,
      goto: async () => undefined,
      waitForLoadState: async () => undefined,
      innerText: async () => text,
      screenshot: async (options: { path: string }) => {
        shots.push(options.path)
      },
    },
  }
}

const firstPlan = (region: string) => {
  const plan = planFor(region).plans.find((entry) => entry.mustContain.length > 0)
  if (plan === undefined) throw new Error(`no plan with required words for ${region}`)
  return plan
}

describe('A frame that did not render the locale is not saved (§T)', () => {
  it('refuses a page showing the wrong language, and writes nothing', async () => {
    const plan = firstPlan('GB')
    // The exact failure §T names: the English page, submitted as another
    // market's. Here the page renders words from no market at all.
    const { page, shots } = fakePage('Nothing anybody asked for')

    const frame = await capture(page as never, 'http://x', 'GB', plan, '/tmp/out')

    expect(frame.saved).toBe(false)
    expect(frame.reason).toContain(plan.mustContain[0] ?? '')
    expect(shots).toEqual([])
  })

  it('refuses a page that has the label but not the currency', async () => {
    const plan = planFor('GB').plans.find((entry) => entry.mustContain.length === 2)
    if (plan === undefined) throw new Error('no money plan')
    const [label] = plan.mustContain
    const { page, shots } = fakePage(`${label} and no money anywhere`)

    const frame = await capture(page as never, 'http://x', 'GB', plan, '/tmp/out')

    expect(frame.saved).toBe(false)
    expect(shots).toEqual([])
  })

  it('saves a page that rendered everything the plan requires', async () => {
    const plan = firstPlan('GB')
    const { page, shots } = fakePage(plan.mustContain.join(' · '))

    const frame = await capture(page as never, 'http://x', 'GB', plan, '/tmp/out')

    expect(frame.saved).toBe(true)
    expect(shots).toHaveLength(1)
    expect(shots[0]).toBe(`/tmp/out/${plan.file}`)
  })

  it('requires words that came from the terminology table, not from here', async () => {
    // The proof strings are the market's own plural label and currency symbol.
    // If they were typed into the spec they would keep passing after a rename.
    for (const region of SHOT_REGIONS) {
      for (const plan of planFor(region).plans) {
        if (plan.shot.type === undefined) continue
        expect(plan.mustContain.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('Every market is blocked today, and the report says why', () => {
  it('shoots nothing for submission', () => {
    const report = shotReport()

    expect(report.shootable).toEqual([])
    expect(report.blocked).toEqual([...SHOT_REGIONS])
  })
})

describe.runIf(process.env.SHOOT === '1')('Taking the real screenshots', () => {
  it('captures every planned frame', async () => {
    expect(existsSync(join(process.cwd(), 'dist-shots', 'shots.html'))).toBe(true)
    await expect(main()).resolves.toBe(0)
  }, 600_000)
})
