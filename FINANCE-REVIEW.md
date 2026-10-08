# Company P&L, client costs and bank review

## Selected behavior

The owner selected invoice-based profit and loss with a separate cash-flow view; direct client costs, company overheads and shared client allocations; monthly bank statements available as Excel/CSV or PDF.

Invoice revenue excludes GST. P&L recognizes invoices and expenses on their record dates. Collections and supplier payments affect cash when paid; owner capital, loans and internal transfers are not sales revenue. The existing operational balance-sheet model is not a complete loan/tax/double-entry ledger.

## Implemented locally

- Month-filtered company P&L, cash-flow summary, per-client revenue and allocated costs, and an expense list.
- Expense scope: company, one client, or shared across clients. Shared percentages must total 100%. Allocation rounds in paise without losing a penny.
- Excel/XLSM/CSV bank upload by account and month, with column mapping and preview.
- Duplicate statement rows are skipped using an account-scoped fingerprint. Rows outside the selected month or with invalid dates/amounts block the batch.
- Importing a statement does not itself create income/expenses. Each row needs a purpose note and explicit treatment.
- Match existing receipts, expenses, capital, supplier payments or a transfer counterpart without counting it twice. Exact-date/amount/account matches are suggestions, not automatic approval.
- Create a new customer receipt, business expense (including client/shared scope), supplier payment or owner capital after review.
- Non-operating categories cover owner withdrawals, loans and GST/tax movements; direction is validated. They affect cash, not operational P&L.
- Transfers between company accounts record both sides once. The second statement row matches the existing transfer rather than posting it again.
- Purpose notes remain editable without reposting. Financial treatment of reviewed rows is locked in the UI to prevent accidental repeated posting. Correcting an approved classification needs a controlled reversal workflow, which is not implemented yet.

## Database prerequisite before deployment

Run `supabase/migrations/20261008_finance_review.sql` in the existing project's SQL editor before deploying this app version. It adds expense client/allocation metadata and an organization-scoped `bank_transactions` table with RLS, authenticated-role grants and an admin-owner membership policy. It does not import/reclassify existing records. The migration has been prepared, not applied or verified against the live schema by this session.

The current app startup reads this table and synchronizes the new expense fields. Without the migration, startup/save operations cannot pass live validation. Live database policy and cross-organization tests remain required.

Bank postings use separate existing table operations and statement-review writes; this is not an atomic database transaction. If a parent financial posting succeeds and the bank-review save fails, stay on the page and retry to preserve assigned IDs. Do not repeat posting from another tab or reload without checking records first. A future transactional reconciliation function must be designed against the actual schema.

## PDF support

PDF file recognition is present, but PDF transaction extraction is not implemented. The current UI clearly requests an Excel/CSV export. A redacted sample of the actual bank PDF layout is needed to build and validate its extraction mapping; scanned PDFs also need OCR. No records are inferred from unreadable PDF text, and no paid OCR service is used.

## Outstanding correctness work

- Actual bank PDFs and statement samples, including balance rows, reversals and ambiguous references.
- Controlled undo/reclassification and multi-tab concurrency.
- Allocation of advances, TDS/withholding, loans and refunds within a formal ledger.
- Supplier bill allocation: current supplier costs are shown as unallocated and are not falsely attributed to individual clients.
- Company/GST statutory invoice settings, service periods and GST filing status from the reference-workbook design.
- End-to-end live round trips after the migration, with agreed disposable test records.

No uploaded reference-workbook records were imported. All regression records are synthetic.

Local validation: 13 bank-review/shared-cost browser scenarios, 19 billing/import scenarios, 15 auth/autosave scenarios, plus pure P&L/cash-flow/allocation checks passed. Synthetic data and mocked services were used; the migration and actual database RLS have not been executed or tested here.

Migration correction: the live database reported clients.id as bigint. The revised migration reads both clients.id and organizations.id types from PostgreSQL metadata before creating foreign-key columns, and stops rather than rewriting incompatible existing columns. JavaScript mappings accept both numeric and UUID identifiers; no source reset or record deletion is needed.
