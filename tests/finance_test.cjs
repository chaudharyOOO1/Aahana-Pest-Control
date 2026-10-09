const assert=require('node:assert/strict');
const F=require('../finance-core.js');
const empty=()=>({clients:[],invoices:[],payments:[],expenses:[],vendorBills:[],vendorPayments:[],vendors:[],ownerCapital:[],accounts:[{id:1,name:'Cash',type:'Cash',opening:1000},{id:2,name:'Bank',type:'Bank',opening:0}]});
assert.deepEqual(F.invoiceAmounts('0.03',18),{taxable:0.03,gst:0.01,total:0.04});
assert.deepEqual(F.invoiceAmounts('1234.56',18),{taxable:1234.56,gst:222.22,total:1456.78});
for(const value of ['','Infinity','1.001','-1','1e3'])assert.throws(()=>F.parseAmount(value));
assert.equal(F.sum([{amount:0.1},{amount:0.2}],'amount'),0.3);
assert.equal(F.nextNumber([{receipt:'REC-001'},{receipt:'REC-010'}],'receipt','REC'),'REC-011');
assert.equal(F.validDate('2026-02-30'),false);assert.equal(F.validDate('2024-02-29'),true);
const d=empty();d.invoices=[{id:1,taxable:100,gst:18,total:118}];d.payments=[{invoice:1,amount:50,mode:'Bank'},{invoice:1,amount:0.03,mode:'Cash'}];
const s=F.summary(d);assert.equal(s.outstanding,67.97);assert.equal(s.cash,1050.03);assert.equal(s.assets,1118);assert.equal(s.equity,1100);assert.equal(s.balanceCheck,0);
assert.equal(F.resolveAccount(d.accounts,'Unmapped account'),undefined);
console.log('Finance checks passed: rounding, validation, numbering, dates, partial receipts and opening balance reconciliation.');

{
 const base={invoices:[],payments:[],accounts:[],expenses:[],vendorBills:[],vendorPayments:[],vendors:[],ownerCapital:[],historicalBills:[]};
 const row=(id,status,total,notes=[],date=null)=>({id,client:1,source_key:id,payload:{reported_billing:{original_invoice_number:'UT/25-26/01',service_month:'2026-04',invoice_date:null,taxable_recorded:100,gst_recorded:18,total_recorded:total,payment_status_recorded:status,payment_date_recorded:date,unlabelled_notes:notes,source_fields:{},review_issues:[]}}});
 base.historicalBills=[row('a','Received',118),row('b','Pending',118),row('c','Received',118,[{value:'Discarded'}])];
 const projected=F.importedData(base), totals=F.summary(projected);
 assert.equal(totals.revenue,200);assert.equal(totals.collected,118);assert.equal(totals.receivable,118);assert.equal(totals.cash,118);assert.equal(projected.invoices.length,3);assert.equal(projected.payments[0].date,'');assert.equal(base.invoices.length,0);assert.equal(base.payments.length,0);
 const E=require('../erp-core.js');assert.equal(E.monthlyStatement(projected,'2026-04').opening,0);assert.equal(E.monthlyStatement(projected,'2026-04').closing,0);assert.equal(E.monthlyStatement(projected,'2026-04').revenue,200);
 assert.deepEqual(F.importedData({...base,invoices:[{source_key:'a'}]}).invoices.length,3);
 console.log('Uploaded billing checks passed: received/pending balances, cancelled exclusion, unallocated funds, unchanged source and duplicate suppression.');
}
