/**
 * The two halves of a letterhead: the mark, and the address (§F, §I).
 *
 * Both were declared and neither arrived. `logoAssetId` reached the composed
 * model and `LogoHolder` drew a grey rectangle where the logo should be,
 * because the natural size it needed came from a prop — `logoNaturalSize` —
 * that no caller in the app ever supplied. And §F's Sikky is specified as
 * "coloured spine, BOXED OFFICE ADDRESS, centred underlined title": the spine
 * was drawn, the box was not, and no company record held an address to put in
 * it.
 *
 * So these are consumption tests. Each sets the field and asserts the page
 * PRINTS it — the shape of assertion the blank UNIT column taught, where a
 * test about the declaration stayed green for as long as the column was
 * empty.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'

import { DocumentPage } from './DocumentPage'
import { TEMPLATES, templateById } from './templates'
import { composeDocument } from './compose'
import { paginate } from './paginate'
import { quantity } from '../domain/documents/types'
import { freezeLabels } from '../domain/locale/profile'
import { stringsFor } from '../domain/locale/data/strings'

const PROFILE = { locale: 'EN-NG' } as const
const strings = stringsFor('en')
const ADDRESS = 'Lagos Abeokuta Motor Road, Ifo, Ogun State'
const LOGO = 'data:image/png;base64,iVBORw0KGgo='

const modelWith = (
  branding: Partial<Parameters<typeof composeDocument>[1]['branding']>,
  assetUrls: Record<string, string> = {},
) =>
  composeDocument(
    {
      type: 'invoice',
      status: 'issued',
      currency: 'NGN',
      reference: 'INV-0042',
      issueDate: '2026-09-15',
      lineItems: [
        {
          id: 'l1',
          description: 'Galvanised roofing sheet',
          quantityMilli: quantity(24),
          unitPriceMinor: 18_500_00,
          taxable: true,
        },
      ],
      party: { name: 'Adeola Hardware', address: '14 Ogunlana Drive' },
      frozenLabels: freezeLabels(PROFILE, 'invoice'),
    },
    {
      profile: PROFILE,
      branding: {
        name: 'Sola Ventures',
        nameStyle: 'classic',
        logoSize: 'M',
        showLogo: true,
        ...branding,
      },
      columnLabels: {
        description: strings.items.description,
        quantity: strings.items.quantity,
        amount: strings.totals.payable,
        unit: strings.items.unit,
      },
      assetUrls,
      replacesLabel: () => '',
    },
  )

/**
 * An `Image` that decodes.
 *
 * jsdom has the constructor and never loads anything, so `naturalWidth` stays
 * 0 and `onload` never fires — which means the branch that draws the mark is
 * unreachable in a test unless the browser API it depends on is supplied.
 * This is that API, and nothing more: a src setter that reports a size.
 *
 * It stands in for the platform, not for anything in this repository. What is
 * under test either side of it is ours: `fitLogo`'s placement, and the holder
 * drawing what it was given.
 */
const NATURAL = { width: 800, height: 200 }
const realImage = globalThis.Image

beforeAll(() => {
  class DecodingImage {
    naturalWidth = 0
    naturalHeight = 0
    onload: (() => void) | null = null
    set src(_value: string) {
      this.naturalWidth = NATURAL.width
      this.naturalHeight = NATURAL.height
      // A real decode is a task, not a microtask; the hook must survive both.
      setTimeout(() => this.onload?.(), 0)
    }
  }
  globalThis.Image = DecodingImage as unknown as typeof Image
})

afterAll(() => {
  globalThis.Image = realImage
})

const draw = (templateId: string, model: ReturnType<typeof modelWith>) => {
  const pages = paginate(model, { rowsPerPage: 18, footerRowCost: 4 })
  const view = render(
    <DocumentPage
      model={model}
      template={templateById(templateId)}
      page={pages[0]!}
      totalPages={pages.length}
      formatAmount={(minor) => `₦${(minor / 100).toFixed(2)}`}
      currency="NGN"
      accent="#2b3fd6"
    />,
  )
  const article = view.container.querySelector('article')
  if (article === null) throw new Error('No page rendered.')
  return { view, article }
}

describe('A named logo asset becomes a drawn one (§F, §I)', () => {
  it('resolves the id to its bytes through assetUrls, the way a signature does', () => {
    const model = modelWith({ logoAssetId: 'as_1' }, { as_1: LOGO })
    expect(model.branding.logoUrl).toBe(LOGO)
  })

  /** An id the repository did not hand over draws nothing. Never a broken image. */
  it('leaves the url absent when the asset is not to hand', () => {
    const model = modelWith({ logoAssetId: 'as_missing' }, { as_1: LOGO })
    expect(model.branding.logoUrl).toBeUndefined()
  })

  /**
   * THE BUG THIS FILE EXISTS FOR. `logoNaturalSize` was never passed, so
   * `fit` was always null and the holder printed empty on every design. It is
   * measured inside the holder now, so there is nothing left to forget.
   */
  it('puts the image in the holder on every one of the sixteen', async () => {
    const model = modelWith({ logoAssetId: 'as_1' }, { as_1: LOGO })
    for (const template of TEMPLATES) {
      const { view, article } = draw(template.id, model)
      await waitFor(() => {
        const images = [...article.querySelectorAll('img')].filter(
          (image) => image.getAttribute('src') === LOGO,
        )
        expect(images.length, `${template.id} prints no logo`).toBeGreaterThan(0)
      })
      view.unmount()
    }
  })

  /** Contained, never cropped (§F, §V) — the aspect ratio survives the fit. */
  it('scales a wide mark to the holder without distorting it', async () => {
    const model = modelWith({ logoAssetId: 'as_1' }, { as_1: LOGO })
    const { article } = draw('classic', model)

    const image = await waitFor(() => {
      const found = article.querySelector('img')
      expect(found).not.toBeNull()
      return found!
    })

    const width = Number.parseFloat(image.style.width)
    const height = Number.parseFloat(image.style.height)
    expect(width / height).toBeCloseTo(NATURAL.width / NATURAL.height, 5)
  })

  it('draws the holder and no image when the design has the logo switched off', () => {
    const model = modelWith({ logoAssetId: 'as_1', showLogo: false }, { as_1: LOGO })
    const { article } = draw('classic', model)
    expect([...article.querySelectorAll('img')].map((image) => image.getAttribute('src'))).not.toContain(
      LOGO,
    )
  })
})

describe('The business address prints where §F puts one, and nowhere else', () => {
  /** §F: Sikky is "coloured spine, boxed office address, centred underlined title". */
  it('boxes the office address on Sikky', () => {
    const { article } = draw('sikky', modelWith({ address: ADDRESS }))
    expect(article.textContent).toContain(ADDRESS)
  })

  /**
   * PER-TEMPLATE, not once. "The business address appears on exactly one
   * design" is the kind of claim that drifts back one component at a time, so
   * the check walks all sixteen with the field SET rather than omitted — a
   * fixture that leaves it out proves nothing about a page that would print
   * it.
   */
  it('prints it on no other design', () => {
    const model = modelWith({ address: ADDRESS })
    for (const template of TEMPLATES) {
      if (template.id === 'sikky') continue
      const { view, article } = draw(template.id, model)
      expect(article.textContent, `${template.id} prints the business address`).not.toContain(
        ADDRESS,
      )
      view.unmount()
    }
  })

  /** Rule #1: the address is always allowed to be missing. */
  it('draws no empty box on Sikky when there is no address', () => {
    const { article } = draw('sikky', modelWith({}))
    expect(article.textContent).toContain('Sola Ventures')
    expect(article.textContent).not.toContain(ADDRESS)
  })
})
