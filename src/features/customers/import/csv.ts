/**
 * CSV customer import, with the column mapping the owner can see (§Q Phase 4).
 *
 * §Q asks for "CSV customer import with column-mapping preview", and the
 * preview is the requirement — not the parse. A small business exports a
 * customer list from whatever they used before, and the column headings are
 * whatever that thing called them: `Customer Name`, `NAME`, `Client`, `Nama`.
 * An importer that guesses silently and gets it wrong writes hundreds of rows
 * with phone numbers in the address field, and the owner finds out one
 * invoice at a time.
 *
 * So this does two separable things:
 *
 *  1. `parseCsv` — text to rows, handling the quoting rules real exports use.
 *  2. `guessMapping` — a PROPOSAL, which the screen shows and the owner can
 *     change before anything is written. Every guess is visible; none is
 *     binding.
 *
 * Rule #1 applies to the guess: getting the common case right means the owner
 * usually presses one button, and getting it visibly wrong is recoverable
 * because they were shown it first.
 */

import type { ImportCandidate } from './dedupe'

export const IMPORT_FIELDS = ['name', 'phone', 'email', 'address'] as const
export type ImportField = (typeof IMPORT_FIELDS)[number]

/** Column index per field. `null` means "this import has no such column". */
export type ColumnMapping = Readonly<Record<ImportField, number | null>>

export interface ParsedCsv {
  readonly headers: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

/**
 * RFC 4180, as far as real spreadsheet exports go.
 *
 * Written out rather than pulled from a library because the whole surface is
 * three rules — quotes wrap a field, a doubled quote inside quotes is a
 * literal quote, and a newline inside quotes belongs to the field — and every
 * one of them shows up in an address column. A dependency for this would be
 * more code to audit, not less.
 */
export function parseCsv(text: string, delimiter = ','): ParsedCsv {
  // Excel writes a UTF-8 BOM. Left in, it becomes part of the first heading,
  // and the mapping fails to recognise a column called "name".
  // Matched by ESCAPE rather than by the character itself: a literal BOM in
  // this source file is invisible in every editor and every diff, which is a
  // poor way to write the one line whose job is removing an invisible
  // character. ESLint's no-irregular-whitespace rule says the same thing.
  const input = text.replace(/^\uFEFF/, '')

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"'
          index += 1
        } else quoted = false
      } else field += char
      continue
    }

    if (char === '"' && field === '') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      // \r\n counts once.
      if (char === '\r' && input[index + 1] === '\n') index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // A trailing newline should not produce a row of one empty string.
  const cleaned = rows.filter((entry) => entry.some((cell) => cell.trim() !== ''))
  const [headers = [], ...body] = cleaned
  return { headers: headers.map((heading) => heading.trim()), rows: body }
}

/**
 * The headings this has met before, per field.
 *
 * Deliberately a list rather than fuzzy matching: a heading either is one of
 * these or the owner picks the column. An importer that half-recognises
 * `Phone 2` as the phone column is worse than one that asks.
 *
 * Written the way a person would type them, then folded through the SAME
 * `fold` as the file's headings before any comparison. Storing them
 * pre-folded would work until someone added a natural-looking entry and it
 * silently never matched — which is exactly what `e-mail` did here: the
 * heading folded to `e mail`, the synonym kept its hyphen, and every export
 * with an `E-Mail` column quietly lost its email addresses.
 */
const SYNONYMS: Readonly<Record<ImportField, readonly string[]>> = {
  name: ['name', 'customer', 'customer name', 'client', 'client name', 'company', 'business', 'contact', 'full name'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'telephone', 'tel', 'msisdn', 'contact number', 'whatsapp'],
  email: ['email', 'e-mail', 'email address', 'mail'],
  address: ['address', 'street', 'location', 'delivery address', 'street address'],
}

const fold = (heading: string): string =>
  heading.trim().toLocaleLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')

/** The synonyms, through the same fold as the headings. Computed once. */
const FOLDED: Readonly<Record<ImportField, readonly string[]>> = {
  name: SYNONYMS.name.map(fold),
  phone: SYNONYMS.phone.map(fold),
  email: SYNONYMS.email.map(fold),
  address: SYNONYMS.address.map(fold),
}

/**
 * A proposal, not a decision.
 *
 * Exact matches first across ALL fields, then prefix matches — otherwise a
 * file with both `Name` and `Company Name` could give `name` to whichever
 * column happened to come first.
 */
export function guessMapping(headers: readonly string[]): ColumnMapping {
  const folded = headers.map(fold)
  const mapping: Record<ImportField, number | null> = {
    name: null,
    phone: null,
    email: null,
    address: null,
  }
  const taken = new Set<number>()

  for (const pass of ['exact', 'prefix'] as const) {
    for (const field of IMPORT_FIELDS) {
      if (mapping[field] !== null) continue
      const index = folded.findIndex((heading, at) => {
        if (taken.has(at) || heading === '') return false
        return pass === 'exact'
          ? FOLDED[field].includes(heading)
          : FOLDED[field].some((synonym) => heading.startsWith(synonym))
      })
      if (index >= 0) {
        mapping[field] = index
        taken.add(index)
      }
    }
  }

  return mapping
}

/** Whether an import can proceed at all. A customer with no name is not one. */
export const isMappable = (mapping: ColumnMapping): boolean => mapping.name !== null

/**
 * Rows plus a mapping to candidates.
 *
 * Takes the mapping as an argument — the owner's, after any correction — so
 * the rows written are the rows they were shown.
 */
export function toCandidates(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
): ImportCandidate[] {
  const read = (row: readonly string[], field: ImportField): string | undefined => {
    const index = mapping[field]
    if (index === null) return undefined
    const value = row[index]?.trim()
    return value === undefined || value === '' ? undefined : value
  }

  return parsed.rows.map((row) => ({
    name: read(row, 'name') ?? '',
    ...optional('phone', read(row, 'phone')),
    ...optional('email', read(row, 'email')),
    ...optional('address', read(row, 'address')),
  }))
}

const optional = <T>(key: string, value: T | undefined): Record<string, T> =>
  value === undefined ? {} : { [key]: value }
