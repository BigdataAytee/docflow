/**
 * The containment check both file-writing generators share.
 *
 * It had no test, which is how it stayed broken on Windows without anybody
 * noticing: the failure mode there is a REFUSAL, and a generator that refuses
 * everything looks like a generator that had nothing to do.
 */

import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { isInside, resolveInside } from './outputPath'

const ROOT = resolve('/tmp/out')

describe('Resolving a generated path inside its output root', () => {
  it('accepts an ordinary name', () => {
    expect(resolveInside(ROOT, 'index.html')).toBe(resolve(ROOT, 'index.html'))
  })

  it('accepts a nested one', () => {
    expect(resolveInside(ROOT, 'invoice-maker/index.html')).toBe(
      resolve(ROOT, 'invoice-maker/index.html'),
    )
  })

  it('refuses a name that climbs out', () => {
    expect(resolveInside(ROOT, '../escaped.html')).toBeNull()
    expect(resolveInside(ROOT, 'a/../../escaped.html')).toBeNull()
  })

  it('refuses an absolute name, which ignores the root entirely', () => {
    expect(resolveInside(ROOT, resolve('/etc/passwd'))).toBeNull()
  })

  it('refuses the root itself, which is a directory and not a file', () => {
    expect(resolveInside(ROOT, '.')).toBeNull()
    expect(resolveInside(ROOT, '')).toBeNull()
  })

  it('accepts a name that merely starts with the same letters as a sibling', () => {
    // The string-prefix version got this right only because of its trailing
    // separator. Worth keeping honest: `/tmp/outsider` is not inside
    // `/tmp/out`.
    expect(isInside(ROOT, '../outsider/x.html')).toBe(false)
  })

  it('does not depend on which separator the platform uses', () => {
    // The whole bug: `resolve()` returns backslashes on Windows, so a check
    // written against a hard-coded `/` refused every legitimate path there.
    // A forward-slashed name is valid input on both platforms.
    expect(isInside(ROOT, 'a/b/c.html')).toBe(true)
  })
})
