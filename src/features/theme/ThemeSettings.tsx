/**
 * Settings → Dark mode (§G: "Dark mode" in "You and your data").
 *
 * Three plain choices in a row, `system` first because it is the default and
 * the one most people should leave alone.
 */

import { useCompany } from '../../app/context'
import { THEME_CHOICES, type ThemeChoice } from './theme'

export interface ThemeSettingsProps {
  readonly choice: ThemeChoice
  readonly onChoice: (choice: ThemeChoice) => void
}

export function ThemeSettings({ choice, onChoice }: ThemeSettingsProps) {
  const { strings } = useCompany()
  const label: Record<ThemeChoice, string> = {
    system: strings.settings.themeSystem,
    light: strings.settings.themeLight,
    dark: strings.settings.themeDark,
  }

  return (
    <section className="rounded-2xl bg-surface/70 p-4 backdrop-blur" aria-label={strings.settings.theme}>
      <p className="text-sm font-semibold">{strings.settings.theme}</p>
      <p className="mt-0.5 text-xs opacity-70">{strings.settings.themeHint}</p>

      <div className="mt-3 flex gap-2" role="radiogroup" aria-label={strings.settings.theme}>
        {THEME_CHOICES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={choice === value}
            onClick={() => onChoice(value)}
            className={`min-h-tap min-w-0 flex-1 rounded-full px-3 text-sm font-semibold ${
              choice === value ? 'bg-brand text-white' : 'bg-ink/[0.06]'
            }`}
          >
            {label[value]}
          </button>
        ))}
      </div>
    </section>
  )
}
