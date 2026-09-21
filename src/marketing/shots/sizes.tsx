/**
 * Every design, every document type, at A4 — so the type on them can be
 * MEASURED (§I, §H).
 *
 * The sixteen designs are sixteen different header layouts over one page
 * renderer, and each places its own title, name, dates and amount. A size
 * sitting under the print floor in one of them is invisible from any other,
 * and there is no route in the app that shows more than the one design the
 * document was saved with. This entry puts all sixteen on screen at once,
 * with a real document of each type in each, so `tools/sweeps/pdfsizes.ts`
 * can walk every text node that prints and read what the browser actually
 * resolved.
 *
 * EXACTLY 794px WIDE, which is A4 at 96dpi and the coordinate space
 * `DocumentPage` is written in. At that width its `zoom: calc(100cqi/794px)`
 * is exactly 1, so a computed font-size IS a page px and `ptOf` converts it
 * with no scale factor to get wrong. Rendering narrower and dividing back out
 * would put the thing under test — a size — on the far side of an arithmetic
 * step the sweep itself performed.
 *
 * THE SAME COMPONENTS THE APP PRINTS. `composableOf`, `composeOptionsOf` and
 * `LivePreview` are the app's own wiring, so this measures what a customer
 * receives. A page assembled here by hand would measure this file.
 *
 * Built only into `dist-shots`, like the screenshot entry beside it — never
 * into `dist/`, and `isolation.test.ts` holds that rather than trusting it.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories } from '../../data/repositories'
import type { Company, DocumentRecord } from '../../data/repositories'
import { DOCUMENT_TYPES, type DocumentType, quantity } from '../../domain/documents/types'
import { money } from '../../domain/money/money'
import { regionProfile } from '../../features/settings/region'
import { stringsFor } from '../../domain/locale/data/strings'
import {
  composableOf,
  composeOptionsOf,
  designOf,
  draftOf,
} from '../../features/documents/composition'
import { composeDocument } from '../../pdf/compose'
import { DocumentPage } from '../../pdf/DocumentPage'
import { FOOTER_ROW_COST, ROWS_PER_PAGE, paginate } from '../../pdf/paginate'
import { formatMoney } from '../../features/customers/formatMoney'
import { TYPE_PALETTE } from '../../ui'
import { TEMPLATES, templateById, type TemplateId } from '../../pdf/templates'
import '../../index.css'
import { SHOT_COMPANY_ID } from './fixtures'

/** A4 at 96dpi. The page's own coordinate space, so `zoom` resolves to 1. */
const A4_PX = 794

const REGION = 'NG'
const profile = regionProfile(REGION)
const strings = stringsFor('en')

/**
 * MORE LINES THAN ONE PAGE HOLDS, on purpose.
 *
 * Every sheet here is drawn to its last page, so the sweep sees a table
 * filled to capacity AND the block underneath it — the totals, the payment
 * box, the signature, the contact strip — which is where the smallest type on
 * the document lives and where an overrun would be clipped. Two sample lines
 * would have measured the top of the page and called it a document; the first
 * version of this file rendered page one only, found no total at all, and the
 * overflow check passed by never seeing a footer.
 */
const LINES = Array.from({ length: ROWS_PER_PAGE + 4 }, (_, index) => ({
  id: `li_${index + 1}`,
  description:
    index % 4 === 0
      ? 'Hardwood panels, 18mm marine ply, cut to size and edge-sealed'
      : `Fixings and fittings, batch ${index + 1}`,
  quantityMilli: quantity(index + 2),
  unitPriceMinor: 47_500_00 + index * 1_250_00,
  taxable: true,
}))

const company: Company = {
  id: SHOT_COMPANY_ID,
  name: 'Adeyemi Timber & Hardware',
  localeRegion: REGION,
  localeLanguage: 'en',
  currency: profile.currency,
  numberingPrefixes: {},
  /* A filled payment box, because it is the smallest type on the page. */
  bankFields: { bank_name: 'First Bank of Nigeria', account_name: 'Adeyemi Timber & Hardware', account_number: '3081946275' },
  enabledPaymentMethods: ['bank_transfer'],
  nameStyle: 'classic',
  logoSize: 'M',
  address: '14 Ijoko Road, Ifo, Ogun State',
  phone: '+234 802 445 9013',
  email: 'accounts@adeyemitimber.ng',
}

const customer = {
  id: 'cu_1',
  companyId: SHOT_COMPANY_ID,
  kind: 'company' as const,
  name: 'Oyelaran Construction Limited',
  address: '9 Alhaji Bashiru Street, Agege, Lagos',
  labels: [],
}

const PREFIX: Record<DocumentType, string> = {
  invoice: 'INV',
  quotation: 'QUO',
  receipt: 'REC',
  waybill: 'WAY',
}

const recordFor = (type: DocumentType): DocumentRecord => ({
  id: `${type}_1`,
  companyId: SHOT_COMPANY_ID,
  type,
  status: type === 'waybill' ? 'dispatched' : 'sent',
  customerId: customer.id,
  currency: profile.currency,
  lineItems: type === 'waybill' ? LINES.map(({ unitPriceMinor: _drop, ...rest }) => rest) : LINES,
  issueDate: '2026-09-14',
  ...(type === 'invoice' ? { dueDate: '2026-09-28' } : {}),
  issuedReference: `${PREFIX[type]}-0042`,
  frozenLabels: null,
  totalMinor: type === 'waybill' ? 0 : 1_004_250_00,
  ...(type === 'waybill'
    ? { deliveryAddress: customer.address, driverName: 'Musa Ibrahim', vehicleNumber: 'LAG-482-XA' }
    : {}),
  /* A receipt has to carry its evidence, which is the block under the totals. */
  ...(type === 'receipt'
    ? {
        paymentId: 'pay_1',
        invoiceTotalMinor: 1_500_000_00,
        paidBeforeMinor: 200_000_00,
        balanceAfterMinor: 295_750_00,
      }
    : {}),
})

const repositories = createMemoryRepositories()

function Sheet({ type, templateId }: { type: DocumentType; templateId: TemplateId }) {
  const record = recordFor(type)
  const design = { ...designOf(record, company), templateId }
  const composable = composableOf({
    draft: draftOf(record),
    design,
    company,
    customer,
    profile,
    reference: record.issuedReference ?? null,
    status: record.status,
    frozenLabels: null,
    replaces: null,
    today: '2026-09-21',
    /* Every figure a receipt prints, so the evidence block is not empty. */
    ...(type === 'receipt'
      ? {
          payment: {
            amount: money(profile.currency, 1_004_250_00),
            at: '2026-09-18',
            method: 'Bank transfer',
          },
        }
      : {}),
  })

  const model = composeDocument(composable, {
    ...composeOptionsOf({ company, design, strings, assets: [] }),
    profile,
  })
  const pages = paginate(model, { rowsPerPage: ROWS_PER_PAGE, footerRowCost: FOOTER_ROW_COST })
  const template = templateById(templateId)

  /*
   * EVERY page, not the first. `LivePreview` draws page one by design — it is
   * a preview of a DESIGN — and measuring through it meant the totals, the
   * payment box and the signature were never on screen at all.
   */
  return (
    <>
      {pages.map((page) => (
        <div
          key={page.pageNumber}
          data-sheet={`${templateId}:${type}:${page.pageNumber}`}
          style={{ width: A4_PX, marginBottom: 24 }}
        >
          <DocumentPage
            model={model}
            template={template}
            page={page}
            totalPages={pages.length}
            formatAmount={(minor, currency) => formatMoney(money(currency, minor))}
            currency={composable.currency}
            accent={TYPE_PALETTE[type].accent}
            continuedLabel={strings.common.next}
          />
        </div>
      ))}
    </>
  )
}

const root = document.getElementById('root')
if (root === null) throw new Error('Missing #root')

createRoot(root).render(
  <StrictMode>
    <CompanyProvider companyId={SHOT_COMPANY_ID} repositories={repositories} profile={profile} isDemo>
      <div style={{ width: A4_PX }}>
        {TEMPLATES.map((template) =>
          DOCUMENT_TYPES.map((type) => (
            <Sheet key={`${template.id}:${type}`} type={type} templateId={template.id} />
          )),
        )}
      </div>
    </CompanyProvider>
  </StrictMode>,
)