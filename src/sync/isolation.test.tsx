/**
 * Account isolation on the device, and the conflict chooser (§M, §L7).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../app/context'
import { createMemoryRepositories, emptyState } from '../data/repositories'
import { ConflictChooser } from './ConflictChooser'
import type { Resolution } from './conflicts'
import {
  IsolationError,
  assertOperationBelongs,
  deviceMaySync,
  lockOnLogout,
  openStore,
} from './isolation'

const wrap = (node: React.ReactNode) => {
  const repositories = createMemoryRepositories(emptyState())
  return render(
    <CompanyProvider companyId="co_1" repositories={repositories} profile={{ locale: 'EN-NG' }} language="en">
      {node}
    </CompanyProvider>,
  )
}

const conflict: Extract<Resolution, { kind: 'conflict' }> = {
  kind: 'conflict',
  fields: ['note'],
  mine: { note: 'Pays on Fridays' },
  theirs: { note: 'Pays monthly' },
}

describe('The chooser speaks plainly (§L7)', () => {
  it('names the person and offers the three actions', () => {
    wrap(<ConflictChooser resolution={conflict} otherPersonName="Sola" onChoose={vi.fn()} />)
    expect(screen.getByText('Sola changed this too')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'See both' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use mine' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use theirs' })).toBeInTheDocument()
  })

  it('says both versions are saved, so the choice is not a risk', () => {
    wrap(<ConflictChooser resolution={conflict} otherPersonName="Sola" onChoose={vi.fn()} />)
    expect(screen.getByText(/both versions are saved/i)).toBeInTheDocument()
  })

  it('uses no database words anywhere on screen (§M)', () => {
    const { container } = wrap(
      <ConflictChooser resolution={conflict} otherPersonName="Sola" onChoose={vi.fn()} />,
    )
    const text = container.textContent ?? ''
    for (const jargon of ['merge', 'revision', 'version conflict', 'sync', 'record']) {
      expect(text.toLowerCase()).not.toContain(jargon)
    }
  })

  it('shows both values on request', async () => {
    const user = userEvent.setup()
    wrap(<ConflictChooser resolution={conflict} otherPersonName="Sola" onChoose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'See both' }))
    expect(screen.getByText(/Pays on Fridays/)).toBeInTheDocument()
    expect(screen.getByText(/Pays monthly/)).toBeInTheDocument()
  })

  it('reports the choice', async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()
    wrap(<ConflictChooser resolution={conflict} otherPersonName="Sola" onChoose={onChoose} />)
    await user.click(screen.getByRole('button', { name: 'Use theirs' }))
    expect(onChoose).toHaveBeenCalledWith('theirs')
  })
})

describe('One phone never exposes one account to another (§M, §Q gate)', () => {
  const handle = { accountId: 'acct-a', companyId: 'co-a', locked: true }

  it('opens for the account that owns the store', () => {
    expect(openStore(handle, 'acct-a').locked).toBe(false)
  })

  it('refuses to open for a different account', () => {
    expect(() => openStore(handle, 'acct-b')).toThrow(IsolationError)
  })

  it('locks rather than deletes on logout (§M)', () => {
    const after = lockOnLogout({ ...handle, locked: false })
    expect(after.locked).toBe(true)
    // The data is still there — deleting it is a separate, deliberate action.
    expect(after.accountId).toBe('acct-a')
    expect(after.companyId).toBe('co-a')
  })

  it('will not upload one account’s change from another’s session', () => {
    expect(() => assertOperationBelongs('co-a', 'co-a')).not.toThrow()
    expect(() => assertOperationBelongs('co-a', 'co-b')).toThrow(IsolationError)
  })

  it('stops a revoked device syncing at its next connection (§M)', () => {
    const revoked = new Set(['device-lost'])
    expect(deviceMaySync(revoked, 'device-lost')).toBe(false)
    expect(deviceMaySync(revoked, 'device-mine')).toBe(true)
  })
})
