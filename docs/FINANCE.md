# Invoice, receipt, accounts and reports

This implementation follows the project handoff supplied in this conversation. Additional decisions from a separate Codex conversation have not been supplied and are not assumed.

## Invoice and receipt workflow

Create an invoice with a client, invoice number, date, taxable amount and GST rate. Amounts are calculated in integer paise, with GST rounded to the nearest paisa and added to taxable value. Duplicate invoice numbers are checked without regard to case. Automatically suggested INV and REC numbers continue after the highest existing numeric suffix, including gaps in historical records.

Record a payment through the payment form. Choose its actual receiving account, amount, date and unique receipt number. The form permits partial and full payments and rejects nonpositive amounts, more than two decimal places, duplicate receipt numbers and amounts greater than the currently loaded balance. A payment date must be on or after its invoice date and no later than today. Advance payments without an invoice are not modeled.

Each receipt-row button previews that specific receipt. The invoice-row receipt button previews the latest dated receipt for that invoice. Invoice and receipt previews can be printed or saved as PDF through the browser. The invoice preview is a management summary; business address, GSTIN, tax split, line-item details and the final statutory tax-invoice format must be supplied/configured before issuing tax invoices.

## Consistent totals

Billing, account balances, GST, P&L, balance-sheet and report totals share finance-core.js. Summation uses integer paise to avoid cumulative floating-point differences.

Revenue is taxable billing excluding GST. Collections are actual payments. Expenses and supplier bills contribute their amount excluding separately recorded GST. Receiving a payment changes cash and receivables, not revenue. Accounts start from opening balances and include subsequent capital, receipts, expenses and supplier payments.

The management balance-sheet model treats opening liquid funds as opening equity. Opening balances must represent the position before the transactions loaded into this dataset. They must not already include those same receipts or expenses. Historical imports will need a reviewed cutover date and treatment for any opening receivables, payables, GST and equity before data is posted. The current model does not replace a double-entry ledger.

Monthly performance filters billing, collections, expenses and GST by each transaction's date. Current cash and outstanding figures continue to show the current overall position. The client table shows invoices in the selected period and all receipts applied to those invoices, so payments in another month do not falsely increase the current amount outstanding.

## Before real data or deployment

Historical clients, invoices, receipts and expenses have not yet been imported. Prepare an import preview that validates identifiers, relationships, dates, duplicate numbers, GST and opening balances, and reconcile it against the supplied records before posting.

The connected production backend has not been modified. Frontend validation operates against loaded data. Before live use with simultaneous writers, enforce receipt-number uniqueness and payment limits transactionally on the server, and verify the real schema and RLS. Existing row compare-and-set sync does not serialize independent new receipt inserts against the same invoice.

Tests cover monetary rounding, partial and full collections, dated receipts, exact receipt selection, cancellation/invalid amounts, cross-month outstanding figures, and reconciliation of opening funds across all summaries.
