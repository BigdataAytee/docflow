/**
 * §T's store screenshots: what to shoot, at what size, and what each shot must
 * PROVE before it is allowed to be saved.
 *
 * §T: "screenshots and preview video **re-shot with that locale's labels and
 * currency**… screenshots showing each document type by its local name", and
 * the failure it names outright: "**Not a translated caption over an EN-NG
 * screenshot.**"
 *
 * That failure is invisible in a PNG. Nobody reviewing a folder of images
 * notices that the Spanish set says "Invoice", and the store certainly will
 * not. So every shot below carries the words it must contain, taken from the
 * §D terminology table and the locale's currency — and the capture refuses to
 * save an image whose page did not actually render them. A wrong screenshot is
 * never written to disk, so there is nothing to review and miss.
 */

import type { DocumentType } from '../../domain/documents/types'
import type { LocaleId } from '../../domain/locale/types'

/**
 * The sizes the stores actually require.
 *
 * Apple accepts one image size per device family and scales it to the others,
 * so the two here are the two families a submission needs. Play's phone
 * screenshots have a ratio requirement rather than a fixed size; 1080×1920 is
 * inside it and is what a common Android phone reports.
 *
 * These are pixel dimensions, not CSS pixels: the capture sets a CSS viewport
 * and a device scale factor whose product is the number below, because a
 * 1290-CSS-pixel-wide page is a tablet layout photographed at phone size.
 */
export interface StoreDevice {
  readonly id: string
  readonly store: 'apple' | 'play'
  /** What the file must measure, in real pixels. */
  readonly width: number
  readonly height: number
  /** CSS pixels the page is laid out at. */
  readonly cssWidth: number
  readonly cssHeight: number
  readonly scale: number
}

export const STORE_DEVICES: readonly StoreDevice[] = [
  {
    id: 'iphone-6.9',
    store: 'apple',
    width: 1290,
    height: 2796,
    cssWidth: 430,
    cssHeight: 932,
    scale: 3,
  },
  {
    id: 'ipad-13',
    store: 'apple',
    width: 2064,
    height: 2752,
    cssWidth: 1032,
    cssHeight: 1376,
    scale: 2,
  },
  {
    id: 'android-phone',
    store: 'play',
    width: 1080,
    height: 1920,
    cssWidth: 360,
    cssHeight: 640,
    scale: 3,
  },
]

/**
 * One frame of the store listing.
 *
 * `route` is an INTERNAL path (`/list/waybill`, never `/list/delivery-note`) —
 * §G's rule, and the reason a screenshot spec can name a screen without naming
 * a word.
 */
export interface Shot {
  readonly id: string
  readonly route: string
  /** The type whose local name must appear, when the shot is about one. */
  readonly type?: DocumentType
  /** Must the locale's currency be visible? */
  readonly showsMoney: boolean
  readonly caption: string
}

export const SHOTS: readonly Shot[] = [
  { id: 'home', route: '/', showsMoney: true, caption: 'Everything, on one screen' },
  {
    id: 'invoices',
    route: '/list/invoice',
    type: 'invoice',
    showsMoney: true,
    caption: 'Money owed, at a glance',
  },
  {
    id: 'quotations',
    route: '/list/quotation',
    type: 'quotation',
    showsMoney: true,
    caption: 'Send a price before the job',
  },
  {
    id: 'receipts',
    route: '/list/receipt',
    type: 'receipt',
    showsMoney: true,
    caption: 'Proof of payment, instantly',
  },
  {
    id: 'deliveries',
    route: '/list/waybill',
    type: 'waybill',
    showsMoney: false,
    caption: 'Goods out, signed for',
  },
]

export interface ShotPlan {
  readonly locale: LocaleId
  readonly device: StoreDevice
  readonly shot: Shot
  /** Relative path the PNG is written to. */
  readonly file: string
  /**
   * Text the rendered page MUST contain before the image is saved.
   *
   * This is the whole point of the spec: the words come from the terminology
   * table and the currency, so a page that rendered English under a Spanish
   * flag fails here instead of becoming a file somebody submits.
   */
  readonly mustContain: readonly string[]
}

export const fileFor = (locale: LocaleId, device: StoreDevice, shot: Shot): string =>
  `${locale}/${device.id}/${shot.id}.png`
