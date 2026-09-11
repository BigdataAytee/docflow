# Phase 0 — secrets scan of the git history

Rule #2: *"Before that commit, the git history is scanned for committed secrets
(Base44 keys especially); any found are rotated immediately, since moving code
cannot remove secrets from history."*

Run **before** the `/legacy` move, on the full history.

- **Date:** 11 September 2026
- **Commits scanned:** 50 (`git rev-list --all`), all refs
- **Result: clean. No credential found. No rotation required.**

## What was scanned

| Check | Scope | Result |
| --- | --- | --- |
| Secret-shaped filenames ever added | `git log --all --diff-filter=A --name-only` against `.env*`, `*.pem`, `*.key`, `*.p12`, keystores, service accounts, `*secret*`, `*credential*` | No `.env` or key material ever committed |
| Provider key patterns in every blob | all commits, all refs: `sk_live`/`sk_test`/`pk_live` (Stripe), `AKIA` (AWS), `ghp_`/`github_pat_` (GitHub), `AIza` (Google), `xoxb-` (Slack), `eyJ…` (JWT), `service_role`/`SUPABASE_SERVICE`, PEM private-key headers | No matches |
| Long literal assignments | all commits: `api_key`/`secret`/`token`/`password`/`private_key`/`client_secret` assigned a ≥16-char literal | No matches |
| How the app actually gets its credentials | `src/lib/app-params.js`, `src/api/base44Client.js` | Runtime URL params with `import.meta.env` defaults. Nothing baked into a committed file. |
| `.gitignore` coverage | root | `.env` and `.env.*` ignored from the start |

## One finding, not a secret

`base44/.app.jsonc` was committed until `d0c9b79` and its historical content is:

```jsonc
{ "id": "6a10a0d9adfa90e93e5b14f8" }
```

That is the **Base44 app identifier**, not a credential — it authorises nothing
on its own, which is why `d0c9b79` moved it to `base44 link` rather than
treating it as a leak. It remains in history permanently and cannot be removed
by the `/legacy` move.

**Carry into Phase 7.** §Q keeps the legacy Base44 backend readable — never
writable — for a grace window during the parallel-run cutover. Since this id is
public, confirm before that window opens that the legacy backend authorises
reads by session, never by app id alone. Tracked against the Phase 7 gate.

## Re-running this

```bash
git log --all --pretty=format: --name-only --diff-filter=A | sort -u \
  | grep -iE '\.env|secret|credential|\.pem$|\.p12$|\.key$|keystore|serviceaccount'

git grep -InE "(sk_live|sk_test|pk_live|AKIA|ghp_|github_pat_|eyJ[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|service_role|SUPABASE_SERVICE|xoxb-|AIza[0-9A-Za-z_-]{30,})" $(git rev-list --all)
```

Re-run before any future history rewrite, and before the Phase 7 cutover.
