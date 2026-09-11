/**
 * Step 4 — Design (§H, §G logo switch).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { TEMPLATES } from '../../pdf/templates'
import { DesignStep } from './DesignStep'

function setup(over: Partial<React.ComponentProps<typeof DesignStep>> = {}) {
  const repositories = createMemoryRepositories(emptyState())
  const props = {
    selected: 'classic' as const,
    showLogo: true,
    brandColours: ['#2b3fd6', '#0F6E56'],
    brandColour: '#2b3fd6',
    onSelect: vi.fn(),
    onToggleLogo: vi.fn(),
    onBrandColour: vi.fn(),
    preview: <div>preview</div>,
    ...over,
  }
  render(
    <CompanyProvider companyId="co_1" repositories={repositories} profile={{ locale: 'EN-NG' }} language="en">
      <DesignStep {...props} />
    </CompanyProvider>,
  )
  return props
}

describe('One continuous strip of sixteen (§H)', () => {
  it('offers every design, with no original/new headings', () => {
    setup()
    for (const template of TEMPLATES) {
      expect(screen.getByRole('button', { name: new RegExp(template.name) })).toBeInTheDocument()
    }
    // §H is explicit that the strip carries no section headings.
    expect(screen.queryByText(/original/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /new/i })).not.toBeInTheDocument()
  })

  it('tags exactly the six newer designs', () => {
    setup()
    expect(screen.getAllByText('NEW')).toHaveLength(6)
  })

  it('marks the selected design and re-selects on tap', async () => {
    const user = userEvent.setup()
    const props = setup({ selected: 'aurora' })
    expect(screen.getByRole('button', { name: /Aurora/ })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /Ledger/ }))
    expect(props.onSelect).toHaveBeenCalledWith('ledger')
  })

  it('shows the current design name in the pill as well as its strip card', () => {
    setup({ selected: 'bloom' })
    // Twice by design: once in the pill above the strip, once on the card.
    expect(screen.getAllByText('Bloom')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Bloom/ })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('The logo switch (§G)', () => {
  it('carries aria-pressed and a hint line that matches it', () => {
    setup({ showLogo: true })
    const toggle = screen.getByRole('button', { name: /logo on/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Your logo prints at the top of every design')).toBeInTheDocument()
  })

  it('says the opposite, in both places, when off', () => {
    setup({ showLogo: false })
    const toggle = screen.getByRole('button', { name: /logo off/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Logo hidden — only your business name prints')).toBeInTheDocument()
    // The hint must never contradict the switch — that pairing is the point.
    expect(screen.queryByText('Your logo prints at the top of every design')).not.toBeInTheDocument()
  })

  it('toggles', async () => {
    const user = userEvent.setup()
    const props = setup({ showLogo: true })
    await user.click(screen.getByRole('button', { name: /logo on/i }))
    expect(props.onToggleLogo).toHaveBeenCalledWith(false)
  })
})

describe('Brand colour dots', () => {
  it('marks the active colour and reports a change', async () => {
    const user = userEvent.setup()
    const props = setup()
    expect(screen.getByRole('button', { name: '#2b3fd6' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: '#0F6E56' }))
    expect(props.onBrandColour).toHaveBeenCalledWith('#0F6E56')
  })
})

describe('The live preview is the caller’s, shared with Settings (§H)', () => {
  it('renders whatever preview it is given', () => {
    setup({ preview: <div>live preview here</div> })
    expect(screen.getByText('live preview here')).toBeInTheDocument()
  })
})
