/**
 * Where a part-paid invoice's remaining balance actually lives (§K, Rule #3).
 *
 * THE DEFECT THIS EXISTS FOR, measured before it was written:
 *
 *   ₦145,000 invoice, ₦50,000 paid, ₦95,000 billed on a follow-up.
 *     follow-up issued  → original ₦95,000 + follow-up ₦95,000 = ₦190,000
 *     follow-up settled → original ₦95,000 + follow-up ₦0      = ₦95,000
 *
 * The customer owed ₦95,000 and then nothing. The app said ₦190,000 and then
 * ₦95,000, and the original read as unpaid for ever — so it went overdue, got
 * chased, and sat in the ageing report after the money had arrived.
 *
 * `billsBalanceOfId` was a LABEL. It linked the two documents on screen and
 * carried no weight in the ledger, so both of them billed the same debt.
 *
 * THE RULE. A debt lives in exactly one place at a time: on the newest live
 * follow-up when one exists, and on the original otherwise. Nothing is added
 * to the ledger and no payment is moved — what changes is which document is
 * ASKING, and only one of them ever is.
 *
 * LIVE means issued, not cancelled, and not itself replaced:
 *
 *  · a DRAFT follow-up has asked for nothing, so the original keeps the
 *    balance until the follow-up is actually issued — and a draft counts
 *    towards no total anywhere, so there is no window where both do;
 *  · a VOID follow-up has withdrawn the request, so the balance RETURNS to
 *    the original. Cancelling a follow-up must never quietly erase a real
 *    debt, which is what letting it vanish from both would do;
 *  · a REPLACED follow-up has been superseded by a newer one, which now
 *    carries the debt. See below — this is the case that arrives with
 *    instalments, and without it the ₦190,000 bug comes back by another door.
 *
 * REPLACEMENT, AND WHY IT IS NOT VOIDING. Every part payment produces a new
 * balance invoice, so a customer paying in five instalments would otherwise
 * leave five live follow-ups each asking for a different remainder. The new
 * one names the one it replaces through `supersedesId` — the same shape
 * `revision.ts` uses for a quotation's Rev 2, and for the same reason: the
 * replaced document is never written back to (Rule #5), and "this one was
 * replaced" is DERIVED by looking for a document carrying its id.
 *
 * The replaced one stays ISSUED. Voiding it would be wrong twice over: it
 * was not cancelled, it was answered — and voiding a follow-up returns its
 * debt to the original under the rule above, so voiding on replacement would
 * put the debt on the original AND on the new follow-up at once. The double
 * count again, through a third door.
 *
 * ONCE REPLACED, ALWAYS REPLACED. If the newest follow-up is later voided,
 * the debt returns to the ORIGINAL rather than to the one before it. The
 * earlier document asks for a stale figure — ₦95,000 when ₦65,000 is owed —
 * and the original's outstanding is computed from the ledger, so it is right
 * by construction. A superseding DRAFT is the exception: it has not asked for
 * anything yet, so it cannot have replaced anything yet.
 *
 * DERIVED, NEVER STORED. Like paid, overdue and expired, this is computed at
 * read time from the documents themselves (Rule #3) — a stored flag would be
 * one more thing to keep in step with a status that can change.
 */

/** The little a document needs to take part. Structural, so every projection fits. */
export interface SupersedableDocument {
  readonly id: string
  readonly type: string
  readonly status: string
  /** Set on the follow-up, naming the invoice whose balance it bills. */
  readonly billsBalanceOfId?: string
  /** Set on a replacement, naming the document it supersedes (§G, Rule #5). */
  readonly supersedesId?: string
}

/**
 * Follow-ups that a newer document has taken over from.
 *
 * A DRAFT replacement supersedes nothing — it has not asked for anything, so
 * the document it means to replace is still the one doing the asking. Any
 * other status counts, INCLUDING void: see "once replaced, always replaced"
 * above. Voiding the replacement sends the debt home to the original, not
 * back to a document quoting a figure that is no longer true.
 */
export function replacedFollowUpIds(
  documents: readonly SupersedableDocument[],
): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const document of documents) {
    if (document.supersedesId === undefined) continue
    if (document.status === 'draft') continue
    ids.add(document.supersedesId)
  }
  return ids
}

/**
 * Whether a follow-up is actually asking for the money.
 *
 * A draft has not asked yet, a cancelled one has stopped asking, and a
 * replaced one has handed the question to its successor. In all three cases
 * it is some other document that carries the debt.
 *
 * TAKES THE REPLACED SET, rather than looking it up itself, because the
 * answer has to be the SAME answer for every document in one read — and
 * because a function that can be called without it is a function that will
 * be, on the day somebody adds a fourth projection.
 */
export const isLiveFollowUp = (
  document: SupersedableDocument,
  replaced: ReadonlySet<string>,
): boolean =>
  document.billsBalanceOfId !== undefined &&
  document.status !== 'draft' &&
  document.status !== 'void' &&
  !replaced.has(document.id)

/**
 * The invoices whose balance is being billed somewhere else right now.
 *
 * Built once per read and passed down, rather than each caller searching the
 * document list again: the answer has to be the SAME answer everywhere, or
 * Home and the customer screen disagree about one debt.
 */
export function supersededBalanceIds(
  documents: readonly SupersedableDocument[],
): ReadonlySet<string> {
  const replaced = replacedFollowUpIds(documents)
  const ids = new Set<string>()
  for (const document of documents) {
    if (isLiveFollowUp(document, replaced)) ids.add(document.billsBalanceOfId as string)
  }
  return ids
}

/**
 * The live follow-up billing this invoice's balance, if there is one.
 *
 * Used by the screen to name it — condition 1 of the owner's brief: an
 * invoice where ₦50,000 of ₦145,000 arrived must never show a word implying
 * the money came in, so it says which document the rest is on.
 */
export const liveFollowUpFor = <T extends SupersedableDocument>(
  invoiceId: string,
  documents: readonly T[],
): T | undefined => {
  const replaced = replacedFollowUpIds(documents)
  return documents.find(
    (document) => isLiveFollowUp(document, replaced) && document.billsBalanceOfId === invoiceId,
  )
}

/**
 * The document that took over from this one, if any.
 *
 * The inverse read of `supersedesId`, and the one the SCREEN needs: a
 * replaced balance invoice must say "Replaced by INV-0007" rather than
 * "Issued", so nobody chases it or pays from its figure. Derived, because the
 * replaced document is never written to (Rule #5).
 */
export const replacedBy = <T extends SupersedableDocument>(
  documentId: string,
  documents: readonly T[],
): T | undefined =>
  documents.find((document) => document.supersedesId === documentId && document.status !== 'draft')

/**
 * Whether a second follow-up may be drawn for this invoice BY HAND.
 *
 * Two live follow-ups would each claim the same balance, which is the double
 * count again by another route. A cancelled one does not block — the balance
 * came back to the original, so asking again is exactly what somebody would
 * want to do next.
 *
 * This gates the MANUAL "Invoice the balance" action only. The automatic path
 * that runs when a part payment is recorded does not ask permission: it
 * REPLACES the live follow-up rather than adding a second one, which is the
 * whole point of `supersedesId` above.
 */
export const canBillBalance = (
  invoiceId: string,
  documents: readonly SupersedableDocument[],
): boolean => liveFollowUpFor(invoiceId, documents) === undefined
