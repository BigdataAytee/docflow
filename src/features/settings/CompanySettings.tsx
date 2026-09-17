/**
 * Settings → Company & logo (§F, §G, §R).
 *
 * THE ORDER IS THE REFERENCE'S, top to bottom: the large logo holder, the
 * Upload / Create row, the business name and address card, NAME STYLE with
 * its live preview, LOGO SIZE, then PREFIXES two fields to a row. It was a
 * single flat form before, which said the same things in the wrong order and
 * left out the two that matter most — the logo itself, and the address.
 *
 * THE LOGO IS REAL NOW. `logoAssetId` had been on the company record, in both
 * schemas, read by Home's setup checklist and by the page composer — and
 * nothing in the app could set it. So the checklist carried a step that could
 * never be ticked and every document printed an empty white square. The
 * Upload button is the missing half.
 *
 * "Create with AI" is shown and DISABLED, with a line saying why. §N's rule
 * is that a capability which is not installed says so rather than offering a
 * control that does nothing; the offline logo engine is §Q Phase 6. An owner
 * who can see where it will be is better served than one who taps a button
 * and waits.
 *
 * §D is emphatic that "the user's configured prefixes always win" over
 * whatever a region suggests, so a prefix is a plain editable value with the
 * regional suggestion only as a placeholder.
 */

import { useRef, useState } from 'react'

import { useCompany } from '../../app/context'
import { DOCUMENT_TYPES, type DocumentType } from '../../domain/documents/types'
import { label as typeLabel, numberingPrefix } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { ACCEPTED, PhotoError, shrinkLogo } from '../photos/resize'

export const NAME_STYLES = ['classic', 'serif', 'stacked', 'ruled', 'monogram'] as const
export type NameStyle = (typeof NAME_STYLES)[number]

export const LOGO_SIZES = ['S', 'M', 'L'] as const
export type LogoSize = (typeof LOGO_SIZES)[number]

export interface CompanySettingsProps {
  readonly businessName: string
  readonly businessAddress: string
  /** The footer strip's three (§I). Each optional — Rule #1. */
  readonly businessPhone: string
  readonly businessEmail: string
  readonly businessWebsite: string
  readonly nameStyle: NameStyle
  readonly logoSize: LogoSize
  readonly prefixes: Partial<Record<DocumentType, string>>
  /** The logo already saved, shown rather than described. */
  readonly logoUrl?: string
  readonly onBusinessName: (value: string) => void
  readonly onBusinessAddress: (value: string) => void
  readonly onBusinessPhone: (value: string) => void
  readonly onBusinessEmail: (value: string) => void
  readonly onBusinessWebsite: (value: string) => void
  readonly onNameStyle: (style: NameStyle) => void
  readonly onLogoSize: (size: LogoSize) => void
  readonly onPrefix: (type: DocumentType, value: string) => void
  /** Called with a shrunk PNG data URL. Storing it is the caller's job. */
  readonly onLogo: (dataUrl: string) => void | Promise<void>
}

/** The holder's side in the panel, by chosen size — the printed ratio (§F). */
const HOLDER_SIDE: Record<LogoSize, number> = { S: 60, M: 76, L: 92 }

export function CompanySettings({
  businessName,
  businessAddress,
  businessPhone,
  businessEmail,
  businessWebsite,
  nameStyle,
  logoSize,
  prefixes,
  logoUrl,
  onBusinessName,
  onBusinessAddress,
  onBusinessPhone,
  onBusinessEmail,
  onBusinessWebsite,
  onNameStyle,
  onLogoSize,
  onPrefix,
  onLogo,
}: CompanySettingsProps) {
  const { profile, strings } = useCompany()
  const s = strings.settings

  const file = useRef<HTMLInputElement | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <section className="space-y-3 px-4 py-4">
      <h1 className="text-lg font-bold">{s.company}</h1>

      {/* ---------------------------------------------- the logo holder */}
      <section className="glass-solid rounded-2xl p-4 text-center">
        <div
          className="mx-auto flex items-center justify-center overflow-hidden rounded-[20px] bg-surface"
          style={{
            width: HOLDER_SIDE[logoSize],
            height: HOLDER_SIDE[logoSize],
            // Dashed while empty, solid once there is a mark to frame (§F).
            border: logoUrl === undefined ? '1.5px dashed currentColor' : '1px solid currentColor',
          }}
        >
          {logoUrl === undefined ? null : (
            <img
              src={logoUrl}
              alt=""
              // Never cropped, the same rule the printed holder follows (§F).
              className="max-h-full max-w-full object-contain p-1.5"
            />
          )}
        </div>
        {logoUrl === undefined && <p className="mt-2 text-xs opacity-60">{s.noLogoYet}</p>}

        <input
          ref={file}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          onChange={(event) => {
            const chosen = event.target.files?.[0]
            // Cleared, so choosing the SAME file twice still fires a change.
            event.target.value = ''
            if (chosen === undefined) return

            setProblem(null)
            setBusy(true)
            void shrinkLogo(chosen)
              .then((dataUrl) => onLogo(dataUrl))
              .catch((cause: unknown) => {
                setProblem(
                  cause instanceof PhotoError && cause.field === 'not_an_image'
                    ? s.logoUnreadable
                    : format(strings.photo.failed, {
                        reason: cause instanceof Error ? cause.message : String(cause),
                      }),
                )
              })
              .finally(() => setBusy(false))
          }}
        />

        <div className="mt-3 flex justify-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => file.current?.click()}
            className="glass-pill tap-scale min-h-tap rounded-full px-4 text-xs font-semibold text-brand disabled:opacity-40"
          >
            {logoUrl === undefined ? s.uploadLogo : s.replaceLogo}
          </button>
          {/*
            Present, and honestly out of service. Phase 6 builds the engine
            behind it; until then a control that did nothing would be worse
            than one that says why (§N).
          */}
          <button
            type="button"
            disabled
            aria-describedby="logo-ai-note"
            /*
             * Reads as OUT OF SERVICE, not as the primary action.
             *
             * It was the brand gradient at `opacity-40`, which on a phone
             * still looks like the filled, confident button on the panel —
             * next to a plain white "Upload" it read as the thing to press.
             * §N is not satisfied by a control being inert; it has to LOOK
             * inert, or the reason underneath is read as a caption rather
             * than as the explanation of why nothing happened.
             */
            className="min-h-tap cursor-not-allowed rounded-full border border-edge/10 bg-ink/[0.06] px-4 text-xs font-semibold text-ink/40"
          >
            {s.createLogo}
          </button>
        </div>
        <p id="logo-ai-note" className="mt-2 text-xs leading-relaxed opacity-60">
          {s.createLogoLater}
        </p>

        {problem !== null && (
          <p
            role="alert"
            className="mt-2 rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm font-medium text-status-warn"
          >
            {problem}
          </p>
        )}
      </section>

      {/* ------------------------------------------ name and address */}
      <section className="glass-solid space-y-2 rounded-2xl p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium opacity-70">{s.businessName}</span>
          <input
            value={businessName}
            onChange={(event) => onBusinessName(event.target.value)}
            aria-label={s.businessName}
            className="sunken min-h-tap w-full rounded-lg px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium opacity-70">{s.businessAddress}</span>
          <input
            value={businessAddress}
            onChange={(event) => onBusinessAddress(event.target.value)}
            aria-label={s.businessAddress}
            className="sunken min-h-tap w-full rounded-lg px-3 text-sm"
          />
        </label>

        {/*
          HOW A CUSTOMER REACHES THE BUSINESS (§I).

          These three print as the footer strip on every document — phone ·
          email · website, centred under a hairline. Every document the app
          produced ended in white space instead, which on a quotation means
          the one person who wants to reply has no way to.

          Each is optional and stays optional (Rule #1). The strip prints
          whichever are filled and does not appear at all when none are, so a
          business with only a phone number gets a phone number rather than
          two stranded separators.
        */}
        <label className="block">
          <span className="mb-1 block text-xs font-medium opacity-70">{s.businessPhone}</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={businessPhone}
            onChange={(event) => onBusinessPhone(event.target.value)}
            aria-label={s.businessPhone}
            className="sunken min-h-tap w-full rounded-lg px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium opacity-70">{s.businessEmail}</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={businessEmail}
            onChange={(event) => onBusinessEmail(event.target.value)}
            aria-label={s.businessEmail}
            className="sunken min-h-tap w-full rounded-lg px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium opacity-70">{s.businessWebsite}</span>
          <input
            type="url"
            inputMode="url"
            autoComplete="url"
            value={businessWebsite}
            onChange={(event) => onBusinessWebsite(event.target.value)}
            aria-label={s.businessWebsite}
            className="sunken min-h-tap w-full rounded-lg px-3 text-sm"
          />
        </label>
      </section>

      {/* ------------------------------------------------- name style */}
      <p className="px-1 text-xs font-bold uppercase tracking-wide opacity-60">{s.nameStyle}</p>
      <fieldset className="glass-solid rounded-2xl p-3">
        <legend className="sr-only">{s.nameStyle}</legend>
        {/* A strip that scrolls rather than wraps, so the five stay in order. */}
        <div className="flex gap-1.5 overflow-x-auto p-0.5">
          {NAME_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onNameStyle(style)}
              aria-pressed={style === nameStyle}
              className={`min-h-tap shrink-0 rounded-full px-3 text-xs font-semibold ${
                style === nameStyle ? 'bg-brand text-white' : 'bg-page'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
        {/* The name as it will print, in the chosen treatment. */}
        <div className="recessed mt-2.5 rounded-xl bg-surface p-2.5">
          <p
            className={`break-words text-lg font-bold ${
              nameStyle === 'serif' || nameStyle === 'stacked' ? 'font-serif' : ''
            } ${nameStyle === 'ruled' ? 'border-b-2 border-current pb-1' : ''} ${
              nameStyle === 'monogram' ? 'text-center' : ''
            }`}
            data-testid="name-preview"
          >
            {nameStyle === 'monogram'
              ? businessName.trim().charAt(0).toLocaleUpperCase()
              : businessName}
          </p>
        </div>
      </fieldset>

      {/* -------------------------------------------------- logo size */}
      <p className="px-1 text-xs font-bold uppercase tracking-wide opacity-60">{s.logoSize}</p>
      <fieldset className="glass-solid rounded-2xl p-3">
        <legend className="sr-only">{s.logoSize}</legend>
        <div className="flex gap-1.5">
          {LOGO_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onLogoSize(size)}
              aria-pressed={size === logoSize}
              className={`min-h-tap flex-1 rounded-xl px-3 text-xs font-bold ${
                size === logoSize ? 'bg-brand text-white' : 'bg-page'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </fieldset>

      {/* ---------------------------------------------------- prefixes */}
      <p className="px-1 text-xs font-bold uppercase tracking-wide opacity-60">
        {s.numberingPrefixes}
      </p>
      <section className="glass-solid rounded-2xl p-3">
        {/*
          Two to a row, as the reference has them, and `min-w-0` on each half
          so a long localised type name shrinks its own column rather than
          pushing the page sideways at 200% text (§S).
        */}
        <div className="flex flex-wrap gap-2">
          {DOCUMENT_TYPES.map((type) => (
            <label key={type} className="min-w-0 basis-[calc(50%-0.25rem)]">
              <span className="mb-1 block truncate text-xs font-medium opacity-70">
                {typeLabel(profile, type)}
              </span>
              <input
                value={prefixes[type] ?? ''}
                // The region's suggestion is a hint, never an imposed value (§D).
                placeholder={numberingPrefix(profile, type)}
                onChange={(event) => onPrefix(type, event.target.value)}
                aria-label={typeLabel(profile, type)}
                className="sunken min-h-tap w-full rounded-lg px-3 text-sm uppercase"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs opacity-60">{s.prefixHint}</p>
      </section>
    </section>
  )
}
