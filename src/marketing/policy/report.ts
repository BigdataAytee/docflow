/**
 * Is DocFlow ready to submit? (§T "store-policy verification at submission
 * time", §V.)
 *
 * One answer, from two halves that fail differently:
 *
 *  · what the CODE does — checked here, today, and a failure is a bug;
 *  · what the STORES currently require — a question for a person, and a
 *    failure is an unread rule.
 *
 * Neither half can stand in for the other, which is why they are combined
 * rather than merged. A repository that passes every check is not verified;
 * it is a repository whose claims are true, waiting for somebody to read the
 * rules those claims will be judged against.
 */

import { type CheckResult, runChecks } from './checks'
import {
  ANSWERS,
  ANSWER_VALID_DAYS,
  type Answer,
  type PolicyQuestion,
  QUESTIONS,
  SUBMISSION_MARKETS,
  isCurrent,
} from './questions'

export interface OpenQuestion {
  readonly question: PolicyQuestion
  readonly market?: string
  readonly why: 'never answered' | 'answer expired'
  /** The stale answer, when there is one. */
  readonly stale?: Answer
}

export interface PolicyReport {
  readonly checks: readonly CheckResult[]
  readonly open: readonly OpenQuestion[]
  /** Everything a store form can be filled in with, from evidence. */
  readonly declarations: readonly string[]
  readonly codeClean: boolean
  readonly verified: boolean
}

/** Every (question, market) pair that needs an answer. */
export function required(
  questions: readonly PolicyQuestion[] = QUESTIONS,
  markets: readonly string[] = SUBMISSION_MARKETS,
): readonly { question: PolicyQuestion; market?: string }[] {
  return questions.flatMap((question) =>
    question.perMarket
      ? markets.map((market) => ({ question, market }))
      : [{ question }],
  )
}

export function policyReport(
  now: Date = new Date(),
  answers: readonly Answer[] = ANSWERS,
  checks: readonly CheckResult[] = runChecks(),
): PolicyReport {
  const open: OpenQuestion[] = []

  for (const entry of required()) {
    const matching = answers.filter(
      (answer) =>
        answer.questionId === entry.question.id &&
        (entry.market === undefined || answer.market === entry.market),
    )
    const current = matching.find((answer) => isCurrent(answer, now))
    if (current !== undefined) continue

    // The most recent stale answer, so the report can say when it was read
    // rather than only that it is too old.
    const newest = [...matching].sort((a, b) => b.readAt.localeCompare(a.readAt))[0]
    open.push({
      question: entry.question,
      ...(entry.market === undefined ? {} : { market: entry.market }),
      why: newest === undefined ? 'never answered' : 'answer expired',
      ...(newest === undefined ? {} : { stale: newest }),
    })
  }

  const codeClean = checks.every((check) => check.passed)

  return {
    checks,
    open,
    declarations: checks.map((check) => check.declares),
    codeClean,
    // Both halves, and never one standing in for the other.
    verified: codeClean && open.length === 0,
  }
}

export function reportOf(report: PolicyReport): string {
  const lines: string[] = ['What the code says, checked:']
  for (const check of report.checks) {
    lines.push(`  ${check.passed ? 'ok  ' : 'FAIL'} ${check.check}`)
    for (const finding of check.findings) lines.push(`       ${finding.detail}`)
  }

  lines.push('', 'What a store form can be filled in with, from that evidence:')
  for (const declaration of report.declarations) lines.push(`  · ${declaration}`)

  lines.push('', `What nobody has read yet (answers expire after ${ANSWER_VALID_DAYS} days):`)
  if (report.open.length === 0) lines.push('  nothing')
  for (const entry of report.open) {
    const where = entry.market === undefined ? '' : ` [${entry.market}]`
    lines.push(`  ${entry.question.store}/${entry.question.id}${where} — ${entry.why}`)
    lines.push(`       ask: ${entry.question.question}`)
    lines.push(`       look in: ${entry.question.lookIn}`)
    if (entry.stale !== undefined) {
      lines.push(`       last read ${entry.stale.readAt} by ${entry.stale.readBy}`)
    }
  }

  lines.push(
    '',
    report.verified
      ? 'Verified: the code is clean and every rule has been read recently.'
      : `NOT verified — ${report.open.length} unread rules` +
          (report.codeClean ? '' : ', and the code checks are failing'),
  )
  return lines.join('\n')
}
