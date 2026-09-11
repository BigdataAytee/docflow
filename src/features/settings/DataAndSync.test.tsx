/**
 * Settings → Data & sync (§G, §L7, §Q Phase 2.5).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { DataAndSync } from './DataAndSync'

function renderPanel(over: Partial<React.ComponentProps<typeof DataAndSync>> = {}) {
  const props: React.ComponentProps<typeof DataAndSync> = {
    pendingCount: 0,
    failedCount: 0,
    ...over,
  }
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <DataAndSync {...props} />
    </CompanyProvider>,
  )
  return props
}

describe('Upload state, in words a person uses (§M)', () => {
  it('says uploaded only when nothing is pending', () => {
    renderPanel()
    expect(screen.getByText('Uploaded')).toBeInTheDocument()
  })

  it('says waiting while work is queued', () => {
    renderPanel({ pendingCount: 3 })
    expect(screen.getByText('Waiting to upload')).toBeInTheDocument()
  })

  it('says needs review when something failed', () => {
    renderPanel({ pendingCount: 3, failedCount: 1 })
    expect(screen.getByText('Needs review')).toBeInTheDocument()
  })
})

describe('Export is never hostage (Rule #6)', () => {
  it('offers export and says it is never locked', async () => {
    const user = userEvent.setup()
    const props = renderPanel({ onExport: vi.fn() })
    await user.click(screen.getByRole('button', { name: 'Export all my data' }))
    expect(props.onExport).toHaveBeenCalledOnce()
    expect(
      screen.getByText('Your documents and export are never locked, on any plan.'),
    ).toBeInTheDocument()
  })
})

describe('The sync-conflict demo (§L7)', () => {
  it('is closed until asked for', () => {
    renderPanel()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('says it is an example while it is open', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Show me' }))
    expect(screen.getByText('This is an example, not your data.')).toBeInTheDocument()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('never uses database words inside the notice itself (§L7)', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Show me' }))
    // Scoped to the notice on purpose: §G names the settings row "Data & sync",
    // so the word belongs there. §L7 is about the sentence shown to someone
    // whose work just collided with a colleague's.
    const notice = screen.getByRole('alertdialog').textContent ?? ''
    // "both versions are saved" is §L7's own wording, so "version" is not on
    // this list — the banned words are the machinery ones.
    for (const word of ['merge', 'revision', 'sync', 'record', 'conflict']) {
      expect(notice.toLowerCase()).not.toContain(word)
    }
  })

  it('choosing in the demo reassures rather than writing anything', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Show me' }))
    await user.click(screen.getByRole('button', { name: 'Use mine' }))
    expect(screen.getByRole('status')).toHaveTextContent('Both versions are saved')
  })
})
