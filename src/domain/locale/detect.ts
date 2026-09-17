/**
 * Working out where a business is, so nobody has to be asked twice (§D, §R).
 *
 * §D calls choosing a country "one picker, pre-filled — not a new required
 * field". The picker was there; the PRE-FILL was the weak half. It read
 * `navigator.language`, which answers "what language is this phone in",
 * and then used the answer to decide what country the business is in.
 *
 * Those are different questions, and for most of the world they have
 * different answers. A Nigerian phone set to English reports `en-US` or bare
 * `en`. So a trader in Ifo was offered the United States, or nothing, and
 * every consequence §D hangs off the country came out wrong with it — the
 * terminology above all. Their delivery documents were called "Packing slip".
 *
 * WHAT THIS PREFERS, AND WHY IN THIS ORDER:
 *
 *  1. THE TIME ZONE. `Africa/Lagos` means the device is in Nigeria, and it
 *     keeps meaning that when the handset is in English, in French, or in a
 *     language DocFlow does not speak. It is the only signal available that
 *     describes a PLACE. No permission, no network, no plugin — it works in
 *     airplane mode on first launch, which Rule #2 requires of everything.
 *  2. THE LANGUAGE TAG'S REGION, but only a real one. `en-NG` carries a
 *     genuine country subtag and is worth reading; bare `en` carries none.
 *     This is the old behaviour, kept as a fallback rather than as the
 *     answer.
 *
 * And nothing else. There is no IP lookup and no geolocation prompt: §N
 * forbids a silent network call, and asking for GPS to decide what to call a
 * delivery note would be wildly out of proportion to the question.
 *
 * EVERY RESULT IS A SUGGESTION. It lands in a control the owner can see and
 * change before anything is created, and in Settings afterwards. A business
 * registered in one country and operated from another is ordinary, and the
 * device cannot know which one the paperwork belongs to — only the owner can.
 */

import { countryForTimeZone } from './data/timezones'

export interface DetectionSignals {
  /** `Intl.DateTimeFormat().resolvedOptions().timeZone`. */
  readonly timeZone?: string
  /** `navigator.language`, or the first of `navigator.languages`. */
  readonly language?: string
}

/** Where a suggested country came from, so a screen can say so (§N). */
export type DetectionSource = 'time-zone' | 'language' | 'none'

export interface DetectedRegion {
  /** Undefined when nothing could be read. Never a made-up default. */
  readonly region?: string
  readonly source: DetectionSource
}

/**
 * The country subtag of a language tag, when it carries a real one.
 *
 * `en-NG` yields NG. Bare `en` yields nothing, and so does `en-Latn` — a
 * SCRIPT subtag, four letters, which is not a country and was being read as
 * one by anything that just split on the dash and took the second piece.
 */
function regionFromLanguageTag(tag: string | undefined): string | undefined {
  if (tag === undefined) return undefined
  for (const part of tag.split(/[-_]/).slice(1)) {
    // A country subtag is exactly two letters. Three digits is a UN M.49 area
    // code — `es-419`, Latin America — which is a continent, not a country.
    if (/^[A-Za-z]{2}$/.test(part)) return part.toUpperCase()
  }
  return undefined
}

/**
 * Read the device's signals. Everything is optional and nothing throws: a
 * WebView that refuses one of these must not stop the app starting.
 */
export function readSignals(): DetectionSignals {
  const signals: { timeZone?: string; language?: string } = {}
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (typeof zone === 'string' && zone !== '') signals.timeZone = zone
  } catch {
    /* An environment with no Intl time zone support says nothing, and that
       is a fine thing for it to say. The language tag is tried next. */
  }
  try {
    const language = navigator.languages?.[0] ?? navigator.language
    if (typeof language === 'string' && language !== '') signals.language = language
  } catch {
    /* Same: no navigator, no guess, and the picker's own default stands. */
  }
  return signals
}

/**
 * The country to pre-fill, and where it came from.
 *
 * `isKnown` is passed in rather than imported so this stays a pure function of
 * its inputs and the caller decides what counts as a country it can offer —
 * the settings layer owns that list, and this module has no business knowing
 * which markets are supported.
 */
export function detectRegion(
  signals: DetectionSignals,
  isKnown: (region: string) => boolean,
): DetectedRegion {
  const fromZone = countryForTimeZone(signals.timeZone)
  if (fromZone !== undefined && isKnown(fromZone)) return { region: fromZone, source: 'time-zone' }

  const fromLanguage = regionFromLanguageTag(signals.language)
  if (fromLanguage !== undefined && isKnown(fromLanguage)) {
    return { region: fromLanguage, source: 'language' }
  }

  return { source: 'none' }
}
