/**
 * The bundled icon set (§F — "Tabler icon set, bundled").
 *
 * Path data is transcribed from the Tabler Icons project (MIT, © Paweł
 * Kuna), which the licence permits and the manifest records. It is inlined
 * rather than installed for two reasons §F cares about more than convenience:
 * nothing in the installed app may reach a CDN, and the app has to open on a
 * 3GB phone — so the seventeen glyphs this app actually draws ship as ~2KB of
 * path data instead of a package with five thousand of them in it.
 *
 * Every icon is DECORATION. It carries `aria-hidden`, has no title, and never
 * supplies an accessible name; the control around it does that, in the active
 * language. An icon that names itself is an icon that names itself in English
 * — which is exactly the bug §D exists to prevent, and the reason the four
 * unlabelled nav tiles of §F are safe to leave unlabelled on screen.
 *
 * No display text lives here, and no type name: `TYPE_PALETTE` already fixes
 * an icon to each internal type (§F), and this module only knows how to draw
 * the shape it is handed.
 */

/** Every glyph the app draws. A name that is not here is a type error. */
export type IconName =
  | 'home'
  | 'users'
  | 'chart-bar'
  | 'settings'
  | 'file-invoice'
  | 'file-check'
  | 'receipt'
  | 'truck-delivery'
  | 'plus'
  | 'search'
  | 'microphone'
  | 'camera'
  | 'logout'
  | 'photo'
  | 'x'
  | 'chevron-right'
  | 'arrow-left'
  | 'hash'
  | 'user'
  | 'credit-card'
  | 'signature'
  | 'pencil'
  | 'calendar'
  | 'package'
  | 'list'
  | 'trash'
  | 'calculator'
  | 'cash'
  | 'bell'
  | 'repeat'
  | 'check'
  | 'brand-whatsapp'
  | 'alert-triangle'
  | 'building'
  | 'percentage'
  | 'moon'
  | 'text-size'
  | 'refresh'
  | 'shield'
  | 'help'
  | 'language'

/**
 * The 24×24 stroke paths, in Tabler's own coordinate space.
 *
 * Stroke-only, no fills: that is what lets one glyph sit on a blue header,
 * on a white card and on a dark page without a second copy, because
 * `currentColor` does all of it.
 */
const PATHS: Readonly<Record<IconName, readonly string[]>> = {
  home: [
    'M5 12l-2 0l9 -9l9 9l-2 0',
    'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7',
    'M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6',
  ],
  users: [
    'M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
    'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
    'M16 3.13a4 4 0 0 1 0 7.75',
    'M21 21v-2a4 4 0 0 0 -3 -3.85',
  ],
  'chart-bar': [
    'M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z',
    'M9 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z',
    'M15 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z',
    'M4 20h14',
  ],
  settings: [
    'M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z',
    'M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0',
  ],
  'file-invoice': [
    'M14 3v4a1 1 0 0 0 1 1h4',
    'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z',
    'M9 7l1 0',
    'M9 13l6 0',
    'M13 17l2 0',
  ],
  'file-check': [
    'M14 3v4a1 1 0 0 0 1 1h4',
    'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z',
    'M9 15l2 2l4 -4',
  ],
  receipt: [
    'M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2z',
    'M9 7l6 0',
    'M9 11l6 0',
    'M9 15l4 0',
  ],
  'truck-delivery': [
    'M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5',
  ],
  plus: ['M12 5l0 14', 'M5 12l14 0'],
  search: ['M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'M21 21l-6 -6'],
  microphone: [
    'M9 2m0 3a3 3 0 0 1 3 -3a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3a3 3 0 0 1 -3 -3z',
    'M5 10a7 7 0 0 0 14 0',
    'M8 21l8 0',
    'M12 17l0 4',
  ],
  camera: [
    'M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2',
    'M12 13m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  ],
  logout: [
    'M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2',
    'M9 12h12l-3 -3',
    'M18 15l3 -3',
  ],
  photo: [
    'M15 8h.01',
    'M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z',
    'M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5',
    'M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3',
  ],
  x: ['M18 6l-12 12', 'M6 6l12 12'],
  'chevron-right': ['M9 6l6 6l-6 6'],
  'arrow-left': ['M5 12l14 0', 'M5 12l6 6', 'M5 12l6 -6'],
  hash: ['M5 9l14 0', 'M5 15l14 0', 'M11 4l-4 16', 'M17 4l-4 16'],
  user: [
    'M8 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
    'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
  ],
  'credit-card': [
    'M3 5m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z',
    'M3 10l18 0',
    'M7 15l.01 0',
    'M11 15l2 0',
  ],
  building: [
    'M3 21l18 0',
    'M9 8l1 0',
    'M9 12l1 0',
    'M9 16l1 0',
    'M14 8l1 0',
    'M14 12l1 0',
    'M14 16l1 0',
    'M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16',
  ],
  percentage: [
    'M17 17m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
    'M7 7m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
    'M6 18l12 -12',
  ],
  moon: ['M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z'],
  'text-size': ['M3 7v-2h13v2', 'M10 5v14', 'M12 19h-4', 'M15 13v-1h6v1', 'M18 12v7', 'M17 19h2'],
  refresh: [
    'M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4',
    'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4',
  ],
  shield: [
    'M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3',
  ],
  help: [
    'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    'M12 17l0 .01',
    'M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4',
  ],
  language: [
    'M4 5h7',
    'M9 3v2c0 4.418 -2.239 8 -5 8',
    'M5 9c0 2.144 2.952 3.908 6.7 4',
    'M12 20l4 -9l4 9',
    'M19.1 18h-6.2',
  ],
  signature: [
    'M3 17c3.333 -3.333 5 -6 5 -8c0 -3 -1 -3 -2 -3s-2.032 1.085 -2 3c.034 2.048 1.658 4.877 2.5 6c1.5 2 2.5 2.5 3.5 1l2 -3c.333 2.667 1.333 4 3 4c.53 0 2.639 -2 3 -2c.517 0 1.517 .667 3 2',
  ],
  pencil: ['M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4', 'M13.5 6.5l4 4'],
  package: [
    'M12 3l8 4.5v9l-8 4.5l-8 -4.5v-9l8 -4.5',
    'M12 12l8 -4.5',
    'M12 12l0 9',
    'M12 12l-8 -4.5',
    'M16 5.25l-8 4.5',
  ],
  list: ['M9 6l11 0', 'M9 12l11 0', 'M9 18l11 0', 'M5 6l0 .01', 'M5 12l0 .01', 'M5 18l0 .01'],
  trash: [
    'M4 7l16 0',
    'M10 11l0 6',
    'M14 11l0 6',
    'M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12',
    'M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3',
  ],
  cash: [
    'M7 9m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z',
    'M14 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M17 9v-2a2 2 0 0 0 -2 -2h-10a2 2 0 0 0 -2 2v6a2 2 0 0 0 2 2h2',
  ],
  bell: [
    'M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6',
    'M9 17v1a3 3 0 0 0 6 0v-1',
  ],
  repeat: ['M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3', 'M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3'],
  check: ['M5 12l5 5l10 -10'],
  'brand-whatsapp': [
    'M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9',
    'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1',
  ],
  calculator: [
    'M4 3m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z',
    'M8 7m0 1a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z',
    'M8 14l0 .01',
    'M12 14l0 .01',
    'M16 14l0 .01',
    'M8 17l0 .01',
    'M12 17l0 .01',
    'M16 17l0 .01',
  ],
  calendar: [
    'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z',
    'M16 3v4',
    'M8 3v4',
    'M4 11h16',
    'M11 15h1',
    'M12 15v3',
  ],
  'alert-triangle': ['M12 9v4', 'M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z', 'M12 16h.01'],
}

/** Every name, for the test that proves each one draws something. */
export const ICON_NAMES = Object.keys(PATHS) as readonly IconName[]

export interface IconProps {
  readonly name: IconName
  /**
   * Edge length in `em`, so an icon grows with the text beside it when the
   * phone's text size is turned up — a fixed pixel icon next to 200% text is
   * the thing the large-text sweep keeps finding.
   */
  readonly size?: number
  readonly className?: string
  readonly strokeWidth?: number
}

export function Icon({ name, size = 1.25, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg
      // Decoration, always. The name is on the control (see the file note).
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={`${size}em`}
      height={`${size}em`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
