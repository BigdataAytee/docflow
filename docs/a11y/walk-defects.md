# Device walk — defects found (2026-09-21, Pixel 9 Pro XL)

Ten walks, both themes, screen brightness 12/255. Every entry was found by
looking at the phone; the note says why the guards did not.

| # | What | Where | Severity | State |
| --- | --- | --- | --- | --- |
| 1 | The demo banner draws into the status bar, so the clock and icons sit on its text. In dark the status icons stay dark on a dark banner. | Every screen, demo build | Medium — demo only | Open |
| 2 | Home's two round controls (voice, camera) had a hardcoded white tile carrying `text-brand-ink`, which is pale blue in dark: 2.0:1. **A regression from Part A.** | Home, dark | High | Fixed |
| 3 | `LogoHolder` painted a white square even with no logo — invisible on white paper, a blank white box on Aria, Botanic and Bloom, which print on cream. | Every design, printed page | High | Fixed |
| 4 | **The four Home card icons are the locked accent on the type's dark tint — effectively invisible in dark mode.** Reported by the owner, not by a guard. | Home, dark | High | Fixed |
| 5 | Every tab in the bottom nav that is not selected: 2.4:1 against its tile. Three of four tabs at any moment, and the nav carries no labels — the icon is all there is. | Every route | High | Fixed |
| 6 | Muted glyphs at 35–45% opacity: the settings chevrons, the search magnifier, the date-field calendar, the photo placeholder. 1.89–2.61:1. | Settings, lists, builder | Medium | Fixed |

## Why the contrast sweep missed 2 and 4

`tools/sweeps/contrast.test.ts` walks TEXT NODES. An icon is an inline SVG
with no text node in it, so every glyph in the app — the card plates, the
round controls, the row icons, the nav — was outside what the sweep could
see. WCAG 2.2 AA covers them under 1.4.11 (non-text contrast, 3:1) and the
pass claimed AA.

A guard that measures text and is described as measuring contrast is the
shape CLAUDE.md warns about: it passed, and it was never asked the question.

**The sweep now collects icons too**, in the same screenshot pass, and holds
them to 1.4.11's 3:1. On the first run it found **110 of 202 icons failing in
light and 105 of 201 in dark**, from eight distinct sources. All eight are
fixed. Mutation-proved by putting the card plates back to the locked accent:
five icons go red in dark at 1.09–2.39:1, and light stays green, which is
exactly the shape of what was reported.
