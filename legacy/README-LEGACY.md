# `/legacy` — read-only reference

This is the Base44 DocFlow app as it stood on 11 September 2026, moved here
whole in the Phase-0 reconciliation commit (v6 Rule #2). Its git history is
intact and reachable through the repository's normal history.

## It is reference, not a library

- **Nothing in `/legacy` is ever imported by `src/`.** No build, no lint, no
  typecheck reaches it; ESLint and both tsconfigs exclude it.
- **Never port the data-layer code, Mail, or the Apps page** (CLAUDE.md).
- The legacy visual components *are* worth reading, and Phase 2 converts the
  ported ones to TypeScript against the new shared component library — reading
  them is the point of keeping this folder.

## Why it was kept in place

The repository strategy is decided (Rule #2): the existing repo is kept, the
new build lives at the root, and history, issues and links are preserved. A new
repo was rejected.

## The backend behind it

§Q Phase 7 runs the migration as a **parallel-run cutover, not a big bang**:
both apps live during beta, accounts migrate in batches with per-account
reconciliation, and `webdocflow.com` points at the new app only after totals
match. The legacy backend stays **readable — never writable** — for a grace
window after that.

See `docs/phase-0/secrets-scan.md` for the history scan run before this move,
including the one carry-forward item for the Phase 7 cutover.
