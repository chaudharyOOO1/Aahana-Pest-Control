# Verify the existing backend

No migration is applied by these instructions. This checkout contains the frontend, not the deployed schema or bootstrap Edge Function source.

## Owner-only authentication

1. In Supabase Authentication settings, disable new-user signup while keeping email/password sign-in enabled. A read-only request to `/auth/v1/settings` currently reports `disable_signup: false`; removing the signup button does not change that server setting.
2. Confirm the admin user exists and its email is confirmed. Do not recreate or reset it unless needed.
3. For local testing, configure the exact password-recovery redirect `http://127.0.0.1:8000/`. Only add the future production URL when its deployment is chosen. Preserve other redirects still required. Use an HTTPS origin in production.
4. Check email delivery restrictions on the current free plan. Do not assume arbitrary recipients or paid SMTP are available.
5. Run `readiness-audit.sql` in the SQL editor and inspect the JSON result. It uses a read-only transaction and returns schema/policy metadata plus admin existence/confirmation counts; it does not return tokens, passwords or business records.
6. Verify all 15 expected tables exist, have RLS enabled and suitable organization-membership policies. Policy presence alone does not prove authorization: review SELECT and write policies, including WITH CHECK, and test forbidden access in an agreed test environment.
7. Inspect the deployed `bootstrap-aahana-workspace` Edge Function. It must validate the authenticated admin on the server, use idempotent membership/organization creation and reject other users. Frontend email restrictions are not a substitute.

## Functional checks with the owner

- Start `python3 -m http.server 8000 --bind 127.0.0.1` in the checkout.
- Sign in using the existing admin account. Never send credentials in chat.
- Confirm a wrong password is rejected and refresh preserves the authenticated session.
- Confirm password-reset email delivery and that its link opens the new-password form. Test once deliberately; avoid repeated email requests.
- Agree on disposable test records before testing business writes. Create a client, schedule/complete a visit, create an invoice and record payment; wait for the saved status, then reload and verify relationships and balances.
- Check visible save errors and retry behavior with a simulated backend first. No production outage is required.
- Sign out and confirm the gate returns and local cached business data is cleared.

## Verified locally

`node tests/browser-regression.cjs` uses Playwright with a mocked SDK and no production writes. It covers frontend behavior, autosave, ID mapping, failures and session transitions. It does not prove live password email delivery, RLS, actual data persistence or bootstrap authorization.

The static app still uses Supabase for authentication and persistence. Hosting it on a local server does not replace that backend. A future backend migration requires exported schema/data, a compatible authentication design and restore tests; no paid migration or hosting is authorized.

## Bootstrap source review

The owner supplied the deployed function. It validates tokens but lacks an admin-email check and CORS/preflight support, and ignores membership lookup errors. A local replacement is in `functions/bootstrap-aahana-workspace/index.ts`; eight mocked handler scenarios pass via `node tests/bootstrap-regression.cjs` (Node 24 used here).

The replacement checks the confirmed admin, rejects ambiguous/non-owner membership, handles browser preflight, and repairs missing default accounts without overwriting existing ones. Its account upsert relies on the documented UNIQUE (organization_id, name) constraint; confirm that index exists before deployment. It has not been deployed or tested against the actual Edge Function runtime.

Workspace creation still consists of separate database statements; it is not transactional or guaranteed safe under concurrent creation requests. A failed membership insert can leave an orphan organization. Inspect logs after failures rather than repeatedly retrying. A future atomic database function requires the actual schema and constraints before a migration can be prepared safely.

The owner reports deploying the replacement. Live read-only checks returned OPTIONS 204 with CORS headers and unauthenticated POST 401 with the expected Authentication required response. Authenticated workspace creation and database persistence are still unverified. Signup continues to report enabled in the public auth settings.
