// Run: node tests/browser-regression.cjs (Playwright and Chromium required).
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const sdk = require('./mock-supabase.cjs');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
let passed=0;
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',r=>r.fulfill({contentType:'application/javascript',body:sdk}));
 await page.goto(process.env.APP_URL||'http://127.0.0.1:8000');
 assert.equal(await page.getByRole('button',{name:'Create account',exact:true}).count(),0);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();assert.match(await page.locator('#authStatus').innerText(),/Enter your email/);passed++;
 await page.evaluate(()=>{window.authError=true});await page.locator('#authPassword').fill('wrong-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();assert.match(await page.locator('#authStatus').innerText(),/Invalid login/);assert.equal(await page.locator('#authGate').isVisible(),true);await page.evaluate(()=>window.authError=false);passed++;
 await page.getByRole('button',{name:'Forgot password'}).click();assert.equal(await page.evaluate(()=>calls[0][1]),'admin@aahanapestcontrol.com');passed++;
 await page.evaluate(()=>{window.failTable='clients';});await page.locator('#authPassword').fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForFunction(()=>document.getElementById('authStatus').textContent.includes('Test backend unavailable'));
 assert.equal(await page.locator('#authGate').isVisible(),true);passed++;
 await page.evaluate(async()=>{window.failTable=null;window.rows={accounts:[{id:'bank-uuid',name:'Bank',type:'Bank',opening:0}],clients:[{id:'client-uuid',name:'Test client'}],visits:[{id:'visit-uuid',client_id:'client-uuid',date:'2026-10-08',status:'due'}],invoices:[{id:'invoice-uuid',client_id:'client-uuid',invoice_no:'TEST-1',invoice_date:'2026-10-08',taxable:100,gst:18,total:118}],payments:[{id:'payment-uuid',invoice_id:'invoice-uuid',amount:50,payment_date:'2026-10-08'}]};await startCloudSession()});
 assert.equal(await page.locator('#authGate').isVisible(),false);
 assert.deepEqual(await page.evaluate(()=>[clients[0].id,visits[0].client,invoices[0].client,payments[0].invoice]),[1,1,1,1]);passed++;
 page.on('dialog',d=>d.accept('68'));
 await page.evaluate(()=>recordPayment(1));await page.locator('#fAmount').fill('68');await page.getByRole('button',{name:'Save',exact:true}).click();assert.equal(await page.evaluate(()=>payments.at(-1).invoice),1);await page.waitForFunction(()=>calls.some(c=>c[0]==='write'&&c[1]==='payments'));assert.equal(await page.evaluate(()=>hasUnsavedChanges),false);passed++;
 await page.evaluate(async()=>{clearTimeout(cloudSyncTimer);cloudSyncTimer=null;await cloudSyncNow()});
 assert.equal(await page.evaluate(()=>calls.filter(c=>c[0]==='write'&&c[1]==='payments').at(-1)[2].invoice_id),'invoice-uuid');
 const count=await page.evaluate(()=>calls.filter(c=>c[0]==='write').length);
 await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>calls.filter(c=>c[0]==='write').length),count);passed++;
 // A repeated SIGNED_IN event must not discard an unsaved local edit.
 await page.evaluate(()=>{clients[0].name='Unsaved edit';saveData();clearTimeout(cloudSyncTimer);authEvent('SIGNED_IN',{user:{id:'admin-user'}})});
 await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>clients[0].name),'Unsaved edit');passed++;
 // A failed save remains dirty and visible; no successful-save claim.
 await page.evaluate(async()=>{window.writeError=true;await cloudSyncNow()});assert.match(await page.locator('#syncStatus').innerText(),/Test save failed/);assert.equal(await page.evaluate(()=>hasUnsavedChanges),true);
 await page.evaluate(async()=>{window.writeError=false;await cloudSyncNow()});assert.equal(await page.evaluate(()=>hasUnsavedChanges),false);passed++;
 const emptyCount=await page.evaluate(()=>calls.filter(c=>c[0]==='write').length);
 await page.evaluate(async()=>{window.rows={};await cloudLoadData()});assert.equal(await page.evaluate(()=>clients.length),0);assert.equal(await page.evaluate(()=>calls.filter(c=>c[0]==='write').length),emptyCount);passed++;
 await page.evaluate(()=>{authEvent('PASSWORD_RECOVERY',{user:{}})});assert.equal(await page.locator('#passwordRecovery').isVisible(),true);
 await page.locator('#newPassword').fill('long-new-password');await page.locator('#confirmPassword').fill('different-password');await page.getByRole('button',{name:'Save new password'}).click();assert.match(await page.locator('#authStatus').innerText(),/do not match/);passed++;
 await page.evaluate(()=>{passwordRecovery=false;cloudReady=false});await Promise.all([page.waitForEvent('framenavigated'),page.evaluate(()=>{void authSignOut()})]);await page.waitForLoadState();
 assert.equal(await page.evaluate(()=>localStorage.getItem('ashna_pest_control_data_v1')),null);passed++;
 await page.evaluate(async()=>{window.testUser={id:'other-user',email:'other@example.com'};await startCloudSession()});assert.equal(await page.locator('#authGate').isVisible(),true);assert.match(await page.locator('#authStatus').innerText(),/Only the Aahana admin/);passed++;
 await page.evaluate(()=>{window.testUser={id:'admin-user',email:'admin@aahanapestcontrol.com'};window.readDelay=20;window.loading=startCloudSession();authEvent('SIGNED_OUT',null)});
 await page.evaluate(()=>window.loading);assert.equal(await page.locator('#authGate').isVisible(),true);assert.equal(await page.evaluate(()=>cloudReady),false);passed++;
 // A failed CDN request shows a useful error rather than crashing startup.
 const offline=await browser.newPage();const offlineErrors=[];offline.on('pageerror',e=>offlineErrors.push(e.message));await offline.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',r=>r.abort());await offline.goto(process.env.APP_URL||'http://127.0.0.1:8000');assert.match(await offline.locator('#authStatus').innerText(),/Unable to load/);assert.deepEqual(offlineErrors,[]);await offline.close();passed++;
 assert.deepEqual(errors,[]);console.log('PASS: '+passed+' browser regression scenarios; Supabase mocked, no production writes.');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
