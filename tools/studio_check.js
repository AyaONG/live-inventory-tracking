'use strict';
// Read-only smoke checks. Login creates a session; no stock or video writes occur.
const base=process.env.BASE_URL||'http://localhost:3000';
(async()=>{
 const report=[];
 async function read(path,expected,cookie='') {
  const r=await fetch(base+path,{headers:cookie?{Cookie:cookie}:{}});let body=await r.json().catch(()=>({}));
  report.push({check:path,status:r.status,expected,passed:r.status===expected});return {r,body};
 }
 await read('/api/health',200);
 await read('/api/studio/analytics',401);
 const email=process.env.DEMO_ADMIN_EMAIL||'owner@shop.example',password=process.env.DEMO_ADMIN_PASSWORD||'Demo1234!';
 const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 if(!login.ok)throw new Error('Admin sign-in failed. Set DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD to your local demo credentials.');
 const cookie=login.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw new Error('Session cookie missing.');
 try {
  const {r,body}=await read('/api/studio/analytics?days=30',200,cookie);
  if(r.ok){
   report.push({check:'Live products returned',passed:Array.isArray(body.products)});
   report.push({check:'30 complete daily rows',passed:body.trend?.length===30});
   console.log('Source:',body.meta.database_name,'Window:',body.meta.window_start,'to',body.meta.window_end_exclusive,'(end exclusive)');
   console.log('Products:',body.summary.products,'Recorded units sold:',body.summary.units_sold,'Estimates available:',body.summary.estimates_available);
  }else console.error(body.error);
  await read('/api/studio/analytics?days=999',400,cookie);
  await read('/api/studio/movements',200,cookie);
 } finally {await fetch(base+'/api/logout',{method:'POST',headers:{Cookie:cookie}});}
 console.table(report);if(report.some(t=>!t.passed))process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
