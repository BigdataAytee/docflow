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
 * So this file is the declaration, and it is honest about its own status:
 * `APPLIED` is false. Nothing here is in force anywhere, because there is no
 * project to put it in force on. `npm run gate:hosted` step 10 reads these
 * rows and probes the endpoints against them; until it has been run against a
 * real project, every number here is an intention.
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
  /** Requests allowed inside the window, per IP. */
  readonly allowance: number
  readonly windowSeconds: number
  /** Why this number and not a rounder one. */
  readonly why: string
  readonly probeCost: ProbeCost
}

/**
 * FALSE, and it stays false until somebody applies these to a project and
 * records it. The gate reports "declared, unverified" rather than a tick —
 * the same rule the backup schedule follows: a configuration nobody has
 * checked is not a configuration that is in force.
 */
export const APPLIED = false

export const AUTH_LIMITS: readonly AuthLimit[] = [
  {
    id: 'sign_in',
    endpoint: '/auth/v1/token?grant_type=password',
    what: 'Signing in with an email and a password',
    allowance: 30,
    windowSeconds: 300,
    why:
      'The endpoint a password-guessing run hits, and the one a whole office ' +
      'shares. Ten people signing in twice each on Monday morning is twenty; ' +
      'thirty leaves room for the fumbles without leaving room for a script.',
    probeCost: 'harmless',
  },
  {
    id: 'password_reset',
    endpoint: '/auth/v1/recover',
    what: 'Asking for a password-reset link',
    allowance: 10,
    windowSeconds: 3600,
    why:
      'The address is chosen by whoever is asking, so this is a limit on ' +
      "sending mail to STRANGERS. A person resets a password once and checks " +
      'their inbox; ten an hour is already generous, and the cost of being ' +
      'wrong is our domain in a spam folder.',
    probeCost: 'harmless',
  },
  {
    id: 'sign_up',
    endpoint: '/auth/v1/signup',
    what: 'Creating an account',
    allowance: 10,
    windowSeconds: 3600,
    why:
      'Signing up is rare and deliberate — one per business, and the same ' +
      'office connection will not do it twice in an afternoon. It also sends ' +
      'a confirmation email, so the mail-bomb argument applies here too.',
    probeCost: 'creates_account',
  },
  {
    id: 'otp',
    endpoint: '/auth/v1/otp',
    what: 'Magic links and one-time codes',
    allowance: 5,
    windowSeconds: 3600,
    why:
      'DocFlow does not use magic links or OTP at all — but the endpoint is ' +
      'open whether we use it or not, and it sends mail to any address given. ' +
      'An unused door still needs a lock. Low on purpose: if this ever ' +
      'becomes a real journey, raising it is a decision somebody makes on ' +
      'purpose rather than a default nobody noticed.',
    probeCost: 'sends_email',
  },
  {
    id: 'token_refresh',
    endpoint: '/auth/v1/token?grant_type=refresh_token',
    what: 'Refreshing a session that is already signed in',
    // Deliberately high. See `why` — this is the one place where a tight
    // limit hurts the people using the app and nobody else.
    allowance: 1800,
    windowSeconds: 3600,
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
