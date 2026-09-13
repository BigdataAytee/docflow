/**
 * Turning what someone typed into a search box into a PostgREST filter.
 *
 * Two separate hazards, and only the first is obvious:
 *
 *  · **Filter syntax.** PostgREST reads `or=(...)` as a comma-separated list,
 *    so a comma or a paren in the query would be parsed as more filters rather
 *    than as text — a customer called "Okoro, Sons & Co" would produce a
 *    malformed request, not a bad result.
 *  · **Silent wildcards.** `*` and `%` both mean "anything" to an `ilike`
 *    filter. Left in, a search for "50%" quietly matches every row that starts
 *    with "50" — broader than what was asked for, with nothing on screen to
 *    say so. Widening a search without being asked is the same class of error
 *    as narrowing it.
 *
 * Both are stripped rather than escaped: PostgREST's `like` has no ESCAPE
 * clause to hang an escape on, and this is a search box — dropping punctuation
 * still finds the row, which is what the person typing wants.
 *
 * `_` is deliberately left alone. It matches a single character, so it
 * over-matches by at most a little, and stripping it would break searching for
 * an email address — which is one of the fields this searches.
 */
export function searchable(query: string): string {
  return query.trim().replace(/[,()\\*%]/g, ' ').trim()
}

/** `ilike` on every listed column, as one PostgREST `or` group. */
export function anyColumnLike(columns: readonly string[], query: string): string {
  return columns.map((column) => `${column}.ilike.%${query}%`).join(',')
}
