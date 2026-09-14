/**
 * Reading the phone's address book (§Q Phase 4, §P).
 *
 * §Q asks for "contacts import (deduped)". The dedupe lives in
 * `src/features/customers/import/dedupe.ts`, because a CSV needs exactly the
 * same treatment and the rule must not exist twice. What is here is the part
 * that is genuinely about the platform: asking permission, reading, and
 * flattening a contact into the four fields a customer has.
 *
 * **Permission refusal is a first-class outcome**, not an error. §Q Phase 4's
 * gate names it explicitly, and it is also just true of the product: an owner
 * who does not want DocFlow reading their contacts should get a working app
 * with a different way in — typing a customer, or a CSV. So `read` returns a
 * result rather than throwing, and `denied` is a state the screen renders
 * rather than a catch block.
 *
 * **Nothing is read until the owner asks for it.** The permission is requested
 * at the moment they tap Import, never at launch. A permission prompt on first
 * open, for a feature nobody has asked for yet, is how an app trains people to
 * refuse everything.
 *
 * **Nothing is stored except what the owner confirms.** This returns
 * candidates; the preview screen shows them; only the rows they accept become
 * customers. The address book is read, not copied.
 */

import type { ImportCandidate } from '../features/customers/import/dedupe'

export type ContactsResult =
  | { readonly kind: 'ok'; readonly candidates: readonly ImportCandidate[] }
  /** The owner said no. A state to render, never an error to throw (§Q). */
  | { readonly kind: 'denied' }
  /** No contacts provider — a stripped ROM, a work profile, the web build. */
  | { readonly kind: 'unavailable'; readonly reason: string }

export async function readContacts(): Promise<ContactsResult> {
  let Contacts: typeof import('@capacitor-community/contacts').Contacts
  try {
    ;({ Contacts } = await import('@capacitor-community/contacts'))
  } catch (cause) {
    return { kind: 'unavailable', reason: messageOf(cause) }
  }

  try {
    const permission = await Contacts.requestPermissions()
    if (permission.contacts !== 'granted') return { kind: 'denied' }

    const { contacts } = await Contacts.getContacts({
      // Only what a customer record can hold. Asking for birthdays, photos and
      // notes because the API offers them would be collecting data the app has
      // no use for (§P).
      projection: { name: true, phones: true, emails: true, postalAddresses: true },
    })

    return { kind: 'ok', candidates: contacts.map(toCandidate).filter(hasSomething) }
  } catch (cause) {
    // Some Android builds throw rather than returning `denied`.
    if (/permission/i.test(messageOf(cause))) return { kind: 'denied' }
    return { kind: 'unavailable', reason: messageOf(cause) }
  }
}

/** The shape this needs, so the mapping is testable without the plugin. */
export interface RawContact {
  readonly name?: { readonly display?: string | null } | null
  readonly phones?: readonly { readonly number?: string | null }[] | null
  readonly emails?: readonly { readonly address?: string | null }[] | null
  readonly postalAddresses?:
    | readonly {
        readonly street?: string | null
        readonly city?: string | null
      }[]
    | null
}

/**
 * One contact, flattened.
 *
 * **The FIRST phone and the first email, not all of them.** A customer record
 * holds one of each (§E), and a contact commonly has three numbers — work,
 * home, the old one. Joining them into a single field would produce a phone
 * number that cannot be dialled and cannot be matched; picking the first is
 * what the address book itself shows as the primary, and the owner can correct
 * it on a record they can see.
 */
export function toCandidate(contact: RawContact): ImportCandidate {
  const phone = first(contact.phones?.map((entry) => entry.number))
  const email = first(contact.emails?.map((entry) => entry.address))
  const postal = contact.postalAddresses?.[0]
  const address = first([[postal?.street, postal?.city].filter(Boolean).join(', ')])

  return {
    name: contact.name?.display?.trim() ?? '',
    ...optional('phone', phone),
    ...optional('email', email),
    ...optional('address', address),
  }
}

/**
 * A contact with no name and no number is not a customer.
 *
 * An address book holds plenty: a stray email from a calendar invite, an
 * entry with only a photo. `plan` would mark them unusable anyway; dropping
 * them here keeps the preview list to things the owner recognises.
 */
const hasSomething = (candidate: ImportCandidate): boolean =>
  candidate.name.trim() !== '' || candidate.phone !== undefined

const first = (values: readonly (string | null | undefined)[] | undefined): string | undefined => {
  const found = values?.find((value) => typeof value === 'string' && value.trim() !== '')
  return found?.trim()
}

const optional = <T>(key: string, value: T | undefined): Record<string, T> =>
  value === undefined ? {} : { [key]: value }

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)
