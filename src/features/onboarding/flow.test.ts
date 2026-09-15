/**
 * The welcome flow (§R).
 *
 * Walked the way a person walks it, because the thing worth protecting is
 * that every page can be LEFT. §R defers everything except a business name,
 * and Rule #1 forbids a new required field — an onboarding that traps
 * somebody on page two has broken both without anything else noticing.
 */

import { describe, expect, it } from 'vitest'

import {
  FlowError,
  back,
  begin,
  pickType,
  saveBusiness,
  shouldOnboard,
  skipBusiness,
  startFlow,
  stepNumber,
  toReady,
} from './flow'

const fresh = () => startFlow('NG')

describe('Walking the welcome', () => {
  it('starts on the welcome page, before the numbered steps', () => {
    expect(fresh().page).toBe('welcome')
    expect(stepNumber('welcome')).toBe(0)
  })

  it('numbers the three steps the progress bar names', () => {
    expect(stepNumber('business')).toBe(1)
    expect(stepNumber('task')).toBe(2)
    expect(stepNumber('ready')).toBe(3)
  })

  it('carries the name and the country through to the end', () => {
    const state = toReady(
      pickType(saveBusiness(begin(fresh()), 'Sola Ventures', 'GH'), 'quotation'),
    )
    expect(state).toMatchObject({
      page: 'ready',
      businessName: 'Sola Ventures',
      region: 'GH',
      type: 'quotation',
      exploring: false,
    })
  })

  it('trims the name, so a stray space is not a business name', () => {
    expect(saveBusiness(fresh(), '  Sola Ventures  ', 'NG').businessName).toBe('Sola Ventures')
  })
})

describe('Every page can be left (§R, Rule #1)', () => {
  /**
   * The one answer §R requires, refused for the reason it is required: the
   * name prints on every document, and a document headed by nothing is not
   * one. The same sentence `completeBusinessStep` uses, so meeting it twice
   * is meeting one message.
   */
  it('refuses an empty business name, in the words setup already uses', () => {
    expect(() => saveBusiness(fresh(), '   ', 'NG')).toThrow(FlowError)
    expect(() => saveBusiness(fresh(), '', 'NG')).toThrow(
      'A business name is needed — it prints on every document.',
    )
  })

  /** …and the way past it, so the refusal is never a trap. */
  it('lets somebody skip the business and look around instead', () => {
    const state = skipBusiness(begin(fresh()))
    expect(state.page).toBe('task')
    expect(state.exploring).toBe(true)
    expect(state.businessName).toBe('')
  })

  it('goes back a page at a time', () => {
    const ready = toReady(saveBusiness(begin(fresh()), 'Sola', 'NG'))
    expect(back(ready).page).toBe('task')
    expect(back(back(ready)).page).toBe('business')
    expect(back(back(back(ready))).page).toBe('welcome')
  })

  /** A hardware back button on the first page is not an error. */
  it('stays put rather than throwing at the front door', () => {
    expect(back(fresh()).page).toBe('welcome')
  })
})

describe('Who sees it at all', () => {
  const asked = { companyName: '', dismissed: false, documentCount: 0 }

  it('shows it to somebody who has not named a business', () => {
    expect(shouldOnboard(asked)).toBe(true)
    expect(shouldOnboard({ ...asked, companyName: undefined })).toBe(true)
    expect(shouldOnboard({ ...asked, companyName: '   ' })).toBe(true)
  })

  it('does not show it once a business has a name', () => {
    expect(shouldOnboard({ ...asked, companyName: 'Sola Ventures' })).toBe(false)
  })

  /**
   * The dismissal is the one part that cannot be derived: somebody who chose
   * to explore has answered the question, and asking again every launch would
   * be the app forgetting what it was told.
   */
  it('does not show it again once it has been left', () => {
    expect(shouldOnboard({ ...asked, dismissed: true })).toBe(false)
  })

  /**
   * Somebody with documents is already working. Interrupting them to explain
   * the app would be worse than never showing this at all — and it is the
   * failure mode a "have they seen it?" flag produces when storage is cleared.
   */
  it('never interrupts somebody who is already working', () => {
    expect(shouldOnboard({ ...asked, documentCount: 1 })).toBe(false)
    expect(shouldOnboard({ companyName: '', dismissed: false, documentCount: 3 })).toBe(false)
  })
})
