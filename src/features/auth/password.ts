/**
 * The password rule the server enforces, mirrored for the person typing (§K).
 *
 * THE SERVER IS THE AUTHORITY. This is a copy, kept so somebody is told what
 * is wrong while they are still in the field rather than after a round trip
 * that comes back with the provider's own English — which §S already refuses
 * to show them.
 *
 * It must never be STRICTER than the dashboard. A client rule tighter than
 * the server's rejects a password the account would have accepted, and the
 * person has no way to discover that; looser is harmless, because the server
 * refuses and the app says so in its own words.
 *
 * Supabase → Authentication → Policies → minimum password length. Set to 8
 * on 2026-09-16, which is where this number comes from.
 */
export const PASSWORD_MIN_LENGTH = 8

/** Null when it will be accepted; otherwise which rule it misses. */
export function passwordProblem(password: string): 'too_short' | null {
  // Length in CODE POINTS, not UTF-16 units: an eight-emoji password is eight
  // characters to the person who typed it, and `.length` would call it
  // sixteen. Counting it the other way would accept something the server
  // then refuses.
  return [...password].length < PASSWORD_MIN_LENGTH ? 'too_short' : null
}
