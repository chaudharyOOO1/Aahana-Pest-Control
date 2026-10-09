const assert = require("node:assert/strict"),
  handler = require("../api/send-invoices.js");
const { invoicePDF } = require("../server/invoice-pdf.cjs");
const org = "00000000-0000-4000-8000-000000000001",
  id = "00000000-0000-4000-8000-000000000002";
const invoice = {
  id,
  invoice_no: "APC/2026-27/0001",
  invoice_date: "2026-10-08",
  taxable: 100,
  gst: 18,
  total: 118,
  billing_details: {
    company: {
      name: "Aahana",
      address: "Mumbai",
      gstin: "GST",
      bankDetails: "Bank 123",
    },
    client: {
      name: "Customer",
      address: "Mumbai",
      email: "client@example.test",
    },
    serviceMonth: "2026-09",
    gst: { cgst: 9, sgst: 9, igst: 0 },
  },
};
assert.ok(invoicePDF(invoice).toString().startsWith("%PDF-1.4"));
assert.ok(invoicePDF(invoice).toString().includes("Service month: 2026-09"));
async function call(body = {}, auth = "Bearer test", method = "POST") {
  const res = {
    statusCode: 200,
    setHeader() {},
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
  await handler({ method, headers: { authorization: auth }, body }, res);
  return res;
}
(async () => {
  for (const k of [
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "RESEND_API_KEY",
    "INVOICE_FROM_EMAIL",
  ])
    process.env[k] = "test";
  process.env.SUPABASE_URL = "https://workspace.example.test";
  delete process.env.RESEND_API_KEY;
  assert.equal((await call()).statusCode, 503);
  process.env.RESEND_API_KEY = "test";
  assert.equal((await call({}, "", "GET")).statusCode, 405);
  assert.equal((await call({}, "")).statusCode, 401);
  assert.equal(
    (await call({ organizationId: org, invoiceIds: ["bad"] })).statusCode,
    400,
  );
  let emails = 0,
    record,
    requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    let data;
    if (url.endsWith("/auth/v1/user"))
      data = { id: "admin-user", email: "admin@aahanapestcontrol.in" };
    else if (url.includes("organization_members"))
      data = [{ organization_id: org }];
    else if (url.includes("/invoices?")) data = [invoice];
    else if (url.includes("/erp_records?") && options.method === "POST") {
      record = JSON.parse(options.body);
      return { ok: true, status: 204 };
    } else if (url.includes("/erp_records?")) data = record ? [record] : [];
    else if (url === "https://api.resend.com/emails") {
      emails++;
      const payload = JSON.parse(options.body);
      assert.equal(payload.to[0], "client@example.test");
      assert.equal(
        Buffer.from(payload.attachments[0].content, "base64")
          .subarray(0, 8)
          .toString(),
        "%PDF-1.4",
      );
      assert.ok(options.headers["Idempotency-Key"]);
      data = { id: "email-id" };
    } else throw Error("Unexpected URL");
    return { ok: true, status: 200, json: async () => data };
  };
  const body = { organizationId: org, invoiceIds: [id] };
  assert.equal((await call(body)).body.results[0].status, "sent");
  assert.equal(record.payload.status, "sent");
  assert.equal((await call(body)).body.results[0].status, "already_sent");
  assert.equal(emails, 1);
  record = {
    payload: { status: "pending", started_at: "2020-01-01", digest: "stale" },
  };
  assert.equal((await call(body)).body.results[0].status, "failed");
  assert.equal(emails, 1);
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: "other", email: "other@example.test" }),
  });
  assert.equal((await call(body)).statusCode, 403);
  console.log(
    "Email checks passed: authorization, saved recipients, PDF attachments, duplicate suppression and uncertain-delivery review.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
