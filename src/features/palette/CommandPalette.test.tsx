/**
 * The command palette (§Q Phase 7, §V).
 *
 * The keyboard contract is the test that matters. A palette you can only use
 * with a mouse is a menu with extra steps, and §V asks for the opposite:
 * everything reachable from a keyboard.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CommandPalette } from './CommandPalette'
import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { listPath, newDocumentPath, settingsPath } from '../../app/paths'
import { buildIndex } from '../search'
import { stringsFor } from '../../domain/locale/data/strings'

const strings = stringsFor('en')
const NG = { locale: 'EN-NG' } as const

const index = buildIndex(NG, {
  documents: [
    { id: 'doc_1', type: 'invoice', reference: 'INV-001', customerName: 'Okoro & Sons', frozenLabels: null },
  ],
  customers: [{ id: 'cu_1', name: 'Okoro & Sons' }],
  items: [{ id: 'it_1', name: 'Hardwood panels' }],
})

function open(over: { onGo?: (path: string) => void; onClose?: () => void } = {}) {
  const onGo = over.onGo ?? vi.fn()
  const onClose = over.onClose ?? vi.fn()
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={NG}
      language="en"
    >
      <CommandPalette open onClose={onClose} onGo={onGo} index={index} />
    </CompanyProvider>,
  )
  return { onGo, onClose, user: userEvent.setup() }
}

const options = () => screen.getAllByRole('option')
const selected = () => options().find((option) => option.getAttribute('aria-selected') === 'true')

describe('The command palette', () => {
  it('renders nothing at all when it is closed', () => {
    render(
      <CompanyProvider
        companyId="co_1"
        repositories={createMemoryRepositories(emptyState())}
        profile={NG}
        language="en"
      >
        <CommandPalette open={false} onClose={vi.fn()} onGo={vi.fn()} index={index} />
      </CompanyProvider>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens on the whole list, so the first use teaches what is in it', () => {
    open()
    const list = screen.getByRole('listbox')
    // Four tabs, four lists, twelve settings panels, four creates.
    expect(within(list).getAllByRole('option').length).toBe(24)
    expect(screen.getByRole('dialog', { name: strings.palette.title })).toBeInTheDocument()
  })

  it('puts focus in the field, and keeps Tab from escaping behind it', async () => {
    const { user } = open()
    const field = screen.getByRole('combobox')
    expect(document.activeElement).toBe(field)
    await user.tab()
    expect(document.activeElement).toBe(field)
  })

  it('moves the selection with the arrows, and wraps', async () => {
    const { user } = open()
    const first = options()[0]
    expect(selected()).toBe(first)

    await user.keyboard('{ArrowDown}')
    expect(selected()).toBe(options()[1])

    await user.keyboard('{ArrowUp}{ArrowUp}')
    // Up from the first row wraps to the last, rather than sticking.
    expect(selected()).toBe(options()[options().length - 1])
  })

  it('points aria-activedescendant at the selected row', async () => {
    const { user } = open()
    const field = screen.getByRole('combobox')
    await user.keyboard('{ArrowDown}')
    expect(field.getAttribute('aria-activedescendant')).toBe(selected()?.id)
  })

  it('goes where Enter says, and closes behind itself', async () => {
    const { user, onGo, onClose } = open()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onGo).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape without going anywhere', async () => {
    const { user, onGo, onClose } = open()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onGo).not.toHaveBeenCalled()
  })

  it('filters destinations as you type', async () => {
    const { user, onGo } = open()
    await user.type(screen.getByRole('combobox'), 'tax')
    await user.keyboard('{Enter}')
    expect(onGo).toHaveBeenCalledWith(settingsPath('tax'))
  })

  it('finds a record, and opens the record rather than a list', async () => {
    const { user, onGo } = open()
    await user.type(screen.getByRole('combobox'), 'INV-001')
    expect(screen.getByRole('option', { name: /INV-001/ })).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(onGo).toHaveBeenCalledWith('/doc/doc_1')
  })

  it('offers no row for a saved item, which has no page to open', async () => {
    const { user } = open()
    await user.type(screen.getByRole('combobox'), 'Hardwood')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(screen.getByText(strings.palette.noMatch)).toBeInTheDocument()
  })

  it('reaches a type by its internal name as well as its label (§D.3)', async () => {
    const { user, onGo } = open()
    await user.type(screen.getByRole('combobox'), 'waybill')
    await user.keyboard('{Enter}')
    expect(onGo).toHaveBeenCalledWith(listPath('waybill'))
  })

  it('creates as well as goes', async () => {
    const { user, onGo } = open()
    await user.type(screen.getByRole('combobox'), 'New Quotation')
    await user.keyboard('{Enter}')
    expect(onGo).toHaveBeenCalledWith(newDocumentPath('quotation'))
  })

  it('says how many results there are, for somebody who cannot see the list', async () => {
    const { user } = open()
    await user.type(screen.getByRole('combobox'), 'tax')
    expect(screen.getByRole('status')).toHaveTextContent(/\d+/)
  })
})
