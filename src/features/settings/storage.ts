/**
 * How much of this phone the records are using (§G).
 *
 * §G's Settings list says Data & sync carries "upload state, STORAGE USED,
 * export all my data, sync-conflict demo", and the reference has the card:
 * "Documents (23) · 1.2 MB" over "Photos, logos, signatures · 3.4 MB". The
 * split is the useful part — a phone filling up is almost always filling up
 * with images, and an owner who can see that can do something about it.
 *
 * MEASURED, NOT ESTIMATED. Every asset in this app is a `data:` URL (§M:
 * nothing needed to open a saved document touches a CDN), so the bytes are in
 * hand and can simply be counted. Nothing here asks the platform for a disk
 * figure — that would be a different number, including the database's own
 * overhead, and it would not be available in a browser at all.
 *
 * The arithmetic lives apart from the screen so the rounding can be tested
 * without rendering anything.
 */

/** Payload bytes behind a `data:` URL, without decoding it. */
export function dataUrlBytes(url: string): number {
  const comma = url.indexOf(',')
  if (comma === -1) return 0

  const payload = url.slice(comma + 1)
  if (!/;base64$/i.test(url.slice(0, comma))) {
    // A plain (percent-encoded) data URL. Rare here, but counting it as zero
    // would quietly under-report a real file.
    return payload.length
  }

  // Four base64 characters carry three bytes; `=` padding carries none.
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding)
}

/**
 * Bytes as a short, honest string.
 *
 * Rounded to one decimal at MB and to whole units below, because "1.2 MB" is
 * what the reference shows and what a person can act on — nobody needs
 * `1,258,291 bytes`. Never rounds a non-zero size down to "0", which would
 * read as "nothing is stored" while a file sits there.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB'
  if (bytes < 1024) return '1 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
