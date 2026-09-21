/**
 * The saved document (§G).
 *
 * §Q put this screen in Phase 2 and it was the one that never got built, which
 * is why the paid-so-far bar, the payments list, the chase row and the Repeat
 * toggle had nowhere to live. This is their host, and nothing more: every
 * piece below already existed and is tested on its own.
 *
 * The rules it has to hold:
 *
 *  · **An issued document is immutable** (Rule #5). There is no edit control
 *    here for one — corrections are cancel, credit or reissue.
 *  · **Money moves only through the ledger** (Rule #3). The payment sheet
 *    records a payment; nothing here sets a paid flag.
 *  · **A receipt is a view of a payment.** Its button derives one from a
 *    payment that already exists and cannot invent an amount.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'

import { useCompany } from '../context'
import { useAppData } from '../store'
import { HOME, documentPath, editDocumentPath, listPath, newDocumentPath } from '../paths'
import { useGoBack } from '../useGoBack'
import {
  BillBalanceError,
  balanceInvoiceDraft,
  billBalanceKeyFor,
} from '../../features/payments/billBalance'
import { deductionsFrom } from '../../domain/payments/balanceStatement'
import { canBillBalance, liveFollowUpFor } from '../../domain/payments/supersession'
import { nextSequence } from '../../features/documents/reference'
import { PageHeader, SkeletonList, StatusBadge } from '../../ui'
import { BuilderCard } from '../../features/documents/BuilderCard'
import type { UiStrings } from '../../domain/locale/data/strings'
import { LivePreview } from '../../features/documents/LivePreview'
import { ActionGrid } from '../../features/documents/ActionGrid'
import { documentActions } from '../../features/documents/actions'
import {
  composableOf,
  composeOptionsOf,
  designOf,
  draftOf,
  replacesOf,
} from '../../features/documents/composition'
import { templateById } from '../../pdf/templates'
import { PaidSoFarBar } from '../../features/payments/PaidSoFarBar'
import { PaymentList } from '../../features/payments/PaymentList'
import { RepeatToggle } from '../../features/recurring/RepeatToggle'
import { ConvertSheet } from '../../features/documents/ConvertSheet'
import { VoidSheet } from '../../features/documents/VoidSheet'
import { VoidError, type VoidableDocument, canVoid, voidDocument } from '../../features/documents/void'
import { CreditNoteSheet } from '../../features/credits/CreditNoteSheet'
import {
  canRevise,
  chainOf,
  reviseDocument,
  revisionNumberOf,
  supersededBy,
} from '../../features/documents/revision'
import { answerOn, answerQuotation, answersFor } from '../../features/documents/answer'
import {
  canReissue,
  reasonsReissueIsBlocked,
  voidAndReissue,
} from '../../features/payments/reissue'
import { SignDeliverySheet } from '../../features/delivery/SignDeliverySheet'
import { attachDeliveryPhoto, canAttachPhoto } from '../../features/delivery/photo'
import { PhotoButton } from '../../features/photos/PhotoButton'
import {
  DeliverySignError,
  canSign,
  nextDeliveryStep,
  signDelivery,
} from '../../features/delivery/sign'
import { CreditNoteError, issueCreditNote } from '../../features/credits/issue'
import {
  ConvertError,
  type ConvertibleDocument,
  convertDocument,
  convertedFrom,
  conversionsOf,
} from '../../features/documents/convert'
import { paidSoFar, prefillAmount, recordPayment } from '../../features/payments/record'
import {
  receiptForPayment,
  receiptKeyFor,
  receiptRecordFor,
} from '../../features/payments/receiptFlow'
import { draftChase } from '../../features/payments/chase'
import { allocationsAgainstInvoice, invoiceOutstanding } from '../../domain/payments/ledger'
import { TYPE_PALETTE } from '../../ui/tokens'
import { displayLabels, labelInSentence as typeInSentence } from '../../domain/locale/profile'
import { formatMoney } from '../../features/customers/formatMoney'
import { money } from '../../domain/money/money'
import { format } from '../../domain/locale/data/strings'
import { ShareSheet } from '../../share/ShareSheet'
import { SigningLinkSheet } from '../../features/links/SigningLinkSheet'
import type { SharePort } from '../../share/port'
import { useReview } from '../ReviewHost'
import { createWebSharePort } from '../../share/web'
import { todayIso } from '../../domain/dates/calendar'
import { lastShared, shareCount, shareEventFor } from '../../share/events'
// `shareFileName` is deliberately not imported: there is no rendered file to
// attach until §Q Phase 4's native PDF writer, and the sheet says so.
import { shareTextFor } from '../../share/text'
import { deviceId } from '../device'
import { buildReference } from '../../features/documents/reference'
import { freezeLabels, numberingPrefix } from '../../domain/locale/profile'
import { balanceDue } from '../../domain/payments/balanceStatement'
import { planSettlement } from '../../features/payments/settleAndBill'
import type { DocumentRecord } from '../../data/repositories'
import type { DocumentType } from '../../domain/documents/types'
import { offeredReference } from '../../features/documents/draftReference'
import { displayStatus, totalOf } from '../derive'
import { localDay } from '../../domain/dates/calendar'

export function DocumentScreen({ today = todayIso() }: { today?: string }) {
  const { id } = useParams<{ id: string }>()
  /*
   * WHAT THE SAVE JUST PRODUCED BESIDES THIS (§G, §N).
   *
   * A short-paid cash sale makes an invoice for the remainder, and a second
   * document appearing in the invoices list unannounced is exactly the
   * surprise §N forbids. It rides in route state rather than on the record
   * because it is a fact about how somebody ARRIVED — reopening this receipt
   * tomorrow is the same document and is not news.
   */
  const arrivedWith = useLocation().state as {
    billed?: { invoiceId: string; owedMinor: number; paidMinor: number }
    fromQuotation?: { quotationId: string; invoiceId: string }
    /** The list row that sent us here, and what it offered (§G). */
    rowAction?: 'record_payment' | 'sign'
  } | null
  const billedAlso = arrivedWith?.billed
  /**
   * The offer this began as, when it began as one (§G).
   *
   * A paid quotation produces a bill AND its receipt in one act, so two
   * documents appear that the owner never asked for by name. §N says that is
   * said rather than discovered in a list on Thursday.
   */
  const cameFromQuotation = arrivedWith?.fromQuotation
  const rowAction = arrivedWith?.rowAction
  const { profile, strings } = useCompany()
  const review = useReview()
  const {
    company,
    customers,
    documents,
    payments,
    shares,
    creditNotes,
    assets,
    recurrences,
    loading,
    actions,
  } = useAppData()
  const navigate = useNavigate()

  const [tone, setTone] = useState<'softer' | 'firmer' | null>(null)
  const [sharing, setSharing] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertProblem, setConvertProblem] = useState<string | null>(null)
  const [voiding, setVoiding] = useState(false)
  /*
   * WHAT A RECORDED PAYMENT JUST PRODUCED, so the confirmation can name both
   * documents and let the owner open either (§K).
   */
  const [settled, setSettled] = useState<{
    receiptId: string
    balanceId: string | null
  } | null>(null)
  const [settlementProblem, setSettlementProblem] = useState<string | null>(null)
  const [billProblem, setBillProblem] = useState<string | null>(null)
  const [voidProblem, setVoidProblem] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  /*
   * WHAT THE ROW SENT US TO DO (§G).
   *
   * The list row NAVIGATES and never writes — so arriving here is the moment
   * the thing it offered actually opens, with the document on screen behind
   * it. "Record payment" reveals the action panel where that button lives;
   * "Sign" opens the signing sheet.
   *
   * A ref, not a dependency: this must happen once on arrival and never
   * again, and re-running it would reopen a sheet somebody had just closed.
   */
  const actedOnArrival = useRef(false)
  const [signProblem, setSignProblem] = useState<string | null>(null)
  const [revisionProblem, setRevisionProblem] = useState<string | null>(null)
  const [reissueProblem, setReissueProblem] = useState<string | null>(null)
  const [answerProblem, setAnswerProblem] = useState<string | null>(null)
  const [crediting, setCrediting] = useState(false)
  /* Opened BY the four pills, rather than living under them (§G). */
  const [linking, setLinking] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  /* Cancel is a correction, not a primary action — it sits behind More. */
  const [more, setMore] = useState(false)

  /*
   * The row's offer, opened once the document is here (§G).
   *
   * This is where the journey ends and the real control appears — with the
   * document on screen behind it, which is the whole reason the list itself
   * never writes.
   */
  useEffect(() => {
    if (rowAction === undefined || actedOnArrival.current) return
    actedOnArrival.current = true
    if (rowAction === 'record_payment') setMore(true)
    if (rowAction === 'sign') setSigning(true)
  }, [rowAction])
  const [creditProblem, setCreditProblem] = useState<string | null>(null)

  // One port per mount. Phase 4 swaps the Capacitor plugin in behind it and no
  // line of this screen changes.
  const port = useMemo(() => createWebSharePort(), [])

  const record = documents.find((document) => document.id === id)
  /*
   * The FALLBACK is this document's own list, not Home. A shared link opened
   * cold has no history behind it, and the nearest sensible place above an
   * invoice is the invoices — which is also what the person would have
   * reached had they arrived the ordinary way.
   */
  const goBack = useGoBack(record === undefined ? HOME : listPath(record.type))

  /*
   * §G's "void and reissue", as one act.
   *
   * A receipt cannot be corrected any other way: it is immutable once issued
   * (Rule #5), and a credit note is an INVOICE correction — crediting a
   * receipt would mean money going back to the customer, which is a refund
   * rather than a typo.
   *
   * Cancel first, then draw. If the second write does not land the owner is
   * not stuck: a cancelled receipt does not count as the payment's receipt,
   * so the payment's own Receipt button offers to draw one. The recovery path
   * is the ordinary path.
   */
  const reissueReceipt = (): void => {
    if (record === undefined) return
    setReissueProblem(null)
    let plan
    try {
      plan = voidAndReissue(record, {
        payments,
        description: format(strings.newReceipt.lineAgainst, {
          label: typeInSentence(profile, 'invoice'),
          reference: linkedInvoice?.issuedReference ?? '',
        }),
      })
    } catch (cause) {
      setReissueProblem(
        format(strings.reissue.failed, {
          reason: cause instanceof Error ? cause.message : String(cause),
        }),
      )
      return
    }
    void actions
      .transition(plan.voidId, 'void')
      .then(() => actions.createDraftWithKey(plan.replacement, plan.idempotencyKey))
      .then((created) => navigate(editDocumentPath(created.id)))
      .catch((cause: unknown) => {
        setReissueProblem(
          format(strings.reissue.failed, {
            reason: cause instanceof Error ? cause.message : String(cause),
          }),
        )
      })
  }
  // Derived, never stored on the screen — the same rule as every other piece
  // of truth here (§C: derived states are computed at read time).
  /*
   * `null` from the store means this backend has no repeats at all — not that
   * this document has none. The two must not collapse into each other here:
   * treating "unavailable" as "off" is what draws a working-looking toggle
   * over a feature that cannot do anything (§N).
   */
  const repeatsUnavailable = recurrences === null
  const recurrence = recurrences?.find((row) => row.sourceDocumentId === id) ?? null
  const customer = customers.find((row) => row.id === record?.customerId)

  const mine = useMemo(
    () =>
      record === undefined
        ? []
        : payments.filter((payment) =>
            payment.allocations.some((allocation) => allocation.invoiceId === record.id),
          ),
    [payments, record],
  )

  if (loading) return <SkeletonList rows={4} label={strings.common.loading} />
  if (record === undefined || id === undefined) return <Navigate to={HOME} replace />

  const labels = displayLabels(profile, record.type, record.frozenLabels)
  const design = designOf(record, company)
  const template = templateById(design.templateId)
  /* The ledger row this receipt stands for, and the invoice behind it. */
  const receiptPayment = (() => {
    if (record.type !== 'receipt' || record.paymentId === undefined) return undefined
    const paid = payments.find((payment) => payment.id === record.paymentId)
    if (paid === undefined) return undefined
    return {
      amount: paid.amount,
      at: paid.paidAt,
      ...(paid.method === undefined ? {} : { method: paid.method }),
    }
  })()

  const againstReference =
    record.type === 'receipt' && record.linkedInvoiceId !== undefined
      ? documents.find((row) => row.id === record.linkedInvoiceId)?.issuedReference ?? undefined
      : undefined

  const composable = composableOf({
    draft: draftOf(record),
    design,
    company,
    customer,
    profile,
    reference: record.issuedReference,
    /*
     * THE NUMBER A DRAFT WOULD GET, on the page that shows the draft (§M).
     *
     * This page fell through to `INV-…` while the builder one tap away
     * showed `INV-0005-0P`. Same document, two answers, and the ellipsis is
     * not a number anybody can read back over a phone. An issued document is
     * untouched: `reference` above outranks this (Rule #5).
     */
    suggestedReference: offeredReference(
      { documents, prefixes: company?.numberingPrefixes, profile, deviceId: deviceId() },
      record.type,
    ),
    status: record.status,
    frozenLabels: record.frozenLabels,
    replaces: replacesOf(documents, record),
    // The screen's own `today`, not a fresh clock read — the prop exists so
    // a test can pin the day. Only ever reached by a draft with no issue date
    // of its own; an issued document froze its date at issue (§M).
    today,
    /*
     * THE PAYMENT A RECEIPT IS EVIDENCE OF (§E line 190, §I).
     *
     * Resolved here because this is where the ledger is. Nothing supplied it
     * before, so `buildReceiptEvidence` returned null on every receipt and the
     * evidence block never drew — a receipt printed the goods with no amount
     * paid, no date paid and no method on it.
     *
     * Rule #3 holds: this READS the payment, it never derives one. A receipt
     * with no payment behind it prints no evidence rather than an invented
     * figure, which is the same answer §K gives when it refuses to issue one.
     */
    ...(receiptPayment === undefined ? {} : { payment: receiptPayment }),
    ...(againstReference === undefined ? {} : { againstReference }),
  })
  const composeOptions = composeOptionsOf({
    company,
    design,
    strings,
    assets,
  })
  const total = totalOf(record)
  const isInvoice = record.type === 'invoice'
  // Real credit notes, not an empty list: a credited invoice owes less, and
  // every figure on this screen has always been ready to be told (§E).
  const mineCredits = creditNotes.filter((note) => note.invoiceId === record.id)

  /*
   * The other end of a balance follow-up, in both directions.
   *
   * `billsBalanceOf` is what THIS document follows; `balanceBilledBy` is the
   * document that follows THIS one. Looked up rather than stored twice: one
   * link, read from both sides, so the two can never disagree about each
   * other.
   */
  const billsBalanceOf = documents.find((doc) => doc.id === record.billsBalanceOfId)
  const balanceBilledBy = documents.find((doc) => doc.billsBalanceOfId === record.id)

  /*
   * ASKING FOR THE REST — what is still owed on a part-paid invoice.
   *
   * Null on everything else. "Part paid" rather than "anything owed" is the
   * condition, deliberately: an invoice nobody has paid does not want a SECOND
   * invoice for the same money, it wants chasing, which is already one of its
   * four actions. This is for the case those four do not cover — some money
   * came in, and the rest has to be asked for on a document the frozen
   * original cannot become (Rule #5).
   */
  const billable = (() => {
    if (record.type !== 'invoice') return null
    if (record.status === 'draft' || record.status === 'void') return null
    /*
     * ONE FOLLOW-UP AT A TIME. Two live ones would each claim the same
     * balance, which is the double count again by another route. A CANCELLED
     * one does not block: the balance came back to this invoice, so asking
     * again is exactly what somebody would want to do next.
     */
    if (!canBillBalance(record.id, documents)) return null
    const bar = paidSoFar(record.id, total, payments, mineCredits)
    if (bar.left.minor <= 0 || bar.paid.minor <= 0) return null
    return bar.left
  })()

  /**
   * What a recorded payment produces, performed (§K, §V).
   *
   * `planSettlement` decides; this writes. Split that way because the
   * decisions — settled exactly, a fifth instalment, an invoice already
   * followed up — are the part worth testing without a store or a clock.
   *
   * EACH DOCUMENT IS CREATED THEN ISSUED THROUGH THE ORDINARY PATH.
   * `issueDocument` is where the reference, the frozen labels and the total
   * settle together (§M, Rule #5); a document issued by a shortcut beside it
   * would be the one in the app whose numbering came from somewhere else.
   *
   * ISSUED, NOT LEFT AS DRAFTS. A draft asks for nothing — the balance
   * invoice has to be live for `supersession.ts` to move the debt onto it,
   * and a draft receipt is evidence nobody has been given. The owner asked
   * for both to exist without another tap, and a document that exists but
   * does not count would not be that.
   */
  /** One past the highest ISSUED reference of this type (§M). */
  const sequenceFor = (type: DocumentType): number =>
    nextSequence(
      documents.filter((row) => row.type === type).map((row) => row.issuedReference),
    )

  const settleAndBill = async ({
    input,
    customerId,
  }: {
    input: { amount: ReturnType<typeof money>; method: string; reference?: string }
    customerId: string
  }): Promise<void> => {
    setSettlementProblem(null)
    const owedBefore = paidSoFar(record.id, total, payments, mineCredits).left

    const recorded = await actions.recordPayment(
      recordPayment({
        // The repository mints the real id; this one only needs to be stable
        // for the allocation it builds below.
        id: `pending:${record.id}:${Date.now()}`,
        customerId,
        amount: input.amount,
        paidAt: new Date().toISOString(),
        method: input.method,
        invoiceId: record.id,
        invoiceTotal: total,
        existingPayments: payments,
        creditNotes: mineCredits,
        ...(input.reference === undefined ? {} : { reference: input.reference }),
      }),
    )

    if (company === null || record.type !== 'invoice') return

    const plan = planSettlement({
      invoice: record,
      payment: recorded,
      /*
       * Every payment INCLUDING the one just recorded, as calendar days in
       * the company's own calendar (§E) — a payment stores an instant and a
       * document prints a date.
       */
      deductions: deductionsFrom(
        allocationsAgainstInvoice(record.id, record.currency, [...payments, recorded]).map(
          (allocation) => ({ ...allocation, paidAt: localDay(allocation.paidAt) }),
        ),
        record.currency,
      ),
      outstandingBefore: owedBefore,
      documents,
      today: localDay(new Date().toISOString()),
      receiptDescription: format(strings.newReceipt.lineAgainst, {
        label: typeInSentence(profile, 'invoice'),
        reference: record.issuedReference ?? '',
      }),
    })

    const issueNow = async (
      fields: Parameters<typeof actions.createDraftWithKey>[0],
      key: string,
      type: DocumentType,
      totalMinor: number,
    ): Promise<DocumentRecord> => {
      const created = await actions.createDraftWithKey(fields, key)
      // Already issued by an earlier attempt: the key returned that one (§M).
      if (created.status !== 'draft') return created
      const issued = buildReference({
        prefix: company.numberingPrefixes?.[type] ?? numberingPrefix(profile, type),
        sequence: sequenceFor(type),
        fromReservedBlock: false,
        deviceId: deviceId(),
      })
      await actions.issue(created.id, {
        reference: issued,
        frozenLabels: freezeLabels(profile, type),
        totalMinor,
      })
      return created
    }

    try {
      const receipt = await issueNow(
        plan.receipt.fields as Parameters<typeof actions.createDraftWithKey>[0],
        plan.receipt.key,
        'receipt',
        recorded.amount.minor,
      )
      const balance =
        plan.balance === null
          ? null
          : await issueNow(
              plan.balance.fields as Parameters<typeof actions.createDraftWithKey>[0],
              plan.balance.key,
              'invoice',
              balanceDue(
                money(record.currency, plan.balance.fields.billedTotalMinor),
                plan.balance.fields.deductions.map((row: { paidAt: string; amountMinor: number }) => ({
                  paidAt: row.paidAt,
                  amount: money(record.currency, row.amountMinor),
                })),
              ).minor,
            )
      setSettled({ receiptId: receipt.id, balanceId: balance?.id ?? null })
    } catch (cause) {
      /*
       * THE MONEY LANDED. Whatever went wrong here, the payment is recorded
       * and Outstanding is right — so this says what is missing rather than
       * anything that reads like a failed payment.
       */
      setSettlementProblem(
        format(strings.payments.billBalanceFailed, {
          reason: cause instanceof Error ? cause.message : String(cause),
        }),
      )
    }
  }

  const billTheBalance = (): void => {
    if (billable === null) return
    setBillProblem(null)
    let next
    try {
      next = balanceInvoiceDraft({
        invoice: record,
        /*
         * EVERY payment against this invoice, with its date — the document
         * prints them one line each, so the customer can see that this is a
         * remainder rather than a second bill for the whole job.
         */
        deductions: deductionsFrom(
          /*
           * THE DAY THE MONEY ARRIVED, in the company's calendar (§E) — a
           * payment stores an instant, and a document prints a date. Slicing
           * the instant would date a payment in UTC, which west of Greenwich
           * is tomorrow for the last hours of every evening.
           */
          allocationsAgainstInvoice(record.id, record.currency, payments).map((allocation) => ({
            ...allocation,
            paidAt: localDay(allocation.paidAt),
          })),
          record.currency,
        ),
        today: localDay(new Date().toISOString()),
        /*
         * The live balance invoice this one takes over from, if any. The
         * manual action is gated on there being none (see `billable` above),
         * so this is undefined here — it is the automatic path on recording a
         * part payment that replaces.
         */
        ...(liveFollowUpFor(record.id, documents) === undefined
          ? {}
          : { replacesId: liveFollowUpFor(record.id, documents)!.id }),
      })
    } catch (cause) {
      // The domain hands back a CODE; the words are the catalogue's (Rule #4).
      const why =
        cause instanceof BillBalanceError
          ? (strings.payments.billBalanceWhy[cause.reason] ?? cause.reason)
          : cause instanceof Error
            ? cause.message
            : String(cause)
      setBillProblem(format(strings.payments.billBalanceFailed, { reason: why }))
      return
    }
    /*
     * Keyed on the invoice AND the balance (§M): two taps make one draft, and
     * a later follow-up at a different remainder is a different act with its
     * own key rather than silently returning the first one.
     */
    void actions
      .createDraftWithKey(next, billBalanceKeyFor(record.id, billable.minor))
      .then((created) => navigate(editDocumentPath(created.id)))
      .catch((cause: unknown) => {
        setBillProblem(
          format(strings.payments.billBalanceFailed, {
            reason: cause instanceof Error ? cause.message : String(cause),
          }),
        )
      })
  }
  const status = displayStatus(record, payments, today, mineCredits, documents)

  /** The mark on this document, resolved from the id it holds (§E). */
  /*
   * The proof card shows the RECIPIENT's mark, not the business's. It read
   * `signatureAssetId` — which is the sender's — and only appeared to work
   * because signing used to overwrite that field with the customer's asset.
   */
  const signatureUrl = assets.find((asset) => asset.id === record.signerSignatureAssetId)?.dataUrl
  const deliveryPhotoUrl = assets.find((asset) => asset.id === record.deliveryPhotoAssetId)
    ?.dataUrl

  // Where this offer sits in its chain — all derived, nothing stored (§G).
  const revisionNumber = revisionNumberOf(documents, record)
  const nextRevisionNumber = chainOf(documents, record).length + 1
  const newerRevision = supersededBy(documents, record.id)
  const revisedFrom = documents.find((row) => row.id === record.supersedesId) ?? null

  /** §E `related_invoice_id`: what a receipt's payment settled, if anything. */
  const linkedInvoice = documents.find((row) => row.id === record.linkedInvoiceId) ?? null

  /** What the customer could still say, and what they already said (§G). */
  const answers = answersFor(record)
  const recordedAnswer = answerOn(record)
  const outstanding = invoiceOutstanding(record.id, total, payments, mineCredits)

  const chase = (() => {
    if (!isInvoice || outstanding.minor <= 0 || tone === null) return null
    try {
      return draftChase(
        {
          customerName: customer?.name ?? '',
          businessName: company?.name ?? '',
          reference: record.issuedReference ?? '',
          outstanding,
          currency: record.currency,
          formatAmount: (amount) => formatMoney(amount),
          templates: strings.chase,
          ...(record.dueDate === undefined ? {} : { dueDate: record.dueDate }),
          ...(company?.bankFields === undefined ? {} : { bankValues: company.bankFields }),
        },
        tone,
        today,
      )
    } catch {
      return null
    }
  })()

  const shareText = shareTextFor({
    document: {
      type: record.type,
      reference: record.issuedReference,
      frozenLabels: record.frozenLabels,
      ...(customer === undefined ? {} : { customerName: customer.name }),
      // A delivery document carries no money anywhere, so none goes out in
      // its message either (§G, §I, §V).
      ...(isInvoice ? { total } : {}),
      ...(isInvoice && outstanding.minor > 0 ? { outstanding } : {}),
      ...(record.dueDate === undefined ? {} : { dueDate: record.dueDate }),
    },
    businessName: company?.name ?? '',
    profile,
    strings: strings.share,
    formatAmount: (amount) => formatMoney(amount),
    fill: format,
  })

  const convertible: ConvertibleDocument = {
    id: record.id,
    type: record.type,
    status: record.status,
    currency: record.currency,
    lineItems: record.lineItems,
    ...(record.customerId === undefined ? {} : { customerId: record.customerId }),
    ...(record.issueDate === undefined ? {} : { issueDate: record.issueDate }),
  }

  // §G's "links persist", read rather than written: the original is immutable,
  // so what came from it is found by the link on the new document.
  const madeFromThis: Partial<Record<typeof record.type, string>> = {}
  for (const made of conversionsOf(documents, record.id)) madeFromThis[made.type] = made.id
  const source = convertedFrom(documents, record)

  const voidable: VoidableDocument = {
    id: record.id,
    type: record.type,
    status: record.status,
    currency: record.currency,
    total,
  }

  // Cancelling is offered wherever the lifecycle allows it; whether it will
  // actually go through is the sheet's business, because the refusal needs
  // room to explain itself.
  const canVoidOrCredit = record.status !== 'void' && (canVoid(voidable, payments) || isInvoice)

  const timesShared = shareCount(shares, record.id)
  const latestShare = lastShared(shares, record.id)

  /*
   * NO NAV BELOW THIS PAGE, so no room reserved for one.
   *
   * `pb-28` was 7rem of empty space held open for a floating pill that this
   * screen no longer draws — a blank band under the last control, which is the
   * gap that makes a removed element look like a bug. What stays is the gesture
   * area, which is a property of the DEVICE and does not care which route is on
   * screen.
   */
  return (
    <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <PageHeader
        title={labels.printedTitle}
        eyebrow={record.issuedReference ?? strings.savedDocument.notIssuedYet}
        accent={TYPE_PALETTE[record.type].accent}
        deep={TYPE_PALETTE[record.type].deep}
        /*
         * THE WAY OFF THIS SCREEN. It had none: the floating nav pill was the
         * only exit, and it was also the thing sitting on top of the four
         * actions. Removing it without this would have left the screen with
         * no way out except Android's hardware button — which is the one
         * platform being tested, and would have hidden the problem on every
         * other.
         *
         * `history.back()`, not a path: Customers → customer → invoice →
         * Back reaches the CUSTOMER, which is where the person came from.
         * `useGoBack` supplies the list as the fallback for the case with no
         * history behind it — a shared link, a notification, a cold start.
         */
        onBack={goBack}
        backLabel={strings.common.back}
        {...(customer === undefined ? {} : { subtitle: customer.name })}
        trailing={<StatusBadge status={status} label={strings.statuses[status] ?? status} />}
      />

      {/*
        THE SECOND DOCUMENT, NAMED (§G, §N).

        A cash sale that was short paid produces a bill for the remainder, and
        the owner did nothing to ask for it. An invoice appearing in the list
        unannounced is the surprise §N forbids, so the receipt says what was
        made, what each one is for, and offers the way to it.

        The receipt's own reference is in the header above this, which is why
        only the invoice carries a control: a link to the page you are already
        on is a control that does nothing.
      */}
      {/*
        THE OFFER, THE BILL AND THE EVIDENCE, named together (§G, §N).

        "They've paid" on an accepted quotation produces two documents the
        owner never asked for by name. Both are reachable from here, and the
        sentence says which is which — a quotation that quietly grew an
        invoice beside it is the surprise this exists to prevent.
      */}
      {cameFromQuotation !== undefined && (
        <div data-testid="from-quotation" className="px-3.5 pt-3">
          <section className="rounded-2xl border border-brand/20 bg-brand-tint p-3.5">
            <p className="text-[13px] font-semibold leading-snug text-brand-ink">
              {format(strings.newReceipt.bothMade, {
                invoiceLabel: typeInSentence(profile, 'invoice'),
                invoice:
                  documents.find((row) => row.id === cameFromQuotation.invoiceId)
                    ?.issuedReference ?? '',
                quotationLabel: typeInSentence(profile, 'quotation'),
                receiptLabel: typeInSentence(profile, 'receipt'),
                receipt: record.issuedReference ?? '',
              })}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => navigate(documentPath(cameFromQuotation.invoiceId))}
                className="raised tap-scale min-h-tap flex-1 rounded-xl bg-surface px-3 text-[13px] font-semibold text-brand-ink"
              >
                {strings.savedDocument.action.openInvoice}
              </button>
              <button
                type="button"
                onClick={() => navigate(documentPath(cameFromQuotation.quotationId))}
                className="raised tap-scale min-h-tap flex-1 rounded-xl bg-surface px-3 text-[13px] font-semibold text-brand-ink"
              >
                {format(strings.convert.madeFrom, {
                  reference:
                    documents.find((row) => row.id === cameFromQuotation.quotationId)
                      ?.issuedReference ?? '',
                })}
              </button>
            </div>
          </section>
        </div>
      )}

      {billedAlso !== undefined && (
        <div data-billed-also className="px-3.5 pt-3">
          <section className="rounded-2xl border border-brand/20 bg-brand-tint p-3.5">
            <p className="text-[13px] font-semibold leading-snug text-brand-ink">
              {format(strings.newReceipt.billedAndPaid, {
                invoiceLabel: typeInSentence(profile, 'invoice'),
                invoice:
                  documents.find((row) => row.id === billedAlso.invoiceId)?.issuedReference ?? '',
                owed: formatMoney(money(record.currency, billedAlso.owedMinor)),
                receiptLabel: typeInSentence(profile, 'receipt'),
                receipt: record.issuedReference ?? '',
                paid: formatMoney(money(record.currency, billedAlso.paidMinor)),
              })}
            </p>
            <button
              type="button"
              onClick={() => navigate(documentPath(billedAlso.invoiceId))}
              className="raised tap-scale mt-2.5 min-h-tap w-full rounded-xl bg-surface px-3 text-[13px] font-semibold text-brand-ink"
            >
              {strings.savedDocument.action.openInvoice}
            </button>
          </section>
        </div>
      )}

      {/*
        The document itself (§4): what it is, which design, on what paper —
        then the page.

        Composed through the SHARED composition, the same functions the
        builder's preview and the PDF writer use. A second composition here
        would be free to disagree with the one that prints, which is the drift
        Rule #5 exists to stop.
      */}
      <section className="px-4 pt-4">
        {/* `opacity`, not a colour: the ink token is what inverts in dark. */}
        <p className="mb-2 text-[10.5px] opacity-70">
          {format(strings.design.caption, {
            // The printed title, so an issued document uses its FROZEN word
            // (§D.2) and the design its own un-localised name (§H).
            type: labels.printedTitle,
            design: template.name,
            paper: strings.design.paper,
          })}
        </p>
        {/*
          Hidden from assistive tech HERE, and only here.

          This screen already presents everything the page contains, in a
          better order and with the controls attached: the header names the
          document, the status badge says where it is, the money cards carry
          the totals. Exposing the page as well means a reader hears the whole
          document a second time as a flat table, after having been told it.

          The same component stays exposed on the builder's Review step,
          because there the page IS the content — it is the last look before
          issue, and there is nothing else on that screen saying what it says.

          Safe to hide: the page has no focusable element in it, so nothing is
          being taken out of the tab order along with the words (§F).
        */}
        <div className="a4-sheet" aria-hidden="true">
          <LivePreview
            document={composable}
            templateId={design.templateId}
            composeOptions={composeOptions}
            brandColour={design.brandColour}
          />
        </div>
      </section>

      <div className="doc-actions px-4 pb-2 pt-4">
        {record.status === 'draft' && (
          <button
            type="button"
            className="raised tap-scale min-h-tap w-full rounded-full bg-gradient-to-b from-brand-light to-brand px-4 text-sm font-semibold text-white"
            onClick={() => navigate(editDocumentPath(id))}
          >
            {strings.savedDocument.continueEditing}
          </button>
        )}

        {/*
          §G'S FOUR, AS A GRID (§G, §N).

          "Actions, four per type" — and they keep their places. What used to
          be here was a stack of full-width buttons appearing and disappearing
          as the delivery lifecycle advanced, so the layout moved under the
          owner's thumb and a control that was not possible yet simply was not
          there to ask about. The lifecycle is unchanged; the pill that cannot
          act says which step comes first.

          The transitions that MOVE the lifecycle — sending a delivery on its
          way, marking it on the way — stay below as their own controls. They
          are not among §G's four, and a delivery that can never be dispatched
          is a delivery whose signing link never unlocks.
        */}
        {!sharing && !converting && !voiding && !crediting && (
          <ActionGrid
            actions={documentActions({
              type: record.type,
              status: record.status,
              dispatched: record.status === 'dispatched' || record.status === 'delivered',
              signed: record.status === 'delivered',
              ...(record.linkedInvoiceId === undefined
                ? {}
                : { linkedInvoiceId: record.linkedInvoiceId }),
              /* Whether there is still money to take — §G's paid-so-far. */
              owes: isInvoice && outstanding.minor > 0,
              /*
               * Whether a receipt still has a payment to re-acknowledge.
               * `canReissue` reads the ledger; `documentActions` deliberately
               * knows nothing about money, so the answer is handed to it.
               */
              reissuable: canReissue(record, payments),
            })}
            strings={strings}
            onAction={(id) => {
              /*
               * THEY'VE PAID — one navigation, and no writing on this screen.
               *
               * The receipt flow does the whole act: it bills the quotation,
               * issues that invoice, and drops onto the page where the money
               * is recorded. Doing any of it here would be a second
               * implementation of the same journey, free to disagree with the
               * one the picker reaches — and "both entry points produce the
               * same thing" is a property worth having by construction rather
               * than by test.
               */
              if (id === 'they_paid') {
                return navigate(newDocumentPath('receipt'), {
                  state: { quotationId: record.id },
                })
              }
              if (id === 'share_pdf') return setSharing(true)
              if (id === 'convert') return setConverting(true)
              if (id === 'void_and_reissue') {
                // A receipt's correction is void AND reissue, in one act. Any
                // other type's is the void sheet, which offers a credit note.
                return record.type === 'receipt' ? reissueReceipt() : setVoiding(true)
              }
              /*
               * Recording a payment is the honest route to a receipt, and the
               * reason "convert an invoice to a receipt" is not offered: §G
               * says a receipt is evidence of a payment, so it follows money
               * ARRIVING rather than being spun out of the request for it.
               */
              if (id === 'record_payment' || id === 'chase') return setMore(true)
              if (id === 'open_invoice' && record.linkedInvoiceId !== undefined) {
                return navigate(documentPath(record.linkedInvoiceId))
              }

              /*
                THE PILL OPENS THE CONTROL — it does not scroll to a copy of
                it. The first version of this pointed at duplicate controls
                further down the page, which is how the screen came to carry
                NINE actions where §G asks for four: "Copy signing link" and
                "Copy a link for them to sign" were the same act under two
                names, as were "Add photo" and "Add a photo", and "Convert
                to…" and "Turn this into something else".

                Those duplicates are gone. What owned the job — minting the
                link, recording the handoff, storing the asset before the
                document names it — is now opened BY the pill instead of
                sitting beneath it.
              */
              /*
                THE PAD, not a link row.
                
                "Ask them to sign" is what an owner does at the gate: they
                hand the phone over and the customer signs on it. That is the
                common case by a long way, and it used to take two taps
                through a row offering to copy a URL — which is the remote
                case, and the rarer one.

                The remote link is not lost; it is offered INSIDE the sheet,
                for when the customer is not standing there.
              */
              if (id === 'copy_signing_link') {
                setSignProblem(null)
                return setSigning(true)
              }
              if (id === 'copy_accept_link') return setLinking(true)
              if (id === 'add_photo') return setPhotoOpen(true)
            }}
          />
        )}

        {/*
          §G's sign action, and §Q's Phase 2 gate: "create and sign a delivery
          document". One tap here, one sheet, and the delivery is signed for
          (Rule #1).
        */}

        {/*
          ONE STATUS CONTROL, not three buttons (§G, §M).

          "Send it on its way", "Mark it on the way" and "Confirm delivery"
          were three full-width buttons competing with §G's four actions. They
          are not actions on the document — they are the delivery's STATE
          moving forward — and only ever one of them applies at a time. So
          there is one control, and it says which step is next.

          The lifecycle is untouched: something that never left cannot have
          arrived (§M), so `nextDeliveryStep` still gates dispatch before
          signing, and "on the way" is still the optional middle a delivery
          may skip (Rule #1).
        */}
        {!signing && deliveryStatusStep(record) !== null && (
          <>
            {canSign(record) && (
              <p className="text-center text-xs opacity-70">{strings.signature.onItsWay}</p>
            )}
            <button
              type="button"
              className="min-h-tap w-full rounded-full border border-edge/10 bg-surface px-4 text-sm font-medium"
              onClick={() => {
                const next = deliveryStatusStep(record)
                if (next === null) return
                if (next.kind === 'sign') {
                  setSignProblem(null)
                  setSigning(true)
                  return
                }
                void actions.transition(record.id, next.step)
              }}
            >
              {statusLabel(deliveryStatusStep(record), strings)}
            </button>
          </>
        )}

        {/*
          §G's fourth delivery action, and §E's "delivery photo asset". It is
          what settles an argument three weeks later: the stack at the gate,
          the plate number, the state the goods arrived in. It seals with the
          signature, because a photo added after the customer signed would
          change what the record says happened (§P).
        */}
        {(photoOpen || deliveryPhotoUrl !== undefined) && (
          <section
            id="action-target-add_photo"
            className="glass rounded-2xl p-4"
            aria-label={strings.photo.title}
          >
            <h2 className="text-sm font-semibold">{strings.photo.title}</h2>
            <p className="mt-0.5 mb-3 text-xs opacity-70">
              {canAttachPhoto(record) ? strings.photo.explain : strings.photo.sealed}
            </p>
            {canAttachPhoto(record) ? (
              <PhotoButton
                {...(deliveryPhotoUrl === undefined ? {} : { currentUrl: deliveryPhotoUrl })}
                onPhoto={async (dataUrl) => {
                  // Stored first, then referenced: a document may only name
                  // an asset the repository accepted (§P).
                  const asset = await actions.storeAsset('delivery_photo', dataUrl)
                  const attached = attachDeliveryPhoto(record, asset.id)
                  await actions.attachDeliveryPhoto(attached.documentId, attached.assetId)
                }}
              />
            ) : (
              deliveryPhotoUrl !== undefined && (
                <img
                  src={deliveryPhotoUrl}
                  alt={strings.photo.taken}
                  className="max-h-48 w-full rounded-xl object-cover"
                />
              )
            )}
          </section>
        )}

        {linking && canSign(record) && !signing && <CopyLinkRow anchorId="action-target-copy_signing_link" documentId={record.id} kind="sign"
            typeLabel={labels.printedTitle}
            reference={record.issuedReference ?? record.id}
            recipient={customer?.name ?? ''}
            port={port}
            onSent={() => {
              // A handed-off signing link is a handoff like any other (§M).
              const event = shareEventFor({
                id: `pending:${record.id}`,
                companyId: record.companyId,
                documentId: record.id,
                at: new Date().toISOString(),
                result: { outcome: 'handed_off', channel: 'sheet' },
                deviceId: deviceId(),
              })
              if (event !== null) {
                const { id: _id, companyId: _companyId, ...rest } = event
                void actions.recordShare(rest)
              }
            }}
          />}

        {signing && (
          <SignDeliverySheet
            onClose={() => setSigning(false)}
            {...(canSign(record)
              ? {
                  onSendLink: () => {
                    setSigning(false)
                    setLinking(true)
                  },
                }
              : {})}
            {...(signProblem === null ? {} : { error: signProblem })}
            onSign={(input) => {
              // Stored first: a document may only ever name an asset the
              // repository accepted, or the page would print a blank mark
              // and claim to be signed for (§P).
              void actions
                .storeAsset('signature', input.signature.dataUrl)
                .then((asset) => {
                  const decision = signDelivery({
                    document: record,
                    signerName: input.signerName,
                    ...(input.signerRole === undefined ? {} : { signerRole: input.signerRole }),
                    signerSignatureAssetId: asset.id,
                    at: new Date().toISOString(),
                  })
                  // ONE write. The mark, the signer, the moment and the
                  // status land together or not at all (§P).
                  return actions.signDelivery(decision.documentId, {
                    signerName: decision.signerName,
                    ...(decision.signerRole === undefined
                      ? {}
                      : { signerRole: decision.signerRole }),
                    signedAt: decision.signedAt,
                    signerSignatureAssetId: decision.signerSignatureAssetId,
                  })
                })
                .then(() => setSigning(false))
                .catch((cause: unknown) => {
                  setSignProblem(
                    format(strings.signature.failed, {
                      reason:
                        cause instanceof DeliverySignError
                          ? strings.signature.sealed
                          : cause instanceof Error
                            ? cause.message
                            : String(cause),
                    }),
                  )
                })
            }}
          />
        )}

        {/* Once signed, the evidence is the document (§P). */}
        {record.signedAt !== undefined && (
          <section
            className="rounded-2xl bg-status-good-tint p-4 text-sm text-status-good"
            aria-label={strings.signature.confirmDelivery}
          >
            <p className="font-semibold">
              {format(strings.signature.deliveredOn, { date: localDay(record.signedAt) })}
            </p>
            <p className="mt-0.5 opacity-80">
              {format(strings.signature.signedBy, {
                name:
                  record.signerRole === undefined
                    ? (record.signerName ?? '')
                    : `${record.signerName ?? ''} · ${record.signerRole}`,
              })}
            </p>
            {signatureUrl !== undefined && (
              <img
                src={signatureUrl}
                alt={strings.signature.drawn}
                className="mt-2 max-h-16 w-auto"
              />
            )}
          </section>
        )}

        {/*
          Where this document sits in its chain, at both ends: the one that was
          replaced says so, and the replacement says what it replaces. Both are
          READ from the documents — nothing was written back onto an original
          that Rule #5 froze (§G).

          A quotation's chain is numbered, because §G calls those Rev 2 and
          Rev 3. A reissued receipt replaces exactly one cancelled receipt,
          so numbering it would say more than is true.
        */}
        {/*
          THE TWO ENDS OF A BALANCE FOLLOW-UP, each naming the other.

          An issued invoice is frozen, so what is still owed after a part
          payment is asked for on a NEW document — and without this the pair
          read as two separate charges for the same goods, to the owner
          reading their own list as much as to the customer.

          The field was stored and shown nowhere, which the declared-field
          sweep caught: "one debt asked for twice" was a claim in a comment
          and nothing a person could see.
        */}
        {billsBalanceOf !== undefined && (
          <button
            type="button"
            className="glass w-full rounded-2xl p-4 text-start text-sm"
            onClick={() => navigate(documentPath(billsBalanceOf.id))}
          >
            <span className="font-semibold">
              {format(strings.payments.billsBalanceOf, {
                reference: billsBalanceOf.issuedReference ?? '',
              })}
            </span>
            <span className="mt-0.5 block text-xs opacity-70">{strings.payments.openIt}</span>
          </button>
        )}

        {balanceBilledBy !== undefined && (
          <button
            type="button"
            className="glass w-full rounded-2xl p-4 text-start text-sm"
            onClick={() => navigate(documentPath(balanceBilledBy.id))}
          >
            <span className="font-semibold">
              {format(strings.payments.balanceBilledBy, {
                reference:
                  balanceBilledBy.issuedReference ?? strings.savedDocument.notIssuedYet,
              })}
            </span>
            <span className="mt-0.5 block text-xs opacity-70">{strings.payments.openIt}</span>
          </button>
        )}

        {newerRevision !== null && (
          <button
            type="button"
            className="w-full rounded-2xl bg-status-warn-tint p-4 text-start text-sm text-status-warn"
            onClick={() => navigate(documentPath(newerRevision.id))}
          >
            {/* NAMED, so nobody sends or pays from the wrong one (§G). */}
            <span className="font-semibold">
              {format(strings.reissue.replacedBy, {
                reference: newerRevision.issuedReference ?? '',
              })}
            </span>
            <span className="mt-0.5 block text-xs opacity-80">{strings.revision.openIt}</span>
          </button>
        )}

        {revisedFrom !== null && (
          <button
            type="button"
            className="glass w-full rounded-2xl p-4 text-start text-sm"
            onClick={() => navigate(documentPath(revisedFrom.id))}
          >
            {record.type === 'quotation' && (
              <span className="font-semibold">
                {format(strings.revision.badge, { number: String(revisionNumber) })}
              </span>
            )}
            <span className="mt-0.5 block text-xs opacity-70">
              {format(strings.revision.supersedes, {
                reference: revisedFrom.issuedReference ?? '',
              })}
            </span>
          </button>
        )}

        {/*
          §G'S TWO RECEIPT ACTIONS USED TO BE DRAWN TWICE.

          "Open what it paid for" and "Cancel and draw a new one" stood here
          as their own buttons, and the four-action grid above also carries
          `open_invoice` and `void_and_reissue` — the same two acts under two
          sets of words. A receipt showed SIX actions where §G asks for four,
          and two of them did the same thing as two others.

          They are the grid's now. The behaviour moved with them: the grid's
          `void_and_reissue` opened a sheet that only VOIDED, which is half of
          what its own name promises — `reissueReceipt` below is the whole act
          and is what the pill runs.
        */}

        {/*
          §G's other route for a receipt whose payment came back: there is
          nothing left to acknowledge, so a plain cancel is the honest action.
        */}
        {record.type === 'receipt' &&
          reasonsReissueIsBlocked(record, payments) === 'payment_reversed' && (
            <p className="glass rounded-xl px-3 py-2.5 text-xs opacity-70">
              {strings.reissue.paymentReversed}
            </p>
          )}

        {reissueProblem !== null && (
          <p
            className="rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm font-medium text-status-warn"
            role="alert"
          >
            {reissueProblem}
          </p>
        )}

        {/*
          §G's "copy accept link" is how a CUSTOMER answers, and that page is
          Phase 5 — it needs a deployed edge function, because a customer is
          not signed in and RLS scopes every read to a company (§P). The
          answer itself is not a Phase 5 idea: most customers say yes on the
          phone or in the shop, and Rule #3 says offline is the product. So
          the answer is recorded here, and the link becomes a second way in
          rather than the only one.

          Until this, `accepted` and `rejected` were in the lifecycle, in the
          type table, in `deriveQuotationState` and in the list of statuses a
          quotation may be converted from — and nothing could reach either.
        */}
        {answers.length > 0 && (
          <section className="glass rounded-2xl p-4" aria-label={strings.answer.title}>
            <h2 className="text-sm font-semibold">{strings.answer.title}</h2>
            <p className="mt-0.5 text-xs opacity-70">{strings.answer.explain}</p>
            <div className="mt-3 flex gap-2">
              {answers.map((answer) => (
                <button
                  key={answer}
                  type="button"
                  className="min-h-tap flex-1 rounded-xl border border-edge/10 bg-surface px-3 text-sm font-medium"
                  onClick={() => {
                    setAnswerProblem(null)
                    let decision
                    try {
                      decision = answerQuotation(record, answer)
                    } catch (cause) {
                      setAnswerProblem(
                        format(strings.answer.failed, {
                          reason: cause instanceof Error ? cause.message : String(cause),
                        }),
                      )
                      return
                    }
                    // The same transition every other status move goes
                    // through, so the lifecycle table stays the one authority
                    // on what may follow what (§P revalidates against it).
                    void actions
                      .transition(decision.documentId, decision.to)
                      .catch((cause: unknown) => {
                        setAnswerProblem(
                          format(strings.answer.failed, {
                            reason: cause instanceof Error ? cause.message : String(cause),
                          }),
                        )
                      })
                  }}
                >
                  {answer === 'accepted' ? strings.answer.accepted : strings.answer.rejected}
                </button>
              ))}
            </div>
            <CopyLinkRow anchorId="action-target-copy_accept_link" documentId={record.id} kind="accept"
            typeLabel={labels.printedTitle}
            reference={record.issuedReference ?? record.id}
            recipient={customer?.name ?? ''}
            port={port}
            onSent={() => {
              // A handed-off signing link is a handoff like any other (§M).
              const event = shareEventFor({
                id: `pending:${record.id}`,
                companyId: record.companyId,
                documentId: record.id,
                at: new Date().toISOString(),
                result: { outcome: 'handed_off', channel: 'sheet' },
                deviceId: deviceId(),
              })
              if (event !== null) {
                const { id: _id, companyId: _companyId, ...rest } = event
                void actions.recordShare(rest)
              }
            }}
          />
          </section>
        )}

        {recordedAnswer !== null && (
          <p className="glass rounded-2xl px-4 py-3 text-xs opacity-70">
            {format(strings.answer.recorded, {
              answer: strings.statuses[recordedAnswer] ?? recordedAnswer,
            })}
          </p>
        )}

        {answerProblem !== null && (
          <p
            className="rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm font-medium text-status-warn"
            role="alert"
          >
            {answerProblem}
          </p>
        )}

        {/*
          §G's "duplicate as Rev 2", offered only while this is still the
          latest offer. Once a newer one exists the notice above IS the link
          to it, and a second button saying the same thing in the same place
          is noise rather than a choice (Rule #1).
        */}
        {canRevise(record) && newerRevision === null && (
          <button
            type="button"
            className="doc-action min-h-tap rounded-full border-brand/30 px-3 text-[12.5px] font-semibold text-brand-ink"
            onClick={() => {
              setRevisionProblem(null)
              let revised
              try {
                revised = reviseDocument(record, { documents, on: today })
              } catch (cause) {
                setRevisionProblem(
                  format(strings.revision.failed, {
                    reason: cause instanceof Error ? cause.message : String(cause),
                  }),
                )
                return
              }
              void actions
                .createDraftWithKey(
                  {
                    type: revised.draft.type,
                    status: 'draft',
                    currency: revised.draft.currency,
                    lineItems: revised.draft.lineItems,
                    totalMinor: 0,
                    supersedesId: revised.supersedesId,
                    ...(revised.draft.customerId === undefined
                      ? {}
                      : { customerId: revised.draft.customerId }),
                    ...(revised.draft.issueDate === undefined
                      ? {}
                      : { issueDate: revised.draft.issueDate }),
                    ...(revised.draft.signatureAssetId === undefined
                      ? {}
                      : { signatureAssetId: revised.draft.signatureAssetId }),
                  },
                  revised.idempotencyKey,
                )
                .then((created) => navigate(editDocumentPath(created.id)))
                .catch((cause: unknown) => {
                  setRevisionProblem(
                    format(strings.revision.failed, {
                      reason: cause instanceof Error ? cause.message : String(cause),
                    }),
                  )
                })
            }}
          >
            {format(strings.revision.make, { number: String(nextRevisionNumber) })}
          </button>
        )}

        {revisionProblem !== null && (
          <p
            className="rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm font-medium text-status-warn"
            role="alert"
          >
            {revisionProblem}
          </p>
        )}

        {/*
          "Turn this into something else" used to sit here — the same act as
          the Convert pill above, under a second name. §G asks for four
          actions; two wordings for one of them is how four became nine.
        */}

        {converting && (
          <ConvertSheet
            document={convertible}
            existing={madeFromThis}
            onClose={() => setConverting(false)}
            onOpen={(documentId) => {
              setConverting(false)
              navigate(documentPath(documentId))
            }}
            {...(convertProblem === null ? {} : { error: convertProblem })}
            onConvert={(to) => {
              let converted
              try {
                converted = convertDocument(convertible, { to, on: today })
              } catch (cause) {
                setConvertProblem(
                  format(strings.convert.failed, {
                    reason: cause instanceof ConvertError ? cause.message : String(cause),
                  }),
                )
                return
              }

              void actions
                .createDraftWithKey(
                  {
                    type: converted.draft.type,
                    status: 'draft',
                    currency: converted.draft.currency,
                    lineItems: converted.draft.lineItems,
                    totalMinor: 0,
                    convertedFromId: converted.convertedFromId,
                    ...(converted.draft.customerId === undefined
                      ? {}
                      : { customerId: converted.draft.customerId }),
                    ...(converted.draft.issueDate === undefined
                      ? {}
                      : { issueDate: converted.draft.issueDate }),
                  },
                  // Derived, so a retry is the same document (§M).
                  converted.idempotencyKey,
                )
                .then((created) => {
                  setConverting(false)
                  // Straight into the builder: it is a draft, and §G says
                  // nothing is issued without being looked at.
                  navigate(editDocumentPath(created.id))
                })
                .catch((cause: unknown) =>
                  setConvertProblem(
                    format(strings.convert.failed, { reason: String(cause) }),
                  ),
                )
            }}
          />
        )}

        {/*
          CORRECTIONS SIT BEHIND "MORE" (§G, Rule #5).

          Cancelling competed visually with the four actions — a destructive
          control in the same shape and the same row as Share PDF. Rule #5
          makes it a correction rather than a thing an owner does in passing,
          so it takes one deliberate tap to reveal.

          The §G pill still opens the sheet directly; this is the second way
          in, for somebody who came looking rather than being offered it.
        */}
        {canVoidOrCredit && !voiding && !crediting && !more && (
          <button
            type="button"
            className="min-h-tap w-full rounded-full px-4 text-xs font-medium opacity-70"
            onClick={() => setMore(true)}
          >
            {strings.savedDocument.actions}
          </button>
        )}

        {canVoidOrCredit && !voiding && !crediting && more && (
          // A fragment, not a flex row: the grid pairs these two itself now,
          // and a nested row inside a grid cell was what held the page 40px
          // wider than a 320px phone at 200% text.
          <>
            <button
              type="button"
              className="doc-action min-h-tap rounded-full border-status-bad/30 px-3 text-[12.5px] font-semibold text-status-bad"
              onClick={() => {
                setVoidProblem(null)
                setVoiding(true)
              }}
            >
              {strings.voidIt.title}
            </button>
            {isInvoice && record.status !== 'void' && (
              <button
                type="button"
                className="doc-action min-h-tap rounded-full border-brand/30 px-3 text-[12.5px] font-semibold text-brand-ink"
                onClick={() => {
                  setCreditProblem(null)
                  setCrediting(true)
                }}
              >
                {strings.credits.sheetTitle}
              </button>
            )}
          </>
        )}

        {voiding && (
          <VoidSheet
            document={voidable}
            payments={payments}
            creditNotes={mineCredits}
            {...(voidProblem === null ? {} : { error: voidProblem })}
            onClose={() => setVoiding(false)}
            onCreditInstead={() => {
              setVoiding(false)
              setCreditProblem(null)
              setCrediting(true)
            }}
            onVoid={() => {
              let decision
              try {
                decision = voidDocument({
                  document: voidable,
                  payments,
                  at: new Date().toISOString(),
                })
              } catch (cause) {
                setVoidProblem(
                  format(strings.voidIt.failed, {
                    reason: cause instanceof VoidError ? cause.message : String(cause),
                  }),
                )
                return
              }

              // Only the status moves. The reference, the frozen labels and the
              // totals stay exactly as they were issued (§M).
              void actions
                .transition(decision.documentId, decision.to)
                .then(() => setVoiding(false))
                .catch((cause: unknown) =>
                  setVoidProblem(format(strings.voidIt.failed, { reason: String(cause) })),
                )
            }}
          />
        )}

        {crediting && isInvoice && (
          <CreditNoteSheet
            invoiceId={record.id}
            invoiceReference={record.issuedReference ?? record.id}
            invoiceTotal={total}
            existing={mineCredits}
            {...(creditProblem === null ? {} : { error: creditProblem })}
            onClose={() => setCrediting(false)}
            onIssue={({ amount, reason }) => {
              let note
              try {
                note = issueCreditNote({
                  // The repository mints the real id; this only keys the write.
                  id: `pending:${record.id}`,
                  companyId: record.companyId,
                  invoiceId: record.id,
                  invoiceStatus: record.status,
                  invoiceReference: record.issuedReference,
                  invoiceTotal: total,
                  amount,
                  reason,
                  issuedAt: new Date().toISOString(),
                  existing: mineCredits,
                  /*
                   * ITS OWN SERIES, never the invoice's (§M).
                   *
                   * This read the company's INVOICE prefix and fell back to
                   * 'CRN'. §M's uniqueness is per series, and credit notes
                   * are a different table — so an owner who renamed their
                   * invoices to "SV" in Settings got credit notes numbered
                   * SV-0001 too, and a credit note could print the exact
                   * reference an invoice already carries. Two different
                   * documents, the same number, and no constraint anywhere
                   * that would catch it.
                   *
                   * Not made configurable: §M gives credit notes no prefix
                   * of their own, Settings offers one per document type, and
                   * a credit note is not a document type. Rule #1 says the
                   * smallest thing that works.
                   */
                  prefix: 'CRN',
                  /*
                   * ONE PAST THE HIGHEST, not one past the count (§M).
                   *
                   * A credit note's reference is frozen at issue like a
                   * document's and carries the same unique constraint, so the
                   * count had the same hole: remove one of five and the sixth
                   * is offered the fifth's number.
                   */
                  sequence: nextSequence(creditNotes.map((note) => note.reference)),
                  fromReservedBlock: false,
                  deviceId: deviceId(),
                })
              } catch (cause) {
                setCreditProblem(
                  format(strings.credits.failed, {
                    reason: cause instanceof CreditNoteError ? cause.message : String(cause),
                  }),
                )
                return
              }

              const { id: _id, companyId: _companyId, ...rest } = note
              void actions
                .issueCreditNote(rest, `credit:${record.id}:${note.reference}`)
                .then(() => setCrediting(false))
                .catch((cause: unknown) =>
                  setCreditProblem(format(strings.credits.failed, { reason: String(cause) })),
                )
            }}
          />
        )}

        {source !== null && (
          <button
            type="button"
            className="glass min-h-tap w-full rounded-2xl px-4 text-sm font-medium"
            onClick={() => navigate(documentPath(source.id))}
          >
            {format(strings.convert.madeFrom, {
              reference: source.issuedReference ?? source.id,
            })}
          </button>
        )}

        {sharing && (
          <ShareSheet
            port={port}
            text={shareText}
            sharedCount={timesShared}
            {...(latestShare === null ? {} : { lastSharedAt: localDay(latestShare.at) })}
            onClose={() => setSharing(false)}
            onResult={(result) => {
              const event = shareEventFor({
                // The repository mints the real id; this one only keys the write.
                id: `pending:${record.id}`,
                companyId: record.companyId,
                documentId: record.id,
                at: new Date().toISOString(),
                result,
                deviceId: deviceId(),
              })
              // §T's happy moment, and the only one in the app: an invoice
              // made, signed and out. The MOMENT is reported; whether to ask
              // is decided by the host, which knows the three things this
              // screen does not — demo, leaving, and whether the platform has
              // a review API at all.
              review.report(
                result.outcome === 'handed_off' ? 'share_handed_off' : 'share_failed',
              )

              // `unavailable` produces no event: nothing was attempted, so
              // there is nothing that happened to record (§M).
              if (event !== null) {
                const { id: _id, companyId: _companyId, ...rest } = event
                void actions.recordShare(rest)
              }
            }}
          />
        )}

        {isInvoice && record.status !== 'draft' && (
          <>
            {/*
              THE SPLIT, when the balance has moved to a follow-up.

              The bar would say "₦50,000 paid of ₦145,000 · ₦95,000 left" —
              true of this document in isolation and misleading in every other
              way, because the ₦95,000 is not being asked for here any more.
              Neither "Paid" nor "Part paid" is the word either: one claims
              money that did not arrive, the other leaves something to chase
              on a document that is not chasing it.
            */}
            {balanceBilledBy !== undefined && balanceBilledBy.status !== 'draft' ? (
              <div className="glass rounded-2xl p-4" data-balance-split>
                <p className="text-sm font-semibold">
                  {format(strings.payments.splitReceived, {
                    amount: formatMoney(
                      paidSoFar(record.id, total, payments, mineCredits).paid,
                    ),
                  })}
                </p>
                <p className="mt-0.5 text-sm">
                  {format(strings.payments.splitBilledOn, {
                    amount: formatMoney(
                      paidSoFar(record.id, total, payments, mineCredits).left,
                    ),
                    reference:
                      balanceBilledBy.issuedReference ?? strings.savedDocument.notIssuedYet,
                  })}
                </p>
              </div>
            ) : (
              <PaidSoFarBar bar={paidSoFar(record.id, total, payments, mineCredits)} />
            )}

            {/*
              ASKING FOR THE REST, from where the rest is written down.

              The bar says "₦50,000 paid of ₦145,000 · ₦95,000 left" and there
              was nothing to press: the owner made a second invoice by hand,
              retyping the balance off the screen behind them.

              Beside the balance rather than in the four-action row, which §G
              fills — and only while an invoice has been PART paid. An
              untouched one wants chasing, not a second bill; a settled one has
              no remainder.
            */}
            {billable !== null && (
              <button
                type="button"
                onClick={billTheBalance}
                className="raised tap-scale min-h-tap w-full rounded-2xl bg-surface px-4 text-[13px] font-semibold text-brand-ink"
              >
                {strings.payments.billBalance}
              </button>
            )}
            {billProblem !== null && (
              <p role="alert" className="text-[12px] leading-relaxed text-status-bad">
                {billProblem}
              </p>
            )}

            {/*
              WHAT THE PAYMENT JUST MADE (§K, §V).

              Two documents were created and issued without another tap, so
              the owner is told which two and can open either. Without this
              the app would quietly mint and number paperwork nobody saw —
              and a receipt the customer is owed would sit unnoticed.
            */}
            {settled !== null && (
              <div
                className="glass space-y-2 rounded-2xl p-3.5"
                role="status"
                data-settlement
              >
                <p className="text-[12.5px] font-semibold">{strings.payments.settledMade}</p>
                <button
                  type="button"
                  className="glass-pill min-h-tap w-full rounded-full px-4 text-[12.5px] font-semibold text-brand-ink"
                  onClick={() => navigate(documentPath(settled.receiptId))}
                >
                  {format(strings.payments.settledReceipt, {
                    reference:
                      documents.find((row) => row.id === settled.receiptId)?.issuedReference ?? '',
                  })}
                </button>
                {settled.balanceId !== null && (
                  <button
                    type="button"
                    className="glass-pill min-h-tap w-full rounded-full px-4 text-[12.5px] font-semibold text-brand-ink"
                    onClick={() => navigate(documentPath(settled.balanceId as string))}
                  >
                    {format(strings.payments.settledBalance, {
                      reference:
                        documents.find((row) => row.id === settled.balanceId)?.issuedReference ??
                        '',
                    })}
                  </button>
                )}
              </div>
            )}
            {settlementProblem !== null && (
              <p role="alert" className="text-[12px] leading-relaxed text-status-bad">
                {settlementProblem}
              </p>
            )}

            <BuilderCard
              title={strings.payments.title}
              icon="cash"
              ink={TYPE_PALETTE[record.type].ink}
            >
            <PaymentList
              payments={mine}
              prefill={prefillAmount(record.id, total, payments, mineCredits)}
              onRecord={(input) => {
                if (customer === undefined) return
                /*
                 * ONE ACT, TWO DOCUMENTS (§K, §V).
                 *
                 * The money lands, and the receipt and the balance invoice
                 * follow it without another tap. It used to take three
                 * gestures — record, then a button for the receipt, then a
                 * third for the balance — and the last two were easy to
                 * forget, so a customer who paid half got no evidence and no
                 * bill for the rest.
                 *
                 * THE PAYMENT IS WRITTEN FIRST, always. The money is the fact
                 * and the documents describe it: if the app dies between
                 * them the ledger is still right, because Outstanding is
                 * computed from payments and the original still carries the
                 * debt while no live follow-up exists. Pressing again is
                 * idempotent on both keys (§M). The other order would leave
                 * a receipt for money nothing had recorded.
                 */
                void settleAndBill({
                  input,
                  customerId: customer.id,
                })
              }}
              onReceipt={(payment) => {
                // §G: "originals are never altered; links persist". The link
                // lives on the receipt (`paymentId`), so a second tap finds
                // the one that exists instead of minting more evidence for
                // one event.
                const existing = receiptForPayment(documents, payment.id)
                if (existing !== null) {
                  navigate(documentPath(existing.id))
                  return
                }
                void actions
                  .createDraftWithKey(
                    receiptRecordFor({
                      payment,
                      description: format(strings.newReceipt.lineAgainst, {
                        label: typeInSentence(profile, 'invoice'),
                        reference: record.issuedReference ?? '',
                      }),
                      linkedInvoiceId: record.id,
                    }),
                    receiptKeyFor(payment.id),
                  )
                  .then((created) => navigate(editDocumentPath(created.id)))
              }}
            />

            </BuilderCard>

            <BuilderCard
              title={strings.chase.title}
              icon="bell"
              ink={TYPE_PALETTE[record.type].ink}
            >
              {outstanding.minor <= 0 ? (
                <p className="mt-1 text-xs opacity-70">{strings.chase.nothingToChase}</p>
              ) : (
                <>
                  <div className="mt-3 flex gap-2">
                    {(['softer', 'firmer'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={tone === option}
                        className={`min-h-tap flex-1 rounded-full border text-sm font-medium ${
                          tone === option ? 'border-transparent bg-brand text-white' : 'border-edge/10 bg-surface'
                        }`}
                        onClick={() => setTone(option)}
                      >
                        {option === 'softer' ? strings.chase.softer : strings.chase.firmer}
                      </button>
                    ))}
                  </div>
                  {chase !== null && (
                    <>
                      <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-ink/[0.04] p-3 text-xs">
                        {chase.text}
                      </pre>
                      <p className="mt-2 text-[11px] opacity-70">{strings.chase.nothingSendsUnseen}</p>
                    </>
                  )}
                </>
              )}
            </BuilderCard>

            {/*
              The schedule comes from the STORE, not from this screen.

              It lived in a `useState` here, written nowhere: switching Repeat
              on and navigating away switched it off again, and §L4's whole
              catch-up engine — idempotent keys, bounded missed periods —
              was reachable from nothing.
            */}
            <RepeatToggle
              recurrence={recurrence}
              unavailable={repeatsUnavailable}
              today={today}
              onStart={() => {
                void actions.startRepeat(record.id, record.issueDate ?? today)
              }}
              onStop={() => {
                void actions.stopRepeat(record.id, today)
              }}
            />
          </>
        )}

        {/*
          The statement lived here as a full-width button. It is a CUSTOMER
          action — every invoice against every payment for a period — and it
          belongs on the customer, not on one delivery that happens to name
          them. It is still reachable from the contact page (§G).
        */}
      </div>
    </div>
  )
}

/**
 * §G's copy-link actions (§P, §Q Phase 5).
 *
 * The link opens a page on the web, so unlike everything else in this app it
 * cannot work offline — §Q says so directly: "Copy-link actions disabled with
 * a 'needs internet' note until synced." That note is now TRUE, where before
 * the page did not exist and saying "needs internet" would have been a lie.
 *
 * The token is shown once and never stored (§P); only its hash is kept, so
 * there is nothing here to copy a second time. Copying again mints a fresh
 * link and kills the old one, which is also how an owner revokes one sent to
 * the wrong number.
 */

/**
 * The ONE step a delivery's status can take next (§M, §G).
 *
 * Three buttons used to sit on the screen for this — send it on its way, mark
 * it on the way, confirm delivery — and only ever one of them applied. They
 * are not actions on the document; they are its state moving forward, and §G's
 * four actions are what the space beside them is for.
 *
 * The ORDER is the lifecycle's, unchanged. Something that never left cannot
 * have arrived (§M), so dispatch comes before signing; "on the way" is the
 * optional middle a delivery may skip, because one signed for from "sent out"
 * is signed for just as well and a compulsory extra tap buys nothing (Rule #1).
 */
/** The word for whichever step is next. One control, one label. */
function statusLabel(
  next: ReturnType<typeof deliveryStatusStep>,
  strings: UiStrings,
): string {
  if (next === null) return ''
  if (next.kind === 'sign') return strings.signature.confirmDelivery
  return next.step === 'dispatched'
    ? strings.signature.sendOnItsWay
    : strings.signature.markOnTheWay
}

function deliveryStatusStep(
  record: Parameters<typeof canSign>[0] & Parameters<typeof nextDeliveryStep>[0],
): { kind: 'transition'; step: 'dispatched' | 'in_transit' } | { kind: 'sign' } | null {
  /*
   * THE REQUIRED STEP ONLY. Dispatch first, because something that never left
   * cannot have arrived (§M) — then signing.
   *
   * "On the way" is NOT here, and leaving it out is the point. It is the
   * optional middle: §G's own reasoning is that a delivery signed for from
   * "sent out" is signed for just as well, and a compulsory extra tap buys
   * nothing (Rule #1). Putting it in this control made it compulsory —
   * a dispatched delivery offered "Mark it on the way" INSTEAD of "Confirm
   * delivery", so the owner had to walk a step the spec calls optional
   * before they could do the one they came for.
   */
  /*
   * DISPATCH ONLY. Signing used to be the second half of this control, and
   * it is now the "Ask them to sign" pill — so keeping it here would put the
   * same act on screen twice, which is the duplication that took this page
   * to nine actions in the first place.
   *
   * The order is still the lifecycle's: something that never left cannot
   * have arrived (§M), so this is what has to happen before the pill can do
   * anything.
   */
  const out = nextDeliveryStep(record)
  return out === null ? null : { kind: 'transition', step: out }
}

function CopyLinkRow({
  anchorId,
  documentId,
  kind,
  typeLabel,
  reference,
  recipient,
  port,
  onSent,
}: {
  /** Where the action pill scrolls to, so the pill and the control agree. */
  anchorId: string
  documentId: string
  kind: 'accept' | 'sign'
  typeLabel: string
  reference: string
  recipient: string
  port: SharePort
  onSent: () => void
}) {
  const { strings } = useCompany()
  const { actions } = useAppData()
  const [copied, setCopied] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const online = typeof navigator === 'undefined' ? true : navigator.onLine

  if (!online) {
    return (
      <p id={anchorId} className="text-center text-[11px] opacity-70">
        {strings.publicLink.needsInternet}
      </p>
    )
  }

  return (
    <div id={anchorId} className="space-y-1">
      <button
        type="button"
        className="min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-4 text-sm font-medium"
        onClick={() => {
          setProblem(null)
          void actions
            .mintPublicLink(documentId, kind, window.location.origin)
            .then(async (url) => {
              setCopied(url)
              await navigator.clipboard?.writeText(url).catch(() => undefined)
            })
            .catch((cause: unknown) => {
              setProblem(
                format(strings.publicLink.mintFailed, {
                  reason: cause instanceof Error ? cause.message : String(cause),
                }),
              )
            })
        }}
      >
        {kind === 'accept' ? strings.publicLink.copyAccept : strings.publicLink.copySign}
      </button>

      {/*
        The link opens a SHEET rather than printing as a bare line under the
        button. It used to be minted, copied and shown as a URL with nothing
        saying what it was — and with no way to SEND it, when sending is the
        whole point and copying is the fallback for a platform with no share
        sheet.
      */}
      {copied !== null && (
        <SigningLinkSheet
          typeLabel={typeLabel}
          reference={reference}
          recipient={recipient}
          url={copied}
          port={port}
          onSent={onSent}
          onClose={() => setCopied(null)}
        />
      )}

      {problem !== null && (
        <p className="text-center text-[11px] text-status-warn" role="alert">
          {problem}
        </p>
      )}
    </div>
  )
}
