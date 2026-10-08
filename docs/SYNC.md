# Aahana sync

## Source and deployment

The code source is https://github.com/chaudharyOOO1/Aahana-Pest-Control, branch main. GitHub stores application code; it does not store customer or accounting records. The current app references the Aahana Supabase project in the handoff. Account selection, live configuration, Cloudflare and Vercel deployment are deferred until repository development is complete.

## Business records

The app loads all organization-scoped records in pages of 500. Client-generated UUIDs identify new cloud rows. Numeric IDs are used only inside the UI; relationship payloads use cloud UUIDs.

| Parent record | Related records |
| --- | --- |
| Client | Service plans, visits, jobs, invoices |
| Visit | Completion report |
| Invoice | Collections/payments |
| Vendor | Supplier bills and supplier payments |
| Account | Cash/bank/UPI/petty cash totals derived from payments, expenses, supplier payments and capital |

Completion updates the matching service plan, visit and report. Recording a payment recalculates receivables, collections and account balances. Expenses and supplier records update the relevant finance, GST and report views. Mutations rerender all related screens and schedule cloud sync.

## Saving and recovery

Only records whose payload differs from the last loaded/saved cloud version are written. Parents are saved before children so foreign keys remain valid. Existing rows use a conditional update matching their original business fields, so concurrent changes cause a conflict instead of an overwrite. New rows use an idempotent insert keyed by a client-generated UUID; a retry checks whether an earlier interrupted request already saved the same row.

Unsynced changes and their original cloud baselines are backed up under the authenticated user and organization. On login, pending changes are restored for review and retry. Once all writes finish, the backup is marked synchronized. Data from older prototype cache keys is not imported automatically.

Refresh pulls cloud data only when there are no pending changes and no open modal. It runs on focus, after reconnecting, every minute while the page is visible, or when Refresh is clicked. It updates all related screens without sending unchanged data back to the server.

If a conflict occurs, export a backup. Compare it with the cloud record, then use Reload cloud to discard local pending changes and load current cloud data. This reload asks for confirmation when unsynced changes exist. Reapply only the intended edits after reviewing the conflict.

## Limits to verify before deployment

Multi-table writes are ordered but are not a single database transaction. Partial successful writes are retained, and failed writes can be retried. For atomic financial posting, implement a trusted database transaction/RPC and formal ledger in a later accounting phase. Cloud changes are detected through refresh, not a configured Realtime publication. No production backend writes were used to validate this implementation; tests use a simulated API.
