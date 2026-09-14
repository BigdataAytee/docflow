/**
 * Settings → Company & logo (§G).
 *
 * "Name style — Classic, Serif, Stacked, Ruled, Monogram — with live preview;
 * logo size S/M/L; four numbering prefixes."
 *
 * §D is emphatic that "the user's configured prefixes always win" over
 * whatever a region suggests, so the field is a plain editable value with the
 * regional suggestion only as a placeholder.
 */

import { useCompany } from '../../app/context'
import { DOCUMENT_TYPES, type DocumentType } from '../../domain/documents/types'
import { label as typeLabel, numberingPrefix } from '../../domain/locale/profile'

export const NAME_STYLES = ['classic', 'serif', 'stacked', 'ruled', 'monogram'] as const
export type NameStyle = (typeof NAME_STYLES)[number]

export const LOGO_SIZES = ['S', 'M', 'L'] as const
export type LogoSize = (typeof LOGO_SIZES)[number]

export interface CompanySettingsProps {
  readonly businessName: string
  readonly nameStyle: NameStyle
  readonly logoSize: LogoSize
  readonly prefixes: Partial<Record<DocumentType, string>>
  readonly onBusinessName: (value: string) => void
  readonly onNameStyle: (style: NameStyle) => void
  readonly onLogoSize: (size: LogoSize) => void
  readonly onPrefix: (type: DocumentType, value: string) => void
}

export function CompanySettings({
  businessName,
  nameStyle,
  logoSize,
  prefixes,
  onBusinessName,
  onNameStyle,
  onLogoSize,
  onPrefix,
}: CompanySettingsProps) {
  const { profile, strings } = useCompany()

  return (
    <section className="space-y-4 px-4 py-4">
      <h1 className="text-lg font-bold">{strings.settings.company}</h1>

      <label className="glass-solid block rounded-2xl p-4">
        <span className="mb-1 block text-xs font-medium opacity-70">
          {strings.settings.businessName}
        </span>
        <input
          value={businessName}
          onChange={(event) => onBusinessName(event.target.value)}
          aria-label={strings.settings.businessName}
          className="sunken min-h-tap w-full rounded-lg px-3 text-sm"
        />
      </label>

      <fieldset className="glass-solid rounded-2xl p-4">
        <legend className="text-xs font-bold uppercase tracking-wide opacity-60">
          {strings.settings.nameStyle}
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {NAME_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onNameStyle(style)}
              aria-pressed={style === nameStyle}
              className={`min-h-tap rounded-full px-3 text-xs font-semibold ${
                style === nameStyle ? 'bg-brand text-white' : 'bg-page'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
        {/* Live preview — the name as it will print. */}
        <p
          className={`mt-3 break-words text-lg font-bold ${
            nameStyle === 'serif' || nameStyle === 'stacked' ? 'font-serif' : ''
          }`}
          data-testid="name-preview"
        >
          {nameStyle === 'monogram'
            ? businessName.trim().charAt(0).toLocaleUpperCase()
            : businessName}
        </p>
      </fieldset>

      <fieldset className="glass-solid rounded-2xl p-4">
        <legend className="text-xs font-bold uppercase tracking-wide opacity-60">
          {strings.settings.logoSize}
        </legend>
        <div className="mt-2 flex gap-2">
          {LOGO_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onLogoSize(size)}
              aria-pressed={size === logoSize}
              className={`min-h-tap min-w-tap rounded-full px-3 text-xs font-bold ${
                size === logoSize ? 'bg-brand text-white' : 'bg-page'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </fieldset>

      <section className="glass-solid space-y-3 rounded-2xl p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide opacity-60">
          {strings.settings.numberingPrefixes}
        </h2>
        {DOCUMENT_TYPES.map((type) => (
          <label key={type} className="flex items-center justify-between gap-3">
            <span className="text-sm opacity-70">{typeLabel(profile, type)}</span>
            <input
              value={prefixes[type] ?? ''}
              // The region's suggestion is a hint, never an imposed value (§D).
              placeholder={numberingPrefix(profile, type)}
              onChange={(event) => onPrefix(type, event.target.value)}
              aria-label={typeLabel(profile, type)}
              // `w-24` is rem-based, so at 200% text it is 192px in a 390px
              // row and pushes the page sideways. The cap keeps it a
              // proportion of the row it sits in.
              className="sunken min-h-tap w-24 max-w-[45%] shrink rounded-lg px-3 text-end text-sm uppercase"
            />
          </label>
        ))}
        <p className="text-xs opacity-60">{strings.settings.prefixHint}</p>
      </section>
    </section>
  )
}
