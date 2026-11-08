'use strict';
// Collect actual local evidence without modifying either database.
const fs=require('fs'),path=require('path');
const {analysisPool,collect,interpretation}=require('../lib/endterm-analysis');
const {csv}=require('../lib/endterm');
const root=path.resolve(__dirname,'..'),out=path.join(root,'endterm_output');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function chart(q,source){const w=1000,left=300,right=110,row=34,top=55,h=top+q.rows.length*row+70,area=w-left-right,max=Math.max(1,...q.rows.map(r=>Number(r[q.value])));return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img"><title>${esc(q.title)}</title><rect width="100%" height="100%" fill="white"/><g font-family="Arial" fill="black"><text x="20" y="28" font-size="19">${esc(q.title)}</text>`+q.rows.map((r,i)=>{let y=top+row*i,v=Number(r[q.value]);return `<text x="${left-10}" y="${y+17}" text-anchor="end" font-size="14">${esc(r.category)}</text><rect x="${left}" y="${y}" width="${v/max*area}" height="23" fill="#444"/><text x="${left+v/max*area+6}" y="${y+17}" font-size="13">${esc(v.toLocaleString('en-US',{maximumFractionDigits:2}))}</text>`;}).join('')+`<text x="${left}" y="${h-39}" font-size="13">0</text><text x="${left+area/2}" y="${h-39}" text-anchor="middle" font-size="14">${esc(q.unit)}</text><text x="${left+area}" y="${h-39}" text-anchor="end" font-size="13">${esc(max.toLocaleString())}</text><text x="20" y="${h-12}" font-size="12">Source: ${esc(source)}; read-only SQL; synthetic coursework data. Vertical axis: category.</text></g></svg>`;}
(async()=>{fs.mkdirSync(out,{recursive:true});const p=analysisPool();try{
 const a=await collect(p,root);fs.writeFileSync(path.join(out,'analysis_snapshot.json'),JSON.stringify(a,null,2));
 if(a.metadata.database_name!=='ayazhan_inventory')console.warn('Source differs from the expected A3 database name. Verify provenance before submission.');
 let html='<!doctype html><html lang="en"><meta charset="utf-8"><title>Part C actual data</title><style>body{max-width:1000px;margin:30px auto;font:16px Georgia;color:black}svg{width:100%;height:auto}article{break-inside:avoid;margin:20px 0}pre{white-space:pre-wrap;font-size:12px}</style><h1>Part C — actual database analysis</h1>';
 html+=`<p>Database ${esc(a.metadata.database_name)}; ${a.metadata.products} products; captured ${esc(a.metadata.captured_at)}. Generated test data, not real store demand.</p>`;
 for(const q of a.questions){const s=chart(q,a.metadata.database_name);fs.writeFileSync(path.join(out,q.id+'.svg'),s);fs.writeFileSync(path.join(out,q.id+'.sql'),q.sql);fs.writeFileSync(path.join(out,q.id+'.csv'),csv(q.rows,q.rows.length?Object.keys(q.rows[0]):['category',q.value]));html+='<article>'+s+'<details><summary>SQL</summary><pre>'+esc(q.sql)+'</pre></details></article>';}
 const text=interpretation(a);fs.writeFileSync(path.join(out,'C4_interpretation.txt'),text);html+='<h2>C4. Interpretation</h2><p>'+esc(text)+'</p></html>';fs.writeFileSync(path.join(out,'analysis.html'),html);
 console.log('EXPORTED '+out+'\nOpen analysis.html to view three charts. No stock or A3 records were changed.');
 }finally{await p.end();}})().catch(e=>{console.error('EXPORT STOPPED:',e.message,'\nCheck Postgres.app and ayazhan_inventory. Do not reseed.');process.exitCode=1;});
