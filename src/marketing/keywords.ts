/**
 * The per-locale half of §T's listing input — the decisions a terminology
 * table cannot make.
 *
 * **There are no document type names in this file, and there cannot be.** §T
 * asks for "all four types + maker/creator/generator/template/app variants +
 * 'offline', 'small business', 'PDF'"; the four types come from the §D
 * terminology synonyms at generation time (Rule 4), so what is left here is
 * everything a type name is not — which two types lead the title, how the
 * conjunction joins, and the market's non-type vocabulary. The Rule-4 lint
 * rule fails the build if a label ever creeps in, which is the guard working
 * rather than a nuisance.
 *
 * Every entry is a DRAFT into the same native-speaker review as the
 * terminology table it accompanies (§Q Phase 0). A market's search vocabulary
 * is not translatable by dictionary: whether a Lagos trader types "app" or
 * "application", whether a French plumber searches "devis gratuit" — those are
 * observations about people, and nobody here has made them.
 */

import type { LocaleId } from '../domain/locale/types'
import type { LocaleListingInput } from './listing'

/**
 * The four English launch locales share a vocabulary and a title shape.
 *
 * §T's EN pattern is "DocFlow: Invoice & Receipt Maker" — the two money types
 * lead, and the delivery document (Waybill / Delivery note / Packing slip,
 * whichever this locale calls it) carries the subtitle, which is where §T
 * wants it surfaced.
 */
const EN: LocaleListingInput = {
  titleTypes: ['invoice', 'receipt'],
  conjunction: '&',
  conjunctionSpacing: 'both',
  titleIntent: 'Maker',
  intents: ['maker', 'generator', 'template', 'app'],
  qualifiers: ['offline', 'small business', 'PDF', 'billing'],
}

export const LOCALE_LISTING_INPUTS: Readonly<Record<LocaleId, LocaleListingInput>> = {
  'EN-NG': EN,
  'EN-GH': EN,
  'EN-GB': EN,
  'EN-US': EN,

  // §T's own example is "DocFlow : Facture & Devis" — the quotation leads the
  // second slot, and the title ends at the type names. No trailing intent
  // word: "Facture & Devis Créateur" is not how the pattern reads in French,
  // and inventing one would put a phrase nobody types in the title.
  FR: {
    titleTypes: ['invoice', 'quotation'],
    conjunction: '&',
    conjunctionSpacing: 'both',
    intents: ['créateur', 'modèle', 'application'],
    qualifiers: ['hors ligne', 'petite entreprise', 'PDF', 'facturation'],
  },

  // §T's example is "DocFlow: Factura y Cotización" — "y", not "&".
  ES: {
    titleTypes: ['invoice', 'quotation'],
    conjunction: 'y',
    conjunctionSpacing: 'both',
    intents: ['creador', 'plantilla', 'aplicación'],
    qualifiers: ['sin conexión', 'pequeña empresa', 'PDF', 'facturación'],
  },

  // Arabic joins with a prefixed "و", written against the word that follows
  // it rather than spaced on both sides. This is the clearest case in the set
  // of a decision that needs a native speaker and not a dictionary, and it is
  // flagged as such by the table's own review status.
  AR: {
    titleTypes: ['invoice', 'quotation'],
    conjunction: 'و',
    conjunctionSpacing: 'after',
    intents: ['تطبيق', 'قالب'],
    qualifiers: ['بدون إنترنت', 'شركة صغيرة', 'PDF'],
  },
}
