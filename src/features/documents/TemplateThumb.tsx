/**
 * A design's thumbnail, in the strip (§H).
 *
 * Sixteen cards that all showed the same blank rectangle would be sixteen
 * ways of saying nothing — the strip's whole job is letting somebody pick a
 * design without opening each one. So each thumb draws the SCHEMATIC of its
 * own header style: the band, the spine, the diagonal, the frame.
 *
 * It is a schematic and not a rendering, deliberately. A real miniature would
 * mean laying out sixteen documents to choose between them, on a phone, every
 * time this step opens — and at 57px tall the words would be unreadable grey
 * anyway. What a person actually recognises at that size is the SHAPE, which
 * is exactly what `headerStyle` names.
 *
 * Everything comes from the template definition — paper, ink, header style,
 * sidebar width — so a design added to `src/pdf/templates` gets a thumbnail
 * that matches it without anyone drawing one.
 */

import type { TemplateDefinition } from '../../pdf/templates'

export interface TemplateThumbProps {
  readonly template: TemplateDefinition
  /** The brand colour, for the designs that use it rather than a fixed ink. */
  readonly accent: string
}

export function TemplateThumb({ template, accent }: TemplateThumbProps) {
  const mark = template.usesBrandAccent ? accent : template.ink
  /** A body line: the grey text every design has under its header. */
  const line = (width: string, top: number) => (
    <span
      key={`${width}-${top}`}
      className="absolute block rounded-[1px]"
      style={{
        left: '14%',
        width,
        top: `${top}%`,
        height: '3.5%',
        backgroundColor: template.ink,
        opacity: 0.16,
      }}
    />
  )

  const body = [line('52%', 52), line('64%', 61), line('44%', 70), line('58%', 79)]

  return (
    <span
      aria-hidden="true"
      className="relative block w-full overflow-hidden rounded-[4px]"
      style={{
        aspectRatio: '1 / 1.414',
        backgroundColor: template.paper,
        boxShadow: `inset 0 0 0 0.5px ${template.ink}22`,
      }}
    >
      {header(template.headerStyle, mark, template)}
      {body}
    </span>
  )
}

/** The part that differs — one shape per §H design. */
function header(
  style: TemplateDefinition['headerStyle'],
  mark: string,
  template: TemplateDefinition,
) {
  const common = 'absolute block'

  switch (style) {
    // Classic — logo left, title right, a heavy rule beneath.
    case 'rule':
      return (
        <>
          <span className={common} style={{ left: '14%', top: '12%', width: '26%', height: '7%', backgroundColor: mark, opacity: 0.8 }} />
          <span className={common} style={{ left: '14%', right: '14%', top: '26%', height: '2.5%', backgroundColor: mark }} />
        </>
      )
    // Modern — one line, a 3px rule, then a grey band.
    case 'band':
      return (
        <>
          <span className={common} style={{ left: '14%', top: '12%', width: '40%', height: '6%', backgroundColor: mark, opacity: 0.8 }} />
          <span className={common} style={{ left: '14%', right: '14%', top: '22%', height: '2%', backgroundColor: mark }} />
          <span className={common} style={{ left: '14%', right: '14%', top: '29%', height: '9%', backgroundColor: template.ink, opacity: 0.1 }} />
        </>
      )
    // Minimal — a hairline, and a great deal of nothing.
    case 'hairline':
      return (
        <>
          <span className={common} style={{ left: '14%', top: '14%', width: '30%', height: '3%', backgroundColor: template.ink, opacity: 0.55 }} />
          <span className={common} style={{ left: '14%', right: '14%', top: '24%', height: '0.8%', backgroundColor: template.ink, opacity: 0.35 }} />
        </>
      )
    // Bold — split header, name on white, title on a block.
    case 'split':
      return (
        <>
          <span className={common} style={{ left: '14%', top: '11%', width: '30%', height: '10%', backgroundColor: template.ink, opacity: 0.12 }} />
          <span className={common} style={{ right: '14%', top: '11%', width: '28%', height: '10%', backgroundColor: mark }} />
          <span className={common} style={{ left: '14%', right: '14%', top: '25%', height: '3%', backgroundColor: mark }} />
        </>
      )
    // Elegant — centred, a diamond between two rules.
    case 'centred':
      return (
        <>
          <span className={common} style={{ left: '30%', right: '30%', top: '12%', height: '5%', backgroundColor: mark, opacity: 0.8 }} />
          <span className={common} style={{ left: '20%', right: '20%', top: '23%', height: '1%', backgroundColor: mark }} />
          <span className={common} style={{ left: '48%', top: '26%', width: '4%', height: '3%', backgroundColor: mark, transform: 'rotate(45deg)' }} />
          <span className={common} style={{ left: '20%', right: '20%', top: '32%', height: '1%', backgroundColor: mark }} />
        </>
      )
    // Sidebar — a tinted left column at its real width.
    case 'sidebar':
      return (
        <span
          className={common}
          style={{ left: 0, top: 0, bottom: 0, width: `${template.sidebarPercent ?? 31}%`, backgroundColor: mark, opacity: 0.16 }}
        />
      )
    // Executive — circle motif, title reversed out of a badge.
    case 'badge':
      return (
        <>
          <span className={common} style={{ right: '-6%', top: '-6%', width: '28%', height: '20%', borderRadius: '50%', backgroundColor: mark, opacity: 0.14 }} />
          <span className={common} style={{ left: '14%', top: '13%', width: '30%', height: '8%', borderRadius: '2px', backgroundColor: mark }} />
          <span className={common} style={{ left: '14%', right: '14%', top: '27%', height: '1.6%', backgroundColor: mark }} />
        </>
      )
    // Wave — clean top, an accent wave across the foot.
    case 'wave':
      return (
        <>
          <span className={common} style={{ left: '14%', top: '13%', width: '34%', height: '6%', backgroundColor: mark, opacity: 0.8 }} />
          <span
            className={common}
            style={{ left: 0, right: 0, bottom: 0, height: '16%', backgroundColor: mark, opacity: 0.8, borderTopLeftRadius: '80% 100%', borderTopRightRadius: '20% 60%' }}
          />
        </>
      )
    // Compact — one header line, then a three-cell strip.
    case 'condensed':
      return (
        <>
          <span className={common} style={{ left: '14%', right: '14%', top: '11%', height: '5%', backgroundColor: mark, opacity: 0.75 }} />
          {[0, 1, 2].map((cell) => (
            <span
              key={cell}
              className={common}
              style={{ left: `${14 + cell * 24.5}%`, width: '22%', top: '21%', height: '8%', backgroundColor: template.ink, opacity: 0.1 }}
            />
          ))}
        </>
      )
    // Sikky — a coloured spine down the left edge, boxed address.
    case 'spine':
      return (
        <>
          <span className={common} style={{ left: 0, top: 0, bottom: 0, width: '7%', backgroundColor: mark }} />
          <span className={common} style={{ right: '12%', top: '10%', width: '26%', height: '11%', border: `0.5px solid ${mark}`, opacity: 0.7 }} />
          <span className={common} style={{ left: '30%', right: '30%', top: '30%', height: '2%', backgroundColor: mark }} />
        </>
      )
    // Aurora — a full-bleed gradient band across the top.
    case 'gradient':
      return (
        <span
          className={common}
          style={{ left: 0, right: 0, top: 0, height: '26%', backgroundImage: `linear-gradient(120deg, ${mark}, ${mark}55)` }}
        />
      )
    // Ledger — faint accounting rules, a double rule under the header.
    case 'double-rule':
      return (
        <>
          <span className={common} style={{ left: '14%', top: '12%', width: '36%', height: '5%', backgroundColor: mark, opacity: 0.8 }} />
          <span className={common} style={{ left: '14%', right: '14%', top: '23%', height: '1.2%', backgroundColor: mark }} />
          <span className={common} style={{ left: '14%', right: '14%', top: '27%', height: '1.2%', backgroundColor: mark }} />
        </>
      )
    // Botanic — a fine leaf flourish top-right, centred serif.
    case 'flourish':
      return (
        <>
          <span className={common} style={{ right: '10%', top: '6%', width: '16%', height: '11%', borderRadius: '0 60% 0 60%', border: `0.5px solid ${mark}`, opacity: 0.6 }} />
          <span className={common} style={{ left: '28%', right: '28%', top: '16%', height: '5%', backgroundColor: mark, opacity: 0.7 }} />
          <span className={common} style={{ left: '22%', right: '22%', top: '27%', height: '0.8%', backgroundColor: mark, opacity: 0.6 }} />
        </>
      )
    // Prism — an angular diagonal cut across the header.
    case 'diagonal':
      return (
        <span
          className={common}
          style={{ left: 0, right: 0, top: 0, height: '30%', backgroundColor: mark, clipPath: 'polygon(0 0, 100% 0, 100% 55%, 0 100%)' }}
        />
      )
    // Bloom — a floral arch drawn across the top.
    case 'arch':
      return (
        <>
          <span
            className={common}
            style={{ left: '10%', right: '10%', top: '4%', height: '20%', borderRadius: '50% 50% 0 0', border: `1px solid ${mark}`, borderBottom: 'none', opacity: 0.55 }}
          />
          <span className={common} style={{ left: '32%', right: '32%', top: '26%', height: '4%', backgroundColor: mark, opacity: 0.7 }} />
        </>
      )
    // Aria — ivory inside a thin frame, a gold hairline under the name.
    case 'frame':
      return (
        <>
          <span className={common} style={{ inset: '5%', border: `0.5px solid ${mark}`, opacity: 0.6 }} />
          <span className={common} style={{ left: '26%', right: '26%', top: '16%', height: '4.5%', backgroundColor: mark, opacity: 0.75 }} />
          <span className={common} style={{ left: '30%', right: '30%', top: '25%', height: '0.8%', backgroundColor: mark }} />
        </>
      )
  }
}
