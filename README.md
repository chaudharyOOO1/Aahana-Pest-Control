# Aahana Pest Control

Operations and management accounting app with a static frontend and authenticated invoice-email endpoint, recovered from the existing workspace source and repaired for the Supabase project documented in PROJECT-WORK.md.

## Included

- Fixed admin sign-in, password recovery, sign-out and organization membership lookup.
- Clients, service plans, scheduled visits, completion reports and jobs.
- Invoices, dated partial/full collections, exact receipt previews, expenses, accounts, owner capital, vendors, supplier bills and payments.
- Saved company/client billing profiles and monthly rates, financial-year numbering, service-month invoices and GST splits.
- Completed-work invoice drafting, individual/bulk personalized email controls and PDF attachments.
- Monthly P&L, cash flow, funds by account, balance-sheet reports, separate GST filings/payments and reviewed bank CSV imports.
- Printable invoice/receipt summaries and shared calculations in integer paise.
- GST, P&L and balance-sheet management summaries.
- Organization-scoped cloud persistence, visible sync status, retry and recovery of unsynced browser changes.
- Manual WhatsApp message preparation. Automated sending and incoming webhooks remain future work.

## Run

Serve this directory with `python -m http.server 8080` and open http://localhost:8080. No build step is required. The Supabase JavaScript SDK is pinned in index.html and loads from jsDelivr. Sign-in requires internet access.

## Backend

app.js now targets the owner-supplied Aahana project `gvevmnzibhuqnpdfvidl` using its browser-safe publishable key. This is a configuration change; the new project schema, authentication and import still need setup through the correct connected Supabase account. Never include passwords, service-role keys or secret keys. Supabase RLS and the existing bootstrap Edge Function must enforce authorization; browser email restrictions are only a UI constraint.

Apply the versioned billing ERP migration before deploying this frontend; setup and limits are in [docs/FINANCE.md](docs/FINANCE.md). The database must contain the 15 tables and membership policies described in PROJECT-WORK.md and the bootstrap-aahana-workspace Edge Function. Configure the deployed URL in Supabase Auth's allowed redirect URLs for password recovery. Create/confirm the fixed business-admin account through a trusted admin workflow. Public signup is disabled in this app.

Empty workspaces remain empty; demo records are not inserted automatically. Old ashna_pest_control_data_v1 caches are not imported automatically. Unsynced changes use a new user/organization-scoped cache and can be recovered at login with Retry sync. Only changed records are written. Compare-and-set checks preserve newer cloud edits; conflicts retain local changes for export and review. Refresh pulls cloud data when there are no pending local changes. Linked records sync in parent-first order, and client-generated UUIDs make interrupted inserts safe to retry.

## Tests

```sh
node --check app.js
node tests/finance_test.cjs
node tests/erp_test.cjs
node tests/email_test.cjs
python -m pip install -r tests/requirements.txt
python tests/browser_test.py
python tests/migration_test.py # requires Docker; uses isolated Postgres
```

Tests use local fixtures and a simulated Supabase adapter without production writes. They cover UUID hydration, action buttons, completion, sync termination, empty-workspace creation, invoices/payments, account mapping, text escaping, failed-sync recovery, reset requests, sign-out and mobile SDK-load errors. Install a system Chromium or run `python -m playwright install chromium`. Set CHROMIUM_PATH to use a particular system binary. A GitHub Actions workflow runs these checks on pushes and pull requests.

## Deployment and limits

Serve the frontend scripts and styles together. Invoice sending needs the Node endpoint under api/ and the server configuration in .env.example. A Vercel configuration is included; no deployment was created in this session.

Live service connections and deployment are deferred until the GitHub app is ready. Production login, RLS, bootstrap, password-email delivery and real cloud writes remain unverified. No production business records were changed during development or testing.

The financial screens are management summaries, not formal double-entry bookkeeping. Automatic recurring visit generation, automated WhatsApp, technician roles and a formal ledger remain future work.

## Source

Recovered source: chaudharyOOO1/Aahana-Pest-Control, workspace commit 59758ce.
Repository: https://github.com/chaudharyOOO1/Aahana-Pest-Control.

## Sync behavior

See docs/SYNC.md for record relationships, conflict recovery, and the distinction between source-code updates and business-data sync. Cloudflare and Vercel configuration will be addressed afterward; this repository workflow runs tests and does not deploy.

## Finance workflow

See docs/FINANCE.md for invoice and receipt validation, monthly/current report definitions, opening balance treatment, historical import preparation and the server checks required before deployment. Additional settings from a separate Codex chat must be provided before they can be replicated.
