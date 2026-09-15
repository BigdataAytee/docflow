/**
 * Running the catch-up (§L4, §M).
 *
 * The arithmetic lives in `schedule.ts` and is not repeated here — this is
 * only the part that talks to a repository: read the schedules, ask `catchUp`
 * what each still owes, and write the drafts.
 *
 * Three properties, and each one is the reason a line is written the way it is.
 *
 * **Nothing is ever sent, issued or numbered.** Every document this creates
 * has `status: 'draft'`, no `issuedReference` and no `frozenLabels` — §L4 says
 * a REVIEWABLE draft each month, and §A's "nothing sent unseen" makes that
 * non-negotiable. A recurring invoice that issued itself would freeze a
 * reference and a label onto a document nobody had looked at, and Rule #5
 * means it could never be corrected afterwards, only voided.
 *
 * **A crash halfway through cannot duplicate.** Two independent guards, and
 * they fail in different directions on purpose:
 *
 *  · The DECISION is idempotent — `existingKeys` is read off the documents
 *    themselves, so a re-run sees the drafts the dead run created and asks
 *    only for what is still missing.
 *  · The WRITE is idempotent — each draft is created under the recurrence key
 *    as its idempotency key, so even two catch-ups racing on one device, or a
 *    replay whose first response was lost, produce one row (§M).
 *
 * Either alone would be enough on a good day. Together they hold when the
 * process dies between the write and anything that might have recorded it.
 *
 * **A long gap is reported, never silently dropped.** `catchUp` bounds what it
 * creates and names the months it skipped; this hands that straight back so
 * the UI can say it out loud rather than an owner discovering eleven missing
 * invoices themselves.
 */

import type { DocumentRecord, Repositories } from '../../data/repositories'
import { type IsoDay, todayIso } from '../../domain/dates/calendar'
import { type Recurrence, catchUp } from './schedule'

export interface CaughtUp {
  /** The drafts created, oldest period first. */
  readonly created: readonly DocumentRecord[]
  /** Months that were due but older than the catch-up bound, oldest first. */
  readonly skipped: readonly string[]
}

export interface CatchUpDeps {
  readonly repositories: Repositories
  readonly companyId: string
  /**
   * Today as a CALENDAR DAY. Defaulted rather than read inside, so a test can
   * pin it — and `todayIso` rather than a sliced instant, because a period is
   * a calendar month and an instant sliced in UTC rolls over at the wrong
   * hour for most of the world.
   */
  readonly today?: IsoDay
}

/**
 * Bring every schedule up to date, and say what was skipped.
 *
 * Safe to call on every launch, and meant to be: that is what makes a phone
 * opened after three months offline produce the invoices it owes.
 */
export async function runCatchUp({
  repositories,
  companyId,
  today = todayIso(),
}: CatchUpDeps): Promise<CaughtUp> {
  const schedules = await repositories.recurrences.list(companyId)
  if (schedules.length === 0) return { created: [], skipped: [] }

  const created: DocumentRecord[] = []
  const skipped: string[] = []

  for (const schedule of schedules) {
    const from = await repositories.documents.get(companyId, schedule.sourceDocumentId)
    /*
     * A schedule whose source is gone produces nothing, and that is not an
     * error: the drafts it already made stand on their own, and there is
     * nothing left to copy from. Skipping beats throwing, because one deleted
     * source must not stop every other schedule catching up.
     */
    if (from === null) continue

    /*
     * Re-read inside the loop, once per schedule, rather than hoisting it.
     *
     * Two schedules cannot collide — a key carries its own source's id — but
     * a list read once outside would go stale against the drafts this very
     * loop is writing, and a stale set is the one input that could make the
     * decision ask for a period it has already created.
     *
     * `listByType` is enough: a repeat copies its source's type, so every
     * draft this schedule has ever made is of that type.
     */
    const siblings = await repositories.documents.listByType(companyId, from.type)
    const existing = new Set(
      siblings.flatMap((row) => (row.recurrenceKey === undefined ? [] : [row.recurrenceKey])),
    )

    const due = catchUp(asRecurrence(schedule), today, existing)
    skipped.push(...due.skipped)

    for (const period of due.due) {
      created.push(
        await repositories.documents.createDraft(
          {
            ...draftFrom(from),
            issueDate: period.issueDate,
            recurrenceKey: period.recurrenceKey,
          },
          // The recurrence key IS the idempotency key: derived from the
          // schedule and the month, so a replay asks for the same thing and
          // the repository hands back what it already wrote (§M).
          { idempotencyKey: period.recurrenceKey },
        ),
      )
    }
  }

  return { created, skipped }
}

const asRecurrence = (schedule: {
  sourceDocumentId: string
  dayOfMonth: number
  startedOn: string
  endedOn?: string
}): Recurrence => ({
  sourceDocumentId: schedule.sourceDocumentId,
  dayOfMonth: schedule.dayOfMonth,
  startedOn: schedule.startedOn,
  ...(schedule.endedOn === undefined ? {} : { endedOn: schedule.endedOn }),
})

/**
 * The new month's draft, copied from the document the repeat was switched on
 * from — and deliberately NOT everything it carries.
 *
 * What is dropped is the point: the reference and the labels froze on the
 * source at issue and belong to it alone (Rule #5); the payment, the delivery
 * evidence and the conversion links describe something that happened once and
 * would be a lie on a copy; the status goes back to draft because this has
 * been reviewed by nobody.
 */
function draftFrom(
  from: DocumentRecord,
): Omit<DocumentRecord, 'id' | 'issuedReference' | 'frozenLabels'> {
  return {
    companyId: from.companyId,
    type: from.type,
    status: 'draft',
    currency: from.currency,
    lineItems: from.lineItems,
    totalMinor: from.totalMinor,
    ...(from.customerId === undefined ? {} : { customerId: from.customerId }),
    // The design travels, so a repeat looks like the thing it repeats (§H).
    ...(from.templateId === undefined ? {} : { templateId: from.templateId }),
    ...(from.showLogo === undefined ? {} : { showLogo: from.showLogo }),
    ...(from.brandColour === undefined ? {} : { brandColour: from.brandColour }),
    ...(from.discountRatePpm === undefined ? {} : { discountRatePpm: from.discountRatePpm }),
    ...(from.signatureAssetId === undefined ? {} : { signatureAssetId: from.signatureAssetId }),
  }
}
