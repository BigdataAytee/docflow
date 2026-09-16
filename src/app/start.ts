/**
 * Starting the app, on either shell (§C, §Q Phase 4).
 *
 * This exists because of a bug that reached a phone. The native shell — hiding
 * the splash, painting the status bar, marking the document `native` — was
 * wired inside the function that opens the LOCAL store, and `createBackend`
 * only calls that function when no Supabase project is configured. So every
 * account build took the other branch, returned without ever touching the
 * shell, and `launchAutoHide: false` left Capacitor's splash covering a
 * perfectly working app forever.
 *
 * The lesson in the shape of this file: **the shell depends on the PLATFORM,
 * the store depends on the CONFIGURATION, and they are two different
 * questions.** Answering them in one place made one of them unreachable.
 *
 * It is a module of its own rather than a few lines in `main.tsx` for the
 * reason the bug survived: `main.tsx` calls `createRoot`, so no test has ever
 * executed a line of it. Nothing here touches the DOM except through
 * `markNative`, which is passed in.
 */

import type { Backend } from '../data/backend'

/** The parts of `native/boot` this needs, so a test needs no device. */
export interface NativeShell {
  readonly isNativePlatform: () => Promise<boolean>
  readonly settleShell: () => Promise<void>
}

/**
 * Resolves the backend, and settles the native shell around it.
 *
 * `loadBackend` is told whether it is native so the store it opens matches the
 * device, but the shell no longer rides along with that decision.
 *
 * The settle is in a `finally` on purpose. A configured-but-broken project
 * makes `createBackend` throw by design (§R — a broken account is never
 * degraded to a demo), and the screen that says so is behind the splash like
 * everything else. A splash that outlives the failure it is hiding is the
 * original bug wearing a different hat, so the shell settles whether the
 * backend resolved or threw, and the failure still propagates.
 */
export async function startApp(
  loadBackend: (native: boolean) => Promise<Backend>,
  shell: NativeShell,
  markNative: () => void,
): Promise<Backend> {
  const native = await shell.isNativePlatform()
  if (native) markNative()

  try {
    return await loadBackend(native)
  } finally {
    // Not awaited: §Q Phase 4 budgets the cold start to an interactive
    // dashboard, and the status bar is not something the first frame waits on.
    if (native) void shell.settleShell()
  }
}
