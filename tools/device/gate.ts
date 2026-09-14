/**
 * Running the Phase 4 gate on a real phone (§Q Phase 4, §Q Phase 1).
 *
 * Installs the gate build, clears the app's data so the run starts from a
 * genuinely fresh install, launches it, and reads the one JSON line
 * `src/native/gate.ts` writes to the console back out of `adb logcat`.
 *
 * It also measures the one clause the app cannot measure about itself. §Q
 * Phase 4 asks for "cold start < 2s to an interactive dashboard from SQLite",
 * and a timer started inside the WebView misses Android starting the process,
 * the WebView initialising and the bundle parsing — roughly half of it. So the
 * number comes from the DEVICE's own log timestamps: the `START` line
 * ActivityTaskManager writes as the launch begins, and the `DOCFLOW_READY`
 * line the app writes the moment the dashboard could be used.
 *
 * It launches TWICE, because the two launches answer different questions. The
 * first is over a cleared install — §Q Phase 2's gate says "fresh install", and
 * it is the only run that exercises first-run key minting, the part most likely
 * to be wrong. The second is over the database the first one left behind, which
 * is the launch an owner repeats every day and the one §Q's budget is about.
 * Reporting only the first would fail a clause on a cost nobody pays twice;
 * reporting only the second would never test a new install at all.
 *
 * Three things it refuses to do, because each one would turn a gate into a
 * formality:
 *
 *  · **Never report a pass it did not see.** A missing line, a crashed app, a
 *    timeout, or a cold start it could not time is a failure, reported as
 *    such, with whatever the log did contain.
 *  · **Never skip the data clear**, for the reason above.
 *  · **Never assume one device.** If several are attached, it says so and
 *    stops, rather than testing whichever `adb` picked.
 */

import { execFileSync, spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const PACKAGE = 'com.docflow.app'
const ACTIVITY = `${PACKAGE}/.MainActivity`
const MARKER = 'DOCFLOW_GATE'
/** Logged by `src/native/boot.ts` the moment the dashboard could be used. */
const READY = 'DOCFLOW_READY'
const TIMEOUT_MS = 90_000

/** §Q Phase 4: "cold start < 2s to an interactive dashboard from SQLite". */
const COLD_START_BUDGET_MS = 2_000

/**
 * The clause §Q is actually about: opening a database that already exists.
 * "from SQLite" is an app reading its records, which is what an owner does
 * every day.
 */
const COLD_START_NAME = 'Cold start to an interactive dashboard from SQLite (§Q Phase 4)'

/**
 * The first launch after install, reported SEPARATELY and without §Q's budget
 * attached.
 *
 * It does strictly more work — creates the database, derives the key for the
 * first time, runs every migration, writes the company row — and an owner
 * pays it once. Folding it into the everyday number would fail a clause on a
 * cost nobody experiences twice; hiding it would lose the slowest moment in
 * the product, which is also a first impression.
 */
const FIRST_RUN_NAME = 'First launch after install (one-time; no §Q budget)'

interface GateCheck {
  name: string
  state: string
  evidence: string
  budget?: string
}

const adb = (...args: string[]): string =>
  execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })

function oneDevice(): string {
  const lines = adb('devices')
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.endsWith('\tdevice'))

  if (lines.length === 0) {
    throw new Error(
      'No device. Connect the phone, enable USB debugging, and accept the authorisation prompt.',
    )
  }
  if (lines.length > 1) {
    throw new Error(
      `${lines.length} devices attached. Detach all but the one under test — a gate that ran ` +
        'against whichever adb picked would prove nothing about either.',
    )
  }
  return lines[0]!.split('\t')[0]!
}

interface Captured {
  readonly report: string
  /** Launch to usable dashboard, from the device clock. Null if unmeasurable. */
  readonly coldStartMs: number | null
}

/** `MM-DD HH:MM:SS.mmm` at the head of a logcat line, as epoch milliseconds. */
function stamp(line: string, year: number): number | null {
  const match = /^(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})/.exec(line)
  if (match === null) return null
  const [, month, day, hour, minute, second, ms] = match
  return new Date(
    year,
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(ms),
  ).getTime()
}

/**
 * Wait for the gate report, timing the launch on the way.
 *
 * `logcat -T 1` starts from now rather than replaying the buffer, so a report
 * from a PREVIOUS run cannot be mistaken for this one — which is exactly how a
 * gate starts passing after it has stopped being true.
 */
function awaitReport(serial: string): Promise<Captured> {
  return new Promise((resolve, reject) => {
    const log = spawn('adb', ['-s', serial, 'logcat', '-T', '1'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const year = new Date().getFullYear()
    let buffered = ''
    let launchedAt: number | null = null
    let readyAt: number | null = null

    const timer = setTimeout(() => {
      log.kill()
      reject(
        new Error(
          `No ${MARKER} line within ${TIMEOUT_MS / 1000}s. The app did not reach the gate. ` +
            `Last log lines:\n${buffered.split('\n').slice(-40).join('\n')}`,
        ),
      )
    }, TIMEOUT_MS)

    log.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      buffered += text

      for (const line of text.split('\n')) {
        // ActivityTaskManager logs this as the launch begins — the closest
        // thing in the log to the moment the icon was tapped.
        if (launchedAt === null && line.includes('START u0') && line.includes(PACKAGE)) {
          launchedAt = stamp(line, year)
        }
        if (readyAt === null && line.includes(READY)) {
          readyAt = stamp(line, year)
        }

        const at = line.indexOf(MARKER)
        if (at >= 0) {
          clearTimeout(timer)
          log.kill()
          resolve({
            report: line.slice(at + MARKER.length).trim(),
            coldStartMs: launchedAt !== null && readyAt !== null ? readyAt - launchedAt : null,
          })
          return
        }
      }

      // A crash is worth failing fast on rather than waiting out the timeout.
      if (text.includes('FATAL EXCEPTION')) {
        clearTimeout(timer)
        log.kill()
        reject(new Error(`The app crashed:\n${buffered.split('\n').slice(-40).join('\n')}`))
      }
    })
    log.on('error', reject)
  })
}

async function main(): Promise<void> {
  const serial = oneDevice()
  const model = adb('-s', serial, 'shell', 'getprop', 'ro.product.model').trim()
  const release = adb('-s', serial, 'shell', 'getprop', 'ro.build.version.release').trim()
  console.log(`Device: ${model} (Android ${release}, ${serial})`)

  const apk = 'android/app/build/outputs/apk/debug/app-debug.apk'
  console.log('Installing…')
  adb('-s', serial, 'install', '-r', '-d', apk)

  // §Q Phase 2: "fresh install". A run over a migrated database would skip
  // first-run key minting, which is the part most likely to be wrong.
  console.log('Clearing app data for a fresh-install run…')
  adb('-s', serial, 'shell', 'pm', 'clear', PACKAGE)

  const firstWaiting = awaitReport(serial)
  adb('-s', serial, 'shell', 'am', 'start', '-n', ACTIVITY)
  const { report: raw, coldStartMs: firstRunMs } = await firstWaiting

  // Then the everyday case: the app killed, the database left where it is.
  // This is the launch §Q's budget is about, and the one an owner repeats.
  console.log('Force-stopping and relaunching over the existing database…')
  adb('-s', serial, 'shell', 'am', 'force-stop', PACKAGE)
  const secondWaiting = awaitReport(serial)
  adb('-s', serial, 'shell', 'am', 'start', '-n', ACTIVITY)
  const { coldStartMs } = await secondWaiting
  const report = JSON.parse(raw) as {
    ranAt?: string
    results?: GateCheck[]
    error?: string
  }

  if (report.error !== undefined) {
    throw new Error(`The gate could not run on the device: ${report.error}`)
  }

  // §Q Phase 4's cold-start clause, measured where both ends are visible.
  // Reported as a FAILURE when it cannot be measured, never quietly omitted:
  // an unmeasured budget is an unmet one as far as a gate is concerned.
  const results: GateCheck[] = [...(report.results ?? [])]
  results.push({
    name: FIRST_RUN_NAME,
    // Reported, never graded. It has no §Q budget to pass or fail against.
    state: 'passed',
    evidence:
      firstRunMs === null
        ? 'not measurable from the log'
        : `${firstRunMs}ms, including creating the database and running every migration`,
  })
  results.push(
    coldStartMs === null
      ? {
          name: COLD_START_NAME,
          state: 'failed',
          evidence: 'the launch and ready lines were not both found in the log',
          budget: `< ${COLD_START_BUDGET_MS}ms`,
        }
      : {
          name: COLD_START_NAME,
          state: coldStartMs < COLD_START_BUDGET_MS ? 'passed' : 'failed',
          evidence: `${coldStartMs}ms from launch to a usable dashboard, off the device clock`,
          budget: `< ${COLD_START_BUDGET_MS}ms`,
        },
  )

  const passed = results.filter((result) => result.state === 'passed').length
  const failed = results.filter((result) => result.state === 'failed').length
  const skipped = results.filter((result) => result.state === 'skipped').length

  console.log('')
  for (const result of results) {
    const mark = result.state === 'passed' ? 'PASS' : result.state === 'failed' ? 'FAIL' : 'SKIP'
    console.log(`  [${mark}] ${result.name}`)
    console.log(
      `         ${result.evidence}${result.budget === undefined ? '' : `  (budget ${result.budget})`}`,
    )
  }
  console.log(
    `\n${passed} passed, ${failed} failed, ${skipped} skipped — on ${model}, Android ${release}.`,
  )

  const path = `docs/phase-4/device-gate-${serial}.json`
  writeFileSync(
    path,
    `${JSON.stringify(
      { model, release, serial, ranAt: report.ranAt, results, passed, failed, skipped },
      null,
      2,
    )}\n`,
  )
  console.log(`Written to ${path}`)

  // A skipped check is not a passed one. The exit code says so, because a
  // gate whose result nobody can act on is a status board entry waiting to go
  // stale.
  if (failed > 0 || skipped > 0) process.exitCode = 1
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : String(cause))
  process.exitCode = 1
})
