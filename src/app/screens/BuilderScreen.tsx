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
import { percentToPpm } from '../../domain/money/money'
import { regionProfile } from '../../features/settings/region'
import {
  type BuilderState,
  type DocumentDraft,
  clampStep,
  committed,
  edit,
  goToStep,
  validateForIssue,
} from '../../features/documents/builder'
import { BuilderShell } from '../../features/documents/BuilderShell'
import { issueDocument } from '../../features/documents/issue'
import { DEFAULT_TEMPLATE, type TemplateId } from '../../pdf/templates'
import type { ComposableDocument, ComposeOptions } from '../../pdf/compose'
import { SkeletonList } from '../../ui'
import { BRAND_COLOURS, StepBody } from './builderSteps'
import { billedInvoices, documentsOf } from '../derive'

const isDocumentType = (value: string | undefined): value is DocumentType =>
  value !== undefined && (DOCUMENT_TYPES as readonly string[]).includes(value)

/** `/new/:type` — makes the draft once, then hands over to `/edit/:id`. */
export function NewDocumentScreen() {
  const { type } = useParams<{ type: string }>()
  const { company, actions } = useAppData()
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    if (started.current || !isDocumentType(type) || company === null) return
    started.current = true
    void actions.createDraft(type, company.currency).then((created) => {
      navigate(editDocumentPath(created.id), { replace: true })
    })
  }, [type, company, actions, navigate])

  if (!isDocumentType(type)) return <Navigate to={HOME} replace />
  return <NewDocumentSkeleton />
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
    const issued = issueDocument({
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
      prefix: company?.numberingPrefixes?.[state.draft.type] ?? numberingPrefix(profile, state.draft.type),
      // §M: a server-reserved block where available; offline, a device tag.
      sequence: documentsOf(documents, state.draft.type).length,
      fromReservedBlock: false,
      deviceId: deviceId(),
      issuedAt: now(),
      ...(discountPercent === 0 ? {} : { discountRate: percentToPpm(discountPercent) }),
      ...(company?.taxRatePpm === undefined ? {} : { taxRate: company.taxRatePpm }),
      ...(company?.whtRatePpm === undefined ? {} : { whtRate: company.whtRatePpm }),
    })

    void commit(state)
      .then(() =>
        actions.issue(id, {
          reference: issued.reference,
          frozenLabels: issued.frozenLabels,
          totalMinor: issued.totals?.payable.minor ?? 0,
        }),
      )
      .then(() => navigate(documentPath(id)))
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
      <span className="sr-only">{typeLabel(profile, state.draft.type)}</span>
    </BuilderShell>
  )
}
