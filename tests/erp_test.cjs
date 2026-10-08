const assert = require("node:assert/strict"),
  E = require("../erp-core.js"),
  F = require("../finance-core.js");
assert.equal(E.financialYear("2026-03-31"), "2025-26");
assert.equal(E.financialYear("2026-04-01"), "2026-27");
assert.equal(
  E.invoiceNumber([{ no: "APC/2026-27/0004" }], "APC", "2026-10-08"),
  "APC/2026-27/0005",
);
assert.equal(
  E.invoiceNumber([{ no: "APC/2025-26/9999" }], "APC", "2026-04-01"),
  "APC/2026-27/0001",
);
assert.deepEqual(E.gstSplit(0.03, "cgst_sgst"), {
  kind: "cgst_sgst",
  cgst: 0.01,
  sgst: 0.02,
  igst: 0,
});
assert.equal(E.gstSplit(18, "igst").igst, 18);
assert.deepEqual(
  E.bankRows(
    'date,description,debit,credit,reference\n08/10/2026,"Payment, client",,"1,180.00",UTR1',
  )[0],
  {
    date: "2026-10-08",
    description: "Payment, client",
    reference: "UTR1",
    amount: 1180,
    direction: "in",
    row: 2,
  },
);
assert.ok(
  E.bankRows("date,description,debit,credit\n2026-02-30,x,1,2")[0].error,
);
assert.throws(() => E.bankRows("date,amount\n2026-10-08,1"));
const d = {
  accounts: [
    { id: 1, name: "Bank", opening: 1000 },
    { id: 2, name: "Cash", opening: 0 },
  ],
  invoices: [
    {
      id: 1,
      date: "2026-10-08",
      taxable: 1000,
      gst: 180,
      total: 1180,
      billing: { serviceMonth: "2026-09" },
    },
  ],
  payments: [{ invoice: 1, date: "2026-10-08", amount: 1180, mode: "Bank" }],
  expenses: [{ date: "2026-10-08", amount: 118, gst: 18, account: "Bank" }],
  vendorBills: [],
  vendorPayments: [],
  vendors: [],
  ownerCapital: [],
  taxPayments: [{ date: "2026-10-08", amount: 162, mode: "Bank" }],
  accountTransfers: [
    { date: "2026-10-08", amount: 100, from_mode: "Bank", to_mode: "Cash" },
  ],
};
assert.equal(E.monthlyStatement(d, "2026-09").revenue, 1000);
const m = E.monthlyStatement(d, "2026-10");
assert.equal(m.revenue, 0);
assert.equal(m.receipts, 1180);
assert.equal(m.costs, 100);
assert.equal(m.closing, 1900);
assert.equal(m.cashChange, 900);
assert.equal(m.reconciliation, 0);
assert.equal(F.summary(d).balanceCheck, 0);
assert.equal(F.accountBalances(d)[2], 100);
console.log(
  "ERP checks passed: FY boundaries, tax splits, CSV validation, service-month revenue and cash reconciliation.",
);
