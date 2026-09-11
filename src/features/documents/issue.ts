/**
 * Issuing a document (§G step 5, §M).
 *
 * "Final issue validates the signature requirement and per-type required
 * fields, and snapshots the frozen labels (§D) alongside the reference."
 *
 * Reference, labels and totals freeze TOGETHER, in one value, because a
 * document that got its number but not its labels — or its labels but not its
 * totals — is a half-issued document, and §M says none of the three may ever
 * change afterwards. Returning one frozen object means the caller cannot
 * persist a partial issue.
 */

import type { FrozenLabels } from '../../domain/documents/types'
import { assertTransition } from '../../domain/documents/lifecycle'
import { type LocaleProfile, freezeLabels } from '../../domain/locale/profile'
import { type DocumentTotals, computeTotals } from '../../domain/money/totals'
import { carriesMoney } from '../../domain/documents/types'
import {
  type DocumentDraft,
  type IssueContext,
  type IssueProblem,
  validateForIssue,
} from './builder'
import { buildReference } from './reference'

export class IssueError extends Error {
  constructor(
    message: string,
    readonly problems: readonly IssueProblem[] = [],
  ) {
    super(message)
    this.name = 'IssueError'
  }
}

export interface IssueInput {
  readonly draft: DocumentDraft
  readonly currentStatus: string
  readonly context: IssueContext
  readonly profile: LocaleProfile
  readonly prefix: string
  readonly sequence: number
  readonly fromReservedBlock: boolean
  readonly deviceId: string
  readonly issuedAt: string
  readonly discountRate?: number
  readonly taxRate?: number
  readonly whtRate?: number
}

/** Everything that freezes at issue, as one indivisible value (§M). */
export interface IssuedDocument {
  readonly reference: string
  readonly frozenLabels: FrozenLabels
  /** Null for a delivery document, which carries no money (§V). */
  readonly totals: DocumentTotals | null
  readonly issuedAt: string
  readonly status: 'issued'
}

export function issueDocument(input: IssueInput): IssuedDocument {
  const problems = validateForIssue(input.draft, input.context)
  if (problems.length > 0) {
    throw new IssueError(
      `This ${input.draft.type} is not ready to issue.`,
      problems,
    )
  }

  // The lifecycle decides whether issuing is even legal from here — an already
  // issued document cannot be issued again and mint a second reference.
  assertTransition(input.draft.type, input.currentStatus, 'issued')

  const reference = buildReference({
    prefix: input.prefix,
    sequence: input.sequence,
    fromReservedBlock: input.fromReservedBlock,
    deviceId: input.deviceId,
  })

  const totals = carriesMoney(input.draft.type)
    ? computeTotals({
        type: input.draft.type,
        currency: input.draft.currency,
        lines: input.draft.lineItems,
        ...(input.discountRate === undefined ? {} : { discountRate: input.discountRate }),
        ...(input.taxRate === undefined ? {} : { taxRate: input.taxRate }),
        ...(input.draft.type === 'invoice' && input.whtRate !== undefined
          ? { whtRate: input.whtRate }
          : {}),
      })
    : null

  return Object.freeze({
    reference,
    frozenLabels: freezeLabels(input.profile, input.draft.type),
    totals,
    issuedAt: input.issuedAt,
    status: 'issued' as const,
  })
}
