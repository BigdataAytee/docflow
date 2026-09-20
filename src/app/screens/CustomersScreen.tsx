/**
 * Customers, the contact page and the statement (§G, §L5).
 */

import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { useCompany } from '../context'
import { useAppData } from '../store'
import { CUSTOMERS, customerPath, documentPath, statementPath } from '../paths'
import { CustomerList } from '../../features/customers/CustomerList'
import { CustomerSheet } from '../../features/customers/CustomerSheet'
import { ContactPage, type HistoryRow } from '../../features/customers/ContactPage'
import { StatementPage } from '../../features/statements/StatementPage'
import {
  OPEN_START,
  PeriodPicker,
  type Period,
  periodFor,
} from '../../features/statements/PeriodPicker'
import { composeStatement, statementCurrencies } from '../../features/statements/compose'
import { PageHeader, SkeletonList } from '../../ui'
import { shownReference } from '../../features/documents/draftReference'
import { deviceId } from '../device'
import { billedInvoices, displayStatus, statementDocuments, totalOf } from '../derive'
import { todayIso } from '../../domain/dates/calendar'
import { localDay } from '../../domain/dates/calendar'

export function CustomersScreen() {
  const { documents, payments, creditNotes, actions } = useAppData()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)

  const invoices = useMemo(() => billedInvoices(documents), [documents])

  return (
    <>
      <CustomerList
        invoices={invoices}
        payments={payments}
        creditNotes={creditNotes}
        onOpen={(customer) => navigate(customerPath(customer.id))}
        onAdd={() => setAdding(true)}
      />

      {adding && (
        <div className="px-4 pb-4">
          <CustomerSheet
            onCancel={() => setAdding(false)}
            onSave={(fresh) => {
              setAdding(false)
              // Straight to the new contact page: the owner just described
              // this customer, so the next thing they want is that customer.
              void actions.addCustomer(fresh).then((created) => navigate(customerPath(created.id)))
            }}
          />
        </div>
      )}
    </>
  )
}

export function ContactScreen({ today = todayIso() }: { today?: string }) {
  const { customerId } = useParams<{ customerId: string }>()
  const { profile, strings } = useCompany()
  const { company, customers, documents, payments, creditNotes, loading, actions } =
    useAppData()
  const navigate = useNavigate()

  const customer = customers.find((row) => row.id === customerId)

  const invoices = useMemo(() => billedInvoices(documents), [documents])

  const history = useMemo<HistoryRow[]>(() => {
    if (customerId === undefined) return []
    return documents
      .filter((document) => document.customerId === customerId)
      // Newest first: §G calls it history, and the recent end is the live one.
      .sort((a, b) => (b.issueDate ?? '').localeCompare(a.issueDate ?? '') || b.id.localeCompare(a.id))
      .map((document) => {
        const status = displayStatus(document, payments, today, creditNotes, documents)
        /*
         * THE SAME NUMBER THE LIST AND THE BUILDER SHOW (§M).
         *
         * This said `INV-…` while the builder's card said `INV-0005-0P`,
         * so one document answered the question two ways depending on which
         * screen you were standing on.
         */
        const shown = shownReference(
          { documents, prefixes: company?.numberingPrefixes, profile, deviceId: deviceId() },
          document,
        )
        return {
          id: document.id,
          reference: shown.text,
          provisional: shown.provisional,
          status,
          statusLabel: strings.statuses[status] ?? status,
          ...(document.issueDate === undefined ? {} : { date: document.issueDate }),
          // A delivery document shows no amount anywhere (§G, §I, §V).
          ...(document.type === 'waybill' ? {} : { amount: totalOf(document) }),
        }
      })
  }, [customerId, documents, payments, today, company, profile, strings, creditNotes])

  if (loading) return <SkeletonList rows={4} label={strings.common.loading} />
  if (customer === undefined) return <Navigate to={CUSTOMERS} replace />

  return (
    <ContactPage
      customer={customer}
      invoices={invoices}
      payments={payments}
      creditNotes={creditNotes}
      history={history}
      onLabels={(labels) => void actions.updateCustomer(customer.id, { labels })}
      onNote={(note) =>
        void actions.updateCustomer(customer.id, {
          // An emptied note is absent, not an empty string on the record.
          ...(note.trim() === '' ? {} : { privateNote: note }),
        })
      }
      onOpenDocument={(id) => navigate(documentPath(id))}
      onStatement={() => {
        const currency =
          statementCurrencies(customer.id, statementDocuments(documents), payments)[0] ??
          company?.currency ??
          'NGN'
        navigate(statementPath(customer.id, currency))
      }}
      onBack={() => navigate(CUSTOMERS)}
    />
  )
}

export function StatementScreen({ today = todayIso() }: { today?: string }) {
  const { customerId, currency } = useParams<{ customerId: string; currency: string }>()
  const { strings } = useCompany()
  const { company, customers, documents, payments, creditNotes, loading } = useAppData()
  const navigate = useNavigate()

  // §G: "for any period". Twelve months is the opening offer, not a hidden
  // assumption — the picker is on screen and the dates print on the page.
  const [period, setPeriod] = useState<Period>(() => periodFor('last_12', today))

  const customer = customers.find((row) => row.id === customerId)

  const statement = useMemo(() => {
    if (customerId === undefined || currency === undefined) return null
    return composeStatement({
      customerId,
      currency,
      from: period.from,
      to: period.to,
      documents: statementDocuments(documents),
      payments,
      // §G's statement lists credits as their own line; now it has some.
      creditNotes,
      creditNoteDates: new Map(creditNotes.map((note) => [note.id, localDay(note.issuedAt)])),
      creditNoteCustomers: new Map(
        creditNotes.flatMap((note) => {
          const invoice = documents.find((row) => row.id === note.invoiceId)
          return invoice?.customerId === undefined ? [] : [[note.id, invoice.customerId] as const]
        }),
      ),
      creditNoteReferences: new Map(creditNotes.map((note) => [note.id, note.reference])),
    })
  }, [customerId, currency, documents, payments, period, creditNotes])

  if (loading) return <SkeletonList rows={4} label={strings.common.loading} />
  if (statement === null || customer === undefined) return <Navigate to={CUSTOMERS} replace />

  return (
    <div className="pb-28">
      <PageHeader
        title={strings.statements.title}
        eyebrow={customer.name}
        leading={
          <button
            type="button"
            onClick={() => navigate(customerPath(customer.id))}
            aria-label={customer.name}
            className="min-h-tap min-w-tap text-xl leading-none"
          >
            ‹
          </button>
        }
      />
      <div className="space-y-4 px-4 pt-4">
        <PeriodPicker period={period} today={today} onChange={setPeriod} />
        <StatementPage
          statement={statement}
          businessName={company?.name ?? ''}
          customerName={customer.name}
          {...(period.from === OPEN_START ? { fromLabel: strings.statements.everything } : {})}
        />
      </div>
    </div>
  )
}
