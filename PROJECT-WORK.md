> Active backend configuration: `https://gvevmnzibhuqnpdfvidl.supabase.co`, supplied by the owner on 9 October 2026. Any earlier project identifiers below describe the original handoff, not the active target. Database initialization and the as-supplied workbook import completed with explicit owner approval on 9 October 2026. Verified 185 unchanged historical rows, 33 linked client/site records, and annual sequence floors 17/81/87. Administrator Authentication account setup and website deployment remain pending.

# Aahana Pest Control --- Complete Project Work

**Updated:** 2026-10-03\
**Purpose:** Full project handoff, architecture, implementation record,
security notes, and next steps.

> **Security:** The business-admin password is intentionally NOT
> included in this document.

## 1. Business Goal

Build one operating system for Aahana Pest Control covering:

**Client → Service Plan → Visit → Service Report → Invoice → Collection
→ Expense → Vendor → GST → Profit → Reports → WhatsApp**

The system must support different service frequencies, including: -
Daily hotel service - 4 visits/month - 6 total visits - 1 visit every 3
months

## 2. Current Technology

-   Frontend: static HTML + CSS + JavaScript
-   Backend/database: Supabase PostgreSQL
-   Authentication: Supabase Auth
-   Local persistence: browser LocalStorage
-   Cloud persistence: Supabase
-   Deployment target: Vercel
-   Future messaging: WhatsApp Business / Meta Cloud API

Supabase project: - Name: `Aahana Pest Control` - Project ref:
`luowrypiqkaynzzvepey` - Region: `ap-south-1` - URL:
`https://luowrypiqkaynzzvepey.supabase.co`

## 3. Authentication

Fixed business-admin account:

`admin@aahanapestcontrol.com`

Implemented: - Fixed admin email - Removed public Create Account flow -
Sign-in - Password reset - Frontend email restriction - Server-side
admin-email validation in workspace bootstrap - Organization membership
validation

The password is deliberately omitted from this file.

Supabase's current documentation says Auth Admin user creation must be
performed on a trusted server and privileged keys must never be exposed
in browser code.

## 4. Supabase Database

15 main business tables:

1.  `organizations`
2.  `organization_members`
3.  `clients`
4.  `service_plans`
5.  `visits`
6.  `visit_reports`
7.  `jobs`
8.  `invoices`
9.  `payments`
10. `expenses`
11. `accounts`
12. `owner_capital`
13. `vendors`
14. `vendor_bills`
15. `vendor_payments`

Business records are scoped by `organization_id`.

Unique constraints include: - invoices:
`(organization_id, invoice_no)` - accounts: `(organization_id, name)` -
vendor bills: `(organization_id, bill_no)`

## 5. Database Security

RLS is enabled on all 15 public business tables.

Membership helper:

``` sql
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
  );
$$;
```

Business tables allow access only when the authenticated user is a
member of the relevant organization.

Security review previously showed no outstanding security warnings.

Rules: - Publishable key may be used in browser. - Secret/service-role
credentials must remain server-side. - Do not rely on frontend-only
authorization. - Keep RLS enabled.

## 6. Workspace Bootstrap

Edge Function:

`bootstrap-aahana-workspace`

Responsibilities: 1. Validate bearer token. 2. Validate authenticated
user. 3. Confirm fixed admin email. 4. Return existing organization if
membership exists. 5. Otherwise create organization. 6. Create owner
membership. 7. Create default accounts.

Default accounts: - Cash - Bank - UPI / Wallet - Petty Cash

## 7. Client Management

Initial demonstration clients:

### Hotel Sunrise

-   Main Hotel • Agra
-   Daily Pest Control
-   Daily service
-   30 visits/month

### Royal Residency

-   Residence • Firozabad
-   Monthly Protection
-   4 visits/month

### ABC Foods Pvt Ltd

-   Factory • Agra
-   Termite & General
-   6 total visits

### Green Valley School

-   Campus • Agra
-   Quarterly Service
-   1 visit / 3 months

These are sample records and should be replaced/edited with real data.

## 8. Service Plans

Plans track: - Client - Plan name - Frequency/rule - Completed visits -
Total visits - Next visit

Examples: - Every day - 4 visits/month - 6 total visits - 1 visit/3
months

Future enhancement: automatically generate recurring visits from the
service rule.

## 9. Visit Tracker

Visit fields include: - Client - Date - Time - Service plan -
Technician - Status

Statuses: - Due - Done - Overdue

Visit completion records: - Work performed - Materials used - Client
status/feedback - Follow-up

Completing a visit updates the visit report and service-plan progress.

## 10. Jobs

Jobs support: - Title - Client - Due date - Assignee - Priority -
Status - Notes

Example jobs: - Inspect hotel service area - Prepare monthly service
report - Follow up quotation

## 11. Billing

Invoices support: - Invoice number - Client - Date - Taxable amount -
GST - Total - Paid - Outstanding

## 12. Collections

Payments support: - Invoice - Receipt number - Date - Amount - Mode

Modes include: - Bank - UPI - Cash

Outstanding is calculated from invoice totals and payments.

## 13. Expenses

Expense records support: - Date - Category - Vendor/payee -
Description - Account - Amount - GST - Receipt/reference

Example categories: - Chemicals - Travel - Petty cash - Office expenses

## 14. Accounts / Cash / Bank / UPI / Petty Cash

Default accounts: - Cash - Bank - UPI / Wallet - Petty Cash

The application calculates account balances and provides an account
register.

For a stronger accounting implementation, all financial activity should
eventually post through formal journal entries.

## 15. Vendors

Vendor module supports: - Vendor master - Contact - GSTIN - Vendor
bills - Vendor payments - Outstanding payable

Sample vendors: - Agra Chemical Suppliers - Raj Equipment Store

## 16. GST

Tracks: - Output GST on customer invoices - Input GST on expenses/vendor
bills - Net GST payable

Conceptually:

`Output GST - Input GST = Net GST payable`

Final GST filing/tax treatment should be reviewed by the company's
CA/accountant.

## 17. Profit & Loss

Current management calculation:

`Revenue - Operating Expenses = Net Profit`

Revenue is based on taxable invoice amounts excluding GST.

Operating expenses include business expenses and supplier bills,
excluding the GST component where modeled separately.

## 18. Balance Sheet Snapshot

Assets: - Cash - Bank - UPI - Petty cash - Client receivables - Input
GST

Liabilities: - Supplier payables - Output GST payable

Equity: - Owner capital - Modeled business result

A balance check is included.

For statutory accounting, upgrade to a formal double-entry ledger and
have the accounting design reviewed by the CA.

## 19. Reports

Current reporting includes: - Revenue - Collections - Net profit -
Outstanding - Financial summary - Cash and dues - Client
billing/collections - Service performance - Account balances

## 20. Local Storage

LocalStorage key:

`ashna_pest_control_data_v1`

Stored state includes: - clients - visits - visitReports - plans -
jobs - invoices - payments - expenses - ownerCapital - accounts -
vendors - vendorBills - vendorPayments

## 21. Cloud Sync

Cloud synchronization provides: - Organization-scoped data - Debounced
sync - Cloud IDs - Local/cloud ID mapping - Cloud hydration on startup -
Local fallback

The cloud data model is backed by Supabase PostgreSQL.

## 22. WhatsApp Requirement

Business requirement:

-   Push visit reminders to WhatsApp.
-   Receive updates through WhatsApp.
-   Track completion and follow-up status.

Target workflow:

``` text
Supabase
  ↓
Scheduled reminder
  ↓
WhatsApp Business / Meta API
  ↓
Technician or owner
  ↓
DONE / RESCHEDULE / FOLLOW-UP
  ↓
Webhook
  ↓
Supabase
  ↓
Visit status update
```

Current status: **WhatsApp live sending/receiving is not yet
implemented.**

Production implementation will require: - WhatsApp Business/Meta setup -
Business phone number - API credentials - Webhook - Message templates
where required - Scheduled reminder function - Incoming message
processing - Message audit log

Suggested future tables: - `whatsapp_contacts` - `whatsapp_messages` -
`whatsapp_message_templates` - `whatsapp_webhook_events` -
`notification_rules`

## 23. Recommended Accounting Upgrade

Current finance is an operational accounting layer.

For production-grade bookkeeping, add:

-   `chart_of_accounts`
-   `journal_entries`
-   `journal_lines`
-   `tax_rates`

Accounting flow:

``` text
Transaction
  ↓
Journal Entry
  ↓
Journal Lines
  ↓
Ledger
  ↓
Trial Balance
  ↓
P&L
  ↓
Balance Sheet
  ↓
GST reports
```

Example customer invoice:

``` text
Dr Accounts Receivable
    Cr Sales Revenue
    Cr Output GST
```

Customer payment:

``` text
Dr Bank / Cash / UPI
    Cr Accounts Receivable
```

Expense:

``` text
Dr Expense
Dr Input GST
    Cr Cash / Bank / Payable
```

Vendor bill:

``` text
Dr Expense / Inventory
Dr Input GST
    Cr Accounts Payable
```

Vendor payment:

``` text
Dr Accounts Payable
    Cr Bank / Cash
```

Owner capital:

``` text
Dr Bank / Cash
    Cr Owner Capital
```

## 24. Future Technician App

Recommended flow:

``` text
Login
 ↓
My Visits
 ↓
Today's Visit
 ↓
Client/site details
 ↓
Start Visit
 ↓
Materials / chemicals
 ↓
Observations
 ↓
Photos
 ↓
Client acknowledgement
 ↓
Complete Visit
```

Completion should update: - Visit - Service plan - Service report -
Client history - Dashboard

## 25. Future Client Profile

Each client should eventually contain:

``` text
Client
├── Basic information
├── Sites
├── Contacts
├── GST details
├── Service plans
├── Visit history
├── Service reports
├── Invoices
├── Payments
├── Outstanding
├── Follow-ups
└── Documents
```

## 26. Future Roles

Potential roles: - Owner / Admin - Operations Manager - Accountant -
Supervisor - Technician - Viewer

Authorization should be enforced in database/server logic, not only by
hiding buttons.

## 27. Deployment

The app was prepared for Vercel static deployment.

Vercel team information available during development: - Team: `Ashna` -
Slug: `ashna6`

Final production URL still needs to be recorded and verified:

`[ADD VERIFIED VERCEL URL]`

GitHub repository:

`https://github.com/chaudharyOOO1/Aahana-Pest-Control`

Repository source-of-truth status was not yet confirmed as containing
the complete production app.

## 28. Final Verification Checklist

### Authentication

-   [ ] Admin Auth user exists
-   [ ] Email confirmed
-   [ ] Login works
-   [ ] Wrong password rejected
-   [ ] Other emails rejected
-   [ ] Password reset works
-   [ ] Sign-out works
-   [ ] Session persistence works

### Database

-   [x] 15 main tables
-   [x] Organization model
-   [x] RLS
-   [x] Membership policies
-   [x] Security review
-   [ ] Production backup/recovery confirmed

### Operations

-   [x] Clients
-   [x] Service plans
-   [x] Visits
-   [x] Visit reports
-   [x] Jobs
-   [ ] Automatic recurring visit generation
-   [ ] WhatsApp reminders

### Finance

-   [x] Invoices
-   [x] Payments
-   [x] Expenses
-   [x] Accounts
-   [x] Vendors
-   [x] Vendor bills
-   [x] Vendor payments
-   [x] GST
-   [x] P&L snapshot
-   [x] Balance Sheet snapshot
-   [ ] Formal double-entry ledger
-   [ ] Trial balance
-   [ ] CA/accountant validation

### WhatsApp

-   [ ] Meta Business setup
-   [ ] WhatsApp Business number
-   [ ] API credentials
-   [ ] Templates
-   [ ] Webhook
-   [ ] Reminder scheduler
-   [ ] Incoming message parser
-   [ ] Message audit log

### Deployment

-   [ ] Final Vercel URL verified
-   [ ] Production login tested
-   [ ] Cloud sync tested
-   [ ] Visit flow tested
-   [ ] Invoice flow tested
-   [ ] Payment flow tested
-   [ ] Expense flow tested
-   [ ] Vendor flow tested
-   [ ] Reports tested

## 29. Recommended Build Order

### Phase 1 --- Authentication

1.  Create/confirm admin Auth user.
2.  Test login.
3.  Test password reset.
4.  Verify production URL.

### Phase 2 --- Operations

1.  Automatic recurring visits.
2.  Overdue detection.
3.  Technician assignment.
4.  Visit reminders.
5.  Follow-up reminders.

### Phase 3 --- WhatsApp

1.  Meta Business setup.
2.  WhatsApp API.
3.  Outbound reminders.
4.  Incoming webhook.
5.  DONE/RESCHEDULE/FOLLOW-UP commands.
6.  Daily owner summary.

### Phase 4 --- Accounting

1.  Chart of accounts.
2.  Journal entries.
3.  Journal lines.
4.  Trial balance.
5.  Formal P&L.
6.  Formal balance sheet.
7.  GST ledger.

### Phase 5 --- Production Hardening

1.  Audit log.
2.  Backup/recovery.
3.  Role permissions.
4.  Document storage.
5.  Error logging.
6.  Data export.
7.  Excel/CSV reports.
8.  Accountant review.

## 30. Project Vision

The final system should operate as:

``` text
                 AAHANA PEST CONTROL
                         |
          +--------------+--------------+
          |              |              |
      OPERATIONS       FINANCE       COMMUNICATION
          |              |              |
       Clients        Invoices       WhatsApp
       Contracts      Payments       Reminders
       Visits         Expenses       Replies
       Technicians    Vendors        Alerts
       Reports        GST            Daily Summary
          |              |              |
          +--------------+--------------+
                         |
                   SUPABASE CLOUD
                         |
                  Secure Auth + RLS
                         |
                    ADMIN DASHBOARD
```

The long-term objective is a single business operating system covering:

**Client → Contract → Visit → Service Report → Invoice → Collection →
Expense → Vendor → GST → Profit → Management Reporting → WhatsApp
Automation.**

## 31. Official Supabase References

-   https://supabase.com/docs/guides/auth
-   https://supabase.com/docs/guides/auth/passwords
-   https://supabase.com/docs/reference/javascript/auth-admin-createuser

Supabase documents email/password authentication, password reset, and
server-side Auth Admin user creation.
