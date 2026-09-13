/**
 * The prose on a landing page, per LANGUAGE (§S, §T).
 *
 * `src/domain/locale/data/strings.ts` already settled this argument for the
 * app: "FR, ES and AR are deliberately ABSENT rather than machine-filled…
 * `stringsFor` throws for a language with no catalogue instead of silently
 * serving English under a French flag." A landing page is not exempt.
 *
 * The first version of this file did exactly what that rule forbids. The
 * French page read *"Create a devis on your phone, with or without a
 * connection"* — an English sentence with a French noun dropped into it, which
 * is worse than machine translation because no translator was involved at all.
 * It is the first thing a French searcher would see, and it would tell them
 * the product was not built for them.
 *
 * So: English exists, the others do not, and a locale whose language has no
 * copy gets **no page** rather than an English one. Its `hreflang` cluster and
 * the sitemap then do not name it either — a cluster pointing at a page that
 * was never published is a 404 advertised to a search engine.
 *
 * `{label}` and `{plural}` are substituted from the §D terminology table, so
 * the same sentence says "Waybill" in Lagos and "Delivery note" in Manchester.
 */

import { format } from '../domain/locale/data/strings'

export interface MarketingCopy {
  /** `{label} — DocFlow`. */
  readonly title: string
  readonly description: string
}

const CATALOGUES: Readonly<Record<string, MarketingCopy>> = {
  en: {
    title: '{label} — DocFlow',
    description:
      'Create a {labelLower} on your phone, with or without a connection, and share it ' +
      'as a PDF. {plural} are free forever, and your existing documents are never locked.',
  },
  // fr, es, ar: deliberately absent. A translator writes these, not this file.
}

export const hasCopyFor = (language: string): boolean => language in CATALOGUES

export function copyFor(language: string): MarketingCopy | undefined {
  return CATALOGUES[language]
}

export function renderCopy(
  copy: MarketingCopy,
  values: Readonly<Record<string, string>>,
): MarketingCopy {
  return {
    title: format(copy.title, values),
    description: format(copy.description, values),
  }
}
