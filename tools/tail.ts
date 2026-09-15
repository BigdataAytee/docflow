/**
 * Run a command, show only its last lines, and KEEP ITS EXIT CODE.
 *
 * This exists because of a bug that reached a commit message.
 *
 * `npx vitest run 2>&1 | tail -30` is the obvious way to see a long suite's
 * summary without its thousands of lines. It is also a trap: a shell pipeline
 * reports the status of its LAST command, and `tail` always succeeds. So a
 * run with fifteen failures exits 0, and every check downstream of it — a CI
 * step, a `&&` chain, a person reading the line — is told the suite passed.
 * That happened here: a broken suite was read as green and reported as green.
 *
 * `set -o pipefail` fixes it in bash, and should be used when piping by hand.
 * This is the version that cannot be forgotten: the tail is done in-process,
 * after the child has exited, so there is no pipeline to lose a status in.
 *
 *   node --experimental-strip-types tools/tail.ts 30 -- npx vitest run
 *
 * The full output is always written to a file and the path printed, because
 * the whole reason to trim is that the interesting part is somewhere in the
 * middle and you will want it after all.
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const split = argv.indexOf('--')

if (split === -1 || split === argv.length - 1) {
  console.error('Usage: tools/tail.ts <lines> -- <command> [args…]')
  process.exit(64)
}

const lines = Number(argv[0])
if (!Number.isInteger(lines) || lines <= 0) {
  console.error(`Expected a positive number of lines, got "${argv[0]}".`)
  process.exit(64)
}

const [command, ...args] = argv.slice(split + 1)
if (command === undefined) {
  console.error('No command given after --.')
  process.exit(64)
}

/*
 * Windows needs a shell — `npx` there is a `.cmd` shim that cannot be
 * executed directly — and Node warns (DEP0190) if it is handed an argument
 * ARRAY to concatenate into one, so the line is joined here instead. Anywhere
 * else the array goes straight to `execvp` and no shell is involved at all.
 *
 * The joined form takes the command as written: it comes from package.json,
 * not from anything a user typed, so an argument with a space in it would
 * need quoting by whoever wrote the script. Nothing here does.
 */
const child =
  process.platform === 'win32'
    ? spawn([command, ...args].join(' '), { shell: true })
    : spawn(command, args)

let captured = ''
const collect = (chunk: Buffer): void => {
  captured += chunk.toString()
}
child.stdout.on('data', collect)
child.stderr.on('data', collect)

child.on('error', (cause) => {
  console.error(`Could not run ${command}: ${cause.message}`)
  process.exit(127)
})

child.on('close', (code, signal) => {
  const file = join(mkdtempSync(join(tmpdir(), 'docflow-')), 'output.txt')
  writeFileSync(file, captured, 'utf8')

  const all = captured.split('\n')
  if (all.length > lines) console.log(`… ${all.length - lines} earlier lines in ${file}`)
  console.log(all.slice(-lines).join('\n'))
  if (all.length <= lines) console.log(`(full output also at ${file})`)

  // The child's status, not this process's own success at printing it.
  if (signal !== null) {
    console.error(`${command} was killed by ${signal}.`)
    process.exit(1)
  }
  process.exit(code ?? 1)
})
