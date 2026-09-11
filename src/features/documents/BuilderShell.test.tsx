/**
 * The builder shell and the review band (§G).
 *
 * The clause under test: the header, step names and save button all speak the
 * active terminology, the review band links each missing item back to its
 * step, and nothing typed is discarded on the way.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import type { LocaleProfile } from '../../domain/locale/profile'
import type { DocumentType } from '../../domain/documents/types'
import { BuilderShell } from './BuilderShell'
import { ReviewBand } from './ReviewBand'
import type { IssueProblem, StepIndex } from './builder'

function shell(options: {
  type: DocumentType
  step?: StepIndex
  profile?: LocaleProfile
  dirty?: boolean
  lastSavedAt?: string
  problems?: IssueProblem[]
  onStep?: (step: number) => void
  onSave?: () => void
}) {
  const repositories = createMemoryRepositories(emptyState())
  return render(
    <CompanyProvider
      companyId="co_1"
      repositories={repositories}
      profile={options.profile ?? { locale: 'EN-NG' }}
      language="en"
    >
      <BuilderShell
        type={options.type}
        step={options.step ?? 0}
        dirty={options.dirty ?? false}
        lastSavedAt={options.lastSavedAt}
        problems={options.problems ?? []}
        onStep={options.onStep ?? (() => {})}
        onClose={() => {}}
        onSave={options.onSave ?? (() => {})}
      >
        <p>body</p>
      </BuilderShell>
    </CompanyProvider>,
  )
}

describe('Every word follows the terminology layer (Rule #5)', () => {
  it('titles a delivery document by its regional name', () => {
    shell({ type: 'waybill', profile: { locale: 'EN-NG' } })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Waybill')
  })

  it('shows the same document as "Delivery note" in EN-GB', () => {
    shell({ type: 'waybill', profile: { locale: 'EN-GB' } })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Delivery note')
  })

  it('names the steps per type', () => {
    shell({ type: 'waybill' })
    expect(screen.getByRole('button', { name: 'Deliver to' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Goods' })).toBeInTheDocument()
  })

  it('puts the label inside the save button on the last step (§G)', () => {
    shell({ type: 'waybill', step: 4, profile: { locale: 'EN-GB' } })
    expect(screen.getByRole('button', { name: 'Save Delivery note' })).toBeInTheDocument()
  })

  it('shows Next on every earlier step', () => {
    shell({ type: 'invoice', step: 2 })
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
  })
})

describe('The saved state is never claimed early (§C)', () => {
  it('says the draft saves automatically while edits are pending', () => {
    shell({ type: 'invoice', dirty: true })
    expect(screen.getByText(/draft saved automatically/i)).toBeInTheDocument()
    expect(screen.queryByText(/^Saved$/)).not.toBeInTheDocument()
  })

  it('says Saved only once a commit landed', () => {
    shell({ type: 'invoice', dirty: false, lastSavedAt: '2026-09-11T12:00:00Z' })
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('does not say Saved before any commit, even when clean', () => {
    shell({ type: 'invoice', dirty: false })
    expect(screen.getByText(/draft saved automatically/i)).toBeInTheDocument()
  })
})

describe('Navigation', () => {
  it('disables Back on the first step', () => {
    shell({ type: 'invoice', step: 0 })
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
  })

  it('lets any step be reached from the step bar — steps are never gates', async () => {
    const onStep = vi.fn()
    const user = userEvent.setup()
    shell({ type: 'invoice', step: 0, onStep })
    await user.click(screen.getByRole('button', { name: 'Review' }))
    expect(onStep).toHaveBeenCalledWith(4)
  })

  it('calls save, not next, on the last step', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    shell({ type: 'invoice', step: 4, onSave })
    await user.click(screen.getByRole('button', { name: /^Save / }))
    expect(onSave).toHaveBeenCalledOnce()
  })
})

describe('The review band links each problem to its step (§G step 5)', () => {
  const band = (problems: IssueProblem[], onGoToStep = vi.fn()) => {
    const repositories = createMemoryRepositories(emptyState())
    render(
      <CompanyProvider companyId="co_1" repositories={repositories} profile={{ locale: 'EN-NG' }}>
        <ReviewBand problems={problems} onGoToStep={onGoToStep} />
      </CompanyProvider>,
    )
    return onGoToStep
  }

  it('renders nothing when the draft is ready', () => {
    band([])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('resolves each token into a sentence in the active language', () => {
    band([
      { step: 0, field: 'party' },
      { step: 2, field: 'payment_method' },
    ])
    expect(screen.getByText('Choose who this is for.')).toBeInTheDocument()
    expect(screen.getByText('Set up how you get paid.')).toBeInTheDocument()
  })

  it('sends the user back to the step the problem belongs to', async () => {
    const user = userEvent.setup()
    const onGoToStep = band([{ step: 2, field: 'payment_method' }])
    await user.click(screen.getByRole('button', { name: /fix this/i }))
    expect(onGoToStep).toHaveBeenCalledWith(2)
  })

  it('shows an unmapped token rather than an empty bullet', () => {
    // A silent gap would hide a genuinely missing field from the user.
    band([{ step: 1, field: 'something_unmapped' }])
    expect(screen.getByText('something_unmapped')).toBeInTheDocument()
  })
})
