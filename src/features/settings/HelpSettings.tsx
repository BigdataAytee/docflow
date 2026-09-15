/**
 * Settings → Help & support (§G, and the reference's `settings-vhelp`).
 *
 * §G ends its Settings list with "Help & support (WhatsApp + FAQ)", and the
 * reference has exactly that: a support card, then a list of questions that
 * open in place.
 *
 * THE ANSWERS ARE ABOUT THIS APP, and each one is a rule the codebase
 * actually enforces — offline-first, automatic overdue, issued documents
 * locked. That is the only kind of answer worth shipping: a FAQ that
 * describes behaviour the build does not have is a support burden rather than
 * support. They live in the strings catalogue like every other sentence, so a
 * translated build translates them too (§S).
 *
 * THE SUPPORT CARD IS ABSENT UNTIL THERE IS A NUMBER — see `contact.ts`. An
 * owner with a problem is the last person who should be handed a link that
 * goes nowhere.
 *
 * Expanding uses `aria-expanded` on the question and keeps the answer in the
 * document rather than swapping text in and out, so a screen reader moving by
 * heading finds the same list either way.
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { Icon } from '../../ui'
import { supportWhatsApp, whatsAppLink } from '../support/contact'

export function HelpSettings() {
  const { strings } = useCompany()
  const h = strings.help

  const [open, setOpen] = useState<number | null>(null)
  const digits = supportWhatsApp()

  return (
    <section className="space-y-3 px-4 py-4">
      <h1 className="text-lg font-bold">{h.title}</h1>

      {digits !== undefined && (
        <a
          href={whatsAppLink(digits)}
          target="_blank"
          rel="noreferrer"
          className="glass-solid flex min-h-tap items-center gap-3 rounded-2xl p-3.5"
        >
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-status-good-tint text-status-good"
          >
            <Icon name="brand-whatsapp" size={0.95} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-semibold">{h.chatWithSupport}</span>
            <span className="mt-0.5 block text-[10px] opacity-55">{h.onWhatsApp}</span>
          </span>
          <span aria-hidden="true" className="shrink-0 opacity-35">
            <Icon name="chevron-right" size={0.9} />
          </span>
        </a>
      )}

      <ul className="glass-solid divide-y divide-ink/10 overflow-hidden rounded-2xl">
        {h.faq.map((entry, index) => (
          <li key={entry.question}>
            <button
              type="button"
              aria-expanded={open === index}
              onClick={() => setOpen((current) => (current === index ? null : index))}
              className="flex min-h-tap w-full items-start gap-3 px-3.5 py-3 text-start"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium">{entry.question}</span>
                {open === index && (
                  <span className="mt-1.5 block text-[11px] leading-relaxed opacity-65">
                    {entry.answer}
                  </span>
                )}
              </span>
              <span
                aria-hidden="true"
                className={`mt-0.5 shrink-0 opacity-35 transition-transform ${
                  open === index ? 'rotate-90' : ''
                }`}
              >
                <Icon name="chevron-right" size={0.9} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
