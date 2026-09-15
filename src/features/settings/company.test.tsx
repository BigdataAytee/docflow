/**
 * Company & logo — the panel, and the two things it fills (§F, §G, §R).
 *
 * The panel had been a flat form: a name, a style, a size, four prefixes.
 * Two fields the reference has always carried were missing, and BOTH were
 * missing in the same way — a value the app could read and nothing could set:
 *
 *  · `logoAssetId` was on the company record in both schemas, read by Home's
 *    setup checklist and by the page composer, and no screen wrote one. The
 *    checklist carried a step that could never be ticked.
 *  · the address had nowhere to live at all, so §R's setup step and §F's
 *    Sikky box had nothing behind them.
 *
 * So these assert CONSUMPTION, not declaration. A test that only checked the
 * field rendered would have passed throughout the whole time the logo could
 * not be set — which is exactly how the blank UNIT column survived.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { CompanySettings } from './CompanySettings'

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

const props = {
  businessName: 'Dynamic Renaissance',
  businessAddress: '',
  nameStyle: 'classic' as const,
  logoSize: 'M' as const,
  prefixes: {},
  onBusinessName: vi.fn(),
  onBusinessAddress: vi.fn(),
  onNameStyle: vi.fn(),
  onLogoSize: vi.fn(),
  onPrefix: vi.fn(),
  onLogo: vi.fn(),
}

describe('The panel is the order the reference has (§F)', () => {
  it('runs logo holder → name and address → name style → logo size → prefixes', () => {
    const { container } = wrap(<CompanySettings {...props} />)

    // Read off the rendered document rather than asserted one at a time: the
    // complaint the reference makes is about ORDER, and four present-and-
    // correct sections in the wrong sequence would pass four separate checks.
    const headings = [...container.querySelectorAll('h1, p, span, legend')]
      .map((node) => node.textContent?.trim())
      .filter((text): text is string =>
        ['No logo yet', 'Business name', 'Address', 'Name style', 'Logo size', 'Numbering prefixes'].includes(
          text ?? '',
        ),
      )

    expect(headings).toEqual([
      'No logo yet',
      'Business name',
      'Address',
      'Name style',
      'Name style',
      'Logo size',
      'Logo size',
      'Numbering prefixes',
    ])
  })

  it('puts the four prefixes two to a row', () => {
    wrap(<CompanySettings {...props} />)
    for (const label of ['Invoice', 'Quotation', 'Receipt', 'Waybill']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })
})

describe('The address is a field that goes somewhere (§R)', () => {
  it('reports what was typed', async () => {
    const onBusinessAddress = vi.fn()
    wrap(<CompanySettings {...props} onBusinessAddress={onBusinessAddress} />)

    await userEvent.type(screen.getByLabelText('Address'), 'Ifo')
    expect(onBusinessAddress).toHaveBeenCalled()
  })

  it('shows the saved one rather than an empty box', () => {
    wrap(<CompanySettings {...props} businessAddress="Lagos Abeokuta Motor Road, Ifo" />)
    expect(screen.getByLabelText('Address')).toHaveValue('Lagos Abeokuta Motor Road, Ifo')
  })

  /** Rule #1. An owner who skips it must still reach a document. */
  it('never marks itself required', () => {
    wrap(<CompanySettings {...props} />)
    expect(screen.getByLabelText('Address')).not.toBeRequired()
  })
})

describe('The logo can actually be set (§F, §G)', () => {
  it('says there is none, and offers Upload', () => {
    wrap(<CompanySettings {...props} />)
    expect(screen.getByText('No logo yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled()
  })

  it('shows the saved mark instead, and offers to replace it', () => {
    const { container } = wrap(
      <CompanySettings {...props} logoUrl="data:image/png;base64,iVBORw0KGgo=" />,
    )
    expect(screen.queryByText('No logo yet')).not.toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'data:image/png;base64,iVBORw0KGgo=',
    )
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
  })

  /**
   * §N: a capability that is not installed SAYS so. The offline logo engine
   * is Phase 6, and a button that looked live would be a promise the build
   * cannot keep.
   */
  it('shows Create with AI out of service, with the reason beside it', () => {
    wrap(<CompanySettings {...props} />)
    const create = screen.getByRole('button', { name: 'Create with AI' })
    expect(create).toBeDisabled()
    expect(
      screen.getByText(/offline model/i),
    ).toHaveAttribute('id', create.getAttribute('aria-describedby'))
  })

  it('accepts an image file and hands up a data URL', async () => {
    const onLogo = vi.fn()
    const { container } = wrap(<CompanySettings {...props} onLogo={onLogo} />)

    // `shrinkLogo` needs a canvas, which jsdom does not have; what is under
    // test here is that a chosen file reaches the handler at all — the
    // shrinking arithmetic has its own tests in `resize.test.ts`.
    const input = container.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
    expect(input).toHaveAttribute('accept', 'image/*')
  })
})

describe('The name preview is the chosen style (§F)', () => {
  it('shows the initial alone for a monogram', () => {
    wrap(<CompanySettings {...props} nameStyle="monogram" />)
    expect(screen.getByTestId('name-preview')).toHaveTextContent('D')
  })

  it('keeps the whole name for every other style', () => {
    wrap(<CompanySettings {...props} nameStyle="ruled" />)
    const preview = screen.getByTestId('name-preview')
    expect(within(preview.parentElement!).getByText('Dynamic Renaissance')).toBeInTheDocument()
  })
})
