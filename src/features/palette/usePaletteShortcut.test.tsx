/**
 * The shortcut that opens the palette.
 */

import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { usePaletteShortcut } from './usePaletteShortcut'

function Harness({ onOpen }: { onOpen: () => void }) {
  usePaletteShortcut(onOpen)
  return <input aria-label="somewhere to type" />
}

describe('Ctrl-K, or Command-K', () => {
  it('opens on the modifier, from anywhere on the page', async () => {
    const onOpen = vi.fn()
    render(<Harness onOpen={onOpen} />)

    await userEvent.keyboard('{Control>}k{/Control}')
    expect(onOpen).toHaveBeenCalledTimes(1)

    await userEvent.keyboard('{Meta>}k{/Meta}')
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('stays out of the way of typing the letter k', async () => {
    const onOpen = vi.fn()
    const { getByLabelText } = render(<Harness onOpen={onOpen} />)

    await userEvent.type(getByLabelText('somewhere to type'), 'a knock at the door')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('lets go of the window when it unmounts', async () => {
    const onOpen = vi.fn()
    const { unmount } = render(<Harness onOpen={onOpen} />)
    unmount()

    await userEvent.keyboard('{Control>}k{/Control}')
    expect(onOpen).not.toHaveBeenCalled()
  })
})
