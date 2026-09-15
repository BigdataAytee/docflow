/**
 * French, Spanish and Arabic terminology tables.
 *
 * ⚠ DRAFT — every table here is `reviewStatus: 'draft'`. §D: "validated with
 * native-speaker review per launch market — machine translation is a draft,
 * never a release." The Phase 1 resolver refuses to serve a draft in a release
 * build, so nothing here can reach a user before sign-off.
 *
 * Type labels are taken verbatim from the §D table. Party labels, signature
 * captions and step names are the drafts awaiting review — see
 * docs/locale/native-speaker-review.md for the sign-off sheet.
 *
 * Arabic additionally ships only with complete RTL acceptance (§S): forms,
 * sheets, builder, swipe directions, charts and PDFs all mirrored and verified.
 */

import type { TerminologyTable } from '../types'

/** FR — France, Côte d'Ivoire and the other francophone launch markets. */
export const FR: TerminologyTable = {
  locale: 'FR',
  language: 'fr',
  direction: 'ltr',
  reviewStatus: 'draft',
  types: {
    invoice: {
      label: 'Facture',
      labelInSentence: 'facture',
      pluralLabel: 'Factures',
      pluralInSentence: 'factures',
      printedTitle: 'FACTURE',
      partyLabel: 'Facturé à',
      signatureCaption: 'SIGNATURE AUTORISÉE',
      steps: ['Détails', 'Articles', 'Totaux', 'Modèle', 'Vérification'],
      numberingPrefix: 'FAC',
    },
    quotation: {
      label: 'Devis',
      labelInSentence: 'devis',
      pluralLabel: 'Devis',
      pluralInSentence: 'devis',
      printedTitle: 'DEVIS',
      partyLabel: 'Établi pour',
      signatureCaption: 'ÉTABLI PAR',
      steps: ['Détails', 'Articles', 'Totaux', 'Modèle', 'Vérification'],
      numberingPrefix: 'DEV',
    },
    receipt: {
      label: 'Reçu',
      labelInSentence: 'reçu',
      pluralLabel: 'Reçus',
      pluralInSentence: 'reçus',
      printedTitle: 'REÇU',
      partyLabel: 'Reçu de',
      signatureCaption: 'ÉMIS PAR',
      steps: ['Détails', 'Articles', 'Totaux', 'Modèle', 'Vérification'],
      numberingPrefix: 'REC',
    },
    waybill: {
      label: 'Bon de livraison',
      labelInSentence: 'bon de livraison',
      pluralLabel: 'Bons de livraison',
      pluralInSentence: 'bons de livraison',
      printedTitle: 'BON DE LIVRAISON',
      partyLabel: 'Livrer à',
      signatureCaption: 'EXPÉDIÉ PAR',
      steps: ['Livrer à', 'Marchandises', 'Expédition', 'Modèle', 'Vérification'],
      numberingPrefix: 'BL',
    },
  },
  shared: {
    howToPay: 'COMMENT PAYER',
    receivedBy: 'REÇU PAR',
    estimatedTotal: 'Total estimé',
    paymentReceived: 'Paiement reçu',
    datePaid: 'Date de paiement',
    paidBy: 'Payé par',
    otherPaymentMethods: 'Autres moyens de paiement',
  },
  synonyms: {
    invoice: ['facture', 'note'],
    quotation: ['devis', 'proforma', 'estimation'],
    receipt: ['reçu', 'recu', 'quittance'],
    waybill: ['bon de livraison', 'bordereau de livraison', 'BL'],
  },
}

/** ES — Spain and the Latin American launch markets. */
export const ES: TerminologyTable = {
  locale: 'ES',
  language: 'es',
  direction: 'ltr',
  reviewStatus: 'draft',
  types: {
    invoice: {
      label: 'Factura',
      labelInSentence: 'factura',
      pluralLabel: 'Facturas',
      pluralInSentence: 'facturas',
      printedTitle: 'FACTURA',
      partyLabel: 'Facturar a',
      signatureCaption: 'FIRMA AUTORIZADA',
      steps: ['Detalles', 'Artículos', 'Totales', 'Diseño', 'Revisión'],
      numberingPrefix: 'FAC',
    },
    quotation: {
      label: 'Cotización',
      labelInSentence: 'cotización',
      pluralLabel: 'Cotizaciones',
      pluralInSentence: 'cotizaciones',
      printedTitle: 'COTIZACIÓN',
      partyLabel: 'Preparado para',
      signatureCaption: 'PREPARADO POR',
      steps: ['Detalles', 'Artículos', 'Totales', 'Diseño', 'Revisión'],
      numberingPrefix: 'COT',
    },
    receipt: {
      label: 'Recibo',
      labelInSentence: 'recibo',
      pluralLabel: 'Recibos',
      pluralInSentence: 'recibos',
      printedTitle: 'RECIBO',
      partyLabel: 'Recibido de',
      signatureCaption: 'EMITIDO POR',
      steps: ['Detalles', 'Artículos', 'Totales', 'Diseño', 'Revisión'],
      numberingPrefix: 'REC',
    },
    waybill: {
      // §D offers "Guía de remisión / Nota de entrega" — the split is a
      // per-market call for review, not a machine choice. MX/PE lean guía.
      label: 'Nota de entrega',
      labelInSentence: 'nota de entrega',
      pluralLabel: 'Notas de entrega',
      pluralInSentence: 'notas de entrega',
      printedTitle: 'NOTA DE ENTREGA',
      partyLabel: 'Entregar a',
      signatureCaption: 'DESPACHADO POR',
      steps: ['Entregar a', 'Mercancía', 'Despacho', 'Diseño', 'Revisión'],
      numberingPrefix: 'NE',
    },
  },
  shared: {
    howToPay: 'CÓMO PAGAR',
    receivedBy: 'RECIBIDO POR',
    estimatedTotal: 'Total estimado',
    paymentReceived: 'Pago recibido',
    datePaid: 'Fecha de pago',
    paidBy: 'Pagado por',
    otherPaymentMethods: 'Otros métodos de pago',
  },
  synonyms: {
    invoice: ['factura'],
    quotation: ['cotización', 'cotizacion', 'presupuesto', 'proforma'],
    receipt: ['recibo', 'comprobante'],
    waybill: ['nota de entrega', 'guía de remisión', 'guia de remision', 'albarán', 'albaran'],
  },
}

/** AR — RTL. Ships only with complete RTL acceptance including PDFs (§S). */
export const AR: TerminologyTable = {
  locale: 'AR',
  language: 'ar',
  direction: 'rtl',
  reviewStatus: 'draft',
  types: {
    invoice: {
      label: 'فاتورة',
      labelInSentence: 'فاتورة',
      pluralLabel: 'فواتير',
      pluralInSentence: 'فواتير',
      printedTitle: 'فاتورة',
      partyLabel: 'فاتورة إلى',
      signatureCaption: 'التوقيع المعتمد',
      steps: ['التفاصيل', 'البنود', 'الإجماليات', 'التصميم', 'المراجعة'],
      numberingPrefix: 'INV',
    },
    quotation: {
      label: 'عرض سعر',
      labelInSentence: 'عرض سعر',
      pluralLabel: 'عروض أسعار',
      pluralInSentence: 'عروض أسعار',
      printedTitle: 'عرض سعر',
      partyLabel: 'مُعد لصالح',
      signatureCaption: 'أعده',
      steps: ['التفاصيل', 'البنود', 'الإجماليات', 'التصميم', 'المراجعة'],
      numberingPrefix: 'QUO',
    },
    receipt: {
      label: 'إيصال',
      labelInSentence: 'إيصال',
      pluralLabel: 'إيصالات',
      pluralInSentence: 'إيصالات',
      printedTitle: 'إيصال',
      partyLabel: 'مستلم من',
      signatureCaption: 'صادر عن',
      steps: ['التفاصيل', 'البنود', 'الإجماليات', 'التصميم', 'المراجعة'],
      numberingPrefix: 'REC',
    },
    waybill: {
      label: 'بوليصة شحن',
      labelInSentence: 'بوليصة شحن',
      pluralLabel: 'بوالص شحن',
      pluralInSentence: 'بوالص شحن',
      printedTitle: 'بوليصة شحن',
      partyLabel: 'التسليم إلى',
      signatureCaption: 'أرسله',
      steps: ['التسليم إلى', 'البضائع', 'الإرسال', 'التصميم', 'المراجعة'],
      numberingPrefix: 'WAY',
    },
  },
  shared: {
    howToPay: 'طريقة الدفع',
    receivedBy: 'استلمه',
    estimatedTotal: 'الإجمالي التقديري',
    paymentReceived: 'تم استلام الدفعة',
    datePaid: 'تاريخ الدفع',
    paidBy: 'طريقة الدفع',
    otherPaymentMethods: 'طرق دفع أخرى',
  },
  synonyms: {
    invoice: ['فاتورة'],
    quotation: ['عرض سعر', 'عرض أسعار'],
    receipt: ['إيصال', 'وصل'],
    waybill: ['بوليصة شحن', 'إذن تسليم', 'مذكرة تسليم'],
  },
}
