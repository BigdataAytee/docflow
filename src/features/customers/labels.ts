/**
 * Customer labels (§E customers.labels[], §Q Phase 2.5).
 *
 * Labels are the one place the app lets an owner invent their own vocabulary —
 * "Wholesale", "Church", "Pays late". So the rules are deliberately thin:
 *
 *  · **Nothing is required** (Rule #1). A business that never adds a label
 *    never sees a label control, a filter row or an empty chip strip.
 *  · **Nothing is invented.** There is no starter set and no suggested list.
 *    A label exists because somebody typed it.
 *  · **Case and spacing are not two labels.** "wholesale" and "Wholesale " are
 *    the same one, kept in the spelling used most, so the filter row does not
 *    fill up with near-duplicates.
 */

export const MAX_LABEL_LENGTH = 24

export class LabelError extends Error {}

export const normalizeLabel = (label: string): string =>
  label.trim().replace(/\s+/g, ' ').toLocaleLowerCase()

/** Trimmed and collapsed, but in the owner's own casing. */
export function cleanLabel(label: string): string {
  const cleaned = label.trim().replace(/\s+/g, ' ')
  if (cleaned === '') throw new LabelError('A label needs a word.')
  if (cleaned.length > MAX_LABEL_LENGTH) {
    throw new LabelError(`A label is at most ${MAX_LABEL_LENGTH} characters, got ${cleaned.length}.`)
  }
  return cleaned
}

/** Adds a label without duplicating one that differs only in case or spacing. */
export function addLabel(labels: readonly string[], label: string): string[] {
  const cleaned = cleanLabel(label)
  const key = normalizeLabel(cleaned)
  if (labels.some((existing) => normalizeLabel(existing) === key)) return [...labels]
  return [...labels, cleaned]
}

export function removeLabel(labels: readonly string[], label: string): string[] {
  const key = normalizeLabel(label)
  return labels.filter((existing) => normalizeLabel(existing) !== key)
}

export const hasLabel = (labels: readonly string[], label: string): boolean =>
  labels.some((existing) => normalizeLabel(existing) === normalizeLabel(label))

export interface LabelledRecord {
  readonly labels: readonly string[]
}

/**
 * Every label in use, commonest first — the filter row, in the order that puts
 * the useful ones where a thumb already is.
 */
export function labelsInUse(records: readonly LabelledRecord[]): string[] {
  const counts = new Map<string, { spelling: string; count: number }>()
  for (const record of records) {
    for (const label of record.labels) {
      const key = normalizeLabel(label)
      const current = counts.get(key)
      counts.set(key, { spelling: current?.spelling ?? label, count: (current?.count ?? 0) + 1 })
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.spelling.localeCompare(b.spelling))
    .map((entry) => entry.spelling)
}

/** No selection means no filtering — never an empty list because nothing is ticked. */
export function filterByLabels<T extends LabelledRecord>(
  records: readonly T[],
  selected: readonly string[],
): T[] {
  if (selected.length === 0) return [...records]
  const keys = selected.map(normalizeLabel)
  return records.filter((record) => keys.every((key) => hasLabel(record.labels, key)))
}
