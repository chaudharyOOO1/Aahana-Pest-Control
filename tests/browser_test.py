"""Browser integration tests against an in-memory Supabase adapter; no production writes."""
import functools
import http.server
import json
import os
import shutil
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MOCK = r'''
window.mockWrites=[];window.mockError=false;
const user={id:'admin-user',email:'admin@aahanapestcontrol.com'};
let listener;let session={user,access_token:'test-token'};
window.supabase={createClient:()=>({
 auth:{onAuthStateChange:cb=>{listener=cb;queueMicrotask(()=>cb('INITIAL_SESSION',session));return {data:{subscription:{unsubscribe(){}}}}},
 getUser:async()=>({data:{user:session?.user},error:null}),getSession:async()=>({data:{session}}),
 signInWithPassword:async input=>{window.mockLogin=input;session={user};listener('SIGNED_IN',session);return {error:null}},
 resetPasswordForEmail:async email=>{window.mockReset=email;return {error:null}},
 updateUser:async data=>{window.mockPassword=data.password;return {error:null}},
 signOut:async()=>{session=null;listener('SIGNED_OUT',null);return {error:null}}},
 from:table=>{let op='select',payload,filters=[],one=false,start=0,end=Infinity,ignoreDuplicates=false;
 const q={select(){return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},order(){return q},range(a,b){start=a;end=b;return q},insert(p){op='insert';payload=p;return q},upsert(p,options){op='upsert';payload=p;ignoreDuplicates=options.ignoreDuplicates;return q},update(p){op='update';payload=p;return q},single(){one=true;return q},maybeSingle(){one=true;return q},
 then(resolve){let rows=window.mockRows[table]||[];let result;
 if(op==='select'){const data=rows.filter(r=>filters.every(([k,v])=>(typeof r[k]==='object'?JSON.stringify(r[k])===v:r[k]===v))).slice(start,end+1);result={data:one?(data[0]||null):data,error:null}}
 else {window.mockWrites.push({table,op,payload,filters});if(window.mockError)result={data:null,error:{message:'offline'}};
 else{let row;
 if(op==='upsert'){row=rows.find(r=>r.id===payload.id);if(row&&ignoreDuplicates){result={data:null,error:null};return Promise.resolve(result).then(resolve)}}
 else if(op==='update')row=rows.find(r=>filters.every(([k,v])=>(typeof r[k]==='object'?JSON.stringify(r[k])===v:r[k]===v)));
 if(op==='insert'||op==='upsert'&&!row){row={id:crypto.randomUUID(),...payload};(window.mockRows[table]??=[]).push(row)}else if(row)Object.assign(row,payload);
 result={data:row||null,error:null};if(window.mockLostResponse&&row){window.mockLostResponse=false;result={data:null,error:{message:'response interrupted'}}}}}return Promise.resolve(result).then(resolve)} };return q}

})};
'''

def fixture(empty=False):
    org='business-org'
    tables=['clients','service_plans','visits','visit_reports','jobs','invoices','payments','expenses','accounts','owner_capital','vendors','vendor_bills','vendor_payments','erp_records']
    rows={t:[] for t in tables}
    rows['organization_members']=[dict(user_id='admin-user',organization_id=org,role='owner')]
    rows['accounts']=[dict(id='account-'+name,name=name,type=name,opening='0',organization_id=org) for name in ['UPI / Wallet','Petty Cash','Bank','Cash']]
    if not empty:
        rows['clients']=[dict(id='d307356a-7c3e-4cf2-a4c5-3c5bf95b4471',name='Hotel <img src=x onerror="window.pwned=1">',site='<script>window.pwned=1</script>',contact='123',plan='Monthly',rule='4 visits / month',visits=4,status='Active')]
        rows['visits']=[dict(id='f668af02-a280-457e-a06a-08e7d672723a',client_id=rows['clients'][0]['id'],date='2026-10-08',time='09:30',plan='Monthly',technician='Raj',status='due')]
        rows['service_plans']=[dict(id='plan-uuid',client_id=rows['clients'][0]['id'],name='Monthly',rule='4 visits / month',completed=0,total=4,next_date='2026-10-08')]
        rows['invoices']=[dict(id='invoice-uuid',client_id=rows['clients'][0]['id'],invoice_no='INV-001',invoice_date='2026-10-08',taxable='100',gst='18',total='118')]
        rows['vendors']=[dict(id='vendor-uuid',name='Supplier',contact='123',gstin='')]
    for records in rows.values():
        for record in records:record.setdefault('organization_id',org)
    for table in ['clients','invoices']:
        for row in rows[table]: row['billing_details']={}
    return rows

class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT))
        cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.pw=sync_playwright().start()
        executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
        cls.browser=cls.pw.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.context=self.browser.new_context(timezone_id='Asia/Kolkata')
        self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.on('dialog',lambda d:d.accept('Treatment completed' if d.type=='prompt' else None))
    def tearDown(self):
        self.context.close()
    def load(self,empty=False):
        self.page.add_init_script('window.mockRows='+json.dumps(fixture(empty))+';')
        self.page.route('https://cdn.jsdelivr.net/**',lambda route:route.fulfill(status=200,content_type='application/javascript',body=MOCK))
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/')
        self.page.wait_for_function('cloudReady')
        self.page.wait_for_function("document.getElementById('authGate').style.display==='none'")
    def test_hydration_visit_and_sync_terminates(self):
        self.load()
        self.assertEqual(self.page.locator('#visitRows button').get_attribute('onclick'),'completeVisit(1)')
        self.assertEqual(self.page.locator('#clientRows img').count(),0)
        self.assertIsNone(self.page.evaluate('window.pwned'))
        self.page.locator('#visitRows button').click()
        self.page.wait_for_function('visitReports.length===1')
        self.page.wait_for_function('!cloudDirty')
        self.assertEqual(self.page.evaluate('visits[0].status'),'done')
        self.assertEqual(self.page.evaluate('plans[0].completed'),1)
        count=self.page.evaluate('mockWrites.length')
        self.page.wait_for_timeout(1600)
        self.assertEqual(self.page.evaluate('mockWrites.length'),count)
        self.assertEqual(self.errors,[])
    def test_empty_workspace_first_client_invoice_payment(self):
        self.load(empty=True)
        self.assertEqual(self.page.evaluate('clients.length+invoices.length+visits.length'),0)
        self.assertEqual(self.page.evaluate('mockWrites.length'),0)
        self.page.evaluate("openModal('client')")
        self.page.locator('#mName').fill('Real client')
        self.page.evaluate('saveModal()')
        self.assertEqual(self.page.evaluate('clients[0].id'),1)
        self.page.evaluate("openModal('invoice')")
        self.page.locator('#mTaxable').fill('100.01')
        self.page.evaluate('saveModal()')
        self.assertEqual(self.page.evaluate('invoices[0].gst'),18)
        self.page.evaluate('recordPayment(1)')
        self.page.locator('#mPaymentAmount').fill('50')
        self.page.select_option('#mPaymentAccount',str(self.page.evaluate("accountIdByName('UPI')")))
        self.page.evaluate('saveModal()')
        self.assertEqual(self.page.evaluate('payments[0].amount'),50)
        self.assertEqual(self.page.evaluate("accountBalances()[accountIdByName('UPI')]"),50)
        self.page.wait_for_function('!cloudDirty')
        self.assertEqual(self.errors,[])
    def test_sync_failure_backup_and_retry(self):
        self.load()
        self.page.evaluate("mockError=true;openModal('client')")
        self.page.locator('#mName').fill('Offline change')
        self.page.evaluate('saveModal()')
        self.page.wait_for_function("document.getElementById('syncStatus').textContent.includes('failed')")
        self.assertTrue(self.page.evaluate('cloudDirty'))
        self.page.reload();self.page.wait_for_function('cloudReady')
        self.assertEqual(self.page.evaluate('clients.length'),2)
        self.assertTrue(self.page.evaluate('cloudDirty'))
        self.page.evaluate('cloudSyncNow()')
        self.page.wait_for_function('!cloudDirty')
        self.assertEqual(self.errors,[])
    def test_reset_and_sign_out(self):
        self.load()
        self.page.evaluate('authSignOut()')
        self.page.wait_for_function("document.getElementById('authGate').style.display==='flex'")
        self.assertEqual(self.page.evaluate('clients.length'),0)
        self.assertEqual(self.page.get_by_text('Create account',exact=True).count(),0)
        self.page.get_by_text('Reset password',exact=True).click()
        self.page.wait_for_function("window.mockReset==='admin@aahanapestcontrol.com'")
        self.assertEqual(self.errors,[])
    def test_clipboard_failure_reports_failure(self):
        self.load()
        self.page.evaluate("Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('Permission denied')}}});window.alert=message=>window.clipboardResult=message;sendWA(1)")
        self.page.wait_for_function("window.clipboardResult?.includes('Could not copy')")
        self.assertEqual(self.errors,[])

    def test_only_changed_modules_are_written(self):
        self.load()
        self.page.evaluate("window.prompt=()=> 'Completed';completeVisit(1)")
        self.page.wait_for_function('!cloudDirty')
        tables=self.page.evaluate('[...new Set(mockWrites.map(w=>w.table))].sort()')
        self.assertEqual(tables,['service_plans','visit_reports','visits'])
        self.assertEqual(self.errors,[])

    def test_conflicting_cloud_change_is_not_overwritten(self):
        self.load()
        self.page.evaluate("mockRows.clients[0].name='Newer remote name';clients[0].name='Local name';saveData()")
        self.page.wait_for_function("document.getElementById('syncStatus').textContent.includes('conflict')")
        self.assertEqual(self.page.evaluate('mockRows.clients[0].name'),'Newer remote name')
        self.assertTrue(self.page.evaluate('cloudDirty'))
        self.page.evaluate('refreshCloudData(true)')
        self.assertEqual(self.page.evaluate('clients[0].name'),'Local name')
        self.assertEqual(self.errors,[])

    def test_remote_refresh_updates_related_views(self):
        self.load()
        self.page.evaluate("mockRows.clients[0].name='Renamed client';mockRows.payments.push({id:'payment-uuid',organization_id:'business-org',invoice_id:'invoice-uuid',receipt:'REC-001',payment_date:'2026-10-08',amount:50,mode:'UPI'});refreshCloudData(true)")
        self.page.wait_for_function("clients[0].name==='Renamed client' && payments.length===1 && !cloudHydrating")
        self.assertIn('Renamed client',self.page.locator('#billingRows').inner_text())
        self.assertIn('68.00',self.page.locator('#bOutstanding').inner_text())
        self.assertEqual(self.page.evaluate("accountBalances()[accountIdByName('UPI')]"),50)
        self.assertEqual(self.page.evaluate('mockWrites.length'),0)
        self.assertEqual(self.errors,[])

    def test_interrupted_insert_retry_does_not_duplicate(self):
        self.load(empty=True)
        self.page.evaluate("mockLostResponse=true;openModal('client')")
        self.page.locator('#mName').fill('Retry client')
        self.page.evaluate('saveModal()')
        self.page.wait_for_function("document.getElementById('syncStatus').textContent.includes('interrupted')")
        self.page.evaluate('cloudSyncNow()')
        self.page.wait_for_function('!cloudDirty')
        self.assertEqual(self.page.evaluate('mockRows.clients.length'),1)
        self.assertEqual(self.errors,[])

    def test_supplier_expense_capital_sync_and_reload(self):
        self.load()
        self.page.evaluate("""window.prompt=(text,initial)=>text.startsWith('Supplier ID')?'1':text.startsWith('Supplier bill number')?'B-001':text.startsWith('Total bill amount')?'236':text.startsWith('GST included')?'36':text.startsWith('Payment amount')?'100':text.startsWith('Payment mode')?'Bank':initial||'';addVendorBill();recordVendorPayment(1);
        window.prompt=(text,initial)=>text.startsWith('Total expense amount')?'118':text.startsWith('GST included')?'18':text.startsWith('Payment account')?'Petty Cash':initial||'';addExpense();
        window.prompt=(text,initial)=>text.startsWith('Owner capital')?'500':text.startsWith('Capital account')?'Bank':initial||'';addCapital();""")
        self.page.wait_for_function('!cloudDirty')
        self.page.evaluate('refreshCloudData(true)')
        self.page.wait_for_function('!cloudHydrating')
        self.assertEqual(self.page.evaluate('vendorBills[0].amount-vendorPayments[0].amount'),136)
        self.assertEqual(self.page.evaluate("accountBalances()[accountIdByName('Bank')]"),400)
        self.assertEqual(self.page.evaluate("accountBalances()[accountIdByName('Petty Cash')]"),-118)
        self.assertIn('200.00',self.page.locator('#aProfit').inner_text())
        self.assertEqual(self.page.evaluate('mockRows.vendor_bills[0].vendor_id'), 'vendor-uuid')
        self.assertEqual(self.errors,[])

    def test_dated_partial_receipts_and_exact_receipt_preview(self):
        self.load()
        self.page.evaluate("invoices[0].date='2026-09-01';mockRows.invoices[0].invoice_date='2026-09-01';syncedBaselines['invoices:invoice-uuid'].invoice_date='2026-09-01';recordPayment(1)")
        self.page.locator('#mPaymentAmount').fill('50.03')
        self.page.locator('#mPaymentDate').fill('2026-09-15')
        self.page.locator('#mPaymentReceipt').fill('REC-010')
        self.page.select_option('#mPaymentAccount',str(self.page.evaluate("accountIdByName('Bank')")))
        self.page.evaluate('saveModal()')
        self.page.wait_for_function('!cloudDirty')
        self.page.evaluate('recordPayment(1)')
        self.assertEqual(self.page.locator('#mPaymentReceipt').input_value(),'REC-011')
        self.page.locator('#mPaymentAmount').fill('67.97')
        self.page.evaluate('saveModal()')
        self.page.wait_for_function('!cloudDirty')
        self.assertIn('0.00',self.page.locator('#bOutstanding').inner_text())
        self.page.evaluate('issueReceipt(1,1)')
        receipt=self.page.locator('#modalBody').inner_text()
        self.assertIn('REC-010',receipt)
        self.assertIn('50.03',receipt)
        self.assertIn('2026-09-15',receipt)
        self.page.evaluate('closeModal();refreshCloudData(true)')
        self.page.wait_for_function('!cloudHydrating')
        self.assertEqual(self.page.evaluate('payments[0].date'),'2026-09-15')
        self.assertEqual(self.page.evaluate('AahanaFinance.outstandingFor(invoices[0],payments)'),0)
        self.assertEqual(self.errors,[])

    def test_payment_validation_and_cancel_preserve_records(self):
        self.load()
        self.page.evaluate('recordPayment(1)')
        self.page.locator('#mPaymentAmount').fill('119')
        self.page.evaluate('saveModal()')
        self.assertEqual(self.page.evaluate('payments.length'),0)
        self.page.locator('#mPaymentAmount').fill('1.001')
        self.page.evaluate('saveModal()')
        self.assertEqual(self.page.evaluate('payments.length'),0)
        self.page.evaluate('closeModal()')
        self.assertEqual(self.page.evaluate('mockWrites.length'),0)
        self.assertEqual(self.errors,[])

    def test_opening_funds_reconcile_all_summary_views(self):
        self.load()
        self.page.evaluate('accounts[0].opening=1000;renderAll()')
        self.assertIn('1,000.00',self.page.locator('#bsCash').inner_text())
        self.assertIn('1,118.00',self.page.locator('#bsAssets').inner_text())
        self.assertIn('1,100.00',self.page.locator('#bsEquity').inner_text())
        self.assertIn('0.00',self.page.locator('#bsCheck').inner_text())
        self.assertEqual(self.errors,[])

    def test_monthly_client_outstanding_counts_receipts_from_other_months(self):
        self.load()
        self.page.evaluate("mockRows.payments.push({id:'historic-payment',organization_id:'business-org',invoice_id:'invoice-uuid',receipt:'REC-999',payment_date:'2026-09-30',amount:50,mode:'Bank'});refreshCloudData(true)")
        self.page.wait_for_function('payments.length===1 && !cloudHydrating')
        self.page.evaluate("document.getElementById('reportPeriod').value='month';renderReports()")
        rows=self.page.locator('#reportClientRows').inner_text()
        self.assertIn('50.00',rows)
        self.assertIn('68.00',rows)
        self.assertIn('0.00',self.page.locator('#rCollected').inner_text())
        self.assertEqual(self.errors,[])

    def billing_setup(self):
        self.page.evaluate("""() => {
          const fields={eCompanyAddress:'Mumbai office',eCompanyGST:'27ABCDE1234F1Z5',eCompanyState:'27',eCompanyEmail:'office@example.test',eBankDetails:'Bank account 123'};
          Object.entries(fields).forEach(([id,value])=>document.getElementById(id).value=value);ERP.saveCompany();
          const client={eClientAddress:'Client site Mumbai',eClientEmail:'billing@example.test',eClientState:'27',eClientRate:'1000',eClientTaxRate:'18'};
          Object.entries(client).forEach(([id,value])=>document.getElementById(id).value=value);ERP.saveClient(1);
        }""")
        self.page.wait_for_function('!cloudDirty')

    def test_billing_snapshots_service_month_and_reload(self):
        self.load();self.billing_setup()
        self.page.evaluate("""() => {visits[0].status='done';visits[0].date='2026-09-30';plans[0].completed=4;for(let id=2;id<=4;id++)visits.push({...visits[0],id,cloud_id:undefined});document.getElementById('eServiceMonth').value='2026-09';document.getElementById('eInvoiceDate').value='2026-10-08';ERP.generateMonthly()}""")
        self.page.wait_for_function('!cloudDirty')
        invoice=self.page.evaluate('invoices[1]')
        self.assertEqual(invoice['no'],'APC/2026-27/0001')
        self.assertEqual(invoice['billing']['serviceMonth'],'2026-09')
        self.assertEqual(invoice['billing']['gst']['cgst'],90)
        self.assertEqual(invoice['date'],'2026-10-08')
        self.page.evaluate("document.getElementById('eClientRate').value='2000';ERP.saveClient(1);ERP.preview(2)")
        self.assertIn('1,180',self.page.locator('#modalBody').inner_text())
        self.page.evaluate('closeModal()');self.page.wait_for_function('!cloudDirty');self.page.add_init_script('window.mockRows='+json.dumps(self.page.evaluate('mockRows'))+';');self.page.reload();self.page.wait_for_function('cloudReady')
        self.assertEqual(self.page.evaluate('invoices[1].billing.client.monthlyRate'),1000)
        self.assertEqual(self.page.evaluate('clients[0].billing.monthlyRate'),2000)
        self.assertEqual(self.errors,[])

    def test_completion_drafts_once_and_plan_not_complete_skips(self):
        self.load();self.billing_setup()
        self.page.evaluate("invoices=[];window.prompt=()=> 'Completed';completeVisit(1)")
        self.assertEqual(self.page.evaluate('invoices.length'),0)
        self.page.evaluate("plans[0].completed=3;for(let id=2;id<=4;id++)visits.push({...visits[0],id,cloud_id:undefined,status:'done'});visits[0].status='due';completeVisit(1)")
        self.assertEqual(self.page.evaluate('invoices.length'),1)
        self.page.evaluate('ERP.afterVisit(1)')
        self.assertEqual(self.page.evaluate('invoices.length'),1)
        self.page.wait_for_function('!cloudDirty');self.assertEqual(self.errors,[])

    def test_gst_filing_does_not_collect_cash(self):
        self.load()
        self.page.evaluate("document.getElementById('eGSTStatus').value='filed';document.getElementById('eGSTReference').value='ARN-123';ERP.saveFiling()")
        self.assertEqual(self.page.evaluate('payments.length'),0)
        self.assertEqual(self.page.evaluate('AahanaFinance.summary(ERP.data()).cash'),0)
        self.page.evaluate("document.getElementById('eGSTPaid').value='10';document.getElementById('eGSTAccount').value='Bank';ERP.saveTaxPayment()")
        self.assertEqual(self.page.evaluate('AahanaFinance.summary(ERP.data()).cash'),-10)
        self.assertEqual(self.page.evaluate('AahanaFinance.summary(ERP.data()).balanceCheck'),0)
        self.page.wait_for_function('!cloudDirty');self.assertEqual(self.errors,[])

    def test_bank_stage_deduplicate_post_match_and_reload(self):
        self.load()
        self.page.evaluate("document.getElementById('eBankAccount').value='Bank'")
        import_js=r"""async() => {await ERP.importBank({target:{files:[new File(['date,description,debit,credit,reference\n2026-10-08,Client payment,,50,UTR-001'], 'bank.csv')]}})}"""
        self.page.evaluate(import_js)
        self.assertEqual(self.page.evaluate('payments.length'),0)
        self.page.evaluate("document.getElementById('eBankAccount').value='Bank'");self.page.evaluate(import_js)
        self.assertEqual(self.page.evaluate("erpRecords.filter(r=>r.kind==='bank_transaction').length"),1)
        bank_id=self.page.evaluate("erpRecords.find(r=>r.kind==='bank_transaction').id")
        self.page.evaluate(f"document.getElementById('eBankKind{bank_id}').value='receipt';ERP.bankOptions({bank_id});document.getElementById('eBankTarget{bank_id}').value='1';document.getElementById('eBankReason{bank_id}').value='Hotel payment';ERP.postBank({bank_id})")
        self.page.wait_for_function('!cloudDirty')
        self.assertEqual(self.page.evaluate('payments.length'),1)
        self.assertEqual(self.page.evaluate("erpRecords.find(r=>r.kind==='bank_transaction').data.linkedCloudId"),self.page.evaluate('payments[0].cloud_id'))
        self.page.evaluate(f'ERP.postBank({bank_id})');self.assertEqual(self.page.evaluate('payments.length'),1)
        self.page.evaluate("erpRecords.push({id:50,kind:'bank_transaction',key:'another',data:{date:'2026-10-08',account:'Bank',direction:'in',amount:50,status:'review'}});ERP.render();document.getElementById('eBankKind50').value='match';ERP.bankOptions(50);document.getElementById('eBankTarget50').value='receipt:1';document.getElementById('eBankReason50').value='Match existing';ERP.postBank(50)")
        self.assertEqual(self.page.evaluate('payments.length'),1)
        self.page.wait_for_function('!cloudDirty');self.page.add_init_script('window.mockRows='+json.dumps(self.page.evaluate('mockRows'))+';');self.page.reload();self.page.wait_for_function('cloudReady')
        self.assertEqual(self.page.evaluate('payments[0].amount'),50)
        self.assertEqual(self.errors,[])

    def test_mobile_login_and_missing_library(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.route('https://cdn.jsdelivr.net/**',lambda route:route.abort())
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/')
        self.assertIn('could not load',self.page.locator('#authStatus').inner_text())
        self.assertEqual(self.errors,[])

if __name__=='__main__':unittest.main(verbosity=2)
