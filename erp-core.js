(function (root) {
  "use strict";
  const F =
    root.AahanaFinance ||
    (typeof require !== "undefined" ? require("./finance-core.js") : null);
  function financialYear(date) {
    if (!F.validDate(date)) throw Error("Invalid invoice date.");
    const y = Number(date.slice(0, 4)),
      start = Number(date.slice(5, 7)) >= 4 ? y : y - 1;
    return start + "-" + String(start + 1).slice(-2);
  }
  function invoiceNumber(invoices, prefix, date) {
    prefix = (prefix || "APC").trim();
    if (!/^[A-Za-z0-9-]{1,3}$/.test(prefix))
      throw Error("Use an invoice prefix of 1–3 letters, digits or hyphens.");
    const base = prefix + "/" + financialYear(date) + "/";
    let max = 0;
    for (const i of invoices) {
      if (
        String(i.no).startsWith(base) &&
        /^\d+$/.test(String(i.no).slice(base.length))
      )
        max = Math.max(max, Number(String(i.no).slice(base.length)));
    }
    if (max >= 9999)
      throw Error(
        "Invoice sequence is full for this financial year and prefix.",
      );
    return base + String(max + 1).padStart(4, "0");
  }
  function gstSplit(gst, kind) {
    if (!["none", "cgst_sgst", "igst"].includes(kind))
      throw Error("Choose a valid GST split.");
    const p = F.paise(gst);
    if (kind === "cgst_sgst")
      return {
        kind,
        cgst: F.rupees(Math.floor(p / 2)),
        sgst: F.rupees(p - Math.floor(p / 2)),
        igst: 0,
      };
    if (kind === "none" && p) throw Error("Nonzero GST requires a tax split.");
    return { kind: p ? kind : "none", cgst: 0, sgst: 0, igst: F.rupees(p) };
  }
  function parseCSV(text) {
    const rows = [];
    let row = [],
      cell = "",
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = !quoted;
      } else if (c === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((c === "\n" || c === "\r") && !quoted) {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
        cell = "";
      } else cell += c;
    }
    if (quoted) throw Error("CSV has an unclosed quoted field.");
    row.push(cell);
    if (row.some((x) => x.trim())) rows.push(row);
    return rows;
  }
  function bankRows(text) {
    const rows = parseCSV(text.replace(/^\uFEFF/, ""));
    if (!rows.length) throw Error("CSV is empty.");
    const names = rows.shift().map((x) => x.trim().toLowerCase());
    const at = (name) => names.indexOf(name);
    if (["date", "description", "debit", "credit"].some((n) => at(n) < 0))
      throw Error(
        "CSV columns must include date, description, debit, credit; reference is optional.",
      );
    return rows.map((r, index) => {
      let date = (r[at("date")] || "").trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(date))
        date = date.split("/").reverse().join("-");
      const amount = (n) => {
        const value = (r[at(n)] || "").trim().replace(/[₹, ]/g, "");
        return value ? F.parseAmount(value) : 0;
      };
      try {
        const debit = amount("debit"),
          credit = amount("credit");
        if (!F.validDate(date) || (!debit && !credit) || (debit && credit))
          throw Error("Use a valid date and one positive debit or credit.");
        return {
          date,
          description: r[at("description")] || "",
          reference: at("reference") >= 0 ? r[at("reference")] || "" : "",
          amount: debit || credit,
          direction: credit ? "in" : "out",
          row: index + 2,
        };
      } catch (e) {
        return { row: index + 2, error: e.message };
      }
    });
  }
  function monthlyStatement(data, month) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw Error("Choose a service month.");
    const within = (row) => String(row.date).slice(0, 7) === month;
    const revenue = F.sum(
        data.invoices.filter(
          (i) => (i.billing?.serviceMonth || i.date.slice(0, 7)) === month,
        ),
        "taxable",
      ),
      costs = F.sum(
        [...data.expenses, ...data.vendorBills].filter(within),
        (r) => F.rupees(F.paise(r.amount) - F.paise(r.gst)),
      );
    const receipts = F.sum(data.payments.filter(within), "amount"),
      expenses = F.sum(data.expenses.filter(within), "amount"),
      supplierPayments = F.sum(data.vendorPayments.filter(within), "amount"),
      taxPayments = F.sum((data.taxPayments || []).filter(within), "amount"),
      capital = F.sum(data.ownerCapital.filter(within), "amount");
    const dated = [
      "payments",
      "expenses",
      "vendorPayments",
      "ownerCapital",
      "taxPayments",
      "accountTransfers",
    ];
    const before = { ...data },
      through = { ...data };
    for (const key of dated) {
      before[key] = (data[key] || []).filter(
        (r) => String(r.date).slice(0, 7) < month,
      );
      through[key] = (data[key] || []).filter(
        (r) => String(r.date).slice(0, 7) <= month,
      );
    }
    const totalBalances = (d) =>
        F.sum(
          Object.values(F.accountBalances(d)).map((amount) => ({ amount })),
          "amount",
        ),
      opening = totalBalances(before),
      closing = totalBalances(through),
      cashChange = F.rupees(
        F.paise(receipts) -
          F.paise(expenses) -
          F.paise(supplierPayments) -
          F.paise(taxPayments) +
          F.paise(capital),
      );
    return {
      revenue,
      costs,
      profit: F.rupees(F.paise(revenue) - F.paise(costs)),
      receipts,
      expenses,
      supplierPayments,
      taxPayments,
      capital,
      opening,
      closing,
      cashChange,
      reconciliation: F.rupees(
        F.paise(closing) - F.paise(opening) - F.paise(cashChange),
      ),
    };
  }
  function message(invoice) {
    const b = invoice.billing || {};
    return {
      subject:
        "Aahana Pest Control · Invoice " +
        invoice.no +
        " · " +
        (b.serviceMonth || invoice.date.slice(0, 7)),
      body:
        "Dear " +
        (b.client?.name || "Customer") +
        ",\n\nThank you for choosing Aahana Pest Control. Your invoice " +
        invoice.no +
        " for services in " +
        (b.serviceMonth || invoice.date.slice(0, 7)) +
        " is attached. The total is INR " +
        Number(invoice.total).toFixed(2) +
        ".\n\nPlease refer to the payment details on the invoice. If you have already paid, thank you; contact us for any receipt or billing clarification.\n\nRegards,\n" +
        (b.company?.name || "Aahana Pest Control"),
    };
  }
  const api = {
    financialYear,
    invoiceNumber,
    gstSplit,
    parseCSV,
    bankRows,
    monthlyStatement,
    message,
  };
  root.AahanaERP = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
