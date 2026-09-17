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
        className="mt-[3px] break-words text-[9.5px] leading-snug opacity-65"
      >
        {model.branding.address}
      </p>
    )}
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
    <p className={`text-[12px] tabular-nums opacity-70 ${className}`}>{model.reference}</p>
    {model.replacesLine !== null && (
      <p className={`text-[12px] font-semibold opacity-80 ${className}`}>{model.replacesLine}</p>
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

export function DocumentHeader({ model, template, ink, logo }: DocumentHeaderProps) {
  const style = template.headerStyle

  switch (style) {
    /* Classic — logo left, identity right, a heavy rule beneath. */
    case 'rule':
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
          <Rule ink={ink} />
        </>
      )

    /*
     * Modern — name, a rule, then the title reversed out of a tinted band.
     * The thumb's third shape is that band, and it is why the title moves
     * BELOW the rule here rather than sitting above it.
     */
    case 'band':
      return (
        <>
          <header className="flex items-start gap-[16px]">
            {logo}
            <div className="min-w-0 flex-1">
              <Name model={model} />
              <Ref model={model} />
            </div>
          </header>
          <Rule ink={ink} height={2} />
          <div
            className="mt-[8px] flex items-baseline justify-between gap-[16px] px-[12px] py-[8px]"
            style={{ backgroundColor: `${ink}1a` }}
          >
            <Title model={model} ink={ink} />
            <p className="text-[12px] tabular-nums opacity-70">{model.issueDate}</p>
          </div>
        </>
      )

    /* Minimal — a hairline, and a great deal of nothing. */
    case 'hairline':
      return (
        <>
          <header className="flex items-start gap-[16px]">
            {logo}
            <div className="min-w-0 flex-1">
              <Name model={model} className="text-[16px] font-semibold opacity-80" />
              <Title model={model} ink={ink} className="mt-[4px] text-[20px] font-medium tracking-normal" />
              <Ref model={model} />
            </div>
          </header>
          <Rule ink={ink} opacity={0.25} height={1} />
        </>
      )

    /*
     * Bold — a split header: the name on a tinted block, the title reversed
     * out of a solid one, and an accent rule under both.
     */
    case 'split':
      return (
        <>
          <header className="flex items-stretch gap-[12px]">
            <div
              className="flex min-w-0 flex-1 items-center gap-[12px] px-[12px] py-[8px]"
              style={{ backgroundColor: `${template.ink}1f` }}
            >
              {logo}
              <div className="min-w-0">
                <Name model={model} />
                <Ref model={model} />
              </div>
            </div>
            <div
              className="flex shrink-0 items-center px-[16px]"
              style={{ backgroundColor: ink }}
            >
              {/* Reversed out, so the title reads on the block (§F). */}
              <Title model={model} ink={template.paper} />
            </div>
          </header>
          <Rule ink={ink} />
        </>
      )

    /* Elegant — centred, a diamond between two rules. */
    case 'centred':
      return (
        <>
          <header className="flex flex-col items-center text-center">
            {logo}
            <Name model={model} className="mt-[8px]" />
            <Title model={model} ink={ink} className="mt-[4px]" />
            <Ref model={model} className="text-center" />
          </header>
          <div className="mt-[16px] flex items-center gap-[8px] px-[10%]">
            <div className="h-px flex-1" style={{ backgroundColor: ink }} />
            <div
              className="h-[8px] w-[8px] rotate-45"
              style={{ backgroundColor: ink }}
              aria-hidden="true"
            />
            <div className="h-px flex-1" style={{ backgroundColor: ink }} />
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
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-[40%] end-[-8%] h-[128px] w-[128px] rounded-full"
              style={{ backgroundColor: ink, opacity: 0.14 }}
            />
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
          <div className="mt-[8px] grid grid-cols-3 gap-[8px] text-[10px]">
            {[
              [model.partyLabel, model.party.name],
              ['', model.reference],
              ['', model.issueDate],
            ].map(([label, value], cell) => (
              <div
                key={cell}
                className="px-[8px] py-[4px]"
                style={{ backgroundColor: `${template.ink}14` }}
              >
                {label !== '' && <p className="font-bold uppercase opacity-60">{label}</p>}
                <p className="truncate font-medium">{value}</p>
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
          <Rule ink={ink} height={2} />
          <div className="mt-[4px] w-full" style={{ backgroundColor: ink, height: '2px' }} />
        </>
      )

    /* Botanic — a leaf flourish at the corner, centred beneath it. */
    case 'flourish':
      return (
        <>
          <header className="relative flex flex-col items-center text-center">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute end-0 top-0 h-14 w-[80px]"
              style={{
                border: `1px solid ${ink}`,
                borderRadius: '0 60% 0 60%',
                opacity: 0.6,
              }}
            />
            {logo}
            <Name model={model} className="mt-[8px]" />
            <Title model={model} ink={ink} className="mt-[4px]" />
            <Ref model={model} className="text-center" />
          </header>
          <div
            className="mx-[8%] mt-[16px]"
            style={{ backgroundColor: ink, opacity: 0.6, height: '1px' }}
          />
        </>
      )

    /* Prism — an angular cut across the header, identity reversed out. */
    case 'diagonal':
      return (
        <header
          className="-mx-[6%] -mt-[6%] mb-[16px] flex items-start gap-[16px] px-[6%] pb-[40px] pt-[6%]"
          style={{
            backgroundColor: ink,
            clipPath: 'polygon(0 0, 100% 0, 100% 72%, 0 100%)',
          }}
        >
          {logo}
          <div className="min-w-0 flex-1" style={{ color: template.paper }}>
            <Name model={model} />
            <Title model={model} ink={template.paper} className="mt-[4px]" />
            <Ref model={model} />
          </div>
        </header>
      )

    /* Bloom — an arch drawn over a centred identity. */
    case 'arch':
      return (
        <>
          <header className="relative flex flex-col items-center pt-[8px] text-center">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[8%] top-0 h-[96px]"
              style={{
                border: `1px solid ${ink}`,
                borderBottom: 'none',
                borderRadius: '50% 50% 0 0',
                opacity: 0.55,
              }}
            />
            {logo}
            <Name model={model} className="mt-[8px]" />
            <Title model={model} ink={ink} className="mt-[4px]" />
            <Ref model={model} className="text-center" />
          </header>
          <div className="mx-[28%] mt-[16px]" style={{ backgroundColor: ink, opacity: 0.7, height: '2px' }} />
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
          <header className="flex items-start gap-[16px]">
            {logo}
            <div className="min-w-0 flex-1">
              <Name model={model} />
              {model.branding.address !== undefined && (
                <p
                  className="mt-[6px] inline-block break-words px-[8px] py-[4px] text-[11px] leading-snug opacity-80"
                  style={{ border: `1px solid ${ink}` }}
                >
                  {model.branding.address}
                </p>
              )}
            </div>
          </header>
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

    case 'sidebar':
    case 'frame':
    case 'wave':
      return (
        <>
          <header className="flex items-start gap-[16px]">
            {logo}
            <div className="min-w-0 flex-1">
              <Name model={model} className={style === 'frame' ? 'text-center' : ''} />
              <Title
                model={model}
                ink={ink}
                className={`mt-[4px] ${style === 'frame' ? 'text-center' : ''}`}
              />
              <Ref model={model} className={style === 'frame' ? 'text-center' : ''} />
            </div>
          </header>
          {/* Aria's gold hairline under the name; the others keep a plain rule. */}
          <Rule ink={ink} height={style === 'frame' ? 1 : 3} opacity={style === 'frame' ? 0.8 : 1} />
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
export function PageChrome({ template, ink }: { template: TemplateDefinition; ink: string }) {
  switch (template.headerStyle) {
    /* Sidebar — a tinted left column at the width the definition names. */
    case 'sidebar':
      return (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 start-0"
          style={{
            width: `${template.sidebarPercent ?? 31}%`,
            backgroundColor: ink,
            opacity: 0.16,
          }}
        />
      )

    /* Sikky — a solid spine down the leading edge. */
    case 'spine':
      return (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 start-0"
          style={{ width: '7%', backgroundColor: ink }}
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
    case 'frame':
      return (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{ inset: '3%', border: `1px solid ${ink}`, opacity: 0.6 }}
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
