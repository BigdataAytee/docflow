/**
 * The share sheet (§B, §G, §M).
 *
 * The claim this screen must never make: that the document arrived.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../app/context'
import { createMemoryRepositories, emptyState } from '../data/repositories'
import { ShareSheet } from './ShareSheet'
import type { ShareCapability, SharePort, ShareResult } from './port'

const port = (
  capability: ShareCapability,
  result: ShareResult = { outcome: 'handed_off', channel: 'sheet' },
): SharePort => ({
  capability: () => capability,
  share: vi.fn(async () => result),
})

const EVERYTHING: ShareCapability = { sheet: true, files: true, clipboard: true }
const CLIPBOARD_ONLY: ShareCapability = { sheet: false, files: false, clipboard: true }
const NOTHING: ShareCapability = { sheet: false, files: false, clipboard: false }

function renderSheet(over: Partial<React.ComponentProps<typeof ShareSheet>> = {}) {
  const props: React.ComponentProps<typeof ShareSheet> = {
    port: port(EVERYTHING),
    text: { title: 'Invoice INV-0042', body: 'Invoice INV-0042\nFor Ade Stores\n— Sola Ventures' },
    onResult: vi.fn(),
    onClose: vi.fn(),
    ...over,
  }
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <ShareSheet {...props} />
    </CompanyProvider>,
  )
  return props
}

describe('Nothing sent unseen (§L1, applied here)', () => {
  it('shows the exact text before anything goes out', () => {
    renderSheet()
    expect(screen.getByText('What goes out')).toBeInTheDocument()
    expect(screen.getByText(/For Ade Stores/)).toBeInTheDocument()
  })

  it('says the PDF is not attached yet, rather than implying it is', () => {
    renderSheet()
    expect(screen.getByText(/The PDF attaches itself in the installed app/)).toBeInTheDocument()
  })

  it('drops that line once there is a file to attach', () => {
    renderSheet({ fileName: 'INV-0042.pdf' })
    expect(screen.queryByText(/attaches itself/)).not.toBeInTheDocument()
  })
})

describe('It offers only what the platform can do (§N)', () => {
  it('offers the sheet when there is one', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Send it' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy the text' })).not.toBeInTheDocument()
  })

  it('offers the clipboard when there is no sheet', () => {
    renderSheet({ port: port(CLIPBOARD_ONLY) })
    expect(screen.getByRole('button', { name: 'Copy the text' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send it' })).not.toBeInTheDocument()
  })

  it('offers no button at all when nothing is possible, and says why', () => {
    renderSheet({ port: port(NOTHING) })
    expect(screen.queryByRole('button', { name: 'Send it' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy the text' })).not.toBeInTheDocument()
    expect(screen.getByText(/cannot open a share sheet/)).toBeInTheDocument()
  })
})

describe('What it says afterwards (§M)', () => {
  it('says the document was handed over, and that arrival is unknowable', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.click(screen.getByRole('button', { name: 'Send it' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Handed to the app you picked.')
    expect(
      screen.getByText('DocFlow cannot tell whether it arrived — only that you sent it.'),
    ).toBeInTheDocument()
  })

  it('never says sent, delivered or received', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.click(screen.getByRole('button', { name: 'Send it' }))
    await screen.findByRole('status')

    const spoken = screen.getByRole('status').textContent?.toLowerCase() ?? ''
    for (const word of ['delivered', 'received', 'read it', 'arrived at']) {
      expect(spoken).not.toContain(word)
    }
  })

  it('says what happened when the sheet was dismissed', async () => {
    const user = userEvent.setup()
    renderSheet({ port: port(EVERYTHING, { outcome: 'dismissed', channel: 'sheet' }) })
    await user.click(screen.getByRole('button', { name: 'Send it' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Nothing was sent.')
  })

  it('says the copy landed, not that it was sent', async () => {
    const user = userEvent.setup()
    renderSheet({ port: port(EVERYTHING, { outcome: 'handed_off', channel: 'clipboard' }) })
    await user.click(screen.getByRole('button', { name: 'Send it' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Copied. Paste it wherever you like.',
    )
  })

  it('offers a way forward after a failure', async () => {
    const user = userEvent.setup()
    renderSheet({ port: port(EVERYTHING, { outcome: 'failed', channel: 'sheet', reason: 'nope' }) })
    await user.click(screen.getByRole('button', { name: 'Send it' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/copy the text/i)
  })

  it('hands the result up so it can be recorded', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.click(screen.getByRole('button', { name: 'Send it' }))
    expect(props.onResult).toHaveBeenCalledWith({ outcome: 'handed_off', channel: 'sheet' })
  })
})

describe('The history it shows (§M)', () => {
  it('counts handoffs without claiming any of them landed', () => {
    renderSheet({ sharedCount: 3, lastSharedAt: '2026-09-12' })
    expect(screen.getByText(/Sent 3 times/)).toBeInTheDocument()
    expect(screen.getByText(/Last sent 2026-09-12/)).toBeInTheDocument()
  })

  it('says nothing about history the first time', () => {
    renderSheet()
    expect(screen.queryByText(/times/)).not.toBeInTheDocument()
  })

  it('closes', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onClose).toHaveBeenCalledOnce()
  })
})
