# Aahana Pest Control — Operations System

Aahana Pest Control business operations tracker and bookkeeping prototype.

## Included
- Admin sign-in flow via Supabase Auth
- Client management
- Service plans and visit scheduling
- Visit completion reports
- Job list / daily tasks
- Client billing and collections
- Expenses and petty cash
- Supplier/vendor accounts
- GST tracking
- P&L and balance-sheet view
- Reports dashboard
- WhatsApp message preparation (manual sending in the current free workflow)
- Supabase cloud persistence

## Run
Serve this directory locally (Python 3 required):

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

The browser frontend uses the existing Supabase backend. No Node build step or local database is required. Use a server rather than opening the HTML file directly so password-reset redirects have a valid origin.

Owner-selected scope is recorded in [PROJECT-ROADMAP.md](PROJECT-ROADMAP.md): owner-only access, all modules delivered in phases, and no paid services. Deployment is deferred; legacy Netlify instructions in the original handoff are historical.

## Validation

With the static server running and Playwright/Chromium installed:

```sh
node tests/browser-regression.cjs
```

These checks use a simulated backend and do not write production records. See [supabase/VERIFY.md](supabase/VERIFY.md) for the read-only backend audit and outstanding live checks.

## Important security note
The browser uses only the Supabase publishable key. Never add a Supabase service-role/secret key or the admin password to this repository.

## Backend
Supabase project is already configured in the application. The database schema, RLS/security setup, authentication notes, and deployment notes are documented in `PROJECT-WORK.md`.

## Billing and historical data

See [BILLING-WORKFLOW.md](BILLING-WORKFLOW.md) for billing features, workbook observations and remaining fields. Deploy the whole application folder, including `excel-import.js`. Excel reading uses a pinned, integrity-checked ExcelJS browser bundle loaded on demand; CSV reading does not need that library. No spreadsheet macros are executed.

## Finance review deployment prerequisite

See [FINANCE-REVIEW.md](FINANCE-REVIEW.md). Apply the prepared finance-review database migration before deploying this version; it adds expense allocation fields and bank-review storage. Deploy `index.html`, `excel-import.js`, `finance-ledger.js` and `finance-review.js` together. Bank-statement import supports Excel/CSV; PDF extraction remains pending a bank-specific sample.
