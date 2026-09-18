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
 * THE RULE. A debt lives in exactly one place at a time: on the follow-up when
 * a live follow-up exists, and on the original otherwise. Nothing is added to
 * the ledger and no payment is moved — what changes is which document is
 * ASKING, and only one of them ever is.
 *
 * LIVE means issued and not cancelled:
 *
 *  · a DRAFT follow-up has asked for nothing, so the original keeps the
 *    balance until the follow-up is actually issued — and a draft counts
 *    towards no total anywhere, so there is no window where both do;
 *  · a VOID follow-up has withdrawn the request, so the balance RETURNS to
 *    the original. Cancelling a follow-up must never quietly erase a real
 *    debt, which is what letting it vanish from both would do.
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
}

/**
 * Whether a follow-up is actually asking for the money.
 *
 * A draft has not asked yet and a cancelled one has stopped asking; in both
 * cases the original is still the document that carries the debt.
 */
export const isLiveFollowUp = (document: SupersedableDocument): boolean =>
  document.billsBalanceOfId !== undefined &&
  document.status !== 'draft' &&
  document.status !== 'void'

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
  const ids = new Set<string>()
  for (const document of documents) {
    if (isLiveFollowUp(document)) ids.add(document.billsBalanceOfId as string)
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
): T | undefined =>
  documents.find((document) => isLiveFollowUp(document) && document.billsBalanceOfId === invoiceId)

/**
 * Whether a second follow-up may be drawn for this invoice.
 *
 * Condition 3: two live follow-ups would each claim the same balance, which
 * is the double count again by another route. A cancelled one does not block
 * — the balance came back to the original, so asking again is exactly what
 * somebody would want to do next.
 */
export const canBillBalance = (
  invoiceId: string,
  documents: readonly SupersedableDocument[],
): boolean => liveFollowUpFor(invoiceId, documents) === undefined
