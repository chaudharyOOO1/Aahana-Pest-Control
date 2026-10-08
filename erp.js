(function () {
  const F = AahanaFinance,
    E = AahanaERP,
    h = escapeHtml;
  let viewMonth = iso(today).slice(0, 7);
  const legacyPreview = window.previewInvoice;
  const records = (kind) => erpRecords.filter((r) => r.kind === kind);
  const company = () =>
    records("company_profile")[0]?.data || {
      name: "Aahana Pest Control",
      prefix: "APC",
      autoInvoice: true,
    };
  const input = (id, label, value = "", type = "text") =>
    '<div class="field"><label for="' +
    id +
    '">' +
    label +
    '</label><input id="' +
    id +
    '" type="' +
    type +
    '" value="' +
    h(value) +
    '"></div>';
  const val = (id) => document.getElementById(id)?.value.trim() || "";
  const nextId = (list) => Math.max(0, ...list.map((r) => r.id)) + 1;
  const write = (kind, key, data) => {
    let row = erpRecords.find((r) => r.kind === kind && r.key === key);
    if (row) row.data = data;
    else
      erpRecords.push({
        id: nextId(erpRecords),
        cloud_id: crypto.randomUUID(),
        kind,
        key,
        data,
      });
  };
  function commit(fn) {
    if (!cloudReady || cloudHydrating) {
      alert("Load the workspace first.");
      return;
    }
    const before = JSON.stringify(localSnapshot());
    try {
      fn();
      renderAll();
      saveData();
    } catch (e) {
      restoreSnapshot(JSON.parse(before));
      renderAll();
      alert(e.message);
    }
  }
  function data() {
    return {
      ...localSnapshot(),
      taxPayments: records("tax_payment").map((r) => r.data),
      accountTransfers: records("account_transfer").map((r) => r.data),
    };
  }
  function saveCompany() {
    if (!/^[A-Za-z0-9-]{1,3}$/.test(val("ePrefix") || "APC")) {
      alert("Use an invoice prefix of 1–3 letters, digits or hyphens.");
      return;
    }
    commit(() =>
      write("company_profile", "company", {
        name: val("eCompanyName"),
        address: val("eCompanyAddress"),
        gstin: val("eCompanyGST"),
        stateCode: val("eCompanyState"),
        email: val("eCompanyEmail"),
        bankDetails: val("eBankDetails"),
        prefix: val("ePrefix") || "APC",
        autoInvoice: document.getElementById("eAutoInvoice").checked,
      }),
    );
  }
  function editClient(id) {
    const c = clients.find((r) => r.id === Number(id));
    if (!c) return;
    const b = c.billing || {};
    document.getElementById("eClientFields").innerHTML =
      input("eClientEmail", "Registered billing email", b.email, "email") +
      input("eClientAddress", "Billing address", b.address || c.site) +
      input("eClientGST", "Client GSTIN", b.gstin) +
      input("eClientState", "Client state code (two digits)", b.stateCode) +
      input(
        "eClientRate",
        "Monthly taxable rate (INR)",
        b.monthlyRate || 0,
        "number",
      ) +
      input("eClientTaxRate", "GST rate (%)", b.gstRate ?? 18, "number") +
      '<button class="btn" onclick="ERP.saveClient(' +
      c.id +
      ')">Save client billing</button>';
  }
  function saveClient(id) {
    commit(() => {
      const c = clients.find((r) => r.id === id);
      const rate = Number(val("eClientTaxRate"));
      if (![0, 5, 12, 18].includes(rate))
        throw Error("Choose GST rate 0, 5, 12 or 18.");
      c.billing = {
        email: val("eClientEmail"),
        address: val("eClientAddress"),
        gstin: val("eClientGST"),
        stateCode: val("eClientState"),
        monthlyRate: F.parseAmount(val("eClientRate")),
        gstRate: rate,
      };
    });
  }
  function billingFor(clientId, date, month, gst) {
    const c = clients.find((c) => c.id === clientId),
      p = company(),
      b = c?.billing || {};
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      throw Error("Choose a valid service month.");
    if (!p.address || !b.address) return {serviceMonth:month,fy:E.financialYear(date)};
    if (
      gst &&
      (!p.gstin ||
        !/^\d{2}$/.test(p.stateCode || "") ||
        !/^\d{2}$/.test(b.stateCode || ""))
    )
      throw Error("Save GSTIN and company/client state codes first.");
    return {
      company: JSON.parse(JSON.stringify(p)),
      client: { name: c.name, ...b },
      serviceMonth: month,
      fy: E.financialYear(date),
      gst: E.gstSplit(
        gst,
        gst ? (p.stateCode === b.stateCode ? "cgst_sgst" : "igst") : "none",
      ),
      description: "Pest control services · " + month,
    };
  }
  function createInvoice(clientId, month, date, sourceVisit = null) {
    const c = clients.find((r) => r.id === clientId),
      p = company(),
      b = c?.billing || {};
    if (!c || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !F.validDate(date))
      throw Error("Select a valid client, service month and invoice date.");
    if (
      invoices.some(
        (i) =>
          i.client === clientId &&
          (i.billing?.serviceMonth || i.date.slice(0, 7)) === month,
      )
    )
      return null;
    if (!p.name || !p.address || !b.address)
      throw Error("Save company and client billing addresses first.");
    const amounts = F.invoiceAmounts(b.monthlyRate || 0, b.gstRate ?? 18);
    if (
      amounts.gst &&
      (!/^\d{2}$/.test(p.stateCode || "") ||
        !/^\d{2}$/.test(b.stateCode || "") ||
        !p.gstin)
    )
      throw Error(
        "Save company GSTIN and both state codes to determine the GST split.",
      );
    const kind = amounts.gst
      ? p.stateCode === b.stateCode
        ? "cgst_sgst"
        : "igst"
      : "none";
    const invoice = {
      id: nextId(invoices),
      client: clientId,
      no: E.invoiceNumber(invoices, p.prefix, date),
      date,
      ...amounts,
      paid: 0,
      billing: {
        company: JSON.parse(JSON.stringify(p)),
        client: { name: c.name, ...b },
        source: "monthly",
        serviceMonth: month,
        fy: E.financialYear(date),
        gst: E.gstSplit(amounts.gst, kind),
        description: "Pest control services · " + month,
        sourceVisit: sourceVisit?.cloud_id || null,
      },
    };
    invoices.push(invoice);
    return invoice;
  }
  function workComplete(clientId, month) {
    const done = visits.filter(
      (v) =>
        v.client === clientId &&
        v.status === "done" &&
        v.date.slice(0, 7) === month,
    );
    return (
      done.length > 0 &&
      plans
        .filter((p) => p.client === clientId)
        .every((p) =>
          /month/i.test(p.rule)
            ? done.filter((v) => v.plan === p.name).length >= p.total
            : p.completed >= p.total,
        )
    );
  }
  function generateMonthly() {
    commit(() => {
      const month = val("eServiceMonth"),
        date = val("eInvoiceDate");
      let count = 0,
        skipped = 0;
      for (const c of clients.filter(
        (c) => c.status === "Active" && Number(c.billing?.monthlyRate) > 0,
      )) {
        if (!workComplete(c.id, month)) {
          skipped++;
          continue;
        }
        if (createInvoice(c.id, month, date)) count++;
      }
      alert(
        count +
          " invoices created; " +
          skipped +
          " clients had no completed work in that month.",
      );
    });
  }
  function afterVisit(id) {
    if (!company().autoInvoice) return;
    const v = visits.find((v) => v.id === id),
      c = clients.find((c) => c.id === v?.client);
    if (!v || v.status !== "done" || !Number(c?.billing?.monthlyRate)) return;
    if (!workComplete(v.client, v.date.slice(0, 7))) return;
    try {
      createInvoice(v.client, v.date.slice(0, 7), iso(today), v);
    } catch (e) {
      syncStatus(
        "Visit saved. Invoice draft needs billing setup: " + e.message,
        true,
      );
    }
  }
  function preview(id) {
    const i = invoices.find((i) => i.id === id);
    if (!i) return;
    const b = i.billing;
    if (!b?.company) {
      legacyPreview(id);
      return;
    }
    const p = b.company,
      c = b.client,
      g = b.gst;
    showDocument(
      "Invoice " + i.no,
      "<h2>" +
        h(p.name) +
        "</h2><p>" +
        h(p.address) +
        "</p><p>GSTIN: " +
        h(p.gstin || "Not registered") +
        " · " +
        h(p.email || "") +
        "</p><h3>" +
        h(i.no) +
        "</h3><p>Invoice date: " +
        h(i.date) +
        " · Service month: " +
        h(b.serviceMonth) +
        "</p><p>Bill to: <b>" +
        h(c.name) +
        "</b><br>" +
        h(c.address) +
        "<br>GSTIN: " +
        h(c.gstin || "—") +
        "<br>" +
        h(c.email || "") +
        "</p><p>" +
        h(b.description) +
        '</p><table class="table"><tbody>' +
        [
          ["Taxable value", i.taxable],
          ["CGST", g.cgst],
          ["SGST", g.sgst],
          ["IGST", g.igst],
          ["Invoice total", i.total],
          ["Received", F.paidFor(i.id, payments)],
          ["Outstanding", F.outstandingFor(i, payments)],
        ]
          .map(
            ([label, n]) =>
              "<tr><th>" + label + "</th><td>" + money(n) + "</td></tr>",
          )
          .join("") +
        "</tbody></table><p>Payment details: " +
        h(p.bankDetails || "Contact the company for payment instructions.") +
        "</p>",
    );
  }
  function emailPreview(id) {
    const i = invoices.find((i) => i.id === id);
    if (!i) return;
    const m = E.message(i);
    showDocument(
      "Email preview",
      "<h3>" +
        h(m.subject) +
        "</h3><p>To: " +
        h(i.billing?.client?.email || "Set registered billing email first") +
        '</p><pre style="white-space:pre-wrap">' +
        h(m.body) +
        "</pre>",
    );
  }
  async function send(ids) {
    if (!ids.length) {
      alert("Select invoices first.");
      return;
    }
    if (cloudDirty) {
      await cloudSyncNow();
      if (cloudDirty) {
        alert("Sync invoices before sending email.");
        return;
      }
    }
    const selected = invoices.filter((i) => ids.includes(i.id));
    if (selected.some((i) => !i.cloud_id || !i.billing?.client?.email)) {
      alert(
        "Save and sync each invoice with a registered billing email first.",
      );
      return;
    }
    if (
      !confirm(
        "Send " +
          selected.length +
          " invoices to their saved billing email addresses?",
      )
    )
      return;
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session) throw Error("Sign in again.");
      let sent = 0;
      for (let offset = 0; offset < selected.length; offset += 10) {
        syncStatus("Sending invoice emails… " + sent + "/" + selected.length);
        const response = await fetch("/api/send-invoices", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + session.access_token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organizationId: cloudOrgId,
            invoiceIds: selected
              .slice(offset, offset + 10)
              .map((i) => i.cloud_id),
          }),
        });
        let result;
        try {
          result = await response.json();
        } catch (e) {
          throw Error(
            "Email service is not configured on this preview. Configure the server during deployment.",
          );
        }
        if (!response.ok) throw Error(result.error || "Email sending failed.");
        sent += result.results.filter(
          (r) => r.status === "sent" || r.status === "already_sent",
        ).length;
        if (result.results.some((r) => r.status === "failed"))
          throw Error(
            "Some emails failed. Review delivery records before retrying.",
          );
      }
      await refreshCloudData(true);
      syncStatus(sent + " invoice emails accepted by the email service.");
    } catch (e) {
      syncStatus(e.message, true);
    }
  }
  function sendSelected() {
    return send(
      [...document.querySelectorAll(".erp-invoice-choice:checked")].map((el) =>
        Number(el.value),
      ),
    );
  }
  function sendAll() {
    return send(
      invoices
        .filter(
          (i) =>
            !records("invoice_delivery").some(
              (r) =>
                r.data.invoice_id === i.cloud_id && r.data.status === "sent",
            ),
        )
        .map((i) => i.id),
    );
  }
  function saveFiling() {
    commit(() => {
      const month = val("eGSTMonth"),
        status = val("eGSTStatus"),
        reference = val("eGSTReference"),
        date = val("eGSTDate");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        throw Error("Choose a GST period.");
      if (status === "filed" && (!reference || !F.validDate(date)))
        throw Error("A filed return needs a reference and filing date.");
      const output = F.sum(
          invoices.filter((i) => i.date.slice(0, 7) === month),
          "gst",
        ),
        inputGST = F.sum(
          [...expenses, ...vendorBills].filter(
            (i) => i.date.slice(0, 7) === month,
          ),
          "gst",
        );
      write("gst_filing", month, {
        month,
        status,
        reference,
        date,
        output,
        inputGST,
      });
    });
  }
  function saveTaxPayment() {
    commit(() => {
      const amount = F.parseAmount(val("eGSTPaid")),
        date = val("eGSTPaymentDate"),
        mode = val("eGSTAccount"),
        month = val("eGSTMonth");
      if (
        amount <= 0 ||
        !F.validDate(date) ||
        date > iso(today) ||
        !accounts.some((a) => a.name === mode)
      )
        throw Error("Choose a positive GST payment, date and account.");
      write("tax_payment", crypto.randomUUID(), {
        amount,
        date,
        mode,
        month,
        reference: val("eGSTPaymentRef"),
      });
    });
  }
  async function importBank(event) {
    try {
      const file = event.target.files[0];
      if (!file) return;
      const account = val("eBankAccount");
      if (!account) throw Error("Choose the bank account first.");
      const rows = E.bankRows(await file.text());
      if (rows.some((r) => r.error))
        throw Error(
          rows
            .filter((r) => r.error)
            .map((r) => "Row " + r.row + ": " + r.error)
            .join("; "),
        );
      const occurrence = {};
      for (const row of rows) {
        const base = JSON.stringify([
          account,
          row.date,
          row.reference,
          row.description,
          row.amount,
          row.direction,
        ]);
        const index = (occurrence[base] = (occurrence[base] || 0) + 1);
        const bytes = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(base + "#" + index),
        );
        row.fingerprint = [...new Uint8Array(bytes)]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
        row.account = account;
      }
      commit(() => {
        let count = 0;
        for (const row of rows) {
          if (
            !erpRecords.some(
              (r) => r.kind === "bank_transaction" && r.key === row.fingerprint,
            )
          ) {
            write("bank_transaction", row.fingerprint, {
              ...row,
              status: "review",
            });
            count++;
          }
        }
        alert(
          count +
            " statement rows staged for review. No transactions were posted.",
        );
      });
    } catch (e) {
      alert(e.message);
    }
  }
  function bankCandidates(b) {
    const list = [];
    const add = (kind, rows, direction, field) => {
      if (b.direction !== direction) return;
      for (const r of rows)
        if (r[field] === b.account)
          list.push({ key: kind + ":" + r.id, kind, row: r });
    };
    add("receipt", payments, "in", "mode");
    add("expense", expenses, "out", "account");
    add("supplier_payment", vendorPayments, "out", "mode");
    add("capital", ownerCapital, "in", "mode");
    for (const r of erpRecords) {
      const t = r.data;
      if (
        r.kind === "tax_payment" &&
        b.direction === "out" &&
        t.mode === b.account
      )
        list.push({
          key: "tax:" + r.id,
          kind: "tax_payment",
          row: { ...t, cloud_id: r.cloud_id },
        });
      if (
        r.kind === "account_transfer" &&
        (b.direction === "in" ? t.to_mode : t.from_mode) === b.account
      )
        list.push({
          key: "transfer:" + r.id,
          kind: "account_transfer",
          row: { ...t, cloud_id: r.cloud_id },
        });
    }
    return list;
  }
  function postBank(id) {
    commit(() => {
      const row = erpRecords.find(
          (r) => r.id === id && r.kind === "bank_transaction",
        ),
        b = row?.data;
      if (!b || b.status === "posted") return;
      const kind = val("eBankKind" + id),
        reason = val("eBankReason" + id),
        target = val("eBankTarget" + id);
      if (!reason) throw Error("Record the payment reason before posting.");
      if (
        !F.validDate(b.date) ||
        b.date > iso(today) ||
        !accounts.some((a) => a.name === b.account)
      )
        throw Error("Use an existing account and a date no later than today.");
      let targetId = null;
      if (kind === "expense" && b.direction === "out") {
        const ref = b.reference || b.fingerprint;
        if (expenses.some((e) => e.receipt === ref && e.account === b.account))
          throw Error("Expense reference already exists; match it instead.");
        const gst = F.parseAmount(val("eBankGST" + id) || "0");
        if (gst > b.amount)
          throw Error("Included GST cannot exceed the debit.");
        targetId = nextId(expenses);
        expenses.push({
          id: targetId,
          cloud_id: crypto.randomUUID(),
          date: b.date,
          category: reason,
          vendor: "",
          description: b.description,
          account: b.account,
          amount: b.amount,
          gst,
          receipt: ref,
        });
      } else if (kind === "receipt" && b.direction === "in") {
        const invoice = invoices.find((i) => i.id === Number(target));
        if (
          !invoice ||
          b.date < invoice.date ||
          F.paise(b.amount) > F.paise(F.outstandingFor(invoice, payments))
        )
          throw Error(
            "Select an invoice with sufficient outstanding and a valid payment date.",
          );
        const receipt = b.reference || F.nextNumber(payments, "receipt", "REC");
        if (
          payments.some(
            (p) => String(p.receipt).toLowerCase() === receipt.toLowerCase(),
          )
        )
          throw Error("Receipt reference already exists; match it instead.");
        targetId = nextId(payments);
        payments.push({
          id: targetId,
          cloud_id: crypto.randomUUID(),
          invoice: invoice.id,
          date: b.date,
          amount: b.amount,
          mode: b.account,
          receipt,
        });
      } else if (kind === "match") {
        const candidate = bankCandidates(b).find((c) => c.key === target),
          existing = candidate?.row;
        if (
          !existing ||
          F.paise(existing.amount) !== F.paise(b.amount) ||
          existing.date !== b.date
        )
          throw Error(
            "The existing transaction must match amount, date and account.",
          );
        b.linkedCloudId = existing.cloud_id;
        b.linkedKind = candidate.kind;
      } else if (kind === "capital" && b.direction === "in") {
        targetId = nextId(ownerCapital);
        ownerCapital.push({
          id: targetId,
          cloud_id: crypto.randomUUID(),
          date: b.date,
          amount: b.amount,
          mode: b.account,
        });
      } else if (kind === "gst" && b.direction === "out")
        write("tax_payment", b.fingerprint, {
          date: b.date,
          amount: b.amount,
          mode: b.account,
          month: b.date.slice(0, 7),
          reference: b.reference,
        });
      else if (kind === "transfer") {
        if (!target || target === b.account)
          throw Error("Choose the other account.");
        write("account_transfer", b.fingerprint, {
          date: b.date,
          amount: b.amount,
          from_mode: b.direction === "out" ? b.account : target,
          to_mode: b.direction === "in" ? b.account : target,
          reference: b.reference,
        });
      } else
        throw Error("Choose a valid posting type for the debit or credit.");
      b.status = "posted";
      b.postingKind = kind;
      b.reason = reason;
      b.linkedCloudId =
        kind === "match"
          ? b.linkedCloudId
          : targetId
            ? cloudId(
                (kind === "receipt" ||
                (kind === "match" && b.direction === "in")
                  ? payments
                  : kind === "expense" || kind === "match"
                    ? expenses
                    : ownerCapital
                ).find((r) => r.id === targetId),
              )
            : null;
    });
  }
  function bankOptions(id) {
    const kind = val("eBankKind" + id),
      b = erpRecords.find((r) => r.id === id)?.data;
    let list = [];
    if (kind === "receipt")
      list = invoices.map((i) => [i.id, i.no + " · " + clientName(i.client)]);
    if (kind === "match")
      list = bankCandidates(b).map((c) => [
        c.key,
        c.kind +
          " · " +
          c.row.date +
          " · " +
          (c.row.receipt || c.row.reference || c.row.description || "") +
          " · " +
          money(c.row.amount),
      ]);
    if (kind === "transfer") list = accounts.map((a) => [a.name, a.name]);
    document.getElementById("eBankTarget" + id).innerHTML =
      '<option value="">Choose linked record/account</option>' +
      list
        .map(
          ([id, name]) =>
            '<option value="' + h(id) + '">' + h(name) + "</option>",
        )
        .join("");
  }
  function render() {
    let section = document.getElementById("financialERP");
    if (!section) return;
    const selectedClient = Number(val("eClient"));
    const p = company(),
      c = clients.find((c) => c.id === selectedClient) || clients[0],
      d = data(),
      m = E.monthlyStatement(d, viewMonth),
      s = F.summary(d),
      opts = accounts.map((a) => "<option>" + h(a.name) + "</option>").join("");
    section.innerHTML =
      '<div class="page-head"><div><h2>Financial ERP</h2><p>Billing, tax, monthly statements and bank review.</p></div>' +
      input("eReportMonth", "Statement month", viewMonth, "month") +
      '<button class="btn" onclick="ERP.setMonth()">Update statements</button><button class="btn" onclick="ERP.printStatement()">Print monthly report</button></div><div class="kpis">' +
      [
        ["Service revenue", m.revenue],
        ["Operating expenses", m.costs],
        ["Net profit", m.profit],
        ["Remaining liquid funds", m.closing],
      ]
        .map(
          ([label, value]) =>
            '<div class="kpi"><div class="label">' +
            label +
            '</div><div class="num">' +
            money(value) +
            "</div></div>",
        )
        .join("") +
      '</div><div class="grid"><div class="card"><div class="card-head"><h3>Cash-flow statement · ' +
      viewMonth +
      '</h3></div><div class="list">' +
      [
        ["Opening funds", m.opening],
        ["Customer receipts", m.receipts],
        ["Expense payments", -m.expenses],
        ["Supplier payments", -m.supplierPayments],
        ["GST cash payments", -m.taxPayments],
        ["Owner capital introduced", m.capital],
        ["Net cash movement", m.cashChange],
        ["Closing funds", m.closing],
        ["Cash reconciliation difference", m.reconciliation],
      ]
        .map(
          ([label, n]) =>
            '<div class="item"><b>' +
            label +
            "</b><span>" +
            money(n) +
            "</span></div>",
        )
        .join("") +
      '</div></div><div class="card"><div class="card-head"><h3>Current management balance sheet</h3></div><div class="list">' +
      [
        ["Liquid funds", s.cash],
        ["Customer receivables", s.receivable],
        ["Input GST recorded", s.inputGST],
        ["Assets", s.assets],
        ["Supplier payables", s.payable],
        [
          "GST liability after cash payments",
          s.gstCollected - F.sum(d.taxPayments, "amount"),
        ],
        ["Opening funds, capital and result", s.equity],
        ["Balance check", s.balanceCheck],
      ]
        .map(
          ([label, n]) =>
            '<div class="item"><b>' +
            label +
            "</b><span>" +
            money(n) +
            "</span></div>",
        )
        .join("") +
      '</div></div></div><div class="card" style="margin-top:16px"><div class="card-head"><h3>Saved company billing profile</h3></div><div class="modal-body erp-fields">' +
      input("eCompanyName", "Company name", p.name) +
      input("eCompanyAddress", "Billing address", p.address) +
      input("eCompanyGST", "GSTIN", p.gstin) +
      input("eCompanyState", "State code (two digits)", p.stateCode) +
      input("eCompanyEmail", "Company email", p.email, "email") +
      input(
        "eBankDetails",
        "Payment instructions / bank details",
        p.bankDetails,
      ) +
      input("ePrefix", "Invoice prefix", p.prefix) +
      '<label><input id="eAutoInvoice" type="checkbox" ' +
      (p.autoInvoice ? "checked" : "") +
      '> Draft a monthly invoice when the matching service plan is complete</label><button class="btn" onclick="ERP.saveCompany()">Save company billing</button></div></div><div class="card" style="margin-top:16px"><div class="card-head"><h3>Client billing profile and monthly rate</h3><select id="eClient" onchange="ERP.editClient(this.value)">' +
      clients
        .map((c) => '<option value="' + c.id + '">' + h(c.name) + "</option>")
        .join("") +
      '</select></div><div class="modal-body erp-fields" id="eClientFields"></div></div><div class="card" style="margin-top:16px"><div class="card-head"><h3>Monthly invoices and email</h3></div><div class="modal-body erp-fields">' +
      input("eServiceMonth", "Service month", viewMonth, "month") +
      input("eInvoiceDate", "Invoice date", iso(today), "date") +
      '<button class="btn primary" onclick="ERP.generateMonthly()">Generate for completed work</button><button class="btn" onclick="ERP.sendSelected()">Send selected invoices</button><button class="btn" onclick="ERP.sendAll()">Send all unsent invoices</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Select</th><th>Invoice</th><th>Service month</th><th>Client</th><th>Email / delivery</th><th>Total</th><th>Actions</th></tr></thead><tbody>' +
      invoices
        .map(
          (i) =>
            '<tr><td><input class="erp-invoice-choice" type="checkbox" value="' +
            i.id +
            '" aria-label="Select ' +
            h(i.no) +
            '"></td><td>' +
            h(i.no) +
            "</td><td>" +
            h(i.billing?.serviceMonth || "Legacy invoice") +
            "</td><td>" +
            h(clientName(i.client)) +
            "</td><td>" +
            h(i.billing?.client?.email || "Not saved") +
            "<br>" +
            h(
              records("invoice_delivery").find(
                (r) => r.data.invoice_id === i.cloud_id,
              )?.data.status || "Unsent",
            ) +
            "</td><td>" +
            money(i.total) +
            '</td><td><button class="mini" onclick="ERP.preview(' +
            i.id +
            ')">Invoice PDF</button> <button class="mini" onclick="ERP.emailPreview(' +
            i.id +
            ')">Email preview</button> <button class="mini" onclick="ERP.send([' +
            i.id +
            '])">Send</button></td></tr>',
        )
        .join("") +
      '</tbody></table></div></div><div class="card" style="margin-top:16px"><div class="card-head"><h3>GST filing and separate GST payments</h3></div><div class="modal-body erp-fields">' +
      input("eGSTMonth", "Return period", viewMonth, "month") +
      '<div class="field"><label for="eGSTStatus">Submission status</label><select id="eGSTStatus"><option value="draft">Draft / not submitted</option><option value="filed">Submitted</option></select></div>' +
      input("eGSTReference", "Filing reference") +
      input("eGSTDate", "Filing date", iso(today), "date") +
      '<button class="btn" onclick="ERP.saveFiling()">Save filing status</button>' +
      input("eGSTPaid", "GST cash payment", 0, "number") +
      input("eGSTPaymentDate", "Tax payment date", iso(today), "date") +
      input("eGSTPaymentRef", "Challan/reference") +
      '<select id="eGSTAccount" aria-label="GST payment account">' +
      opts +
      '</select><button class="btn" onclick="ERP.saveTaxPayment()">Record GST payment</button></div><div class="list">' +
      records("gst_filing")
        .map(
          (r) =>
            '<div class="item"><b>' +
            h(r.key) +
            " · " +
            h(r.data.status) +
            "</b><span>" +
            h(r.data.reference || "Not submitted") +
            "</span></div>",
        )
        .join("") +
      records("tax_payment")
        .map(
          (r) =>
            '<div class="item"><b>' +
            h(r.data.date) +
            " · " +
            h(r.data.mode) +
            "</b><span>" +
            money(r.data.amount) +
            "</span></div>",
        )
        .join("") +
      '</div></div><div class="card" style="margin-top:16px"><div class="card-head"><h3>Bank statement import and review</h3></div><div class="modal-body"><p>CSV columns: date, description, debit, credit, reference. Dates may be YYYY-MM-DD or DD/MM/YYYY. Nothing posts until you classify and approve a row. Match transactions already recorded, including the other side of an account transfer, to avoid duplicate entries.</p><select id="eBankAccount" aria-label="Statement account">' +
      opts +
      '</select><input type="file" accept=".csv,text/csv" aria-label="Upload bank CSV" onchange="ERP.importBank(event)"></div><div class="table-wrap"><table class="table"><thead><tr><th>Date / annotation</th><th>Debit / credit</th><th>Posting type</th><th>Reason / GST</th><th>Link</th><th>Action</th></tr></thead><tbody>' +
      records("bank_transaction")
        .map((r) => {
          const b = r.data;
          return (
            "<tr><td>" +
            h(b.date) +
            "<br>" +
            h(b.description) +
            "<br>" +
            h(b.reference) +
            "</td><td>" +
            h(b.direction) +
            " " +
            money(b.amount) +
            '</td><td><select id="eBankKind' +
            r.id +
            '" onchange="ERP.bankOptions(' +
            r.id +
            ')"><option value="">Review</option><option value="expense">Expense</option><option value="receipt">Customer receipt</option><option value="match">Match existing record</option><option value="capital">Owner capital</option><option value="gst">GST payment</option><option value="transfer">Account transfer</option></select></td><td><input id="eBankReason' +
            r.id +
            '" aria-label="Payment reason" value="' +
            h(b.reason || "") +
            '"><input id="eBankGST' +
            r.id +
            '" aria-label="Included GST" type="number" value="0"></td><td><select id="eBankTarget' +
            r.id +
            '" aria-label="Linked transaction"></select></td><td>' +
            (b.status === "posted"
              ? "Posted: " + h(b.postingKind)
              : '<button class="mini" onclick="ERP.postBank(' +
                r.id +
                ')">Approve and post</button>') +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div></div>";
    if (c) {
      document.getElementById("eClient").value = c.id;
      editClient(c.id);
    }
  }
  function setMonth() {
    const month = val("eReportMonth");
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      viewMonth = month;
      render();
    }
  }
  function printStatement() {
    const d = data(),
      m = E.monthlyStatement(d, viewMonth),
      p = company();
    const cutoff = { ...d };
    for (const key of [
      "invoices",
      "payments",
      "expenses",
      "vendorBills",
      "vendorPayments",
      "ownerCapital",
      "taxPayments",
      "accountTransfers",
    ])
      cutoff[key] = (d[key] || []).filter(
        (r) => r.date.slice(0, 7) <= viewMonth,
      );
    const balance = F.summary(cutoff),
      balances = F.accountBalances(cutoff);
    const table = (rows) =>
      '<table class="table"><tbody>' +
      rows
        .map(
          ([label, n]) =>
            "<tr><th>" + h(label) + "</th><td>" + money(n) + "</td></tr>",
        )
        .join("") +
      "</tbody></table>";
    showDocument(
      "Monthly financial report · " + viewMonth,
      "<h2>" +
        h(p.name) +
        "</h2><p>Month: " +
        h(viewMonth) +
        "</p><h3>Profit and loss by service month</h3>" +
        table([
          ["Service revenue excluding GST", m.revenue],
          ["Expenses excluding GST", m.costs],
          ["Profit", m.profit],
        ]) +
        "<h3>Cash-flow statement</h3>" +
        table([
          ["Opening funds", m.opening],
          ["Customer receipts", m.receipts],
          ["Expense payments", -m.expenses],
          ["Supplier payments", -m.supplierPayments],
          ["GST payments", -m.taxPayments],
          ["Capital introduced", m.capital],
          ["Closing funds", m.closing],
          ["Reconciliation difference", m.reconciliation],
        ]) +
        "<h3>Balance sheet at month end</h3>" +
        table([
          ["Liquid funds", balance.cash],
          ["Receivables", balance.receivable],
          ["Input GST", balance.inputGST],
          ["Total assets", balance.assets],
          ["Supplier payables", balance.payable],
          ["Output GST less payments", balance.liabilities - balance.payable],
          ["Equity and retained result", balance.equity],
          ["Balance check", balance.balanceCheck],
        ]) +
        "<h3>Remaining funds by account</h3>" +
        table(accounts.map((a) => [a.name, balances[a.id]])) +
        "<h3>Expense detail</h3>" +
        table(
          [...d.expenses, ...d.vendorBills]
            .filter((r) => r.date.slice(0, 7) === viewMonth)
            .map((r) => [
              r.date + " · " + (r.category || r.description || "Supplier bill"),
              F.rupees(F.paise(r.amount) - F.paise(r.gst)),
            ]),
        ) +
        "<p>Management report. P&amp;L follows service month; cash follows payment dates. Balance sheet follows dated postings. Opening funds must precede imported transactions.</p>",
    );
  }

  window.previewInvoice = (id) => preview(id);
  window.ERP = {
    render,
    data,
    company,
    saveCompany,
    editClient,
    saveClient,
    billingFor,
    createInvoice,
    generateMonthly,
    afterVisit,
    preview,
    emailPreview,
    send,
    sendSelected,
    sendAll,
    saveFiling,
    saveTaxPayment,
    importBank,
    postBank,
    bankOptions,
    setMonth,
    printStatement,
  };
  const section = document.createElement("section");
  section.id = "financialERP";
  section.className = "section";
  document.querySelector("main").append(section);
  const button = document.createElement("button");
  button.textContent = "Financial ERP";
  button.dataset.section = "financialERP";
  button.onclick = () => {
    document
      .querySelectorAll(".section")
      .forEach((s) => s.classList.toggle("active", s.id === "financialERP"));
    document
      .querySelectorAll(".nav button")
      .forEach((b) => b.classList.toggle("active", b === button));
    render();
  };
  document.querySelectorAll(".nav")[1].append(button);
  render();
})();
