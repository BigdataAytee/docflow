/**
 * The visible mark on a sample record (§R: "sample records are visually
 * labelled").
 *
 * Deliberately loud. A sample that looked like real work would put figures in
 * front of someone that are not theirs, which is the failure §R is guarding
 * against — so this is a filled badge, not a subtle tint.
 */

export function SampleBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex min-h-[20px] items-center rounded bg-status-warn px-1.5 text-[10px] font-black tracking-wider text-white"
      // Announced, not just seen — colour alone is never the carrier (§K).
      role="note"
      aria-label={label}
    >
      {label}
    </span>
  )
}
