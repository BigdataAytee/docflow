/**
 * The business facts nobody in this repository is allowed to invent.
 *
 * A policy with a made-up registered address is worse than no policy: it is a
 * false statement about a legal entity, published under that entity's name.
 * So every such fact is a `[[TOKEN]]` until a person fills it in, and the
 * tokens are declared HERE rather than scattered through prose — which is
 * what makes `unfilled()` able to list them and a test able to insist that
 * nothing ships with one.
 *
 * The rule the tests enforce, in two halves:
 *
 *  · Every token used in a document must be declared here, so the list handed
 *    to the user is complete rather than whatever somebody remembered.
 *  · Nothing may be given a plausible default. A default is an invention that
 *    survives review because it does not look like one.
 */

export interface Placeholder {
  readonly token: string
  readonly what: string
  /** Why it cannot be guessed, so nobody helpfully guesses it later. */
  readonly why: string
}

export const PLACEHOLDERS: readonly Placeholder[] = [
  {
    token: 'LEGAL_ENTITY_NAME',
    what: 'The registered company or sole-trader name that publishes DocFlow',
    why: 'It is who the contract is with. A trading name that is not the registered one makes the terms unenforceable',
  },
  {
    token: 'REGISTERED_ADDRESS',
    what: 'The registered office or trading address, in full',
    why: 'Required on the policy, in the app stores, and in the footer of any commercial email',
  },
  {
    token: 'COMPANY_NUMBER',
    what: 'Company registration number, if the entity is registered',
    why: 'Jurisdiction-specific and impossible to derive. Omit the line entirely if there is no registration',
  },
  {
    token: 'SUPPORT_EMAIL',
    what: 'The address a person can actually write to about their data',
    why: 'A data-rights contact that bounces is the same as no contact',
  },
  {
    token: 'GOVERNING_LAW',
    what: 'The jurisdiction whose law governs the terms, and the courts that hear a dispute',
    why: 'Depends on where the entity is registered, which is not in this repository',
  },
  {
    token: 'SUPABASE_REGION',
    what: 'The region the Supabase project runs in',
    why: 'It decides what to say about international transfers, and it is a dashboard setting rather than a fact in the code',
  },
  {
    token: 'PRO_PRICE',
    what: 'The subscription price and interval, per store and per currency',
    why: 'Set in App Store Connect and Play Console. A price written here would go stale the first time either changes',
  },
  {
    token: 'EFFECTIVE_DATE',
    what: 'The date these documents take effect',
    why: 'It is the day they are published, which is a decision rather than a fact about the code',
  },
]

const TOKEN = /\[\[([A-Z0-9_]+)\]\]/g

/** Every token a piece of text still carries, in the order it carries them. */
export function unfilled(text: string): string[] {
  return [...new Set([...text.matchAll(TOKEN)].map((match) => match[1] ?? ''))]
}

/** Tokens used somewhere that nobody declared — the list would be incomplete. */
export function undeclared(text: string): string[] {
  const known = new Set(PLACEHOLDERS.map((p) => p.token))
  return unfilled(text).filter((token) => !known.has(token))
}

/**
 * Fill what is known, leave the rest visible.
 *
 * Deliberately NOT a failure when a value is missing. A half-filled policy
 * that still shows `[[SUPPORT_EMAIL]]` is embarrassing in exactly the way
 * that gets it fixed; one that silently dropped the line would ship looking
 * finished with a legal requirement quietly absent.
 */
export function fill(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(TOKEN, (whole, token: string) => values[token] ?? whole)
}
