# Dependency advisories

`npm audit --omit=dev` on 2026-09-15: **2 moderate, both in `react-router`,
both with no non-breaking fix.** Recorded here rather than silenced, because
an advisory nobody wrote down is one somebody re-discovers in a hurry.

Installed: `react-router-dom@6.30.6`, which is the newest 6.x. The advisories
name 7.18.4 as the fix, and that is a major-version migration.

## GHSA-337j-9hxr-rhxg — arbitrary constructor injection via `deserializeErrors()`

**Not applicable.** The vulnerable code path is React Router's SSR hydration.
This app has no server-side rendering anywhere: it is a Vite SPA served as
static files, and inside Capacitor it is the same bundle loaded from the app's
own assets. `deserializeErrors` is never reached because nothing ever
serialises an error on a server to hydrate on a client.

If SSR is ever introduced, this stops being inapplicable the same day.

## GHSA-wrjc-x8rr-h8h6 — open redirect via backslash in `<Link>` / `useNavigate`

**Not reachable, and now structurally prevented.** The vulnerability needs a
destination string somebody outside the app can shape. Every destination in
this app is built by `src/app/paths.ts`: a literal prefix plus an internal
record id, a document type, or a `SettingsPanel` from a fixed union. None of
them comes from a URL, a query parameter, a deep link or a scanned code.

That was a fact about the call sites rather than a property of the builders —
exactly the kind of fact that stops being true quietly — so the builders now
`encodeURIComponent` every segment. A backslash or a second slash in an id
cannot change the destination even if one ever arrives from somewhere new.

## Why not upgrade to 7.x

Rule #1, and the state of the build. A major router migration touches every
route, the memory-router test harness and the native back-button integration,
to close one advisory that does not apply and one that cannot be reached. The
cost lands on the part of the app that is finished and working; the benefit is
zero today.

**Revisit when** any of these becomes true:

* SSR is introduced (the first advisory becomes live);
* a destination is ever built from something a stranger supplies — a deep
  link, a QR code, a `?next=` parameter (the second becomes live);
* React Router 7 is wanted for its own sake, in which case do it as its own
  piece of work rather than as a security fix.

## The check itself

`npm audit --omit=dev` is the production-dependency view and is what this
file records. Run it before a release. It is deliberately not a CI gate: a
new advisory in a transitive dependency would turn every branch red for
something nobody on the branch did, and a check that blocks unrelated work is
one people learn to bypass — which is worse than reading this file.
