/**
 * Starting on a phone (§Q Phase 4, §M, §R).
 *
 * The native half of the composition root. `main.tsx` still reads the
 * environment and still hands `App` a loader; this is what that loader does
 * when it is running inside the shell rather than in a browser.
 *
 * §Q Phase 4's performance clause is the shape of this file: "cold start < 2s
 * to an interactive dashboard from SQLite". So the work is ordered by what the
 * first frame needs, and nothing that can wait is awaited:
 *
 *  1. open the encrypted database and migrate (nothing renders without it);
 *  2. seed the company row if this is a first run;
 *  3. hand back repositories — the dashboard can paint now;
 *  4. THEN hide the splash, set the status bar and wire the back button.
 *
 * Steps 3 and 4 are in that order deliberately. Capacitor's splash hides
 * itself after a fixed delay by default, which is a spinner wearing a costume:
 * it neither waits for the app to be ready nor gets out of the way when it is.
 * `launchAutoHide: false` plus hiding it HERE means the splash lasts exactly
 * as long as the work does — the honest version of both.
 */

import type { Repositories } from '../data/repositories'
import type { openLocalStore as openLocalStoreType } from '../data/sqlite/open'
import { regionProfile } from '../features/settings/region'

export interface NativeBackend {
  readonly companyId: string
  readonly repositories: Repositories
  /** False only if the store opened unencrypted, which on a device is a bug. */
  readonly encrypted: boolean
  /**
   * How long the encrypted store took to open and migrate.
   *
   * NOT the cold-start number. §Q Phase 4 asks for "cold start < 2s to an
   * interactive dashboard", which starts when the owner taps the icon — it
   * includes Android starting the process, the WebView initialising and the
   * bundle parsing, none of which this timer is running for. Measuring the
   * part that is easy to measure and labelling it as the part §Q asks about
   * is how a budget gets reported as met while the app still feels slow.
   *
   * The real number is taken by `tools/device/gate.ts` from the wall clock,
   * between the launch and the READY line below.
   */
  readonly storeOpenMs: number
  /**
   * Where that time went, milliseconds since this function started.
   *
   * Here because the first device run came in at 1396ms for a store with
   * nothing in it, which is not a number anybody could act on without knowing
   * which part of it was slow.
   */
  readonly marks: Readonly<Record<string, number>>
}

/** The single company this install holds until sign-in replaces it (§R). */
export const LOCAL_COMPANY_ID = 'co_local'

/** Logged when the dashboard could be used. Read by `tools/device/gate.ts`. */
export const READY_MARKER = 'DOCFLOW_READY'

/**
 * True when running inside the native shell.
 *
 * Not a user-agent test: a phone BROWSER is also Android, and it must get the
 * web build.
 */
export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export async function openNativeBackend(region = 'NG'): Promise<NativeBackend> {
  const started = performance.now()
  const marks: Record<string, number> = {}
  const mark = (name: string): void => {
    marks[name] = Math.round(performance.now() - started)
  }

  const [{ openLocalStore }, { createSqliteRepositories }] = await Promise.all([
    import('../data/sqlite/open'),
    import('../data/sqlite/repositories'),
  ])
  mark('chunksLoaded')

  const store = await openLocalStore()
  mark('storeOpen')
  const repositories = createSqliteRepositories(store.driver)

  // §R: business country is "pre-filled from the phone". The row must exist
  // before any screen reads a currency, so it is written here rather than by
  // the first screen that happens to need it.
  const existing = await repositories.companies.get(LOCAL_COMPANY_ID)
  mark('companyRead')
  if (existing === null) {
    const profile = regionProfile(region)
    await store.driver.transaction(async (tx) => {
      await tx.run(
        `insert into companies (id, name, locale_region, locale_language, currency, name_style, logo_size)
         values (?, '', ?, 'en', ?, 'classic', 'M')`,
        [LOCAL_COMPANY_ID, region, profile.currency],
      )
    })
  }

  mark('seeded')

  const backend: NativeBackend = {
    companyId: LOCAL_COMPANY_ID,
    repositories,
    encrypted: store.encrypted,
    storeOpenMs: Math.round(performance.now() - started),
    marks,
  }

  // The moment an owner could use the dashboard. Logged so the runner can
  // timestamp it against the launch, which is the only place both ends of
  // §Q's cold-start budget are visible.
  console.log(READY_MARKER)

  // The device gate (§Q Phase 4, §Q Phase 1). Built into a SEPARATE bundle —
  // `npm run build:gate` — rather than guarded by a runtime flag, so the
  // checks cannot run in a shipped app and the shipped app carries none of
  // this code. It runs after the backend resolves so the cold-start number it
  // reports is the real one.
  if (import.meta.env.VITE_DEVICE_GATE === '1') {
    void reportGate(store.driver, backend)
  }

  return backend
}

/**
 * Where the mid-draft document is remembered across the force-kill.
 *
 * §Q Phase 2's gate ends "force-kill mid-draft → reopen and recover", and that
 * cannot be checked inside one process — the app has to actually die. So the
 * journey runs in two halves across two launches, and the handle to the draft
 * has to survive in the one place that survives: the encrypted database.
 *
 * `sync_state` rather than `localStorage`, deliberately. WebView storage is
 * cleared by "clear cache" in Android's settings, so a recovery test resting on
 * it could pass while the records it claims to have recovered were gone.
 */
const JOURNEY_KEY = 'gate_journey_draft'

async function reportGate(
  driver: Awaited<ReturnType<typeof openLocalStoreType>>['driver'],
  backend: NativeBackend,
): Promise<void> {
  try {
    const { runDeviceGate, reportLine } = await import('./gate')
    const { journeyAfterKill } = await import('./journey')

    const report = await runDeviceGate({
      driver,
      storeOpenMs: backend.storeOpenMs,
      marks: backend.marks,
      claimedEncrypted: backend.encrypted,
    })

    // Is this the launch AFTER the kill? The database says so, not a flag the
    // runner passed in — the point of the clause is that the phone remembers.
    const pending = await driver.get('select value from sync_state where key = ?', [JOURNEY_KEY])

    const journey =
      pending === null
        ? await runFirstHalf(driver, backend)
        : await journeyAfterKill(
            backend.repositories,
            backend.companyId,
            { documentId: String(pending['value']) },
          )

    console.log(reportLine({ ...report, results: [...report.results, ...journey] }))
  } catch (cause) {
    console.log(
      `DOCFLOW_GATE {"error":${JSON.stringify(
        cause instanceof Error ? cause.message : String(cause),
      )}}`,
    )
  }
}

async function runFirstHalf(
  driver: Awaited<ReturnType<typeof openLocalStoreType>>['driver'],
  backend: NativeBackend,
): Promise<Awaited<ReturnType<typeof import('./gate').runDeviceGate>>['results']> {
  const { journeyBeforeKill } = await import('./journey')
  const { results, draft } = await journeyBeforeKill({
    repositories: backend.repositories,
    companyId: backend.companyId,
    run: 'a',
  })

  if (draft !== null) {
    await driver.transaction(async (tx) => {
      await tx.run(
        'insert into sync_state (key, value) values (?, ?) ' +
          'on conflict(key) do update set value = excluded.value',
        [JOURNEY_KEY, draft.documentId],
      )
    })
  }

  return results
}

/**
 * Everything the shell needs that the first frame does not.
 *
 * Called AFTER the backend resolves, so none of it is on the cold-start path.
 * Each import is dynamic and each failure is swallowed on purpose: a missing
 * status-bar plugin must not be the reason an owner cannot open an invoice.
 */
export async function settleShell(): Promise<void> {
  await Promise.allSettled([hideSplash(), paintStatusBar()])
}

async function hideSplash(): Promise<void> {
  const { SplashScreen } = await import('@capacitor/splash-screen')
  await SplashScreen.hide()
}

async function paintStatusBar(): Promise<void> {
  const { StatusBar, Style } = await import('@capacitor/status-bar')
  // The app draws behind the status bar so the header's gradient reaches the
  // top edge (§F). The safe-area insets in `index.css` are what keep content
  // out from under it — without them this would be a bug, not a style.
  await StatusBar.setOverlaysWebView({ overlay: true })
  await StatusBar.setStyle({ style: Style.Light })
}
