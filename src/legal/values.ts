/**
 * Where the eight business facts go when somebody knows them (§U).
 *
 * `placeholders.ts` declares what cannot be invented and `documents.ts` writes
 * `[[TOKEN]]` wherever one belongs. What was missing was the other half: any
 * place at all to PUT the answers. So the policy rendered with the tokens
 * still in it, and `dist-site/legal/privacy/index.html` shipped a page reading
 * "write to [[SUPPORT_EMAIL]]" — a data-rights contact that is not an address.
 *
 * A FILE, NOT ENVIRONMENT VARIABLES, and not code. None of these is a secret:
 * a registered address is public by definition, a company number is a matter
 * of record, and a governing-law clause is meant to be read. What they need is
 * to be reviewable — somebody should be able to see, in a diff, that the
 * entity name on the terms changed. A `.env` value cannot be reviewed and a
 * constant in a `.ts` file invites the next person to edit it in passing.
 *
 * ABSENT BY DEFAULT, and that is deliberate. The file does not exist until a
 * person writes it, the tokens stay visible until they do, and the publish
 * gate refuses a site that still carries one. A half-filled policy that shows
 * `[[SUPPORT_EMAIL]]` is embarrassing in exactly the way that gets it fixed;
 * one that silently dropped the line would ship looking finished with a legal
 * requirement quietly missing.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PLACEHOLDERS } from './placeholders'

/** Checked in beside the code, so a change to it appears in a diff. */
export const VALUES_FILE = 'legal/values.json'

export class LegalValuesError extends Error {}

/**
 * The answers, or none.
 *
 * A malformed file THROWS rather than falling back to empty. Silently
 * treating a typo as "nobody has filled these in" would publish a policy full
 * of tokens while somebody believed they had filled it in.
 */
export function legalValues(cwd: string = process.cwd()): Readonly<Record<string, string>> {
  const path = join(cwd, VALUES_FILE)
  if (!existsSync(path)) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (cause) {
    throw new LegalValuesError(
      `${VALUES_FILE} is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
    )
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new LegalValuesError(`${VALUES_FILE} must be an object of token to value.`)
  }

  const known = new Set(PLACEHOLDERS.map((placeholder) => placeholder.token))
  const values: Record<string, string> = {}
  for (const [token, value] of Object.entries(parsed as Record<string, unknown>)) {
    /*
     * An unknown key is an ERROR, not something to ignore. It is almost
     * always a typo — `SUPPORT_EMAL` — and ignoring it would leave the real
     * token unfilled while the file looks complete.
     */
    if (!known.has(token)) {
      throw new LegalValuesError(
        `${VALUES_FILE} sets ${token}, which no document uses. Known tokens: ${[...known].sort().join(', ')}`,
      )
    }
    if (typeof value !== 'string' || value.trim() === '') {
      throw new LegalValuesError(`${VALUES_FILE} gives ${token} no value.`)
    }
    values[token] = value.trim()
  }
  return values
}

/** What is still missing, for a person to be told rather than to discover. */
export function missingValues(
  values: Readonly<Record<string, string>> = legalValues(),
): readonly (typeof PLACEHOLDERS)[number][] {
  return PLACEHOLDERS.filter((placeholder) => values[placeholder.token] === undefined)
}

/** The example file, written from the declarations so it cannot go stale. */
export const valuesTemplate = (): string =>
  `${JSON.stringify(
    Object.fromEntries(
      PLACEHOLDERS.map((placeholder) => [placeholder.token, `<${placeholder.what}>`]),
    ),
    null,
    2,
  )}\n`
