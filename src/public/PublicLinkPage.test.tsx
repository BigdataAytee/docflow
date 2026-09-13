/**
 * The pages a customer opens (§G, §P, §Q, §T).
 */

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { PublicLinkPage } from './PublicLinkPage'
import type { LinkTransport, PublicView } from './client'

const QUOTE: PublicView = {
  kind: 'accept',
  reference: 'QUO-0009',
  title: 'QUOTATION',
  partyLabel: 'Client',
  language: 'en',
  businessName: 'Sola Ventures',
  customerName: 'Ade Stores',
  issueDate: '2026-09-01',
  validUntil: '2026-09-30',
  deliveryAddress: null,
  lines: [{ description: 'Bag of cement', quantityMilli: 20_000, unitPriceMinor: 5_000_00 }],
  total: { currency: 'NGN', minor: 100_000_00 },
}

const DELIVERY: PublicView = {
  ...QUOTE,
  kind: 'sign',
  reference: 'WAY-0007',
  title: 'WAYBILL',
  partyLabel: 'Deliver to',
  deliveryAddress: '14 Adeola Odeku, Victoria Island',
  lines: [{ description: '40 bags of cement', quantityMilli: 40_000 }],
  validUntil: null,
}
delete (DELIVERY as { total?: unknown }).total

function renderPage(
  kind: 'accept' | 'sign',
  transport: Partial<LinkTransport>,
  token = 'GOODTOKEN',
) {
  const port: LinkTransport = {
    open: async () => ({ ok: false, reason: 'wrong' }),
    submit: async () => ({ ok: false, reason: 'wrong' }),
    ...transport,
  }
  render(
    <MemoryRouter initialEntries={[`/${kind}/${token}`]}>
      <Routes>
        <Route path={`/${kind}/:token`} element={<PublicLinkPage kind={kind} transport={port} />} />
      </Routes>
    </MemoryRouter>,
  )
  return port
}

/** The sign page needs a name before the pad appears, then a real mark. */
const signAs = async (name: string) => {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Your name'), name)
  const pad = await screen.findByRole('application', { name: 'Signing area' })
  fireEvent.pointerDown(pad, { pointerId: 1, clientX: 20, clientY: 40 })
  for (const [x, y] of [
    [40, 20],
    [60, 45],
    [80, 25],
    [100, 40],
  ]) {
    fireEvent.pointerMove(pad, { pointerId: 1, clientX: x, clientY: y })
  }
  fireEvent.pointerUp(pad, { pointerId: 1 })
  await user.click(screen.getByRole('button', { name: 'Use this' }))
}

describe('A refused link shows a message and never data (§P)', () => {
  const reasons = [
    ['wrong', /does not work/],
    ['expired', /has expired/],
    ['used', /already been used/],
    ['not_answerable', /already been dealt with/],
    ['rate_limited', /Too many tries/],
  ] as const

  for (const [reason, words] of reasons) {
    it(`says something useful for "${reason}"`, async () => {
      renderPage('accept', { open: async () => ({ ok: false, reason }) })
      expect(await screen.findByText(words)).toBeInTheDocument()
    })
  }

  it('shows no reference, no customer and no amount', async () => {
    renderPage('accept', { open: async () => ({ ok: false, reason: 'wrong' }) })
    await screen.findByText(/does not work/)
    expect(screen.queryByText('QUO-0009')).not.toBeInTheDocument()
    expect(screen.queryByText('Ade Stores')).not.toBeInTheDocument()
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument()
  })

  it('refuses a sign token replayed at the accept page (§P)', async () => {
    // One token, one thing it may do. The link carries its kind; a page that
    // answered the wrong one would let a delivery link accept an offer.
    renderPage('accept', { open: async () => ({ ok: true, view: DELIVERY }) })
    expect(await screen.findByText(/does not work/)).toBeInTheDocument()
    expect(screen.queryByText('WAY-0007')).not.toBeInTheDocument()
  })
})

describe('§T: a customer document never enters a search index', () => {
  it('marks the page noindex while it is open', async () => {
    renderPage('accept', { open: async () => ({ ok: true, view: QUOTE }) })
    await screen.findByText('QUO-0009')
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    )
  })
})

describe('Accepting a quotation (§G, §Q)', () => {
  it('shows the offer in the document own language, not the device one', async () => {
    renderPage('accept', { open: async () => ({ ok: true, view: QUOTE }) })
    expect(await screen.findByText('QUOTATION')).toBeInTheDocument()
    expect(screen.getByText('QUO-0009')).toBeInTheDocument()
    expect(screen.getByText('Ade Stores')).toBeInTheDocument()
    expect(screen.getByText('Bag of cement')).toBeInTheDocument()
    expect(screen.getByText('₦100,000.00')).toBeInTheDocument()
    // §P: rendered in the frozen language.
    expect(document.querySelector('main')?.getAttribute('lang')).toBe('en')
  })

  it('accepts, and says who was told', async () => {
    const user = userEvent.setup()
    const submit: LinkTransport['submit'] = vi.fn(async () => ({ ok: true as const, done: 'accepted' }))
    renderPage('accept', { open: async () => ({ ok: true, view: QUOTE }), submit })

    await user.click(await screen.findByRole('button', { name: 'Accept' }))
    expect(submit).toHaveBeenCalledWith('GOODTOKEN', { answer: 'accepted' })
    expect(await screen.findByText(/Sola Ventures has been told you accepted/)).toBeInTheDocument()
  })

  it('turns it down', async () => {
    const user = userEvent.setup()
    const submit: LinkTransport['submit'] = vi.fn(async () => ({ ok: true as const, done: 'rejected' }))
    renderPage('accept', { open: async () => ({ ok: true, view: QUOTE }), submit })

    await user.click(await screen.findByRole('button', { name: 'Turn it down' }))
    expect(submit).toHaveBeenCalledWith('GOODTOKEN', { answer: 'rejected' })
    expect(await screen.findByText(/has been told/)).toBeInTheDocument()
  })

  it('takes a signature, which §Q makes optional', async () => {
    const user = userEvent.setup()
    const submit: LinkTransport['submit'] = vi.fn(async () => ({ ok: true as const, done: 'accepted' }))
    renderPage('accept', { open: async () => ({ ok: true, view: QUOTE }), submit })

    // Accepting without one works, which is the point of "optional".
    expect(await screen.findByRole('button', { name: 'Accept' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add your signature (optional)' }))
    const pad = await screen.findByRole('application', { name: 'Signing area' })
    fireEvent.pointerDown(pad, { pointerId: 1, clientX: 20, clientY: 40 })
    for (const [x, y] of [
      [40, 20],
      [60, 45],
      [80, 25],
      [100, 40],
    ]) {
      fireEvent.pointerMove(pad, { pointerId: 1, clientX: x, clientY: y })
    }
    fireEvent.pointerUp(pad, { pointerId: 1 })
    await user.click(screen.getByRole('button', { name: 'Use this' }))

    await waitFor(() => expect(submit).toHaveBeenCalled())
    const body = vi.mocked(submit).mock.calls[0]?.[1] as { signatureDataUrl?: string }
    expect(body.signatureDataUrl?.startsWith('data:image/svg+xml,')).toBe(true)
  })
})

describe('Signing for a delivery (§G, §P, §V)', () => {
  it('shows the delivery with no money anywhere', async () => {
    renderPage('sign', { open: async () => ({ ok: true, view: DELIVERY }) })
    expect(await screen.findByText('WAY-0007')).toBeInTheDocument()
    expect(screen.getByText('40 bags of cement')).toBeInTheDocument()
    expect(screen.getByText('14 Adeola Odeku, Victoria Island')).toBeInTheDocument()
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument()
  })

  it('asks who is signing before it takes a mark', async () => {
    renderPage('sign', { open: async () => ({ ok: true, view: DELIVERY }) })
    await screen.findByText('WAY-0007')
    // A mark already drawn must never be thrown away for a rule nobody was
    // told about — the same reason the owner's own sheet waits for a name.
    expect(screen.queryByRole('application', { name: 'Signing area' })).not.toBeInTheDocument()
  })

  it('sends the name, the role and the mark together', async () => {
    const user = userEvent.setup()
    const submit: LinkTransport['submit'] = vi.fn(async () => ({ ok: true as const, done: 'delivered' }))
    renderPage('sign', { open: async () => ({ ok: true, view: DELIVERY }), submit })

    await screen.findByText('WAY-0007')
    await user.type(screen.getByLabelText('Your role (optional)'), 'Storekeeper')
    await signAs('Bisi Adeyemi')

    await waitFor(() => expect(submit).toHaveBeenCalled())
    const body = vi.mocked(submit).mock.calls[0]?.[1] as Record<string, string>
    expect(body['signerName']).toBe('Bisi Adeyemi')
    expect(body['signerRole']).toBe('Storekeeper')
    expect(body['signatureDataUrl']?.startsWith('data:image/svg+xml,')).toBe(true)
    expect(await screen.findByText(/Sola Ventures has been told this arrived/)).toBeInTheDocument()
  })
})

describe('A link can die while the page is open (§P)', () => {
  it('says so when the answer comes back used', async () => {
    const user = userEvent.setup()
    renderPage('accept', {
      open: async () => ({ ok: true, view: QUOTE }),
      // The driver signed on their own phone while this sat open — the exact
      // race §P's second check exists for.
      submit: async () => ({ ok: false, reason: 'used' }),
    })

    await user.click(await screen.findByRole('button', { name: 'Accept' }))
    expect(await screen.findByText(/already been used/)).toBeInTheDocument()
    // And the offer is gone from the screen with it.
    expect(screen.queryByText('QUO-0009')).not.toBeInTheDocument()
  })

  it('lets a failed send be tried again, rather than losing the answer', async () => {
    const user = userEvent.setup()
    renderPage('accept', {
      open: async () => ({ ok: true, view: QUOTE }),
      submit: async () => ({ ok: false, reason: 'wrong' }),
    })

    await user.click(await screen.findByRole('button', { name: 'Accept' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/did not go through/)
    // Still answerable: a bad connection is not a dead link.
    expect(screen.getByRole('button', { name: 'Accept' })).toBeEnabled()
  })
})
