/**
 * The onboarding sweep (§Q Phase 7, §R).
 *
 * §R's first run is the one journey where a mistake is unrecoverable in the
 * way that matters: somebody confused here never reaches the rest of the app.
 * The pieces are tested individually already; what a SWEEP adds is the rules
 * that span the sequence and that no single component owns.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CompanyProvider } from '../app/context'
import { createMemoryRepositories, emptyState } from '../data/repositories'
import { DOCUMENT_TYPES } from '../domain/documents/types'
import { TERMINOLOGY_TABLES } from '../domain/locale/data/terminology'
import { FirstRun, SampleNotice } from '../features/onboarding/FirstRun'
import {
  type OnboardingState,
  checklist,
  remainingCount,
  shouldShowChecklist,
} from '../features/onboarding/checklist'
import { sampleRecords } from '../features/onboarding/sampleData'

const walk = (locale: string, node: React.ReactNode) => {
  const table = TERMINOLOGY_TABLES[locale]
  if (table === undefined) throw new Error(`no table for ${locale}`)
  return render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale }}
      language={table.language}
    >
      {node}
    </CompanyProvider>,
  )
}

describe('First run speaks the local language of documents (§R)', () => {
  it('names the suggested type by its LOCAL word, in each locale', () => {
    // §R: "create any of the four (under their local names)". A first screen
    // that says "Waybill" in Manchester is the first thing the app gets wrong
    // about somebody, and they have nothing else to judge it on yet.
    for (const locale of ['EN-NG', 'EN-GB', 'EN-US']) {
      const table = TERMINOLOGY_TABLES[locale]
      if (table === undefined) continue

      for (const type of DOCUMENT_TYPES) {
        const view = walk(
          locale,
          <FirstRun
            suggestedType={type}
            onCreate={() => undefined}
            onViewSample={() => undefined}
          />,
        )
        const local = table.types[type].label

        expect(
          screen.queryAllByText(new RegExp(local, 'i')).length,
          `${locale}/${type} first run never says "${local}"`,
        ).toBeGreaterThan(0)
        view.unmount()
      }
    }
  })

  it('asks for nothing before either way forward (Rule #1)', () => {
    // §R's first task is "create any of the four… or view a sample". What this
    // screen must not do is demand anything before either route — §D calls a
    // new required field the thing to avoid, and this is where one would hurt
    // most.
    walk(
      'EN-NG',
      <FirstRun suggestedType="invoice" onCreate={() => undefined} onViewSample={() => undefined} />,
    )

    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.queryAllByRole('textbox')).toEqual([])
    expect(screen.queryAllByRole('combobox')).toEqual([])
  })

  it('labels the sample as a sample, on screen, in its own words', () => {
    // §R: "sample records are visually labelled and excluded from balances".
    // The label is the whole reason the sample is allowed to exist at all.
    walk('EN-NG', <SampleNotice />)

    expect(screen.getByText(/this is a sample/i)).toBeInTheDocument()
    expect(screen.getByText(/not counted anywhere/i)).toBeInTheDocument()
  })

  it('keeps the sample out of the ledger by construction, not by a filter', () => {
    const { customer, document } = sampleRecords('co_1', 'invoice')

    expect(document.isSample).toBe(true)
    expect(customer.isSample).toBe(true)
    expect(document.id).toContain('sample')
  })
})

describe('The checklist finishes, and never nags (§R)', () => {
  const done: OnboardingState = {
    companyName: 'Dynamic Renaissance Ltd',
    region: 'NG',
    hasLogo: true,
    enabledPaymentMethodCount: 1,
    realDocumentCount: 1,
    dismissed: false,
  }

  it('disappears when the work is done', () => {
    // A checklist still sitting there after everything is ticked is a nag,
    // which §A rules out in the same breath as countdowns.
    expect(remainingCount(done)).toBe(0)
    expect(shouldShowChecklist(done)).toBe(false)
  })

  it('disappears when dismissed, with work outstanding', () => {
    // §R: "short, dismissible". Dismissible means it goes away.
    const outstanding: OnboardingState = { ...done, hasLogo: false, dismissed: true }

    expect(remainingCount(outstanding)).toBeGreaterThan(0)
    expect(shouldShowChecklist(outstanding)).toBe(false)
  })

  it('names the four steps §R names, in order, and no more', () => {
    expect(checklist({ ...done, companyName: '', hasLogo: false }).map((item) => item.id)).toEqual([
      'business_details',
      'logo',
      'payment',
      'first_document',
    ])
  })

  it('ticks from the state it describes, and a SAMPLE never ticks it', () => {
    // §R: "completing the underlying action ticks it automatically", and
    // "sample records are excluded from balances, counts and analytics" —
    // so viewing the sample must not tick "first document".
    const sampleOnly: OnboardingState = { ...done, realDocumentCount: 0 }

    expect(checklist(sampleOnly).find((item) => item.id === 'first_document')?.done).toBe(false)
    expect(checklist(done).find((item) => item.id === 'first_document')?.done).toBe(true)
  })
})
