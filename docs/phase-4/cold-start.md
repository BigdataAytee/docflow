# Cold start, measured (§Q Phase 4)

> §Q Phase 4: *"Performance: cold start < 2s to an interactive dashboard from
> SQLite."*

Measured on a **Pixel 9 Pro XL, Android 17, 16GB RAM** — a Tier-A flagship —
by `tools/device/gate.ts`, from the device's own log timestamps. Raw results in
`device-gate-46061FDAS001CS.json`.

## What the numbers are

| Launch | Time | Against §Q's budget |
| --- | --- | --- |
| **Everyday cold start** — process killed, database already there | **1829 ms** | ✅ passes (< 2000 ms) |
| First launch after install — creates the database, runs every migration | 2130 ms | no budget; paid once |

The everyday figure is the one §Q's clause is about. "From SQLite" describes an
app *reading its records*, which is what an owner does every morning. The
first-run figure is reported beside it rather than folded in, because folding it
in would fail a clause on a cost nobody pays twice — and dropping it would hide
the slowest moment in the product, which is also a first impression.

## Where the time goes

From the in-app marks, on the everyday launch:

```
~630 ms   Android starts the process, the WebView initialises, the bundle parses
   7 ms   the SQLite chunks load
1178 ms   openLocalStore() — key from secure storage, SQLCipher opens the file
  17 ms   reading the company row
─────────
1829 ms   to a usable dashboard
```

**Almost two thirds of the cold start is SQLCipher deriving the key.** That is
256,000 rounds of PBKDF2-HMAC-SHA512, SQLCipher 4's default, applied on every
open. It is not our code and `@capacitor-community/sqlite` exposes no way to
change it: the value lives inside the bundled native library, and the plugin's
API surface has no `kdf_iter` anywhere in it (checked against 8.1.1).

## What was tried and did not work

**Starting the store open at module evaluation**, before React mounts, so the
key derivation would overlap with the first render. Measured: 2248 ms before,
2281 ms after — inside the noise. Reverted, with a note in `src/main.tsx` so
nobody spends the afternoon on it again.

The reason it cannot work is that the phases are already strictly sequential.
The WebView has to boot before any JavaScript runs at all, and React's mount is
roughly 50 ms against SQLCipher's 1200. There is no idle time to move work into.

## What would actually help, in order of honesty

1. **Fewer KDF rounds.** A high iteration count exists to make *low-entropy*
   passwords expensive to brute-force. DocFlow's passphrase is 256 bits from
   the platform CSPRNG, held in the hardware Keystore (`src/data/sqlite/key.ts`)
   — there is no search space for stretching to slow down. An attacker without
   the key gains nothing from 256,000 rounds, and one who has it does not care.
   This is the standard analysis and it points at a large, safe win.

   **It is not taken here.** It needs a patched or forked plugin, and it is a
   security-relevant change that should be a recorded decision with an owner's
   name against it, not a performance tweak made in passing. Raised in PLAN.md
   under Phase 4.

2. **Do not block the dashboard on the database.** CLAUDE.md already requires a
   skeleton on every screen. The shell could paint at ~650 ms and fill in at
   ~1830 ms. This is a genuine improvement to what the owner *experiences* — but
   it does not make the clause true, because a skeleton is not "an interactive
   dashboard from SQLite", and quietly redefining the clause to fit the number
   is the thing PLAN.md exists to prevent.

## The part this does not establish

**This is one device, and it is the most expensive phone in the range.**

§Q Phase 0 fixes the target as "the three cheapest realistic market phones
(3GB-class devices included — not a flagship)". A 3–4GB device has a slower
CPU, and the KDF is pure CPU: 1200 ms here could plausibly be 2500 ms there,
which would blow the whole budget on the key alone.

So the clause is recorded as **passed on Tier-A hardware and unestablished
below it**. A budget phone is the outstanding evidence, and it is the same
device the Phase 0 AI spike has been waiting for.

The database was also close to empty. A populated store adds read time that
this measurement does not include; the §Q clause is about the dashboard, whose
queries are bounded, but it is not zero and has not been measured.
