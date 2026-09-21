/**
 * The sixteen header treatments (§H).
 *
 * `TemplateThumb` draws a schematic per `headerStyle` — the band, the spine,
 * the diagonal, the frame — so the strip lets somebody pick a design without
 * opening each one. The PAGE branched on `headerStyle` exactly once, for
 * `hairline`, and only to halve a rule's opacity. Sixteen designs printed one
 * layout differing by font, paper and ink.
 *
 * That made the strip a promise the document did not keep: pick Prism, get
 * Classic with a different typeface. This file is the other half of that
 * contract, and every arrangement here answers the schematic its thumb draws.
 *
 * TWO KINDS OF TREATMENT, split because they have different reach:
 *
 *  · A HEADER style rearranges the identity block — name, title, reference —
 *    and whatever rule or band sits under it. Twelve of the sixteen.
 *  · A CHROME style marks the whole page: Sidebar's tinted column, Sikky's
 *    spine, Wave's foot, Aria's frame. Those cannot live in a header, because
 *    they run past it — so they are drawn as layers behind the content, and
 *    `contentInset` keeps the body from sitting on top of them.
 *
 * Nothing here decides what a document SAYS. Every string comes from the
 * composed model, which is the same model the PDF writer draws, so a design
 * can change the arrangement and never the words (Rule #5, §D.2).
 */

import type { ReactNode } from 'react'

import type { PageModel } from './compose'
import type { HeaderStyle, TemplateDefinition } from './templates'

export interface DocumentHeaderProps {
  readonly model: PageModel
  readonly template: TemplateDefinition
  /** The template's ink, or the brand accent where the design uses one. */
  readonly ink: string
  readonly logo: ReactNode
  /** The headline figure needs formatting; the page owns the formatter. */
  readonly formatAmount: (minor: number, currency: string) => string
}

/* ------------------------------------------------------------- the pieces */

/**
 * The business, as a block: its name and its full address beneath.
 *
 * THE ADDRESS USED TO PRINT ON EXACTLY ONE DESIGN of the sixteen — Sikky's
 * boxed office address — so an owner who filled it in saw it on that one and
 * on nothing else. Every document the legacy app produced carries the full
 * address directly under the name, and it is the line that tells a customer
 * where the business actually is.
 *
 * It lives HERE rather than in each of the sixteen header cases, because
 * sixteen copies of it is sixteen chances for one to be forgotten — which is
 * how it came to be on one.
 *
 * `address` stays optional (Rule #1): no address prints no line, never an
 * empty one.
 */
const Name = ({ model, className = '' }: { model: PageModel; className?: string }) => (
  <div className={className}>
    <p className="break-words text-[18px] font-bold leading-tight">{model.branding.name}</p>
    {model.branding.address !== undefined && model.branding.address.trim() !== '' && (
      <p
        data-business-address
        className="mt-[3px] break-words text-[12.5px] leading-snug opacity-65"
      >
        {model.branding.address}
      </p>
    )}
  </div>
)

/**
 * How to reach the business, stacked — Sidebar's column only.
 *
 * The footer strip prints the same three on every design as one line. A
 * column is tall and narrow, so they stack, and each is optional on its own
 * (Rule #1): a business with a phone and no website prints a phone and no
 * blank row under it.
 */
const SidebarContact = ({ model }: { model: PageModel }) => {
  const lines = [model.branding.phone, model.branding.email, model.branding.website].filter(
    (line): line is string => line !== undefined && line.trim() !== '',
  )
  if (lines.length === 0) return null
  return (
    <div className="mt-auto space-y-[3px] text-[11.5px] leading-snug opacity-75">
      {lines.map((line) => (
        <p key={line} className="break-words">
          {line}
        </p>
      ))}
    </div>
  )
}

/**
 * Which designs place the headline figure THEMSELVES.
 *
 * Five compose it into their header because its position is part of what
 * makes them that design — beside the name in Classic, under the rule in
 * Modern, above the hairline in Minimal. Every other design gets it in the
 * one standard place instead (see `DocumentPage`), so a new design cannot
 * ship without one: the default is having it, not lacking it.
 */
export const HEADER_DRAWS_HEADLINE: ReadonlySet<string> = new Set([
  'rule',
  'band',
  'hairline',
  'split',
  'centred',
  'sidebar',
  'badge',
  'wave',
  'condensed',
  'spine',
  'gradient',
  'double-rule',
  'flourish',
  'diagonal',
  'arch',
  'frame',
])

/**
 * The headline figure: BALANCE DUE and the amount, large (§I).
 *
 * Every legacy document puts what is owed at the TOP, beside the title. It is
 * the first thing a recipient needs, and ours made them find it at the foot of
 * the totals stack. Null on a delivery, which carries no money (§V).
 */
const Headline = ({
  model,
  ink,
  formatAmount,
  align = 'end',
}: {
  model: PageModel
  ink: string
  formatAmount: (minor: number, currency: string) => string
  align?: 'start' | 'end'
}) =>
  model.headline === null ? null : (
    <div
      className={`shrink-0 ${align === 'end' ? 'text-end' : ''}`}
      data-headline
    >
      <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] opacity-55">
        {model.headline.label}
      </p>
      {/*
        `whitespace-nowrap`: an amount broken across two lines is unreadable
        as a number, and worse than any crowding it would relieve.
      */}
      <p
        className="mt-[1px] whitespace-nowrap text-[20px] font-black tabular-nums"
        style={{ color: ink }}
      >
        {formatAmount(model.headline.amount.minor, model.headline.amount.currency)}
      </p>
    </div>
  )

const Title = ({
  model,
  ink,
  className = '',
}: {
  model: PageModel
  ink: string
  className?: string
}) => (
  <h2
    /*
      LETTER-SPACED, not tightened. The reference sets the type title wide —
      "Q U O T A T I O N" — which is what makes it read as the document's
      name rather than as a heading inside it. This was `tracking-tight`,
      the opposite, and the title sat on the page looking like body copy in
      caps. `break-words` stays: §F requires the longest shipped label to
      wrap rather than clip, and wide tracking makes "DELIVERY NOTE" longer
      still.
    */
    className={`break-words text-[24px] font-black uppercase tracking-[0.12em] ${className}`}
    style={{ color: ink }}
  >
    {model.title}
  </h2>
)

/**
 * The reference, and what this document replaces.
 *
 * Kept together because a customer reads them together — §G's Rev 2 and a
 * reissued receipt both answer "which of these two is the live one?", and
 * that question is asked at the reference.
 */
const Ref = ({ model, className = '' }: { model: PageModel; className?: string }) => (
  <>
    <p className={`text-[15px] tabular-nums opacity-70 ${className}`}>{model.reference}</p>
    {model.replacesLine !== null && (
      <p className={`text-[13.5px] font-semibold opacity-80 ${className}`}>{model.replacesLine}</p>
    )}
  </>
)

/* -------------------------------------------------------------- the rules */

const Rule = ({ ink, opacity = 1, height = 3 }: { ink: string; opacity?: number; height?: number }) => (
  <div
    className="mt-[16px] w-full"
    style={{ backgroundColor: ink, opacity, height: `${height}px` }}
  />
)

/* ------------------------------------------------------------- the header */

export function DocumentHeader({ model, template, ink, logo, formatAmount }: DocumentHeaderProps) {
  const style = template.headerStyle

  switch (style) {
    /* Classic — logo left, identity right, a heavy rule beneath. */
    /*
     * CLASSIC — the legacy layout, transcribed from the document the owner
     * has been sending for years (`docs/design-reference/`).
     *
     * Everything else in this file is a variation on "name, title, rule".
     * This one is the arrangement a customer already recognises, and the
     * owner asked for it by name:
     *
     *   · logo alone, top LEFT
     *   · the type title top RIGHT, large and letter-spaced, with the
     *     reference directly beneath it and a rule closing that column
     *   · the business name and its full address as a block on the left,
     *     BELOW the logo rather than beside it
     *   · a heavy rule across the full width, closing the header
     *
     * The two columns are deliberately independent: the title block is
     * right-aligned and self-contained, so a long business name grows
     * downward on the left without dragging the reference off the page.
     */
    case 'rule':
      return (
        <>
          <header className="flex items-start justify-between gap-[16px]">
            <div className="shrink-0">{logo}</div>
            <div className="min-w-0 text-end">
              <Title model={model} ink={ink} />
              <Ref model={model} className="mt-[2px]" />
              {/* Closes the reference column, as the reference draws it. */}
              <div
                className="ms-auto mt-[6px] w-full max-w-[190px] border-t-2"
                style={{ borderColor: ink }}
              />
            </div>
          </header>

          {/*
            The business block sits UNDER the logo, not beside it — which is
            what gives the legacy page its top-left mass and lets the address
            run to two lines without touching the title. The headline figure
            sits opposite it, so name-and-address and BALANCE DUE share a
            baseline the way the reference draws them.
          */}
          {/*
            `flex-1` ON THE NAME, and that is the whole tuning.

            It carried `min-w-0` alone, which lets a long name SHRINK but
            never makes it grow — so it sized to its own content, wrapped to
            three lines, and left the space beside it empty while the address
            underneath was squeezed into a column narrower than the figure
            opposite. §I's idiom is 58% to the totals; the identity block
            should have the larger share for the same reason, and `flex-1`
            against a `shrink-0` figure produces exactly that: the amount
            takes what it needs and the name gets the rest.
          */}
          <div className="mt-[10px] flex items-end justify-between gap-[16px]">
            <Name model={model} className="min-w-0 flex-1" />
            <Headline model={model} ink={ink} formatAmount={formatAmount} />
          </div>

          {/* The heavy rule that separates the header from the document. */}
          <Rule ink={ink} height={2} />
        </>
      )

    /*
     * Modern — name, a rule, then the title reversed out of a tinted band.
     * The thumb's third shape is that band, and it is why the title moves
     * BELOW the rule here rather than sitting above it.
     */
    /*
     * MODERN — the business name and the title share a BASELINE.
     *
     * Logo top left; the name on the left and INVOICE large on the right of
     * the same line; the address and the reference on the line beneath, each
     * under the thing it belongs to; then a heavy rule spanning the page.
     *
     * The difference from Classic is structural rather than decorative: here
     * the name competes with the title for the top line, which is what makes
     * a page with a long business name read as a letterhead rather than as a
     * form.
     */
    case 'band':
      return (
        <>
          <header className="flex items-start gap-[16px]">
            <div className="shrink-0">{logo}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-[16px]">
                <p className="min-w-0 break-words text-[16px] font-bold leading-tight">
                  {model.branding.name}
                </p>
                <Title model={model} ink={ink} className="shrink-0" />
              </div>
              <div className="mt-[3px] flex items-start justify-between gap-[16px]">
                {model.branding.address !== undefined &&
                model.branding.address.trim() !== '' ? (
                  <p
                    data-business-address
                    className="min-w-0 break-words text-[12.5px] leading-snug opacity-65"
                  >
                    {model.branding.address}
                  </p>
                ) : (
                  <span />
                )}
                <Ref model={model} className="shrink-0 text-end" />
              </div>
            </div>
          </header>
          <Rule ink={ink} height={2} />
          <div className="mt-[8px] flex items-end justify-end">
            <Headline model={model} ink={ink} formatAmount={formatAmount} />
          </div>
        </>
      )

    /* Minimal — a hairline, and a great deal of nothing. */
    /*
     * MINIMAL — hairlines only, and the dates live in the TITLE column.
     *
     * Logo top left; the title small and widely letter-spaced top right with
     * the reference and both dates stacked beneath it; the business name and
     * address on the left; the headline figure above the table. No heavy
     * rules and no tinted bands anywhere — that restraint is the design, so
     * the only rule on the page is a hairline.
     */
    case 'hairline':
      return (
        <>
          <header className="flex items-start justify-between gap-[16px]">
            <div className="shrink-0">{logo}</div>
            <div className="min-w-0 text-end">
              {/*
                GREY, and the reference is emphatic about it: `color:#8a93a6`
                with no brand anywhere in Minimal's header. The title was
                drawn in the accent, which made the loudest thing on the
                quietest design its own name — Minimal's entire argument is
                that the document does not announce itself.
              */}
              <h2 className="break-words text-[15px] font-semibold uppercase tracking-[0.3em] text-[#8a93a6]">
                {model.title}
              </h2>
              <Ref model={model} className="mt-[2px]" />
              <p className="mt-[4px] text-[12.5px] tabular-nums opacity-60">{model.issueDate}</p>
              {model.dueDate !== undefined && (
                <p className="text-[12.5px] tabular-nums opacity-60">{model.dueDate}</p>
              )}
            </div>
          </header>
          {/*
            `flex-1` ON THE NAME, and that is the whole tuning.

            It carried `min-w-0` alone, which lets a long name SHRINK but
            never makes it grow — so it sized to its own content, wrapped to
            three lines, and left the space beside it empty while the address
            underneath was squeezed into a column narrower than the figure
            opposite. §I's idiom is 58% to the totals; the identity block
            should have the larger share for the same reason, and `flex-1`
            against a `shrink-0` figure produces exactly that: the amount
            takes what it needs and the name gets the rest.
          */}
          <div className="mt-[10px] flex items-end justify-between gap-[16px]">
            <Name model={model} className="min-w-0 flex-1" />
            <Headline model={model} ink={ink} formatAmount={formatAmount} />
          </div>
          <Rule ink={ink} opacity={0.25} height={1} />
        </>
      )

    /*
     * Bold — a split header: the name on a tinted block, the title reversed
     * out of a solid one, and an accent rule under both.
     */
    /*
     * BOLD — the title is the biggest thing on the page.
     *
     * Logo top left; INVOICE very large top right; the business name stacked
     * beneath the logo with its full address under that. Where Modern makes
     * name and title share a line, this one lets the title dominate outright
     * — the name gets its own block and does not compete.
     */
    case 'split':
      return (
        <>
          <header className="flex items-start justify-between gap-[16px]">
            <div className="shrink-0">{logo}</div>
            <div className="min-w-0 text-end">
              <h2
                className="break-words text-[34px] font-black uppercase leading-none tracking-[0.02em]"
                style={{ color: ink }}
              >
                {model.title}
              </h2>
              <Ref model={model} className="mt-[3px]" />
            </div>
          </header>

          {/*
            `flex-1` ON THE NAME, and that is the whole tuning.

            It carried `min-w-0` alone, which lets a long name SHRINK but
            never makes it grow — so it sized to its own content, wrapped to
            three lines, and left the space beside it empty while the address
            underneath was squeezed into a column narrower than the figure
            opposite. §I's idiom is 58% to the totals; the identity block
            should have the larger share for the same reason, and `flex-1`
            against a `shrink-0` figure produces exactly that: the amount
            takes what it needs and the name gets the rest.
          */}
          <div className="mt-[10px] flex items-end justify-between gap-[16px]">
            <Name model={model} className="min-w-0 flex-1" />
            <Headline model={model} ink={ink} formatAmount={formatAmount} />
          </div>
          <Rule ink={ink} height={2} />
        </>
      )

    /*
     * ELEGANT — everything centred, and the DIVIDER comes between identity
     * and document.
     *
     * Logo, business name and address centred; a hairline-with-diamond rule;
     * then the title letter-spaced and centred with the reference beneath it.
     * The order matters and is what makes this one different: the divider
     * separates WHO SENT IT from WHAT IT IS, rather than sitting under the
     * whole header as it did before.
     *
     * The headline stays right-aligned even here — a centred amount reads as
     * a heading rather than as a figure, and it has to line up with the
     * totals column beneath it.
     */
    case 'centred':
      return (
        <>
          <header className="flex flex-col items-center text-center">
            {logo}
            <Name model={model} className="mt-[8px] text-center" />
          </header>

          <div className="mt-[12px] flex items-center gap-[8px] px-[10%]">
            <div className="h-px flex-1" style={{ backgroundColor: ink }} />
            <div
              className="h-[8px] w-[8px] rotate-45"
              style={{ backgroundColor: ink }}
              aria-hidden="true"
            />
            <div className="h-px flex-1" style={{ backgroundColor: ink }} />
          </div>

          <div className="mt-[10px] text-center">
            <Title model={model} ink={ink} className="text-center" />
            <Ref model={model} className="text-center" />
          </div>

          <div className="mt-[8px] flex justify-end">
            <Headline model={model} ink={ink} formatAmount={formatAmount} />
          </div>
        </>
      )

    /*
     * Executive — a circle motif in the corner, the title reversed out of a
     * badge. The circle is page chrome by position but header-sized, so it is
     * drawn here inside a clipped box rather than behind the whole page.
     */
    case 'badge':
      return (
        <>
          <header className="relative flex items-start gap-[16px]">
            {logo}
            <div className="relative min-w-0 flex-1">
              <Name model={model} />
              <span
                className="mt-[4px] inline-block rounded px-[8px] py-[4px]"
                style={{ backgroundColor: ink }}
              >
                <Title model={model} ink={template.paper} className="text-[20px]" />
              </span>
              <Ref model={model} />
            </div>
            {/*
              THE FIGURE SITS IN THE CIRCLE, rather than under its edge.

              The disc was anchored off the top-right corner at a size that had
              nothing to do with the figure beside it, so it cut straight
              through: the label read inside the disc and the amount hung out
              of its side, struck through by the boundary. Two separate marks
              fighting for one corner.

              They are one mark now. The disc is centred on the figure and
              sized to hold it — which is the arrangement the design was
              reaching for, and the reason it is called Executive: the amount
              is the thing in the corner, not a decoration next to it.

              It is sized in absolute px like everything else in this file
              (see the note on the page being a scale model), so it holds the
              figure at A4 and at 343px alike.
            */}
            <div className="relative shrink-0">
              {/*
                NEUTRAL GREY, which is the reference's own `#f1f2f6`.

                It was the brand ink at 14%, and Executive already spends its
                brand colour on the title badge two inches away — so the disc
                was a second, weaker statement of the same colour competing
                with the first. Grey lets the badge be the only coloured thing
                in the header, which is what makes a badge read as one.
              */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute start-1/2 top-1/2 h-[190px] w-[190px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: '#f1f2f6' }}
              />
              <div className="relative">
                <Headline model={model} ink={ink} formatAmount={formatAmount} />
              </div>
            </div>
          </header>
          <Rule ink={ink} height={2} />
        </>
      )

    /* Compact — one full-width accent line, then a three-cell strip. */
    case 'condensed':
      return (
        <>
          {/*
            The logo belongs on this one too. It had been left off, which made
            §F's own hint line — "your logo prints at the top of every design"
            — false for one of the sixteen, and the reference's compact header
            opens with the holder exactly like the rest.
          */}
          <header className="flex items-center justify-between gap-[16px]">
            {logo}
            <Name model={model} className="min-w-0 flex-1 text-[16px]" />
            <Title model={model} ink={ink} className="text-[20px]" />
          </header>
          <Rule ink={ink} opacity={0.75} height={2} />
          {/*
            The figure is the FOURTH CELL of the strip, not a block above it.
            Compact's whole idea is that the facts sit in one band; lifting
            the amount out of it would be every other design's header.
          */}
          <div className="mt-[8px] grid grid-cols-4 gap-[8px] text-[12.5px]">
            {[
              [model.partyLabel, model.party.name],
              ['', model.reference],
              ['', model.issueDate],
              [model.headline?.label ?? '', model.headline === null ? '' : formatAmount(model.headline.amount.minor, model.headline.amount.currency)],
            ].map(([label, value], cell) => (
              <div
                key={cell}
                className="px-[8px] py-[4px]"
                style={{ backgroundColor: `${template.ink}14` }}
                /*
                  The fourth cell IS this design's headline, so it carries the
                  marker the completeness guard looks for. Without it Compact
                  reads as a design with no amount at the top — which is the
                  thing the guard exists to catch, and it caught this.
                */
                {...(cell === 3 && model.headline !== null ? { 'data-headline': true } : {})}
              >
                {label !== '' && <p className="font-bold uppercase opacity-60">{label}</p>}
                <p className="truncate font-medium tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </>
      )

    /* Aurora — a full-bleed gradient band, the identity reversed out of it. */
    case 'gradient':
      return (
        <header
          className="-mx-[6%] -mt-[6%] mb-[16px] flex items-start gap-[16px] px-[6%] pb-[20px] pt-[6%]"
          style={{ backgroundImage: `linear-gradient(120deg, ${ink}, ${ink}55)` }}
        >
          {logo}
          <div className="min-w-0 flex-1" style={{ color: template.paper }}>
            <Name model={model} />
            <Title model={model} ink={template.paper} className="mt-[4px]" />
            <Ref model={model} />
          </div>
          {/*
            ON the band, reversed out with everything else. Lifting the figure
            below it would leave the band carrying only the name — and the
            band IS this design.
          */}
          <Headline model={model} ink={template.paper} formatAmount={formatAmount} />
        </header>
      )

    /* Ledger — two rules under the header, as an account book has. */
    case 'double-rule':
      return (
        <>
          <header className="flex items-start gap-[16px]">
            {logo}
            <div className="min-w-0 flex-1">
              <Name model={model} />
              <Title model={model} ink={ink} className="mt-[4px]" />
              <Ref model={model} />
            </div>
          </header>
          {/*
            BETWEEN the two rules. Ledger's whole idea is the pair of lines;
            putting the figure in the space they enclose uses the design
            rather than sitting above it and leaving the gap empty.
          */}
          {/*
            A HAIRLINE OVER A DOUBLE RULE, which is what makes it a ledger.

            Both rules were 2px solid and identical, so the pair read as a
            mistake — two lines the same weight with a gap. The reference sets
            `border-top:1px solid` above and `border-bottom:3px double` below:
            one thin line opening the band, a ruled double line closing it,
            exactly as an account book rules off a column.
          */}
          <div className="mt-[16px] w-full" style={{ borderTop: `1px solid ${ink}` }} />
          <div className="flex justify-end py-[5px]">
            <Headline model={model} ink={ink} formatAmount={formatAmount} />
          </div>
          <div className="w-full" style={{ borderBottom: `3px double ${ink}` }} />
        </>
      )

    /* Botanic — a leaf flourish at the corner, centred beneath it. */
    case 'flourish':
      return (
        <>
          <header className="relative flex flex-col items-center text-center">
            {/*
              A DRAWN STEM, not a rounded rectangle.

              The flourish was a box with two corners rounded — a shape with
              no reference to anything, which is why the design read as
              "Classic with an odd corner". The reference draws three
              springing strokes and a bud, and that is what earns the name.
            */}
            <svg
              aria-hidden="true"
              viewBox="0 0 60 60"
              className="pointer-events-none absolute end-0 top-0 h-[64px] w-[64px]"
              style={{ opacity: 0.4 }}
            >
              <path
                d="M58 2C40 6 26 18 20 34M58 2c-2 16-10 26-22 32M58 2c-14-1-26 6-32 18"
                fill="none"
                stroke={ink}
                strokeWidth="1.1"
              />
              <circle cx="20" cy="34" r="2" fill={ink} />
            </svg>
            {logo}
            <Name model={model} className="mt-[8px]" />
            {/*
              THE TITLE SITS BETWEEN THE RULES, not above one.

              A single rule under the title closes the block and leaves the
              title outside it. The reference runs a hairline in from each
              margin to meet the letter-spaced title, so the rule and the word
              are one horizontal mark across the page.
            */}
            <div className="mt-[9px] flex w-full items-center gap-[6px]">
              <span className="h-px flex-1" style={{ backgroundColor: ink, opacity: 0.35 }} />
              <span
                className="shrink-0 whitespace-nowrap text-[15px] uppercase tracking-[0.24em]"
                style={{ color: ink }}
              >
                {model.title}
              </span>
              <span className="h-px flex-1" style={{ backgroundColor: ink, opacity: 0.35 }} />
            </div>
            <Ref model={model} className="text-center" />
          </header>
          {/*
            UNDER the inset hairline, and inset with it — the rule stops short
            of the edges on this design, so a figure running to the margin
            would break the frame the flourish sets up.
          */}
          <div className="mx-[8%] mt-[8px] flex justify-end">
            <Headline model={model} ink={ink} formatAmount={formatAmount} />
          </div>
        </>
      )

    /* Prism — an angular cut across the header, identity reversed out. */
    case 'diagonal':
      return (
        <>
        <header
          className="-mx-[6%] -mt-[6%] mb-[16px] flex items-start gap-[16px] px-[6%] pb-[44px] pt-[6%]"
          style={{
            backgroundColor: ink,
            /*
             * DEEP ON THE LEFT, exactly as the reference cuts it:
             * `polygon(0,0 100,0 100,14 0,34)` over a 40-unit box — full
             * depth at the left edge, falling to 40% at the right.
             *
             * I had this flipped. The band was cut deep on the RIGHT because
             * I had put the tall stack there — name, address, logo AND the
             * figure — and it was being sliced by its own edge. The reference
             * solves it the other way and the right way round: the right side
             * carries ONLY the title, one line, so the shallow end has almost
             * nothing under it and the identity gets the deep end.
             */
            clipPath: 'polygon(0 0, 100% 0, 100% 40%, 0 100%)',
          }}
        >
          {/*
            Identity LEFT, title RIGHT — the opposite of Aurora, which is what
            keeps two reversed-out bands from being one design with two
            background shapes.

            The logo sits in a white tile because the band is solid brand
            behind it, and a logo with its own dark artwork disappears into a
            dark ink otherwise. The reference does the same, for the same
            reason.
          */}
          <div className="flex min-w-0 flex-1 items-start gap-[10px]" style={{ color: template.paper }}>
            {logo !== null && (
              <div className="shrink-0 rounded-[4px] bg-white p-[2px]">{logo}</div>
            )}
            <Name model={model} className="min-w-0 flex-1" />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-[6px]">
            <Title model={model} ink={template.paper} />
            <Ref model={model} />
          </div>
        </header>
        {/*
          THE FIGURE SITS BELOW THE BAND, in ink.

          It was inside it, in paper white, on the shallow right-hand side —
          and the band is only 40% deep there, so the amount fell out from
          under its own background and printed WHITE ON WHITE. Invisible on
          the page and invisible to a bounds check, which asks whether a box
          is on the paper and never whether anybody can see what is in it.

          The reference has no figure here at all; it puts the amount in the
          totals. Ours keeps it at the top (§I), so it goes where the band
          has ended and the ink reads.
        */}
        <div className="-mt-[8px] mb-[12px] flex justify-end">
          <Headline model={model} ink={ink} formatAmount={formatAmount} />
        </div>
        </>
      )

    /* Bloom — an arch drawn over a centred identity. */
    case 'arch':
      return (
        <>
          <header className="relative flex flex-col items-center pt-[8px] text-center">
            {/*
              BLOOM HAS ITS OWN PALETTE, and that is what makes it Bloom.

              It was an arch outlined in the brand accent — the same ink as
              every other design, bent into a curve. The reference draws a
              flowering branch in fixed pinks and sets the identity in them:
              `#E8B4C6` for the stem, `#7C4257` for the name, `#B4577E` for
              the title.

              Hardcoded on purpose. These are the design's own colours, the
              way Sikky's cream spine is; a design whose entire character is a
              palette cannot take its palette from somewhere else. The brand
              accent still governs the table, the totals and the rest of the
              page — this is the header only.
            */}
            <svg
              aria-hidden="true"
              viewBox="0 0 200 46"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-x-0 top-0 h-[38px] w-full"
            >
              <path
                d="M0 40 Q50 6 100 22 T200 12"
                fill="none"
                stroke="#E8B4C6"
                strokeWidth="1.4"
              />
              <circle cx="44" cy="17" r="5" fill="#F3D3DD" />
              <circle cx="44" cy="17" r="2" fill="#D98BA6" />
              <circle cx="128" cy="18" r="4" fill="#F3D3DD" />
              <circle cx="166" cy="13" r="3" fill="#EFC6D5" />
            </svg>
            <div className="mt-[26px] flex flex-col items-center">
              {logo}
              <div className="mt-[6px] italic" style={{ color: '#7C4257' }}>
                <Name model={model} className="text-center" />
              </div>
            </div>
            {/* The title between two pink hairlines, as the reference rules it. */}
            <div className="mt-[9px] flex w-full items-center gap-[5px]">
              <span className="h-px flex-1" style={{ backgroundColor: '#F0D7E0' }} />
              <span
                className="shrink-0 whitespace-nowrap text-[15px] uppercase tracking-[0.25em]"
                style={{ color: '#B4577E' }}
              >
                {model.title}
              </span>
              <span className="h-px flex-1" style={{ backgroundColor: '#F0D7E0' }} />
            </div>
            <Ref model={model} className="text-center" />
          </header>
          {/*
            CENTRED, under the arch's short rule. This is the second design
            where a centred figure works: the arch closes over the identity
            and the rule gives the amount an axis to sit on. Everywhere else
            a centred amount reads as a heading.
          */}
          <div className="mt-[8px] flex justify-center">
            <Headline model={model} ink={ink} formatAmount={formatAmount} align="start" />
          </div>
        </>
      )

    /*
     * Sidebar, Wave and Aria put their mark on the whole page rather than on
     * the header, so the mark is drawn by `PageChrome` and the identity here
     * is the quiet arrangement that sits beside it.
     */
    /*
     * Sikky — §F: "coloured spine, BOXED OFFICE ADDRESS, centred underlined
     * title, Georgia". The spine and the face are drawn by `PageChrome`; the
     * box is here, because it belongs to the identity block.
     *
     * The box is drawn only when there is an address to put in it. An empty
     * bordered rectangle at the top of a customer's invoice reads as a
     * mistake, and Rule #1 means the address may always be missing.
     */
    case 'spine':
      return (
        <>
          {/*
            LOGO LEFT, OFFICE RIGHT, then the business beneath both — the
            reference's arrangement exactly.

            The address is ranged right against a single brand-coloured rule
            on its leading edge, not boxed on all four sides: the box competed
            with the cream spine down the page and made two frames out of one
            design. `OFFICE` names what the block is, which is the reason it
            reads as an address rather than as a stray second business.
          */}
          <header className="flex items-start justify-between gap-[16px]">
            <div className="shrink-0">{logo}</div>
            {model.branding.address !== undefined && model.branding.address.trim() !== '' && (
              <div
                className="max-w-[46%] shrink-0 ps-[6px] text-end text-[12.5px] leading-snug opacity-75"
                style={{ borderInlineStart: `2px solid ${ink}` }}
              >
                <p className="font-bold uppercase tracking-wide">{model.partyLabel}</p>
                <p data-business-address className="break-words">
                  {model.branding.address}
                </p>
              </div>
            )}
          </header>
          <div className="mt-[8px] flex items-end justify-between gap-[16px]">
            <p className="min-w-0 break-words text-[18px] font-bold leading-tight">
              {model.branding.name}
            </p>
            <Headline model={model} ink={ink} formatAmount={formatAmount} />
          </div>
          <h2
            className="mt-[12px] break-words text-center text-[24px] font-black uppercase tracking-[0.12em]"
            style={{ color: ink, textDecoration: 'underline', textUnderlineOffset: '4px' }}
          >
            {model.title}
          </h2>
          <Ref model={model} className="text-center" />
          <Rule ink={ink} />
        </>
      )

    /*
     * SIDEBAR — the identity lives IN the column.
     *
     * `PageChrome` paints the column; `SidebarIdentity` fills it.
     *
     * The column was EMPTY — a third of the paper tinted and holding nothing,
     * with the whole document squeezed into the remaining two thirds. That is
     * not a sidebar, it is a margin, and it was the sparsest thing in the set.
     *
     * The identity lives in the column now (logo, name, address, and how to
     * reach the business), which is what the name of the design promises and
     * what the legacy sheet does. The header keeps only what belongs across
     * the top of the page: the document's title, its reference, and the
     * figure. So the eye reads WHO down the edge and WHAT across the top,
     * and neither repeats the other.
     */
    case 'sidebar':
      return (
        <>
          <header className="flex items-start justify-between gap-[16px]">
            <div className="min-w-0 flex-1">
              <Title model={model} ink={ink} />
              <Ref model={model} className="mt-[2px]" />
            </div>
            <Headline model={model} ink={ink} formatAmount={formatAmount} />
          </header>
          <Rule ink={ink} height={3} />
        </>
      )

    /*
     * ARIA (frame) — centred inside the border, and NOTHING crosses it.
     *
     * The chrome draws a rule around the whole page, so a full-width bar
     * under the header would fight it. Instead the identity is centred and
     * closed by a short hairline the width of the title — a mark that sits
     * INSIDE the frame rather than competing with it — and the headline is
     * centred with it, which is the one design where a centred figure reads
     * correctly because the frame gives it an edge to be centred against.
     */
    case 'frame':
      return (
        <>
          {/*
            ARIA IS GOLD ON IVORY, and hardcoded for the same reason Bloom is
            pink: the palette IS the design. `#D9B48F` frames the page,
            `#C9A227` rules under the name, `#B08A3E` sets the title.

            The name is LETTER-SPACED WIDE and centred rather than set as an
            ordinary heading — the reference breaks it across two lines at
4.6px of tracking, which is what gives the design its stillness. Here
            it is one block with the tracking applied, so a business with a
            one-word name does not get a stranded second line.
          */}
          <header className="flex flex-col items-center text-center">
            {logo}
            <p
              className="mt-[8px] break-words text-[15px] uppercase leading-relaxed tracking-[0.34em]"
              style={{ color: '#3A3330' }}
            >
              {model.branding.name}
            </p>
            {model.branding.address !== undefined && model.branding.address.trim() !== '' && (
              <p
                data-business-address
                className="mt-[4px] break-words text-[12.5px] leading-snug opacity-60"
              >
                {model.branding.address}
              </p>
            )}
            <span className="mt-[7px] h-px w-[34px]" style={{ backgroundColor: '#C9A227' }} />
            <h2
              className="mt-[7px] break-words text-[15px] uppercase tracking-[0.32em]"
              style={{ color: '#B08A3E' }}
            >
              {model.title}
            </h2>
            <Ref model={model} className="text-center" />
          </header>
          <div className="mt-[9px] w-full" style={{ borderBottom: '1px solid #EFE3D2' }} />
          <div className="mt-[8px] flex justify-center">
            <Headline model={model} ink={ink} formatAmount={formatAmount} align="start" />
          </div>
        </>
      )

    /*
     * WAVE — the header rides the crest.
     *
     * The chrome sweeps a curve across the top of the page, so this one puts
     * the title and reference ABOVE the business rather than after it: the
     * type follows the shape down, title at the high edge and the identity
     * settling beneath it. Reversing that order is what makes the wave read
     * as part of the layout instead of a decoration behind it.
     */
    case 'wave':
      return (
        <>
          <header className="flex items-start justify-between gap-[16px]">
            <div className="shrink-0">{logo}</div>
            <div className="min-w-0 text-end">
              <Title model={model} ink={ink} />
              <Ref model={model} className="mt-[2px]" />
            </div>
          </header>
          <div className="mt-[14px] flex items-end justify-between gap-[16px]">
            <Name model={model} className="min-w-0 flex-1" />
            <Headline model={model} ink={ink} formatAmount={formatAmount} />
          </div>
          <Rule ink={ink} height={3} />
        </>
      )
  }
}

/* -------------------------------------------------------------- the chrome */

/**
 * The marks that run past the header: a column, a spine, a wave, a frame.
 *
 * Absolutely positioned behind the content, and `aria-hidden` to a one —
 * every one of them is decoration, and none carries a word. The page itself
 * is what a reader hears.
 */
export function PageChrome({
  template,
  ink,
  model,
  logo,
}: {
  template: TemplateDefinition
  ink: string
  /**
   * Sidebar's column holds the identity, so the chrome needs the words.
   *
   * Only Sidebar reads them. Every other mark here is pure decoration and
   * `aria-hidden` to a one — this is the one that is not, because a column
   * with a business name in it is content that happens to be positioned.
   */
  model: PageModel
  logo: ReactNode
}) {
  switch (template.headerStyle) {
    /*
     * Sidebar — a tinted column at the width the definition names, WITH THE
     * BUSINESS IN IT.
     *
     * Not `aria-hidden`: unlike the spine and the wave this one carries the
     * name, the address and the contact lines, and hiding them from a screen
     * reader would mean the one design where the identity is most prominent
     * is the one design where it is not announced at all.
     *
     * `zoom` is inherited from the content layer, so the sizes here are the
     * same absolute sizes the header uses and scale with it.
     */
    case 'sidebar':
      return (
        <div
          data-sidebar-column
          className="pointer-events-none absolute inset-y-0 start-0"
          style={{ width: `${template.sidebarPercent ?? 31}%` }}
        >
          {/*
            PALE PAPER AND A HAIRLINE, not a brand wash.

            This was the ink at 16%, which on a strong accent came out as a
            solid coloured third of the page — a block of colour with a
            business name sitting in it. The reference uses `#fbfbfd` with a
            single `1px solid #eee` on its inner edge: the column is a change
            of PAPER, and the rule is what says where it ends.

            Still its own layer rather than a background on the box that holds
            the words: `opacity` applies to a whole subtree, so the two have
            to stay separate whatever the fill is.
          */}
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{ backgroundColor: '#fbfbfd', borderInlineEnd: '1px solid #eee' }}
          />
          <div
            className="relative flex h-full flex-col gap-[16px] p-[9%]"
            style={{ zoom: 'calc(100cqi / 794px)' }}
          >
            {logo}
            <Name model={model} />
            <SidebarContact model={model} />
          </div>
        </div>
      )

    /*
     * Sikky — a CREAM spine down the leading edge, 10% wide.
     *
     * It was 7% of solid brand ink: a hard saturated bar against a white
     * page, which read as a printing error rather than as stationery. The
     * reference uses `#fdf0dc` — warm paper, not ink — which is what lets it
     * sit beside a Georgia setting without shouting over it.
     */
    case 'spine':
      return (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 start-0"
          style={{ width: '10%', backgroundColor: '#fdf0dc' }}
        />
      )

    /* Wave — a clean top, and an accent wave across the foot. */
    case 'wave':
      return (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{
            height: '16%',
            backgroundColor: ink,
            opacity: 0.8,
            borderTopLeftRadius: '80% 100%',
            borderTopRightRadius: '20% 60%',
          }}
        />
      )

    /* Aria — ivory inside a thin frame. */
    /* Aria — a gold rule inset from all four edges, on ivory. */
    case 'frame':
      return (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{ inset: '3%', border: '1px solid #D9B48F', borderRadius: '2px' }}
        />
      )

    default:
      return null
  }
}

/**
 * How far the body must stand clear of the chrome.
 *
 * Returned as a style object rather than a class, because `sidebarPercent` is
 * a number from the template definition — a runtime value Tailwind could not
 * have a class for, and the sort of thing that ships as nothing at all if it
 * is built into a class name (§F).
 */
export function contentInset(template: TemplateDefinition): {
  paddingInlineStart?: string
  paddingBottom?: string
  padding?: string
} {
  switch (template.headerStyle) {
    case 'sidebar':
      // Clear of the column, plus the page's own margin.
      return { paddingInlineStart: `${(template.sidebarPercent ?? 31) + 4}%` }
    case 'spine':
      return { paddingInlineStart: '13%' }
    case 'wave':
      /*
       * The foot belongs to the wave; the content stops above it.
       *
       * 26%, not 16%, and the difference is the whole trap: a PERCENTAGE
       * PADDING RESOLVES AGAINST WIDTH, while the wave's `height: 16%`
       * resolves against height. A4 is 1.414 times taller than it is wide, so
       * the wave really occupies 16 × 1.414 ≈ 23% of the width-based scale —
       * and an 18% padding left the signature rule sitting on top of it.
       * Found by looking at the page, not at the markup.
       */
      return { paddingBottom: '26%' }
    case 'frame':
      return { padding: '9%' }
    default:
      return {}
  }
}

/**
 * Whether the header has already presented the party and the dates.
 *
 * Compact's three-cell strip IS that block — the thumb shows it where the
 * party section would otherwise sit — so the page must not draw it a second
 * time. Caught by the test that walks all sixteen looking for the party
 * exactly once: the first version printed "Adeola Hardware" twice on a
 * Compact invoice, which reads as two different customers at a glance.
 */
export const headerCarriesParty = (template: TemplateDefinition): boolean =>
  template.headerStyle === 'condensed'

/** Every style the page knows how to draw — the list the tests walk. */
export const HEADER_STYLES: readonly HeaderStyle[] = [
  'rule',
  'band',
  'hairline',
  'split',
  'centred',
  'sidebar',
  'badge',
  'wave',
  'condensed',
  'spine',
  'gradient',
  'double-rule',
  'flourish',
  'diagonal',
  'arch',
  'frame',
]
