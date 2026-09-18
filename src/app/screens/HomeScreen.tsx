/**
 * Home, wired (§G).
 *
 * The screen component owns the layout; this owns the arithmetic's inputs. It
 * hands `Home` figures that came from `src/features/home/stats`, so the two
 * stat cards on screen are the ones the property tests bind.
 *
 * The search field is §G's "one field across customers, numbers, amounts and
 * item names, matching both current and frozen labels". The index is built
 * from this device's own records and rebuilt only when those records or the
 * region change — §L10 calls it built-once, searched-many, and a keystroke
 * must not re-resolve a label.
 */

import { useDeferredValue, useMemo, useState } from 'react'

import { useSessionActions } from '../session-context'
import { SignOutSheet } from '../../features/auth/SignOutSheet'
import { useNavigate } from 'react-router-dom'

import { useCompany } from '../context'
import { useAppData } from '../store'
import { customerPath, documentPath, listPath, newDocumentPath, settingsPath } from '../paths'
import { Home } from '../../features/home/Home'
import { needsAttention, outstandingByCurrency, receivedThisMonth } from '../../features/home/stats'
import { SearchResults } from '../../features/search/SearchResults'
import { search, type IndexEntry } from '../../features/search'
import { format } from '../../domain/locale/data/strings'
import { useSearchIndex } from '../useSearchIndex'
import { formatMoney } from '../../features/customers/formatMoney'
import {
  checklist,
  shouldShowChecklist,
  type ChecklistItemId,
} from '../../features/onboarding/checklist'
import { realOnly } from '../../features/onboarding/sample'
import { SkeletonList } from '../../ui'
import type { DocumentType } from '../../domain/documents/types'
import {
  customerNames,
  displayStatus,
  dueDates,
  statDocuments,
  totalOf,
} from '../derive'
import { todayIso } from '../../domain/dates/calendar'

export function HomeScreen({ now = new Date() }: { now?: Date }) {
  const { strings } = useCompany()
  const { company, customers, documents, payments, creditNotes, assets, caughtUpSkipped, loading } =
    useAppData()
  const navigate = useNavigate()

  // Resolved the same way `SettingsScreen` does it — one source, so the
  // holder on Home and the one in Settings cannot disagree.
  const logoUrl = assets.find((asset) => asset.id === company?.logoAssetId)?.dataUrl

  const [query, setQuery] = useState('')
  /*
   * §18: "short, DISMISSIBLE". Kept on the device rather than the record —
   * hiding a nudge is a preference about this screen, not a fact about the
   * business, and syncing it would hide the checklist on a colleague's phone
   * because somebody else had finished reading it.
   */
  const [checklistHidden, setChecklistHidden] = useState(
    () => globalThis.localStorage?.getItem('docflow.checklistHidden') === '1',
  )
  /** §N's line, shown only once a capture control has actually been pressed. */
  const [captureNotice, setCaptureNotice] = useState<string | undefined>(undefined)
  const [signingOut, setSigningOut] = useState(false)
  const session = useSessionActions()
  // Typing stays responsive on a large account: the field updates now, the
  // results catch up (§L10 — performance is invisible).
  const deferredQuery = useDeferredValue(query)

  // The local day, not the UTC one. This feeds `needsAttention`, and an
  // invoice reading as overdue five hours early every evening is the bug
  // that idiom was quietly causing west of Greenwich.
  const today = todayIso(now)

  const stats = useMemo(() => statDocuments(documents), [documents])
  const due = useMemo(() => dueDates(documents), [documents])

  const counts = useMemo(() => {
    const tally: Record<DocumentType, number> = { invoice: 0, quotation: 0, receipt: 0, waybill: 0 }
    for (const document of documents) tally[document.type] += 1
    return tally
  }, [documents])

  const names = useMemo(() => customerNames(customers), [customers])

  const index = useSearchIndex(names)

  const results = useMemo(() => search(index, deferredQuery), [index, deferredQuery])

  /** The second line on a result row: who it is for, and where it stands. */
  const detailOf = (entry: IndexEntry): string | undefined => {
    if (entry.kind !== 'document') return undefined
    const document = documents.find((row) => row.id === entry.id)
    if (document === undefined) return undefined

    const status = displayStatus(document, payments, today, creditNotes, documents)
    const name = document.customerId === undefined ? undefined : names.get(document.customerId)
    const amount = document.type === 'waybill' ? undefined : formatMoney(totalOf(document))

    return [name, strings.statuses[status] ?? status, amount].filter((part) => part !== undefined).join(' · ')
  }

  /*
   * The two or three rows that want doing, named.
   *
   * `needsAttention` decides WHICH records qualify — dates against a ledger,
   * and nothing else. Saying what each one is called takes the document list,
   * the customer names and the active language, which is why it happens here
   * and not in the pure function (§G).
   */
  const attention = useMemo(
    () =>
      needsAttention(stats, payments, due, today).map((item) => {
        const document = documents.find((row) => row.id === item.documentId)
        if (document === undefined) return item

        const customer =
          document.customerId === undefined ? undefined : names.get(document.customerId)
        const amount =
          item.amount === undefined
            ? undefined
            : format(strings.payments.amountLeft, { amount: formatMoney(item.amount) })

        const detail = [customer, amount].filter((part) => part !== undefined).join(' · ')

        return {
          ...item,
          // A draft has no issued reference yet, and inventing one here would
          // put a number on screen that no PDF will ever carry (§M).
          ...(document.issuedReference === undefined || document.issuedReference === null
            ? {}
            : { reference: document.issuedReference }),
          ...(detail === '' ? {} : { detail }),
        }
      }),
    [stats, payments, due, today, documents, names, strings],
  )

  if (loading) {
    return (
      <div className="px-4 py-6">
        <SkeletonList rows={4} label={strings.common.loading} />
      </div>
    )
  }

  const searching = query.trim() !== ''

  /*
   * Every row is DERIVED from the state it describes (§R), so completing a
   * step anywhere in the app ticks it here with nothing to keep in sync.
   * Sample records deliberately do not count towards the first document.
   */
  const setupState = {
    companyName: company?.name ?? '',
    region: company?.localeRegion ?? '',
    hasLogo: company?.logoAssetId !== undefined,
    enabledPaymentMethodCount: company?.enabledPaymentMethods.length ?? 0,
    // `realOnly`, not a hand-rolled filter: §R makes excluding samples a
    // property of the record with one way in, so a sample can never tick
    // "complete your first document".
    realDocumentCount: realOnly(documents).length,
    dismissed: checklistHidden,
  }

  const hideChecklist = () => {
    setChecklistHidden(true)
    try {
      globalThis.localStorage?.setItem('docflow.checklistHidden', '1')
    } catch {
      // Private browsing, or blocked site data. The card stays hidden for
      // this session either way; it is a preference, not a record.
    }
  }

  const startTask = (id: ChecklistItemId) => {
    if (id === 'business_details') navigate(settingsPath('company'))
    else if (id === 'logo') navigate(settingsPath('company'))
    else if (id === 'payment') navigate(settingsPath('payment'))
    else navigate(newDocumentPath('invoice'))
  }

  return (
    <>
      <Home
      businessName={company?.name ?? ''}
      userName=""
      /*
       * The logo an owner actually set (§G, §E).
       *
       * This said "no `logoUrl` yet, and deliberately none invented: nothing
       * in the app resolves an asset to something an `<img>` can load until
       * the local asset store lands". The store landed — `SettingsScreen`
       * resolves it in one line, and has for a while — so the comment was
       * describing a state of the world that had stopped being true, and an
       * owner who uploaded a logo saw it in Settings and nowhere else.
       *
       * A stale comment is worse than none: it reads as a decision, so the
       * next person leaves it alone.
       */
      {...(logoUrl === undefined ? {} : { logoUrl })}
      // §G's logo holder is a way INTO Settings, not an ornament: "tap to add
      // your logo" has to be tappable or it is an instruction with nowhere to
      // follow it.
      onAddLogo={() => navigate(settingsPath('company'))}
      // §N: a capability that is not installed says so. Never a toast
      // claiming work that did not happen.
      /*
        Offered only when there is an account to leave.
        `useSessionActions` is null on the demo backend, which has no session
        — a control offering to sign out of nothing would be a lie, and the
        spread is how the prop stays absent rather than being a no-op.
      */
      {...(session === null ? {} : { onLogOut: () => setSigningOut(true) })}
      onVoice={() => setCaptureNotice(strings.common.offlineToolsNeeded)}
      onScan={() => setCaptureNotice(strings.common.offlineToolsNeeded)}
      {...(captureNotice === undefined ? {} : { captureNotice })}
      {...(caughtUpSkipped.length === 0 ? {} : { repeatsSkipped: caughtUpSkipped })}
      {...(shouldShowChecklist(setupState)
        ? {
            setup: {
              items: checklist(setupState),
              onStart: startTask,
              onGuide: () => navigate(settingsPath('company')),
              onHide: hideChecklist,
            },
          }
        : {})}
      now={now}
      online={false}
      pendingCount={0}
      failedCount={0}
      outstanding={outstandingByCurrency(stats, payments, creditNotes)}
      // The calendar DAY, so the month boundary is the company's own (§V).
      received={receivedThisMonth(payments, today)}
      counts={counts}
      attention={attention}
      onOpenType={(type) => navigate(listPath(type))}
      onOpenDocument={(id) => navigate(documentPath(id))}
      onSearch={setQuery}
      searchQuery={query}
      {...(searching
        ? {
            results: (
              <SearchResults
                query={query}
                results={results}
                detailOf={detailOf}
                onOpenDocument={(id) => navigate(documentPath(id))}
                onOpenCustomer={(id) => navigate(customerPath(id))}
                onOpenItem={() => navigate(settingsPath('items'))}
                onSuggest={setQuery}
                onClear={() => setQuery('')}
              />
            ),
          }
        : {})}
      />

      {signingOut && session !== null && (
        <SignOutSheet
          onConfirm={() => {
            // The sheet closes either way: `AccountGate` swaps the whole tree
            // for the sign-in screen when the session goes, and a sheet left
            // open behind that would be a modal over a page nobody is on.
            setSigningOut(false)
            void session.signOut()
          }}
          onCancel={() => setSigningOut(false)}
        />
      )}
    </>
  )
}
