> Current decision: hosting is deferred. The owner chose to take the old public site offline and reported deleting its GoDaddy website records. The Netlify procedure below is historical and must not be followed without a new hosting decision. No DNS change was performed by this session.

# Separate owner login site

The owner requested that https://aahanapestcontrol.in remain active and that the operations app use https://login.aahanapestcontrol.in.

Read-only inspection of the public homepage returned HTTP 200 and Netlify response headers. It is a marketing site, distinct from this checkout's operations application. No hosting or DNS settings have been changed.

## Prepared deployment

An app-only archive is at `/workspace/deployment/aahana-login.zip`; its uncompressed folder is `/workspace/deployment/aahana-login`. It contains the current operations `index.html` and Netlify headers discouraging search indexing. No credentials or business records are included beyond the publishable Supabase key and existing sample records already in the application source. Noindex is not access control.

The archive reflects local fixes; it has not been deployed. Mocked browser regression checks passed, but live authentication, database policies and password recovery still need verification.

## Hosting and DNS

1. In the existing Netlify account, create a **separate site** for the operations app. Do not replace or redeploy the public marketing site's contents.
2. Use only a free plan whose current terms and quotas permit this business use. Do not enable billing or purchase add-ons. Confirm the account's current plan first.
3. Deploy the prepared folder/archive through Netlify's supported manual deployment flow, or connect this repository with no build command and the checkout root as the publish directory. Review the temporary site before assigning the custom domain.
4. Add `login.aahanapestcontrol.in` as the new site's custom domain. Follow the DNS target Netlify provides for that specific site; do not invent a target or point it to the marketing site's hostname.
5. If DNS is external, add only the requested `login` record (typically a CNAME to the new site's Netlify hostname), following Netlify's instructions. Preserve apex, `www`, email/MX and other records. If Netlify manages DNS, use its domain assignment flow and inspect the resulting record.
6. Verify HTTPS certificate provisioning, the login site's title/sign-in gate, and that the original public site still serves its marketing homepage.

## Supabase authentication

- Configure the operations site URL and an exact allowed password-reset redirect for `https://login.aahanapestcontrol.in/` in Supabase Authentication URL settings. Preserve any other redirect URLs still needed.
- Verify admin-only server enforcement in database policies and the workspace-bootstrap Edge Function. A fixed frontend email and removal of the signup button do not enforce server authorization.
- Confirm the existing admin user and email delivery, then test login, password reset, sign-out and session persistence without posting credentials in chat.
- Use an agreed test organization or controlled test records for client/visit/invoice/payment round trips; do not mix sample transactions into live accounts.

## Pending access

Netlify and DNS management tools are not connected to this session. The owner has been asked where DNS is managed and whether they can access Netlify. No external deployment, DNS change, subscription change or payment has occurred.
