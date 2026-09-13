/**
 * Resolving the backend, on the routes that actually need one (§R, §N).
 *
 * Mounted INSIDE the private route, never above it. That placement is the
 * whole point: a customer opening `/accept/:token` has no account, and their
 * page talks to the edge function over plain `fetch`. Resolving a database
 * client before rendering anything made the cheapest phone on the slowest
 * connection wait for a feature it never uses (Rule #1).
 *
 * Three states, and the third is the one worth writing down. `createBackend`
 * THROWS on a configured-but-broken project — a service-role key pasted into
 * the anon slot, most importantly, which would ship BYPASSRLS to every
 * browser. Before this was lazy, that threw at module scope and the user got a
 * white screen. A white screen is not a message (§N), so the failure is shown.
 *
 * What is shown is deliberately plain. The underlying error names the specific
 * misconfiguration, which is exactly what a developer needs and exactly what a
 * stranger should not be handed, so the detail goes to the console and the
 * page says only that the app is not set up correctly.
 */

import { useEffect, useState, type ReactNode } from 'react'

import type { Backend } from '../data/backend'
import { SkeletonList } from '../ui'

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly backend: Backend }
  | { readonly kind: 'failed' }

export interface BackendBoundaryProps {
  readonly load: () => Promise<Backend>
  readonly children: (backend: Backend) => ReactNode
}

export function BackendBoundary({ load, children }: BackendBoundaryProps) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let live = true
    load().then(
      (backend) => {
        if (live) setState({ kind: 'ready', backend })
      },
      (cause: unknown) => {
        if (!live) return
        // The detail, for whoever deployed this. Never the keys themselves —
        // the errors this catches describe a key, they do not carry one.
        console.error('DocFlow could not start:', cause)
        setState({ kind: 'failed' })
      },
    )
    return () => {
      live = false
    }
  }, [load])

  if (state.kind === 'loading') {
    // A skeleton, never a spinner and never a blank screen (CLAUDE.md).
    return (
      <main className="mx-auto w-full max-w-md px-5 py-10">
        <SkeletonList rows={3} />
      </main>
    )
  }

  if (state.kind === 'failed') {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-10">
        <p className="rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm font-medium text-status-warn" role="alert">
          This app is not set up correctly. Whoever installed it needs to check
          its configuration.
        </p>
      </main>
    )
  }

  return <>{children(state.backend)}</>
}
