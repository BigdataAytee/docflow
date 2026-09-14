# The visual reference, and which file is the authority

Two references live here. They are not interchangeable, and the difference
matters enough to write down.

## `handoff/` — the authority

`docflow-claude-code-handoff`, unpacked verbatim. All ten files verified
against the package's own `SHA256.json` on arrival. Its
`reference/frontend.html` is **the accepted visual reference**, per its
`START-HERE.md`:

> The latest accepted visual reference is this package's
> `reference/frontend.html`, not an earlier logo-only screen.

Read in the order `START-HERE.md` gives. `docs/APP-SPECIFICATION.md` in that
package is **byte-identical** to the specification supplied earlier
(`f8023dce…`), so nothing in the product requirements changed with this
handoff — only the frontend did.

## `prototype.html` — superseded, kept deliberately

The earlier interactive prototype. Commits up to and including the builder's
design step were transcribed from it, and their comments name it, so deleting
it would leave those comments pointing at nothing. It is kept as the record of
what that work was measured against, and **is no longer the thing to match**.

## What the new reference changes

Same eighteen screens, and the surface treatment is unchanged — `.gc`, `.cd`,
`.card`, `.pl` and `.fnav` are byte-identical between the two files, including
the ordering quirk below. What changed is Home, and the logo wizard.

**Home's header is now pale.** A third, later stylesheet scoped to
`#docflow-prototype` overrides it:

```
#vHome > .hd { background: linear-gradient(155deg,#91a9e9 0%,#a9beee 60%,#ccd9f5 100%) }
#vHome > .hd p { color: #24345f }
#vHome > .hd > span { display: none }     /* corner circle and sheen removed */
```

So the deep royal header with white text is superseded by a pale blue band
with navy text, and the two decorations are gone. The stat cards become light
cards — value 23px/600 above a 10.5px/500 label — with "Received this month"
in green (`#147258`). Home also gains a **"Your next steps" checklist**
(§18), which the build does not have at all.

## The ordering quirk, still present

The reference carries a stylesheet titled "Corporate glass layer" that is
ordered **before** the main block, so the main block wins almost everything it
sets: its translucent surfaces, borders and shadows never render, and only
`backdrop-filter` survives. The rendered appearance is therefore the opaque
gradients, which is what this build implements and what was approved:

> the `#glass-corporate` block was authored as an override but is ordered so it
> loses, and the rendering you matched is the design I approved.

Take surface values from `getComputedStyle` on the running page, never from
reading the source, or you will implement a design nobody has seen.

## Where §F still wins

`START-HERE.md` is explicit that this package "does not authorize ignoring"
the repository's own instructions. So `DocFlow-Build-v6-Complete.md` §F
remains the authority for tokens and rules — locked accents, one word through
`src/domain/locale`, tap targets, never-clipping labels — and the reference
fills in what §F describes without quantifying.
