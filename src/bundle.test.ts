/**
 * What a person downloads before they see anything (Rule #1).
 *
 * The thing worth guarding is not a number in a build log — nobody reads one,
 * and it drifts a kilobyte at a time. It is a REACHABILITY question: is the
 * Supabase client reachable from the entry point by STATIC imports?
 *
 * If it is, it lands in the first chunk and everyone pays for it — including a
 * customer opening a public link, who has no account and whose page talks to
 * the edge function over plain `fetch`. That is the cheapest phone on the
 * slowest connection paying for a feature it never uses. It is 59 kB gzipped
 * against a 122 kB first chunk, so it is not a rounding error either.
 *
 * One static import anywhere in the graph undoes the split, silently, with
 * every other test still passing. So the graph is walked here.
 *
 * **What this does NOT measure**, stated so nobody reads more into a pass than
 * is there: module reachability is not bundle contents. Rollup still
 * tree-shakes unused exports out of a module that IS reached, so an unused
 * function in a reachable file costs nothing and this file would not know.
 * That is fine for the thing being guarded — importing `@supabase/supabase-js`
 * pulls a client with side effects, which no tree-shaking removes.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(import.meta.dirname)

/**
 * Static imports only — `import(...)` is deliberately not matched, since the
 * whole point is to tell the two apart.
 *
 * The character class excludes `(` and `;` as well as quotes, which is what
 * keeps a dynamic `import('./x')` from being read as the start of a later
 * static `from 'y'`. It is also why there is no alternation in the quantifier:
 * `(?:[^'"();]|\n)*?` looks equivalent and backtracks exponentially, because
 * `\n` is already in the class.
 */
const IMPORT =
  /\b(?:import|export)\b[^'"(;]*?\bfrom\s*['"]([^'"]+)['"]|^[ \t]*import\s*['"]([^'"]+)['"]/gm

function staticImportsOf(file: string): string[] {
  const found: string[] = []
  for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
    const specifier = match[1] ?? match[2]
    if (specifier !== undefined) found.push(specifier)
  }
  return found
}

function resolveLocal(from: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(from), specifier)
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

/**
 * One separator, whatever the platform.
 *
 * `resolve()` and `join()` hand back backslashes on Windows, and the
 * assertions below ask about paths with `/` in them — so every one of them
 * silently matched nothing there, and a Supabase import would have sailed
 * through the check that exists to stop it. Normalising at the point files
 * enter the set means the set has one shape and the assertions can be read.
 */
const posix = (file: string) => file.split('\\').join('/')

function reachable(entry: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>()
  const packages = new Set<string>()
  const queue = [entry]

  while (queue.length > 0) {
    const file = queue.pop()
    if (file === undefined || files.has(posix(file))) continue
    files.add(posix(file))

    for (const specifier of staticImportsOf(file)) {
      if (specifier.startsWith('.')) {
        const target = resolveLocal(file, specifier)
        if (target !== null && !files.has(posix(target))) queue.push(target)
      } else if (!specifier.endsWith('.css')) {
        packages.add(specifier)
      }
    }
  }
  return { files, packages }
}

const short = (file: string) => file.replace(posix(SRC), 'src')

describe('The first chunk carries only what everyone needs (Rule #1)', () => {
  const graph = reachable(join(SRC, 'main.tsx'))

  it('does not reach the Supabase client from the entry point', () => {
    expect([...graph.packages].filter((p) => p.startsWith('@supabase'))).toEqual([])
  })

  it('does not reach any Supabase module of our own either', () => {
    // `src/data/supabase/*` is what imports the client, so reaching one of
    // those statically drags the package in behind it — which is exactly how
    // this regresses in practice: not by importing the package, but by
    // importing something that does.
    expect([...graph.files].filter((f) => f.includes('/data/supabase/')).map(short)).toEqual([])
  })

  it('still reaches the public link page, which any visitor may need', () => {
    // The other half. A split that deferred the thing a customer actually came
    // for would be worse than the weight it saved.
    expect([...graph.files].some((f) => f.endsWith('/public/PublicLinkPage.tsx'))).toBe(true)
  })

  it('walks a real graph rather than an empty one', () => {
    // Guards the guard: a broken resolver would make every assertion above
    // pass by finding nothing at all.
    expect(graph.files.size).toBeGreaterThan(100)
    expect([...graph.packages]).toContain('react')
  })

  it('tells a dynamic import apart from a static one', () => {
    // The distinction the whole file rests on, checked directly rather than
    // assumed — `backend.ts` reaches Supabase ONLY through `import()`.
    const backend = join(SRC, 'data', 'backend.ts')
    expect(readFileSync(backend, 'utf8')).toContain("import('./supabase/client')")
    expect(staticImportsOf(backend).filter((s) => s.includes('supabase'))).toEqual([])
  })
})
