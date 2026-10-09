const { createHash } = require("node:crypto");
const { invoicePDF, message } = require("../server/invoice-pdf.cjs");
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST")
    return res.status(405).json({ error: "Use POST." });
  const env = process.env;
  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_PUBLISHABLE_KEY ||
    !env.RESEND_API_KEY ||
    !env.INVOICE_FROM_EMAIL
  )
    return res
      .status(503)
      .json({ error: "Invoice email delivery is not configured." });
  if (!/^Bearer [^\s]+$/.test(req.headers.authorization || ""))
    return res.status(401).json({ error: "Sign in first." });
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON." });
  }
  if (
    !body ||
    !uuid.test(body.organizationId) ||
    !Array.isArray(body.invoiceIds) ||
    !body.invoiceIds.length ||
    body.invoiceIds.length > 10 ||
    body.invoiceIds.some((id) => !uuid.test(id))
  )
    return res
      .status(400)
      .json({ error: "Provide an organization and 1–10 invoice IDs." });
  const base = env.SUPABASE_URL.replace(/\/$/, ""),
    headers = {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: req.headers.authorization,
      "Content-Type": "application/json",
    };
  async function db(path, options = {}) {
    const r = await fetch(base + path, {
      ...options,
      headers: { ...headers, ...options.headers },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok)
      throw Error("Workspace authorization or database request failed.");
    return r.status === 204 ? null : r.json();
  }
  try {
    const user = await db("/auth/v1/user");
    if (user.email !== "admin@aahanapestcontrol.in")
      return res.status(403).json({ error: "Administrator access required." });
    const org = body.organizationId,
      members = await db(
        "/rest/v1/organization_members?select=organization_id&user_id=eq." +
          encodeURIComponent(user.id) +
          "&organization_id=eq." +
          org,
      );
    if (!members.length)
      return res.status(403).json({ error: "Organization access required." });
    const results = [];
    for (const id of [...new Set(body.invoiceIds)]) {
      try {
        const rows = await db(
            "/rest/v1/invoices?select=*&id=eq." +
              id +
              "&organization_id=eq." +
              org,
          ),
          i = rows[0];
        if (!i) throw Error("Invoice unavailable.");
        const b = i.billing_details;
        if (
          !b?.company?.name ||
          !b?.company?.address ||
          !b?.client?.name ||
          !b?.client?.address ||
          !b?.gst ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b?.client?.email || "")
        )
          throw Error("Saved invoice billing details and email are required.");
        const key = "email:" + id,
          previous = await db(
            "/rest/v1/erp_records?select=payload&organization_id=eq." +
              org +
              "&kind=eq.invoice_delivery&record_key=eq." +
              encodeURIComponent(key),
          );
        if (previous[0]?.payload.status === "sent") {
          results.push({ id, status: "already_sent" });
          continue;
        }
        const m = message(i),
          pdf = invoicePDF(i),
          digest = createHash("sha256")
            .update(JSON.stringify([i.invoice_no, i.invoice_date, i.total, b]))
            .digest("hex");
        const pending = previous[0]?.payload;
        if (
          pending?.status === "pending" &&
          (pending.digest !== digest ||
            Date.now() - Date.parse(pending.started_at) > 23 * 60 * 60 * 1000)
        )
          throw Error(
            "Previous delivery outcome needs review before another send.",
          );
        await db(
          "/rest/v1/erp_records?on_conflict=organization_id,kind,record_key",
          {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify({
              organization_id: org,
              kind: "invoice_delivery",
              record_key: key,
              payload: {
                invoice_id: id,
                status: "pending",
                digest,
                to: b.client.email,
                started_at: pending?.started_at || new Date().toISOString(),
              },
            }),
          },
        );
        const delivery = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + env.RESEND_API_KEY,
            "Content-Type": "application/json",
            "Idempotency-Key": "aahana-" + id + "-" + digest,
          },
          body: JSON.stringify({
            from: env.INVOICE_FROM_EMAIL,
            to: [b.client.email],
            subject: m.subject,
            text: m.body,
            attachments: [
              {
                filename:
                  i.invoice_no.replace(/[^A-Za-z0-9._-]/g, "-") + ".pdf",
                content: pdf.toString("base64"),
              },
            ],
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (!delivery.ok)
          throw Error("Email provider did not accept the invoice.");
        const provider = await delivery.json();
        await db(
          "/rest/v1/erp_records?on_conflict=organization_id,kind,record_key",
          {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify({
              organization_id: org,
              kind: "invoice_delivery",
              record_key: key,
              payload: {
                invoice_id: id,
                status: "sent",
                provider_id: provider.id,
                to: b.client.email,
                sent_at: new Date().toISOString(),
                digest,
              },
            }),
          },
        );
        results.push({ id, status: "sent" });
      } catch (e) {
        results.push({ id, status: "failed", error: e.message });
      }
    }
    return res.status(200).json({ results });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
};
