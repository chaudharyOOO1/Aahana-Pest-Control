# Accounts and billing work

## Owner's priorities

Build accounts and billing before recurring service scheduling. Support GST and non-GST invoices, and both contract/monthly and after-visit billing. Preserve original dates when importing historical data. Deployment remains deferred until the owner is ready.

## Workbook reference

`Aahana_Enterprises_Master_Billing_Workbook Current.xlsm` is for ideation only. No records have been imported or written to production. The owner will supply an updated workbook in the evening. The supplied file was inspected read-only; its VBA was not executed.

Observed structure:

- Settings: company identity, invoice details and other business settings.
- Client Master: one row per site, GSTIN/state, billing address, contact, monthly rate and email.
- Billing registers by financial year: site, invoice number, service month, taxable/gross amount, GST, invoice total, invoice date, payment status/date, cheque reference, GST submission status and remarks.
- Invoice Print: lookup of the selected billing row with company/client details.
- Dashboard: total invoiced, received and pending amounts.
- Helper/formula sheets: presentation and calculations rather than transaction sources.

## Implemented locally

- GST rate selection including 0%; amounts rounded to two decimal places.
- Invoice-number duplicate checks and next-number generation.
- Payment entry with original date, account and amount; overpayment is rejected.
- Receipts for individual payments, with print/save-as-PDF through the browser.
- Opening balances, capital and expense entry using explicit account choices.
- Account balances resolve the actual account records instead of assuming fixed IDs; opening balances are included in the cash summary.
- Account statements show dated movements and running balances.
- Invoice summaries are printable, but are not statutory tax invoices: company GST details, SAC and other required invoice fields still need configuration.
- Browser-side XLSX/XLSM/CSV import with header mapping, preview, duplicate skipping or explicitly chosen updates, preserved dates, and validation of projected receipt totals. VBA macros are never run. Uncached mapped formulas require Excel recalculation; unused formula/helper columns do not block the import.
- Supported import record types in this first stage: clients, invoices, receipts and expenses. Client GSTIN, company settings, monthly rates, service periods, GST filing status and cheque references are not imported into permanent fields yet.

## Next billing stage

Add persistent company/client tax settings, service month/period, invoice numbering by financial year, invoice detail lines and printable tax-invoice layouts. Then add advances and their allocation, cheque references, GST submission tracking and billing filters. These need a reviewed database migration; none is applied implicitly.

## Evening data-import rules

1. Inspect the updated workbook and map its real columns before applying data.
2. Import client/site masters before invoices; import confirmed collections separately as receipts.
3. Treat invoice total as the amount billed, not automatically as money received. Do not infer a receipt only from a total or a blank status.
4. Keep service month, invoice date and payment date separate. Missing or inconsistent dates require owner correction, not invented dates.
5. Keep original invoice references. Repeated references across sheets/years must be reviewed before updates.
6. Do not infer accounts from a cheque number alone. The owner must identify the bank/account and how advances should be allocated.
7. Preview adds, updates, duplicates and errors, then apply only after explicit confirmation. Never import this reference workbook as opening data.

## Validation

- `node tests/browser-regression.cjs`: authentication/session and autosave checks with a mocked backend.
- `node tests/bootstrap-regression.cjs`: eight bootstrap-handler checks with mocked database operations.
- `EXCELJS_FIXTURE=/path/to/TLS-verified-exceljs-4.4.0.min.js node tests/billing-regression.cjs`: billing/import browser checks including an actual XLSX workbook. Fetch the fixture from the pinned CDN URL in excel-import.js without disabling TLS or integrity verification. Test runs use synthetic records, not the supplied business workbook.

These checks do not prove live database round trips or actual printer output; those remain deployment acceptance checks.

Latest validation: 19 billing/import scenarios, 15 authentication/autosave scenarios and 8 bootstrap scenarios passed using simulated services and synthetic records. The date check includes the Asia/Kolkata timezone; Excel serial dates and native date cells preserve their original calendar dates. Actual reference-workbook data has not been imported.
