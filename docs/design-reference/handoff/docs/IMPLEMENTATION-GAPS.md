# Prototype boundaries and production work

This frontend is a behavioural and visual reference, not a production app. Trace every handler rather than assuming its label proves a completed feature.

| Area | Reference behaviour / gap | Required build behaviour |
| --- | --- | --- |
| Persistence | In-memory sample arrays and transient state | Encrypted SQLite, account separation, durable drafts/assets and restart recovery |
| Home metrics | Seeded totals and local sample updates | Currency-aware calculations from effective payments and issued documents |
| Builder and design | Interactive steps and sixteen template previews | Typed validation, real repository commands, immutable issue snapshots and paginated PDFs |
| Sharing/export | Some actions only describe intended results | Real file generation and native handoff; never claim delivery from a toast |
| Payments/receipts | Sample payment interactions | Independent ledger, idempotent allocations, receipts without double counting, reversals |
| Auth/logout | Demo screens and external sign-in link | Supabase auth, native return URLs, remembered sessions, offline local access and safe logout |
| Sync | Connection toggle and sample conflict | Durable upload/pull, retry, reconciliation, real conflicts and stable issued numbers |
| Voice/scan | Sample transcript/photo workflow | whisper.cpp and Tesseract native adapters with local models/data; user review |
| Paste/extraction | Demo data/type flow | Local llama.cpp model, validated structured extraction and retained source text |
| Analytics questions | Canned sample calculation | Local constrained query planning, read-only SQLite execution and validated results |
| Logo creation | Keyword/template matching, limited arrangements | Separate on-device image model; twenty distinct relevant concepts, no recycled recolours |
| Staff/devices/support | Some explanatory sheets/toasts | Real permission enforcement, device revocation and configured support contacts |
| Language/accessibility | Some toggles indicate a choice only | Actual translation/RTL where in scope, text scaling, keyboard/screen-reader support |
| Assets | Remote font/icon dependencies in this export | Bundle the licensed production assets and all template fonts locally |
| Document corrections | Demo actions may only show intended flow | Immutable issued documents, credit/reissue semantics and audit history |

The screen catalogue must include routes created in scripts (`vOnboarding`, `vSignedOut`) and generated builder/modal contents, not just elements present at initial parse. Preserve all functionality already working locally, but replace unsafe DOM string interpolation with safe React rendering in the production implementation.

When backend credentials, native models or device capability are unavailable, keep implementation status explicit. Do not replace missing implementation with “Saved”, “Uploaded”, “Sent” or “Generated” messages.
