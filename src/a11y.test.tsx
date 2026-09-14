/**
 * §L9 accessibility, and §F's label-length resilience.
 *
 * "A large-text preview toggle proving layouts reflow rather than clip —
 * tested with the longest shipped labels."
 *
 * The longest labels in the shipped tables are the French and Spanish delivery
 * documents, which §F names explicitly: "Bon de livraison", "Guía de remisión".
 *
 * Two stress cases, not one, because two different words reach the screen.
 * The builder header and the new-document button carry the SINGULAR label;
 * the list hero and Home's tiles carry the PLURAL, which is longer by exactly
 * the letter that makes it the worse case. Testing the hero against the
 * singular would have been a stress test that never stressed anything.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CompanyProvider } from './app/context'
import { createMemoryRepositories, emptyState } from './data/repositories'
import { DOCUMENT_TYPES } from './domain/documents/types'
import { LAUNCH_LOCALES, TERMINOLOGY_TABLES } from './domain/locale/data/terminology'
import { DocumentList } from './features/documents/DocumentList'
import { BuilderShell } from './features/documents/BuilderShell'

const wrap = (node: React.ReactNode, locale: string) => {
  const repositories = createMemoryRepositories(emptyState())
  return render(
    <CompanyProvider
      companyId="co_1"
      repositories={repositories}
      profile={{ locale }}
      language="en"
    >
      {node}
    </CompanyProvider>,
  )
}

/** The longest label across every shipped table, per §F's instruction to test it. */
const longestOf = (
  pick: (entry: { label: string; labelInSentence: string; pluralLabel: string }) => string,
): { locale: string; label: string } => {
  let winner = { locale: 'EN-NG', label: '' }
  for (const locale of LAUNCH_LOCALES) {
    const table = TERMINOLOGY_TABLES[locale]
    if (table === undefined) continue
    for (const type of DOCUMENT_TYPES) {
      const label = pick(table.types[type])
      if (label.length > winner.label.length) winner = { locale, label }
    }
  }
  return winner
}

const longestLabel = () => longestOf((entry) => entry.label)
const longestPlural = () => longestOf((entry) => entry.pluralLabel)
/** The singular inside a sentence — "New bon de livraison", "+ New …". */
const longestInSentence = () => longestOf((entry) => entry.labelInSentence)

describe('The longest shipped label wraps rather than clipping (§F)', () => {
  it('is one of the labels §F names as the stress case', () => {
    const { label } = longestLabel()
    expect(['Bon de livraison', 'Guía de remisión', 'Nota de entrega']).toContain(label)
  })

  it('is stressed by the plural too, which is the longer word', () => {
    expect(longestPlural().label.length).toBeGreaterThanOrEqual(longestLabel().label.length)
  })

  it('renders in full in the list hero, not truncated', () => {
    // The hero says the PLURAL — "4 delivery notes" lives under a heading
    // that reads "Delivery notes" — so that is the word to stress it with.
    const { locale, label } = longestPlural()
    wrap(<DocumentList type="waybill" rows={[]} onOpen={vi.fn()} onNew={vi.fn()} />, locale)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(label)

    // The wrap rule sits on the label itself rather than the heading, which
    // also holds the icon. `overflow-wrap: anywhere` rather than
    // `break-words`: only the former reduces the element's min-content width,
    // and that width is what held the container open at 200% text.
    const rendered = screen.getByText(label)
    expect(rendered.className).toContain('[overflow-wrap:anywhere]')
    // Truncation anywhere in the heading would hide the end of the word.
    expect(heading.innerHTML).not.toContain('truncate')
  })

  it('renders in full in the builder header', () => {
    // The header says "New {label}", which puts the word in a sentence.
    const { locale, label } = longestInSentence()
    wrap(
      <BuilderShell type="waybill" step={0} dirty={false} problems={[]} onStep={vi.fn()} onClose={vi.fn()} onSave={vi.fn()}>
        <p>body</p>
      </BuilderShell>,
      locale,
    )
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(label)
    expect(heading.className).toContain('break-words')
  })

  it('puts the whole label inside the new-document button', () => {
    const { locale, label } = longestInSentence()
    wrap(<DocumentList type="waybill" rows={[]} onOpen={vi.fn()} onNew={vi.fn()} />, locale)
    expect(screen.getAllByRole('button', { name: `+ New ${label}` }).length).toBeGreaterThan(0)
  })
})

describe('Controls carry accessible names, not colour alone (§L9, §K)', () => {
  it('names every step in the builder step bar', () => {
    wrap(
      <BuilderShell type="invoice" step={0} dirty={false} problems={[]} onStep={vi.fn()} onClose={vi.fn()} onSave={vi.fn()}>
        <p>body</p>
      </BuilderShell>,
      'EN-NG',
    )
    for (const name of ['Details', 'Items', 'Totals', 'Design', 'Review']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('gives the close control a name rather than relying on the glyph', () => {
    wrap(
      <BuilderShell type="invoice" step={0} dirty={false} problems={[]} onStep={vi.fn()} onClose={vi.fn()} onSave={vi.fn()}>
        <p>body</p>
      </BuilderShell>,
      'EN-NG',
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('marks the current step for assistive tech', () => {
    wrap(
      <BuilderShell type="invoice" step={2} dirty={false} problems={[]} onStep={vi.fn()} onClose={vi.fn()} onSave={vi.fn()}>
        <p>body</p>
      </BuilderShell>,
      'EN-NG',
    )
    expect(screen.getByRole('button', { name: 'Totals' })).toHaveAttribute('aria-current', 'step')
  })
})
