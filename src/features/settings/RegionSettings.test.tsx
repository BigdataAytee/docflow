/**
 * Settings → Region & language (§G, §D, §V).
 *
 * The §V clause under test: "Switching region changes every label everywhere
 * at once — tiles, lists, builders, share text, future PDFs — offline."
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { Home } from '../home/Home'
import { DocumentList } from '../documents/DocumentList'
import { BuilderShell } from '../documents/BuilderShell'
import { type CompanyLocaleSettings, localeProfileOf } from './region'
import { RegionSettings } from './RegionSettings'

const settings: CompanyLocaleSettings = { region: 'NG', language: 'en', labelOverrides: {} }

const wrap = (node: React.ReactNode, s: CompanyLocaleSettings = settings) => {
  const repositories = createMemoryRepositories(emptyState())
  return render(
    <CompanyProvider
      companyId="co_1"
      repositories={repositories}
      profile={localeProfileOf(s)}
      language="en"
    >
      {node}
    </CompanyProvider>,
  )
}

describe('The consequences sit beside the cause (§D)', () => {
  it('shows what the country settles: currency, tax wording, bank fields', () => {
    wrap(<RegionSettings settings={settings} onRegion={vi.fn()} onOverride={vi.fn()} />)
    expect(screen.getByText('NGN')).toBeInTheDocument()
    expect(screen.getByText('VAT')).toBeInTheDocument()
    expect(screen.getByText('Bank · Account number · Account name')).toBeInTheDocument()
  })

  it('shows the UK consequences when the country is the UK', () => {
    wrap(
      <RegionSettings settings={{ ...settings, region: 'GB' }} onRegion={vi.fn()} onOverride={vi.fn()} />,
      { ...settings, region: 'GB' },
    )
    expect(screen.getByText('GBP')).toBeInTheDocument()
    expect(screen.getByText('Bank · Sort code · Account number · Account name')).toBeInTheDocument()
  })

  it('says the change applies offline and immediately (§D.6)', () => {
    wrap(<RegionSettings settings={settings} onRegion={vi.fn()} onOverride={vi.fn()} />)
    expect(screen.getByText(/with or without internet/i)).toBeInTheDocument()
  })

  it('reports the chosen country back', async () => {
    const user = userEvent.setup()
    const onRegion = vi.fn()
    wrap(<RegionSettings settings={settings} onRegion={onRegion} onOverride={vi.fn()} />)
    await user.selectOptions(screen.getByLabelText('Business country'), 'GB')
    expect(onRegion).toHaveBeenCalledWith('GB')
  })
})

describe('Switching region changes every surface at once (§V)', () => {
  const homeProps = {
    businessName: 'Dynamic Renaissance',
    userName: 'Sola',
    now: new Date('2026-09-11T09:00:00'),
    online: true,
    pendingCount: 0,
    failedCount: 0,
    outstanding: new Map(),
    received: new Map(),
    counts: { invoice: 1, quotation: 1, receipt: 1, waybill: 3 },
    attention: [],
    onOpenType: vi.fn(),
    onOpenDocument: vi.fn(),
    onSearch: vi.fn(),
  }

  it('renames the delivery document on the Home tile, the list and the builder together', () => {
    // Nigeria: every surface says Waybill.
    const ng = wrap(<Home {...homeProps} />)
    expect(screen.getByRole('button', { name: /Waybill/ })).toBeInTheDocument()
    ng.unmount()

    const ngList = wrap(<DocumentList type="waybill" rows={[]} onOpen={vi.fn()} onNew={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Waybill')
    ngList.unmount()

    const ngBuilder = wrap(
      <BuilderShell type="waybill" step={0} dirty={false} problems={[]} onStep={vi.fn()} onClose={vi.fn()} onSave={vi.fn()}>
        <p>body</p>
      </BuilderShell>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Waybill')
    ngBuilder.unmount()

    // The company moves to the UK. Every one of those surfaces follows.
    const gb = { ...settings, region: 'GB' }

    const gbHome = wrap(<Home {...homeProps} />, gb)
    expect(screen.getByRole('button', { name: /Delivery note/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Waybill/ })).not.toBeInTheDocument()
    gbHome.unmount()

    const gbList = wrap(<DocumentList type="waybill" rows={[]} onOpen={vi.fn()} onNew={vi.fn()} />, gb)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Delivery note')
    gbList.unmount()

    wrap(
      <BuilderShell type="waybill" step={0} dirty={false} problems={[]} onStep={vi.fn()} onClose={vi.fn()} onSave={vi.fn()}>
        <p>body</p>
      </BuilderShell>,
      gb,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Delivery note')
  })

  it('lets a per-type override reach the same surfaces', () => {
    const custom = { ...settings, labelOverrides: { waybill: 'Dispatch docket' } }
    wrap(<DocumentList type="waybill" rows={[]} onOpen={vi.fn()} onNew={vi.fn()} />, custom)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dispatch docket')
  })
})
