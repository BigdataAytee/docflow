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
import { numberingPrefix } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { documentsOf, listRows } from '../derive'

const isDocumentType = (value: string | undefined): value is DocumentType =>
  value !== undefined && (DOCUMENT_TYPES as readonly string[]).includes(value)

export function ListScreen({ today = new Date().toISOString().slice(0, 10) }: { today?: string }) {
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
      // §M: "drafts show provisional references". The company prefix wins,
      // falling back to the locale's own (§D).
      provisionalReference: (document) =>
        `${company?.numberingPrefixes?.[document.type] ?? numberingPrefix(profile, document.type)}-…`,
      // Two sent quotations look identical in a list, and only one of them
      // is the live offer — the same for a cancelled receipt beside the one
      // that replaced it. Only a quotation's chain is numbered (§G's Rev 2).
      supersededLabel: ({ type: rowType, revisionNumber }) =>
        rowType === 'quotation'
          ? format(strings.revision.supersededBy, { number: String(revisionNumber) })
          : strings.reissue.replacedBy,
    })
  }, [type, documents, payments, customers, today, strings, company, profile, creditNotes])

  if (!isDocumentType(type)) return <Navigate to={HOME} replace />

  return (
    <DocumentList
      type={type}
      rows={loading ? null : rows}
      onOpen={(id) => navigate(documentPath(id))}
      onNew={() => navigate(newDocumentPath(type))}
    />
  )
}
