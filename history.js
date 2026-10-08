(function () {
  const h = escapeHtml,
    F = AahanaFinance;
  let clientFilter = "",
    yearFilter = "";
  function visible() {
    return historicalBills.filter(
      (r) =>
        (!clientFilter || String(r.client) === clientFilter) &&
        (!yearFilter ||
          r.payload.reported_billing.source_financial_year === yearFilter),
    );
  }
  function recorded(value) {
    return typeof value === "number"
      ? money(value)
      : h(value ?? "Not recorded");
  }
  function preview(id) {
    const row = historicalBills.find((r) => r.id === id);
    if (!row) return;
    const b = row.payload.reported_billing;
    showDocument(
      "Historical bill · " + b.original_invoice_number,
      "<h2>" +
        h(b.client_site) +
        "</h2><p>Original issued number: " +
        h(b.original_invoice_number) +
        " · Source FY: " +
        h(b.source_financial_year) +
        '</p><p>Imported as supplied. This is the workbook record, not a replacement invoice.</p><table class="table"><tbody>' +
        row.payload.cells
          .map(
            (c) =>
              "<tr><th>" +
              h(c.header || "Unlabelled column " + c.column) +
              "</th><td>" +
              h(c.original_value ?? "Not recorded") +
              "</td></tr>",
          )
          .join("") +
        "</tbody></table><p>Review flags: " +
        h(
          b.review_issues.join("; ") ||
            "Source not reconciled against original bill/bank statement",
        ) +
        "</p>",
    );
  }
  function filter() {
    clientFilter = document.getElementById("historyClient").value;
    yearFilter = document.getElementById("historyYear").value;
    render();
  }
  function render() {
    const s = document.getElementById("historicalBilling");
    if (!s) return;
    const rows = visible(),
      years = [
        ...new Set(
          historicalBills.map(
            (r) => r.payload.reported_billing.source_financial_year,
          ),
        ),
      ].sort();
    const total = (key) =>
      F.sum(
        rows.map((r) => ({
          amount:
            typeof r.payload.reported_billing[key] === "number"
              ? r.payload.reported_billing[key]
              : 0,
        })),
        "amount",
      );
    s.innerHTML =
      '<div class="page-head"><div><h2>Historical billing</h2><p>Workbook records imported as supplied, linked to clients. Cash accounts and payment dates are not inferred.</p></div></div><div class="modal-body erp-fields"><label>Client<select id="historyClient" onchange="History.filter()"><option value="">All clients</option>' +
      clients
        .map((c) => '<option value="' + c.id + '">' + h(c.name) + "</option>")
        .join("") +
      '</select></label><label>Source financial year<select id="historyYear" onchange="History.filter()"><option value="">All years</option>' +
      years.map((y) => "<option>" + h(y) + "</option>").join("") +
      '</select></label></div><div class="kpis">' +
      [
        ["Workbook rows", rows.length],
        ["Recorded taxable subtotal", recorded(total("taxable_recorded"))],
        ["Recorded GST subtotal", recorded(total("gst_recorded"))],
        ["Recorded bill total subtotal", recorded(total("total_recorded"))],
      ]
        .map(
          ([label, n]) =>
            '<div class="kpi"><div class="label">' +
            label +
            '</div><div class="num">' +
            n +
            "</div></div>",
        )
        .join("") +
      '</div><p>These are unreconciled source subtotals, including rows marked discarded. “Received” and “Submitted” are source statuses, not posted cash receipts or verified tax filings. Live accounting statements currently cover posted ERP transactions.</p><div class="table-wrap"><table class="table"><thead><tr><th>Source FY / invoice</th><th>Client</th><th>Service month / invoice date</th><th>Taxable</th><th>GST</th><th>Total</th><th>Payment status / date</th><th>GST status</th><th>Source / review</th></tr></thead><tbody>' +
      rows
        .map((r) => {
          const b = r.payload.reported_billing;
          return (
            "<tr><td>" +
            h(b.source_financial_year) +
            "<br>" +
            h(b.original_invoice_number) +
            "</td><td>" +
            h(b.client_site) +
            "</td><td>" +
            h(b.service_month) +
            "<br>" +
            h(b.invoice_date || "Not recorded") +
            "</td><td>" +
            recorded(b.taxable_recorded) +
            "</td><td>" +
            recorded(b.gst_recorded) +
            "</td><td>" +
            recorded(b.total_recorded) +
            "</td><td>" +
            h(b.payment_status_recorded || "Not recorded") +
            "<br>" +
            h(b.payment_date_recorded || "Not recorded") +
            "</td><td>" +
            h(b.gst_status_recorded || "Not recorded") +
            "</td><td>" +
            h(r.source_key) +
            "<br>" +
            h(b.review_issues.length + " review flags") +
            '<br><button class="mini" onclick="History.preview(\'' +
            h(r.id) +
            "')\">Source details</button></td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>";
    document.getElementById("historyClient").value = clientFilter;
    document.getElementById("historyYear").value = yearFilter;
  }
  window.History = { render, filter, preview };
  const section = document.createElement("section");
  section.id = "historicalBilling";
  section.className = "section";
  document.querySelector("main").append(section);
  const button = document.createElement("button");
  button.textContent = "Historical billing";
  button.dataset.section = "historicalBilling";
  button.onclick = () => {
    document
      .querySelectorAll(".section")
      .forEach((s) =>
        s.classList.toggle("active", s.id === "historicalBilling"),
      );
    document
      .querySelectorAll(".nav button")
      .forEach((b) => b.classList.toggle("active", b === button));
    render();
  };
  document.querySelectorAll(".nav")[1].append(button);
  render();
})();
