/**
 * The reduced-motion sweep (§Q Phase 7, §V, §L9).
 *
 * §V: "Large text, screen readers, keyboard navigation and **reduced motion**
 * work without clipped actions."
 *
 * This one passed on inspection, which is the boring outcome and worth locking
 * anyway: the app animates exactly one thing — the loading skeleton — and it
 * already carries `motion-safe:`, so a person who has asked their phone to
 * stop moving things gets a still skeleton rather than a pulsing one.
 *
 * The rule is cheap to keep and expensive to notice the loss of: nobody
 * reviewing a diff spots a missing `motion-safe:` on a new spinner, and the
 * people it hurts are the ones least likely to file a bug about it.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

const componentFiles = (): string[] =>
  execFileSync('git', ['ls-files', 'src'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))

const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8')

/**
 * Anything that moves. `transition-*` counts: it animates too.
 *
 * Scanned inside `className` only. `transition` is also the name of the
 * document lifecycle method — `actions.transition(id, to)` — and a scan of
 * whole files reported eight of those as unguarded animations. A check that
 * cries wolf on the domain layer is a check somebody turns off.
 */
const CLASS_NAMES = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g
const MOVES = /(?:motion-safe:|motion-reduce:)?(?:animate-(?!none)[a-z0-9-]+|transition(?:-[a-z]+)?)\b/g

function movingClasses(contents: string): string[] {
  const found: string[] = []
  for (const attribute of contents.matchAll(CLASS_NAMES)) {
    const value = attribute[1] ?? attribute[2] ?? attribute[3] ?? ''
    for (const match of value.matchAll(MOVES)) found.push(match[0])
  }
  return found
}

describe('Nothing moves for somebody who asked it not to (§V)', () => {
  it('guards every animation with motion-safe', () => {
    const unguarded: string[] = []

    for (const file of componentFiles()) {
      for (const whole of movingClasses(read(file))) {
        if (whole.startsWith('motion-safe:') || whole.startsWith('motion-reduce:')) continue
        unguarded.push(`${file}: ${whole}`)
      }
    }

    expect(unguarded, unguarded.join('\n')).toEqual([])
  })

  it('catches an unguarded animation if one arrives', () => {
    expect(movingClasses('className="animate-spin rounded-full"')).toEqual(['animate-spin'])
  })

  it('accepts a guarded one', () => {
    const hits = movingClasses('className="motion-safe:animate-pulse"').filter(
      (whole) => !whole.startsWith('motion-safe:'),
    )

    expect(hits).toEqual([])
  })

  it('does not mistake the lifecycle method for an animation', () => {
    // `actions.transition(id, to)` is §M's document transition, not motion.
    expect(movingClasses('await actions.transition(record.id, step)')).toEqual([])
  })
})
