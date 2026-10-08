(function(root){
  'use strict';
  const paise=value=>Math.round(Number(value||0)*100);
  const rupees=value=>value/100;
  const sum=(rows,field)=>rupees(rows.reduce((total,row)=>total+paise(typeof field==='function'?field(row):row[field]),0));
  function parseAmount(value){
    const text=String(value??'').trim();
    if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw Error('Enter an amount with at most two decimal places.');
    const result=Number(text);
    if(!Number.isSafeInteger(paise(result)))throw Error('Amount is too large.');
    return rupees(paise(result));
  }
  function invoiceAmounts(value,rate){
    const taxable=parseAmount(value),percent=Number(rate);
    if(taxable<=0||![0,5,12,18].includes(percent))throw Error('Enter a positive taxable amount and a supported GST rate.');
    const gstPaise=Math.round(paise(taxable)*percent/100);
    return {taxable,gst:rupees(gstPaise),total:rupees(paise(taxable)+gstPaise)};
  }
  function paidFor(invoiceId,payments){return sum(payments.filter(p=>p.invoice===invoiceId),'amount')}
  function outstandingFor(invoice,payments){return rupees(Math.max(0,paise(invoice.total)-paise(paidFor(invoice.id,payments))))}
  function nextNumber(rows,field,prefix){
    const used=new Set(rows.map(row=>String(row[field]||'').trim().toUpperCase()));
    let max=0;
    for(const value of used){if(value.startsWith(prefix+'-')&&/^\d+$/.test(value.slice(prefix.length+1)))max=Math.max(max,Number(value.slice(prefix.length+1)))}
    let result;do{result=prefix+'-'+String(++max).padStart(3,'0')}while(used.has(result));return result;
  }
  function validDate(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
    const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
  }
  function resolveAccount(accounts,name){
    const n=String(name||'').trim().toLowerCase();
    const exact=accounts.find(a=>String(a.name).trim().toLowerCase()===n);if(exact)return exact.id;
    const kind=/petty/.test(n)?'petty':/upi|wallet/.test(n)?'upi':/bank|cheque/.test(n)?'bank':/^cash$/.test(n)?'cash':null;
    return kind?accounts.find(a=>String(a.name+' '+a.type).toLowerCase().includes(kind))?.id:undefined;
  }
  function accountBalances(data){
    const balances=Object.fromEntries(data.accounts.map(a=>[a.id,paise(a.opening)]));
    const post=(rows,field,sign)=>rows.forEach(row=>{const id=resolveAccount(data.accounts,row[field]);if(id!==undefined)balances[id]+=sign*paise(row.amount)});
    post(data.ownerCapital,'mode',1);post(data.payments,'mode',1);post(data.expenses,'account',-1);post(data.vendorPayments,'mode',-1);post(data.taxPayments||[],'mode',-1);post((data.accountTransfers||[]).map(r=>({...r,mode:r.from_mode})),'mode',-1);post((data.accountTransfers||[]).map(r=>({...r,mode:r.to_mode})),'mode',1);
    return Object.fromEntries(Object.entries(balances).map(([id,value])=>[id,rupees(value)]));
  }
  function summary(data){
    const billed=sum(data.invoices,'total'),collected=sum(data.payments,'amount'),outstanding=sum(data.invoices,i=>outstandingFor(i,data.payments));
    const gstCollected=sum(data.invoices,'gst'),expenseGross=sum(data.expenses,'amount'),expenseGST=sum(data.expenses,'gst');
    const vendorBilled=sum(data.vendorBills,'amount'),vendorPaid=sum(data.vendorPayments,'amount'),vendorGST=sum(data.vendorBills,'gst');
    const revenue=sum(data.invoices,'taxable'),operatingExpenses=sum([...data.expenses,...data.vendorBills],e=>rupees(paise(e.amount)-paise(e.gst)));
    const profit=rupees(paise(revenue)-paise(operatingExpenses)),inputGST=rupees(paise(expenseGST)+paise(vendorGST)),netGST=rupees(paise(gstCollected)-paise(inputGST)-paise(sum(data.taxPayments||[],'amount')));
    const receivable=outstanding,payable=sum(data.vendors,v=>Math.max(0,sum(data.vendorBills.filter(b=>b.vendor===v.id),'amount')-sum(data.vendorPayments.filter(p=>p.vendor===v.id),'amount')));
    const capital=sum(data.ownerCapital,'amount'),openingFunds=sum(data.accounts,'opening'),balances=accountBalances(data),cash=sum(Object.values(balances).map(amount=>({amount})),'amount');
    const assets=rupees(paise(cash)+paise(receivable)+paise(inputGST)),equity=rupees(paise(openingFunds)+paise(capital)+paise(profit)),liabilities=rupees(paise(payable)+paise(gstCollected)-paise(sum(data.taxPayments||[],'amount')));
    const balanceCheck=rupees(paise(assets)-paise(liabilities)-paise(equity));
    return {billed,collected,outstanding,gstCollected,expenseGross,expenseGST,vendorBilled,vendorPaid,vendorGST,revenue,operatingExpenses,profit,inputGST,netGST,receivable,payable,capital,cash,assets,equity,liabilities,balanceCheck};
  }
  const api={paise,rupees,sum,parseAmount,invoiceAmounts,paidFor,outstandingFor,nextNumber,validDate,resolveAccount,accountBalances,summary};
  root.AahanaFinance=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
