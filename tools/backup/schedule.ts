/**
 * The backup schedule (§Q Phase 7: "backup schedule; full user data export").
 *
 * The schedule is stated here as data so it can be CHECKED rather than
 * believed, and the checks are the point. Two of them are the ones that
 * actually matter, and both are about the same mistake:
 *
 * **A backup nobody has restored is not a backup**, and a schedule nobody has
 * verified is a setting somebody remembers turning on. The failure mode is
 * always the same shape — the dashboard says backups are enabled, and the day
 * they are needed the retention window turns out to be shorter than the
 * problem, or the dump excludes the storage bucket, or nobody has ever
 * proven a restore produces a working database.
 *
 * So this refuses to report a verified schedule from configuration alone. It
 * requires a dated restore REHEARSAL, and that rehearsal expires — for the
 * same reason the store-policy answers expire.
 */

/** How old a restore rehearsal may be before it stops counting. */
export const REHEARSAL_VALID_DAYS = 90

export interface BackupPolicy {
  /** What is covered, in the owner's terms rather than the provider's. */
  readonly covers: readonly string[]
  /** What is NOT, said plainly so nobody assumes it is. */
  readonly excludes: readonly string[]
  readonly frequency: string
  readonly retentionDays: number
  /** The worst acceptable data loss, which retention alone does not give you. */
  readonly recoveryPointMinutes: number
}

/**
 * The intended schedule.
 *
 * Retention is the number somebody regrets: the realistic disaster is not a
 * dropped table noticed in an hour, it is a bad migration or a quiet
 * corruption noticed weeks later, after a daily backup has rotated away.
 * Thirty days is chosen to survive that, not to match a provider's default —
 * and it is a cost decision, so it is written down where it can be argued
 * with rather than left implicit in a dashboard.
 */
export const POLICY: BackupPolicy = {
  covers: [
    'every row in the public schema: companies, customers, documents, payments, expenses, credits, share events, saved items',
    'the assets table, which holds signatures and delivery photos inline as data URLs — so the evidence on an issued document is in the same backup as the document',
    'the auth schema, without which restored rows belong to nobody',
  ],
  excludes: [
    'the link-token hashes, which are short-lived and worthless once expired',
    'anything held only on a device and never synced — that is what the in-app export is for, and it is why the export exists alongside this rather than instead of it',
  ],
  frequency: 'daily, plus point-in-time recovery',
  retentionDays: 30,
  recoveryPointMinutes: 60,
}

export interface Rehearsal {
  /** ISO date the restore was actually performed. */
  readonly performedAt: string
  readonly performedBy: string
  /** What was restored INTO. Never the production project. */
  readonly target: string
  /** Rows counted after the restore, against rows before it. */
  readonly rowsBefore: number
  readonly rowsAfter: number
  readonly notes: string
}

export interface ScheduleState {
  /** From the provider, when there is one to ask. */
  readonly configured?: {
    readonly dailyBackups: boolean
    readonly pointInTimeRecovery: boolean
    readonly retentionDays: number
    readonly lastBackupAt?: string
  }
  readonly rehearsals: readonly Rehearsal[]
}

/**
 * Nothing is configured and nothing has been rehearsed.
 *
 * There is no project. Writing plausible values here would make the report
 * green for a database that does not exist, which is the one outcome worse
 * than having no report.
 */
export const STATE: ScheduleState = { rehearsals: [] }

export interface BackupFinding {
  readonly what: string
  readonly detail: string
}

export interface BackupReport {
  readonly policy: BackupPolicy
  readonly blockers: readonly BackupFinding[]
  readonly verified: boolean
}

const daysBetween = (from: Date, to: Date): number =>
  Math.floor((to.getTime() - from.getTime()) / 86_400_000)

export function currentRehearsal(
  rehearsals: readonly Rehearsal[],
  now: Date,
): Rehearsal | undefined {
  return rehearsals.find((rehearsal) => {
    const at = new Date(rehearsal.performedAt)
    if (Number.isNaN(at.getTime())) return false
    const age = daysBetween(at, now)
    return age >= 0 && age <= REHEARSAL_VALID_DAYS
  })
}

export function backupReport(
  state: ScheduleState = STATE,
  now: Date = new Date(),
  policy: BackupPolicy = POLICY,
): BackupReport {
  const blockers: BackupFinding[] = []

  if (state.configured === undefined) {
    blockers.push({
      what: 'nothing is configured',
      detail:
        'there is no deployed project to schedule backups on — this is the same blocker ' +
        'as the Phase 5 gate, and it is the first one to clear',
    })
  } else {
    const { configured } = state
    if (!configured.dailyBackups) {
      blockers.push({ what: 'daily backups', detail: 'not enabled on the project' })
    }
    if (!configured.pointInTimeRecovery) {
      blockers.push({
        what: 'point-in-time recovery',
        detail:
          `not enabled — without it the worst case is a whole day of work, not the ` +
          `${policy.recoveryPointMinutes} minutes this policy asks for`,
      })
    }
    if (configured.retentionDays < policy.retentionDays) {
      blockers.push({
        what: 'retention',
        detail:
          `${configured.retentionDays} days configured, ${policy.retentionDays} required — ` +
          'the realistic disaster is a bad migration noticed weeks later, not a table ' +
          'dropped in an hour',
      })
    }
    if (configured.lastBackupAt !== undefined && daysBetween(new Date(configured.lastBackupAt), now) > 1) {
      blockers.push({
        what: 'the last backup',
        detail: `taken ${configured.lastBackupAt} — the schedule says daily and it has not run`,
      })
    }
  }

  const rehearsal = currentRehearsal(state.rehearsals, now)
  if (rehearsal === undefined) {
    blockers.push({
      what: 'the restore rehearsal',
      detail:
        state.rehearsals.length === 0
          ? 'never performed — a backup nobody has restored is not a backup, it is a file ' +
            'with a reassuring name'
          : `the most recent is older than ${REHEARSAL_VALID_DAYS} days, and a restore that ` +
            'worked two quarters ago says nothing about the schema as it is now',
    })
  } else if (rehearsal.rowsAfter !== rehearsal.rowsBefore) {
    blockers.push({
      what: 'the restore rehearsal',
      detail: `restored ${rehearsal.rowsAfter} rows from ${rehearsal.rowsBefore} — a restore that loses rows is a failed rehearsal, not a qualified pass`,
    })
  }

  return { policy, blockers, verified: blockers.length === 0 }
}

export function reportOf(report: BackupReport): string {
  const lines = [
    `Schedule: ${report.policy.frequency}, kept ${report.policy.retentionDays} days, ` +
      `recovery point ${report.policy.recoveryPointMinutes} minutes.`,
    '',
    'Covers:',
    ...report.policy.covers.map((entry) => `  · ${entry}`),
    'Does NOT cover:',
    ...report.policy.excludes.map((entry) => `  · ${entry}`),
    '',
  ]
  for (const blocker of report.blockers) lines.push(`  BLOCKER  ${blocker.what}: ${blocker.detail}`)
  lines.push(
    report.verified
      ? '  The schedule is configured and a restore has been rehearsed recently.'
      : `  NOT verified — ${report.blockers.length} blockers.`,
  )
  return lines.join('\n')
}
