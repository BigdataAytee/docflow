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
 *
 * Rows are counted by COST rather than one apiece, because they are not all
 * the same height: a line carrying a photograph of the goods is a thumbnail
 * tall (§I). Counting it as one was how a page of eight photographed items
 * would have run off the bottom — and since a row is atomic here, the
 * overflow could not have been resolved by splitting it.
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

/**
 * What one photographed row costs, in ordinary rows.
 *
 * The picture is 135px tall under its description and a text row is around
 * 26px, so a photographed line is roughly six rows. Counted honestly rather
 * than generously: every row of slack here is a page break somebody did not
 * need. It was TWO while the picture was a 34px stamp — growing the image to
 * something a recipient can actually see had to move this with it, or a page
 * of photographed goods would run off the bottom.
 */
/**
 * How many ordinary rows a page holds, and what the block beneath them costs.
 *
 * DECLARED ONCE, because it is a fact about the rendered page rather than a
 * preference. It was written out three times — the live preview, the review
 * step and the device journey — with the journey disagreeing about the footer
 * (6 against 4), so the run that was supposed to prove the printed page fit
 * was pagingating a different page from the one people were looking at.
 *
 * TIED TO THE TYPE SCALE. A row is a line of `TYPE.body` plus its padding, so
 * raising the body size to clear the 10pt print floor made every row taller
 * and this number smaller: it was 18 when the table printed at 9pt.
 *
 * MEASURED, NOT CHOSEN. `tools/sweeps/pdfsizes.ts` renders a full page in all
 * sixteen designs and fails if the content runs past the bottom of the A4
 * box. Seventeen fits; eighteen runs Aria's framed header off the paper by
 * 3px. Sixteen is one row inside the measured limit, because the device
 * substitutes its own fonts and 3px is not a margin. Being needlessly low
 * would be its own cost — every row of slack here is a page break in
 * somebody's PDF that did not need to happen.
 *
 * The box is `overflow-hidden`, so an overrun is SILENT: the last row, the
 * signature or the payment box is simply not there. Nothing but a
 * measurement can find that.
 */
export const ROWS_PER_PAGE = 16

/**
 * Row-equivalents the totals, payment box and signature occupy together.
 *
 * Four rows of totals, a payment box beside a signature, and the contact
 * strip under both. Counted against the same rows the table uses, so the two
 * numbers are in one unit.
 */
export const FOOTER_ROW_COST = 5

export const PHOTO_ROW_COST = 6

/** A row with a picture of the goods is taller than one without (§I). */
export const costOf = (row: TableRow): number =>
  row.imageUrl === undefined ? 1 : PHOTO_ROW_COST

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

  const costs = rows.map(costOf)
  const costFrom = (start: number): number =>
    costs.slice(start).reduce((sum, cost) => sum + cost, 0)

  // Every page holds at most `rowsPerPage`; the LAST page holds at most
  // `capacityLast`, because the totals and signature block sits beneath its
  // rows. Building it this way — rather than filling pages and then shuffling
  // the overflow — is what stops a carried remainder overflowing the footer
  // page, which a property test caught the shuffling version doing.
  const capacityLast = rowsPerPage - footerRowCost
  const pages: { rows: TableRow[] }[] = []

  let taken = 0
  while (costFrom(taken) > capacityLast) {
    // Take a full page unless doing so would leave nothing for the footer
    // page — §I would rather the block kept some rows company than sat alone.
    const budget = costFrom(taken) - rowsPerPage > 0 ? rowsPerPage : capacityLast
    /*
     * At least one row, and never the last one.
     *
     * A single photographed row can cost more than a small design's whole
     * page; it gets a page to itself rather than looping forever, and the
     * page it overflows is the honest outcome of a design that cannot hold
     * it. Leaving one row behind is what keeps the footer company.
     */
    let used = 0
    let take = 0
    while (
      taken + take < rows.length - 1 &&
      used + (costs[taken + take] ?? 0) <= budget
    ) {
      used += costs[taken + take] ?? 0
      take += 1
    }
    if (take === 0) take = 1
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
