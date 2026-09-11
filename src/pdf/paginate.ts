/**
 * Page breaking (§I).
 *
 * "Long documents repeat table headings, break rows safely, and keep
 * totals/signatures on-page."
 *
 * Three rules, each of which is a way a printed document goes wrong:
 *  · every page repeats the column headings, so page 3 is readable alone;
 *  · a row is never split across a page boundary;
 *  · the totals and signature block is never orphaned from the table — if it
 *    does not fit under the last rows, it moves WITH at least one row rather
 *    than sitting alone on a final page.
 */

import type { PageModel, TableRow } from './compose'

export interface PrintPage {
  readonly pageNumber: number
  readonly rows: readonly TableRow[]
  /** Repeated on every page (§I). */
  readonly repeatHeadings: true
  /** The totals and signature block lands on exactly one page. */
  readonly showsFooter: boolean
  readonly continued: boolean
}

export interface PaginationOptions {
  /** How many table rows fit on a page of this design. */
  readonly rowsPerPage: number
  /** Row-equivalents the totals + signature block occupies. */
  readonly footerRowCost: number
}

export class PaginationError extends Error {}

export function paginate(model: PageModel, options: PaginationOptions): PrintPage[] {
  const { rowsPerPage, footerRowCost } = options

  if (rowsPerPage < 1) throw new PaginationError('A page must fit at least one row.')
  if (footerRowCost >= rowsPerPage) {
    throw new PaginationError(
      'The totals and signature block does not fit on a page of this design — it would be split, which §I forbids.',
    )
  }

  const rows = model.rows
  if (rows.length === 0) {
    return [{ pageNumber: 1, rows: [], repeatHeadings: true, showsFooter: true, continued: false }]
  }

  // Every page holds at most `rowsPerPage`; the LAST page holds at most
  // `capacityLast`, because the totals and signature block sits beneath its
  // rows. Building it this way — rather than filling pages and then shuffling
  // the overflow — is what stops a carried remainder overflowing the footer
  // page, which a property test caught the shuffling version doing.
  const capacityLast = rowsPerPage - footerRowCost
  const pages: { rows: TableRow[] }[] = []

  let taken = 0
  while (rows.length - taken > capacityLast) {
    // Take a full page unless doing so would leave nothing for the footer
    // page — §I would rather the block kept some rows company than sat alone.
    const take = rows.length - taken - rowsPerPage > 0 ? rowsPerPage : capacityLast
    pages.push({ rows: rows.slice(taken, taken + take) })
    taken += take
  }
  pages.push({ rows: rows.slice(taken) })

  return pages.map((page, index) => ({
    pageNumber: index + 1,
    rows: page.rows,
    repeatHeadings: true,
    showsFooter: index === pages.length - 1,
    continued: index < pages.length - 1,
  }))
}

/** Every row appears exactly once across the pages — nothing lost or doubled. */
export const rowsAreComplete = (model: PageModel, pages: readonly PrintPage[]): boolean => {
  const flat = pages.flatMap((p) => p.rows)
  return (
    flat.length === model.rows.length &&
    flat.every((row, index) => row === model.rows[index])
  )
}
