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
 * The second half now has three failure modes rather than one, because
 * reading the rules found all three: a rule nobody has opened, a rule that
 * HAS been opened but by a machine and not yet stood behind, and a question
 * that cannot be answered at all until something exists — a plan in a
 * console, a form behind a developer account, or a feature nobody built.
 *
 * Neither half can stand in for the other, which is why they are combined
 * rather than merged. A repository that passes every check is not verified;
 * it is a repository whose claims are true, waiting for somebody to read the
 * rules those claims will be judged against.
 */

import type { Placeholder } from '../../legal/placeholders'
import { VALUES_FILE, missingValues } from '../../legal/values'
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
  /** Answerable today, and unanswered. */
  readonly open: readonly OpenQuestion[]
  /** Answerable by nobody yet, and why. */
  readonly blocked: readonly OpenQuestion[]
  /** Read, cited, and not yet stood behind by a person. */
  readonly unconfirmed: readonly { question: PolicyQuestion; market?: string; answer: Answer }[]
  /** Everything a store form can be filled in with, from evidence. */
  readonly declarations: readonly string[]
  /**
   * Business facts the legal documents still carry as `[[TOKEN]]` (§U).
   *
   * Beside `blocked` and `unconfirmed` rather than among the checks, because
   * no amount of code can invent a registered address — and a check that can
   * never pass holds the gate red on work that is not the code's to do.
   */
  readonly awaitingFacts: readonly Placeholder[]
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
  questions: readonly PolicyQuestion[] = QUESTIONS,
  /* Injectable like the rest, so a test can describe a fully answered world. */
  awaitingFacts: readonly Placeholder[] = missingValues(),
): PolicyReport {
  const open: OpenQuestion[] = []
  const blocked: OpenQuestion[] = []
  const unconfirmed: { question: PolicyQuestion; market?: string; answer: Answer }[] = []

  for (const entry of required(questions)) {
    const matching = answers.filter(
      (answer) =>
        answer.questionId === entry.question.id &&
        (entry.market === undefined || answer.market === entry.market),
    )
    const current = matching.find((answer) => isCurrent(answer, now))

    // Blocked FIRST, and regardless of the answer. A question whose rule has
    // been read but whose subject does not exist is not satisfied; the
    // account-deletion rule is read and the app still has no deletion.
    if (entry.question.blockedBy !== undefined) {
      blocked.push({
        question: entry.question,
        ...(entry.market === undefined ? {} : { market: entry.market }),
        why: current === undefined ? 'never answered' : 'answer expired',
        ...(current === undefined ? {} : { stale: current }),
      })
      continue
    }

    if (current !== undefined) {
      if (current.confirmedBy === undefined) {
        unconfirmed.push({
          question: entry.question,
          ...(entry.market === undefined ? {} : { market: entry.market }),
          answer: current,
        })
      }
      continue
    }

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
    blocked,
    unconfirmed,
    declarations: checks.map((check) => check.declares),
    awaitingFacts,
    codeClean,
    // Every half, and never one standing in for another. A machine-read
    // answer with a citation is a draft: §U asks for a person at submission
    // time, so `confirmedBy` is part of the gate and not a decoration.
    verified:
      codeClean &&
      open.length === 0 &&
      blocked.length === 0 &&
      unconfirmed.length === 0 &&
      // A policy with a blank where the entity name goes is not verified,
      // however clean the code is.
      awaitingFacts.length === 0,
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

  lines.push('', 'What cannot be answered yet, and what is in the way:')
  if (report.blocked.length === 0) lines.push('  nothing')
  for (const entry of report.blocked) {
    const where = entry.market === undefined ? '' : ` [${entry.market}]`
    lines.push(`  ${entry.question.store}/${entry.question.id}${where}`)
    lines.push(`       blocked by: ${entry.question.blockedBy ?? ''}`)
    if (entry.stale !== undefined) {
      lines.push(`       the rule itself was read ${entry.stale.readAt} by ${entry.stale.readBy}`)
    }
  }

  lines.push('', 'Read and cited, waiting for a person to stand behind it:')
  if (report.unconfirmed.length === 0) lines.push('  nothing')
  for (const entry of report.unconfirmed) {
    const where = entry.market === undefined ? '' : ` [${entry.market}]`
    lines.push(
      `  ${entry.question.store}/${entry.question.id}${where} — read ${entry.answer.readAt} by ${entry.answer.readBy}`,
    )
    lines.push(`       source: ${entry.answer.source}`)
  }

  /*
   * THE FACTS NOBODY HERE MAY INVENT, listed with what each one is — so the
   * person who can answer them sees the question rather than a token.
   */
  lines.push('', `Business facts still blank, for ${VALUES_FILE}:`)
  if (report.awaitingFacts.length === 0) lines.push('  nothing')
  for (const fact of report.awaitingFacts) {
    lines.push(`  ${fact.token} — ${fact.what}`)
    lines.push(`       why it cannot be guessed: ${fact.why}`)
  }

  lines.push(
    '',
    report.verified
      ? 'Verified: the code is clean and every rule has been read recently.'
      : `NOT verified — ${report.open.length} unread, ${report.blocked.length} blocked, ` +
          `${report.unconfirmed.length} awaiting a person, ` +
          `${report.awaitingFacts.length} business facts blank` +
          (report.codeClean ? '' : ', and the code checks are failing'),
  )
  return lines.join('\n')
}
