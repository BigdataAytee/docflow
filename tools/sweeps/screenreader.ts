/**
 * The screen-reader sweep (§Q Phase 7, §V).
 *
 * §V: "Large text, **screen readers**, keyboard navigation and reduced motion
 * work without clipped actions."
 *
 * `src/sweeps/a11y.test.tsx` checks the nav's names in jsdom. This is the
 * other half, and it needs a real engine for a reason worth stating: a screen
 * reader does not read the DOM. It reads the ACCESSIBILITY TREE the browser
 * hands to the platform API — MSAA/UIA for NVDA, NSAccessibility for
 * VoiceOver — and that tree is the browser's own computation. Names come from
 * the full accname algorithm, not from `aria-label ?? textContent`; roles come
 * from implicit mappings; whole subtrees vanish when something above them is
 * `aria-hidden` or `display:none`. jsdom computes none of it.
 *
 * So the sweep pulls Chromium's real tree over CDP and audits THAT. What it
 * cannot do is listen: speech output, VoiceOver's rotor, TalkBack's gestures
 * and the announcement order a person actually hears still need a human with
 * a device, and PLAN.md says so rather than pretending otherwise.
 *
 * Most of the rules are pure functions over a captured tree, so they run in
 * `npm test` against fixtures with no browser at all. Only the capture needs
 * one.
 */

/** The subset of a CDP `Accessibility.getFullAXTree` node this audit reads. */
export interface AxNode {
  readonly nodeId: string
  readonly ignored?: boolean
  readonly role?: { readonly value?: unknown }
  readonly name?: { readonly value?: unknown }
  readonly childIds?: readonly string[]
  readonly properties?: readonly { readonly name: string; readonly value?: { readonly value?: unknown } }[]
}

export type Rule =
  | 'no-main'
  | 'many-mains'
  | 'heading-jump'
  | 'unnamed-control'
  | 'glyph-name'
  | 'ambiguous-link'
  | 'landmark-name-collides'
  | 'outside-landmark'
  | 'label-on-generic'
  | 'hidden-focusable'
  | 'positive-tabindex'

export interface Finding {
  readonly route: string
  readonly rule: Rule
  readonly detail: string
}

/**
 * Roles a person operates. A node with one of these and no name is announced
 * as bare "button" — the single most common way an app becomes unusable.
 */
const INTERACTIVE = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'combobox',
  'listbox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'treeitem',
])

/**
 * What COUNTS AS A PLACE — the landmarks "browse by landmark" reaches, plus
 * the dialog roles.
 *
 * A dialog is not a landmark, and a control inside a modal one is not
 * stranded either: `aria-modal` scopes the reader to the dialog, which is
 * the whole point of it. The first version of this set left dialogs out and
 * reported every control in the command palette as belonging to nowhere.
 */
const SCOPES = new Set([
  'banner',
  'navigation',
  'main',
  'complementary',
  'contentinfo',
  'search',
  'form',
  'region',
  'dialog',
  'alertdialog',
])

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function roleOf(node: AxNode): string {
  return text(node.role?.value)
}

function nameOf(node: AxNode): string {
  return text(node.name?.value).replace(/\s+/g, ' ').trim()
}

function propertyOf(node: AxNode, name: string): unknown {
  return node.properties?.find((property) => property.name === name)?.value?.value
}

/**
 * Walk the tree in document order, carrying the nearest landmark ancestor.
 *
 * `getFullAXTree` returns a flat array whose order is NOT guaranteed to be
 * document order — the Home dump interleaves a page's paragraphs with its
 * buttons — so heading sequence has to come from the parent/child links, not
 * from the array. Ignored nodes are walked THROUGH but never reported: their
 * children can still be live (an ignored wrapper around a real button).
 */
export interface Place {
  /** Is any landmark an ancestor of this node? */
  readonly landmarked: boolean
  /** The name of the nearest named landmark ancestor, or ''. */
  readonly landmark: string
}

function walk(nodes: readonly AxNode[], visit: (node: AxNode, place: Place) => void): void {
  const byId = new Map(nodes.map((node) => [node.nodeId, node]))
  const seen = new Set<string>()
  const first = nodes[0]
  if (first === undefined) return

  const descend = (node: AxNode, place: Place): void => {
    if (seen.has(node.nodeId)) return
    seen.add(node.nodeId)
    if (node.ignored !== true) visit(node, place)
    const isLandmark = SCOPES.has(roleOf(node))
    const inside: Place = {
      landmarked: place.landmarked || isLandmark,
      landmark: isLandmark ? nameOf(node) : place.landmark,
    }
    for (const childId of node.childIds ?? []) {
      const child = byId.get(childId)
      if (child !== undefined) descend(child, inside)
    }
  }

  descend(first, { landmarked: false, landmark: '' })
}

/**
 * A name made only of symbols, read aloud, is worse than no name: "✕" is
 * announced as "multiplication x" and "⌂" as "house". The test is for a
 * letter or a digit in ANY script, so Arabic and Chinese names pass.
 */
function isGlyphOnly(name: string): boolean {
  return name !== '' && !/[\p{L}\p{N}]/u.test(name)
}

/** The rules that can be decided from the tree alone. */
export function auditTree(route: string, nodes: readonly AxNode[]): Finding[] {
  const findings: Finding[] = []
  const say = (rule: Rule, detail: string) => findings.push({ route, rule, detail })

  let mains = 0
  let lastHeading = 0
  const linksByName = new Map<string, Set<string>>()

  const collisions = new Set<string>()

  walk(nodes, (node, place) => {
    const role = roleOf(node)
    const name = nameOf(node)

    if (role === 'main') mains += 1

    if (role === 'heading') {
      const level = Number(propertyOf(node, 'level') ?? 0)
      // The first heading must be the page's h1, and no level may be skipped:
      // a reader jumping by heading hears "heading level 3" with nothing
      // above it and cannot tell where the page begins.
      if (lastHeading === 0 && level !== 1) {
        say('heading-jump', `first heading is level ${level}: "${name}"`)
      } else if (level > lastHeading + 1) {
        say('heading-jump', `level ${lastHeading} → ${level}: "${name}"`)
      }
      lastHeading = level
    }

    if (INTERACTIVE.has(role)) {
      if (name === '') say('unnamed-control', `${role} with no accessible name`)
      else if (isGlyphOnly(name)) say('glyph-name', `${role} announced as "${name}"`)
      // A container that shares its name with something inside it is named
      // after its own contents: the tab bar was `aria-label="Home"` and
      // announced as "Home, navigation" while holding a link called Home.
      // The command palette did the same, three deep — the dialog, its field
      // and its result list all called "Go anywhere".
      if (name !== '' && name === place.landmark) collisions.add(name)
      if (!place.landmarked && name !== '') {
        say('outside-landmark', `${role} "${name}" is in no landmark or dialog`)
      }
    }

    if (role === 'link' && name !== '') {
      const url = text(propertyOf(node, 'url'))
      const urls = linksByName.get(name) ?? new Set<string>()
      urls.add(url)
      linksByName.set(name, urls)
    }
  })

  for (const name of collisions) {
    say('landmark-name-collides', `a container named "${name}" holds a control with that name`)
  }

  if (mains === 0) say('no-main', 'the page has no main landmark')
  if (mains > 1) say('many-mains', `${mains} main landmarks`)

  for (const [name, urls] of linksByName) {
    // Same words, different destination: the rotor's link list becomes a row
    // of identical entries. Same name for the SAME destination is fine, and
    // is why this compares urls rather than counting.
    if (urls.size > 1) say('ambiguous-link', `${urls.size} destinations named "${name}"`)
  }

  return findings
}

/** The source for the DOM-side rules, evaluated in the page. */
export const DOM_AUDIT = `(() => {
  const focusable = 'a[href], button, input, select, textarea, [tabindex]'
  const found = []
  for (const element of Array.from(document.querySelectorAll(focusable))) {
    const index = element.getAttribute('tabindex')
    if (index !== null && Number(index) > 0) {
      found.push(['positive-tabindex', element.tagName.toLowerCase() + ' tabindex=' + index])
    }
    if (element.closest('[aria-hidden="true"]') !== null && index !== '-1' && !element.disabled) {
      found.push(['hidden-focusable', element.tagName.toLowerCase() + ' inside aria-hidden'])
    }
  }
  // ARIA names are PROHIBITED on these roles, and every tag here maps to one
  // of them: the browser drops the label, or announces it, depending on the
  // engine — so the name is a coin toss. A deny-list, not an allow-list: an
  // allow-list of nameable tags flagged <article aria-label> as a fault, and
  // an audit that cries wolf is an audit everybody turns off.
  const PROHIBITED = ['div','span','p','b','i','em','strong','small','s','u','q','cite','dfn','kbd','samp','var','code','pre','mark','del','ins','sub','sup','time','caption','label']
  for (const element of Array.from(document.querySelectorAll('[aria-label], [aria-labelledby]'))) {
    const tag = element.tagName.toLowerCase()
    // An explicit role replaces the implicit one, so role="group" on a div is
    // a real fix rather than a way around the rule.
    if (element.getAttribute('role') === null && PROHIBITED.includes(tag)) {
      found.push(['label-on-generic', tag + '[aria-label="' + (element.getAttribute('aria-label') || '') + '"]'])
    }
  }
  return found
})()`

export function reportOf(findings: readonly Finding[], routes: number): string {
  if (findings.length === 0) return `  ${routes} routes, nothing a screen reader would stumble on`
  const byRule = new Map<Rule, Finding[]>()
  for (const finding of findings) byRule.set(finding.rule, [...(byRule.get(finding.rule) ?? []), finding])
  const lines = [`  ${findings.length} finding(s) across ${routes} routes:`]
  for (const [rule, group] of byRule) {
    lines.push(`    ${rule} (${group.length})`)
    for (const finding of group.slice(0, 6)) lines.push(`      ${finding.route}: ${finding.detail}`)
    if (group.length > 6) lines.push(`      …and ${group.length - 6} more`)
  }
  return lines.join('\n')
}
