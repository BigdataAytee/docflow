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
import { HOME, editDocumentPath, statementPath } from '../paths'
import { PageHeader, SkeletonList, StatusBadge } from '../../ui'
import { PaidSoFarBar } from '../../features/payments/PaidSoFarBar'
import { PaymentList } from '../../features/payments/PaymentList'
import { RepeatToggle } from '../../features/recurring/RepeatToggle'
import { type Recurrence, startRepeating, stopRepeating } from '../../features/recurring/schedule'
import { paidSoFar, prefillAmount, recordPayment } from '../../features/payments/record'
import { draftChase } from '../../features/payments/chase'
import { invoiceOutstanding } from '../../domain/payments/ledger'
import { TYPE_PALETTE } from '../../ui/tokens'
import { displayLabels } from '../../domain/locale/profile'
import { formatMoney } from '../../features/customers/formatMoney'
import { displayStatus, totalOf } from '../derive'

export function DocumentScreen({ today = new Date().toISOString().slice(0, 10) }: { today?: string }) {
  const { id } = useParams<{ id: string }>()
  const { profile, strings } = useCompany()
  const { company, customers, documents, payments, loading, actions } = useAppData()
  const navigate = useNavigate()

  const [recurrence, setRecurrence] = useState<Recurrence | null>(null)
  const [tone, setTone] = useState<'softer' | 'firmer' | null>(null)

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
  const status = displayStatus(record, payments, today)
  const isInvoice = record.type === 'invoice'
  const outstanding = invoiceOutstanding(record.id, total, payments)

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

        {isInvoice && record.status !== 'draft' && (
          <>
            <PaidSoFarBar bar={paidSoFar(record.id, total, payments)} />

            <PaymentList
              payments={mine}
              prefill={prefillAmount(record.id, total, payments)}
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
                    ...(input.reference === undefined ? {} : { reference: input.reference }),
                  }),
                )
              }}
              onReceipt={() => {
                // §G: a receipt is a document derived from this payment. The
                // builder opens on a receipt draft carrying `paymentId` —
                // wired once the convert flow lands.
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
