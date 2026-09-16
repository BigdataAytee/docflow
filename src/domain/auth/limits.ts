/**
 * What the auth endpoints are allowed to be asked, and what happens when
 * someone asks more (§P: "rate limiting on auth and public endpoints";
 * §Q Phase 7's "rate-limit verification").
 *
 * The public endpoints count for themselves — `check_rate_limit`, migration
 * 0019, a table every edge-function instance shares. **Auth cannot work that
 * way.** Sign-in, sign-up and password reset are served by GoTrue, which is
 * not our code and has no seam we could put a counter in: no edge function
 * runs before it, and a limiter in the client is a suggestion to whoever is
 * attacking it. The limiter is the provider's, and what is ours is the
 * numbers, the reasons, and a verification that the live project matches.
 *
 * So this file is the declaration. It used to be an INTENTION — `APPLIED` was
 * false and the numbers were what a project ought to have rather than what any
 * project had. That changed on 2026-09-16: the settings were applied, and these
 * rows were rewritten to match what Supabase actually enforces rather than the
 * other way round.
 *
 * THE REWRITE MATTERS MORE THAN THE FLAG. The old rows described per-endpoint
 * limits Supabase cannot express — a separate allowance for password reset,
 * another for magic links, a third for sign-up. There are no such knobs. What
 * exists is smaller and blunter: one shared sign-up/sign-in limit, one hourly
 * email budget for every mail-sending endpoint together, and a per-user
 * minimum interval on top of it. A declaration naming limits the provider
 * cannot enforce was never going to be verifiable, which is precisely why the
 * gate found the reset endpoint refusing nothing.
 *
 * `scope` is on every row for the same reason: "150 an hour" says nothing
 * until you know per what.
 *
 * What decided the numbers, in one sentence each, because a limit nobody can
 * explain is a limit somebody widens the first time it is inconvenient:
 *
 *  · A limit is per IP, which means a whole business behind one office
 *    connection shares it. Ten people signing in on Monday morning must not
 *    hit anything (Rule #1 — nothing is harder than the legacy app).
 *  · A limit that sends email is about a STRANGER'S inbox, not ours. The
 *    address in a reset request is attacker-chosen, so a generous reset limit
 *    is a mail bomb with our domain on it.
 *  · Token refresh is deliberately left alone. Every open tab refreshes on a
 *    schedule nobody chose, and a tight refresh limit signs working people out
 *    of an app they are using — a self-inflicted outage dressed as security.
 */

/**
 * Whether a probe of this endpoint costs anybody anything.
 *
 * The gate refuses to probe what it cannot probe harmlessly. This is the
 * field that stops "verification" from meaning "we emailed two hundred
 * strangers to see what would happen".
 */
export type ProbeCost =
  /** Nothing happens: no account, no email, no row. Probe freely. */
  | 'harmless'
  /** Sends mail to whatever address is given. Never probed. */
  | 'sends_email'
  /** Creates a user that then has to be cleaned up. Opt-in only. */
  | 'creates_account'

export interface AuthLimit {
  /** Stable key, used by the gate's report and by the tests. */
  readonly id: string
  /** The path, as GoTrue serves it. */
  readonly endpoint: string
  /** What a person is doing when they hit it, in words a person would use. */
  readonly what: string
  /** Requests allowed inside the window. Per WHAT is `scope`. */
  readonly allowance: number
  /**
   * What the counter is keyed by — because a number without it means nothing,
   * and the three answers have completely different blast radii. An IP limit
   * is shared by a whole office; a project limit is shared by every customer
   * at once.
   */
  readonly scope: 'ip' | 'user' | 'project'
  readonly windowSeconds: number
  /** Why this number and not a rounder one. */
  readonly why: string
  readonly probeCost: ProbeCost
  /**
   * Why a probe cannot answer this one, where the generic reason is wrong.
   *
   * It exists because a probe that CANNOT SEE a limit and a limit that is NOT
   * SET look identical from outside — and reporting the second when it is the
   * first is the sort of false red that gets a whole gate ignored.
   */
  readonly whyNotProbed?: string
}

/**
 * TRUE since 2026-09-16 — and what that does and does not mean.
 *
 * It means these values were entered in the project's Authentication → Rate
 * Limits, and this file was rewritten to match them. Live SMTP went in at the
 * same time (Resend, on a domain with DKIM and SPF verified), which is what
 * made the email limits real: before it, Supabase's built-in sender had its
 * own trickle and these numbers governed nothing.
 *
 * It does NOT mean the flag should be trusted. A boolean in a source file is a
 * claim about a dashboard, and dashboards change without a commit. The thing
 * that actually checks is `npm run gate:hosted:api` step 10, which probes each
 * endpoint and reports what it really did. This says "somebody applied these";
 * only the gate says "and they are still in force".
 */
export const APPLIED = true

export const AUTH_LIMITS: readonly AuthLimit[] = [
  {
    id: 'sign_in',
    endpoint: '/auth/v1/token?grant_type=password',
    what: 'Signing in with an email and a password',
    allowance: 30,
    windowSeconds: 300,
    scope: 'ip',
    why:
      'The endpoint a password-guessing run hits, and the one a whole office ' +
      'shares. Ten people signing in twice each on Monday morning is twenty; ' +
      'thirty leaves room for the fumbles without leaving room for a script. ' +
      'Supabase counts sign-ups against this same budget.',
    probeCost: 'harmless',
  },
  {
    id: 'sign_up',
    endpoint: '/auth/v1/signup',
    what: 'Creating an account',
    // The SAME setting as sign-in. Supabase has one control for both, and a
    // tighter number here would describe a limit nothing enforces.
    allowance: 30,
    windowSeconds: 300,
    scope: 'ip',
    why:
      'Not a separate budget: Supabase governs sign-ups and sign-ins with one ' +
      'setting, so this is the same thirty per five minutes. Signing up also ' +
      'sends a confirmation, and the email budget below is what actually ' +
      'bounds a mail flood — not this.',
    probeCost: 'creates_account',
  },
  {
    id: 'password_reset',
    endpoint: '/auth/v1/recover',
    what: 'Asking for a password-reset link',
    // The per-user MINIMUM INTERVAL is what binds for one address: one mail,
    // then a refusal until sixty seconds have passed. The hourly email budget
    // sits above it and binds for the project as a whole.
    allowance: 1,
    windowSeconds: 60,
    scope: 'user',
    why:
      'The address is chosen by whoever is asking, so this is a limit on ' +
      'sending mail to STRANGERS. A person resets a password once and checks ' +
      'their inbox; a second request inside a minute is a script or a stuck ' +
      'finger, and the cost of being wrong is our domain in a spam folder. ' +
      'Supabase expresses this as a minimum interval rather than an hourly ' +
      'count, so an interval is what is declared.',
    /*
     * `sends_email` SINCE LIVE SMTP, and the change is not cosmetic.
     *
     * While Supabase's built-in sender was in use this was genuinely harmless
     * to probe. With Resend behind it, a probe against a REAL address sends
     * real mail, and the gate's own rule is that a mail-bomb check must not
     * mail-bomb.
     *
     * Against a FAKE address it is worse than harmless — it is useless. The
     * gate probed six times and saw nothing refused, because Supabase does not
     * send for an address with no account (it answers the same either way, so
     * nobody can enumerate users), and a limit on sending never engages when
     * nothing is sent. That is a probe blind to the limit, not a limit that is
     * absent, and the run reported it as a failure.
     */
    probeCost: 'sends_email',
    whyNotProbed:
      'not probed: against a real address it sends mail, and against a fake one it ' +
      'proves nothing — Supabase does not send for an address with no account, so ' +
      'the interval never engages. Verify by asking for two resets on a real mailbox ' +
      'inside a minute; the second must be refused',
  },
  {
    id: 'otp',
    endpoint: '/auth/v1/otp',
    what: 'Magic links and one-time codes',
    allowance: 1,
    windowSeconds: 60,
    scope: 'user',
    why:
      'DocFlow does not use magic links or OTP at all — but the endpoint is ' +
      'open whether we use it or not, and it sends mail to any address given. ' +
      'It draws on the same email budget and the same per-user interval as a ' +
      'reset, because Supabase has one mail pipe and both go down it. An ' +
      'unused door still needs a lock.',
    probeCost: 'sends_email',
  },
  {
    id: 'email_send',
    endpoint: '(every mail-sending auth endpoint)',
    what: 'Sending any authentication email at all',
    allowance: 150,
    windowSeconds: 3600,
    // PROJECT, not IP and not user: one budget shared by every customer at
    // once, which is what makes it the number that decides whether a flood
    // costs us a sending reputation.
    scope: 'project',
    why:
      'The ceiling every other mail limit sits under, and the one with real ' +
      'money behind it: bounces and spam complaints are charged to the ' +
      'sending domain, not to whoever caused them. A hundred and fifty an ' +
      'hour is far above a real day — sign-ups and resets for a business tool ' +
      'are single figures — and far below what would burn a domain whose ' +
      'reputation is days old.',
    probeCost: 'sends_email',
  },
  {
    id: 'token_verification',
    endpoint: '/auth/v1/verify',
    what: 'Redeeming a link or code that was emailed',
    allowance: 360,
    windowSeconds: 3600,
    scope: 'ip',
    why:
      'The other half of every emailed link: a token that arrives has to be ' +
      'redeemed, and guessing at redemption is a different attack from ' +
      'guessing at sending. Well above a person tapping a link twice because ' +
      'the first tap did not seem to do anything.',
    probeCost: 'harmless',
  },
  {
    id: 'token_refresh',
    endpoint: '/auth/v1/token?grant_type=refresh_token',
    what: 'Refreshing a session that is already signed in',
    // Deliberately high. See `why` — this is the one place where a tight
    // limit hurts the people using the app and nobody else.
    allowance: 1800,
    windowSeconds: 3600,
    scope: 'ip',
    why:
      'Every open tab refreshes on a schedule nobody chose, and §M says a ' +
      'credential problem must never cost somebody their work. A tight limit ' +
      'here signs working people out mid-invoice — an outage we caused ' +
      'ourselves, to stop an attack that gains nothing: a refresh token is ' +
      'already a valid credential.',
    probeCost: 'harmless',
  },
]

export const limitFor = (id: string): AuthLimit | undefined =>
  AUTH_LIMITS.find((limit) => limit.id === id)

/**
 * The endpoints the gate may actually probe.
 *
 * `sends_email` is never probed: a mail-bomb check that mail-bombs is not a
 * check. `creates_account` is opt-in, because a probe that leaves two hundred
 * half-made users behind has broken the project it was verifying.
 */
export const probeable = (optIn: boolean): readonly AuthLimit[] =>
  AUTH_LIMITS.filter(
    (limit) =>
      limit.probeCost === 'harmless' || (optIn && limit.probeCost === 'creates_account'),
  )

/**
 * How many requests a probe may make before it gives up.
 *
 * One past the allowance is the whole test: the request that should be
 * refused. A few more for slack — a project may count a little differently
 * than we do — and a hard ceiling so a wrong number here can never turn the
 * gate into the flood it is checking for.
 */
export const PROBE_CEILING = 200

export const probeBudget = (limit: AuthLimit): number =>
  Math.min(limit.allowance + 5, PROBE_CEILING)

/**
 * The address a probe signs in as.
 *
 * `example.com` is reserved by RFC 2606 and can never belong to anybody, so a
 * probe can never lock a real person out of their account and can never send
 * mail anywhere real. The unique part keeps two runs from sharing a bucket
 * that is keyed by address rather than by IP.
 */
export const probeAddress = (unique: string): string =>
  `docflow-gate-${unique.replace(/[^a-z0-9]/gi, '').toLowerCase()}@example.com`

/** One request a probe makes: where it goes, and what it carries. */
export interface ProbeRequest {
  readonly path: string
  readonly body: Readonly<Record<string, unknown>>
}

/**
 * How each endpoint is asked.
 *
 * Well-formed and wrong, never malformed: a body the server rejects before it
 * reaches the limiter proves nothing about the limiter. The password is wrong
 * on purpose and the address belongs to nobody, so a refusal is the only
 * thing that can come back.
 */
export function probeRequest(limit: AuthLimit, email: string, unique: string): ProbeRequest {
  switch (limit.id) {
    case 'password_reset':
      return { path: '/auth/v1/recover', body: { email } }
    case 'sign_up':
      return { path: '/auth/v1/signup', body: { email, password: `Gate-${unique}-1` } }
    case 'token_refresh':
      return {
        path: '/auth/v1/token?grant_type=refresh_token',
        body: { refresh_token: 'not-a-real-refresh-token' },
      }
    case 'token_verification':
      /*
       * ITS OWN ENDPOINT, and this case is a bug fix rather than a tidy-up.
       *
       * `token_verification` was added to the declaration without a case
       * here, so it fell through to `default` and probed the SIGN-IN endpoint
       * two hundred times under the name of a different clause. The gate then
       * reported "auth throttles redeeming a link or code — refused after 42"
       * about an endpoint it had never touched.
       *
       * Caught by the flood-ceiling test, which counts requests per path and
       * saw one path take 235 when no single budget allows more than 200 —
       * a limit the check was written for, catching something else entirely.
       */
      return {
        path: '/auth/v1/verify',
        body: { type: 'recovery', token: `gate-${unique}-not-a-real-token`, email },
      }
    default:
      return {
        path: '/auth/v1/token?grant_type=password',
        body: { email, password: 'not-the-password' },
      }
  }
}

export type ProbeVerdict =
  | { readonly kind: 'limited'; readonly afterRequests: number }
  | { readonly kind: 'not_limited'; readonly requests: number }

/**
 * What a run of probes proved.
 *
 * Refused at or before the budget is a pass — a project stricter than this
 * file is safe, and saying otherwise would push somebody to LOOSEN a limit to
 * satisfy a test. Never refused is the failure, and it is a failure about a
 * setting rather than about code.
 */
export const verdictOf = (statuses: readonly number[]): ProbeVerdict => {
  const at = statuses.findIndex((status) => status === 429)
  return at === -1
    ? { kind: 'not_limited', requests: statuses.length }
    : { kind: 'limited', afterRequests: at + 1 }
}

/** Sends one request and comes back with its status. The gate supplies fetch. */
export type Send = (request: ProbeRequest) => Promise<number>

/**
 * Ask an endpoint until it refuses, or until the budget runs out.
 *
 * The second guard against probing something that sends mail. `probeable`
 * already filters those out; this refuses even if a caller hands one over,
 * because "we only call it with the right list" is how the wrong list ends up
 * being passed one day.
 */
export async function runProbe(
  limit: AuthLimit,
  email: string,
  unique: string,
  send: Send,
): Promise<ProbeVerdict> {
  if (limit.probeCost === 'sends_email') {
    throw new Error(`${limit.id} sends mail to whatever address it is given; it is never probed`)
  }

  const request = probeRequest(limit, email, unique)
  const statuses: number[] = []
  for (let attempt = 0; attempt < probeBudget(limit); attempt += 1) {
    statuses.push(await send(request))
    if (statuses[statuses.length - 1] === 429) break
  }
  return verdictOf(statuses)
}
