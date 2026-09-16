/**
 * Settings → Legal (§P, §T).
 *
 * The privacy policy, the terms and the storage note, in the app rather than
 * only on a website. Both stores require a reachable privacy policy, and a
 * link that opens a browser is the wrong answer for an app whose whole premise
 * is that it works with the radios off — §V's rule that nothing needed to open
 * a saved document touches a CDN applies just as well to the document that
 * says what happens to the records.
 *
 * ONE SCREEN, THREE DISCLOSURES, and the same interaction the FAQ already
 * uses: a person looking for one paragraph should not have to leave and come
 * back. `aria-expanded` on each heading, the body in the document rather than
 * swapped in and out, so a screen reader moving by heading finds the same
 * three either way.
 *
 * The text comes from `src/legal/documents.ts`, which is generated from the
 * data inventory — so this file renders a policy it cannot contradict.
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { Icon } from '../../ui'
import { LEGAL_DOCUMENTS, type LegalDocument } from '../../legal/documents'
import { unfilled } from '../../legal/placeholders'

/**
 * The tiny subset of Markdown these documents use: `##` headings, `-` lists,
 * `**bold**` and blank-line paragraphs.
 *
 * Hand-rolled rather than a dependency, because adding a Markdown parser to
 * render three documents this app wrote itself would be a library shipped to
 * every user for one screen — and `documents.ts` is the only thing that ever
 * feeds it, so the input is known rather than arbitrary.
 */
function Body({ text }: { readonly text: string }) {
  const blocks = text.split(/\n{2,}/)

  return (
    <div className="mt-2 space-y-2.5">
      {blocks.map((block, index) => {
        const key = `${index}-${block.slice(0, 24)}`

        if (block.startsWith('## ')) {
          return (
            <h3 key={key} className="pt-1.5 text-[12.5px] font-bold">
              {block.slice(3)}
            </h3>
          )
        }

        if (block.startsWith('- ')) {
          return (
            <ul key={key} className="list-disc space-y-1.5 ps-5">
              {block.split('\n').map((line) => (
                <li key={line} className="text-[11.5px] leading-relaxed opacity-80">
                  <Emphasised text={line.replace(/^- /, '')} />
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={key} className="text-[11.5px] leading-relaxed opacity-80">
            <Emphasised text={block.replace(/\n/g, ' ')} />
          </p>
        )
      })}
    </div>
  )
}

/** `**bold**` and `` `code` ``, which is the whole of the inline vocabulary. */
function Emphasised({ text }: { readonly text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, index) => {
        const key = `${index}-${part.slice(0, 16)}`
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={key} className="font-semibold opacity-100">
              {part.slice(2, -2)}
            </strong>
          )
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={key} className="rounded bg-page px-1 text-[11px]">
              {part.slice(1, -1)}
            </code>
          )
        }
        return <span key={key}>{part}</span>
      })}
    </>
  )
}

export function LegalSettings({
  documents = LEGAL_DOCUMENTS,
}: {
  readonly documents?: readonly LegalDocument[]
}) {
  const { strings } = useCompany()
  const [open, setOpen] = useState<string | null>(null)

  // Never hidden from the owner: a document still carrying a token has not
  // been finished, and finding that out in an app store review is worse than
  // seeing it here. It is a build-time fact, not a runtime one.
  const pending = [...new Set(documents.flatMap((document) => unfilled(document.body)))]

  return (
    <section className="space-y-3 px-4 py-4">
      <h1 className="text-lg font-bold">{strings.settings.legal}</h1>

      {pending.length > 0 && (
        <p
          role="status"
          className="rounded-2xl bg-status-warn-tint px-3 py-2.5 text-xs leading-relaxed text-status-warn"
        >
          {strings.settings.legalUnfinished}
        </p>
      )}

      <ul className="glass-solid divide-y divide-ink/10 overflow-hidden rounded-2xl">
        {documents.map((document) => (
          <li key={document.id}>
            <button
              type="button"
              aria-expanded={open === document.id}
              onClick={() => setOpen((current) => (current === document.id ? null : document.id))}
              className="flex min-h-tap w-full items-start gap-3 px-3.5 py-3 text-start"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold">{document.title}</span>
                {open === document.id && <Body text={document.body} />}
              </span>
              <span
                aria-hidden="true"
                className={`mt-0.5 shrink-0 opacity-35 motion-safe:transition-transform ${
                  open === document.id ? 'rotate-90' : ''
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
