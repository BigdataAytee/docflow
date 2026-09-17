/**
 * Working out where a business is (§D, §R).
 *
 * The defect these are written against: the pre-fill read
 * `navigator.language`, so a Nigerian phone set to English — which reports
 * `en-US`, or bare `en` — was offered the United States or nothing at all.
 * Every consequence §D hangs off the country followed it, and the owner's
 * delivery documents came out called "Packing slip" instead of "Waybill".
 */

import { describe, expect, it } from 'vitest'

import { detectRegion } from './detect'
import { KNOWN_TIME_ZONES, countryForTimeZone } from './data/timezones'
import { label } from './profile'
import { SUPPORTED_REGIONS, localeProfileOf } from '../../features/settings/region'

const known = (region: string) => SUPPORTED_REGIONS.includes(region)

describe('The time zone is what says where the device is', () => {
  /** THE ONE THIS IS FOR. */
  it('reads Nigeria from Africa/Lagos even on a phone set to US English', () => {
    expect(detectRegion({ timeZone: 'Africa/Lagos', language: 'en-US' }, known)).toEqual({
      region: 'NG',
      source: 'time-zone',
    })
  })

  it('reads the UK from Europe/London, and the US from America/New_York', () => {
    expect(detectRegion({ timeZone: 'Europe/London' }, known).region).toBe('GB')
    expect(detectRegion({ timeZone: 'America/New_York' }, known).region).toBe('US')
  })

  it.each([
    ['Africa/Accra', 'GH'],
    ['Africa/Nairobi', 'KE'],
    ['Asia/Kolkata', 'IN'],
    ['Europe/Paris', 'FR'],
    ['America/Mexico_City', 'MX'],
    ['Africa/Johannesburg', 'ZA'],
    ['Asia/Dubai', 'AE'],
    ['Australia/Sydney', 'AU'],
  ])('reads %s as %s', (zone, region) => {
    expect(detectRegion({ timeZone: zone }, known).region).toBe(region)
  })

  /** Deprecated aliases real devices still report. */
  it('understands the old zone names too', () => {
    expect(countryForTimeZone('Asia/Calcutta')).toBe('IN')
    expect(countryForTimeZone('Europe/Kiev')).toBe('UA')
    expect(countryForTimeZone('America/Godthab')).toBe('GL')
  })

  it('does not care about case or stray spaces', () => {
    expect(countryForTimeZone('  africa/lagos ')).toBe('NG')
  })
})

describe('An offset is not a place', () => {
  /**
   * UTC, GMT and the `Etc/*` zones describe an OFFSET. A device reporting one
   * is saying it does not know where it is, and reading a country out of that
   * would be inventing the one fact the lookup exists to establish.
   */
  it.each(['UTC', 'GMT', 'Etc/UTC', 'Etc/GMT+1', 'Factory', 'Local'])(
    'reads no country from %s',
    (zone) => {
      expect(countryForTimeZone(zone)).toBeUndefined()
    },
  )

  it('falls through to the language tag when the zone says nothing', () => {
    expect(detectRegion({ timeZone: 'Etc/UTC', language: 'en-GB' }, known)).toEqual({
      region: 'GB',
      source: 'language',
    })
  })
})

describe('The language tag, as a fallback and only when it carries a country', () => {
  it('reads NG out of en-NG', () => {
    expect(detectRegion({ language: 'en-NG' }, known)).toEqual({
      region: 'NG',
      source: 'language',
    })
  })

  /** Bare `en` is the case that produced the bug: no country, so no guess. */
  it('reads nothing out of a bare language', () => {
    expect(detectRegion({ language: 'en' }, known)).toEqual({ source: 'none' })
  })

  /**
   * A SCRIPT subtag is four letters and is not a country. Anything that split
   * on the dash and took the second piece read `Latn` as one.
   */
  it('does not mistake a script subtag for a country', () => {
    expect(detectRegion({ language: 'sr-Latn' }, known)).toEqual({ source: 'none' })
    expect(detectRegion({ language: 'sr-Latn-RS' }, known).region).toBe('RS')
  })

  /** `es-419` is Latin America — a UN area code, a continent, not a country. */
  it('does not mistake an area code for a country', () => {
    expect(detectRegion({ language: 'es-419' }, known)).toEqual({ source: 'none' })
  })

  it('accepts an underscore, which some platforms still emit', () => {
    expect(detectRegion({ language: 'en_NG' }, known).region).toBe('NG')
  })
})

describe('Nothing is ever invented', () => {
  it('says so rather than guessing when it has no signals at all', () => {
    expect(detectRegion({}, known)).toEqual({ source: 'none' })
  })

  it('refuses a country the app cannot offer', () => {
    expect(detectRegion({ timeZone: 'Africa/Lagos' }, () => false)).toEqual({ source: 'none' })
  })
})

describe('The table itself', () => {
  it('maps every zone it lists to a country the app supports', () => {
    const unsupported = [...new Set(KNOWN_TIME_ZONES)]
      .map((zone) => [zone, countryForTimeZone(zone)] as const)
      .filter(([, region]) => region === undefined || !known(region))
    expect(unsupported, `zones resolving to a country the picker cannot offer`).toEqual([])
  })

  it('lists no zone twice under two different countries', () => {
    const seen = new Map<string, string>()
    const clashes: string[] = []
    for (const zone of KNOWN_TIME_ZONES) {
      const key = zone.toLowerCase()
      const country = countryForTimeZone(zone)!
      const first = seen.get(key)
      if (first !== undefined && first !== country) clashes.push(`${zone}: ${first} and ${country}`)
      else seen.set(key, country)
    }
    expect(clashes, clashes.join('; ')).toEqual([])
  })

  /** The zone this device is actually in resolves, whatever machine runs CI. */
  it('resolves the runtime’s own zone to a country the app can offer', () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const region = countryForTimeZone(zone)
    // UTC in a container is legitimate and means "no country", not a failure.
    if (region !== undefined) expect(known(region), `${zone} -> ${region}`).toBe(true)
  })
})

describe('End to end: a detected country names the documents', () => {
  /**
   * The whole chain the owner asked for, in one assertion each — device
   * location to printed word, with nobody typing anything.
   */
  it.each([
    ['Africa/Lagos', 'Waybill'],
    ['Europe/London', 'Delivery note'],
    ['America/New_York', 'Packing slip'],
  ])('a device in %s calls a delivery a %s', (zone, expected) => {
    const { region } = detectRegion({ timeZone: zone, language: 'en-US' }, known)
    expect(region, `${zone} did not resolve`).toBeDefined()
    expect(label(localeProfileOf({ region: region!, language: 'en' }), 'waybill')).toBe(expected)
  })
})
