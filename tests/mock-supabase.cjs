module.exports = `window.calls=[];window.rows={};window.failTable=null;window.session=null;window.writeError=false;window.authError=false;window.testUser={id:'admin-user',email:'admin@aahanapestcontrol.com'};window.readDelay=0;
window.supabase={createClient:()=>({auth:{
 onAuthStateChange:fn=>window.authEvent=fn,
 getSession:async()=>({data:{session:window.session}}),
 getUser:async()=>({data:{user:window.testUser}}),
 signInWithPassword:async args=>{if(window.authError)return {error:{message:'Invalid login credentials'}};window.calls.push(['signin',args.email]);window.session={user:{}};window.authEvent('SIGNED_IN',window.session);return {}},
 resetPasswordForEmail:async(email,options)=>{window.calls.push(['reset',email,options.redirectTo]);return {}},
 updateUser:async()=>{window.calls.push(['password']);return {}},
 signOut:async()=>{window.calls.push(['signout']);window.session=null;window.authEvent('SIGNED_OUT',null);return {}}
},from:table=>{let payload=null;let id=null;const q={
 select:()=>q,eq:(key,value)=>{if(key==='id')id=value;return q},
 update:value=>{payload=value;return q},insert:value=>{payload=value;return q},
 single:async()=>{if(window.writeError)return {error:{message:'Test save failed'}};window.calls.push(['write',table,payload]);return {data:{id:id||'new-'+table}}},
 then:async resolve=>{if(window.readDelay)await new Promise(r=>setTimeout(r,window.readDelay));return resolve(window.failTable===table?{error:{message:'Test backend unavailable'}}:{data:table==='organization_members'?[{organization_id:'org-1',role:'owner'}]:window.rows[table]||[]})}
};return q;}})};`;
