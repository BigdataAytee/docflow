/**
 * Reading an archive back (§Q Phase 7: "backup schedule; full user data
 * export").
 *
 * **A backup nobody has restored is not a backup.** It is a file with a
 * reassuring name, and the moment it is needed is the worst possible moment to
 * find out it cannot be read. So the export ships with the reader, and a test
 * round-trips real records through both — not because the app imports
 * archives, but because an export that cannot be read back is not an export.
 *
 * This reader is deliberately paranoid and deliberately non-destructive: it
 * parses, counts and reports, and it writes nothing anywhere. Restoring INTO
 * an account is a different feature with different dangers (merging, duplicate
 * numbering, resurrecting voided documents) and §Q does not ask for it.
 */

import { ARCHIVE_VERSION, type Archive } from './archive'

export interface RestoreProblem {
  readonly part: string
  readonly detail: string
}

export interface RestoreReport {
  readonly archive?: Archive
  readonly problems: readonly RestoreProblem[]
  /** Counts as actually found, against the counts the archive claims. */
  readonly counts: Readonly<Record<string, number>>
  readonly readable: boolean
}

const ARRAY_PARTS = [
  'customers',
  'documents',
  'payments',
  'items',
  'expenses',
  'shares',
  'credits',
  'assets',
] as const

/**
 * Parse and check, without trusting the file.
 *
 * The counts in `meta` are the archive's own claim about itself. Checking the
 * arrays against them is what catches the failure this is really for: a file
 * truncated by a full disk or an interrupted download (§V lists both), which
 * still parses as JSON when the cut lands in the right place and is otherwise
 * indistinguishable from a small business.
 */
export function readArchive(text: string): RestoreReport {
  const problems: RestoreProblem[] = []
  const counts: Record<string, number> = {}

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    return {
      problems: [
        {
          part: 'file',
          detail: `not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
        },
      ],
      counts,
      readable: false,
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { problems: [{ part: 'file', detail: 'not an object' }], counts, readable: false }
  }

  const archive = parsed as Partial<Archive>
  const meta = archive.meta

  if (meta === undefined) {
    problems.push({ part: 'meta', detail: 'no meta block, so nothing can be checked against it' })
  } else if (meta.archiveVersion !== ARCHIVE_VERSION) {
    // Not fatal: a newer reader should still say what it can about an older
    // file rather than refusing it outright.
    problems.push({
      part: 'meta',
      detail: `written by archive version ${String(meta.archiveVersion)}, read by ${ARCHIVE_VERSION}`,
    })
  }

  for (const part of ARRAY_PARTS) {
    const value = archive[part]
    if (!Array.isArray(value)) {
      problems.push({ part, detail: 'missing or not a list' })
      continue
    }
    counts[part] = value.length
    const claimed = meta?.counts?.[part]
    if (claimed !== undefined && claimed !== value.length) {
      problems.push({
        part,
        detail: `the archive says ${claimed} and holds ${value.length} — it is truncated or edited`,
      })
    }
  }

  if (archive.company === undefined) {
    problems.push({ part: 'company', detail: 'missing' })
  }

  return {
    ...(problems.length === 0 ? { archive: archive as Archive } : {}),
    problems,
    counts,
    readable: problems.length === 0,
  }
}

export function reportOf(report: RestoreReport): string {
  const lines = Object.entries(report.counts).map(([part, count]) => `  ${count} ${part}`)
  for (const problem of report.problems) lines.push(`  PROBLEM  ${problem.part}: ${problem.detail}`)
  lines.push(report.readable ? '  the archive reads back whole' : '  the archive is NOT whole')
  return lines.join('\n')
}
