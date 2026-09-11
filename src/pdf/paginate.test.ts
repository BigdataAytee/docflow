/**
 * §I — "Long documents repeat table headings, break rows safely, and keep
 * totals/signatures on-page."
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { type PageModel, type TableRow } from './compose'
import { PaginationError, paginate, rowsAreComplete } from './paginate'

const row = (n: number): TableRow => ({ description: `Item ${n}`, quantity: '1' })

const model = (count: number): PageModel =>
  ({
    rows: Array.from({ length: count }, (_, i) => row(i)),
  }) as unknown as PageModel

describe('Rows break safely', () => {
  it('keeps every row exactly once, whatever the page size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 2, max: 40 }),
        (count, rowsPerPage) => {
          const m = model(count)
          const pages = paginate(m, { rowsPerPage, footerRowCost: 1 })
          expect(rowsAreComplete(m, pages)).toBe(true)
        },
      ),
    )
  })

  it('never puts more rows on a page than fit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 3, max: 20 }),
        (count, rowsPerPage) => {
          const pages = paginate(model(count), { rowsPerPage, footerRowCost: 2 })
          for (const page of pages) {
            expect(page.rows.length).toBeLessThanOrEqual(rowsPerPage)
            if (page.showsFooter) {
              expect(page.rows.length + 2).toBeLessThanOrEqual(rowsPerPage)
            }
          }
        },
      ),
    )
  })
})

describe('Headings repeat on every page (§I)', () => {
  it('marks every page, not just the first', () => {
    const pages = paginate(model(50), { rowsPerPage: 10, footerRowCost: 2 })
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.every((p) => p.repeatHeadings)).toBe(true)
  })
})

describe('Totals and signature stay on one page (§I)', () => {
  it('puts the footer on exactly one page', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 120 }), (count) => {
        const pages = paginate(model(count), { rowsPerPage: 8, footerRowCost: 3 })
        expect(pages.filter((p) => p.showsFooter)).toHaveLength(1)
        expect(pages[pages.length - 1]?.showsFooter).toBe(true)
      }),
    )
  })

  it('carries rows forward rather than orphaning the footer', () => {
    // 10 rows, 10 per page, footer costs 3: the last page would have no room,
    // so rows move with the footer instead of it sitting alone.
    const pages = paginate(model(10), { rowsPerPage: 10, footerRowCost: 3 })
    expect(pages).toHaveLength(2)
    expect(pages[0]?.rows).toHaveLength(7)
    expect(pages[1]?.rows).toHaveLength(3)
    expect(pages[1]?.showsFooter).toBe(true)
  })

  it('marks earlier pages as continued', () => {
    const pages = paginate(model(25), { rowsPerPage: 10, footerRowCost: 2 })
    expect(pages[0]?.continued).toBe(true)
    expect(pages[pages.length - 1]?.continued).toBe(false)
  })

  it('still produces one page for an empty document', () => {
    const pages = paginate(model(0), { rowsPerPage: 10, footerRowCost: 2 })
    expect(pages).toHaveLength(1)
    expect(pages[0]?.showsFooter).toBe(true)
  })
})

describe('Impossible layouts are refused rather than split', () => {
  it('rejects a footer that cannot fit on a page', () => {
    // Splitting the totals across a page break is the one thing §I rules out,
    // so a design that cannot hold them is an error, not a best effort.
    expect(() => paginate(model(5), { rowsPerPage: 3, footerRowCost: 3 })).toThrow(PaginationError)
  })

  it('rejects a page that fits no rows', () => {
    expect(() => paginate(model(5), { rowsPerPage: 0, footerRowCost: 0 })).toThrow(PaginationError)
  })
})
