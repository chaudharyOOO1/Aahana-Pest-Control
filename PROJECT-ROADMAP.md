# Aahana project objectives and delivery roadmap

Owner-selected scope: all objectives 1–8, delivered in phases. Only the owner/admin will log in. No paid services, subscriptions, paid APIs or paid upgrades are authorized. These requirements supersede conflicting proposals in the original handoff. No existing external subscriptions have been changed or cancelled.

## Selected business objectives

| ID | Objective | What completion means |
| --- | --- | --- |
| 1 | Client and contract management | Clients, multiple sites, contacts, service contracts, history and documents can be managed together. |
| 2 | Service operations | Rules generate recurring visits; the owner assigns technicians, track overdue work and record completion and follow-ups. |
| 3 | Billing and collections | Invoices, payments, receipts, expenses and supplier dues reconcile to their underlying records. |
| 4 | Formal accounting | A reviewed chart of accounts, journal entries, ledgers, trial balance, GST and financial statements support the accountant's workflow. |
| 5 | WhatsApp communication | The app prepares reminders and daily summaries to copy or open in normal WhatsApp. The owner sends messages and manually records replies and follow-ups. No paid API, automatic sending or incoming webhook is included. |
| 6 | Technician mobile workflow | The owner uses a mobile-friendly screen to manage technician assignments, work/materials/photos and client acknowledgement. Technicians have no separate login in this version. |
| 7 | Owner reporting | Service performance, outstanding collections and financial summaries can be filtered and exported. |
| 8 | Production reliability | Owner-only access is enforced on the server; audit history, manual export/restore, deployment and error handling are verified. Staff-role support is deferred unless the owner changes the user model. |

## Delivery sequence

1. Establish a trusted foundation: confirm the correct source and production URL; verify admin authentication, server authorization and organization-scoped cloud persistence.
2. Build client/site/contract management and recurring visits, assignments, completion reports and follow-ups end to end.
3. Validate invoices, payments, expenses and vendor dues, then implement formal accounting and GST with rules reviewed by the owner/accountant.
4. Add manual WhatsApp preparation and the owner-operated mobile visit workflow. Do not add staff logins or paid messaging integrations.
5. Complete reporting/exports, audit history, manual backup/recovery and free hosting deployment acceptance checks.

Deliver a usable release at each phase. Formal accounting and WhatsApp require their own acceptance criteria; neither is complete because an interface exists.

## Cost and platform constraints

- Use free service plans only, within their current quotas and terms. Do not enable billing or automatic paid upgrades.
- Supabase is already used by the source. Its actual plan, storage limits, authentication/email quotas and project status still need checking; source code cannot establish whether the existing account is billed.
- The handoff mentions Vercel, but free-plan eligibility for this commercial business has not been verified. Select free hosting whose current terms permit the intended use before deployment.
- Prefer browser-side recurrence generation when the owner opens the app. An always-on scheduler is not assumed.
- Use manual backup/export and a tested restore workflow; do not promise paid managed backup capabilities.
- Photos/documents depend on verified free storage quotas; provide export/retention controls rather than requiring an upgrade.
- No WhatsApp API is included. Automatic outbound messages, incoming replies and background reminders are replaced by owner-driven workflows.

## Remaining information for phase 1

- Owner confirms the live URL is https://aahanapestcontrol.in/ (also referred to as www.aahanapestcontrol.in). After the owner published the network update, the URL returned HTTP 200. Response headers identify Netlify hosting, and the page is a public marketing site, distinct from this operations app. Keep the public site active and deploy the operations app separately at login.aahanapestcontrol.in, as requested by the owner.
- Owner confirms Supabase settings access. Server policies, bootstrap function, reset redirects and the existing plan still need checking. Never share passwords or secret keys in chat.
- Later phases will need contract frequencies, invoice/GST rules, opening balances and representative workflows; collect these when they affect implementation.

## Foundation work in this checkout

- Single-admin frontend access matches the owner-selected user model. Broader roles are deferred.
- Public signup removed from the interface; password reset/recovery and sign-out added.
- Cloud rows retain numeric UI IDs alongside Supabase UUIDs, preserving relationships and existing action handlers.
- Cloud loading failures keep the sign-in gate closed; an empty database no longer causes automatic sample-data uploads.
- Completed synchronization does not schedule another synchronization unless new work is queued; sync status is visible in the header.
- Browser regression command: `node tests/browser-regression.cjs`, with the static server running on port 8000. Requires Playwright and Chromium available in this cloud environment. `APP_URL` and `CHROMIUM_PATH` can override defaults.
- Fifteen regression scenarios passed with a mocked Supabase SDK, including autosave, rejected credentials, repeated sign-in events, interrupted hydration and SDK unavailability. Live auth-settings connectivity returned HTTP 200, but actual login, password-email delivery, redirect configuration, server policies and production persistence remain unverified.

Frontend restrictions do not enforce backend authorization. Supabase policy and Edge Function source are not included in this checkout, so their documented protections still need independent verification.

## Current Phase 1 status

- Actual edits now schedule autosave; completed saves stop without looping. Repeated sign-in events preserve the loaded workspace, and session changes cancel stale load/save results.
- Local regression tests pass; no production business records were written.
- The owner reports disabling signup, but the following read-only auth-settings check still returned `disable_signup: false`. Confirmation of that server setting remains pending for project `luowrypiqkaynzzvepey`.
- A read-only schema/RLS/admin-status audit is available in `supabase/readiness-audit.sql`; it has not been executed against the live database.
- Local static-server instructions and backend verification steps are in README.md and supabase/VERIFY.md.
- The prepared deployment archive has been refreshed but not deployed. The owner disconnected the former public site through GoDaddy and deferred hosting selection; earlier instructions to preserve the public site are superseded.

## Billing-first scope update

The owner prioritized accounts and billing over scheduling. Both GST/non-GST and contract/visit-based billing are required. The shared XLSM workbook is for ideation only; the updated workbook is expected in the evening and no reference records have been imported. Current local changes are documented in BILLING-WORKFLOW.md. The application bundle includes excel-import.js; deploying index.html alone is no longer sufficient. Hosting remains deferred.

## Company P&L and bank statements

Owner selected invoice-based P&L plus cash flow, shared expense allocations across clients, and Excel/CSV or PDF statement exports. Current implementation and deployment prerequisites are in FINANCE-REVIEW.md. Shared expense metadata and bank transactions require the prepared SQL migration before deployment. Excel/CSV bank review is implemented locally; PDF extraction needs a sample layout and is not implemented. No actual reference records, bank statements or migration have been applied to the live database.
