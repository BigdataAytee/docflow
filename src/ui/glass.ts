/**
 * Whether this device gets §F's frosted glass, or its fallback.
 *
 * §F: "on low-tier devices, where `backdrop-filter` is unsupported, or under
 * reduced-transparency, glass degrades automatically to translucent white
 * without blur — same layout, cheaper paint."
 *
 * Two of those three conditions are answered in CSS and need nothing from
 * here: an unsupported `backdrop-filter` never matches the `@supports` query,
 * and `prefers-reduced-transparency` has its own media query. Only the first
 * — "low-tier device" — is a fact CSS cannot see, so this is the whole of the
 * JavaScript involved: read the reported memory, compare it to the ONE
 * threshold §N already fixes, and put a class on the root.
 *
 * The threshold is imported rather than restated. §N's ladder calls 3GB the
 * floor of the realistic market phone (Tier B); a device under it is the one
 * §F means by low-tier. Two files agreeing on 3 by coincidence is two files
 * that stop agreeing the day a spike moves the number.
 */

import { TIER_B_MIN_RAM_GB } from '../features/ai/tier'

/** The class `src/index.css` keys the cheap paint off. */
export const NO_GLASS_CLASS = 'no-glass'

/** What the browser tells us. Absent on iOS Safari, which reports nothing. */
export interface GlassFacts {
  /** `navigator.deviceMemory`, in gigabytes, where the engine provides it. */
  readonly deviceMemoryGb?: number
}

/**
 * Glass unless the device is known to be under the bar.
 *
 * Deliberately optimistic about silence. `deviceMemory` is Chromium-only, so
 * every iPhone reports nothing at all — and treating "I don't know" as "too
 * slow" would strip the design from the entire platform §F was drawn on. A
 * missing fact is not evidence of a weak phone.
 */
export function wantsGlass(facts: GlassFacts): boolean {
  const memory = facts.deviceMemoryGb
  if (memory === undefined) return true
  return memory >= TIER_B_MIN_RAM_GB
}

/** Read the facts off a Navigator, without assuming the field exists. */
export function glassFactsOf(navigator: Navigator | undefined): GlassFacts {
  const reported = (navigator as { deviceMemory?: unknown } | undefined)?.deviceMemory
  return typeof reported === 'number' && Number.isFinite(reported)
    ? { deviceMemoryGb: reported }
    : {}
}

/**
 * Put the class on — or take it off, which matters because Settings can flip
 * this and a class that only ever gets added is a setting that only works
 * once.
 */
export function applyGlass(root: Element, wanted: boolean): void {
  root.classList.toggle(NO_GLASS_CLASS, !wanted)
}
