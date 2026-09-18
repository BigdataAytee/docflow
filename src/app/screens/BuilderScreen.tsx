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
import { label as typeLabel, numberingPrefix } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { percentToPpm } from '../../domain/money/money'
import { invoiceOutstanding } from '../../domain/payments/ledger'
import { regionProfile } from '../../features/settings/region'
import {
  type BuilderState,
  clampStep,
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
import { NewReceiptSheet } from '../../features/payments/NewReceiptSheet'
import { SignaturePad } from '../../features/signature/SignaturePad'
import { availableMethods } from '../../features/payments/methods'
import {
  type SettleableInvoice,
  receiptKeyFor,
  receiptRecordFor,
  startReceipt,
} from '../../features/payments/receiptFlow'
import type { ComposableDocument } from '../../pdf/compose'
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
                    : { invoiceOutstandingBefore: chosen.outstanding }),
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
