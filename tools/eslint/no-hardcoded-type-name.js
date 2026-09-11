/**
 * Rule #5 / CLAUDE.md Rule 4 — one word everywhere.
 *
 * A document type has exactly one display label at any moment, resolved through
 * `src/domain/locale`. A literal "Invoice" / "Waybill" / "Devis" / "Factura" in
 * UI, PDF or share-text code is a bug (§D.1), so this rule fails the build on it.
 *
 * Scope: `src/features`, `src/pdf`, `src/app` and any other presentation code.
 * `src/domain/locale` is exempt — it is where the words legitimately live.
 */

// Every shipped label from the §D terminology table, plus the English party and
// signature vocabulary that must also resolve through the locale layer.
const FORBIDDEN = [
  // invoice
  'Invoice', 'Facture', 'Factura', 'فاتورة',
  // quotation
  'Quotation', 'Quote', 'Estimate', 'Devis', 'Cotización', 'Cotizacion', 'عرض سعر',
  // receipt
  'Receipt', 'Reçu', 'Recu', 'Recibo', 'إيصال',
  // delivery document
  'Waybill', 'Delivery note', 'Delivery Note', 'Packing slip', 'Packing Slip',
  'Bon de livraison', 'Guía de remisión', 'Guia de remision', 'Nota de entrega',
  'بوليصة شحن',
  // signature captions (§I)
  'AUTHORISED SIGNATURE', 'PREPARED BY', 'ISSUED BY', 'DISPATCHED BY',
  // payment box heading (§I)
  'HOW TO PAY', 'RECEIVED BY',
]

const pattern = new RegExp(
  `(^|[^\\p{L}])(${FORBIDDEN.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})([^\\p{L}]|$)`,
  'iu',
)

/** @type {import('eslint').Rule.RuleModule} */
export const noHardcodedTypeName = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Document type names, party labels and signature captions must resolve through src/domain/locale (v6 §D, Rule #5).',
    },
    schema: [],
    messages: {
      hardcoded:
        'Hardcoded type name {{word}}. Resolve it through src/domain/locale instead — a document has one label everywhere at once (v6 §D, Rule #5).',
    },
  },
  create(context) {
    const check = (node, raw) => {
      const match = pattern.exec(raw)
      if (match) {
        context.report({ node, messageId: 'hardcoded', data: { word: `"${match[2]}"` } })
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value)
      },
      TemplateElement(node) {
        check(node, node.value.raw)
      },
      JSXText(node) {
        check(node, node.value)
      },
    }
  },
}

export default { rules: { 'no-hardcoded-type-name': noHardcodedTypeName } }
