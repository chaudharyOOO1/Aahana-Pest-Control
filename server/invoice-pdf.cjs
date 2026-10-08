const E = require("../erp-core.js");
function invoicePDF(i) {
  const b = i.billing_details,
    p = b.company,
    c = b.client,
    g = b.gst;
  const lines = [
    p.name,
    p.address,
    "GSTIN: " + (p.gstin || "Unregistered"),
    p.email || "",
    "INVOICE " + i.invoice_no,
    "Invoice date: " + i.invoice_date,
    "Service month: " + b.serviceMonth,
    "Bill to: " + c.name,
    c.address,
    "Client GSTIN: " + (c.gstin || "-"),
    "Email: " + c.email,
    b.description || "Pest control services",
    ...Object.entries({
      Taxable: i.taxable,
      CGST: g.cgst,
      SGST: g.sgst,
      IGST: g.igst,
      Total: i.total,
    }).map(([k, v]) => k + ": INR " + Number(v).toFixed(2)),
    "Payment instructions: " + (p.bankDetails || "Contact the company"),
  ].flatMap((s) =>
    String(s)
      .replace(/[^\x20-\x7e\n]/g, " ")
      .split("\n")
      .flatMap((s) => s.match(/.{1,88}(?:\s|$)|.{1,88}/g) || [""]),
  );
  if (lines.length > 48)
    throw Error(
      "Invoice details exceed the one-page PDF limit. Shorten the saved billing details.",
    );
  const escaped = (s) => s.replace(/([\\()])/g, "\\$1");
  const stream =
    "BT /F1 11 Tf 48 790 Td 15 TL " +
    lines
      .map((s, n) => (n ? "T* " : "") + "(" + escaped(s.trim()) + ") Tj")
      .join("\n") +
    " ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " +
      Buffer.byteLength(stream) +
      " >>\nstream\n" +
      stream +
      "\nendstream",
  ];
  let pdf = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((o, n) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += n + 1 + " 0 obj\n" + o + "\nendobj\n";
  });
  const start = Buffer.byteLength(pdf);
  pdf +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" +
    start +
    "\n%%EOF";
  return Buffer.from(pdf);
}
module.exports = {
  invoicePDF,
  message: (i) =>
    E.message({
      ...i,
      no: i.invoice_no,
      date: i.invoice_date,
      billing: i.billing_details,
    }),
};
