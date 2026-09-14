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

    // Not an assertion about today's rules — an assertion about what is
    // outstanding. The day somebody confirms the answers, or builds account
    // deletion, this fails and is updated, which is the whole idea.
    expect(report.verified).toBe(false)

    // ONE failing check, and it is known: there is no account deletion, which
    // Apple 5.1.1(v) requires of any app offering account creation. Pinned by
    // name so a NEW failure is not swallowed by a blanket allowance, and so
    // that building the flow breaks this test rather than passing quietly.
    expect(report.checks.filter((check) => !check.passed).map((check) => check.check)).toEqual([
      'account-deletion',
    ])

    // Answers exist now, and none is confirmed. §U wants a person at
    // submission time; a machine that fetched the page is a citation, not a
    // signature.
    expect(report.unconfirmed.length).toBeGreaterThan(0)
    expect(report.blocked.length).toBeGreaterThan(0)
  })
})
