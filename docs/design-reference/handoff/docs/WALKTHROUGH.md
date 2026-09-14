# Page and process walkthrough

Use this as the minimum manual pass in addition to the complete specification. Verify all fields, back/close controls, confirmation sheets, error states and keyboard access inside each flow.

- Home: logo/profile link, greeting, two stats, global search and empty results, voice, scan, four document tiles, attention items, connection demo and logout.
- Main navigation: Home, Customers, Analytics and Settings; verify active state and return paths.
- Each document list: type-specific search, existing rows, New button and floating create button.
- Each document builder: Details/Deliver to → Items/Goods → Totals/Dispatch → Design → Review. Exercise Back/Next, close and unsaved state, dates, customer search/add, currency, payment-setup detour, signature capture/clear/save, item creation/removal and catalogue. Waybills must omit money.
- Design: all sixteen templates, colour, logo visibility, logo size and business-name style. Inspect long names and multiple line items.
- Saved documents: payments, part payments, receipt access, reminders, repeat, conversion, signature, share and correction actions available for that type. Validate resulting records in the production build.
- Customers: search/list, add contact, open contact, labels, notes, history, balances, statements, chat and call.
- Analytics: income/expenses/kept, expense entry, chart states, ageing, top items and business questions.
- Settings: company/logo, numbering, tax, payment methods and currency-specific account fields, saved items, default signature, account, password, language, appearance/text size, data/sync, admin and help.
- Logo wizard: edit name/description, submit validation, browse available template arrangements, select, apply and upload. This tests the current reference only; separately test the model-backed production requirement in specification §17.
- Data/admin: export, sync, conflict comparison/resolution, staff permissions/invitations and device revocation. Demonstration screens do not count as backend verification.
- Help: FAQ expand/collapse and Getting started. Getting started opens the complete onboarding flow.
- Onboarding: welcome, sample exploration, company/currency setup, first document choice, guidance, checklist, skip/back and completion. Reopen from Help.
- Logout: confirmation → signed-out view → Back to welcome → sample exploration or onboarding. Do not lose unsynced production work.

Production acceptance additionally requires airplane-mode restart/recovery, idempotent reconnect, cross-account isolation, two-device conflicts, real PDF export, permissions, offline model installation/inference and supported-device testing. See specification §21 and the expanded offline-AI gates.
