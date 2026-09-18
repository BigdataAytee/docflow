/**
 * The builder, wired (§G).
 *
 * Draft state lives here; the words, the validation and the page layout live
 * where they already did. Three rules shape it:
 *
 *  · **Draft saving is never blocked** (§G, Rule #1). Every commit is an
 *    `updateDraft`, and `canSaveDraft` is deliberately `true` — validation
 *    only ever gates ISSUE.
 *  · **A failed commit never shows "Saved."** `lastSavedAt` is set after the
 *    repository resolves, not before it is called (§C).
 *  · **Issue freezes the reference and the labels together, once** (§M). That
 *    is `issueDocument` plus one `issue` write; nothing here composes a
 *    reference or a label on its own.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'

import { useCompany } from '../context'
import { useAppData } from '../store'
import { HOME, documentPath, editDocumentPath, settingsPath } from '../paths'
import { deviceId } from '../device'
import { DOCUMENT_TYPES, type DocumentType } from '../../domain/documents/types'
/*
 * The SENTENCE form: "Payment for invoice INV-0004" puts the word inside a
 * sentence, and §D cases that by locale rather than by the call site. The
 * standalone form would print "Payment for Invoice INV-0004".
 */
import {
  label as typeLabel,
  labelInSentence as typeInSentence,
  numberingPrefix,
} from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { percentToPpm } from '../../domain/money/money'
import { invoiceOutstanding } from '../../domain/payments/ledger'
import { regionProfile } from '../../features/settings/region'
import {
  type BuilderState,
  clampStep,
  stepKeysFor,
  committed,
  edit,
  firstProblemStep,
  goToStep,
  validateForIssue,
} from '../../features/documents/builder'
import { BuilderShell } from '../../features/documents/BuilderShell'
import { LivePreview } from '../../features/documents/LivePreview'
import { IssueError, issueDocument } from '../../features/documents/issue'
import {
  type Design,
  composableOf,
  composeOptionsOf,
  designOf,
  draftOf,
  replacesOf,
} from '../../features/documents/composition'
import { type Money, money } from '../../domain/money/money'
import { NewReceiptSheet } from '../../features/payments/NewReceiptSheet'
import { ReceiptStart } from '../../features/payments/ReceiptStart'
import { OwedPicker } from '../../features/payments/OwedPicker'
import { InvoicePicker } from '../../features/payments/InvoicePicker'
import { PayInvoice } from '../../features/payments/PayInvoice'
import { SignaturePad } from '../../features/signature/SignaturePad'
import { availableMethods } from '../../features/payments/methods'
import {
  type SettleableInvoice,
  frozenPicture,
  receiptKeyFor,
  receiptRecordFor,
  settleableInvoices,
  startReceipt,
} from '../../features/payments/receiptFlow'
import type { ComposableDocument } from '../../pdf/compose'
import type { Customer } from '../../data/repositories'
import { SkeletonList } from '../../ui'
import { StepBody } from './builderSteps'
import { billedInvoices, documentsOf, totalOf } from '../derive'
import { localDay, todayIso } from '../../domain/dates/calendar'
import { usableMethodCount } from '../../features/payments/readiness'

const isDocumentType = (value: string | undefined): value is DocumentType =>
  value !== undefined && (DOCUMENT_TYPES as readonly string[]).includes(value)

/** `/new/:type` — makes the draft once, then hands over to `/edit/:id`. */
export function NewDocumentScreen() {
  const { type } = useParams<{ type: string }>()
  const { company, actions } = useAppData()
  const navigate = useNavigate()
  const started = useRef(false)

  // §G: a receipt is evidence of a payment, so starting one records the
  // payment first. Every other type starts as an empty draft.
  const needsPaymentFirst = type === 'receipt'

  useEffect(() => {
    if (started.current || needsPaymentFirst || !isDocumentType(type) || company === null) return
    started.current = true
    void actions
      .createDraft(type, company.currency, company.defaultSignatureAssetId ?? undefined)
      .then((created) => {
        // `created` rides along so the builder's header can say "New
        // invoice" rather than the draft's reference. It is a fact about how
        // somebody ARRIVED, which no record field can carry: a draft opened
        // from the list tomorrow is the same row, and is not new.
        navigate(editDocumentPath(created.id), { replace: true, state: { created: true } })
      })
  }, [type, needsPaymentFirst, company, actions, navigate])

  if (!isDocumentType(type)) return <Navigate to={HOME} replace />
  if (needsPaymentFirst) return <NewReceiptFlow />
  return <NewDocumentSkeleton />
}

/**
 * `/new/receipt` — §G's "starting one from Home records a payment first,
 * optionally linked to an invoice or standing alone, never inventing a
 * duplicate invoice".
 *
 * The order is structural, not a convention: the payment is written, and the
 * draft is derived from what came back. There is no path through this
 * component that produces a document without a payment behind it, which is
 * what makes §V's "issuing or resharing its receipt never increments income"
 * true by construction.
 */
function NewReceiptFlow({ today = todayIso() }: { today?: string }) {
  const { profile, strings } = useCompany()
  const { company, customers, documents, payments, creditNotes, assets, loading, actions } =
    useAppData()
  const navigate = useNavigate()

  const [problem, setProblem] = useState<string | null>(null)
  /*
   * WHERE IN THE TWO PATHS THIS IS.
   *
   * `start` asks the one question that divides the journeys; `owed` picks a
   * debtor; `form` is the form, which asks a different first question
   * depending on how it was reached (§G, Rule #1).
   *
   * The owner built this app and could not work out how to create a receipt,
   * because the form opened on "Who paid?" — a list of existing customers —
   * which is the wrong first question for cash from somebody not in the book.
   */
  const [step, setStep] = useState<'start' | 'owed' | 'invoice' | 'pay' | 'form'>('start')
  const [mode, setMode] = useState<'owed' | 'cash'>('cash')
  const [payerId, setPayerId] = useState('')
  /** Path A's chosen bill, and the mark that will print on its receipt. */
  const [invoiceId, setInvoiceId] = useState('')
  const [signatureAssetId, setSignatureAssetId] = useState<string | undefined>(undefined)
  const [signProblem, setSignProblem] = useState<string | null>(null)
  // One id per submission, so a double tap collapses onto one payment and one
  // receipt rather than two of each (§M). Cleared only on a failure.
  const submission = useRef<string | null>(null)
  const busy = useRef(false)

  const invoices = useMemo<SettleableInvoice[]>(
    () =>
      documents
        .filter(
          (document) =>
            document.type === 'invoice' &&
            document.customerId !== undefined &&
            document.status !== 'draft' &&
            document.status !== 'void',
        )
        .map((document) => ({
          id: document.id,
          customerId: document.customerId ?? '',
          reference:
            document.issuedReference ??
            `${company?.numberingPrefixes?.[document.type] ?? numberingPrefix(profile, document.type)}-…`,
          outstanding: invoiceOutstanding(
            document.id,
            totalOf(document),
            payments,
            creditNotes.filter((note) => note.invoiceId === document.id),
          ),
          /*
           * ENOUGH TO RECOGNISE THE BILL BY, and to print its receipt.
           *
           * The date and the goods are what a trader remembers; the face
           * value beside the balance is what says a part payment already
           * happened. The same three go onto the receipt at issue, so what
           * was picked from and what gets printed cannot disagree.
           */
          issueDate: document.issueDate ?? today,
          total: totalOf(document),
          lineItems: document.lineItems,
        })),
    [documents, payments, creditNotes, company, profile, today],
  )


  /*
   * ONE IMPLEMENTATION FOR BOTH PATHS.
   *
   * The two entries differ only in how the payer is named — picked from the
   * debtors list, or typed and matched. Everything after that is identical
   * and must stay identical: the payment is written first and on its own, the
   * receipt is derived from what the repository acknowledged, and §V's
   * "issuing or resharing a receipt never increments income" holds because a
   * receipt can never be the thing that records money.
   */
  const recordAndDraw = (input: {
    customerId: string
    amount: Money
    paidAt: string
    method: string
    reference?: string
    invoiceId?: string
  }): void => {
    /*
     * THE DOUBLE-TAP GUARD IS THE CALLER'S, not this function's.
     *
     * It used to be the first line here, and the typed-name path sets `busy`
     * before it can resolve the customer — so this returned immediately and
     * the payment was never written. A guard that both halves try to own is a
     * guard one of them loses.
     */
    setProblem(null)
    submission.current ??= `sub:${deviceId()}:${Date.now()}`

    const chosen = invoices.find((invoice) => invoice.id === input.invoiceId)
    let started
    try {
      started = startReceipt({
        paymentId: submission.current,
        customerId: input.customerId,
        amount: input.amount,
        paidAt: input.paidAt,
        method: input.method,
        ...(input.reference === undefined ? {} : { reference: input.reference }),
        ...(chosen === undefined
          ? {}
          : {
              invoiceId: chosen.id,
              // The total the allocation is capped against is the
              // BALANCE, not the face value: an earlier part payment
              // already took its share (§K).
              invoiceTotal: chosen.outstanding,
              existingPayments: [],
            }),
      })
    } catch (cause) {
      busy.current = false
      submission.current = null
      setProblem(
        format(strings.newReceipt.failed, {
          reason: cause instanceof Error ? cause.message : String(cause),
        }),
      )
      return
    }

    // The repository mints the real id; the one `startReceipt` built the
    // allocations against was only ever a local handle.
    const { id: _localId, ...withoutId } = started.payment
    const { paymentKey } = started
    void actions
      // The payment, first and on its own. Nothing below runs until the
      // repository has acknowledged it (§M).
      .recordPayment(withoutId, paymentKey)
      .then((recorded) =>
        actions.createDraftWithKey(
          receiptRecordFor({
            payment: recorded,
            description:
              chosen === undefined
                ? strings.newReceipt.lineStandalone
                : format(strings.newReceipt.lineAgainst, {
                    label: typeInSentence(profile, 'invoice'),
                    reference: chosen.reference,
                  }),
            ...(chosen === undefined ? {} : { linkedInvoiceId: chosen.id }),
            /*
             * The balance BEFORE this payment, so the receipt can freeze
             * what is left after it (§I, Rule #5).
             *
             * `chosen.outstanding` is the same figure the allocation was
             * capped against a few lines up, so the money the receipt
             * reports and the money the ledger moved cannot disagree.
             */
            ...(chosen === undefined
              ? {}
              : {
                  invoiceOutstandingBefore: chosen.outstanding,
                  /*
                   * THE WHOLE PICTURE, frozen at issue (Rule #5).
                   *
                   * The invoice's own goods, so the receipt says what the
                   * money was for; its face value and what had already
                   * arrived, so the customer holding the PDF can add the
                   * three figures up and get the balance printed beneath.
                   */
                  invoiceLineItems: chosen.lineItems,
                  invoiceTotal: chosen.total,
                }),
          }),
          receiptKeyFor(recorded.id),
        ),
      )
      .then((created) => navigate(editDocumentPath(created.id), { replace: true }))
      .catch((cause: unknown) => {
        busy.current = false
        submission.current = null
        setProblem(
          format(strings.newReceipt.failed, {
            reason: cause instanceof Error ? cause.message : String(cause),
          }),
        )
      })
  }

  /*
   * The region's own date format, so a picked row reads like the printed
   * page (§D). Resolved the way the composed document resolves it, rather
   * than a second table beside it.
   */
  const receiptDateFormat = useMemo(() => {
    try {
      return regionProfile(company?.localeRegion ?? '').dateFormat
    } catch {
      return undefined
    }
  }, [company])

  /** Path A's chosen bill, and the customer it belongs to. */
  const chosenInvoice = invoices.find((invoice) => invoice.id === invoiceId)
  const payer = customers.find((row) => row.id === payerId)
  const signatureUrl =
    signatureAssetId === undefined
      ? undefined
      : assets.find((asset) => asset.id === signatureAssetId)?.dataUrl

  /*
   * PATH A, END TO END, FROM ONE BUTTON (§G, §K, §V).
   *
   * Payment, receipt, issue, PDF — in that order, and with nothing asked in
   * between. The order is structural: the payment is written first and on its
   * own, the receipt is derived from what the repository acknowledged, and
   * the issue freezes what the customer will hold. A receipt can never be the
   * thing that records money, so §V's "issuing or resharing never increments
   * income" stays true by construction.
   *
   * IT ISSUES RATHER THAN LEAVING A DRAFT. The owner asked for "tapping it
   * writes the payment and issues the receipt immediately, then shows the
   * PDF" — a draft would mean the customer standing there is handed nothing,
   * and a second, unexplained step before the thing they came for.
   */
  const payAndIssue = (input: {
    amount: Money
    paidAt: string
    method: string
    reference?: string
  }): void => {
    if (busy.current || chosenInvoice === undefined || company === null) return
    busy.current = true
    setProblem(null)
    submission.current ??= `sub:${deviceId()}:${Date.now()}`
    const invoice = chosenInvoice

    let started
    try {
      started = startReceipt({
        paymentId: submission.current,
        customerId: payerId,
        amount: input.amount,
        paidAt: input.paidAt,
        method: input.method,
        ...(input.reference === undefined ? {} : { reference: input.reference }),
        invoiceId: invoice.id,
        // Capped against the BALANCE, not the face value: an earlier part
        // payment already took its share (§K).
        invoiceTotal: invoice.outstanding,
        existingPayments: [],
      })
    } catch (cause) {
      busy.current = false
      submission.current = null
      setProblem(
        format(strings.newReceipt.failed, {
          reason: cause instanceof Error ? cause.message : String(cause),
        }),
      )
      return
    }

    const { id: _localId, ...withoutId } = started.payment
    const { paymentKey } = started
    void actions
      .recordPayment(withoutId, paymentKey)
      .then((recorded) =>
        actions.createDraftWithKey(
          {
            ...receiptRecordFor({
              payment: recorded,
              description: format(strings.newReceipt.lineAgainst, {
                label: typeInSentence(profile, 'invoice'),
                reference: invoice.reference,
              }),
              linkedInvoiceId: invoice.id,
              invoiceOutstandingBefore: invoice.outstanding,
              invoiceLineItems: invoice.lineItems,
              invoiceTotal: invoice.total,
            }),
            ...(signatureAssetId === undefined ? {} : { signatureAssetId }),
          },
          receiptKeyFor(recorded.id),
        ),
      )
      .then(async (created) => {
        /*
         * ISSUED THROUGH THE ORDINARY PATH, not a shortcut beside it.
         *
         * `issueDocument` is where the reference, the labels and the totals
         * freeze together (§M, Rule #5). A receipt issued some other way
         * would be the one document in the app whose numbering and frozen
         * words came from somewhere else.
         */
        const issued = issueDocument({
          draft: draftOf(created),
          currentStatus: created.status,
          context: {
            enabledPaymentMethodCount: (company.enabledPaymentMethods ?? []).length,
            usablePaymentMethodCount: usableMethodCount({
              currency: company.currency,
              enabled: company.enabledPaymentMethods ?? [],
              bankValues: company.bankFields ?? {},
            }),
            paymentIsRecorded: true,
            signatureRequired: company.signatureRequired === true,
          },
          profile,
          prefix: company.numberingPrefixes?.receipt ?? numberingPrefix(profile, 'receipt'),
          /*
           * PLUS ONE, because this receipt is not in `documents` yet.
           *
           * The builder counts after the draft has been loaded, so its own
           * row is already in the tally. Here the create has only just
           * resolved and the list in hand is the one from before it, which
           * made the first receipt of a business ask for sequence zero —
           * and `buildReference` refuses that rather than printing INV-0000.
           */
          sequence: documentsOf(documents, 'receipt').length + 1,
          fromReservedBlock: false,
          deviceId: deviceId(),
          issuedAt: new Date().toISOString(),
        })
        await actions.issue(created.id, {
          reference: issued.reference,
          frozenLabels: issued.frozenLabels,
          totalMinor: issued.totals?.payable.minor ?? 0,
        })
        return created
      })
      // The DOCUMENT, not its builder: what was asked for is the PDF, and an
      // issued document has nothing left to edit (Rule #5).
      .then((created) => navigate(documentPath(created.id), { replace: true }))
      .catch((cause: unknown) => {
        busy.current = false
        submission.current = null
        setProblem(
          format(strings.newReceipt.failed, {
            reason: cause instanceof Error ? cause.message : String(cause),
          }),
        )
      })
  }

  if (loading || company === null) return <NewDocumentSkeleton />

  if (step === 'start') {
    return (
      <div className="px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <ReceiptStart
          anyoneOwes={invoices.some((invoice) => invoice.outstanding.minor > 0)}
          onOwed={() => {
            setMode('owed')
            setStep('owed')
          }}
          onCash={() => {
            setMode('cash')
            setStep('form')
          }}
          onClose={() => navigate(HOME)}
        />
      </div>
    )
  }

  if (step === 'owed') {
    return (
      <div className="px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <OwedPicker
          customers={customers}
          invoices={invoices}
          currency={company.currency}
          onPick={(id) => {
            setPayerId(id)
            // PATH A NEVER REACHES THE FORM. Which bill, then one page —
            // no items step, no design step, no review (§G, Rule #1).
            setInvoiceId('')
            setStep('invoice')
          }}
          onBack={() => setStep('start')}
        />
      </div>
    )
  }

  if (step === 'invoice') {
    return (
      <div className="px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <InvoicePicker
          payerName={payer?.name ?? ''}
          invoices={settleableInvoices(invoices, payerId, company.currency)}
          {...(receiptDateFormat === undefined ? {} : { dateFormat: receiptDateFormat })}
          onPick={(invoice) => {
            setInvoiceId(invoice.id)
            setStep('pay')
          }}
          onBack={() => setStep('owed')}
        />
      </div>
    )
  }

  if (step === 'pay' && chosenInvoice !== undefined) {
    return (
      <div className="px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <PayInvoice
          payerName={payer?.name ?? ''}
          invoice={chosenInvoice}
          currency={company.currency}
          today={today}
          methods={availableMethods(company.enabledPaymentMethods, strings)}
          {...(signatureUrl === undefined ? {} : { signatureUrl })}
          {...(signProblem === null ? {} : { signatureError: signProblem })}
          {...(company.defaultSignatureAssetId == null
            ? {}
            : {
                onUseDefaultSignature: () =>
                  setSignatureAssetId(company.defaultSignatureAssetId ?? undefined),
              })}
          onDrawSignature={(drawn) => {
            // Stored first, then referenced. A draft pointing at an asset the
            // repository never accepted would print a blank signature and
            // claim to be signed (§P).
            void actions
              .storeAsset('signature', drawn.dataUrl)
              .then((asset) => {
                setSignProblem(null)
                setSignatureAssetId(asset.id)
              })
              .catch((cause: unknown) => {
                setSignProblem(
                  format(strings.signature.failed, {
                    reason: cause instanceof Error ? cause.message : String(cause),
                  }),
                )
              })
          }}
          renderPreview={(live) => (
            <PayInvoicePreview
              invoice={chosenInvoice}
              state={live}
              customer={payer}
              today={today}
              {...(signatureAssetId === undefined ? {} : { signatureAssetId })}
            />
          )}
          onRecord={payAndIssue}
          onBack={() => setStep('invoice')}
          {...(problem === null ? {} : { error: problem })}
        />
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <NewReceiptSheet
        mode={mode}
        {...(mode === 'owed' ? { payerId } : {})}
        onRecordByName={(input) => {
          if (busy.current) return
          busy.current = true
          setProblem(null)
          submission.current ??= `sub:${deviceId()}:${Date.now()}`

          /*
           * A NAME BECOMES A CUSTOMER, as a consequence of being paid.
           *
           * Matched case-insensitively against the book first, so paying
           * "ade stores" twice does not leave two of them; created only when
           * nobody matches. Never a toll before the money can be recorded —
           * which is what "never force creating a contact first" means (§G).
           */
          const existing = customers.find(
            (row) => row.name.trim().toLowerCase() === input.name.toLowerCase(),
          )
          void (existing !== undefined
            ? Promise.resolve(existing)
            : actions.addCustomer({ kind: 'person', name: input.name, labels: [] })
          )
            .then((customer) =>
              recordAndDraw({
                customerId: customer.id,
                amount: input.amount,
                paidAt: input.paidAt,
                method: input.method,
                ...(input.reference === undefined ? {} : { reference: input.reference }),
              }),
            )
            .catch((cause: unknown) => {
              busy.current = false
              submission.current = null
              setProblem(
                format(strings.newReceipt.failed, {
                  reason: cause instanceof Error ? cause.message : String(cause),
                }),
              )
            })
        }}
        currency={company.currency}
        today={today}
        customers={customers}
        invoices={invoices}
        methods={availableMethods(company.enabledPaymentMethods, strings)}
        onClose={() => setStep('start')}
        {...(problem === null ? {} : { error: problem })}
        onRecord={(input) => {
          if (busy.current) return
          busy.current = true
          recordAndDraw(input)
        }}
      />
    </div>
  )
}


/**
 * The receipt Path A is about to issue, drawn as it will print (§H, Rule #5).
 *
 * THE SAME COMPOSITION AS THE PRINTED PAGE — `composableOf`, `composeDocument`
 * and `DocumentPage`, exactly as Review and the PDF use them. A second
 * renderer here could disagree with the thing actually shared, which is the
 * whole class of bug §H's "one piece of state" clause exists to prevent.
 *
 * AND THE SAME ARITHMETIC as the record that gets written: `frozenPicture` is
 * called once here and once in `receiptRecordFor`, from the same three inputs.
 * Two copies of that sum would eventually disagree, and the disagreement would
 * be somebody signing under a balance the printed receipt contradicts.
 */
function PayInvoicePreview({
  invoice,
  state,
  customer,
  today,
  signatureAssetId,
}: {
  invoice: SettleableInvoice
  state: { amountMinor: number; paidAt: string; method: string }
  customer: Customer | undefined
  today: string
  signatureAssetId?: string
}) {
  const { profile, strings } = useCompany()
  const { company, assets } = useAppData()
  const design = useMemo(() => designOf(undefined, company), [company])

  const picture = frozenPicture({
    invoiceTotal: invoice.total,
    outstandingBefore: invoice.outstanding,
    paidMinor: state.amountMinor,
  })

  const composable = composableOf({
    draft: {
      type: 'receipt',
      currency: invoice.outstanding.currency,
      // The INVOICE's goods, which is what the issued receipt will carry.
      lineItems: invoice.lineItems,
      issueDate: state.paidAt,
      linkedInvoiceId: invoice.id,
      ...picture,
      ...(customer === undefined ? {} : { customerId: customer.id }),
      ...(signatureAssetId === undefined ? {} : { signatureAssetId }),
    },
    design,
    company,
    customer,
    profile,
    reference: null,
    status: 'draft',
    frozenLabels: null,
    replaces: null,
    today,
    againstReference: invoice.reference,
    payment: {
      amount: money(invoice.outstanding.currency, state.amountMinor),
      at: state.paidAt,
      method: state.method,
    },
  })

  return (
    <LivePreview
      document={composable}
      templateId={design.templateId}
      composeOptions={composeOptionsOf({ company, design, strings, assets })}
      brandColour={design.brandColour}
    />
  )
}

function NewDocumentSkeleton() {
  const { strings } = useCompany()
  return (
    <div className="px-4 py-6">
      <SkeletonList rows={4} label={strings.common.loading} />
    </div>
  )
}

export function BuilderScreen({ now = () => new Date().toISOString() }: { now?: () => string }) {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const justCreated = (location.state as { created?: boolean } | null)?.created === true
  const { profile, strings } = useCompany()
  const { company, customers, documents, payments, assets, loading, actions } = useAppData()
  const navigate = useNavigate()

  /*
   * §G's payment detour, with the way back attached.
   *
   * The builder used to navigate to the panel and leave the person there —
   * no statement of why they had moved and no route home but the system back
   * gesture, which mid-task is the one thing people will not risk. The draft
   * is already autosaved before this fires (§G), so carrying the route is the
   * whole of what the return band needs.
   */
  const goToPaymentSettings = () => {
    navigate(settingsPath('payment'), {
      state: { returnTo: location.pathname, errand: 'payment' },
    })
  }

  const record = documents.find((document) => document.id === id)

  const [state, setState] = useState<BuilderState | null>(null)
  // The four design choices, together — they are stored together, they are
  // seeded together, and they freeze together at issue (§H, Rule #5).
  const [design, setDesign] = useState<Design>(() => designOf(undefined, null))
  const [issueProblem, setIssueProblem] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [signProblem, setSignProblem] = useState<string | null>(null)

  // Seeded once from the stored record; after that the screen owns the draft
  // and the record follows it, not the other way round.
  useEffect(() => {
    if (state !== null || record === undefined) return
    setState({
      step: 0,
      draft: draftOf(record),
      dirty: false,
    })
    // The design the document was SAVED with, not a fresh default — closing
    // this screen used to throw the choice away, so reopening a document
    // showed somebody else's design back to them.
    setDesign(designOf(record, company))
  }, [state, record, company])

  /**
   * A design change is a change to the document, so it marks the draft dirty.
   *
   * Without that, `commit` returns early on an otherwise-untouched draft and
   * the choice is never written — which is how all four of these managed to
   * be collected, previewed and then silently discarded.
   */
  const changeDesign = useCallback((patch: Partial<Design>) => {
    setDesign((current) => ({ ...current, ...patch }))
    setState((latest) => (latest === null ? latest : edit(latest, {})))
  }, [])

  /**
   * The latest draft, for the unmount commit below.
   *
   * A ref rather than a dependency, because the cleanup must see what was on
   * screen at the moment the screen went away — and an effect that re-runs on
   * every keystroke to keep a dependency fresh would commit on every keystroke.
   */
  const latest = useRef<BuilderState | null>(null)

  const commit = useCallback(
    async (current: BuilderState) => {
      if (id === undefined || !current.dirty) return
      const { draft } = current
      // Everything the draft holds, not a chosen subset. A field the builder
      // collects and the commit drops is typed, believed and then lost —
      // which is what happened to the delivery address, the driver, the
      // dispatch date and the signature until this line was widened.
      await actions.updateDraft(id, {
        currency: draft.currency,
        lineItems: draft.lineItems,
        ...(draft.customerId === undefined ? {} : { customerId: draft.customerId }),
        ...(draft.issueDate === undefined ? {} : { issueDate: draft.issueDate }),
        ...(draft.dueDate === undefined ? {} : { dueDate: draft.dueDate }),
        ...(draft.validUntil === undefined ? {} : { validUntil: draft.validUntil }),
        ...(draft.signatureAssetId === undefined
          ? {}
          : { signatureAssetId: draft.signatureAssetId }),
        ...(draft.invoiceTotalMinor === undefined
          ? {}
          : { invoiceTotalMinor: draft.invoiceTotalMinor }),
        ...(draft.paidBeforeMinor === undefined ? {} : { paidBeforeMinor: draft.paidBeforeMinor }),
        ...(draft.deliveryAddress === undefined ? {} : { deliveryAddress: draft.deliveryAddress }),
        ...(draft.driverName === undefined ? {} : { driverName: draft.driverName }),
        ...(draft.vehicleNumber === undefined ? {} : { vehicleNumber: draft.vehicleNumber }),
        ...(draft.dispatchDate === undefined ? {} : { dispatchDate: draft.dispatchDate }),
        ...(draft.expectedDate === undefined ? {} : { expectedDate: draft.expectedDate }),
        // The design travels with the document (§H). Four scalars, so the
        // saved record can draw itself without this screen being open.
        templateId: design.templateId,
        showLogo: design.showLogo,
        brandColour: design.brandColour,
        discountRatePpm: percentToPpm(design.discountPercent),
      })
      // Only now — a commit that threw must not print "Saved" (§C).
      setState((latest) => (latest === null ? latest : committed(latest, now())))
    },
    [id, actions, now, design],
  )

  /*
   * WHATEVER IS ON SCREEN IS SAVED WHEN THE SCREEN GOES AWAY (§G, Rule #1).
   *
   * Autosave fired on STEP CHANGE and nowhere else, so every route out of the
   * builder that is not the step bar threw away everything since the last
   * one — and the Items step has a catalogue link in its own header, one tap
   * from the rows it discards.
   *
   * Found by walking it: a photograph attached to a line, visible on the row,
   * gone from the printed page after a trip to Saved items and back. Nothing
   * failed and nothing said so; the draft was simply re-seeded from a record
   * that had never been written to. It was never about photographs — any item
   * edit, any typed address, went the same way.
   *
   * Refs rather than dependencies on purpose. The cleanup has to see what was
   * on screen at the MOMENT the screen went away, and an effect that re-ran to
   * keep a dependency fresh would commit on every keystroke.
   */
  const committer = useRef(commit)
  latest.current = state
  committer.current = commit

  useEffect(
    () => () => {
      const leaving = latest.current
      // `commit` returns early on a clean draft, so this costs nothing on the
      // way out of a document nobody touched.
      if (leaving !== null) void committer.current(leaving)
    },
    [],
  )

  /*
   * The payment half of the issue context, computed ONCE (§J).
   *
   * The band on Review and the attempt to issue both read it, and two copies
   * of this arithmetic would eventually disagree — which would mean a Review
   * screen saying everything is fine over a button that refuses.
   */
  const paymentContext = useMemo(() => {
    const enabled = company?.enabledPaymentMethods ?? []
    return {
      enabledPaymentMethodCount: enabled.length,
      usablePaymentMethodCount: usableMethodCount({
        currency: company?.currency ?? state?.draft.currency ?? '',
        enabled,
        bankValues: company?.bankFields ?? {},
      }),
    }
  }, [company, state])

  const problems = useMemo(() => {
    if (state === null) return []
    return validateForIssue(state.draft, {
      ...paymentContext,
      paymentIsRecorded:
        state.draft.paymentId !== undefined &&
        payments.some((payment) => payment.id === state.draft.paymentId),
      signatureRequired: company?.signatureRequired === true,
    })
  }, [state, paymentContext, payments, company])

  const customer = customers.find((row) => row.id === state?.draft.customerId)

  /** The draft's own mark, and the one Settings saved — both resolved by id. */
  const assetUrl = (id: string | undefined): string | undefined =>
    id === undefined ? undefined : assets.find((asset) => asset.id === id)?.dataUrl
  const signatureUrl = assetUrl(state?.draft.signatureAssetId)

  /*
   * The line photos, by id — resolved ONCE for the whole step (§G step 2).
   *
   * Every asset is a `data:` URL held in memory, so a lookup per row per
   * render would be a linear scan over every logo, signature and delivery
   * photo the business owns, on a list that can be long.
   */
  const photoUrls = useMemo(
    () => Object.fromEntries(assets.map((asset) => [asset.id, asset.dataUrl])),
    [assets],
  )
  const defaultSignatureId = company?.defaultSignatureAssetId ?? undefined

  /** One place the mark reaches the draft, whether drawn now or saved before. */
  const signWith = (assetId: string) => {
    setSigning(false)
    setState((current) => (current === null ? current : edit(current, { signatureAssetId: assetId })))
  }

  // The balance chip on the customer card reads the same figures the contact
  // page does, so the two can never disagree.
  const invoices = useMemo(() => billedInvoices(documents), [documents])

  // VAT / GST / Sales tax / TVA — the label comes from the region, the rate
  // from the company. §D: the word moves with the country, never the number.
  const taxLabel = useMemo(() => {
    try {
      return regionProfile(company?.localeRegion ?? '').taxLabel
    } catch {
      return strings.settings.tax
    }
  }, [company, strings])

  // All three derived through the shared composition (§H, Rule #5): the
  // saved-document screen draws the same page from the same functions, so the
  // preview and the print cannot disagree about a discount or a label.
  const replaces = useMemo(() => replacesOf(documents, record), [documents, record])

  const composable = useMemo<ComposableDocument>(
    () =>
      composableOf({
        draft: state?.draft ?? { type: 'invoice', currency: 'NGN', lineItems: [] },
        design,
        company,
        customer,
        profile,
        reference: record?.issuedReference ?? null,
        status: record?.status ?? 'draft',
        frozenLabels: record?.frozenLabels ?? null,
        replaces,
        // `now()` is an INSTANT; an issue date is a DAY.
        today: localDay(now()),
      }),
    [state, record, customer, company, design, profile, now, replaces],
  )

  const composeOptions = useMemo(
    () => composeOptionsOf({ company, design, strings, assets }),
    [company, design, strings, assets],
  )

  if (loading) return <SkeletonList rows={4} label={strings.common.loading} />
  if (record === undefined || id === undefined) return <Navigate to={HOME} replace />
  if (state === null) return <SkeletonList rows={4} label={strings.common.loading} />

  const close = () => {
    /*
     * REPLACE, NOT PUSH — and this was a trap.
     *
     * Leaving the builder pushed the saved document ON TOP of it, so the
     * builder stayed on the stack behind the thing you had just left it for:
     *
     *     Home → /edit/x → (✕) → /doc/x → (Back) → /edit/x → (✕) → /doc/x …
     *
     * Back and forth between the two, for ever, with Home buried underneath
     * and unreachable by the one control that should reach it. An owner who
     * had not finished editing could not get out.
     *
     * The builder is a STEP on the way to the document, not a place to return
     * to: you left it, so it leaves the history with you. Back from the
     * document then goes where the builder was opened from, which is what
     * anybody pressing it means.
     *
     * Pending edits still flush on exit (§G), and the page leaves either way.
     */
    void commit(state).finally(() => navigate(documentPath(id), { replace: true }))
  }

  /*
   * THE RATES THIS DOCUMENT IS COMPUTED AT.
   *
   * The document's own override where it has one, the company default
   * otherwise — one place deciding it, so the figure on the Totals step, the
   * figure on the printed page and the figure frozen at issue are the same
   * number by construction rather than by three call sites agreeing.
   *
   * Settings remains the only place the DEFAULT changes; this is a value for
   * this document, and it never writes back to the company.
   */
  const effectiveTaxPpm = state.draft.taxRatePpm ?? company?.taxRatePpm
  const effectiveWhtPpm =
    state.draft.type === 'invoice' ? (state.draft.whtRatePpm ?? company?.whtRatePpm) : undefined

  const save = () => {
    // §G: "draft saving is always allowed", and final issue validates. The
    // amber band already lists what is missing, so pressing Save takes the
    // owner TO the first missing thing rather than throwing at them.
    if (problems.length > 0) {
      const target = firstProblemStep(problems)
      setIssueProblem(strings.builder.notReadyYet)
      if (target !== null) setState(goToStep(state, target))
      return
    }

    let issued
    try {
      issued = issueDocument({
        draft: state.draft,
        currentStatus: record.status,
        context: {
          ...paymentContext,
          paymentIsRecorded:
            state.draft.paymentId !== undefined &&
            payments.some((payment) => payment.id === state.draft.paymentId),
          signatureRequired: company?.signatureRequired === true,
        },
        profile,
        prefix:
          company?.numberingPrefixes?.[state.draft.type] ??
          numberingPrefix(profile, state.draft.type),
        // §M: a server-reserved block where available; offline, a device tag.
        sequence: documentsOf(documents, state.draft.type).length,
        fromReservedBlock: false,
        deviceId: deviceId(),
        /*
         * §G's pencil, consumed here. Absent means the generated sequence,
         * which is what almost every document uses. A collision is refused by
         * §M's unique (company_id, type, issued_reference) and surfaces
         * through the catch below as an actionable per-record error.
         */
        ...(state.draft.referenceOverride === undefined
          ? {}
          : { referenceOverride: state.draft.referenceOverride }),
        issuedAt: now(),
        ...(design.discountPercent === 0
          ? {}
          : { discountRate: percentToPpm(design.discountPercent) }),
        ...(effectiveTaxPpm === undefined ? {} : { taxRate: effectiveTaxPpm }),
        ...(effectiveWhtPpm === undefined ? {} : { whtRate: effectiveWhtPpm }),
      })
    } catch (cause) {
      // §M: a failed operation carries an actionable per-record error. The
      // draft is untouched, so nothing the owner typed is lost.
      setIssueProblem(
        cause instanceof IssueError
          ? format(strings.builder.couldNotIssue, { reason: cause.message })
          : format(strings.builder.couldNotIssue, { reason: String(cause) }),
      )
      return
    }

    setIssueProblem(null)
    void commit(state)
      .then(() =>
        actions.issue(id, {
          reference: issued.reference,
          frozenLabels: issued.frozenLabels,
          totalMinor: issued.totals?.payable.minor ?? 0,
          /*
           * THE RATE FREEZES WITH THEM (Rule #5).
           *
           * Reference, totals and labels freeze at issue, and the rate is the
           * EXPLANATION of the total — so leaving it on the company alone
           * meant an invoice issued last year re-printed this year's
           * percentage beside a figure frozen at the old one. Whatever this
           * document was actually computed at is what it keeps.
           */
          ...(effectiveTaxPpm === undefined ? {} : { taxRatePpm: effectiveTaxPpm }),
          ...(effectiveWhtPpm === undefined ? {} : { whtRatePpm: effectiveWhtPpm }),
        }),
      )
      /*
       * Replace for the same reason as `close`: an issued document must not
       * leave its own builder sitting behind it on the stack, where Back
       * would return somebody to editing a document that Rule #5 has already
       * frozen.
       */
      .then(() => navigate(documentPath(id), { replace: true }))
      .catch((cause: unknown) =>
        setIssueProblem(format(strings.builder.couldNotIssue, { reason: String(cause) })),
      )
  }

  return (
    <BuilderShell
      type={state.draft.type}
      // Absent while creating, so the header reads "New invoice"; otherwise
      // the issued reference, falling back to the plain type name.
      {...(justCreated ? {} : { reference: record?.issuedReference ?? '' })}
      step={state.step}
      // So the shell knows how many steps THIS document runs: a receipt
      // settling an invoice has no items step (§G).
      draft={state.draft}
      dirty={state.dirty}
      lastSavedAt={state.lastSavedAt}
      problems={problems}
      onClose={close}
      onSave={save}
      onStep={(target) => {
        // Drafts autosave on step change with a visible saved state (§G).
        void commit(state)
        setState(goToStep(state, clampStep(target, stepKeysFor(state.draft).length)))
      }}
    >
      <StepBody
        step={state.step}
        draft={state.draft}
        company={company}
        customers={customers}
        invoices={invoices}
        payments={payments}
        reference={composable.reference}
        templateId={design.templateId}
        showLogo={design.showLogo}
        brandColour={design.brandColour}
        discountPercent={design.discountPercent}
        taxLabel={taxLabel}
        problems={problems}
        composable={composable}
        composeOptions={composeOptions}
        onChange={(patch) => setState((latest) => (latest === null ? latest : edit(latest, patch)))}
        onAddCustomer={(fresh) => {
          // One write path: the store creates it and reloads, and the draft
          // points at the new id — so the name typed into the search becomes
          // the customer on the document without anything being retyped (§G).
          void actions.addCustomer(fresh).then((created) => {
            setState((latest) =>
              latest === null ? latest : edit(latest, { customerId: created.id }),
            )
          })
        }}
        onDiscount={(discountPercent) => changeDesign({ discountPercent })}
        onTemplate={(templateId) => changeDesign({ templateId })}
        onToggleLogo={(showLogo) => changeDesign({ showLogo })}
        onBrandColour={(brandColour) => changeDesign({ brandColour })}
        onGoToStep={(target) => setState(goToStep(state, clampStep(target)))}
        onSetUpPayment={() => goToPaymentSettings()}
        onSign={() => {
          setSignProblem(null)
          setSigning(true)
        }}
        {...(signatureUrl === undefined ? {} : { signatureUrl })}
        onOpenCatalogue={() => navigate(settingsPath('items'))}
        /*
         * §G step 2's per-line photo, stored before it is referenced (§P).
         *
         * The same order as the signature pad: the asset is written, and only
         * the id it comes back with reaches the draft. A line pointing at an
         * asset the repository never accepted would print a broken thumbnail
         * on a document claiming to show the goods.
         */
        onStoreItemPhoto={(dataUrl) =>
          actions.storeAsset('item_photo', dataUrl).then((asset) => asset.id)
        }
        photoUrls={photoUrls}
        onRememberItem={(item) => {
          void actions.rememberItem({
            name: item.name,
            ...(item.unitPriceMinor === undefined
              ? {}
              : { lastPrice: { currency: state.draft.currency, minor: item.unitPriceMinor } }),
            ...(item.unit === undefined ? {} : { unit: item.unit }),
          })
        }}
        // §H's live preview. It was `null` since this screen was written,
        // so sixteen designs were chosen blind and the first sight of the
        // choice came a step later, on Review.
        preview={
          <LivePreview
            document={composable}
            templateId={design.templateId}
            composeOptions={composeOptions}
            brandColour={design.brandColour}
          />
        }
      />
      {signing && (
        <div className="mt-3">
          <SignaturePad
            onClose={() => setSigning(false)}
            {...(signProblem === null ? {} : { error: signProblem })}
            {...(defaultSignatureId === undefined
              ? {}
              : { onUseDefault: () => signWith(defaultSignatureId) })}
            onUse={(drawn) => {
              // Stored first, then referenced. A draft pointing at an asset
              // the repository never accepted would print a blank signature
              // and claim to be signed (§P).
              void actions
                .storeAsset('signature', drawn.dataUrl)
                .then((asset) => signWith(asset.id))
                .catch((cause: unknown) => {
                  setSignProblem(
                    format(strings.signature.failed, {
                      reason: cause instanceof Error ? cause.message : String(cause),
                    }),
                  )
                })
            }}
          />
        </div>
      )}
      {issueProblem !== null && (
        <p
          className="mt-3 rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm font-medium text-status-warn"
          role="alert"
        >
          {issueProblem}
        </p>
      )}
      <span className="sr-only">{typeLabel(profile, state.draft.type)}</span>
    </BuilderShell>
  )
}
