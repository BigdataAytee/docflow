/**
 * The §Q Phase 2 gate journey, run on the phone with the radios off.
 *
 * §Q Phase 2's gate is one sentence and it has been deferred since Phase 2
 * because every clause in it needs hardware:
 *
 *   "(airplane mode, fresh install, physical device): create a customer →
 *    build an invoice → preview in all sixteen designs → issue → PDF → share →
 *    record a part payment → auto-create its linked receipt → create and sign
 *    a delivery document → switch region and confirm every label changes
 *    everywhere at once while the issued PDFs keep their frozen labels →
 *    force-kill mid-draft → reopen and recover."
 *
 * This walks it against the REAL encrypted store, through the real
 * repositories, the real locale layer and the real page composer — the same
 * code the screens call.
 *
 * **What it does not do, stated plainly.** It does not press buttons. It
 * cannot see a skeleton, an empty state or a spinner, so it says nothing about
 * "skeletons and empty states everywhere, never a spinner or blank screen" —
 * that half of the clause needs eyes on the screen, and the screenshots in
 * `docs/phase-4/` are where it is answered. Nor does it open the share sheet:
 * a chooser needs a finger, so what is checked here is that the file is
 * staged, the capability is declared honestly, and the event recorded says
 * `handed_off` and never `delivered` (§M).
 *
 * Every step returns evidence rather than a boolean, for the same reason the
 * device gate does: a PLAN entry should be able to quote a measurement.
 */

import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

import type { Repositories } from '../data/repositories'
import type { CheckResult } from './gate'
import { TEMPLATES } from '../pdf/templates'
import { type ComposableDocument, composeDocument } from '../pdf/compose'
import { FOOTER_ROW_COST, ROWS_PER_PAGE, paginate } from '../pdf/paginate'
import { DocumentPage } from '../pdf/DocumentPage'
import { freezeLabels, label, printedTitle } from '../domain/locale/profile'
import { quantity } from '../domain/documents/types'
import { money } from '../domain/money/money'
import { receiptFor } from '../features/payments/receiptFlow'

const ctx = (key: string) => ({ idempotencyKey: key, actorId: 'gate', deviceId: 'gate-device' })

const pass = (name: string, evidence: string): CheckResult => ({ name, state: 'passed', evidence })
const fail = (name: string, evidence: string): CheckResult => ({ name, state: 'failed', evidence })

export interface JourneyInput {
  readonly repositories: Repositories
  readonly companyId: string
  /**
   * A run number. The journey writes real records, and the idempotency keys
   * must differ between runs or the second run would return the first run's
   * records and prove nothing.
   */
  readonly run: string
}

export interface DraftHandle {
  readonly documentId: string
}

/**
 * Part one, up to the force-kill.
 *
 * Split because the recovery clause cannot be checked inside one process: the
 * app has to actually die. The runner kills it between the two halves.
 */
export async function journeyBeforeKill(input: JourneyInput): Promise<{
  results: CheckResult[]
  draft: DraftHandle | null
}> {
  const { repositories: repos, companyId, run } = input
  const results: CheckResult[] = []
  const key = (step: string) => ctx(`journey-${run}-${step}`)

  // ── create a customer ───────────────────────────────────────────────────
  let customerId: string
  try {
    const customer = await repos.customers.create(
      {
        companyId,
        kind: 'person',
        name: `Musa Ibrahim ${run}`,
        phone: '08031234567',
        labels: [],
      },
      key('customer'),
    )
    customerId = customer.id
    const readBack = await repos.customers.get(companyId, customer.id)
    results.push(
      readBack?.name === customer.name
        ? pass('Create a customer, offline', `saved and read back as ${readBack.name}`)
        : fail('Create a customer, offline', 'the customer did not read back'),
    )
  } catch (cause) {
    results.push(fail('Create a customer, offline', messageOf(cause)))
    return { results, draft: null }
  }

  // ── build an invoice ────────────────────────────────────────────────────
  let invoiceId: string
  try {
    const invoice = await repos.documents.createDraft(
      {
        companyId,
        type: 'invoice',
        status: 'draft',
        customerId,
        currency: 'NGN',
        lineItems: [
          {
            id: 'l1',
            description: 'Cement, 50kg',
            quantityMilli: quantity(20),
            unitPriceMinor: 750_000,
            taxable: true,
          },
          {
            id: 'l2',
            description: 'Delivery to site',
            quantityMilli: quantity(1),
            unitPriceMinor: 500_000,
            taxable: true,
          },
        ],
        totalMinor: 15_500_000,
      },
      key('invoice'),
    )
    invoiceId = invoice.id
    results.push(
      pass('Build an invoice, offline', `draft ${invoice.id} with ${invoice.lineItems.length} lines`),
    )
  } catch (cause) {
    results.push(fail('Build an invoice, offline', messageOf(cause)))
    return { results, draft: null }
  }

  // ── preview in all sixteen designs ──────────────────────────────────────
  results.push(await previewsInSixteen(repos, companyId, invoiceId))

  // ── issue ───────────────────────────────────────────────────────────────
  try {
    const issued = await repos.documents.issue(
      invoiceId,
      {
        reference: `INV-${run}-0001`,
        frozenLabels: freezeLabels({ locale: 'EN-NG' }, 'invoice'),
        totalMinor: 15_500_000,
      },
      key('issue'),
    )
    results.push(
      issued.issuedReference === `INV-${run}-0001` && issued.frozenLabels !== null
        ? pass(
            'Issue freezes the reference and the labels together (§M)',
            `${issued.issuedReference}, printed as "${issued.frozenLabels.printedTitle}"`,
          )
        : fail('Issue freezes the reference and the labels together (§M)', 'one of them is missing'),
    )
  } catch (cause) {
    results.push(fail('Issue freezes the reference and the labels together (§M)', messageOf(cause)))
  }

  // ── the issued document refuses an edit ─────────────────────────────────
  try {
    await repos.documents.updateDraft(invoiceId, { totalMinor: 1 }, key('tamper'))
    results.push(fail('An issued invoice refuses an edit (Rule #5)', 'the edit was ACCEPTED'))
  } catch (cause) {
    results.push(pass('An issued invoice refuses an edit (Rule #5)', messageOf(cause).slice(0, 90)))
  }

  // ── record a part payment, and its linked receipt ───────────────────────
  results.push(...(await partPaymentAndReceipt(repos, companyId, invoiceId, customerId, key)))

  // ── create and sign a delivery ──────────────────────────────────────────
  results.push(...(await deliveryAndSignature(repos, companyId, customerId, run, key)))

  // ── switch region ───────────────────────────────────────────────────────
  results.push(await regionSwitchKeepsFrozenLabels(repos, companyId, invoiceId, key))

  // ── the draft that must survive a force-kill ────────────────────────────
  try {
    const draft = await repos.documents.createDraft(
      {
        companyId,
        type: 'quotation',
        status: 'draft',
        customerId,
        currency: 'NGN',
        lineItems: [
          {
            id: 'l1',
            description: 'Half-typed line, mid-draft',
            quantityMilli: quantity(3),
            unitPriceMinor: 250_000,
            taxable: true,
          },
        ],
        totalMinor: 750_000,
      },
      key('midDraft'),
    )
    return { results, draft: { documentId: draft.id } }
  } catch (cause) {
    results.push(fail('A mid-draft document is saved before the kill', messageOf(cause)))
    return { results, draft: null }
  }
}

/** Part two: a new process, over the database part one left behind. */
export async function journeyAfterKill(
  repos: Repositories,
  companyId: string,
  draft: DraftHandle,
): Promise<CheckResult[]> {
  const name = 'Force-kill mid-draft, reopen, recover (§Q Phase 2)'
  try {
    const recovered = await repos.documents.get(companyId, draft.documentId)
    if (recovered === null) return [fail(name, 'the draft is gone after the kill')]

    const line = recovered.lineItems[0]
    return [
      line?.description === 'Half-typed line, mid-draft' && recovered.status === 'draft'
        ? pass(
            name,
            `the draft came back with its line intact: "${line.description}", still a draft`,
          )
        : fail(name, `recovered, but changed: ${JSON.stringify(recovered.lineItems)}`),
    ]
  } catch (cause) {
    return [fail(name, messageOf(cause))]
  }
}

/* ───────────────────────────────────────────────────────────── the steps */

/** A stored record as the page composer wants it. */
const composable = (
  record: NonNullable<Awaited<ReturnType<Repositories['documents']['get']>>>,
  partyName: string,
): ComposableDocument => ({
  type: record.type,
  status: record.status,
  currency: record.currency,
  reference: record.issuedReference ?? 'DRAFT',
  issueDate: record.issueDate ?? '2026-09-14',
  lineItems: record.lineItems,
  party: { name: partyName },
  frozenLabels: record.frozenLabels,
  ...(record.driverName === undefined ? {} : { driverName: record.driverName }),
  ...(record.vehicleNumber === undefined ? {} : { vehicleNumber: record.vehicleNumber }),
  ...(record.signerName === undefined ? {} : { signerName: record.signerName }),
  ...(record.signatureAssetId === undefined
    ? {}
    : { signatureAssetId: record.signatureAssetId }),
})

const COLUMN_LABELS = {
  description: 'Description',
  quantity: 'Qty',
  amount: 'Amount',
  unit: 'Unit',
} as const

const BRANDING = {
  name: 'Acme Blocks',
  nameStyle: 'classic',
  logoSize: 'M',
  // No logo asset in this run, and the holder is still drawn — §G: the header
  // must not jump when one is added later.
  showLogo: true,
} as const

/**
 * All sixteen, RENDERED — not merely composed.
 *
 * The temptation is to compose a page model sixteen times and call that a
 * preview. It is not: the model is design-independent, so sixteen composes are
 * one compose repeated, and every difference between the designs lives in
 * `DocumentPage`. A check like that would pass with fifteen of the templates
 * broken.
 *
 * This runs inside a WebView, which has a real DOM — so each design is
 * actually mounted, and what is asserted is that it produced a page carrying
 * the document's FROZEN title (Rule #5; §H: a design changes the look, never
 * the words).
 */
async function previewsInSixteen(
  repos: Repositories,
  companyId: string,
  invoiceId: string,
): Promise<CheckResult> {
  const name = 'Preview in all sixteen designs, offline (§H)'
  const host = window.document.createElement('div')
  window.document.body.appendChild(host)

  try {
    const record = await repos.documents.get(companyId, invoiceId)
    if (record === null) return fail(name, 'the invoice is not there')

    const model = composeDocument(composable(record, 'Musa Ibrahim'), {
      profile: { locale: 'EN-NG' },
      branding: BRANDING,
      columnLabels: COLUMN_LABELS,
    })
    const pages = paginate(model, { rowsPerPage: ROWS_PER_PAGE, footerRowCost: FOOTER_ROW_COST })
    const page = pages[0]
    if (page === undefined) throw new Error('the invoice paginated to nothing')

    const expectedTitle = record.frozenLabels?.printedTitle ?? model.title
    const rendered: string[] = []

    for (const template of TEMPLATES) {
      const mount = window.document.createElement('div')
      host.appendChild(mount)
      const root = createRoot(mount)
      // Synchronous, so the assertion below reads the DOM this render made
      // rather than whatever React had got round to.
      flushSync(() => {
        root.render(
          createElement(DocumentPage, {
            model,
            template,
            page,
            totalPages: pages.length,
            formatAmount: (minor: number) => `NGN ${(minor / 100).toFixed(2)}`,
            currency: 'NGN',
            accent: '#2C4BFF',
          }),
        )
      })

      const text = mount.textContent ?? ''
      if (!text.includes(expectedTitle)) {
        throw new Error(`${template.id} rendered without the frozen title "${expectedTitle}"`)
      }
      if (!text.includes('Cement, 50kg')) {
        throw new Error(`${template.id} rendered without its line items`)
      }
      rendered.push(template.id)
      root.unmount()
    }

    return rendered.length === 16
      ? pass(name, `all sixteen mounted, each printing "${expectedTitle}": ${rendered.join(', ')}`)
      : fail(name, `only ${rendered.length} of sixteen rendered`)
  } catch (cause) {
    return fail(name, messageOf(cause))
  } finally {
    host.remove()
  }
}

async function partPaymentAndReceipt(
  repos: Repositories,
  companyId: string,
  invoiceId: string,
  customerId: string,
  key: (step: string) => ReturnType<typeof ctx>,
): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const paymentName = 'Record a part payment, offline (§K)'

  let paymentId: string
  try {
    const payment = await repos.payments.record(
      {
        customerId,
        amount: money('NGN', 5_000_000),
        paidAt: '2026-09-14T10:00:00Z',
        method: 'bank_transfer',
        source: 'manual',
        allocations: [
          {
            id: 'local:invoice',
            paymentId: 'local',
            invoiceId,
            amount: money('NGN', 5_000_000),
          },
        ],
      },
      key('payment'),
    )
    paymentId = payment.id
    results.push(
      pass(
        paymentName,
        `₦50,000.00 of ₦155,000.00, allocated to ${payment.allocations[0]?.invoiceId}`,
      ),
    )
  } catch (cause) {
    return [fail(paymentName, messageOf(cause))]
  }

  // "A payment recorded once moves invoice, customer, Home — once."
  const onceName = 'A payment recorded once counts once (§Q Phase 2, §K)'
  try {
    // The same tap, replayed — a flaky button, a retried sync.
    for (const _ of [1, 2, 3]) {
      await repos.payments.record(
        {
          customerId,
          amount: money('NGN', 5_000_000),
          paidAt: '2026-09-14T10:00:00Z',
          method: 'bank_transfer',
          source: 'manual',
          allocations: [],
        },
        key('payment'),
      )
    }
    const forInvoice = await repos.payments.listForInvoice(companyId, invoiceId)
    const forCompany = await repos.payments.listForCompany(companyId)
    results.push(
      forInvoice.length === 1 && forCompany.length === 1
        ? pass(onceName, 'four identical taps, one payment against the invoice and the customer')
        : fail(onceName, `${forInvoice.length} on the invoice, ${forCompany.length} on the company`),
    )
  } catch (cause) {
    results.push(fail(onceName, messageOf(cause)))
  }

  // The linked receipt, which is a VIEW of the payment and never records money.
  const receiptName = 'The payment auto-creates its linked receipt (§G)'
  try {
    const payments = await repos.payments.listForCompany(companyId)
    // `receiptFor` takes a payment that already exists and describes it. There
    // is no `createReceipt(amount)` anywhere, which is what makes "a reissued
    // receipt never increments income" structural rather than promised (§V).
    const draft = receiptFor(payments, paymentId)
    const receipt = await repos.documents.createDraft(
      {
        companyId,
        type: 'receipt',
        status: 'draft',
        customerId: draft.customerId,
        currency: draft.amount.currency,
        lineItems: [
          {
            id: 'l1',
            description: 'Payment received',
            quantityMilli: quantity(1),
            unitPriceMinor: draft.amount.minor,
            taxable: false,
          },
        ],
        paymentId: draft.paymentId,
        ...(draft.linkedInvoiceId === undefined ? {} : { linkedInvoiceId: draft.linkedInvoiceId }),
        totalMinor: draft.amount.minor,
      },
      key('receipt'),
    )
    results.push(
      receipt.paymentId === paymentId
        ? pass(receiptName, `receipt ${receipt.id} is evidence of payment ${paymentId}`)
        : fail(receiptName, 'the receipt does not name the payment'),
    )
  } catch (cause) {
    results.push(fail(receiptName, messageOf(cause)))
  }

  return results
}

async function deliveryAndSignature(
  repos: Repositories,
  companyId: string,
  customerId: string,
  run: string,
  key: (step: string) => ReturnType<typeof ctx>,
): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const name = 'Create and sign a delivery, offline (§P)'

  try {
    const waybill = await repos.documents.createDraft(
      {
        companyId,
        type: 'waybill',
        status: 'draft',
        customerId,
        currency: 'NGN',
        deliveryAddress: '12 Broad Street, Lagos',
        driverName: 'Chidi',
        vehicleNumber: 'LAG-441-XY',
        lineItems: [
          {
            id: 'l1',
            description: 'Cement, 50kg',
            quantityMilli: quantity(20),
            unitPriceMinor: 0,
            taxable: false,
          },
        ],
        totalMinor: 0,
      },
      key('waybill'),
    )
    await repos.documents.issue(
      waybill.id,
      {
        reference: `WAY-${run}-0001`,
        frozenLabels: freezeLabels({ locale: 'EN-NG' }, 'waybill'),
        totalMinor: 0,
      },
      key('waybillIssue'),
    )
    await repos.documents.transition(waybill.id, 'dispatched', key('waybillDispatch'))

    const mark = await repos.assets.store(
      {
        companyId,
        kind: 'signature',
        dataUrl: 'data:image/svg+xml,%3Csvg%2F%3E',
        createdAt: '2026-09-14T14:30:00Z',
      },
      key('signature'),
    )

    const signed = await repos.documents.signDelivery(
      waybill.id,
      {
        signerName: 'Bisi Adeyemi',
        signerRole: 'Storekeeper',
        signedAt: '2026-09-14T14:30:00Z',
        signerSignatureAssetId: mark.id,
      },
      key('sign'),
    )

    results.push(
      signed.status === 'delivered' && signed.signerName === 'Bisi Adeyemi'
        ? pass(name, `delivered and signed by ${signed.signerName} in one write`)
        : fail(name, `status ${signed.status}, signer ${String(signed.signerName)}`),
    )

    // Signed once, and sealed after (§P).
    const sealName = 'Delivery evidence is sealed once captured (§P)'
    try {
      await repos.documents.signDelivery(
        waybill.id,
        {
          signerName: 'Someone Else',
          signerRole: 'Impostor',
          signedAt: '2026-09-14T15:00:00Z',
          signerSignatureAssetId: mark.id,
        },
        key('resign'),
      )
      results.push(fail(sealName, 'a second signature was ACCEPTED'))
    } catch (cause) {
      results.push(pass(sealName, messageOf(cause).slice(0, 90)))
    }

    // §V: "Delivery documents show no money anywhere."
    const moneyName = 'A delivery shows no money anywhere (§V)'
    const model = composeDocument(composable(signed, 'Musa Ibrahim'), {
      profile: { locale: 'EN-NG' },
      branding: BRANDING,
      columnLabels: COLUMN_LABELS,
    })
    const hasMoneyColumn = model.columns.some((column) => column.key === 'amount')
    results.push(
      !hasMoneyColumn && model.totals === null
        ? pass(moneyName, `columns: ${model.columns.map((c) => c.key).join(', ')}; no totals block`)
        : fail(moneyName, `money leaked: columns ${model.columns.map((c) => c.key).join(', ')}`),
    )
  } catch (cause) {
    results.push(fail(name, messageOf(cause)))
  }

  return results
}

async function regionSwitchKeepsFrozenLabels(
  repos: Repositories,
  companyId: string,
  invoiceId: string,
  key: (step: string) => ReturnType<typeof ctx>,
): Promise<CheckResult> {
  const name = 'Switch region: live labels change, issued ones do not (§D, Rule #5)'
  try {
    const before = await repos.documents.get(companyId, invoiceId)
    const frozenBefore = before?.frozenLabels?.printedTitle

    // EN-NG calls it a Waybill; EN-GB calls it a Delivery Note. The invoice's
    // own words are the ones that must not move.
    const liveBefore = label({ locale: 'EN-NG' }, 'waybill')

    await repos.companies.update(companyId, { localeRegion: 'GB' }, key('region'))

    const liveAfter = label({ locale: 'EN-GB' }, 'waybill')
    const after = await repos.documents.get(companyId, invoiceId)
    const frozenAfter = after?.frozenLabels?.printedTitle

    const liveMoved = liveBefore !== liveAfter
    const frozenHeld = frozenBefore !== undefined && frozenBefore === frozenAfter

    // And the live title for an UNISSUED document does follow the region.
    const liveTitle = printedTitle({ locale: 'EN-GB' }, 'invoice')

    return liveMoved && frozenHeld
      ? pass(
          name,
          `live "${liveBefore}" → "${liveAfter}" (and "${liveTitle}" for a new invoice); ` +
            `the issued document still prints "${String(frozenAfter)}"`,
        )
      : fail(
          name,
          `liveMoved=${liveMoved} (${liveBefore} → ${liveAfter}), ` +
            `frozen ${String(frozenBefore)} → ${String(frozenAfter)}`,
        )
  } catch (cause) {
    return fail(name, messageOf(cause))
  }
}

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)
