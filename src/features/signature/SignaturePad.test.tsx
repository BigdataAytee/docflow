/**
 * The signing surface (§G, §P).
 */

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { SignaturePad } from './SignaturePad'

function renderPad(over: Partial<React.ComponentProps<typeof SignaturePad>> = {}) {
  const props: React.ComponentProps<typeof SignaturePad> = {
    onUse: vi.fn(),
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
      <SignaturePad {...props} />
    </CompanyProvider>,
  )
  return props
}

/**
 * jsdom lays nothing out, so `getBoundingClientRect` is all zeros and the pad
 * falls back to raw client coordinates — which is exactly what this drives.
 */
const sign = (pad: HTMLElement, points: readonly [number, number][]) => {
  const [first, ...rest] = points
  if (first === undefined) return
  fireEvent.pointerDown(pad, { pointerId: 1, clientX: first[0], clientY: first[1] })
  for (const [x, y] of rest) {
    fireEvent.pointerMove(pad, { pointerId: 1, clientX: x, clientY: y })
  }
  fireEvent.pointerUp(pad, { pointerId: 1 })
}

const A_SIGNATURE: readonly [number, number][] = [
  [20, 40],
  [40, 20],
  [60, 45],
  [80, 25],
  [100, 40],
]

describe('A document is never marked signed with nothing on it (§P)', () => {
  it('will not accept an untouched pad', () => {
    renderPad()
    expect(screen.getByRole('button', { name: 'Use this' })).toBeDisabled()
  })

  it('will not accept a tap', () => {
    renderPad()
    const pad = screen.getByRole('application', { name: 'Signing area' })
    fireEvent.pointerDown(pad, { pointerId: 1, clientX: 40, clientY: 40 })
    fireEvent.pointerUp(pad, { pointerId: 1 })
    expect(screen.getByRole('button', { name: 'Use this' })).toBeDisabled()
  })

  it('accepts a mark somebody meant to make', () => {
    renderPad()
    sign(screen.getByRole('application', { name: 'Signing area' }), A_SIGNATURE)
    expect(screen.getByRole('button', { name: 'Use this' })).toBeEnabled()
  })

  it('says where it stands, rather than leaving the box silent', () => {
    renderPad()
    expect(screen.getByText('Sign above the line')).toBeInTheDocument()
    sign(screen.getByRole('application', { name: 'Signing area' }), A_SIGNATURE)
    expect(screen.getByText('Signed')).toBeInTheDocument()
  })
})

describe('Nothing is saved until the owner says so (§C)', () => {
  it('hands over the rendered signature only on "Use this"', async () => {
    const user = userEvent.setup()
    const props = renderPad()
    sign(screen.getByRole('application', { name: 'Signing area' }), A_SIGNATURE)
    expect(props.onUse).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Use this' }))
    expect(props.onUse).toHaveBeenCalledTimes(1)
    const handed = vi.mocked(props.onUse).mock.calls[0]?.[0]
    expect(handed?.dataUrl.startsWith('data:image/svg+xml,')).toBe(true)
    expect(handed?.svg).toContain('<path')
  })

  it('hands over nothing when the pad is closed', async () => {
    const user = userEvent.setup()
    const props = renderPad()
    sign(screen.getByRole('application', { name: 'Signing area' }), A_SIGNATURE)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onUse).not.toHaveBeenCalled()
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Getting it wrong costs one tap (Rule #1)', () => {
  it('undoes the last mark and leaves the earlier one', async () => {
    const user = userEvent.setup()
    renderPad()
    const pad = screen.getByRole('application', { name: 'Signing area' })
    sign(pad, A_SIGNATURE)
    sign(pad, [
      [200, 20],
      [260, 80],
    ])

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    // The first mark survives, so the pad is still signable.
    expect(screen.getByRole('button', { name: 'Use this' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('button', { name: 'Use this' })).toBeDisabled()
  })

  it('starts again in one tap', async () => {
    const user = userEvent.setup()
    renderPad()
    sign(screen.getByRole('application', { name: 'Signing area' }), A_SIGNATURE)
    await user.click(screen.getByRole('button', { name: 'Start again' }))
    expect(screen.getByRole('button', { name: 'Use this' })).toBeDisabled()
  })

  it('offers nothing to undo on an untouched pad', () => {
    renderPad()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Start again' })).toBeDisabled()
  })
})

describe('A signature is drawn once (§G)', () => {
  it('offers the saved one when there is one', async () => {
    const user = userEvent.setup()
    const onUseDefault = vi.fn()
    renderPad({ onUseDefault })
    await user.click(screen.getByRole('button', { name: 'Use my saved signature' }))
    expect(onUseDefault).toHaveBeenCalledTimes(1)
  })

  it('offers nothing to reuse when none is saved', () => {
    renderPad()
    expect(screen.queryByRole('button', { name: 'Use my saved signature' })).not.toBeInTheDocument()
  })
})

describe('A failure is said, not swallowed', () => {
  it('announces the reason it could not be saved', () => {
    renderPad({ error: 'That could not be saved: no space left' })
    expect(screen.getByRole('alert')).toHaveTextContent('no space left')
  })
})
