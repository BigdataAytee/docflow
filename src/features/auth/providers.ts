/**
 * Which sign-in providers the project actually has (§N, §R).
 *
 * §N's rule is that an unavailable capability is said out loud rather than
 * dressed up — and the strongest form of saying it is not offering the
 * control. "Continue with Google" was rendered unconditionally, so on a
 * project with no Google credentials it opened, bounced off GoTrue and came
 * back as `{"error_code":"validation_failed","msg":"Unsupported provider:
 * provider is not enabled"}`. A button whose only outcome is an error is the
 * same species as a toggle wired to nothing.
 *
 * GoTrue publishes the answer at `/auth/v1/settings`, which is unauthenticated
 * by design — it is what a login page is meant to read before drawing itself.
 *
 * **Unknown means hidden.** If the settings cannot be read — no signal, the
 * project unreachable — the button does not appear. The alternative fails the
 * other way: showing a provider that may not exist, to somebody who by
 * definition has a connection problem, when email sign-in is right there and
 * works. §R already says initial auth needs a connection, and the screen says
 * so in words.
 */

/** Parses GoTrue's settings body. Anything unexpected reads as "none". */
export function enabledProviders(body: unknown): ReadonlySet<string> {
  const external = (body as { external?: unknown } | null | undefined)?.external
  if (typeof external !== 'object' || external === null) return new Set()

  const enabled = new Set<string>()
  for (const [name, value] of Object.entries(external as Record<string, unknown>)) {
    // Strictly `true`. GoTrue sends booleans; a string or a 1 means the shape
    // changed, and guessing at a changed shape is how a button comes back.
    if (value === true) enabled.add(name)
  }
  return enabled
}

/**
 * Asks the project what it has enabled.
 *
 * Never throws: a sign-in screen that cannot render because a capability probe
 * failed is worse than the button it was probing for.
 */
export async function readEnabledProviders(
  url: string,
  anonKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReadonlySet<string>> {
  try {
    const response = await fetchImpl(`${url.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: { apikey: anonKey },
    })
    if (!response.ok) return new Set()
    return enabledProviders(await response.json())
  } catch {
    return new Set()
  }
}
