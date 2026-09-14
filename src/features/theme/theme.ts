/**
 * Dark mode (§G Settings, §V, §F).
 *
 * Three states, not two. "Dark" and "light" are choices; **"system" is the
 * default and is not a third colour scheme** — it is the absence of a choice,
 * which is what almost everybody wants and what §G means by "Dark mode
 * (follows the phone)". An app that defaults to light ignores a preference
 * its owner already expressed to their phone, once, for everything.
 *
 * The choice is per DEVICE, not per company: it is about the screen in
 * somebody's hand and the light in the room, and two people sharing a company
 * do not share either. So it never goes near the sync outbox.
 */

export type ThemeChoice = 'system' | 'light' | 'dark'
export type Scheme = 'light' | 'dark'

export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark']

const KEY = 'docflow.theme'

export const isThemeChoice = (value: unknown): value is ThemeChoice =>
  typeof value === 'string' && (THEME_CHOICES as readonly string[]).includes(value)

/**
 * What was chosen, or `system` when nothing was.
 *
 * Storage can throw — a private window, blocked site data — and a theme is
 * never worth a crash, so a failure reads as "no choice" and the phone
 * decides.
 */
export function storedChoice(storage?: Pick<Storage, 'getItem'>): ThemeChoice {
  try {
    const value = (storage ?? globalThis.localStorage)?.getItem(KEY)
    return isThemeChoice(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export function storeChoice(choice: ThemeChoice, storage?: Pick<Storage, 'setItem'>): void {
  try {
    ;(storage ?? globalThis.localStorage)?.setItem(KEY, choice)
  } catch {
    // A theme that cannot be remembered still works for this session.
  }
}

/** The scheme a choice resolves to, given what the phone says. */
export const schemeFor = (choice: ThemeChoice, prefersDark: boolean): Scheme =>
  choice === 'system' ? (prefersDark ? 'dark' : 'light') : choice

/** Tailwind's `darkMode: 'class'` strategy, applied to the document root. */
export function applyScheme(scheme: Scheme, root?: { classList: DOMTokenList }): void {
  const element = root ?? globalThis.document?.documentElement
  if (element === undefined || element === null) return
  element.classList.toggle('dark', scheme === 'dark')
}

export const prefersDark = (): boolean =>
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
