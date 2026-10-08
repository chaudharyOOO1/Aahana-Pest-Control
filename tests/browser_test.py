"""Browser integration tests against an in-memory Supabase adapter; no production writes."""
import functools
import http.server
import json
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
 from:table=>{let op='select',payload,filters=[];
 const q={select(){return q},eq(k,v){filters.push([k,v]);return q},insert(p){op='insert';payload=p;return q},update(p){op='update';payload=p;return q},single(){return q},
 then(resolve){let rows=window.mockRows[table]||[];let result;
 if(op==='select')result={data:rows.filter(r=>filters.every(([k,v])=>r[k]===v)),error:null};
 else {window.mockWrites.push({table,op,payload,filters});if(window.mockError)result={data:null,error:{message:'offline'}};
 else{let row=op==='insert'?{id:crypto.randomUUID(),...payload}:rows.find(r=>filters.every(([k,v])=>r[k]===v));
 if(op==='insert'){(window.mockRows[table]??=[]).push(row)}else if(row)Object.assign(row,payload);
 result={data:row,error:row?null:{message:'missing row'}}}}return Promise.resolve(result).then(resolve)} };return q}
})};
'''

def fixture(empty=False):
    org='business-org'
    tables=['clients','service_plans','visits','visit_reports','jobs','invoices','payments','expenses','accounts','owner_capital','vendors','vendor_bills','vendor_payments']
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
    return rows

class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT))
        cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
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
        self.page.evaluate("window.prompt=(text)=>text.startsWith('Payment amount')?'50':'UPI';recordPayment(1)")
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

    def test_mobile_login_and_missing_library(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.route('https://cdn.jsdelivr.net/**',lambda route:route.abort())
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/')
        self.assertIn('could not load',self.page.locator('#authStatus').inner_text())
        self.assertEqual(self.errors,[])

if __name__=='__main__':unittest.main(verbosity=2)
