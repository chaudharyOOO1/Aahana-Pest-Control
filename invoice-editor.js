(function () {
  const F = AahanaFinance, h = escapeHtml;
  const find = id => financialSnapshot().invoices.find(i => String(i.id) === String(id));
  const field = (id, label, value, type = 'text', readonly = false) => `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${h(value ?? '')}" ${readonly ? 'readonly' : ''}></div>`;
  let editing = null;
  function open(id) {
    const i = find(id); if (!i) return;
    if (i.void || i.numberPending) { alert('Only saved, non-cancelled invoices can be edited.'); return; }
    editing = String(id);
    const c = clients.find(c => c.id === i.client), b = i.billing || {}, p = b.company || ERP.company(), client = b.client || c?.billing || {};
    modalType = 'invoice-edit';
    document.getElementById('modalTitle').textContent = 'Edit invoice · ' + i.no;
    document.getElementById('modalBody').innerHTML = '<p>Issued number and invoice date stay fixed. Changes update linked financial reports. Enter a reason before saving.</p>' +
      field('ieNumber', 'Invoice number', i.no, 'text', true) + field('ieDate', 'Issued date', i.date || 'Not recorded', 'text', true) +
      field('ieMonth', 'Service month', b.serviceMonth || i.date.slice(0,7), 'month') + field('ieDescription', 'Service description', b.description || 'Pest control services') +
      field('ieCompany', 'Company name', p.name || 'Aahana Pest Control') + field('ieCompanyAddress', 'Company billing address', p.address) + field('ieCompanyGST', 'Company GSTIN', p.gstin) +
      field('ieClient', 'Client billing name', client.name || c?.name) + field('ieClientAddress', 'Client billing address', client.address || c?.site) + field('ieClientGST', 'Client GSTIN', client.gstin) + field('ieEmail', 'Client email', client.email, 'email') +
      field('ieTaxable', 'Taxable value', i.taxable, 'number') + field('ieGST', 'GST amount', i.gst, 'number') + field('ieTotal', 'Invoice total', i.total, 'number') +
      '<div class="field"><label for="ieSplit">GST split</label><select id="ieSplit"><option value="">Choose split</option><option value="cgst_sgst">CGST + SGST</option><option value="igst">IGST</option><option value="none">No GST</option></select></div>' + field('ieReason', 'Reason for change', '') + '<p>Recorded receipts: ' + money(F.paidFor(i.id, financialSnapshot().payments)) + '</p>';
    document.getElementById('ieSplit').value = b.gst?.kind || (i.gst === 0 ? 'none' : '');
    const save = document.querySelector('.modal-foot .primary'); save.textContent = 'Save changes'; save.setAttribute('onclick', 'InvoiceEditor.save()');
    document.getElementById('modal').classList.add('open');
  }
  function save() {
    if (!cloudReady || cloudHydrating || !editing) return;
    const i = find(editing); if (!i) return;
    const value = id => document.getElementById(id).value.trim();
    try {
      const taxable = F.parseAmount(value('ieTaxable')), gst = F.parseAmount(value('ieGST')), total = F.parseAmount(value('ieTotal'));
      if (total <= 0 || F.paise(taxable) + F.paise(gst) !== F.paise(total)) throw Error('Invoice total must equal taxable value plus GST.');
      const month = value('ieMonth'); if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error('Choose a valid service month.');
      const reason = value('ieReason'); if (!reason) throw Error('Enter a reason for the change.');
      const email = value('ieEmail'); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Enter a valid email.');
      if (!value('ieCompany') || !value('ieClient')) throw Error('Company and client names are required.');
      if (F.paise(total) < F.paise(F.paidFor(i.id, financialSnapshot().payments))) throw Error('Total cannot be below recorded receipts.');
      const billing = {...i.billing, serviceMonth:month, description:value('ieDescription'), company:{...i.billing?.company,...ERP.company(),name:value('ieCompany'),address:value('ieCompanyAddress'),gstin:value('ieCompanyGST')},client:{...i.billing?.client,name:value('ieClient'),address:value('ieClientAddress'),gstin:value('ieClientGST'),email},gst:AahanaERP.gstSplit(gst,value('ieSplit'))};
      const changed = {taxable,gst,total,billing};
      const key = i.imported ? 'source:' + i.source_id : 'invoice:' + i.cloud_id;
      let record = erpRecords.find(r => r.kind === 'invoice_adjustment' && r.key === key);
      const audit = {at:new Date().toISOString(),by:cloudUser?.id,reason,before:{taxable:i.taxable,gst:i.gst,total:i.total,billing:i.billing},after:changed};
      if (!record) { record={id:Math.max(0,...erpRecords.map(r=>r.id))+1,cloud_id:crypto.randomUUID(),kind:'invoice_adjustment',key,data:{revisions:[]}};erpRecords.push(record); }
      record.data={...record.data,source_id:i.source_id || null,invoice_id:i.cloud_id || null,override:i.imported?changed:null,revisions:[...(record.data.revisions||[]),audit]};
      if (!i.imported) Object.assign(invoices.find(r=>r.id===i.id),changed);
      editing=null;closeModal();renderAll();saveData();
    } catch(e) { alert(e.message); }
  }
  function preview(id) {
    const i=find(id);if(!i)return;if(i.numberPending){alert('Sync the invoice before printing.');return;}
    const b=i.billing||{},c=clients.find(c=>c.id===i.client),p=b.company||ERP.company(),client=b.client||c?.billing||{},g=b.gst;
    const row=(label,value)=>'<tr><th>'+h(label)+'</th><td>'+h(value)+'</td></tr>';
    showDocument('Invoice · '+i.no,'<h2>'+h(p.name||'Aahana Pest Control')+'</h2><p>'+h(p.address||'Company address not saved')+'<br>GSTIN: '+h(p.gstin||'Not saved')+'</p><h3>INVOICE '+h(i.no)+'</h3><p>Invoice date: '+h(i.date||'Not recorded')+' · Service month: '+h(b.serviceMonth||'Not recorded')+'</p><p><b>Bill to: '+h(client.name||c?.name)+'</b><br>'+h(client.address||c?.site||'Address not saved')+'<br>GSTIN: '+h(client.gstin||'Not saved')+'</p><p>'+h(b.description||'Pest control services')+'</p><table class="table"><tbody>'+row('Taxable value',i.taxable==null?'Not recorded':money(i.taxable))+(g?row('CGST',money(g.cgst))+row('SGST',money(g.sgst))+row('IGST',money(g.igst)):row('GST (split not saved)',i.gst==null?'Not recorded':money(i.gst)))+row('Invoice total',i.total==null?'Not recorded':money(i.total))+row('Received',money(F.paidFor(i.id,financialSnapshot().payments)))+row('Outstanding',money(F.outstandingFor(i,financialSnapshot().payments)))+'</tbody></table><p>'+h(p.bankDetails||'')+'</p>'+(!p.address||!p.gstin||!client.address||!g?'<p>Complete missing billing details and the GST split before using this as a final tax invoice.</p>':''));
  }
  window.InvoiceEditor={open,save,preview};
})();
