/**
 * Resolving a generated file's path, and refusing one that escapes.
 *
 * Two generators write files from data — the site emitter and the screenshot
 * capture — and both must answer the same question before writing: does this
 * path stay inside the directory I was given? A generated name comes from a
 * table, and a table is data; `../../etc/passwd` is a path a table can hold.
 *
 * Both of them asked it like this:
 *
 *     target.startsWith(`${root}/`)
 *
 * which is wrong on Windows and quietly so. `resolve()` returns the
 * platform's own separator, so on Windows `target` is `C:\out\a.html` while
 * the prefix being tested is `C:\out/` — no match, every legitimate path
 * refused, and a generator that writes nothing at all. The screenshot run
 * reported "the path escapes the output directory" for every frame.
 *
 * `relative()` is the check that is correct everywhere: it speaks the
 * platform's separators on both sides, and it answers containment directly.
 * A contained path yields something that does not start with `..` and is not
 * itself absolute.
 *
 * This lives in `src/` rather than `tools/` because `tools/screenshots`
 * already imports from `src/marketing`, and one copy of a containment check
 * is worth more than a convenient home for it.
 */

import { isAbsolute, relative, resolve } from 'node:path'

/**
 * Resolve `name` inside `root`, or `null` if it would land outside.
 *
 * Returning the resolved path rather than a boolean is deliberate: a caller
 * that got `true` still has to resolve the path itself, and the second
 * resolution is where the two can disagree.
 */
export function resolveInside(root: string, name: string): string | null {
  const target = resolve(root, name)
  const step = relative(root, target)

  // Empty means the target IS the root — a directory, not a file to write.
  if (step === '') return null
  // `..` anywhere at the front means it climbed out. An absolute result means
  // `name` was absolute and ignored the root entirely.
  if (step.startsWith('..') || isAbsolute(step)) return null

  return target
}

/** Whether `name` stays inside `root`. For assertions that want a boolean. */
export const isInside = (root: string, name: string): boolean =>
  resolveInside(root, name) !== null
