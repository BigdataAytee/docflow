/**
 * Recurring invoices (§L4).
 *
 * "Repeat toggle producing reviewable monthly drafts; idempotent recurrence
 * keys; missed periods created on next launch without duplicates."
 *
 * Three properties do all the work:
 *
 *  · **The key is derived, not generated.** `recurrenceKeyFor(sourceId, month)`
 *    is a pure function of the schedule and the month, so the same period asked
 *    for twice — a retried upload, two devices launching at once, a crash
 *    halfway through catch-up — yields the same key and the second attempt
 *    finds the draft already there (§M: recurrence jobs never duplicate).
 *  · **It produces DRAFTS.** Nothing is issued, numbered, frozen or sent.
 *    §L4 says reviewable, and §A's "nothing sent unseen" is the whole point:
 *    a recurring invoice that issued itself would freeze a reference and a
 *    label for a document nobody had looked at.
 *  · **Catch-up is bounded and says so.** A phone opened after a long gap
 *    creates the recent missed months and REPORTS how many it skipped, rather
 *    than silently dropping them or dumping five years of drafts into the
 *    list. The number is handed back so the UI can say it out loud.
 */

export class RecurrenceError extends Error {}

export interface Recurrence {
  readonly sourceDocumentId: string
  /** 1-31. A month too short for it uses its own last day (see `dueDay`). */
  readonly dayOfMonth: number
  /**
   * ISO date of the document the repeat was switched on from. That document IS
   * its own month, so the first draft this schedule produces is the NEXT one.
   */
  readonly startedOn: string
  /** Set when the owner switches Repeat off; periods after it are not created. */
  readonly endedOn?: string
}

/** How many missed months one catch-up will create before it starts reporting. */
export const CATCH_UP_LIMIT = 12

export interface DuePeriod {
  /** `YYYY-MM`. */
  readonly month: string
  /** The ISO date the draft is dated, with short months handled. */
  readonly issueDate: string
  /** Stable across retries, devices and restarts (§M). */
  readonly recurrenceKey: string
}

export interface CatchUp {
  readonly due: readonly DuePeriod[]
  /**
   * Months that were missed but not created, oldest first, because the gap was
   * longer than `CATCH_UP_LIMIT`. Never silently zero when months were dropped.
   */
  readonly skipped: readonly string[]
}

const MONTH = /^(\d{4})-(\d{2})/

function monthIndex(day: string): number {
  const match = MONTH.exec(day)
  if (match === null) throw new RecurrenceError(`Not an ISO date: ${day}`)
  return Number(match[1]) * 12 + (Number(match[2]) - 1)
}

function monthLabel(index: number): string {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** Days in the month `YYYY-MM`. */
export function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number)
  if (year === undefined || monthNumber === undefined) {
    throw new RecurrenceError(`Not a month: ${month}`)
  }
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
}

/**
 * The 31st in February is the 28th (or the 29th) — the alternative is either
 * skipping the month or spilling into March, and both surprise the owner.
 */
export function dueDay(month: string, dayOfMonth: number): string {
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    throw new RecurrenceError(`A monthly repeat needs a day between 1 and 31, got ${dayOfMonth}.`)
  }
  const day = Math.min(dayOfMonth, daysInMonth(month))
  return `${month}-${String(day).padStart(2, '0')}`
}

/**
 * The idempotency handle for one period of one schedule.
 *
 * Deliberately readable: it turns up in the outbox, in logs and in a support
 * conversation, and "rec:doc_88:2026-09" answers the question on sight.
 */
export const recurrenceKeyFor = (sourceDocumentId: string, month: string): string =>
  `rec:${sourceDocumentId}:${month}`

/**
 * What this schedule still owes, given what already exists.
 *
 * `existingKeys` is the set of recurrence keys already on the device — drafts
 * created earlier, and anything still sitting in the outbox. A key that is
 * present is not created again, which is what makes a second launch, a retried
 * sync and a second device all no-ops.
 */
export function catchUp(
  recurrence: Recurrence,
  today: string,
  existingKeys: ReadonlySet<string>,
  limit = CATCH_UP_LIMIT,
): CatchUp {
  // The source document already covers its own month — repeating starts after it.
  const first = monthIndex(recurrence.startedOn) + 1
  const now = monthIndex(today)
  const last =
    recurrence.endedOn === undefined ? now : Math.min(now, monthIndex(recurrence.endedOn))

  const missing: string[] = []
  for (let index = first; index <= last; index += 1) {
    const month = monthLabel(index)
    if (existingKeys.has(recurrenceKeyFor(recurrence.sourceDocumentId, month))) continue
    missing.push(month)
  }

  // Newest months are the ones the owner is about to send, so a bounded
  // catch-up keeps those and reports the older ones it did not create.
  const skipped = missing.slice(0, Math.max(0, missing.length - limit))
  const creating = missing.slice(skipped.length)

  return {
    due: creating.map((month) => ({
      month,
      issueDate: dueDay(month, recurrence.dayOfMonth),
      recurrenceKey: recurrenceKeyFor(recurrence.sourceDocumentId, month),
    })),
    skipped,
  }
}

/** The month a schedule will next produce a draft for, or null once ended. */
export function nextPeriod(recurrence: Recurrence, today: string): string | null {
  // A schedule started in the future has not produced anything yet, so its next
  // period follows its own start rather than today.
  const next = Math.max(monthIndex(today), monthIndex(recurrence.startedOn)) + 1
  if (recurrence.endedOn !== undefined && next > monthIndex(recurrence.endedOn)) return null
  return monthLabel(next)
}

/** Switching Repeat off. Past drafts stand; nothing new is produced (§L4). */
export function stopRepeating(recurrence: Recurrence, on: string): Recurrence {
  return { ...recurrence, endedOn: on.slice(0, 10) }
}

/** Switching Repeat on, from the document being looked at. */
export function startRepeating(
  sourceDocumentId: string,
  issueDate: string,
): Recurrence {
  const month = issueDate.slice(0, 7)
  if (!MONTH.test(month)) throw new RecurrenceError(`Not an ISO date: ${issueDate}`)
  return {
    sourceDocumentId,
    dayOfMonth: Number(issueDate.slice(8, 10)),
    startedOn: issueDate.slice(0, 10),
  }
}
