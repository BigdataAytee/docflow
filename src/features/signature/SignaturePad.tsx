/**
 * The signing surface (§G step 1, §M).
 *
 * §G asks for "a dashed tap-to-sign box, or the drawn signature", and §M puts
 * signatures inside what airplane mode has to support. So this is an SVG and
 * pointer events, and nothing else: no canvas, no native bridge, no upload.
 * The same component works on a phone, in a WebView and under a test runner.
 *
 * Two rules it keeps:
 *
 *  · **Nothing is saved until the owner says so.** Drawing is local state;
 *    "Use this" is what produces an asset. Closing loses the marks, which is
 *    what closing should do.
 *  · **A blank pad cannot be accepted.** `isBlank` gates the button, so a
 *    document can never be marked signed with no signature on it (§P).
 */

import { useRef, useState } from 'react'

import { useCompany } from '../../app/context'
import type { UiStrings } from '../../domain/locale/data/strings'
import {
  type Point,
  type Strokes,
  STROKE_WIDTH,
  isBlank,
  pathOf,
  renderSignature,
  undoStroke,
} from './strokes'

export interface SignaturePadProps {
  /**
   * The words, when there is no company context to read them from.
   *
   * The public signing page (§Q Phase 5) runs outside every provider — a
   * customer has no account and no company — AND has to render in the
   * DOCUMENT's frozen language rather than the owner's (§P). Both are the
   * same requirement: the pad is handed its words instead of reaching for
   * them.
   */
  readonly strings?: UiStrings
  /** Called with the rendered SVG and its data URL. Never with a blank one. */
  readonly onUse: (signature: { svg: string; dataUrl: string }) => void
  readonly onClose: () => void
  /** Offered when Settings holds one, so a signature is drawn once (§G). */
  readonly onUseDefault?: () => void
  readonly error?: string
}

/** The pad's own coordinate space; the SVG scales it to whatever width it gets. */
const WIDTH = 320
const HEIGHT = 150

export function SignaturePad(props: SignaturePadProps) {
  // Reading the context is a hook, so it cannot be conditional — the two
  // entry points are separated instead.
  return props.strings === undefined ? (
    <SignaturePadFromContext {...props} />
  ) : (
    <SignaturePadView {...props} strings={props.strings} />
  )
}

function SignaturePadFromContext(props: SignaturePadProps) {
  const { strings } = useCompany()
  return <SignaturePadView {...props} strings={strings} />
}

function SignaturePadView({
  onUse,
  onClose,
  onUseDefault,
  error,
  strings,
}: SignaturePadProps & { strings: UiStrings }) {
  const s = strings.signature

  const [strokes, setStrokes] = useState<Strokes>([])
  const drawing = useRef(false)
  const surface = useRef<SVGSVGElement | null>(null)

  /** Client coordinates into the pad's own space, so scaling never skews a mark. */
  const at = (event: { clientX: number; clientY: number }): Point => {
    const box = surface.current?.getBoundingClientRect()
    if (box === undefined || box.width === 0 || box.height === 0) {
      return { x: event.clientX, y: event.clientY }
    }
    return {
      x: ((event.clientX - box.left) / box.width) * WIDTH,
      y: ((event.clientY - box.top) / box.height) * HEIGHT,
    }
  }

  const start = (event: React.PointerEvent<SVGSVGElement>) => {
    drawing.current = true
    // Capture, so a mark that runs off the edge finishes rather than breaking
    // into two — and so a stroke cannot be left open by a pointer lost
    // outside the box.
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setStrokes((current) => [...current, [at(event)]])
  }

  const extend = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return
    const point = at(event)
    setStrokes((current) => {
      const last = current[current.length - 1]
      if (last === undefined) return current
      return [...current.slice(0, -1), [...last, point]]
    })
  }

  const end = () => {
    drawing.current = false
  }

  const ready = !isBlank(strokes)

  return (
    <section className="glass-solid rounded-2xl p-4" aria-label={s.title}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{s.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={strings.common.cancel}
          className="min-h-tap min-w-tap text-lg leading-none opacity-70"
        >
          ✕
        </button>
      </div>
      <p className="mt-1 text-xs opacity-70">{s.explain}</p>

      <svg
        ref={surface}
        role="application"
        aria-label={s.pad}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-3 w-full touch-none rounded-xl border-2 border-dashed border-ink/25 bg-surface"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        onPointerDown={start}
        onPointerMove={extend}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {/* The line to sign above, the way a paper form has one. */}
        <line
          x1={24}
          y1={HEIGHT - 34}
          x2={WIDTH - 24}
          y2={HEIGHT - 34}
          stroke="currentColor"
          strokeWidth={1}
          className="text-ink/20"
        />
        {strokes.map((stroke, i) => (
          <path
            // Strokes are only ever appended to or dropped from the end, so
            // the index is stable for the life of a mark.
            key={i}
            d={pathOf(stroke)}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink"
          />
        ))}
      </svg>
      <p className="mt-1 text-center text-[11px] opacity-70">{ready ? s.drawn : s.hint}</p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="min-h-tap flex-1 rounded-xl border border-edge/10 px-3 text-sm font-medium disabled:opacity-70"
          disabled={strokes.length === 0}
          onClick={() => setStrokes(undoStroke(strokes))}
        >
          {s.undo}
        </button>
        <button
          type="button"
          className="min-h-tap flex-1 rounded-xl border border-edge/10 px-3 text-sm font-medium disabled:opacity-70"
          disabled={strokes.length === 0}
          onClick={() => setStrokes([])}
        >
          {s.clear}
        </button>
      </div>

      <button
        type="button"
        className="raised tap-scale mt-2 min-h-tap w-full rounded-xl bg-gradient-to-b from-brand-light to-brand px-4 text-sm font-semibold text-white disabled:opacity-70"
        disabled={!ready}
        onClick={() => {
          const rendered = renderSignature(strokes)
          // `ready` already rules this out; the guard is here because a
          // signature is evidence and a null one must never reach a document.
          if (rendered === null) return
          onUse({ svg: rendered.svg, dataUrl: rendered.dataUrl })
        }}
      >
        {s.use}
      </button>

      {onUseDefault !== undefined && (
        <button
          type="button"
          className="mt-2 min-h-tap w-full rounded-xl border border-edge/10 px-4 text-sm font-medium"
          onClick={onUseDefault}
        >
          {s.useDefault}
        </button>
      )}

      {error !== undefined && (
        <p
          className="mt-3 rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm font-medium text-status-warn"
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  )
}
