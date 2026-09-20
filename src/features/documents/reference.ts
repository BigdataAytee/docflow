/**
 * Issued references (§M).
 *
 * "Use server-reserved number blocks where available; the offline fallback is
 * a stable device-qualified final reference. The server enforces
 * company/type/reference uniqueness … A gapless central sequence would force
 * online issuance and is rejected."
 *
 * §M leaves the format as a design task: "the device-qualified format must be
 * customer-presentable — short, prefix-consistent, explained in one line in
 * Settings." This resolves it.
 *
 *   From a reserved block:  INV-0042
 *   Issued offline:         INV-0042-K3
 *
 * The suffix is two characters derived from the device id, stable for the life
 * of that device. It is short, keeps the prefix and number shape a customer
 * already recognises, and reads as part of the number rather than machinery.
 * The one-line explanation for Settings is EXPLANATION below.
 *
 * Why a device suffix rather than a wider number range: two phones offline at
 * once must not both mint INV-0042, and the alternative — asking the server
 * before issuing — would break Rule #3.
 */

export class ReferenceError extends Error {}

/** Crockford base32 without I, L, O and U, so nothing reads as a digit. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const SUFFIX_LENGTH = 2

/** The line Settings shows beneath the numbering prefixes (§M). */
export const EXPLANATION =
  'Documents you create without internet carry a short tag like -K3 so two phones never make the same number.'

/**
 * A stable two-character tag for this device. Same device id in, same tag out,
 * for the life of the install — a reference must never change after issue.
 */
export function deviceTag(deviceId: string): string {
  if (deviceId.trim() === '') {
    throw new ReferenceError('A device id is needed before a document can be issued offline.')
  }

  // FNV-1a: tiny, deterministic, and no dependency. Collision resistance is
  // not the point — the server enforces uniqueness (§M); this only has to make
  // a clash between two phones unlikely enough to be a non-event.
  let hash = 0x811c9dc5
  for (let i = 0; i < deviceId.length; i++) {
    hash ^= deviceId.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  let tag = ''
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    tag = (ALPHABET[hash % ALPHABET.length] ?? '0') + tag
    hash = Math.floor(hash / ALPHABET.length)
  }
  return tag
}

export interface ReferenceInput {
  /** The company's configured prefix for this type. Always wins (§D). */
  readonly prefix: string
  readonly sequence: number
  /** Present when the number came from a server-reserved block (§M). */
  readonly fromReservedBlock: boolean
  readonly deviceId: string
  readonly padTo?: number
}

export function buildReference(input: ReferenceInput): string {
  const prefix = input.prefix.trim()
  if (prefix === '') throw new ReferenceError('A numbering prefix is needed.')
  if (!Number.isInteger(input.sequence) || input.sequence < 1) {
    throw new ReferenceError(`Sequence must be a positive whole number, got ${input.sequence}.`)
  }

  const number = String(input.sequence).padStart(input.padTo ?? 4, '0')
  const base = `${prefix}-${number}`

  // A reserved number is already unique company-wide, so it needs no tag —
  // and most documents will have one. The tag is the offline exception, not
  // the rule, which is what keeps it from looking like machinery.
  return input.fromReservedBlock ? base : `${base}-${deviceTag(input.deviceId)}`
}

/** Splits a reference back into its parts, for display and for search. */
export function parseReference(reference: string): {
  prefix: string
  sequence: number
  deviceTag: string | null
} | null {
  const match = /^([A-Za-z]+)-(\d+)(?:-([0-9A-Z]{2}))?$/.exec(reference.trim())
  if (match === null) return null
  const [, prefix, digits, tag] = match
  if (prefix === undefined || digits === undefined) return null
  return { prefix, sequence: Number(digits), deviceTag: tag ?? null }
}

/** True when this reference was minted offline — for the Settings explainer. */
export const wasIssuedOffline = (reference: string): boolean =>
  parseReference(reference)?.deviceTag != null

/**
 * The next number that is not already taken (§G, §M).
 *
 * THE COUNT WAS NOT THE ANSWER. Every caller worked the sequence out as "how
 * many documents of this type exist, plus one", which is only the next free
 * number while nothing has ever been removed and nobody has ever typed their
 * own. Void one of five invoices and the count says four — so the next
 * document is offered INV-0004, which already exists. §M's unique constraint
 * then refuses it at the worst possible moment, with the customer waiting.
 *
 * So it reads the references that were actually ISSUED and goes one past the
 * highest. A reference the owner typed by hand counts too: `DR-INV-0413`
 * parses to 413, and the next automatic number steps over it rather than
 * walking into it.
 *
 * Drafts are ignored, because a draft has no reference yet — that is the
 * whole reason this function exists.
 */
export function nextSequence(references: readonly (string | null | undefined)[]): number {
  let highest = 0
  for (const reference of references) {
    if (reference === null || reference === undefined || reference === '') continue
    const parsed = parseReference(reference)
    if (parsed !== null && parsed.sequence > highest) highest = parsed.sequence
  }
  return highest + 1
}

/**
 * The number this document would be given, shown before it is issued.
 *
 * The field sat EMPTY and the page said `INV-…`, so the one question an owner
 * has about numbering — what is this going to be called — had no answer until
 * after they committed. Offered rather than stored: leave it alone and the
 * sequence is worked out again at issue, which is later and therefore more
 * nearly right; type over it and it becomes the override.
 */
export function suggestedReference(input: {
  readonly prefix: string
  readonly references: readonly (string | null | undefined)[]
  readonly deviceId: string
  readonly fromReservedBlock?: boolean
}): string {
  return buildReference({
    prefix: input.prefix,
    sequence: nextSequence(input.references),
    fromReservedBlock: input.fromReservedBlock ?? false,
    deviceId: input.deviceId,
  })
}
