/**
 * The search index, built once for everything that searches (§G, §D.3, §L10).
 *
 * Home built this inline, and the command palette needs the same index over
 * the same records. Two copies would have been two answers to "does typing
 * 'delivery note' find this waybill" — §D.3's rule, and the sort of rule that
 * is only ever half-applied when it is written twice.
 *
 * §L10: built once, searched many times. The memo keys are the records and
 * the profile, so a region change rebuilds it and a keystroke does not.
 */

import { useMemo } from 'react'

import { useCompany } from './context'
import { useAppData } from './store'
import { totalOf } from './derive'
import { buildIndex, type IndexEntry } from '../features/search'
import { shownReference } from '../features/documents/draftReference'
import { deviceId } from './device'

/**
 * `customerName` is optional on the index entry and `exactOptionalPropertyTypes`
 * means absent and undefined are different things — so the key is spread in
 * only when there is a name.
 */
function customerNameOf(
  names: ReadonlyMap<string, string>,
  customerId: string | undefined,
): { customerName?: string } {
  if (customerId === undefined) return {}
  const name = names.get(customerId)
  return name === undefined ? {} : { customerName: name }
}

export function useSearchIndex(names: ReadonlyMap<string, string>): IndexEntry[] {
  const { profile } = useCompany()
  const { company, customers, documents, items } = useAppData()

  return useMemo(
    () =>
      buildIndex(profile, {
        documents: documents.map((document) => ({
          id: document.id,
          type: document.type,
          /*
           * A draft is findable by the number the owner sees (§M).
           *
           * Which was `INV-…` — a string nobody would ever type into a
           * search box. Now it is the number the list, the customer's
           * history and the builder all show, so searching for what is on
           * screen finds the document that is on screen.
           */
          reference: shownReference(
            { documents, prefixes: company?.numberingPrefixes, profile, deviceId: deviceId() },
            document,
          ).text,
          frozenLabels: document.frozenLabels,
          ...customerNameOf(names, document.customerId),
          // A delivery document carries no money, so it is not findable by one.
          ...(document.type === 'waybill' ? {} : { total: totalOf(document) }),
          lineDescriptions: document.lineItems.map((line) => line.description),
        })),
        customers: customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          ...(customer.phone === undefined ? {} : { phone: customer.phone }),
          ...(customer.address === undefined ? {} : { address: customer.address }),
        })),
        items: items.map((item) => ({ id: item.id, name: item.name })),
      }),
    [profile, documents, customers, items, company, names],
  )
}
