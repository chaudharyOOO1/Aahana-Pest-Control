const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const sdk=require('./mock-supabase.cjs');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});let passed=0;
 try{
 const page=await browser.newPage({timezoneId:'Asia/Kolkata'});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',r=>r.fulfill({contentType:'application/javascript',body:sdk}));
 await page.goto('http://127.0.0.1:8000');
 await page.evaluate(async()=>{window.rows={clients:[{id:'client-uuid',name:'Test client',site:'Site A'}],accounts:[{id:'bank-uuid',name:'Bank',type:'Bank',opening:100},{id:'cash-uuid',name:'Cash',type:'Cash',opening:0}]};await startCloudSession()});
 assert.equal(await page.evaluate(()=>iso(new Date('2026-10-08T00:30:00+05:30'))),'2026-10-08');passed++;
 const save=()=>page.getByRole('button',{name:'Save',exact:true}).click();
 await page.evaluate(()=>addInvoice());await page.locator('#mTaxable').fill('100.55');await save();
 assert.deepEqual(await page.evaluate(()=>[invoices[0].taxable,invoices[0].gst,invoices[0].total]),[100.55,18.1,118.65]);passed++;
 await page.evaluate(()=>addInvoice());await page.locator('#mTaxable').fill('25.75');await page.locator('#mGstRate').selectOption('0');await save();assert.equal(await page.evaluate(()=>invoices[1].total),25.75);assert.equal(await page.evaluate(()=>invoices[1].gst),0);passed++;
 await page.evaluate(()=>addInvoice());await page.locator('#mInvoiceNo').fill('inv-001');await page.locator('#mTaxable').fill('5');await save();assert.match(await page.locator('#financeError').innerText(),/already exists/);assert.equal(await page.evaluate(()=>invoices.length),2);await page.evaluate(()=>closeModal());passed++;
 await page.evaluate(()=>recordPayment(1));await page.locator('#fAmount').fill('200');await save();assert.match(await page.locator('#financeError').innerText(),/exceeds/);assert.equal(await page.evaluate(()=>payments.length),0);passed++;
 await page.locator('#fAmount').fill('30.25');await page.locator('#fDate').fill('2025-04-01');await page.locator('#fAccount').selectOption('1');await save();assert.equal(await page.evaluate(()=>payments[0].date),'2025-04-01');assert.equal(await page.evaluate(()=>payments[0].mode),'Bank');passed++;
 await page.evaluate(()=>recordPayment(1));await page.locator('#fAmount').fill('20.10');await save();
 await page.evaluate(()=>issueReceipt(1,1));assert.match(await page.locator('#receiptDocument').innerText(),/REC-001/);assert.match(await page.locator('#receiptDocument').innerText(),/30\.25/);assert.equal(await page.locator('#modalSave').isVisible(),false);await page.evaluate(()=>closeModal());passed++;
 await page.evaluate(()=>addExpense());await page.locator('#fAmount').fill('20.05');await page.locator('#fGst').fill('25');await page.locator('#fDescription').fill('Travel');await save();assert.match(await page.locator('#financeError').innerText(),/GST/);await page.locator('#fGst').fill('0');await save();assert.equal(await page.evaluate(()=>accountBalances()[1]),130.3);passed++;
 await page.evaluate(()=>addCapital());await page.locator('#fAmount').fill('10.10');await save();assert.equal(await page.evaluate(()=>accountBalances()[1]),140.4);assert.match(await page.locator('#aCash').innerText(),/140\.40/);passed++;
 // Backdated CSV import and repeat protection.
 await page.evaluate(()=>ExcelImport.open());await page.locator('#importKind').selectOption('invoices');
 const csv='Invoice number,Client name,Invoice date,Taxable amount,GST amount,Total\nHIST-001,Test client,01/03/2024,100.55,18.10,118.65\n';
 await page.locator('#importFile').setInputFiles({name:'historical.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await page.waitForFunction(()=>document.getElementById('map-no'));await page.getByRole('button',{name:'Preview import',exact:true}).click();assert.match(await page.locator('#importPreview').innerText(),/1 new/);await page.locator('#importApply').click();assert.equal(await page.evaluate(()=>invoices.find(i=>i.no==='HIST-001').date),'2024-03-01');passed++;
 await page.getByRole('button',{name:'Preview import',exact:true}).click();assert.match(await page.locator('#importPreview').innerText(),/1 skipped/);assert.equal(await page.locator('#importApply').isEnabled(),false);passed++;
 // Invalid date prevents committing every record in the batch.
 await page.locator('#importFile').setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from(csv.replace('01/03/2024','31/02/2024').replace('HIST-001','HIST-002'))});await page.waitForTimeout(50);await page.getByRole('button',{name:'Preview import',exact:true}).click();assert.match(await page.locator('#importPreview').innerText(),/Invalid calendar date/);assert.equal(await page.locator('#importApply').isEnabled(),false);passed++;
 // Explicit update mode preserves identity and validates against existing collections.
 await page.locator('#importFile').setInputFiles({name:'update.csv',mimeType:'text/csv',buffer:Buffer.from(csv.replace('100.55,18.10,118.65','200,0,200'))});await page.waitForTimeout(50);await page.locator('#importMode').selectOption('update');await page.getByRole('button',{name:'Preview import',exact:true}).click();assert.match(await page.locator('#importPreview').innerText(),/1 updates/);const oldId=await page.evaluate(()=>invoices.find(i=>i.no==='HIST-001').id);await page.locator('#importApply').click();assert.equal(await page.evaluate(()=>invoices.find(i=>i.no==='HIST-001').id),oldId);assert.equal(await page.evaluate(()=>invoices.find(i=>i.no==='HIST-001').total),200);passed++;
 // Import payments validates the full projected total, not individual rows alone.
 await page.locator('#importKind').selectOption('payments');await page.locator('#importMode').selectOption('add');await page.locator('#importFile').setInputFiles({name:'collections.csv',mimeType:'text/csv',buffer:Buffer.from('Receipt number,Invoice number,Payment date,Amount,Account\nR-A,HIST-001,2024-03-01,150,Bank\nR-B,HIST-001,2024-03-02,100,Bank\n')});await page.waitForTimeout(50);await page.getByRole('button',{name:'Preview import',exact:true}).click();assert.match(await page.locator('#importPreview').innerText(),/Collections exceed/);assert.equal(await page.locator('#importApply').isEnabled(),false);passed++;
 // The Excel reader fixture must be fetched with TLS verification beforehand.
 const excelFixture=process.env.EXCELJS_FIXTURE;
 if(excelFixture){
 await page.route('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',r=>r.fulfill({contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:fs.readFileSync(excelFixture)}));
 await page.addScriptTag({content:fs.readFileSync(excelFixture,'utf8')});
 const bytes=await page.evaluate(async()=>{const w=new ExcelJS.Workbook();const s=w.addWorksheet('Old invoices');s.addRow(['Invoice number','Client name','Invoice date','Taxable amount','GST amount','Total','Helper formula']);s.addRow(['XLSX-001','Test client',new Date('2023-12-31T00:00:00Z'),10.25,0,10.25,{formula:'1+1'}]);return Array.from(await w.xlsx.writeBuffer())});
 await page.locator('#importKind').selectOption('invoices');await page.locator('#importFile').setInputFiles({name:'old-invoices.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(bytes)});await page.waitForFunction(()=>document.querySelector('#importSheet option')?.textContent==='Old invoices');await page.getByRole('button',{name:'Preview import',exact:true}).click();assert.match(await page.locator('#importPreview').innerText(),/2023-12-31/);await page.locator('#importApply').click();assert.equal(await page.evaluate(()=>invoices.find(i=>i.no==='XLSX-001').total),10.25);passed++;
 await page.locator('#importFile').setInputFiles({name:'reference-format.xlsm',mimeType:'application/vnd.ms-excel.sheet.macroEnabled.12',buffer:Buffer.from(bytes)});await page.waitForTimeout(100);await page.getByRole('button',{name:'Preview import',exact:true}).click();assert.match(await page.locator('#importPreview').innerText(),/1 skipped/);passed++;
 }else console.log('UNRUN: XLSX scenario; set EXCELJS_FIXTURE to the TLS-verified ExcelJS 4.4.0 browser bundle.');
 // Imported labels are rendered as text, not executable markup.
 await page.locator('#importKind').selectOption('clients');await page.locator('#importMode').selectOption('add');
 await page.locator('#importFile').setInputFiles({name:'clients.csv',mimeType:'text/csv',buffer:Buffer.from('Client name,Site,Contact\n"<img src=x onerror=window.importInjected=true>",Site B,123\n')});await page.waitForTimeout(50);await page.getByRole('button',{name:'Preview import',exact:true}).click();await page.locator('#importApply').click();assert.equal(await page.evaluate(()=>window.importInjected),undefined);assert.match(await page.locator('#clientRows').innerText(),/<img/);passed++;
 await page.evaluate(()=>document.getElementById('excelImport').close());await page.evaluate(()=>accountStatement(1));assert.match(await page.locator('#receiptDocument').innerText(),/Opening balance: ₹100.00/);assert.match(await page.locator('#receiptDocument').innerText(),/Closing balance:/);await page.evaluate(()=>closeModal());passed++;
 await page.evaluate(()=>viewInvoice(1));assert.match(await page.locator('#receiptDocument').innerText(),/118.65/);assert.equal(await page.locator('#modalSave').isVisible(),false);passed++;
 assert.deepEqual(errors,[]);console.log('PASS: '+passed+' billing/import scenarios; no production writes.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
