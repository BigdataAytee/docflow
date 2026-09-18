/**
 * A Settings field that says whether it saved (§G, §N).
 *
 * Settings has always saved automatically and never said so: every field was
 * `onChange={(v) => void actions.updateCompany({ ... })}`, the promise
 * DISCARDED. So a save that landed and one that failed looked identical, and
 * a failure took the typed value with it — the box is fed from the company
 * record, and a failed write leaves that record unchanged.
 *
 * The owner asked for a per-field tick that confirms the WRITE landed rather
 * than that the input changed, and for a failure to say so while keeping
 * their value. These are those two properties.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { SavedField } from './SavedField'

const wrap = (node: React.ReactNode) =>
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      {node}
    </CompanyProvider>,
  )

const mark = () => document.querySelector('[data-save-state]')

describe('The tick means the write landed, not that the input changed', () => {
  /**
   * THE ONE THIS IS FOR. A per-keystroke tick would be true while nothing was
   * stored; this one cannot appear until the repository's promise resolves.
   */
  it('says nothing until the write resolves, then says Saved', async () => {
    const user = userEvent.setup()
    let settle: (() => void) | undefined
    const onCommit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve
        }),
    )
    wrap(<SavedField label="Business name" value="" onCommit={onCommit} />)

    await user.type(screen.getByLabelText('Business name'), 'Sola Ventures')
    await user.tab() // leaving the box writes immediately

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith('Sola Ventures'))
    // In flight: not yet a fact about storage.
    expect(mark()?.textContent).not.toContain('Saved')

    settle?.()
    await waitFor(() => expect(mark()?.textContent).toContain('Saved'))
  })

  /** And nothing is claimed while somebody is still typing. */
  it('claims nothing mid-typing', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn(() => Promise.resolve())
    wrap(<SavedField label="Business name" value="" onCommit={onCommit} />)

    await user.type(screen.getByLabelText('Business name'), 'Sol')
    expect(mark()?.textContent ?? '').not.toContain('Saved')
  })

  /** A value that is already stored is not written again. */
  it('does not write when nothing changed', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn(() => Promise.resolve())
    wrap(<SavedField label="Business name" value="Sola" onCommit={onCommit} />)

    await user.click(screen.getByLabelText('Business name'))
    await user.tab()
    expect(onCommit).not.toHaveBeenCalled()
  })
})

describe('A failure says so, and keeps what was typed', () => {
  /**
   * THE SECOND HALF OF THE COMPLAINT. A failed write leaves the company
   * record unchanged, so a field fed straight from it silently replaces the
   * typing with the old value — losing the edit and the evidence together.
   */
  it('keeps the typed value when the write fails', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn(() => Promise.reject(new Error('offline')))
    wrap(<SavedField label="Business name" value="Old Name" onCommit={onCommit} />)

    const box = screen.getByLabelText('Business name')
    await user.clear(box)
    await user.type(box, 'Sola Ventures')
    await user.tab()

    await waitFor(() => expect(mark()).toHaveAttribute('data-save-state', 'failed'))
    expect(box, 'the typed value was thrown away').toHaveValue('Sola Ventures')
  })

  it('says it did not save', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn(() => Promise.reject(new Error('offline')))
    wrap(<SavedField label="Business name" value="" onCommit={onCommit} />)

    await user.type(screen.getByLabelText('Business name'), 'Sola')
    await user.tab()

    await waitFor(() => expect(mark()?.textContent).toContain('Not saved'))
    expect(screen.getByLabelText('Business name')).toHaveAttribute('aria-invalid', 'true')
  })

  /**
   * AND THE STORED VALUE DOES NOT WIN IT BACK. A re-render carrying the old
   * record — which is what a failed write leaves behind — must not overwrite
   * the box.
   */
  it('survives a re-render with the old stored value', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn(() => Promise.reject(new Error('offline')))
    const view = wrap(<SavedField label="Business name" value="Old Name" onCommit={onCommit} />)

    const box = screen.getByLabelText('Business name')
    await user.clear(box)
    await user.type(box, 'Sola Ventures')
    await user.tab()
    await waitFor(() => expect(mark()).toHaveAttribute('data-save-state', 'failed'))

    view.rerender(
      <CompanyProvider
        companyId="co_1"
        repositories={createMemoryRepositories(emptyState())}
        profile={{ locale: 'EN-NG' }}
        language="en"
      >
        <SavedField label="Business name" value="Old Name" onCommit={onCommit} />
      </CompanyProvider>,
    )
    expect(screen.getByLabelText('Business name')).toHaveValue('Sola Ventures')
  })
})

describe('The mark is announced, not only drawn (§V)', () => {
  it('carries a live region so it is heard as well as seen', async () => {
    const user = userEvent.setup()
    wrap(<SavedField label="Business name" value="" onCommit={() => Promise.resolve()} />)
    await user.type(screen.getByLabelText('Business name'), 'Sola')
    await user.tab()

    await waitFor(() => expect(mark()?.textContent).toContain('Saved'))
    expect(mark()).toHaveAttribute('role', 'status')
    expect(mark()).toHaveAttribute('aria-live', 'polite')
  })
})
