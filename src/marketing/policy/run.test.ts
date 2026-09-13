/**
 * `npm run policy` — the report, printed, with an exit code that means it.
 *
 * Built first, because `checks.ts` will not grant the test-only destination
 * exemption without a build to check it against: an exemption nobody verified
 * is the same as no check.
 */

import { describe, expect, it } from 'vitest'

import { policyReport, reportOf } from './report'

describe.runIf(process.env.POLICY === '1')('Reporting store-policy readiness', () => {
  it('prints the report and says NOT verified', () => {
    const report = policyReport()
    console.log(reportOf(report))

    // Not an assertion about today's rules — an assertion that nobody has
    // read them. The day somebody does, this fails and is updated.
    expect(report.verified).toBe(false)
    expect(report.codeClean, 'the code checks are failing; that is a bug, not a rule').toBe(true)
  })
})
