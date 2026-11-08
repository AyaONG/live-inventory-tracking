'use strict';
// Native smoke check: reads plus rejected mutations. It never performs a permitted stock write.
const fs=require('fs'),path=require('path');const base=process.env.SITE_URL||'http://localhost:3000';
const results=[];
async function call(url,options={}){const r=await fetch(base+url,options);return r;}
async function check(name,url,expected,options={}){const r=await call(url,options);results.push({name,status:r.status,expected,passed:r.status===expected});return r;}
async function login(email){const r=await call('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:process.env.DEMO_PASSWORD||'Demo1234!'})});if(!r.ok)throw Error('Test login failed: '+email);return r.headers.get('set-cookie').split(';')[0];}
(async()=>{
 await check('Database health','/api/health',200);await check('Public catalogue','/api/products',200);
 await check('Guest denied analytics','/api/endterm/analysis',401);
 const buyer=await login('customer@shop.example');
 await check('Buyer denied stock write','/api/stock-movements',403,{method:'POST',headers:{Cookie:buyer,'Content-Type':'application/json'},body:JSON.stringify({product_id:1,quantity_change:1,reason:'delivery',role:'owner'})});
 await check('Buyer denied scan','/api/endterm/scans',403,{method:'POST',headers:{Cookie:buyer,'Content-Type':'application/json'},body:'{}'});
 const seller=await login('employee1@shop.example');
 await check('Seller denied price editing','/api/products/1',403,{method:'PATCH',headers:{Cookie:seller,'Content-Type':'application/json'},body:'{}'});
 await check('Seller denied A3 analytics','/api/endterm/analysis',403,{headers:{Cookie:seller}});
 await check('Seller can export stock','/api/endterm/export/stock',200,{headers:{Cookie:seller}});
 for(const Cookie of [buyer,seller])await call('/api/logout',{method:'POST',headers:{Cookie}});
 const out=path.resolve(__dirname,'../endterm_output');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'native_checks.json'),JSON.stringify({at:new Date().toISOString(),base,scope:'Native HTTP health, reads and rejected mutations; not a full end-to-end or user test.',results},null,2));
 console.table(results);if(results.some(x=>!x.passed))process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
