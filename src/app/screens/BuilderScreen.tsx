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
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { useCompany } from '../context'
import { useAppData } from '../store'
import { HOME, documentPath, editDocumentPath, settingsPath } from '../paths'
import { deviceId } from '../device'
import { DOCUMENT_TYPES, type DocumentType } from '../../domain/documents/types'
import { label as typeLabel, numberingPrefix } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { percentToPpm } from '../../domain/money/money'
import { invoiceOutstanding } from '../../domain/payments/ledger'
import { regionProfile } from '../../features/settings/region'
import {
  type BuilderState,
  type DocumentDraft,
  clampStep,
  committed,
  edit,
  firstProblemStep,
  goToStep,
  validateForIssue,
} from '../../features/documents/builder'
import { BuilderShell } from '../../features/documents/BuilderShell'
import { IssueError, issueDocument } from '../../features/documents/issue'
import { NewReceiptSheet } from '../../features/payments/NewReceiptSheet'
import { availableMethods } from '../../features/payments/methods'
import {
  type SettleableInvoice,
  receiptKeyFor,
  receiptRecordFor,
  startReceipt,
} from '../../features/payments/receiptFlow'
import { DEFAULT_TEMPLATE, type TemplateId } from '../../pdf/templates'
import type { ComposableDocument, ComposeOptions } from '../../pdf/compose'
import { SkeletonList } from '../../ui'
import { BRAND_COLOURS, StepBody } from './builderSteps'
import { billedInvoices, documentsOf, totalOf } from '../derive'

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
    void actions.createDraft(type, company.currency).then((created) => {
      navigate(editDocumentPath(created.id), { replace: true })
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
function NewReceiptFlow({ today = new Date().toISOString().slice(0, 10) }: { today?: string }) {
  const { profile, strings } = useCompany()
  const { company, customers, documents, payments, creditNotes, loading, actions } = useAppData()
  const navigate = useNavigate()

  const [problem, setProblem] = useState<string | null>(null)
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
        })),
    [documents, payments, creditNotes, company, profile],
  )

  if (loading || company === null) return <NewDocumentSkeleton />

  return (
    <div className="px-4 py-4">
      <NewReceiptSheet
        currency={company.currency}
        today={today}
        customers={customers}
        invoices={invoices}
        methods={availableMethods(company.enabledPaymentMethods, strings)}
        onClose={() => navigate(HOME)}
        {...(problem === null ? {} : { error: problem })}
        onRecord={(input) => {
          if (busy.current) return
          busy.current = true
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
                      : format(strings.newReceipt.lineAgainst, { reference: chosen.reference }),
                  ...(chosen === undefined ? {} : { linkedInvoiceId: chosen.id }),
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
        }}
      />
    </div>
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
  const { profile, strings } = useCompany()
  const { company, customers, documents, payments, loading, actions } = useAppData()
  const navigate = useNavigate()

  const record = documents.find((document) => document.id === id)

  const [state, setState] = useState<BuilderState | null>(null)
  const [templateId, setTemplateId] = useState<TemplateId>(DEFAULT_TEMPLATE)
  const [showLogo, setShowLogo] = useState(true)
  const [brandColour, setBrandColour] = useState<string>(BRAND_COLOURS[0])
  const [discountPercent, setDiscountPercent] = useState(0)
  const [issueProblem, setIssueProblem] = useState<string | null>(null)

  // Seeded once from the stored record; after that the screen owns the draft
  // and the record follows it, not the other way round.
  useEffect(() => {
    if (state !== null || record === undefined) return
    setState({
      step: 0,
      draft: {
        type: record.type,
        currency: record.currency,
        lineItems: record.lineItems,
        ...(record.customerId === undefined ? {} : { customerId: record.customerId }),
        ...(record.issueDate === undefined ? {} : { issueDate: record.issueDate }),
        ...(record.dueDate === undefined ? {} : { dueDate: record.dueDate }),
        ...(record.validUntil === undefined ? {} : { validUntil: record.validUntil }),
        // A receipt's link to its payment has to reach the draft, or §K's
        // "reject a receipt without an effective payment" rejects every
        // receipt — the record carries it and the validator reads it here.
        ...(record.paymentId === undefined ? {} : { paymentId: record.paymentId }),
        ...(record.linkedInvoiceId === undefined
          ? {}
          : { linkedInvoiceId: record.linkedInvoiceId }),
      },
      dirty: false,
    })
    setBrandColour(company?.brandColour ?? BRAND_COLOURS[0])
  }, [state, record, company])

  const commit = useCallback(
    async (current: BuilderState) => {
      if (id === undefined || !current.dirty) return
      await actions.updateDraft(id, {
        currency: current.draft.currency,
        lineItems: current.draft.lineItems,
        ...(current.draft.customerId === undefined ? {} : { customerId: current.draft.customerId }),
        ...(current.draft.issueDate === undefined ? {} : { issueDate: current.draft.issueDate }),
        ...(current.draft.dueDate === undefined ? {} : { dueDate: current.draft.dueDate }),
        ...(current.draft.validUntil === undefined ? {} : { validUntil: current.draft.validUntil }),
      })
      // Only now — a commit that threw must not print "Saved" (§C).
      setState((latest) => (latest === null ? latest : committed(latest, now())))
    },
    [id, actions, now],
  )

  const problems = useMemo(() => {
    if (state === null) return []
    return validateForIssue(state.draft, {
      enabledPaymentMethodCount: company?.enabledPaymentMethods.length ?? 0,
      paymentIsRecorded:
        state.draft.paymentId !== undefined &&
        payments.some((payment) => payment.id === state.draft.paymentId),
      signatureRequired: company?.signatureRequired === true,
    })
  }, [state, company, payments])

  const customer = customers.find((row) => row.id === state?.draft.customerId)

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

  const composable = useMemo<ComposableDocument>(() => {
    const draft: DocumentDraft = state?.draft ?? { type: 'invoice', currency: 'NGN', lineItems: [] }
    return {
      type: draft.type,
      status: record?.status ?? 'draft',
      currency: draft.currency,
      reference: record?.issuedReference ?? provisional(draft.type),
      issueDate: draft.issueDate ?? now().slice(0, 10),
      ...(draft.dueDate === undefined ? {} : { dueDate: draft.dueDate }),
      lineItems: draft.lineItems,
      party: {
        name: customer?.name ?? '',
        ...(customer?.address === undefined ? {} : { address: customer.address }),
        ...(customer?.phone === undefined ? {} : { phone: customer.phone }),
      },
      frozenLabels: record?.frozenLabels ?? null,
      ...(discountPercent === 0 ? {} : { discountRate: percentToPpm(discountPercent) }),
      ...(company?.taxRatePpm === undefined ? {} : { taxRate: company.taxRatePpm }),
      ...(company?.whtRatePpm === undefined || draft.type !== 'invoice'
        ? {}
        : { whtRate: company.whtRatePpm }),
      ...(draft.driverName === undefined ? {} : { driverName: draft.driverName }),
    }
    function provisional(type: DocumentType): string {
      return `${company?.numberingPrefixes?.[type] ?? numberingPrefix(profile, type)}-…`
    }
  }, [state, record, customer, company, discountPercent, profile, now])

  const composeOptions = useMemo<Omit<ComposeOptions, 'profile'>>(
    () => ({
      branding: {
        name: company?.name ?? '',
        nameStyle: company?.nameStyle ?? 'classic',
        logoSize: company?.logoSize ?? 'M',
        showLogo,
        ...(company?.logoAssetId === undefined ? {} : { logoAssetId: company.logoAssetId }),
      },
      columnLabels: {
        description: strings.items.description,
        quantity: strings.items.quantity,
        amount: strings.totals.payable,
        unit: strings.items.unit,
      },
      ...(company?.bankFields === undefined ? {} : { bankValues: company.bankFields }),
    }),
    [company, showLogo, strings],
  )

  if (loading) return <SkeletonList rows={4} label={strings.common.loading} />
  if (record === undefined || id === undefined) return <Navigate to={HOME} replace />
  if (state === null) return <SkeletonList rows={4} label={strings.common.loading} />

  const close = () => {
    // Pending edits flush on exit (§G), then the page leaves either way.
    void commit(state).finally(() => navigate(documentPath(id)))
  }

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
          enabledPaymentMethodCount: company?.enabledPaymentMethods.length ?? 0,
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
        issuedAt: now(),
        ...(discountPercent === 0 ? {} : { discountRate: percentToPpm(discountPercent) }),
        ...(company?.taxRatePpm === undefined ? {} : { taxRate: company.taxRatePpm }),
        ...(company?.whtRatePpm === undefined ? {} : { whtRate: company.whtRatePpm }),
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
        }),
      )
      .then(() => navigate(documentPath(id)))
      .catch((cause: unknown) =>
        setIssueProblem(format(strings.builder.couldNotIssue, { reason: String(cause) })),
      )
  }

  return (
    <BuilderShell
      type={state.draft.type}
      step={state.step}
      dirty={state.dirty}
      lastSavedAt={state.lastSavedAt}
      problems={problems}
      onClose={close}
      onSave={save}
      onStep={(target) => {
        // Drafts autosave on step change with a visible saved state (§G).
        void commit(state)
        setState(goToStep(state, clampStep(target)))
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
        templateId={templateId}
        showLogo={showLogo}
        brandColour={brandColour}
        discountPercent={discountPercent}
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
        onDiscount={setDiscountPercent}
        onTemplate={setTemplateId}
        onToggleLogo={setShowLogo}
        onBrandColour={setBrandColour}
        onGoToStep={(target) => setState(goToStep(state, clampStep(target)))}
        onSetUpPayment={() => navigate(settingsPath('payment'))}
        onSign={() => {
          // Signature capture needs the canvas and the asset store — Phase 4.
        }}
        onRememberItem={(item) => {
          void actions.rememberItem({
            name: item.name,
            ...(item.unitPriceMinor === undefined
              ? {}
              : { lastPrice: { currency: state.draft.currency, minor: item.unitPriceMinor } }),
          })
        }}
        preview={null}
      />
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
