/* Pure reporting calculations. Bank imports are evidence, not extra ledger entries. */
(function(root){
 const round=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
 const sum=(rows,fn)=>round(rows.reduce((total,row)=>total+Number(fn(row)||0),0));
 const net=row=>Math.max(0,Number(row.amount||0)-Number(row.gst||0));
 function allocations(expense){
  if(expense.client!=null)return [{client:expense.client,amount:round(net(expense))}];
  const shares=expense.allocations||[];if(!shares.length)return [];
  const cents=Math.round(net(expense)*100),parts=shares.map(share=>{const exact=cents*Number(share.percent)/100;return {client:share.client,cents:Math.floor(exact),fraction:exact-Math.floor(exact)}});
  let remainder=cents-parts.reduce((sum,part)=>sum+part.cents,0);
  for(const part of [...parts].sort((a,b)=>b.fraction-a.fraction)){if(remainder--<=0)break;part.cents++}
  return parts.map(part=>({client:part.client,amount:part.cents/100}));
 }
 function report(data,month=''){
  const inside=row=>!month||String(row.date||'').slice(0,7)===month;
  const invoices=data.invoices.filter(inside),expenses=data.expenses.filter(inside),bills=data.vendorBills.filter(inside);
  const revenue=sum(invoices,i=>i.taxable);
  const direct=expenses.filter(e=>e.client!=null||e.allocations?.length),overheads=expenses.filter(e=>e.client==null&&!e.allocations?.length);
  const directCosts=sum(direct,net),companyCosts=sum(overheads,net),supplierCosts=sum(bills,net);
  const customerCollections=sum(data.payments.filter(inside),p=>p.amount);
  const capital=sum(data.ownerCapital.filter(inside),p=>p.amount);
  const paidExpenses=sum(expenses,e=>e.amount),supplierPayments=sum(data.vendorPayments.filter(inside),p=>p.amount);
  return {revenue,directCosts,companyCosts,supplierCosts,totalCosts:round(directCosts+companyCosts+supplierCosts),profit:round(revenue-directCosts-companyCosts-supplierCosts),
   cash:{customerCollections,capital,paidExpenses,supplierPayments,net:round(customerCollections+capital-paidExpenses-supplierPayments)},
   clients:data.clients.map(client=>{const sales=sum(invoices.filter(i=>i.client===client.id),i=>i.taxable),cost=sum(direct,e=>sum(allocations(e).filter(a=>a.client===client.id),a=>a.amount));return {id:client.id,name:client.name,revenue:sales,directCosts:cost,contribution:round(sales-cost)}}),
   expenses:expenses.map(e=>({...e,net:round(net(e)),scope:e.client!=null?'Client':e.allocations?.length?'Shared':'Company'}))};
 }
 const api={report,allocations};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FinanceLedger=api;
})(typeof window!=='undefined'?window:globalThis);
