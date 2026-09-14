# DocFlow frontend and build handoff

## Open the app

Open `index.html` in a desktop browser. It contains the exported interactive prototype and starts at Home. If your browser restricts local-file behaviour, run `python -m http.server 8080` in this folder and open http://localhost:8080.

The current reference uses external font/icon stylesheets and preview helper libraries. Internet may be needed to reproduce the typography/icons in this export. This is separate from the production requirement: the mobile build must bundle its fonts, icons, templates and installed AI models to operate offline. No AI models are included in this archive.

## Give Claude Code this instruction

Read `docs/APP-SPECIFICATION.md`, `docs/IMPLEMENTATION-GAPS.md`, `docs/INTERACTION-INVENTORY.md` and the complete `reference/frontend.html` before changing anything. Build DocFlow using the agreed stack. Match the supplied frontend's layout, colours, typography, spacing, document designs, navigation and interaction sequences. Preserve the original greeting and content. Do not redesign or substitute a generic dashboard.

Use the HTML as the visual reference and the specification as the intended production behaviour. Replace simulated actions with real implementations. Work through every static and dynamically generated control, page, modal, builder step and document template. Implement genuine offline storage, PDF generation, payments, sync and local open-source AI as specified. Do not use cloud AI or fake success toasts. Record any unresolved capability honestly.

Check each route, control and end-to-end process in a browser and on the target native devices. Compare screenshots with the supplied reference at matching viewport sizes. Do not call the product complete until its acceptance gates pass. Reconcile with existing repository instructions before implementation; this handoff does not authorize ignoring them.

## Read in this order

1. `docs/APP-SPECIFICATION.md`: full product requirements, all screens, sixteen document templates, architecture and acceptance gates. Section 12 requires offline open-source voice, OCR, extraction and analytics. Section 17 requires at least twenty distinct relevant logo ideas.
2. `reference/frontend.html`: complete unmodified source of the latest displayed frontend; includes HTML, CSS, all script blocks, dynamic views, handlers and demo data.
3. `docs/INTERACTION-INVENTORY.md`: generated static controls and navigation/function locators. It is an index, not a substitute for reading the source; generated controls require walking the functions.
4. `reference/styles.css` and `reference/behaviour.js`: extracted styles/scripts for easier reading. They are companion copies in original order; the preview does not import them separately.
5. `docs/IMPLEMENTATION-GAPS.md`: known demonstrations and production work still required.
6. `docs/WALKTHROUGH.md`: route and process checklist.

## Authority and preservation

The latest accepted visual reference is this package's `reference/frontend.html`, not an earlier logo-only screen. Keep the softened blue Home header, Plus Jakarta Sans treatment, Outstanding and Received this month, original navigation and all sixteen templates. Technical correctness and offline requirements in the specification supersede old demo messages or shortcuts in the source.

Do not interpret preset logo symbols as fulfillment of the twenty-concept generative requirement. Do not interpret the sample connection toggle as sync. The desired production app must look like the reference while implementing the specified behaviour.

## Verification included with this export

The frontend source is preserved byte-for-byte. JavaScript syntax was checked. The archive includes a SHA-256 manifest and an index of static handlers/navigation targets. Dynamic onboarding and signed-out screens are created by script. Full browser/native interaction testing was not performed in this export environment; no bundled passing test report is implied.
