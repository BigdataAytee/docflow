/**
 * How big the type on a printed page is allowed to be (§I).
 *
 * THE PAGE'S COORDINATE SPACE IS A4 AT 96 DPI — 794px across for 210mm, which
 * `DocumentPage` fixes by setting its own `fontSize: 16px` base and scaling
 * the whole thing with `zoom: calc(100cqi / 794px)`. Everything inside is an
 * absolute px length in that space, so a px here is a fixed fraction of the
 * paper and NEVER a fraction of the reader's text setting.
 *
 * That makes the conversion exact and the arithmetic worth doing once:
 *
 *     1px = 72/96 pt = 0.75pt     ·     1pt = 96/72 px = 1.333…px
 *
 * WHICH IS WHY THIS FILE EXISTS. `text-[9.5px]` looks like a small caption
 * and reads like one on a laptop. On paper it is 7.1 point — below what a
 * printed document should ever carry, and the document is printed, folded
 * into a delivery van and read at a gate. Nobody writing a header could see
 * that from the number in the class, because the number is in the wrong unit.
 *
 * THE FLOORS, in points, and where each comes from:
 *
 *  · ANY — 8pt. The hard floor. Below this, print is uncomfortable for a
 *    reader with ordinary eyesight and unusable for one without, and no
 *    decorative purpose on a business document is worth that.
 *  · SECONDARY — 8.5pt. Labels, captions, column headings, addresses: text
 *    somebody reads deliberately when they want it, rather than in passing.
 *  · BODY — 10pt. The line items, the party, the totals, the payment
 *    instructions. Everything a recipient actually has to read.
 *  · TOTAL — 14pt, bold. The one figure the whole document is about. It is
 *    the number a person looks for first and the number they check last.
 *
 * ROLES, NOT NUMBERS. A caller asks for `body` and gets whatever body is;
 * nothing on a page carries a bare px again. That is what lets the guard in
 * `tools/sweeps/pdfsizes.ts` measure the RENDERED size of every text node in
 * all sixteen designs rather than read a class and believe it.
 */

/** CSS reference pixels per point. Exact: 96dpi over 72pt to the inch. */
export const PX_PER_PT = 96 / 72

/** What a page-space px is, on paper. */
export const ptOf = (px: number): number => px * (72 / 96)

/** What a point is, in page-space px. */
export const pxOf = (pt: number): number => pt * PX_PER_PT

/**
 * The floors, in points. A size is compared against the floor for its ROLE,
 * and `any` is the one nothing may pass regardless of role.
 */
export const MIN_PT = {
  any: 8,
  secondary: 8.5,
  body: 10,
  total: 14,
} as const

/**
 * The scale, in page-space px.
 *
 * Each clears its floor with a little room, rather than sitting exactly on it
 * — a size chosen to be the minimum becomes the minimum everywhere, and then
 * one rounding somewhere puts a page under it.
 */
export const TYPE = {
  /** 8.625pt — eyebrow labels, the contact strip, the page number. */
  micro: 11.5,
  /** 9.375pt — column headings, addresses, dates, the labels beside values. */
  caption: 12.5,
  /** 10.125pt — line items, the party band, totals lines, the payment box. */
  body: 13.5,
  /** 11.25pt — the reference, and the smaller designs' document titles. */
  lead: 15,
  /** 14.25pt — the payable, and the amount a receipt is for. Always bold. */
  total: 19,
} as const

export type TypeRole = keyof typeof TYPE

/**
 * Every size the print path may use, largest first.
 *
 * The five above are the floors-driven end of the scale. The rest are the
 * display sizes the sixteen designs use to be themselves — a title, a
 * business name, the amount at the top — and they were already comfortably
 * over every floor, so this pass left them exactly as they were. Enlarging a
 * 24px title to satisfy a rule it already satisfied would have changed how
 * sixteen designs look for nothing.
 */
export const DISPLAY = {
  /** 12.75pt — the business name where a design sets it small. */
  nameSmall: 17,
  /** 13.5pt — the business name. */
  name: 18,
  /** 15pt — the headline amount, and a title on a tighter design. */
  headline: 20,
  /** 18pt — the document title. */
  title: 24,
  /** 25.5pt — Bold's full-width title. */
  titleXL: 34,
} as const

/**
 * The scale as Tailwind classes, which is how the pages actually spell it.
 *
 * WRITTEN OUT AS LITERALS, deliberately. Tailwind's scanner reads source text
 * — it cannot evaluate `text-[${TYPE.body}px]`, so a computed class produces
 * no stylesheet rule and the element silently falls back to the page's 16px
 * base. These strings are here, in a file the scanner reads, and they are the
 * only place in the print path a px size is written down.
 *
 * The numbers below must match `TYPE` above; a test holds them together so
 * changing one without the other fails rather than drifts.
 */
export const TEXT = {
  micro: 'text-[11.5px]',
  caption: 'text-[12.5px]',
  body: 'text-[13.5px]',
  lead: 'text-[15px]',
  total: 'text-[19px]',
} as const satisfies Record<TypeRole, string>
