const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const assert=require('node:assert/strict');
const source=stripTypeScriptTypes(fs.readFileSync(require('node:path').join(__dirname,'../supabase/functions/bootstrap-aahana-workspace/index.ts'),'utf8').replace(/^import .*;\n/,''));
async function run({method='POST',email='admin@aahanapestcontrol.com',confirmed=true,members=[],lookupError=null,token=true}={}){
 let handler;const calls=[];
 const context={Response,console:{error:()=>{}},Deno:{serve:fn=>handler=fn,env:{get:name=>name}},createClient:(_url,key)=>key==='SUPABASE_ANON_KEY'?{auth:{getUser:async()=>({data:{user:{id:'admin-id',email,email_confirmed_at:confirmed?'confirmed':null}}})}}:{from:table=>{
 const q={select:()=>q,eq:()=>q,limit:async()=>({data:members,error:lookupError}),insert:payload=>{calls.push(['insert',table,payload]);return q},single:async()=>({data:{id:'org-id'}}),upsert:async(payload,options)=>{calls.push(['upsert',table,payload,options]);return {}},then:resolve=>resolve({})};return q;
 }}};
 vm.runInNewContext(source,context);
 const result=await handler(new Request('http://test.local/',{method,headers:token?{Authorization:'Bearer test-token'}:{}}));
 return {status:result.status,headers:result.headers,body:method==='OPTIONS'?null:await result.json(),calls};
}
(async()=>{
 let r=await run({method:'OPTIONS'});assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'*');assert.equal(r.calls.length,0);
 r=await run({token:false});assert.equal(r.status,401);assert.equal(r.calls.length,0);
 r=await run({email:'other@example.com'});assert.equal(r.status,403);assert.equal(r.calls.length,0);
 r=await run({confirmed:false});assert.equal(r.status,403);assert.equal(r.calls.length,0);
 r=await run({lookupError:{message:'lookup failed'}});assert.equal(r.status,500);assert.equal(r.calls.length,0);
 r=await run({members:[{organization_id:'existing-id',role:'owner'}]});assert.equal(r.status,200);assert.equal(r.body.existing,true);assert.equal(r.calls.filter(c=>c[0]==='insert').length,0);assert.equal(r.calls[0][3].ignoreDuplicates,true);
 r=await run();assert.equal(r.status,200);assert.equal(r.body.organization_id,'org-id');assert.equal(r.calls.filter(c=>c[0]==='insert').length,2);assert.equal(r.calls.at(-1)[2].length,4);
 r=await run({members:[{organization_id:'a',role:'owner'},{organization_id:'b',role:'owner'}]});assert.equal(r.status,409);assert.equal(r.calls.length,0);
 console.log('PASS: 8 bootstrap regression scenarios; mocked database, no live writes.');
})().catch(e=>{console.error(e);process.exitCode=1});
