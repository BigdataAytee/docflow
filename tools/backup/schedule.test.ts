/**
 * The backup schedule (§Q Phase 7).
 *
 * The property under test is the one that keeps this honest: configuration
 * alone never reads as verified. A dashboard saying backups are enabled is
 * not evidence that a restore produces a working database, and the day it
 * matters is the worst day to find that out.
 */

import { describe, expect, it } from 'vitest'

import {
  POLICY,
  REHEARSAL_VALID_DAYS,
  type Rehearsal,
  type ScheduleState,
  backupReport,
  currentRehearsal,
  reportOf,
} from './schedule'

const NOW = new Date('2026-09-13T00:00:00Z')
const daysAgo = (days: number): string =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString()

const goodConfig = {
  dailyBackups: true,
  pointInTimeRecovery: true,
  retentionDays: POLICY.retentionDays,
  lastBackupAt: daysAgo(0),
}

const rehearsal = (over: Partial<Rehearsal> = {}): Rehearsal => ({
  performedAt: daysAgo(1),
  performedBy: 'a person',
  target: 'a scratch project',
  rowsBefore: 1000,
  rowsAfter: 1000,
  notes: 'restored and opened the app against it',
  ...over,
})

const state = (over: Partial<ScheduleState> = {}): ScheduleState => ({
  configured: goodConfig,
  rehearsals: [rehearsal()],
  ...over,
})

describe('Configuration alone is never verified', () => {
  it('blocks a perfectly configured project that nobody has restored from', () => {
    const report = backupReport(state({ rehearsals: [] }), NOW)

    expect(report.verified).toBe(false)
    expect(report.blockers.map((blocker) => blocker.what)).toEqual(['the restore rehearsal'])
    expect(report.blockers[0]?.detail).toContain('is not a backup')
  })

  it('is verified only with both the configuration and a recent rehearsal', () => {
    expect(backupReport(state(), NOW).verified).toBe(true)
  })

  it('expires a rehearsal, because the schema moves under it', () => {
    const fresh = rehearsal({ performedAt: daysAgo(REHEARSAL_VALID_DAYS - 1) })
    const stale = rehearsal({ performedAt: daysAgo(REHEARSAL_VALID_DAYS + 1) })

    expect(currentRehearsal([fresh], NOW)).toBeDefined()
    expect(currentRehearsal([stale], NOW)).toBeUndefined()
    expect(backupReport(state({ rehearsals: [stale] }), NOW).verified).toBe(false)
  })

  it('refuses a rehearsal dated in the future', () => {
    expect(currentRehearsal([rehearsal({ performedAt: daysAgo(-3) })], NOW)).toBeUndefined()
  })

  it('fails a rehearsal that lost rows rather than calling it a qualified pass', () => {
    const lossy = rehearsal({ rowsBefore: 1000, rowsAfter: 998 })
    const report = backupReport(state({ rehearsals: [lossy] }), NOW)

    expect(report.verified).toBe(false)
    expect(report.blockers[0]?.detail).toContain('loses rows is a failed rehearsal')
  })
})

describe('The configuration itself is checked against the policy', () => {
  it('blocks a retention window shorter than the policy asks for', () => {
    const report = backupReport(
      state({ configured: { ...goodConfig, retentionDays: 7 } }),
      NOW,
    )

    expect(report.verified).toBe(false)
    expect(report.blockers[0]?.detail).toContain('noticed weeks later')
  })

  it('blocks a missing point-in-time recovery, and says what it costs', () => {
    const report = backupReport(
      state({ configured: { ...goodConfig, pointInTimeRecovery: false } }),
      NOW,
    )

    expect(report.blockers.some((blocker) => blocker.what === 'point-in-time recovery')).toBe(true)
    expect(report.blockers[0]?.detail).toContain(String(POLICY.recoveryPointMinutes))
  })

  it('notices a daily backup that has not run', () => {
    const report = backupReport(
      state({ configured: { ...goodConfig, lastBackupAt: daysAgo(4) } }),
      NOW,
    )

    expect(report.blockers.some((blocker) => blocker.what === 'the last backup')).toBe(true)
  })
})

describe('The honest state today', () => {
  it('has nothing configured and nothing rehearsed', () => {
    const report = backupReport(undefined, NOW)

    expect(report.verified).toBe(false)
    expect(report.blockers.map((blocker) => blocker.what)).toEqual([
      'nothing is configured',
      'the restore rehearsal',
    ])
    expect(reportOf(report)).toContain('NOT verified')
  })

  it('says what the backup does NOT cover', () => {
    // An owner who assumes a server backup covers a device is going to lose
    // the one thing that was never uploaded.
    const text = reportOf(backupReport(undefined, NOW))

    expect(text).toContain('Does NOT cover')
    expect(text).toContain('never synced')
  })

  it('keeps the signatures and photos in the same backup as the documents', () => {
    // A delivery photo is evidence (§P). A backup holding the document but
    // not the signature at the foot of it restores a weaker record than the
    // one that was issued.
    expect(POLICY.covers.join(' ')).toContain('signatures and delivery photos')
  })
})
