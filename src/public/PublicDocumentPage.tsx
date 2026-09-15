/**
 * The document, as the person holding the link sees it (§P, §V).
 *
 * The recipient's page used to be a list of fields: a heading, a card, a row
 * per line, then name, role and a pad — a long scroll in which the thing
 * being signed for never actually appeared. This is the page instead, at A4
 * proportions, above the signing controls.
 *
 * BUILT FROM THE LINK'S OWN PAYLOAD, not from `DocumentPage`. That component
 * needs a composed `PageModel` — branding, template, logo, frozen labels —
 * and this page deliberately sits ABOVE the providers: a stranger with a link
 * must never cause the owner's company, records or locale to load (§P). What
 * arrives from the edge function is what can be drawn, so this draws exactly
 * that and no more.
 *
 * The consequence, stated rather than hidden: this is the document's CONTENT
 * at the right proportions, not its chosen design. Serving the template and
 * brand assets would make it identical — see the note in PLAN.md, because
 * that is a decision about what an anonymous endpoint returns, not a layout
 * preference.
 *
 * It is `aria-hidden`: every word in it is repeated by the signing controls
 * below, in a form a reader can act on. Hearing the whole page twice is worse
 * than hearing it once.
 */

import type { PublicView } from './client'
import type { UiStrings } from '../domain/locale/data/strings'
import { QUANTITY_SCALE } from '../domain/documents/types'
import { formatMoney } from '../features/customers/formatMoney'
import { money } from '../domain/money/money'

/** 210 × 297, the one ratio every document in this app prints at (§I). */
const A4_ASPECT = 210 / 297

export function PublicDocumentPage({
  view,
  strings,
}: {
  readonly view: PublicView
  readonly strings: UiStrings
}) {
  const carriesMoney = view.total !== undefined

  return (
    <article
      aria-hidden="true"
      className="a4-sheet mx-auto w-full overflow-hidden bg-white"
      style={{
        aspectRatio: String(A4_ASPECT),
        // The page sets its own scale, so a phone's text setting cannot make
        // it clip — the same rule as the app's own preview (§V).
        fontSize: '16px',
        color: '#1d2452',
      }}
    >
      <div className="flex h-full flex-col p-[6%]">
        <header className="flex items-start justify-between gap-[16px]">
          <p className="min-w-0 break-words text-[18px] font-bold leading-tight">
            {view.businessName}
          </p>
          <h2 className="shrink-0 text-[20px] font-black uppercase tracking-tight">
            {view.title}
          </h2>
        </header>

        <div className="mt-[16px] h-[3px] w-full bg-current" />

        <section className="mt-[16px] flex justify-between gap-[24px] text-[12px]">
          <div className="min-w-0">
            <p className="font-bold uppercase tracking-wide opacity-60">{view.partyLabel}</p>
            <p className="font-semibold">{view.customerName}</p>
            {view.deliveryAddress !== null && (
              <p className="opacity-80">{view.deliveryAddress}</p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <p className="tabular-nums opacity-70">{view.reference}</p>
            {view.issueDate !== null && <p className="tabular-nums">{view.issueDate}</p>}
          </div>
        </section>

        <table className="mt-[16px] w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-current">
              <th className="pb-[4px] text-left font-bold uppercase tracking-wide">
                {carriesMoney ? strings.items.description : strings.items.goods}
              </th>
              <th className="pb-[4px] text-right font-bold uppercase tracking-wide">
                {strings.items.quantity}
              </th>
              {/* UNIT on a delivery, AMOUNT where there is money — never both. */}
              <th className="pb-[4px] text-right font-bold uppercase tracking-wide">
                {carriesMoney ? strings.totals.payable : strings.items.unit}
              </th>
            </tr>
          </thead>
          <tbody>
            {view.lines.map((line, index) => (
              <tr key={`${line.description}-${index}`} className="border-b border-current/10">
                <td className="py-[6px]">{line.description}</td>
                <td className="py-[6px] text-right tabular-nums">
                  {line.quantityMilli / QUANTITY_SCALE}
                </td>
                <td className="py-[6px] text-right tabular-nums">
                  {carriesMoney && line.unitPriceMinor !== undefined && view.total !== undefined
                    ? formatMoney(money(view.total.currency, line.unitPriceMinor))
                    : (line.unit ?? '')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {view.total !== undefined && (
          <p className="mt-[12px] text-end text-[14px] font-black tabular-nums">
            {formatMoney(money(view.total.currency, view.total.minor))}
          </p>
        )}

        {/*
          NO "received by" / "dispatched by" rules here, and their absence is
          deliberate rather than an omission.
          Both captions come from the terminology layer and freeze onto the
          document at issue (§D.2); the link's payload carries the party label
          and the title, not those two. Rendering them would mean inventing
          localisation for a page whose whole rule is that it shows only what
          the edge function sent. The recipient signs below, which is where
          "received by" actually happens on this page.
        */}
      </div>
    </article>
  )
}
