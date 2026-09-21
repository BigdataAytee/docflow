/**
 * Where a CAPTCHA belongs, and the three places it must never be (§R, §M).
 *
 * Supabase can require a CAPTCHA token on its auth endpoints. Switched on
 * carelessly that is a wall across the whole app, so this module exists to
 * name the two moments it is allowed to appear and to make the rest
 * unreachable by construction rather than by everybody remembering.
 *
 * IT MAY ASK ON A DELIBERATE SIGN-IN OR SIGN-UP. Somebody is at a form, they
 * pressed a button, they are waiting for an answer, and a slow widget is a
 * cost they can see the reason for. That is the only shape where it is fair.
 *
 * IT MAY NOT ASK ON A SILENT REFRESH. A token renewal happens while somebody
 * is halfway through an invoice, with no form on screen and nothing to
 * interact with — a challenge there is an app that stops working for reasons
 * the person cannot see, and on a bad connection it fails and signs them out
 * of work they have not finished.
 *
 * IT MAY NOT BLOCK AN OFFLINE REOPEN. This is the one that would break the
 * product. Rule #2: "every core journey must pass in airplane mode", and §M's
 * whole session model exists so the app opens on Home with a stale session
 * and no network at all. A CAPTCHA is a network round trip by definition; if
 * reopening needed one, DocFlow would not work on the connection it is built
 * for. Reopening never touches an auth endpoint, and nothing here may change
 * that.
 *
 * ⚠ SWITCHING IT ON IS A DASHBOARD SETTING, NOT A CODE CHANGE. Supabase
 * enforces the token server-side once CAPTCHA protection is enabled for the
 * project. Everything here is the client's half: obtaining a token at the two
 * allowed moments and passing it. Until somebody enables it in the dashboard,
 * `captchaToken` is undefined, the calls are unchanged, and nothing about the
 * app differs — which is what makes this safe to ship ahead of the switch.
 */

/** The moments a challenge is allowed to appear. */
export type CaptchaMoment = 'sign_in' | 'sign_up'

/**
 * Every auth call the app makes, and whether it may carry a challenge.
 *
 * Written as a table rather than as a check at each call site, because the
 * dangerous cases are the ones nobody thinks to check: a refresh is
 * automatic, and a reopen is not a call at all.
 */
export const CAPTCHA_ALLOWED: Readonly<Record<string, boolean>> = {
  /** A person at a form, waiting for an answer they asked for. */
  sign_in: true,
  sign_up: true,

  /*
   * Everything below is either automatic or offline, and a challenge in any
   * of them is a wall somebody did not walk into.
   */
  /** Renews a token mid-invoice. No form, no gesture, nothing to solve. */
  refresh_session: false,
  /** Reads a stored session so the app opens. Offline, by design (Rule #2). */
  restore_session: false,
  /** The round trip a confirmation link started; they already proved intent. */
  complete_from_url: false,
  /** The provider runs its own challenge if it wants one. */
  sign_in_with_google: false,
  /** A link to an address they own is its own proof. */
  password_reset: false,
  /** Leaving is never something to be challenged about. */
  sign_out: false,
}

/** Whether a challenge may be attached to this call. */
export const captchaAllowedFor = (operation: string): boolean =>
  CAPTCHA_ALLOWED[operation] === true

/**
 * What to send to Supabase for one attempt.
 *
 * Absent when there is no token, which is the normal state until somebody
 * enables CAPTCHA protection in the dashboard — the call is then byte for
 * byte what it was before, and no behaviour changes on the day this ships.
 */
export function captchaOptions(
  moment: CaptchaMoment,
  token: string | undefined,
): { readonly captchaToken: string } | Record<string, never> {
  if (!captchaAllowedFor(moment)) return {}
  if (token === undefined || token.trim() === '') return {}
  return { captchaToken: token }
}

/**
 * How the app gets a token, when one is needed.
 *
 * A PORT, not a widget. The challenge provider is a third-party script that
 * has to load over the network, and wiring one directly into the auth layer
 * would put a network dependency inside the module §M relies on working
 * offline. A host that has one supplies it; a host that has none passes
 * nothing and every call is unchanged.
 */
export interface CaptchaPort {
  /**
   * Obtains a token for this moment, or undefined if none is available.
   *
   * RESOLVES RATHER THAN THROWS when the widget cannot load. A trader on a
   * bad connection who cannot reach the challenge provider should get the
   * server's own refusal — which is actionable and says what to do — rather
   * than a script error from a third party they have never heard of.
   */
  token(moment: CaptchaMoment): Promise<string | undefined>
}
