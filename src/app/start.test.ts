/**
 * The combination nothing ever ran: NATIVE and ACCOUNT.
 *
 * `npm run dev` is web + demo. The whole suite is web + demo. The device gate
 * builds are native + demo. Native + account — the shape a real owner with a
 * real account installs — had no coverage anywhere, and that is exactly where
 * the splash-never-hides bug lived: the shell was wired inside the branch
 * `createBackend` only takes when NO project is configured.
 *
 * So the first test here is the regression, and the matrix below it exists so
 * the next person cannot fix one cell and break another.
 */

import { describe, expect, it, vi } from 'vitest'

import { startApp } from './start'
import type { Backend } from '../data/backend'

const account = { kind: 'account' } as unknown as Backend
const demo = { kind: 'demo' } as unknown as Backend

const shellSpy = (native: boolean) => ({
  isNativePlatform: vi.fn(async () => native),
  settleShell: vi.fn(async () => undefined),
})

describe('The native shell settles on platform, not on backend kind', () => {
  /**
   * THE REGRESSION. On a phone with a Supabase project configured,
   * `createBackend` returns an `account` backend without ever calling the
   * loader that used to hold this call — so the splash stayed up over a
   * working app. Reverting the fix turns this red and nothing else.
   */
  it('settles on a phone even when the backend is an ACCOUNT', async () => {
    const shell = shellSpy(true)
    const mark = vi.fn()

    const resolved = await startApp(async () => account, shell, mark)

    expect(resolved).toBe(account)
    expect(shell.settleShell).toHaveBeenCalledOnce()
    expect(mark).toHaveBeenCalledOnce()
  })

  it('still settles on a phone when the backend is a demo', async () => {
    const shell = shellSpy(true)
    await startApp(async () => demo, shell, vi.fn())
    expect(shell.settleShell).toHaveBeenCalledOnce()
  })

  it.each([
    ['account', account],
    ['demo', demo],
  ])('touches no native shell in a browser, on a %s backend', async (_name, backend) => {
    const shell = shellSpy(false)
    const mark = vi.fn()

    await startApp(async () => backend, shell, mark)

    expect(shell.settleShell).not.toHaveBeenCalled()
    expect(mark).not.toHaveBeenCalled()
  })
})

describe('What the backend loader is told, and when', () => {
  it.each([true, false])('passes the platform answer through (native: %s)', async (native) => {
    const loadBackend = vi.fn(async () => demo)
    await startApp(loadBackend, shellSpy(native), vi.fn())
    expect(loadBackend).toHaveBeenCalledWith(native)
  })

  /**
   * §Q Phase 4 budgets the cold start to an interactive dashboard, and
   * `settleShell`'s own contract is "called AFTER the backend resolves, so
   * none of it is on the cold-start path". Settling first would put the status
   * bar in front of the thing a person is waiting for.
   */
  it('settles after the backend resolves, never before', async () => {
    const order: string[] = []
    const shell = {
      isNativePlatform: async () => true,
      settleShell: async () => void order.push('settle'),
    }

    await startApp(
      async () => {
        order.push('backend')
        return account
      },
      shell,
      vi.fn(),
    )

    expect(order).toEqual(['backend', 'settle'])
  })

  /**
   * A configured-but-broken project throws by design (§R: an account having a
   * bad day is never degraded to a demo). The screen saying so renders behind
   * the splash, so a splash that survives the failure hides the only
   * explanation anybody gets.
   */
  it('settles even when the backend throws, and still throws', async () => {
    const shell = shellSpy(true)
    const boom = new Error('anon key rejected')

    await expect(
      startApp(async () => {
        throw boom
      }, shell, vi.fn()),
    ).rejects.toBe(boom)

    expect(shell.settleShell).toHaveBeenCalledOnce()
  })

  /** A shell failure must not be the reason an owner cannot open an invoice. */
  it('does not fail the app when settling fails', async () => {
    const shell = {
      isNativePlatform: async () => true,
      settleShell: vi.fn(async () => {
        throw new Error('no status-bar plugin')
      }),
    }

    await expect(startApp(async () => account, shell, vi.fn())).resolves.toBe(account)
  })
})
