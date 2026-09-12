/**
 * The statement period (§G — "for any period").
 */

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { OPEN_START, PeriodPicker, periodFor } from './PeriodPicker'

const TODAY = '2026-09-12'

function renderPicker(over: Partial<React.ComponentProps<typeof PeriodPicker>> = {}) {
  const props: React.ComponentProps<typeof PeriodPicker> = {
    period: periodFor('last_12', TODAY),
    today: TODAY,
    onChange: vi.fn(),
    ...over,
  }
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <PeriodPicker {...props} />
    </CompanyProvider>,
  )
  return props
}

describe('The presets', () => {
  it('covers whole months, ending after the current one', () => {
    expect(periodFor('this_month', TODAY)).toEqual({ from: '2026-09-01', to: '2026-10-01' })
    expect(periodFor('last_3', TODAY)).toEqual({ from: '2026-07-01', to: '2026-10-01' })
    expect(periodFor('last_12', TODAY)).toEqual({ from: '2025-10-01', to: '2026-10-01' })
  })

  it('leaves the start open for "everything" rather than guessing a year', () => {
    expect(periodFor('everything', TODAY).from).toBe(OPEN_START)
  })
})

describe('The picker (§G)', () => {
  it('marks the preset in force', () => {
    renderPicker()
    expect(screen.getByRole('button', { name: 'Last 12 months', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'This month', pressed: false })).toBeInTheDocument()
  })

  it('changes the period from a chip', async () => {
    const user = userEvent.setup()
    const props = renderPicker()
    await user.click(screen.getByRole('button', { name: 'This month' }))
    expect(props.onChange).toHaveBeenCalledWith({ from: '2026-09-01', to: '2026-10-01' })
  })

  it('takes a hand-picked start date', () => {
    const props = renderPicker()
    // A date input commits a whole value at once, so this is the event the
    // browser actually sends — typing it character by character is not.
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-03-01' } })
    expect(props.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-03-01' }),
    )
  })

  it('shows an open start as empty rather than as a sentinel year', () => {
    renderPicker({ period: periodFor('everything', TODAY) })
    expect(screen.getByLabelText('From')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Everything', pressed: true })).toBeInTheDocument()
  })

  it('never lets the end date be cleared, which would cover nothing', () => {
    const props = renderPicker()
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '' } })
    expect(props.onChange).not.toHaveBeenCalled()
  })
})
