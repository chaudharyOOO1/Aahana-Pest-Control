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
Open `index.html` in a browser, or deploy the repository as a static site on Vercel.

## Important security note
The browser uses only the Supabase publishable key. Never add a Supabase service-role/secret key or the admin password to this repository.

## Backend
Supabase project is already configured in the application. The database schema, RLS/security setup, authentication notes, and deployment notes are documented in `PROJECT-WORK.md`.
