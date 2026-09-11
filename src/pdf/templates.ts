/**
 * The sixteen document designs (§H).
 *
 * A template is STYLE ONLY. It never decides what appears on the page — that
 * is `composeDocument`, which is why every template renders a delivery
 * document without money and a receipt without an instruction to pay, without
 * each of the sixteen having to remember to.
 *
 * "The original ten" and "the six new" are §H's own grouping; the six carry a
 * small green NEW tag and nothing else distinguishes them.
 */

export type TemplateId =
  | 'classic' | 'modern' | 'minimal' | 'bold' | 'elegant'
  | 'sidebar' | 'executive' | 'wave' | 'compact' | 'sikky'
  | 'aurora' | 'ledger' | 'botanic' | 'prism' | 'bloom' | 'aria'

export type HeaderStyle =
  | 'rule' | 'band' | 'hairline' | 'split' | 'centred'
  | 'sidebar' | 'badge' | 'wave' | 'condensed' | 'spine'
  | 'gradient' | 'double-rule' | 'flourish' | 'diagonal' | 'arch' | 'frame'

export interface TemplateDefinition {
  readonly id: TemplateId
  /** The design's own name. Not a document type name — never localised (§H). */
  readonly name: string
  /** §H: the six newer designs carry a small green NEW tag. */
  readonly isNew: boolean
  readonly headerStyle: HeaderStyle
  /** Bundled families only — no CDN in the installed app (§F). */
  readonly fontFamily: 'sans' | 'georgia' | 'serif-display'
  readonly paper: string
  readonly ink: string
  /** Uses the brand colour rather than a fixed one. */
  readonly usesBrandAccent: boolean
  /** Left column width, for the designs that have one. */
  readonly sidebarPercent?: number
}

const define = (
  id: TemplateId,
  name: string,
  headerStyle: HeaderStyle,
  over: Partial<TemplateDefinition> = {},
): TemplateDefinition => ({
  id,
  name,
  isNew: false,
  headerStyle,
  fontFamily: 'sans',
  paper: '#ffffff',
  ink: '#1d2452',
  usesBrandAccent: true,
  ...over,
})

/** §H — the original ten. */
const ORIGINAL_TEN: readonly TemplateDefinition[] = [
  define('classic', 'Classic', 'rule', { fontFamily: 'georgia' }),
  define('modern', 'Modern', 'band'),
  define('minimal', 'Minimal', 'hairline', { usesBrandAccent: false }),
  define('bold', 'Bold', 'split'),
  define('elegant', 'Elegant', 'centred', { fontFamily: 'serif-display' }),
  define('sidebar', 'Sidebar', 'sidebar', { sidebarPercent: 31 }),
  define('executive', 'Executive', 'badge'),
  define('wave', 'Wave', 'wave'),
  define('compact', 'Compact', 'condensed'),
  define('sikky', 'Sikky', 'spine', { fontFamily: 'georgia' }),
]

/** §H — the six new. A Noir design was built and removed; Bloom and Aria replaced it. */
const SIX_NEW: readonly TemplateDefinition[] = [
  define('aurora', 'Aurora', 'gradient', { isNew: true }),
  define('ledger', 'Ledger', 'double-rule', { isNew: true }),
  define('botanic', 'Botanic', 'flourish', {
    isNew: true,
    fontFamily: 'georgia',
    paper: '#fdfcf7',
  }),
  define('prism', 'Prism', 'diagonal', { isNew: true }),
  define('bloom', 'Bloom', 'arch', {
    isNew: true,
    fontFamily: 'serif-display',
    paper: '#fff7f7',
  }),
  define('aria', 'Aria', 'frame', {
    isNew: true,
    fontFamily: 'serif-display',
    paper: '#fffdf8',
  }),
]

export const TEMPLATES: readonly TemplateDefinition[] = [...ORIGINAL_TEN, ...SIX_NEW]

export const TEMPLATE_BY_ID: Readonly<Record<TemplateId, TemplateDefinition>> =
  Object.fromEntries(TEMPLATES.map((t) => [t.id, t])) as Readonly<
    Record<TemplateId, TemplateDefinition>
  >

export const DEFAULT_TEMPLATE: TemplateId = 'classic'

export class UnknownTemplateError extends Error {}

export function templateById(id: string): TemplateDefinition {
  const template = TEMPLATE_BY_ID[id as TemplateId]
  if (template === undefined) {
    throw new UnknownTemplateError(
      `No design "${id}". A document must render in a design that exists, never in a silent fallback that changes how an issued PDF looks.`,
    )
  }
  return template
}

/**
 * Every font the sixteen actually use (§F: "Bundle every font the sixteen
 * templates actually use (audit them)"). The audit is this list, and a test
 * holds it to what the definitions above declare.
 */
export const REQUIRED_FONT_FAMILIES: readonly TemplateDefinition['fontFamily'][] = [
  'sans',
  'georgia',
  'serif-display',
]
