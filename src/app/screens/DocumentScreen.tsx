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

import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { useCompany } from '../context'
import { useAppData } from '../store'
import { HOME, documentPath, editDocumentPath, statementPath } from '../paths'
import { PageHeader, SkeletonList, StatusBadge } from '../../ui'
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
  optionalDeliveryStep,
  signDelivery,
} from '../../features/delivery/sign'
import { CreditNoteError, issueCreditNote } from '../../features/credits/issue'
import {
  ConvertError,
  type ConvertibleDocument,
  conversionsFor,
  convertDocument,
  convertedFrom,
  conversionsOf,
} from '../../features/documents/convert'
import { type Recurrence, startRepeating, stopRepeating } from '../../features/recurring/schedule'
import { paidSoFar, prefillAmount, recordPayment } from '../../features/payments/record'
import {
  receiptForPayment,
  receiptKeyFor,
  receiptRecordFor,
} from '../../features/payments/receiptFlow'
import { draftChase } from '../../features/payments/chase'
import { invoiceOutstanding } from '../../domain/payments/ledger'
import { TYPE_PALETTE } from '../../ui/tokens'
import { displayLabels } from '../../domain/locale/profile'
import { formatMoney } from '../../features/customers/formatMoney'
import { format } from '../../domain/locale/data/strings'
import { ShareSheet } from '../../share/ShareSheet'
import { createWebSharePort } from '../../share/web'
import { lastShared, shareCount, shareEventFor } from '../../share/events'
// `shareFileName` is deliberately not imported: there is no rendered file to
// attach until §Q Phase 4's native PDF writer, and the sheet says so.
import { shareTextFor } from '../../share/text'
import { deviceId } from '../device'
import { displayStatus, totalOf } from '../derive'

export function DocumentScreen({ today = new Date().toISOString().slice(0, 10) }: { today?: string }) {
  const { id } = useParams<{ id: string }>()
  const { profile, strings } = useCompany()
  const { company, customers, documents, payments, shares, creditNotes, assets, loading, actions } =
    useAppData()
  const navigate = useNavigate()

  const [recurrence, setRecurrence] = useState<Recurrence | null>(null)
  const [tone, setTone] = useState<'softer' | 'firmer' | null>(null)
  const [sharing, setSharing] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertProblem, setConvertProblem] = useState<string | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [voidProblem, setVoidProblem] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [signProblem, setSignProblem] = useState<string | null>(null)
  const [revisionProblem, setRevisionProblem] = useState<string | null>(null)
  const [reissueProblem, setReissueProblem] = useState<string | null>(null)
  const [answerProblem, setAnswerProblem] = useState<string | null>(null)
  const [crediting, setCrediting] = useState(false)
  const [creditProblem, setCreditProblem] = useState<string | null>(null)

  // One port per mount. Phase 4 swaps the Capacitor plugin in behind it and no
  // line of this screen changes.
  const port = useMemo(() => createWebSharePort(), [])

  const record = documents.find((document) => document.id === id)
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
  const total = totalOf(record)
  const isInvoice = record.type === 'invoice'
  // Real credit notes, not an empty list: a credited invoice owes less, and
  // every figure on this screen has always been ready to be told (§E).
  const mineCredits = creditNotes.filter((note) => note.invoiceId === record.id)
  const status = displayStatus(record, payments, today, mineCredits)

  /** The mark on this document, resolved from the id it holds (§E). */
  const signatureUrl = assets.find((asset) => asset.id === record.signatureAssetId)?.dataUrl
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

  return (
    <div className="pb-28">
      <PageHeader
        title={labels.printedTitle}
        eyebrow={record.issuedReference ?? strings.savedDocument.notIssuedYet}
        accent={TYPE_PALETTE[record.type].accent}
        {...(customer === undefined ? {} : { subtitle: customer.name })}
        trailing={<StatusBadge status={status} label={strings.statuses[status] ?? status} />}
      />

      <div className="space-y-4 px-4 pt-4">
        {record.status === 'draft' && (
          <button
            type="button"
            className="min-h-tap w-full rounded-full bg-brand px-4 text-sm font-semibold text-white"
            onClick={() => navigate(editDocumentPath(id))}
          >
            {strings.savedDocument.continueEditing}
          </button>
        )}

        {/* §G's first action on every type. A draft has no frozen reference and
            no issued page, so there is nothing to send yet. */}
        {record.status !== 'draft' && !sharing && (
          <button
            type="button"
            className="min-h-tap w-full rounded-full bg-brand px-4 text-sm font-semibold text-white"
            onClick={() => setSharing(true)}
          >
            {strings.savedDocument.sharePdf}
          </button>
        )}

        {/*
          §G's sign action, and §Q's Phase 2 gate: "create and sign a delivery
          document". One tap here, one sheet, and the delivery is signed for
          (Rule #1).
        */}
        {nextDeliveryStep(record) !== null && (
          <button
            type="button"
            className="min-h-tap w-full rounded-full border border-brand/30 bg-white px-4 text-sm font-semibold text-brand"
            onClick={() => {
              // An issued delivery cannot jump to delivered — it has to go
              // out first. Without this the sign action below would be
              // correct by the lifecycle and unreachable in the app.
              const step = nextDeliveryStep(record)
              if (step !== null) void actions.transition(record.id, step)
            }}
          >
            {strings.signature.sendOnItsWay}
          </button>
        )}

        {canSign(record) && !signing && (
          <>
            <p className="text-center text-xs opacity-60">{strings.signature.onItsWay}</p>
            {/*
              §F gives "on the way" its own colour and §D its own word, and a
              signing link is valid for it — but nothing could produce it.
              Optional rather than a required step: a delivery is signed for
              from "sent out" just as well, and a second compulsory tap would
              buy nothing (Rule #1). It earns its place on the journey that
              takes days, where "sent out" on Monday and still "sent out" on
              Thursday tells the owner nothing.
            */}
            {optionalDeliveryStep(record) !== null && (
              <button
                type="button"
                className="min-h-tap w-full rounded-full border border-black/10 bg-white px-4 text-sm font-medium"
                onClick={() => {
                  const step = optionalDeliveryStep(record)
                  if (step !== null) void actions.transition(record.id, step)
                }}
              >
                {strings.signature.markOnTheWay}
              </button>
            )}
          </>
        )}

        {canSign(record) && !signing && (
          <button
            type="button"
            className="min-h-tap w-full rounded-full border border-brand/30 bg-white px-4 text-sm font-semibold text-brand"
            onClick={() => {
              setSignProblem(null)
              setSigning(true)
            }}
          >
            {strings.signature.confirmDelivery}
          </button>
        )}

        {/*
          §G's fourth delivery action, and §E's "delivery photo asset". It is
          what settles an argument three weeks later: the stack at the gate,
          the plate number, the state the goods arrived in. It seals with the
          signature, because a photo added after the customer signed would
          change what the record says happened (§P).
        */}
        {(canAttachPhoto(record) || deliveryPhotoUrl !== undefined) && (
          <section className="rounded-2xl bg-white/70 p-4" aria-label={strings.photo.title}>
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

        {canSign(record) && !signing && <CopyLinkRow documentId={record.id} kind="sign" />}

        {signing && (
          <SignDeliverySheet
            onClose={() => setSigning(false)}
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
                    signatureAssetId: asset.id,
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
                    signatureAssetId: decision.signatureAssetId,
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
              {format(strings.signature.deliveredOn, { date: record.signedAt.slice(0, 10) })}
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
        {newerRevision !== null && (
          <button
            type="button"
            className="w-full rounded-2xl bg-status-warn-tint p-4 text-left text-sm text-status-warn"
            onClick={() => navigate(documentPath(newerRevision.id))}
          >
            <span className="font-semibold">
              {record.type === 'quotation'
                ? format(strings.revision.supersededBy, {
                    number: String(revisionNumberOf(documents, newerRevision)),
                  })
                : strings.reissue.replacedBy}
            </span>
            <span className="mt-0.5 block text-xs opacity-80">{strings.revision.openIt}</span>
          </button>
        )}

        {revisedFrom !== null && (
          <button
            type="button"
            className="w-full rounded-2xl bg-white/70 p-4 text-left text-sm"
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
          §G's two receipt actions. "Open what it paid for" is the link the
          receipt already carries (§E `related_invoice_id`) — without it the
          link is stored and unreachable.
        */}
        {linkedInvoice !== null && (
          <button
            type="button"
            className="min-h-tap w-full rounded-full border border-brand/30 bg-white px-4 text-sm font-semibold text-brand"
            onClick={() => navigate(documentPath(linkedInvoice.id))}
          >
            {strings.reissue.openInvoice}
          </button>
        )}

        {/*
          §G's "void and reissue". A receipt cannot be corrected any other
          way: it is immutable once issued (Rule #5), and a credit note is an
          INVOICE correction — crediting a receipt would mean money going back
          to the customer, which is a refund rather than a typo.
        */}
        {canReissue(record, payments) && newerRevision === null && (
          <button
            type="button"
            className="min-h-tap w-full rounded-full border border-brand/30 bg-white px-4 text-sm font-semibold text-brand"
            onClick={() => {
              setReissueProblem(null)
              let plan
              try {
                plan = voidAndReissue(record, {
                  payments,
                  description: format(strings.newReceipt.lineAgainst, {
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
              // Cancel first, then draw. If the second write does not land the
              // owner is not stuck: a cancelled receipt does not count as the
              // payment's receipt, so the payment's own Receipt button offers
              // to draw one. The recovery path is the ordinary path.
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
            }}
          >
            {strings.reissue.action}
          </button>
        )}

        {/*
          §G's other route for a receipt whose payment came back: there is
          nothing left to acknowledge, so a plain cancel is the honest action.
        */}
        {record.type === 'receipt' &&
          reasonsReissueIsBlocked(record, payments) === 'payment_reversed' && (
            <p className="rounded-xl bg-white/70 px-3 py-2.5 text-xs opacity-70">
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
          <section className="rounded-2xl bg-white/70 p-4" aria-label={strings.answer.title}>
            <h2 className="text-sm font-semibold">{strings.answer.title}</h2>
            <p className="mt-0.5 text-xs opacity-70">{strings.answer.explain}</p>
            <div className="mt-3 flex gap-2">
              {answers.map((answer) => (
                <button
                  key={answer}
                  type="button"
                  className="min-h-tap flex-1 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium"
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
            <CopyLinkRow documentId={record.id} kind="accept" />
          </section>
        )}

        {recordedAnswer !== null && (
          <p className="rounded-2xl bg-white/70 px-4 py-3 text-xs opacity-70">
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
            className="min-h-tap w-full rounded-full border border-brand/30 bg-white px-4 text-sm font-semibold text-brand"
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

        {/* §G's second action on every type that has somewhere to go. */}
        {conversionsFor(convertible).length > 0 && !converting && (
          <button
            type="button"
            className="min-h-tap w-full rounded-full border border-brand/30 bg-white px-4 text-sm font-semibold text-brand"
            onClick={() => {
              setConvertProblem(null)
              setConverting(true)
            }}
          >
            {strings.convert.title}
          </button>
        )}

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

        {/* §G's fourth invoice action, and the third correction Rule #5 allows. */}
        {canVoidOrCredit && !voiding && !crediting && (
          <div className="flex gap-2">
            <button
              type="button"
              className="min-h-tap flex-1 rounded-full border border-status-bad/30 bg-white px-4 text-sm font-semibold text-status-bad"
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
                className="min-h-tap flex-1 rounded-full border border-brand/30 bg-white px-4 text-sm font-semibold text-brand"
                onClick={() => {
                  setCreditProblem(null)
                  setCrediting(true)
                }}
              >
                {strings.credits.sheetTitle}
              </button>
            )}
          </div>
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
            onVoid={(reason) => {
              let decision
              try {
                decision = voidDocument({
                  document: voidable,
                  payments,
                  reason,
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
                  prefix: company?.numberingPrefixes?.invoice ?? 'CRN',
                  sequence: creditNotes.length + 1,
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
            className="min-h-tap w-full rounded-2xl bg-white/70 px-4 text-sm font-medium"
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
            {...(latestShare === null ? {} : { lastSharedAt: latestShare.at.slice(0, 10) })}
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
            <PaidSoFarBar bar={paidSoFar(record.id, total, payments, mineCredits)} />

            <PaymentList
              payments={mine}
              prefill={prefillAmount(record.id, total, payments, mineCredits)}
              onRecord={(input) => {
                if (customer === undefined) return
                void actions.recordPayment(
                  recordPayment({
                    // The repository mints the real id; this one only needs to
                    // be stable for the allocation it builds below.
                    id: `pending:${record.id}:${Date.now()}`,
                    customerId: customer.id,
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
                        reference: record.issuedReference ?? '',
                      }),
                      linkedInvoiceId: record.id,
                    }),
                    receiptKeyFor(payment.id),
                  )
                  .then((created) => navigate(editDocumentPath(created.id)))
              }}
            />

            <section className="rounded-2xl bg-white/70 p-4" aria-label={strings.chase.title}>
              <h2 className="text-sm font-semibold">{strings.chase.title}</h2>
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
                          tone === option ? 'border-transparent bg-brand text-white' : 'border-black/10 bg-white'
                        }`}
                        onClick={() => setTone(option)}
                      >
                        {option === 'softer' ? strings.chase.softer : strings.chase.firmer}
                      </button>
                    ))}
                  </div>
                  {chase !== null && (
                    <>
                      <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-black/[0.04] p-3 text-xs">
                        {chase.text}
                      </pre>
                      <p className="mt-2 text-[11px] opacity-60">{strings.chase.nothingSendsUnseen}</p>
                    </>
                  )}
                </>
              )}
            </section>

            <RepeatToggle
              recurrence={recurrence}
              today={today}
              onStart={() =>
                setRecurrence(startRepeating(record.id, record.issueDate ?? today))
              }
              onStop={() =>
                setRecurrence((current) => (current === null ? null : stopRepeating(current, today)))
              }
            />
          </>
        )}

        {customer !== undefined && (
          <button
            type="button"
            className="min-h-tap w-full rounded-2xl bg-white/70 px-4 text-sm font-medium"
            onClick={() => navigate(statementPath(customer.id, record.currency))}
          >
            {strings.savedDocument.openStatement}
          </button>
        )}
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
function CopyLinkRow({ documentId, kind }: { documentId: string; kind: 'accept' | 'sign' }) {
  const { strings } = useCompany()
  const { actions } = useAppData()
  const [copied, setCopied] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const online = typeof navigator === 'undefined' ? true : navigator.onLine

  if (!online) {
    return (
      <p className="text-center text-[11px] opacity-60">{strings.publicLink.needsInternet}</p>
    )
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        className="min-h-tap w-full rounded-xl border border-black/10 bg-white px-4 text-sm font-medium"
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

      {copied !== null && (
        <>
          <p className="text-center text-[11px] opacity-60">{strings.publicLink.copied}</p>
          {/* Shown as well as copied: a clipboard write can be refused, and
              an owner who cannot see the link has nothing to send. */}
          <p className="break-all rounded-lg bg-white/70 px-2 py-1 text-center text-[11px] tabular-nums">
            {copied}
          </p>
        </>
      )}

      {problem !== null && (
        <p className="text-center text-[11px] text-status-warn" role="alert">
          {problem}
        </p>
      )}
    </div>
  )
}
