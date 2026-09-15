/**
 * Storage used, counted rather than guessed (§G).
 */

import { describe, expect, it } from 'vitest'

import { dataUrlBytes, formatBytes } from './storage'

describe('An asset is measured from its own bytes', () => {
  it('counts a base64 payload at three bytes per four characters', () => {
    // "AAAA" decodes to three bytes.
    expect(dataUrlBytes('data:image/png;base64,AAAA')).toBe(3)
    expect(dataUrlBytes('data:image/png;base64,AAAAAAAA')).toBe(6)
  })

  it('does not count the padding as content', () => {
    expect(dataUrlBytes('data:image/png;base64,AA==')).toBe(1)
    expect(dataUrlBytes('data:image/png;base64,AAA=')).toBe(2)
  })

  it('counts a plain data URL rather than reporting it as empty', () => {
    expect(dataUrlBytes('data:text/plain,hello')).toBe(5)
  })

  it('is unbothered by something that is not a data URL', () => {
    expect(dataUrlBytes('')).toBe(0)
    expect(dataUrlBytes('not a url at all')).toBe(0)
  })
})

describe('A size is readable, and never rounds a real file to nothing', () => {
  it('says what the reference says', () => {
    expect(formatBytes(1_258_291)).toBe('1.2 MB')
    expect(formatBytes(3_565_158)).toBe('3.4 MB')
  })

  it('uses whole kilobytes below a megabyte', () => {
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(999_999)).toBe('977 KB')
  })

  /**
   * A signature is a few hundred bytes. "0 KB" beside it would read as
   * "nothing is stored" while a file sits on the phone.
   */
  it('never reports a stored file as zero', () => {
    expect(formatBytes(1)).toBe('1 KB')
    expect(formatBytes(400)).toBe('1 KB')
    expect(formatBytes(0)).toBe('0 KB')
  })
})
