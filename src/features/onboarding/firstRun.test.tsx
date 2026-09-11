/**
 * Improvement 8 — first run and the labelled sample (§R, §L8, §V).
 *
 * §V's clause: "A new user … creates the first real document with no demo
 * balances." So the sample must be visible, obviously a sample, and incapable
 * of reaching a figure.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { DOCUMENT_TYPES } from '../../domain/documents/types'
import { money } from '../../domain/money/money'
import { outstandingByCurrency, type StatDocument } from '../home/stats'
import { FirstRun, SampleNotice } from './FirstRun'
import { SAMPLE_DOCUMENT_ID, sampleDocument, sampleRecords } from './sampleData'
import { SampleError, assertNotSample, isSample, realOnly } from './sample'

const wrap = (node: React.ReactNode, locale = 'EN-NG') => {
  const repositories = createMemoryRepositories(emptyState())
  return render(
    <CompanyProvider companyId="co_1" repositories={repositories} profile={{ locale }} language="en">
      {node}
    </CompanyProvider>,
  )
}

describe('First run offers both paths (§L8, §R)', () => {
  it('names the first document in the local terminology', () => {
    wrap(<FirstRun suggestedType="waybill" onCreate={vi.fn()} onViewSample={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Create my first Waybill' })).toBeInTheDocument()
  })

  it('names it differently in the UK, on the very first screen (Rule #5)', () => {
    wrap(<FirstRun suggestedType="waybill" onCreate={vi.fn()} onViewSample={vi.fn()} />, 'EN-GB')
    expect(screen.getByRole('button', { name: 'Create my first Delivery note' })).toBeInTheDocument()
  })

  it('offers the sample, marked as one', () => {
    wrap(<FirstRun suggestedType="invoice" onCreate={vi.fn()} onViewSample={vi.fn()} />)
    const sampleButton = screen.getByRole('button', { name: /view a sample/i })
    expect(sampleButton).toBeInTheDocument()
    expect(screen.getByRole('note', { name: 'SAMPLE' })).toBeInTheDocument()
  })

  it('reports which type to create', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    wrap(<FirstRun suggestedType="quotation" onCreate={onCreate} onViewSample={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /Create my first/ }))
    expect(onCreate).toHaveBeenCalledWith('quotation')
  })
})

describe('A sample is visibly a sample (§R)', () => {
  it('carries a badge announced to assistive tech, not colour alone (§K)', () => {
    wrap(<SampleNotice />)
    expect(screen.getByRole('note', { name: 'SAMPLE' })).toBeInTheDocument()
  })

  it('says its figures are not counted and it can be deleted', () => {
    wrap(<SampleNotice />)
    expect(screen.getByText(/not counted anywhere/i)).toBeInTheDocument()
    expect(screen.getByText(/delete it whenever/i)).toBeInTheDocument()
  })
})

describe('The seeded sample cannot become real work (§R, §V)', () => {
  it('marks every seeded record as a sample', () => {
    const { customer, document } = sampleRecords('co_1')
    expect(isSample(customer)).toBe(true)
    expect(isSample(document)).toBe(true)
  })

  it('uses a reference that is not part of the user numbering', () => {
    // No prefix and no sequence, so it can never collide with INV-0001 or be
    // mistaken for a document the user issued.
    expect(sampleDocument('co_1').reference).toBe('SAMPLE')
    expect(sampleDocument('co_1').id).toBe(SAMPLE_DOCUMENT_ID)
  })

  it('contributes nothing to Outstanding (§V: "no demo balances")', () => {
    const real: StatDocument = {
      id: 'i1',
      type: 'invoice',
      status: 'issued',
      total: money('NGN', 145_000_00),
    }
    const sample = sampleDocument('co_1')
    const documents = [real, { ...sample, total: sample.total }]

    expect(outstandingByCurrency(realOnly(documents), []).get('NGN')).toEqual(
      money('NGN', 145_000_00),
    )
  })

  it('shows a brand-new account no balance at all', () => {
    const only = realOnly([sampleDocument('co_1')])
    expect(only).toEqual([])
    expect(outstandingByCurrency(only, []).size).toBe(0)
  })

  it('refuses to be issued', () => {
    expect(() => assertNotSample(sampleDocument('co_1'), 'issued')).toThrow(SampleError)
  })

  it('carries no money at all when the sample is a delivery document (§V)', () => {
    const delivery = sampleDocument('co_1', 'waybill')
    expect(delivery.total.minor).toBe(0)
    expect(delivery.lineItems.every((line) => line.unitPriceMinor === undefined)).toBe(true)
  })

  it('can be produced for every type, under its own local name', () => {
    for (const type of DOCUMENT_TYPES) {
      const document = sampleDocument('co_1', type)
      expect(document.type, type).toBe(type)
      expect(isSample(document), type).toBe(true)
    }
  })
})
