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
import { stringsFor } from '../../domain/locale/data/strings'

const settings: CompanyLocaleSettings = { region: 'NG', language: 'en' }
const gbSettings: CompanyLocaleSettings = { region: 'GB', language: 'en' }

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
    wrap(<RegionSettings settings={settings} onRegion={vi.fn()}
        onLanguage={vi.fn()} />)
    expect(screen.getByText('NGN')).toBeInTheDocument()
    expect(screen.getByText('VAT')).toBeInTheDocument()
    expect(screen.getByText('Bank · Account number · Account name')).toBeInTheDocument()
  })

  it('shows the UK consequences when the country is the UK', () => {
    wrap(
      <RegionSettings settings={{ ...settings, region: 'GB' }} onRegion={vi.fn()}
        onLanguage={vi.fn()} />,
      { ...settings, region: 'GB' },
    )
    expect(screen.getByText('GBP')).toBeInTheDocument()
    expect(screen.getByText('Bank · Sort code · Account number · Account name')).toBeInTheDocument()
  })

  it('says the change applies offline and immediately (§D.6)', () => {
    wrap(<RegionSettings settings={settings} onRegion={vi.fn()}
        onLanguage={vi.fn()} />)
    expect(screen.getByText(/with or without internet/i)).toBeInTheDocument()
  })

  it('reports the chosen country back', async () => {
    const user = userEvent.setup()
    const onRegion = vi.fn()
    wrap(<RegionSettings settings={settings} onRegion={onRegion}
        onLanguage={vi.fn()} />)
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
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/waybill/i)
    ngList.unmount()

    const ngBuilder = wrap(
      <BuilderShell type="waybill" step={0} dirty={false} problems={[]} onStep={vi.fn()} onClose={vi.fn()} onSave={vi.fn()}>
        <p>body</p>
      </BuilderShell>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/waybill/i)
    ngBuilder.unmount()

    // The company moves to the UK. Every one of those surfaces follows.
    const gb = { ...settings, region: 'GB' }

    const gbHome = wrap(<Home {...homeProps} />, gb)
    expect(screen.getByRole('button', { name: /Delivery note/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Waybill/ })).not.toBeInTheDocument()
    gbHome.unmount()

    const gbList = wrap(<DocumentList type="waybill" rows={[]} onOpen={vi.fn()} onNew={vi.fn()} />, gb)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/delivery note/i)
    gbList.unmount()

    wrap(
      <BuilderShell type="waybill" step={0} dirty={false} problems={[]} onStep={vi.fn()} onClose={vi.fn()} onSave={vi.fn()}>
        <p>body</p>
      </BuilderShell>,
      gb,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/delivery note/i)
  })

  /**
   * The screen SAYS what it decided, and offers no way to change it (§N).
   *
   * There were four text boxes here — "Call this document" — for the owner to
   * type each name themselves. They are a read-only list now: the country
   * above decides the words, which it always did, and this is the panel that
   * makes that visible rather than something discovered on a finished PDF.
   */
  it('shows the four names it worked out, and no box to type one into', () => {
    const view = wrap(
      <RegionSettings settings={settings} onRegion={vi.fn()} onLanguage={vi.fn()} />,
      settings,
    )
    const panel = view.container.querySelector('[data-document-names]')
    expect(panel, 'the screen does not say what the documents are called').not.toBeNull()
    expect(panel?.textContent).toContain('Waybill')

    /*
     * THE POINT OF THE CHANGE. A text input here is the feature coming back.
     * Asserted on the panel rather than on the screen, because the country
     * and language controls above are legitimately interactive.
     */
    expect(panel?.querySelectorAll('input, textarea')).toHaveLength(0)
  })

  /** And it follows the country, which is what makes the boxes unnecessary. */
  it('says Delivery note once the country is the UK', () => {
    const view = wrap(
      <RegionSettings settings={gbSettings} onRegion={vi.fn()} onLanguage={vi.fn()} />,
      gbSettings,
    )
    const panel = view.container.querySelector('[data-document-names]')
    expect(panel?.textContent).toContain('Delivery note')
    expect(panel?.textContent).not.toContain('Waybill')
  })
})

describe('The app language is a choice, and only where it works (§S, §D.4)', () => {
  /**
   * The company's stored language drove the whole string catalogue from the
   * app root, and no screen could set it — four language slots in the design,
   * and the app fixed to one. §G puts the control on this screen.
   */
  it('reports the chosen language back', async () => {
    const onLanguage = vi.fn()
    wrap(
      <RegionSettings
        settings={settings}
        onRegion={vi.fn()}
        onLanguage={onLanguage}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(onLanguage).toHaveBeenCalledWith('en')
  })

  /**
   * §S: "no non-working language toggle ever ships." The list comes from the
   * catalogues, so a language cannot be offered before its strings exist —
   * which is what a hand-kept list beside them would eventually do.
   */
  it('offers only languages that have a complete catalogue', () => {
    wrap(
      <RegionSettings
        settings={settings}
        onRegion={vi.fn()}
        onLanguage={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    for (const absent of ['Français', 'Español', 'العربية']) {
      expect(screen.queryByText(absent)).not.toBeInTheDocument()
    }
    // And it says why there is one, rather than looking broken.
    expect(screen.getByText(/never ships a half-translated screen/i)).toBeInTheDocument()
  })
})

/**
 * The country list a person reads, in BOTH places that show one (§D).
 *
 * `NewBusinessScreen` and this screen each render their own country picker.
 * The first was fixed to show names and cover every country; this one was
 * missed and still rendered `NG`, `CI` — the app's internal identifier shown
 * to a person as though it were a country. That is what a second copy of a
 * list always costs, so the guard is on the rendered options rather than on
 * either component.
 */
describe('The country picker reads as countries, not as codes', () => {
  const renderRegion = () =>
    wrap(
      <RegionSettings
        settings={settings}
        onRegion={vi.fn()}
        onLanguage={vi.fn()}
      />,
    )

  const options = (): string[] =>
    Array.from(
      screen.getByLabelText(stringsFor('en').settings.businessCountry).querySelectorAll('option'),
    ).map((option) => option.textContent ?? '')

  it('shows full names, never two-letter codes', () => {
    renderRegion()
    const shown = options()
    expect(shown).toContain('Nigeria')
    expect(shown).toContain('Ghana')
    expect(shown).toContain('Côte d’Ivoire')
    // Not a single bare code left anywhere in the list.
    expect(shown.filter((label) => /^[A-Z]{2}$/.test(label))).toEqual([])
  })

  it('covers the world, not a launch shortlist', () => {
    renderRegion()
    const shown = options()
    expect(shown.length).toBeGreaterThan(200)
    for (const name of ['Kenya', 'Brazil', 'Japan', 'Philippines', 'Pakistan']) {
      expect(shown, `${name} is missing`).toContain(name)
    }
  })

  it('still selects by code underneath, so nothing stored changes', () => {
    renderRegion()
    const select = screen.getByLabelText(stringsFor('en').settings.businessCountry)
    const nigeria = Array.from(select.querySelectorAll('option')).find(
      (option) => option.textContent === 'Nigeria',
    )
    expect(nigeria?.getAttribute('value')).toBe('NG')
  })
})
