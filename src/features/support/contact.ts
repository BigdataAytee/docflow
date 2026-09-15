/**
 * Where "Chat with support" actually goes (§G).
 *
 * §G's Settings list ends with "Help & support (WhatsApp + FAQ)", and the
 * reference's card says "Chat with support · On WhatsApp". Both describe a
 * real conversation with a real person on a real number — and this repository
 * does not have one.
 *
 * SO THE NUMBER IS CONFIGURATION, not a constant typed into a screen. A
 * plausible-looking number in the source would be the worst outcome of the
 * three: an owner with a problem taps it, reaches a stranger or nothing at
 * all, and the app has spent its one moment of trouble lying to them. §N's
 * rule covers this exactly — a capability that is not installed says so.
 *
 * Unset, the card does not render and Help is an FAQ. Set at build time for a
 * launch build, it renders and works. Nothing in between.
 */

/**
 * Digits only, in full international form without a `+` — the shape
 * `wa.me` takes. Absent until a launch build supplies one.
 */
export function supportWhatsApp(): string | undefined {
  return normaliseSupportNumber(import.meta.env['VITE_SUPPORT_WHATSAPP'])
}

/**
 * The configured value as digits, or nothing.
 *
 * Separate from the env read so the rule can be tested: a misconfigured value
 * — a placeholder, an empty string, the word "TODO" — has to fail CLOSED.
 * Rendering a card that opens `wa.me/12` is worse than rendering none.
 */
export function normaliseSupportNumber(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const digits = raw.replace(/[^0-9]/g, '')
  // The shortest real international number is eight digits.
  return digits.length >= 8 ? digits : undefined
}

/** The link a card opens. Built here so one place knows the URL shape. */
export const whatsAppLink = (digits: string): string => `https://wa.me/${digits}`
