/**
 * One list page per type (§G — "never combined tabs").
 *
 * The type comes from the URL as the INTERNAL name, so this reads it, checks
 * it is really one of the four, and hands it to `DocumentList`, which resolves
 * the word through the locale layer. An unknown type is a 404 rather than an
 * empty list under a made-up heading.
 */

import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { useCompany } from '../context'
import { useAppData } from '../store'
import { HOME, documentPath, newDocumentPath } from '../paths'
import { DocumentList } from '../../features/documents/DocumentList'
import { DOCUMENT_TYPES, type DocumentType } from '../../domain/documents/types'
import { shownReference } from '../../features/documents/draftReference'
import { deviceId } from '../device'
import { format } from '../../domain/locale/data/strings'
import { documentsOf, listRows } from '../derive'
import { todayIso } from '../../domain/dates/calendar'

const isDocumentType = (value: string | undefined): value is DocumentType =>
  value !== undefined && (DOCUMENT_TYPES as readonly string[]).includes(value)

export function ListScreen({ today = todayIso() }: { today?: string }) {
  const { type } = useParams<{ type: string }>()
  const { profile, strings } = useCompany()
  const { company, customers, documents, payments, creditNotes, loading } = useAppData()
  const navigate = useNavigate()

  const rows = useMemo(() => {
    if (!isDocumentType(type)) return []
    return listRows(documentsOf(documents, type), {
      payments,
      customers,
      today,
      // A credited invoice owes less, so its row says so too (§E).
      creditNotes,
      statusWords: strings.statuses,
      /*
       * §M: "drafts show provisional references" — and the provisional one
       * is now the number the draft would actually get, not `INV-…`. The
       * builder's card already showed it; this column showed something else,
       * which is one document with two answers.
       */
      referenceOf: (document) =>
        shownReference(
          {
            documents,
            prefixes: company?.numberingPrefixes,
            profile,
            deviceId: deviceId(),
          },
          document,
        ),
      // Two sent quotations look identical in a list, and only one of them
      // is the live offer — the same for a cancelled receipt beside the one
      // that replaced it. Only a quotation's chain is numbered (§G's Rev 2).
      /*
       * The words, from the catalogue (§D, Rule #4).
       *
       * The SHORT form — "Record payment", not "Record a payment". On a
       * 320px phone the long one pushed the row past the edge: reference,
       * badge, amount and a wide pill do not fit, and the responsive sweep
       * said so. The document's own grid keeps the longer wording, where
       * there is a whole button width for it.
       */
      actionLabel: (kind) =>
        kind === 'record_payment' ? strings.newReceipt.recordPayment : strings.home.sign,
      /*
       * NAMED, NOT JUST MARKED (§G).
       *
       * It read "Cancelled — a newer one replaces this", which is wrong
       * twice over: the document was not cancelled, it was answered — and a
       * row that does not say WHICH document took over leaves the owner
       * hunting for it. Both types read the same way now, so nothing has to
       * remember which one gets a number.
       */
      supersededLabel: ({ reference }) =>
        format(strings.reissue.replacedBy, { reference }),
    })
  }, [type, documents, payments, customers, today, strings, company, profile, creditNotes])

  if (!isDocumentType(type)) return <Navigate to={HOME} replace />

  return (
    <DocumentList
      type={type}
      rows={loading ? null : rows}
      onOpen={(id) => navigate(documentPath(id))}
      /*
       * WHERE THE ACTION HAPPENS, not the action itself.
       *
       * Both of these NAVIGATE. The status moves when somebody finishes what
       * they were taken to — records a real payment, draws a real mark — and
       * never because a row was tapped on a scrolling list.
       */
      onAction={(id, kind) =>
        navigate(documentPath(id), { state: { rowAction: kind } })
      }
      onNew={() => navigate(newDocumentPath(type))}
      onBack={() => navigate(HOME)}
    />
  )
}
